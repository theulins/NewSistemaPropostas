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

let ctx;
let drawing = false;
let profile;

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatStatus(status) {
  if (!status) return '—';
  return status[0].toUpperCase() + status.slice(1);
}

async function loadCompanies(params = {}) {
  const query = new URLSearchParams(params);
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
    const params = Object.fromEntries(formData.entries());
    await loadCompanies(params);
    showView('lista');
  });

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
