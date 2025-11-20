import {
  initializePage,
  authFetch,
  showSuccess,
  showError,
  confirmAction,
} from './common.js';

const searchForm = document.getElementById('search-form');
const companiesTable = document.getElementById('companies-table');
const formSection = document.getElementById('form-section');
const listSection = document.getElementById('list-section');
const toggleButtons = document.querySelectorAll('.toggle-group button');
const companyForm = document.getElementById('company-form');
const signaturePad = document.getElementById('signature-pad');
const signatureDataInput = document.getElementById('signature-data');
const clearSignature = document.getElementById('clear-signature');
const exportPdfBtn = document.getElementById('export-pdf');
const exportCsvBtn = document.getElementById('export-csv');
const cnpjLookupBtn = document.getElementById('cnpj-lookup-btn');
const cnpjLookupStatus = document.getElementById('cnpj-lookup-status');
const formTitle = document.getElementById('form-title');
const submitButton = companyForm?.querySelector('button[type="submit"]');

const TABLE_HEADERS = ['ID', 'Nome fantasia', 'CNPJ', 'Cidade', 'UF', 'Setor', 'Status', 'Atualizado'];
const SERVICE_LABELS = {
  spc: 'SPC',
  nfe: 'NF-e',
  nfce: 'NFC-e',
  cte: 'CT-e',
  cfe: 'CF-e',
};
const MARKETING_LABELS = {
  site: 'Site',
  whatsapp: 'WhatsApp',
  email: 'E-mail marketing',
};

let ctx;
let drawing = false;
let signatureHasContent = false;
let profile;
let activeFilters = {};
let canManageCompanies = false;
let editingCompanyId = null;

function digitsOnly(value = '') {
  return value.replace(/\D+/g, '');
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDateOnly(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(number)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(number);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(number)) return '—';
  return `${(number * 100).toFixed(2)}%`;
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

function renderActionsCell(item) {
  const buttons = [];
  if (canManageCompanies) {
    buttons.push(
      `<button type="button" class="ghost" data-action="edit" data-id="${item.id}">Editar</button>`
    );
    buttons.push(
      `<button type="button" class="ghost danger" data-action="delete" data-id="${item.id}">Excluir</button>`
    );
  }
  buttons.push(
    `<button type="button" class="ghost" data-action="pdf" data-id="${item.id}">Exportar PDF</button>`
  );
  return `<div class="row-actions">${buttons.join('')}</div>`;
}

async function loadCompanies(params = {}) {
  activeFilters = sanitizeFilters(params);
  const query = new URLSearchParams(activeFilters);
  const endpoint = query.toString() ? `/empresas/search?${query}` : '/empresas/list';
  const data = await authFetch(endpoint);
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) {
    companiesTable.innerHTML = `
      <tr>
        <td colspan="9">Nenhuma empresa encontrada com os filtros selecionados.</td>
      </tr>
    `;
    return;
  }
  companiesTable.innerHTML = items
    .map(
      (item) => `
        <tr data-id="${item.id}">
          <td>${item.id}</td>
          <td>${item.fantasy_name || '—'}</td>
          <td>${item.cnpj || '—'}</td>
          <td>${item.city || '—'}</td>
          <td>${item.state || '—'}</td>
          <td>${item.sector || '—'}</td>
          <td>${formatStatus(item.status)}</td>
          <td>${formatDateTime(item.updated_at)}</td>
          <td>${renderActionsCell(item)}</td>
        </tr>
      `
    )
    .join('');
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
    requestAnimationFrame(() => resizeCanvas());
  }
}

function getSignatureStrokeColor() {
  const styles = getComputedStyle(document.documentElement);
  return styles.getPropertyValue('--text')?.trim() || '#0b1020';
}

function getCanvasContext() {
  if (!ctx) {
    ctx = signaturePad.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }
  ctx.strokeStyle = getSignatureStrokeColor();
  return ctx;
}

function resetSignatureData() {
  signatureHasContent = false;
  if (signatureDataInput) {
    signatureDataInput.value = '';
  }
}

