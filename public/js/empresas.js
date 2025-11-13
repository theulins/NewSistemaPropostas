import { initializePage, authFetch, showSuccess, showError } from './common.js';

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
const cnpjLookupBtn = document.getElementById('cnpj-lookup-btn');
const cnpjLookupStatus = document.getElementById('cnpj-lookup-status');

let ctx;
let drawing = false;
let profile;
let activeFilters = {};

function digitsOnly(value = '') {
  return value.replace(/\D+/g, '');
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

async function loadCompanies(params = {}) {
  activeFilters = sanitizeFilters(params);
  const query = new URLSearchParams(activeFilters);
  const endpoint = query.toString() ? `/empresas/search?${query}` : '/empresas/list';
  const data = await authFetch(endpoint);
  companiesTable.innerHTML = data.items
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
}

function getCanvasContext() {
  if (!ctx) {
    ctx = signaturePad.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff';
  }
  return ctx;
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = signaturePad.getBoundingClientRect();
  signaturePad.width = rect.width * ratio;
  signaturePad.height = rect.height * ratio;
  const context = getCanvasContext();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(ratio, ratio);
  context.fillStyle = 'rgba(0,0,0,0)';
  context.fillRect(0, 0, rect.width, rect.height);
  signatureDataInput.value = '';
}

function startDrawing(event) {
  drawing = true;
  const context = getCanvasContext();
  context.beginPath();
  const { offsetX, offsetY } = getOffset(event);
  context.moveTo(offsetX, offsetY);
}

function draw(event) {
  if (!drawing) return;
  event.preventDefault();
  const context = getCanvasContext();
  const { offsetX, offsetY } = getOffset(event);
  context.lineTo(offsetX, offsetY);
  context.stroke();
  updateSignatureData();
}

function stopDrawing() {
  drawing = false;
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
  signatureDataInput.value = signaturePad.toDataURL('image/png');
}

function clearSignaturePad() {
  const context = getCanvasContext();
  context.clearRect(0, 0, signaturePad.width, signaturePad.height);
  signatureDataInput.value = '';
}

function bindSignaturePad() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  signaturePad.addEventListener('mousedown', startDrawing);
  signaturePad.addEventListener('mousemove', draw);
  signaturePad.addEventListener('mouseup', stopDrawing);
  signaturePad.addEventListener('mouseleave', stopDrawing);
  signaturePad.addEventListener('touchstart', (event) => {
    startDrawing(event);
  }, { passive: false });
  signaturePad.addEventListener('touchmove', (event) => {
    draw(event);
  }, { passive: false });
  signaturePad.addEventListener('touchend', stopDrawing);
  clearSignature.addEventListener('click', clearSignaturePad);
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
  const rows = Array.from(companiesTable.querySelectorAll('tr'));
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
      await authFetch('/empresas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showSuccess('Empresa cadastrada com sucesso.');
      companyForm.reset();
      clearSignaturePad();
      await loadCompanies();
      showView('lista');
    } catch (error) {
      showError(error.message);
    }
  });
}

init();
