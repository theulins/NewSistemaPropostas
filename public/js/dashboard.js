import { initializePage, authFetch } from './common.js';

const kpiGrid = document.getElementById('kpi-grid');
const recentList = document.getElementById('recent-list');
const monthInput = document.getElementById('month-input');
const monthApply = document.getElementById('month-apply');
const commissionCard = document.getElementById('commission-card');
let latestCommissionData = null;
const MANUAL_RATE_KEY = 'dashboard_manual_rate';
let manualRate = Number(localStorage.getItem(MANUAL_RATE_KEY) || '0.10');
if (Number.isNaN(manualRate) || manualRate <= 0) {
  manualRate = 0.1;
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

async function loadSummary() {
  const data = await authFetch('/dashboard/summary');
  kpiGrid.innerHTML = `
    <div class="kpi" role="status"><span>Usuários</span><strong>${data.totalUsers}</strong></div>
    <div class="kpi" role="status"><span>Empresas</span><strong>${data.totalCompanies}</strong></div>
  `;

  recentList.innerHTML = data.recent
    .map(
      (item) => `
        <tr>
          <td>${item.fantasy_name || '—'}</td>
          <td>${item.updated_by_name || 'Sistema'}</td>
          <td>${formatDate(item.updated_at)}</td>
        </tr>
      `
    )
    .join('');
}

function renderCommission(data, month) {
  latestCommissionData = data;
  const baseValue = data.totalValue ?? 0;
  const header = month ? new Date(`${month}-01T00:00:00`) : new Date();
  const title = header.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const hasDefaultRate = data.defaultRate !== undefined;
  const hasApprovedData = Number(data.approvedCompanies || 0) > 0 && Number(data.approvedCommission || 0) > 0;
  const rate = hasDefaultRate ? data.defaultRate : manualRate;
  const estimatedCommission = Number((baseValue * rate).toFixed(2));
  const commissionValue = hasApprovedData ? Number(data.approvedCommission || 0) : estimatedCommission;

  const manualControls = `<label class="manual-rate" style="display:grid;gap:6px;margin-top:8px;">
         <span>Taxa personalizada (%)</span>
         <input type="number" id="manual-rate-input" min="0" step="0.01" value="${(rate * 100).toFixed(2)}">
       </label>`;

  let rateInfo = '';
  if (hasApprovedData) {
    rateInfo = data.approvedRate
      ? `<span>Taxa média aplicada: ${(Number(data.approvedRate) * 100).toFixed(2)}%</span>`
      : '<span>Taxas informadas no ato da aprovação.</span>';
  } else if (hasDefaultRate) {
    rateInfo = `<span>Taxa aplicada: ${(rate * 100).toFixed(2)}%</span>`;
  } else {
    rateInfo = manualControls;
  }

  const commissionLabel = hasApprovedData
    ? `Comissões aprovadas (${data.approvedCompanies || 0})`
    : 'Comissão estimada';

  commissionCard.innerHTML = `
    <div class="kpi" aria-live="polite">
      <span>Base ${title}</span>
      <strong>${formatCurrency(baseValue)}</strong>
      ${rateInfo}
      <span>${commissionLabel}: <strong>${formatCurrency(commissionValue)}</strong></span>
    </div>
  `;

  if (!hasDefaultRate && !hasApprovedData) {
    const manualInput = document.getElementById('manual-rate-input');
    manualInput?.addEventListener('input', () => {
      const value = Number(manualInput.value || 0);
      manualRate = value / 100;
      if (Number.isFinite(manualRate) && manualRate >= 0) {
        localStorage.setItem(MANUAL_RATE_KEY, manualRate.toString());
        renderCommission(latestCommissionData, month);
      }
    });
  }
}

async function loadCommissions() {
  const month = monthInput.value;
  const query = month ? `?month=${month}` : '';
  const data = await authFetch(`/dashboard/commissions${query}`);
  renderCommission(data, month);
}

function setDefaultMonth() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthInput.value = month;
}

async function init() {
  if (!(await initializePage('dashboard'))) {
    return;
  }
  setDefaultMonth();
  await loadSummary();
  await loadCommissions();

  monthApply.addEventListener('click', loadCommissions);
  monthInput.addEventListener('change', () => {
    if (!monthInput.value) {
      setDefaultMonth();
    }
  });
}

init();