function resizeCanvas() {
  if (!signaturePad) return;
  const ratio = window.devicePixelRatio || 1;
  const rect = signaturePad.getBoundingClientRect();
  signaturePad.width = rect.width * ratio;
  signaturePad.height = rect.height * ratio;
  const context = getCanvasContext();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, signaturePad.width, signaturePad.height);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  resetSignatureData();
}

function startDrawing(event) {
  if (!signaturePad) return;
  if (event?.cancelable) {
    event.preventDefault();
  }
  drawing = true;
  const context = getCanvasContext();
  context.beginPath();
  const { offsetX, offsetY } = getOffset(event);
  context.moveTo(offsetX, offsetY);
  context.lineTo(offsetX, offsetY);
  context.stroke();
  signatureHasContent = true;
  updateSignatureData();
}

function draw(event) {
  if (!drawing) return;
  if (event?.preventDefault) {
    event.preventDefault();
  }
  const context = getCanvasContext();
  const { offsetX, offsetY } = getOffset(event);
  context.lineTo(offsetX, offsetY);
  context.stroke();
  signatureHasContent = true;
  updateSignatureData();
}

function stopDrawing(event) {
  if (event?.preventDefault && event.cancelable) {
    event.preventDefault();
  }
  drawing = false;
  if (signatureHasContent) {
    updateSignatureData();
  }
}

function getOffset(event) {
  if (event.touches && event.touches[0]) {
    const rect = signaturePad.getBoundingClientRect();
    const touch = event.touches[0];
    return {
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    };
  }
  return { offsetX: event.offsetX, offsetY: event.offsetY };
}

function updateSignatureData() {
  if (!signaturePad || !signatureHasContent) return;
  signatureDataInput.value = signaturePad.toDataURL('image/png');
}

function clearSignaturePad() {
  if (!signaturePad) return;
  const context = getCanvasContext();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, signaturePad.width, signaturePad.height);
  context.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  resetSignatureData();
}

function bindSignaturePad() {
  if (!signaturePad) return;
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  signaturePad.addEventListener('mousedown', startDrawing);
  signaturePad.addEventListener('mousemove', draw);
  signaturePad.addEventListener('mouseup', stopDrawing);
  signaturePad.addEventListener('mouseleave', stopDrawing);
  signaturePad.addEventListener('touchstart', startDrawing, { passive: false });
  signaturePad.addEventListener('touchmove', draw, { passive: false });
  signaturePad.addEventListener('touchend', stopDrawing);
  clearSignature?.addEventListener('click', () => {
    clearSignaturePad();
  });
}

