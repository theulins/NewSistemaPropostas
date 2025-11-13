import {
  initializePage,
  authFetch,
  applyTheme,
  showSuccess,
  showError,
  confirmAction,
} from './common.js';

const designForm = document.getElementById('design-form');
const resetButton = document.getElementById('reset-design');
const previewBox = document.querySelector('.preview');
const usersPanel = document.getElementById('users-panel');
const userForm = document.getElementById('user-form');
const usersTable = document.getElementById('users-table');
const cancelEditBtn = document.getElementById('cancel-edit');
const passwordWrapper = document.getElementById('password-wrapper');

let editingId = null;
let profile;

function updatePreview(color) {
  previewBox.style.background = color;
  document.documentElement.style.setProperty('--primary', color);
}

function fillDesignForm(settings) {
  if (!settings) return;
  designForm.theme_preference.value = settings.theme_preference || 'system';
  designForm.primary.value = settings.primary || '#4f86ff';
  updatePreview(designForm.primary.value);
}

function resetUserForm() {
  userForm.reset();
  editingId = null;
  passwordWrapper.hidden = false;
  passwordWrapper.querySelector('input').required = true;
  cancelEditBtn.hidden = true;
  userForm.querySelector('button[type="submit"]').textContent = 'Salvar usuário';
}

function renderUsers(items) {
  usersTable.innerHTML = items
    .map(
      (user) => `
        <tr data-id="${user.id}">
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>${user.role}</td>
          <td>${user.theme_preference}</td>
          <td>${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(user.created_at))}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="ghost edit-btn">Editar</button>
              <button type="button" class="ghost delete-btn">Excluir</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');

  usersTable.querySelectorAll('.edit-btn').forEach((button) => {
    button.addEventListener('click', () => startEdit(button.closest('tr')));
  });
  usersTable.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', () => deleteUser(button.closest('tr')));
  });
}

async function loadUsers() {
  const data = await authFetch('/users');
  renderUsers(data.items);
}

function startEdit(row) {
  editingId = Number(row.dataset.id);
  userForm.name.value = row.children[0].textContent;
  userForm.email.value = row.children[1].textContent;
  userForm.role.value = row.children[2].textContent;
  userForm.theme_preference.value = row.children[3].textContent;
  passwordWrapper.hidden = true;
  passwordWrapper.querySelector('input').required = false;
  cancelEditBtn.hidden = false;
  userForm.querySelector('button[type="submit"]').textContent = 'Atualizar usuário';
}

async function deleteUser(row) {
  const id = Number(row.dataset.id);
  const confirmed = await confirmAction({
    title: 'Deseja excluir este usuário?',
    text: 'Esta ação não poderá ser desfeita.',
    icon: 'warning',
    confirmButtonText: 'Excluir',
  });
  if (!confirmed) return;
  try {
    await authFetch(`/users/${id}`, { method: 'DELETE' });
    row.remove();
    showSuccess('Usuário removido com sucesso.');
  } catch (error) {
    showError(error.message);
  }
}

async function init() {
  const context = await initializePage('configuracoes');
  if (!context) return;
  profile = context.profile;
  fillDesignForm(context.settings);

  designForm.addEventListener('change', () => {
    applyTheme(designForm.theme_preference.value, designForm.primary.value);
    updatePreview(designForm.primary.value);
  });

  designForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      theme_preference: designForm.theme_preference.value,
      primary: designForm.primary.value,
    };
    try {
      await authFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showSuccess('Preferências salvas.');
    } catch (error) {
      showError(error.message);
    }
  });

  resetButton.addEventListener('click', async () => {
    designForm.theme_preference.value = 'system';
    designForm.primary.value = '#4f86ff';
    updatePreview('#4f86ff');
    applyTheme('system', '#4f86ff');
    try {
      await authFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify({ theme_preference: 'system', primary: '#4f86ff' }),
      });
      showSuccess('Tema restaurado para o padrão.');
    } catch (error) {
      showError(error.message);
    }
  });

  if (profile.role === 'admin') {
    usersPanel.hidden = false;
    resetUserForm();
    await loadUsers();

    userForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(userForm);
      const payload = Object.fromEntries(formData.entries());

      if (editingId) {
        delete payload.password;
        try {
          await authFetch(`/users/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          await loadUsers();
          resetUserForm();
          showSuccess('Usuário atualizado com sucesso.');
        } catch (error) {
          showError(error.message);
        }
      } else {
        if (!payload.password) {
          await showError('Informe uma senha para o novo usuário.', 'Dados incompletos');
          return;
        }
        try {
          await authFetch('/users', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          await loadUsers();
          resetUserForm();
          showSuccess('Usuário cadastrado com sucesso.');
        } catch (error) {
          showError(error.message);
        }
      }
    });

    cancelEditBtn.addEventListener('click', resetUserForm);
  }
}

init();
