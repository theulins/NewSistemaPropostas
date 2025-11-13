import { initializePage, authFetch, showSuccess, showError } from './common.js';

const searchForm = document.getElementById('search-form');
const companiesTable = document.getElementById('companies-table');
const formSection = document.getElementById('form-section');
const listSection = document.getElementById('list-section');
const toggleButtons = document.querySelectorAll('.toggle-group button');
const companyForm = document.getElementById('company-form');
const cnpjField = companyForm?.elements?.cnpj || null;
const signaturePad = document.getElementById('signature-pad');
const signatureDataInput = document.getElementById('signature-data');
const clearSignature = document.getElementById('clear-signature');
const exportPdfBtn = document.getElementById('export-pdf');
const cnpjLookupBtn = document.getElementById('cnpj-lookup-btn');
const cnpjLookupStatus = document.getElementById('cnpj-lookup-status');

let ctx;
let drawing = false;
let profile;
let activeFilters = {};
const COMPANIES_TABLE_COLUMNS = 9;
const PLAN_LABELS = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

function digitsOnly(value = '') {
  return value.replace(/\D+/g, '');
}

function formatCnpj(value = '') {
  const digits = digitsOnly(value);
  if (digits.length !== 14) return value || '—';
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatPhone(value = '') {
  const digits = digitsOnly(value);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value || '—';
}

function formatZipCode(value = '') {
  const digits = digitsOnly(value);
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return value || '—';
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${(Number(value) * 100).toFixed(2).replace('.', ',')}%`;
}

function formatDateOnly(value) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.split('-').reverse().join('/');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('pt-BR');
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'empresa';
}

function formatPlanType(value) {
  if (!value) return '—';
  return PLAN_LABELS[value] || value;
}

function formatBooleanFlag(flag) {
  return flag ? 'Sim' : 'Não';
}

function formatCityState(city, state) {
  if (city && state) return `${city}/${state}`;
  return city || state || '';
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatStatus(status) {
  if (!status) return '—';
  return status[0].toUpperCase() + status.slice(1);
}

function sanitizeFilters(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function renderTableMessage(message, className = 'placeholder') {
  if (!companiesTable) return;
  companiesTable.innerHTML = `
    <tr class="${className}">
      <td colspan="${COMPANIES_TABLE_COLUMNS}">${message}</td>
    </tr>
  `;
}

function isPlaceholderRow(row) {
  return row.classList.contains('placeholder') || row.classList.contains('error-row');
}

function clearCnpjError() {
  if (!cnpjField) return;
  cnpjField.classList.remove('input-error');
  cnpjField.setCustomValidity('');
}

function flagCnpjError(message) {
  if (!cnpjField) return;
  cnpjField.classList.add('input-error');
  cnpjField.setCustomValidity(message || '');
  cnpjField.reportValidity();
}

cnpjField?.addEventListener('input', clearCnpjError);

async function loadCompanies(params = {}) {
  if (!companiesTable) return;
  activeFilters = sanitizeFilters(params);
  const query = new URLSearchParams(activeFilters);
  const endpoint = query.toString() ? `/empresas/search?${query}` : '/empresas/list';
  if (!companiesTable.children.length) {
    renderTableMessage('Carregando empresas...');
  }
  try {
    const data = await authFetch(endpoint);
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      renderTableMessage('Nenhuma empresa encontrada para os filtros informados.');
      return;
    }
    companiesTable.innerHTML = items
      .map(
        (item) => `
          <tr>
            <td>${item.id}</td>
            <td>${item.fantasy_name || '—'}</td>
            <td>${item.cnpj || '—'}</td>
            <td>${item.city || '—'}</td>
            <td>${item.state || '—'}</td>
            <td>${item.sector || '—'}</td>
            <td>${formatStatus(item.status)}</td>
            <td>${formatDate(item.updated_at)}</td>
            <td>
              <button type="button" class="ghost export-proposal" data-company-id="${item.id}">
                Exportar proposta
              </button>
            </td>
          </tr>
        `
      )
      .join('');
  } catch (error) {
    renderTableMessage('Não foi possível carregar as empresas no momento.', 'error-row');
    showError(error.message || 'Erro ao carregar empresas.');
  }
}

function showView(view) {
  const showForm = view === 'form';
  formSection.hidden = !showForm;
  listSection.hidden = showForm;
  toggleButtons.forEach((btn) => {
    btn.classList.toggle('primary', btn.dataset.view === view);
    btn.classList.toggle('ghost', btn.dataset.view !== view);
  });
  if (showForm) {
    requestAnimationFrame(() => resizeCanvas({ preserveDrawing: true }));
  }
}

function getCanvasContext() {
  if (!signaturePad) return null;
  if (!ctx) {
    ctx = signaturePad.getContext('2d');
  }
  return ctx;
}

function resizeCanvas({ preserveDrawing = false } = {}) {
  if (!signaturePad) return;
  const rect = signaturePad.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const ratio = window.devicePixelRatio || 1;
  let snapshot = null;
  if (preserveDrawing && signatureDataInput.value) {
    try {
      snapshot = signaturePad.toDataURL('image/png');
    } catch (_error) {
      snapshot = null;
    }
  }
  signaturePad.width = rect.width * ratio;
  signaturePad.height = rect.height * ratio;
  ctx = signaturePad.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#fff';
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (snapshot) {
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0, rect.width, rect.height);
    };
    image.src = snapshot;
  } else if (!preserveDrawing) {
    signatureDataInput.value = '';
  }
}

function startDrawing(event) {
  if (!signaturePad) return;
  event.preventDefault();
  drawing = true;
  const context = getCanvasContext();
  context.beginPath();
  const { x, y } = getOffset(event);
  context.moveTo(x, y);
}

function draw(event) {
  if (!drawing) return;
  event.preventDefault();
  const context = getCanvasContext();
  const { x, y } = getOffset(event);
  context.lineTo(x, y);
  context.stroke();
  updateSignatureData();
}

function stopDrawing(event) {
  if (!drawing) return;
  if (event) {
    event.preventDefault();
  }
  drawing = false;
  updateSignatureData();
}

function getOffset(event) {
  if (typeof event.offsetX === 'number' && typeof event.offsetY === 'number') {
    return { x: event.offsetX, y: event.offsetY };
  }
  const rect = signaturePad.getBoundingClientRect();
  const point = event.touches?.[0] || event.changedTouches?.[0];
  if (point) {
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    };
  }
  return { x: 0, y: 0 };
}

function updateSignatureData() {
  if (!signaturePad) return;
  try {
    const dataUrl = signaturePad.toDataURL('image/png');
    if (dataUrl && dataUrl !== 'data:,') {
      signatureDataInput.value = dataUrl;
    }
  } catch (_error) {
    // Ignora erros ao ler o canvas
  }
}

function clearSignaturePad() {
  const context = getCanvasContext();
  if (!context) return;
  const rect = signaturePad.getBoundingClientRect();
  context.clearRect(0, 0, rect.width, rect.height);
  context.beginPath();
  context.closePath();
  signatureDataInput.value = '';
}

function bindSignaturePad() {
  if (!signaturePad) return;
  signaturePad.style.touchAction = 'none';
  resizeCanvas();
  window.addEventListener('resize', () => resizeCanvas({ preserveDrawing: true }));
  signaturePad.addEventListener('pointerdown', startDrawing);
  signaturePad.addEventListener('pointermove', draw);
  signaturePad.addEventListener('pointerup', stopDrawing);
  signaturePad.addEventListener('pointerleave', stopDrawing);
  signaturePad.addEventListener('pointercancel', stopDrawing);
  clearSignature?.addEventListener('click', clearSignaturePad);
}

function preparePayload(formData) {
  const payload = Object.fromEntries(formData.entries());
  payload.commission_exempt = formData.get('commission_exempt') ? 1 : 0;
  if (payload.commission_rate) {
    payload.commission_rate = Number(payload.commission_rate) / 100;
  }
  return payload;
}

function buildFilterSummary() {
  const summary = [];
  if (activeFilters.q) {
    summary.push(`Busca: ${activeFilters.q}`);
  }
  if (activeFilters.status) {
    summary.push(`Status: ${activeFilters.status}`);
  }
  return summary.join(' • ');
}

function exportTableToPdf() {
  const rows = Array.from(companiesTable.querySelectorAll('tr')).filter((row) => !isPlaceholderRow(row));
  if (!rows.length) {
    showError('Não há dados para exportar. Faça uma busca antes.');
    return;
  }
  if (!window.jspdf?.jsPDF) {
    showError('Biblioteca de PDF não carregada. Verifique sua conexão.');
    return;
  }

  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;
  const columns = [
    { width: 15 },
    { width: 65 },
    { width: 45 },
    { width: 35 },
    { width: 12 },
    { width: 32 },
    { width: 30 },
    { width: 39 },
  ];
  const usableWidth = columns.reduce((total, col) => total + col.width, 0);
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerLabels = ['ID', 'Nome fantasia', 'CNPJ', 'Cidade', 'UF', 'Setor', 'Status', 'Atualizado'];
  const filterSummary = buildFilterSummary();

  doc.setFontSize(16);
  doc.text('Empresas cadastradas', margin, margin);
  doc.setFontSize(10);
  doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, margin, margin + 6);
  if (filterSummary) {
    doc.text(`Filtros: ${filterSummary}`, margin, margin + 12, { maxWidth: usableWidth });
  }

  let cursorY = margin + (filterSummary ? 20 : 16);

  const drawRow = (values, { header = false } = {}) => {
    doc.setFont('helvetica', header ? 'bold' : 'normal');
    const processed = values.map((value, index) => {
      const content = value || '—';
      const width = columns[index].width - 2;
      return doc.splitTextToSize(content, width);
    });
    const lineHeight = header ? 6 : 5;
    const rowHeight = Math.max(...processed.map((lines) => lines.length)) * lineHeight + 2;
    if (!header && cursorY + rowHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
      drawRow(headerLabels, { header: true });
    }
    let cursorX = margin;
    processed.forEach((lines, index) => {
      doc.text(lines, cursorX, cursorY, { baseline: 'top' });
      cursorX += columns[index].width;
    });
    doc.setDrawColor(180);
    doc.line(margin, cursorY + rowHeight, margin + usableWidth, cursorY + rowHeight);
    cursorY += rowHeight + 2;
  };

  drawRow(headerLabels, { header: true });
  rows.forEach((row) => {
    const values = Array.from(row.children).map((cell) => cell.textContent.trim());
    drawRow(values);
  });

  const filename = `empresas-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

async function fetchSignatureDataUrl(signatureUrl) {
  if (!signatureUrl) return null;
  try {
    const absoluteUrl = new URL(signatureUrl, window.location.origin).href;
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (_error) {
    return null;
  }
}

function detectImageFormat(dataUrl = '') {
  if (dataUrl.startsWith('data:image/jpeg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

async function generateProposalPdf(company) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    throw new Error('Biblioteca de PDF não carregada.');
  }
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const ensureSpace = (needed) => {
    if (cursorY + needed > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
  };

  const addSectionTitle = (title) => {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, margin, cursorY);
    cursorY += 4;
    doc.setDrawColor(200);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
  };

  const addGrid = (items, columns = 2) => {
    if (!items.length) return;
    const colWidth = usableWidth / columns;
    for (let i = 0; i < items.length; i += columns) {
      const row = items.slice(i, i + columns);
      const splitted = row.map((item) => doc.splitTextToSize(item.value || '—', colWidth - 2));
      const maxLines = Math.max(...splitted.map((lines) => lines.length));
      const rowHeight = 6 + maxLines * 4;
      ensureSpace(rowHeight);
      row.forEach((item, index) => {
        const x = margin + colWidth * index;
        doc.setFont('helvetica', 'bold');
        doc.text(item.label, x, cursorY);
        doc.setFont('helvetica', 'normal');
        doc.text(splitted[index], x, cursorY + 4);
      });
      cursorY += rowHeight;
    }
  };

  const addParagraph = (text) => {
    const content = text?.trim() ? text.trim() : '—';
    const lines = doc.splitTextToSize(content, usableWidth);
    const blockHeight = lines.length * 5 + 2;
    ensureSpace(blockHeight);
    doc.text(lines, margin, cursorY);
    cursorY += blockHeight;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Proposta Comercial', pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Emitida em ${new Date().toLocaleString('pt-BR')}`, margin, cursorY);
  doc.text(`Empresa #${company.id}`, pageWidth - margin, cursorY, { align: 'right' });
  cursorY += 6;
  doc.text(`Status atual: ${formatStatus(company.status)}`, margin, cursorY);
  doc.text(`Atualizado em ${formatDate(company.updated_at)}`, pageWidth - margin, cursorY, { align: 'right' });
  cursorY += 8;

  addSectionTitle('Dados da empresa');
  addGrid(
    [
      { label: 'Nome fantasia', value: company.fantasy_name || '—' },
      { label: 'Razão social', value: company.corporate_name || '—' },
      { label: 'CNPJ', value: formatCnpj(company.cnpj) },
      { label: 'Inscrição estadual', value: company.ie || '—' },
      { label: 'Setor', value: company.sector || company.business_activity || '—' },
      { label: 'Data de fundação', value: formatDateOnly(company.foundation_date) },
      { label: 'Funcionários', value: company.employees_qty ? String(company.employees_qty) : '—' },
      { label: 'Contabilidade', value: company.accounting_office || '—' },
    ]
  );

  const addressLine = [
    company.address,
    formatCityState(company.city, company.state),
    formatZipCode(company.zip),
  ]
    .filter(Boolean)
    .join(' • ');
  ensureSpace(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Endereço', margin, cursorY);
  doc.setFont('helvetica', 'normal');
  cursorY += 5;
  const addressLines = doc.splitTextToSize(addressLine || '—', usableWidth);
  doc.text(addressLines, margin, cursorY);
  cursorY += addressLines.length * 5 + 4;

  addSectionTitle('Contatos');
  addGrid(
    [
      { label: 'Telefone', value: formatPhone(company.phone) },
      { label: 'Celular', value: formatPhone(company.cel) },
      { label: 'WhatsApp', value: formatPhone(company.whatsapp) },
      { label: 'E-mail', value: company.email || '—' },
      { label: 'Instagram', value: company.instagram ? `@${company.instagram.replace(/^@/, '')}` : '—' },
      { label: 'Indicação', value: company.referred_by || '—' },
    ]
  );

  addSectionTitle('Plano e condições');
  addGrid(
    [
      { label: 'Plano', value: formatPlanType(company.plan_type) },
      { label: 'Valor', value: formatCurrency(company.value) },
      { label: 'Vencimento', value: formatDateOnly(company.due_date) },
      { label: 'Taxa de comissão', value: formatPercent(company.commission_rate) },
      { label: 'Isento de comissão', value: formatBooleanFlag(company.commission_exempt) },
      { label: 'Atualizado em', value: formatDate(company.updated_at) },
    ],
    2
  );

  addSectionTitle('Observações adicionais');
  addParagraph(company.note || 'Sem observações adicionais.');

  addSectionTitle('Assinatura');
  const signatureDataUrl = await fetchSignatureDataUrl(company.signature_url);
  const signatureBoxWidth = usableWidth / 1.5;
  const signatureBoxHeight = 32;
  ensureSpace(signatureBoxHeight + 14);
  doc.setDrawColor(180);
  doc.rect(margin, cursorY, signatureBoxWidth, signatureBoxHeight);
  if (signatureDataUrl) {
    doc.addImage(
      signatureDataUrl,
      detectImageFormat(signatureDataUrl),
      margin + 2,
      cursorY + 2,
      signatureBoxWidth - 4,
      signatureBoxHeight - 4,
      undefined,
      'FAST'
    );
  } else {
    doc.setFontSize(9);
    doc.text('Assinatura não cadastrada.', margin + 2, cursorY + signatureBoxHeight / 2);
  }
  cursorY += signatureBoxHeight + 6;
  doc.setFontSize(10);
  doc.setDrawColor(200);
  doc.line(margin, cursorY, margin + signatureBoxWidth, cursorY);
  cursorY += 4;
  doc.text('Assinatura do responsável', margin, cursorY);

  const safeName = slugify(company.fantasy_name || company.corporate_name || 'empresa');
  const filename = `proposta-${company.id}-${safeName}.pdf`;
  doc.save(filename);
}

async function exportCompanyProposal(companyId, triggerButton) {
  if (!companyId) return;
  const originalLabel = triggerButton?.textContent;
  try {
    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.textContent = 'Gerando...';
    }
    const response = await authFetch(`/empresas/${companyId}/proposta`);
    await generateProposalPdf(response.data);
  } catch (error) {
    showError(error.message);
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = originalLabel || 'Exportar proposta';
    }
  }
}

async function lookupCnpj() {
  if (!companyForm) return;
  const cnpjField = companyForm.elements.cnpj;
  if (!cnpjField) return;
  const digits = digitsOnly(cnpjField.value || '');
  if (digits.length !== 14) {
    showError('Informe um CNPJ válido com 14 dígitos.');
    return;
  }
  cnpjLookupBtn.disabled = true;
  cnpjLookupBtn.textContent = 'Buscando...';
  if (cnpjLookupStatus) {
    cnpjLookupStatus.textContent = 'Consultando a base da Receita Federal...';
  }
  try {
    const response = await authFetch(`/empresas/cnpj/${digits}`);
    const data = response.data || {};
    const mapping = {
      fantasy_name: 'fantasy_name',
      corporate_name: 'corporate_name',
      cnpj: 'cnpj',
      ie: 'ie',
      address: 'address',
      zip: 'zip',
      city: 'city',
      state: 'state',
      email: 'email',
      phone: 'phone',
      business_activity: 'business_activity',
      sector: 'sector',
      foundation_date: 'foundation_date',
    };
    Object.entries(mapping).forEach(([source, target]) => {
      if (data[source] !== undefined && companyForm.elements[target]) {
        companyForm.elements[target].value = data[source] || '';
      }
    });
    if (companyForm.elements.state && companyForm.elements.state.value) {
      companyForm.elements.state.value = companyForm.elements.state.value.toUpperCase();
    }
    clearCnpjError();
    if (cnpjLookupStatus) {
      cnpjLookupStatus.textContent = 'Dados preenchidos automaticamente.';
    }
  } catch (error) {
    if (cnpjLookupStatus) {
      cnpjLookupStatus.textContent = '';
    }
    showError(error.message);
  } finally {
    cnpjLookupBtn.disabled = false;
    cnpjLookupBtn.textContent = 'Buscar dados pelo CNPJ';
  }
}

async function init() {
  const context = await initializePage('empresas');
  if (!context) return;
  profile = context.profile;
  await loadCompanies();
  bindSignaturePad();
  showView('lista');

  const canCreate = ['editor', 'admin'].includes(profile.role);
  companyForm.querySelectorAll('input, select, textarea, button').forEach((el) => {
    if (!canCreate) {
      el.disabled = true;
    }
  });
  if (!canCreate) {
    const notice = document.createElement('p');
    notice.className = 'notice';
    notice.textContent = 'Somente editores ou administradores podem criar empresas.';
    formSection.insertBefore(notice, companyForm);
  }

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      showView(button.dataset.view);
    });
  });

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(searchForm);
    const params = {};
    formData.forEach((value, key) => {
      if (value) {
        params[key] = value;
      }
    });
    await loadCompanies(params);
    showView('lista');
  });

  companiesTable?.addEventListener('click', (event) => {
    const button = event.target.closest('.export-proposal');
    if (!button) return;
    const companyId = Number(button.dataset.companyId);
    if (!Number.isInteger(companyId)) return;
    exportCompanyProposal(companyId, button);
  });

  exportPdfBtn?.addEventListener('click', exportTableToPdf);
  cnpjLookupBtn?.addEventListener('click', lookupCnpj);

  companyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canCreate) return;
    const formData = new FormData(companyForm);
    if (!signatureDataInput.value) {
      updateSignatureData();
    }
    const payload = preparePayload(formData);
    try {
      clearCnpjError();
      await authFetch('/empresas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showSuccess('Empresa cadastrada com sucesso.');
      companyForm.reset();
      clearSignaturePad();
      clearCnpjError();
      await loadCompanies();
      showView('lista');
    } catch (error) {
      showError(error.message);
      if (/CNPJ/i.test(error.message || '')) {
        flagCnpjError(error.message);
      }
    }
  });
}

init();