function preparePayload(formData) {
  const payload = {
    services_contracted: [],
    marketing_authorizations: [],
  };
  formData.forEach((value, key) => {
    if (key === 'commission_exempt') return;
    if (Array.isArray(payload[key])) {
      if (value) {
        payload[key].push(typeof value === 'string' ? value.trim() : value);
      }
      return;
    }
    payload[key] = typeof value === 'string' ? value.trim() : value;
  });
  payload.commission_exempt = formData.get('commission_exempt') ? 1 : 0;
  if (!payload.employees_qty) {
    payload.employees_qty = null;
  } else {
    payload.employees_qty = Number(payload.employees_qty);
  }
  if (!payload.value) {
    payload.value = null;
  } else {
    payload.value = Number(payload.value);
  }
  if (payload.commission_rate) {
    payload.commission_rate = Number(payload.commission_rate) / 100;
  } else {
    payload.commission_rate = null;
  }
  if (!payload.signature_data_url) {
    delete payload.signature_data_url;
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

function getTableRows() {
  return Array.from(companiesTable.querySelectorAll('tr[data-id]'));
}

function extractRowValues(row) {
  return TABLE_HEADERS.map((_, index) => row.children[index]?.textContent.trim() || '');
}

function exportTableToPdf() {
  const rows = getTableRows();
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
  const columns = [15, 60, 45, 35, 12, 32, 30, 39];
  const usableWidth = columns.reduce((sum, width) => sum + width, 0);
  const headerLabels = TABLE_HEADERS;
  const filterSummary = buildFilterSummary();

  doc.setFontSize(16);
  doc.text('Empresas cadastradas', margin, margin);
  doc.setFontSize(10);
  doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, margin, margin + 6);
  if (filterSummary) {
    doc.text(`Filtros: ${filterSummary}`, margin, margin + 12, { maxWidth: usableWidth });
  }

  let cursorY = margin + (filterSummary ? 20 : 16);
  const pageHeight = doc.internal.pageSize.getHeight();

  const drawRow = (values, { header = false } = {}) => {
    doc.setFont('helvetica', header ? 'bold' : 'normal');
    const processed = values.map((value, index) => {
      const content = value || '—';
      const width = columns[index] - 2;
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
      cursorX += columns[index];
    });
    doc.setDrawColor(180);
    doc.line(margin, cursorY + rowHeight, margin + usableWidth, cursorY + rowHeight);
    cursorY += rowHeight + 2;
  };

  drawRow(headerLabels, { header: true });
  rows.forEach((row) => {
    const values = extractRowValues(row);
    drawRow(values);
  });

  doc.save(`empresas-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exportTableToCsv() {
  const rows = getTableRows();
  if (!rows.length) {
    showError('Não há dados para exportar. Faça uma busca antes.');
    return;
  }
  const filterSummary = buildFilterSummary();
  const lines = [];
  lines.push(['Empresas cadastradas']);
  lines.push(['Emitido em', new Date().toLocaleString('pt-BR')]);
  if (filterSummary) {
    lines.push(['Filtros', filterSummary]);
  }
  lines.push(TABLE_HEADERS);
  rows.forEach((row) => {
    lines.push(extractRowValues(row));
  });

  const csvContent = lines
    .map((cells) =>
      cells
        .map((cell) => {
          const safe = (cell || '').replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(';')
    )
    .join('\r\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `empresas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

async function fetchCompanyDetails(id) {
  const response = await authFetch(`/empresas/${id}`);
  return response.data;
}

function setCheckboxGroup(fieldName, values = []) {
  if (!companyForm) return;
  const normalized = Array.isArray(values) ? values : values ? [values] : [];
  const selected = new Set(normalized);
  companyForm.querySelectorAll(`input[name="${fieldName}"]`).forEach((checkbox) => {
    checkbox.checked = selected.has(checkbox.value);
  });
}

function setFormMode(mode = 'create') {
  if (!formTitle || !submitButton) return;
  if (mode === 'edit') {
    formTitle.textContent = 'Editar empresa';
    submitButton.textContent = 'Atualizar empresa';
  } else {
    formTitle.textContent = 'Cadastrar nova empresa';
    submitButton.textContent = 'Salvar empresa';
  }
}

async function displaySignaturePreview(signatureUrl) {
  clearSignaturePad();
  if (!signatureUrl) return;
  try {
    const dataUrl = await fetchImageAsDataUrl(signatureUrl);
    const image = new Image();
    image.src = dataUrl;
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
    });
    const context = getCanvasContext();
    const rect = signaturePad.getBoundingClientRect();
    context.drawImage(image, 0, 0, rect.width, rect.height);
    resetSignatureData();
  } catch (error) {
    console.warn('Não foi possível carregar a assinatura existente', error);
  }
}

async function populateForm(company) {
  if (!companyForm || !company) return;
  const fields = [
    'fantasy_name',
    'corporate_name',
    'cnpj',
    'ie',
    'address',
    'zip',
    'city',
    'state',
    'phone',
    'cel',
    'whatsapp',
    'email',
    'instagram',
    'business_activity',
    'foundation_date',
    'employees_qty',
    'sector',
    'accounting_office',
    'referred_by',
    'note',
    'plan_type',
    'value',
    'due_date',
  ];
  fields.forEach((field) => {
    if (companyForm.elements[field]) {
      companyForm.elements[field].value = company[field] ?? '';
    }
  });
  if (companyForm.elements.commission_rate) {
    companyForm.elements.commission_rate.value = company.commission_rate
      ? (Number(company.commission_rate) * 100).toFixed(2)
      : '';
  }
  if (companyForm.elements.commission_exempt) {
    companyForm.elements.commission_exempt.checked = Boolean(company.commission_exempt);
  }
  setCheckboxGroup('services_contracted', company.services_contracted || []);
  setCheckboxGroup('marketing_authorizations', company.marketing_authorizations || []);
  await displaySignaturePreview(company.signature_url);
}

function resetFormState() {
  editingCompanyId = null;
  setFormMode('create');
  companyForm.reset();
  clearSignaturePad();
  resetSignatureData();
}

async function startEditingCompany(id) {
  if (!canManageCompanies) return;
  try {
    const company = await fetchCompanyDetails(id);
    editingCompanyId = company.id;
    setFormMode('edit');
    showView('form');
    await populateForm(company);
  } catch (error) {
    showError(error.message);
  }
}

async function handleDeleteCompany(id) {
  if (!canManageCompanies) return;
  const confirmed = await confirmAction({
    title: 'Excluir empresa',
    text: 'Tem certeza que deseja remover esta empresa? Esta ação não pode ser desfeita.',
    confirmButtonText: 'Sim, excluir',
  });
  if (!confirmed) return;
  try {
    await authFetch(`/empresas/${id}`, { method: 'DELETE' });
    showSuccess('Empresa excluída com sucesso.');
    await loadCompanies(activeFilters);
  } catch (error) {
    showError(error.message);
  }
}

function getImageFormat(dataUrl) {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return 'PNG';
}

async function fetchImageAsDataUrl(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error('Não foi possível carregar a assinatura.');
  }
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function resolveSignatureData(company) {
  if (company.signature_data_url) {
    return company.signature_data_url;
  }
  if (company.signature_url) {
    try {
      return await fetchImageAsDataUrl(company.signature_url);
    } catch (error) {
      console.warn(error);
      return null;
    }
  }
  return null;
}

function describeOptions(values, labels) {
  const source = Array.isArray(values) ? values : [];
  const readable = source
    .map((value) => labels[value] || null)
    .filter(Boolean);
  return readable.length ? readable.join(', ') : '—';
}

async function generateCompanyPdf(company) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!company || !jsPDF) {
    showError('Não foi possível gerar o PDF.');
    return;
  }

  // Helper para carregar o logo da pasta /media
  const loadLogo = () =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/media/logo.png'; // C:\xampp\htdocs\NewSistemaProposta\public\media\logo.png
    });

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  let cursorY = 15;
  const lineHeight = 6;
  const currentYear = new Date().getFullYear();

  const get = (value) => (value ? String(value) : '');

  const getOr = (...keys) => {
    for (const key of keys) {
      const value = company && company[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return '';
  };

  const formatMoney = (value) => {
    if (value == null || isNaN(value)) return '';
    return typeof formatCurrency === 'function'
      ? formatCurrency(value)
      : Number(value).toFixed(2);
  };

  const formatDate = (value) => {
    if (!value) return '';
    return typeof formatDateOnly === 'function'
      ? formatDateOnly(value)
      : new Date(value).toLocaleDateString('pt-BR');
  };

  const hasService = (key) =>
    Array.isArray(company.services_contracted) &&
    company.services_contracted.includes(key);

  const hasMarketing = (key) =>
    Array.isArray(company.marketing_authorizations) &&
    company.marketing_authorizations.includes(key);

  const drawCheckbox = (label, x, y, checked) => {
    const boxSize = 4;
    doc.rect(x, y - boxSize + 1, boxSize, boxSize);
    if (checked) {
      doc.line(x + 0.8, y - boxSize + 1.8, x + boxSize - 0.8, y - 1.2);
      doc.line(x + 0.8, y - 1.2, x + boxSize - 0.8, y - boxSize + 1.8);
    }
    doc.text(label, x + boxSize + 2, y);
  };

  // ===== CABEÇALHO COM LOGO =====
  doc.setFont('times', 'normal');
  doc.setFontSize(11);

  const logoImg = await loadLogo();
  if (logoImg) {
    const logoWidth = 35;
    const logoHeight = 18;
    const logoX = margin;
    const logoY = cursorY;
    doc.addImage(logoImg, 'PNG', logoX, logoY, logoWidth, logoHeight);
  }

  // Título principal – PROPOSTA ASSOCIADOS ANO
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text(`PROPOSTA ASSOCIADOS ${currentYear}`, centerX, cursorY + 5, {
    align: 'center',
  });

  // Subtítulo – PROPOSTA DE ADMISSÃO DE SÓCIO
  doc.setFontSize(13);
  doc.text('PROPOSTA DE ADMISSÃO DE SÓCIO', centerX, cursorY + 13, {
    align: 'center',
  });

  cursorY += 25;

  // ===== DADOS DA EMPRESA =====
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('Razão Social:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.corporate_name), margin + 32, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Denominação Comercial:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.fantasy_name), margin + 47, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Endereço:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.address), margin + 22, cursorY);

  doc.setFont('times', 'bold');
  const cepLabel = 'CEP:';
  const cepX = pageWidth - margin - 40;
  doc.text(cepLabel, cepX, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.zip), cepX + 10, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('E-MAIL:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.email), margin + 20, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Instagram:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.instagram), margin + 25, cursorY);

  doc.setFont('times', 'bold');
  doc.text('Telefone:', margin + 90, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.phone), margin + 113, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Cidade:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.city), margin + 19, cursorY);

  doc.setFont('times', 'bold');
  doc.text('Estado:', margin + 70, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.state), margin + 92, cursorY);

  doc.setFont('times', 'bold');
  doc.text('CEL:', margin + 115, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.cel), margin + 129, cursorY);

  doc.setFont('times', 'bold');
  doc.text('WhatsApp:', margin + 155, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.whatsapp), margin + 185, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('CNPJ:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.cnpj), margin + 17, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Inscrição Estadual:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(getOr('state_registration', 'ie', 'ie_number'), margin + 40, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Ramo de Atividade:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(getOr('activity_branch', 'business_activity'), margin + 40, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Data Fundação:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(formatDate(getOr('foundation_date', 'opening_date')), margin + 34, cursorY);

  doc.setFont('times', 'bold');
  doc.text('Quantidade de Funcionários:', margin + 80, cursorY);
  doc.setFont('times', 'normal');
  doc.text(getOr('employees_count', 'employees'), margin + 135, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Setor:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.sector), margin + 18, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Esc.de Contabilidade:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(getOr('accounting_office', 'accounting'), margin + 45, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Indicação de:', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(getOr('indication', 'referred_by'), margin + 28, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'bold');
  doc.text('Observação:', margin, cursorY);
  doc.setFont('times', 'normal');
  const obsEmpresa = getOr('observation', 'note');
  const obsEmpresaLines = doc.splitTextToSize(
    obsEmpresa,
    pageWidth - margin * 2 - 25
  );
  doc.text(obsEmpresaLines, margin + 27, cursorY);
  cursorY += Math.max(lineHeight, obsEmpresaLines.length * 4 + 2);

  cursorY += 2;

  // ===== SÓCIOS OU DIRETORES =====
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('SÓCIOS OU DIRETORES', centerX, cursorY, { align: 'center' });
  cursorY += lineHeight;

  const partners = Array.isArray(company.partners) ? company.partners : [];

  doc.setFont('times', 'bold');
  for (let i = 0; i < 4; i++) {
    const partner = partners[i] || {};
    doc.text('Nome:', margin, cursorY);
    doc.setFont('times', 'normal');
    doc.text(get(partner.name), margin + 18, cursorY);

    doc.setFont('times', 'bold');
    doc.text('CPF:', margin + 120, cursorY);
    doc.setFont('times', 'normal');
    doc.text(get(partner.cpf), margin + 135, cursorY);

    cursorY += lineHeight;
    doc.setFont('times', 'bold');
  }

  cursorY += 2;

  // ===== SERVIÇOS CONTRATADOS =====
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('Serviços Contratados:', margin, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'normal');

  // linha única SPC / NF-e / NFC-e / MDF-e / CT-e / CF-e
  let x = margin;
  const labels = [
    { key: 'spc', label: SERVICE_LABELS?.spc || 'SPC' },
    { key: 'nfe', label: SERVICE_LABELS?.nfe || 'NF-e' },
    { key: 'nfce', label: SERVICE_LABELS?.nfce || 'NFC-e' },
    { key: 'mdfe', label: 'MDF-e' },
    { key: 'cte', label: SERVICE_LABELS?.cte || 'CT-e' },
    { key: 'cfe', label: SERVICE_LABELS?.cfe || 'CF-e' },
  ];

  labels.forEach((item) => {
    drawCheckbox(item.label, x, cursorY, hasService(item.key));
    x += 30;
  });
  cursorY += lineHeight + 2;

  doc.setFont('times', 'bold');
  doc.text('OBS:', margin, cursorY);
  doc.setFont('times', 'normal');
  const obsServicos = getOr('services_note', 'services_obs');
  const obsServicosLines = doc.splitTextToSize(
    obsServicos,
    pageWidth - margin * 2 - 15
  );
  doc.text(obsServicosLines, margin + 15, cursorY);
  cursorY += Math.max(lineHeight, obsServicosLines.length * 4 + 2);

  cursorY += 2;

  // ===== TIPO / VALOR / VENCIMENTO =====
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('Tipo', margin, cursorY);
  doc.setFont('times', 'normal');
  doc.text(get(company.plan_type), margin + 12, cursorY);

  doc.setFont('times', 'bold');
  doc.text('Vlr.:', margin + 80, cursorY);
  doc.setFont('times', 'normal');
  doc.text(formatMoney(company.value), margin + 95, cursorY);

  doc.setFont('times', 'bold');
  doc.text('Vencimento em', margin + 130, cursorY);
  doc.setFont('times', 'normal');
  doc.text(formatDate(company.due_date), margin + 170, cursorY);
  cursorY += lineHeight + 4;

  // ===== AUTORIZAÇÃO DE DIVULGAÇÃO =====
  doc.setFont('times', 'bold');
  doc.text('Autorização de divulgação:', margin, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'normal');
  drawCheckbox('Site da Aciu', margin, cursorY, hasMarketing('site'));
  drawCheckbox(
    'Grupo de whatsapp',
    margin + 55,
    cursorY,
    hasMarketing('whatsapp')
  );
  drawCheckbox(
    'E-mail marketing',
    margin + 115,
    cursorY,
    hasMarketing('email')
  );
  cursorY += lineHeight + 4;

  // ===== CLÁUSULA EXATA DO MODELO =====
  doc.setFont('times', 'normal');
  doc.setFontSize(10);

  const clausula =
    'Solicito(amos) inscrição como SÓCIO(S) CONTRIBUINTE(S) DA ASSOCIAÇÃO COMERCIAL, ' +
    'INDUSTRIAL E AGRÍCOLA DE UMUARAMA – ACIU, CIENTE(S) de que, em caso de posterior desligamento da ' +
    'entidade, as mensalidades e serviços em débito até o mês da desfiliação, serão, obrigatoriamente pagas, sob pena de ' +
    'execução, bem como SERÃO INCLUÍDOS NO SPC BRASIL OS DÉBITOS REF. AOS SERVIÇOS. Declaro ter ' +
    'ciência do dever permanecer filiado à ACIU, pelo prazo mínimo de 6 (seis) meses, sob pena de inclusão no banco de ' +
    'dados do SPC.';

  const clausulaLines = doc.splitTextToSize(clausula, pageWidth - margin * 2);
  clausulaLines.forEach((line) => {
    doc.text(line, margin, cursorY);
    cursorY += 4;
  });

  cursorY += 8;

  // ===== LOCAL E DATA =====
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text('Umuarama-PR_____/_______________/________', centerX, cursorY, {
    align: 'center',
  });
  cursorY += lineHeight + 10;

  // ===== ASSINATURA DA FIRMA PROPONENTE (COM OPÇÃO DE ASSINATURA DESENHADA) =====
  const signatureData = await resolveSignatureData(company);
  const sigBlockHeight = signatureData ? 30 : 0;

  if (signatureData) {
    const imgWidth = 60;
    const imgHeight = 25;
    const imgX = centerX - imgWidth / 2;
    doc.addImage(
      signatureData,
      getImageFormat(signatureData),
      imgX,
      cursorY - 5,
      imgWidth,
      imgHeight
    );
  }

  // Linha de assinatura
  doc.setFont('times', 'normal');
  doc.text('__________________________________', centerX, cursorY + sigBlockHeight / 2, {
    align: 'center',
  });
  cursorY += sigBlockHeight / 2 + 4;

  doc.text(
    'Carimbo e Assinatura da Firma Proponente',
    centerX,
    cursorY,
    { align: 'center' }
  );
  cursorY += lineHeight + 4;

  // ===== RODAPÉ – APROVAÇÃO DIRETORIA =====
  doc.setFont('times', 'bold');
  doc.text('APROVADO PELA DIRETORIA', margin, cursorY);
  cursorY += lineHeight;

  doc.setFont('times', 'normal');
  doc.text('Em, ____/________/_____', margin, cursorY);
  cursorY += lineHeight + 4;

  doc.text('Presidente: _____________________', margin, cursorY);
  doc.text('Secretário: _____________________', margin + 90, cursorY);

  // ===== NOME DO ARQUIVO =====
  const safeName = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

  const filename = [
    'proposta-associado',
    currentYear,
    company.id,
    safeName(company.fantasy_name),
  ]
    .filter(Boolean)
    .join('-')
    .concat('.pdf');

  doc.save(filename);
}



async function handleExportCompanyPdf(id, button) {
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Gerando...';
    }
    const company = await fetchCompanyDetails(id);
    await generateCompanyPdf(company);
  } catch (error) {
    showError(error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Exportar PDF';
    }
  }
}

