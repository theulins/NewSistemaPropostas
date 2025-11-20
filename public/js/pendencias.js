import { initializePage, authFetch, showError, showSuccess, promptText } from './common.js';

const tableBody = document.getElementById('pending-table');
const filterForm = document.getElementById('pending-filter');
let ownerOptions = [];
let currentProfile = null;

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function renderOwnerCell(selectedId) {
  if (!ownerOptions.length) {
    return '<span class="badge">Padrão</span>';
  }
  const options = ownerOptions
    .map(
      (user) => `<option value="${user.id}" ${selectedId && Number(selectedId) === user.id ? 'selected' : ''}>${user.name}</option>`
    )
    .join('');
  return `<select class="owner-select">${options}</select>`;
}

function renderRow(item) {
  const ratePercent = item.commission_rate != null ? Number(item.commission_rate) * 100 : 0;
  const commissionValue = item.value && item.commission_rate ? item.value * item.commission_rate : 0;
  return `
    <tr data-id="${item.id}" data-plan="${item.plan_type || ''}">
      <td>${item.fantasy_name}</td>
      <td>${item.cnpj || '—'}</td>
      <td>${item.city || '—'} / ${item.state || '—'}</td>
      <td>${item.plan_type || '—'}</td>
      <td><input type="number" class="value-input" min="0" step="0.01" value="${item.value ?? ''}" aria-label="Valor"></td>
      <td><input type="number" class="rate-input" min="0" max="100" step="0.01" value="${ratePercent || ''}" aria-label="Taxa"></td>
      <td class="commission-cell">${formatCurrency(commissionValue)}</td>
      <td><input type="date" class="due-input" value="${item.due_date ? item.due_date.split('T')[0] : ''}" aria-label="Vencimento"></td>
      <td>${renderOwnerCell(item.updated_by)}</td>
      <td>
        <div class="action-buttons">
          <button type="button" class="primary approve-btn">Aprovar</button>
          <button type="button" class="ghost reject-btn">Reprovar</button>
        </div>
      </td>
    </tr>
  `;
}

function updateCommissionRow(row) {
  const value = Number(row.querySelector('.value-input').value || 0);
  const ratePercent = Number(row.querySelector('.rate-input').value || 0);
  const commissionValue = value * (ratePercent / 100);
  row.querySelector('.commission-cell').textContent = formatCurrency(commissionValue);
}

async function loadPending(params) {
  const query = new URLSearchParams(params);
  const endpoint = query.toString() ? `/empresas/pending/search?${query}` : '/empresas/pending';
  const data = await authFetch(endpoint);
  tableBody.innerHTML = data.items.map(renderRow).join('');
  tableBody.querySelectorAll('tr').forEach((row) => {
    row.querySelectorAll('.value-input, .rate-input').forEach((input) => {
      input.addEventListener('input', () => updateCommissionRow(row));
    });
    row.querySelector('.approve-btn').addEventListener('click', () => approveRow(row));
    row.querySelector('.reject-btn').addEventListener('click', () => rejectRow(row));
  });
}

async function approveRow(row) {
  const companyId = row.dataset.id;
  const value = Number(row.querySelector('.value-input').value || 0);
  const ratePercent = Number(row.querySelector('.rate-input').value || 0);
  const dueDate = row.querySelector('.due-input').value || null;
  const ownerSelect = row.querySelector('.owner-select');
  const ownerId = ownerSelect ? Number(ownerSelect.value) : null;

  try {
    await authFetch('/empresas/pending/approve', {
      method: 'POST',
      body: JSON.stringify({
        company_id: Number(companyId),
        plan_type: row.dataset.plan || null,
        value,
        commission_rate: ratePercent / 100,
        due_date: dueDate,
        commission_owner_id: ownerId || currentProfile?.id,
      }),
    });
    row.remove();
    showSuccess('Pendência aprovada com sucesso.');
  } catch (error) {
    showError(error.message);
  }
}

async function rejectRow(row) {
  const companyId = row.dataset.id;
  const reason = await promptText({
    title: 'Motivo da reprovação',
    text: 'Descreva o motivo para reprovar a pendência.',
    inputLabel: 'Motivo',
    inputPlaceholder: 'Informe o motivo',
    confirmButtonText: 'Enviar',
    inputValidator: (value) => {
      if (!value || !value.trim()) {
        return 'Informe um motivo para reprovar.';
      }
      return undefined;
    },
  });
  if (!reason) return;
  try {
    await authFetch('/empresas/pending/reject', {
      method: 'POST',
      body: JSON.stringify({ company_id: Number(companyId), reason }),
    });
    row.remove();
    showSuccess('Pendência reprovada.');
  } catch (error) {
    showError(error.message);
  }
}

async function init() {
  const context = await initializePage('pendencias');
  if (!context) {
    return;
  }
  currentProfile = context.profile;
  if (currentProfile?.role === 'admin') {
    try {
      const users = await authFetch('/users');
      ownerOptions = users.items.filter((user) => user.role !== 'viewer');
    } catch (error) {
      console.warn('Não foi possível carregar responsáveis', error);
    }
  }
  await loadPending({ status: 'pendente' });

  filterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(filterForm);
    const params = Object.fromEntries(formData.entries());
    await loadPending(params);
  });
}

init();
