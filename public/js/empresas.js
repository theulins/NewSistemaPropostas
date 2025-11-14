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
  if (!company || !window.jspdf?.jsPDF) {
    showError('Não foi possível gerar o PDF.');
    return;
  }
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 16;
  let cursorY = margin + 10;
  doc.setFontSize(16);
  doc.text('Documento de cadastro de empresa', margin, margin);
  doc.setFontSize(11);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, margin, margin + 6);

  const section = (title) => {
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, cursorY);
    cursorY += 6;
    doc.setFont('helvetica', 'normal');
  };

  const addLines = (pairs) => {
    pairs.forEach(([label, value]) => {
      const text = `${label}: ${value || '—'}`;
      const lines = doc.splitTextToSize(text, 180);
      lines.forEach((line) => {
        doc.text(line, margin, cursorY);
        cursorY += 5;
      });
      cursorY += 1;
    });
    cursorY += 2;
  };

  section('Identificação');
  addLines([
    ['ID', company.id],
    ['Nome fantasia', company.fantasy_name],
    ['Razão social', company.corporate_name],
    ['CNPJ', company.cnpj],
    ['Setor', company.sector],
    ['Status', formatStatus(company.status)],
  ]);

  section('Contatos');
  addLines([
    ['E-mail', company.email],
    ['Telefone', company.phone],
    ['Celular', company.cel],
    ['WhatsApp', company.whatsapp],
    ['Instagram', company.instagram],
  ]);

  section('Endereço');
  addLines([
    ['Endereço', company.address],
    ['Cidade', company.city],
    ['Estado', company.state],
    ['CEP', company.zip],
  ]);

  section('Financeiro');
  addLines([
    ['Plano', company.plan_type],
    ['Valor', formatCurrency(company.value)],
    ['Taxa de comissão', formatPercent(company.commission_rate)],
    ['Vencimento', formatDateOnly(company.due_date)],
  ]);

  section('Serviços e comunicação');
  addLines([
    ['Serviços contratados', describeOptions(company.services_contracted, SERVICE_LABELS)],
    ['Canais autorizados', describeOptions(company.marketing_authorizations, MARKETING_LABELS)],
  ]);

  section('Observações');
  addLines([
    ['Observações', company.note],
    ['Motivo de reprovação', company.rejection_reason],
  ]);

  const signatureData = await resolveSignatureData(company);
  if (signatureData) {
    doc.setFont('helvetica', 'bold');
    doc.text('Assinatura', margin, cursorY);
    cursorY += 4;
    doc.setFont('helvetica', 'normal');
    doc.addImage(signatureData, getImageFormat(signatureData), margin, cursorY, 70, 30);
    cursorY += 36;
  }

  doc.text(`Responsável: ${profile?.name || '—'}`, margin, cursorY + 4);
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank', 'noopener');
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