function bindTableActions() {
  companiesTable.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.action;
    if (action === 'edit') {
      startEditingCompany(id);
    } else if (action === 'delete') {
      handleDeleteCompany(id);
    } else if (action === 'pdf') {
      handleExportCompanyPdf(id, button);
    }
  });
}

async function init() {
  const context = await initializePage('empresas');
  if (!context) return;
  profile = context.profile;
  canManageCompanies = ['editor', 'admin'].includes(profile.role);
  await loadCompanies();
  bindSignaturePad();
  bindTableActions();
  showView('lista');

  const canCreate = canManageCompanies;
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
      if (button.dataset.view === 'lista' && editingCompanyId) {
        resetFormState();
      }
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

  exportPdfBtn?.addEventListener('click', exportTableToPdf);
  exportCsvBtn?.addEventListener('click', exportTableToCsv);
  if (canCreate) {
    cnpjLookupBtn?.addEventListener('click', lookupCnpj);
  }

  companyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canCreate) return;
    if (!editingCompanyId && !signatureHasContent) {
      showError('Desenhe a assinatura manual antes de salvar a empresa.');
      return;
    }
    if (signatureHasContent) {
      updateSignatureData();
    }
    const formData = new FormData(companyForm);
    const payload = preparePayload(formData);
    try {
      let response;
      const isEditing = Boolean(editingCompanyId);
      if (isEditing) {
        response = await authFetch(`/empresas/${editingCompanyId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        response = await authFetch('/empresas', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      const companyData = response.data;
      showSuccess(isEditing ? 'Empresa atualizada com sucesso.' : 'Empresa cadastrada com sucesso.');
      await loadCompanies(activeFilters);
      showView('lista');
      if (isEditing) {
        resetFormState();
      } else {
        companyForm.reset();
        clearSignaturePad();
        resetSignatureData();
        if (companyData) {
          await generateCompanyPdf(companyData);
        }
      }
    } catch (error) {
      showError(error.message);
    }
  });
}

init();
