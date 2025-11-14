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

function getExportContext() {
  const rows = getTableRows();
  if (!rows.length) {
    showError('Não há dados para exportar. Faça uma busca antes.');
    return null;
  }
  return { rows, filterSummary: buildFilterSummary() };
}

async function exportTableToPdf() {
  const context = getExportContext();
  if (!context) return;
  const { rows, filterSummary } = context;
  const originalText = exportPdfBtn?.textContent;
  if (exportPdfBtn) {
    exportPdfBtn.disabled = true;
    exportPdfBtn.textContent = 'Gerando...';
  }
  try {
    const doc = new SimplePdfDocument();
    doc.addTitle('Empresas cadastradas');
    doc.addParagraph(`Emitido em ${new Date().toLocaleString('pt-BR')}`);
    if (filterSummary) {
      doc.addParagraph(`Filtros: ${filterSummary}`);
    }
    doc.addSpacer();
    rows.forEach((row, index) => {
      const values = extractRowValues(row);
      doc.addParagraph(`${index + 1}. ${pdfValue(values[1])} (ID ${pdfValue(values[0])})`);
      doc.addParagraph(`CNPJ: ${pdfValue(values[2])} - ${pdfValue(values[3])}/${pdfValue(values[4])}`);
      doc.addParagraph(
        `Setor: ${pdfValue(values[5])} - Status: ${pdfValue(values[6])} - Atualizado: ${pdfValue(values[7])}`
      );
      doc.addSpacer();
    });
    await doc.save(`empresas-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error(error);
    showError('Não foi possível gerar o PDF.');
  } finally {
    if (exportPdfBtn) {
      exportPdfBtn.disabled = false;
      exportPdfBtn.textContent = originalText || 'Exportar PDF';
    }
  }
}

function exportTableToCsv() {
  const context = getExportContext();
  if (!context) return;
  const { rows, filterSummary } = context;
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
  if (cnpjLookupBtn) {
    cnpjLookupBtn.disabled = true;
    cnpjLookupBtn.textContent = 'Buscando...';
  }
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
    if (cnpjLookupBtn) {
      cnpjLookupBtn.disabled = false;
      cnpjLookupBtn.textContent = 'Buscar dados pelo CNPJ';
    }
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

const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN = 40;
const PDF_LINE_HEIGHT = 14;
const PDF_MAX_LINE_LENGTH = 96;
const PX_TO_PT = 72 / 96;
const encoder = new TextEncoder();

function concatUint8Arrays(arrays) {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  arrays.forEach((array) => {
    result.set(array, offset);
    offset += array.length;
  });
  return result;
}

function encodePdfText(value) {
  return encoder.encode(value);
}

function sanitizePdfText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\]/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '');
}

function wrapPdfLines(text) {
  const sanitized = sanitizePdfText(text);
  if (!sanitized) {
    return [''];
  }
  const words = sanitized.split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    if (!word) return;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > PDF_MAX_LINE_LENGTH) {
      if (current) {
        lines.push(current);
        current = '';
      }
      if (word.length > PDF_MAX_LINE_LENGTH) {
        for (let i = 0; i < word.length; i += PDF_MAX_LINE_LENGTH) {
          lines.push(word.slice(i, i + PDF_MAX_LINE_LENGTH));
        }
      } else {
        current = word;
      }
    } else {
      current = candidate;
    }
  });
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [''];
}

function pdfValue(value) {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (!raw || raw === '—') {
    return 'Sem informacao';
  }
  return raw.replace(/\u00a0/g, ' ');
}

function buildContentStream(entries, signature) {
  const commands = [];
  let textOpen = false;
  let currentFont = null;
  let currentSize = null;
  let currentY = PDF_PAGE_HEIGHT - PDF_MARGIN;

  const openText = () => {
    if (textOpen) return;
    commands.push('BT');
    commands.push(`${PDF_LINE_HEIGHT.toFixed(2)} TL`);
    commands.push(`${PDF_MARGIN.toFixed(2)} ${currentY.toFixed(2)} Td`);
    textOpen = true;
    currentFont = null;
    currentSize = null;
  };

  const closeText = () => {
    if (!textOpen) return;
    commands.push('ET');
    textOpen = false;
  };

  const setFont = (fontKey, size) => {
    openText();
    if (currentFont !== fontKey || currentSize !== size) {
      commands.push(`/${fontKey} ${size.toFixed(2)} Tf`);
      currentFont = fontKey;
      currentSize = size;
    }
  };

  const addSpacer = (lines = 1) => {
    if (lines <= 0) return;
    openText();
    for (let i = 0; i < lines; i += 1) {
      commands.push('T*');
      currentY -= PDF_LINE_HEIGHT;
    }
  };

  const addLine = (line, fontKey, size) => {
    setFont(fontKey, size);
    commands.push(`(${line}) Tj`);
    commands.push('T*');
    currentY -= PDF_LINE_HEIGHT;
  };

  entries.forEach((entry) => {
    if (entry.type === 'spacer') {
      addSpacer(entry.lines || 1);
      return;
    }
    if (entry.type === 'signature') {
      if (!signature) return;
      closeText();
      const drawY = Math.max(PDF_MARGIN, currentY - signature.heightPt - 10);
      commands.push('q');
      commands.push(
        `${signature.widthPt.toFixed(2)} 0 0 ${signature.heightPt.toFixed(2)} ${PDF_MARGIN.toFixed(2)} ${drawY.toFixed(2)} cm`
      );
      commands.push('/Im1 Do');
      commands.push('Q');
      currentY = drawY - PDF_LINE_HEIGHT;
      return;
    }
    const fontKey = entry.type === 'title' || entry.type === 'heading' ? 'F2' : 'F1';
    const fontSize = entry.type === 'title' ? 16 : entry.type === 'heading' ? 13 : 11;
    const lines = wrapPdfLines(entry.text || '');
    lines.forEach((line) => addLine(line, fontKey, fontSize));
    if (entry.spaceAfter) {
      addSpacer(entry.spaceAfter);
    }
  });
  closeText();
  return `${commands.join('\n')}\n`;
}

function finalizePdf(definitions, rootObj) {
  const header = encodePdfText('%PDF-1.4\n');
  const objects = [];
  const offsets = [0];
  let offset = header.length;
  definitions.forEach(({ num, builder }) => {
    const parts = builder();
    const objectBytes = concatUint8Arrays([
      encodePdfText(`${num} 0 obj\n`),
      ...parts,
      encodePdfText('\nendobj\n'),
    ]);
    offsets[num] = offset;
    offset += objectBytes.length;
    objects.push(objectBytes);
  });
  const xrefStart = offset;
  let xrefBody = '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    xrefBody += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  const xref = encodePdfText(`xref\n0 ${offsets.length}\n${xrefBody}`);
  const trailer = encodePdfText(
    `trailer\n<< /Size ${offsets.length} /Root ${rootObj} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  );
  return concatUint8Arrays([header, ...objects, xref, trailer]);
}

function buildPdfBytes(entries, signature) {
  const definitions = [];
  const addObject = (builder) => {
    const num = definitions.length + 1;
    definitions.push({ num, builder });
    return num;
  };

  const contentStream = buildContentStream(entries, signature);
  const fontRegular = addObject(() => [encodePdfText('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')]);
  const fontBold = addObject(() => [encodePdfText('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')]);

  let imageObject = null;
  if (signature) {
    imageObject = addObject(() => [
      encodePdfText(
        `<< /Type /XObject /Subtype /Image /Width ${signature.widthPx} /Height ${signature.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${signature.bytes.length} >>\nstream\n`
      ),
      signature.bytes,
      encodePdfText('\nendstream\n'),
    ]);
  }

  const streamBytes = encodePdfText(contentStream);
  const contentObject = addObject(() => [
    encodePdfText(`<< /Length ${streamBytes.length} >>\nstream\n`),
    streamBytes,
    encodePdfText('\nendstream\n'),
  ]);

  let pageObject;
  let pagesObject;
  pageObject = addObject(() => {
    const resources = [`/Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>`];
    if (imageObject) {
      resources.push(`/XObject << /Im1 ${imageObject} 0 R >>`);
    }
    return [
      encodePdfText(
        `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH.toFixed(2)} ${PDF_PAGE_HEIGHT.toFixed(
          2
        )}] /Contents ${contentObject} 0 R /Resources << ${resources.join(' ')} >> >>`
      ),
    ];
  });

  pagesObject = addObject(() => [
    encodePdfText(`<< /Type /Pages /Kids [${pageObject} 0 R] /Count 1 >>`),
  ]);

  const catalogObject = addObject(() => [
    encodePdfText(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`),
  ]);

  return finalizePdf(definitions, catalogObject);
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function prepareSignatureData(dataUrl) {
  const image = await loadImageFromDataUrl(dataUrl);
  const maxWidth = 420;
  const maxHeight = 220;
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const widthPx = Math.max(1, Math.round(image.width * scale));
  const heightPx = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas não suportado.');
  }
  context.fillStyle = '#fff';
  context.fillRect(0, 0, widthPx, heightPx);
  context.drawImage(image, 0, 0, widthPx, heightPx);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const bytes = dataUrlToUint8Array(jpegDataUrl);
  return {
    widthPx,
    heightPx,
    widthPt: widthPx * PX_TO_PT,
    heightPt: heightPx * PX_TO_PT,
    bytes,
  };
}

class SimplePdfDocument {
  constructor() {
    this.entries = [];
    this.signature = null;
  }

  addTitle(text) {
    if (!text) return;
    this.entries.push({ type: 'title', text: pdfValue(text), spaceAfter: 1 });
  }

  addSection(text) {
    if (!text) return;
    this.entries.push({ type: 'heading', text: pdfValue(text), spaceAfter: 1 });
  }

  addParagraph(text, spaceAfter = 0) {
    this.entries.push({ type: 'text', text: pdfValue(text), spaceAfter });
  }

  addKeyValue(label, value) {
    this.entries.push({ type: 'text', text: `${label}: ${pdfValue(value)}` });
  }

  addSpacer(lines = 1) {
    if (lines > 0) {
      this.entries.push({ type: 'spacer', lines });
    }
  }

  async attachSignature(dataUrl) {
    this.signature = await prepareSignatureData(dataUrl);
  }

  addSignaturePlaceholder() {
    if (this.signature) {
      this.entries.push({ type: 'signature' });
    }
  }

  async save(filename) {
    const bytes = buildPdfBytes(this.entries, this.signature);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 0);
  }
}

async function generateCompanyPdf(company) {
  if (!company) {
    showError('Não foi possível gerar o PDF.');
    return;
  }
  try {
    const doc = new SimplePdfDocument();
    doc.addTitle('Documento de cadastro de empresa');
    doc.addParagraph(`Gerado em ${new Date().toLocaleString('pt-BR')}`);
    doc.addSpacer();

    doc.addSection('Identificacao');
    doc.addKeyValue('ID', company.id);
    doc.addKeyValue('Nome fantasia', company.fantasy_name);
    doc.addKeyValue('Razao social', company.corporate_name);
    doc.addKeyValue('CNPJ', company.cnpj);
    doc.addKeyValue('Setor', company.sector);
    doc.addKeyValue('Status', formatStatus(company.status));
    doc.addSpacer();

    doc.addSection('Contatos');
    doc.addKeyValue('E-mail', company.email);
    doc.addKeyValue('Telefone', company.phone);
    doc.addKeyValue('Celular', company.cel);
    doc.addKeyValue('WhatsApp', company.whatsapp);
    doc.addKeyValue('Instagram', company.instagram);
    doc.addSpacer();

    doc.addSection('Endereco');
    doc.addKeyValue('Endereco', company.address);
    doc.addKeyValue('Cidade', company.city);
    doc.addKeyValue('Estado', company.state);
    doc.addKeyValue('CEP', company.zip);
    doc.addSpacer();

    doc.addSection('Financeiro');
    doc.addKeyValue('Plano', company.plan_type);
    doc.addKeyValue('Valor', formatCurrency(company.value));
    doc.addKeyValue('Taxa de comissao', formatPercent(company.commission_rate));
    doc.addKeyValue('Vencimento', formatDateOnly(company.due_date));
    doc.addSpacer();

    doc.addSection('Servicos e comunicacao');
    doc.addKeyValue('Servicos contratados', describeOptions(company.services_contracted, SERVICE_LABELS));
    doc.addKeyValue('Canais autorizados', describeOptions(company.marketing_authorizations, MARKETING_LABELS));
    doc.addSpacer();

    doc.addSection('Observacoes');
    doc.addKeyValue('Observacoes', company.note);
    doc.addKeyValue('Motivo de reprovacao', company.rejection_reason);
    doc.addSpacer();

    const signatureData = await resolveSignatureData(company);
    if (signatureData) {
      try {
        await doc.attachSignature(signatureData);
        doc.addSection('Assinatura digital');
        doc.addSpacer();
        doc.addSignaturePlaceholder();
        doc.addSpacer();
      } catch (error) {
        console.warn('Não foi possível processar a assinatura', error);
      }
    }

    doc.addParagraph(`Responsavel: ${profile?.name || 'Sem informacao'}`);

    const safeName = (value) =>
      String(value || '')
        .normalize('NFD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();

    const filename = ['empresa', company.id, safeName(company.fantasy_name)]
      .filter(Boolean)
      .join('-')
      .concat('.pdf');

    await doc.save(filename);
  } catch (error) {
    console.error(error);
    showError('Não foi possível gerar o PDF.');
  }
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
