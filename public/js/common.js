const API_BASE = '/api';
const TOKEN_KEY = 'sistema_propostas_token';
const USER_KEY = 'sistema_propostas_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token, user) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSession();
    window.location.href = 'login.html';
    return Promise.reject(new Error('Sessão expirada.'));
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Erro inesperado.');
  }

  return response.json();
}

export async function ensureAuthenticated() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  try {
    const profile = await authFetch('/profile', { method: 'GET' });
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    applyTheme(profile.theme_preference);
    updateTopbar(profile);
    return profile;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

export function applyTheme(preference = 'system', primary, cardRadius) {
  const html = document.documentElement;
  if (preference === 'light') {
    html.classList.add('light');
  } else if (preference === 'dark') {
    html.classList.remove('light');
  } else {
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    html.classList.toggle('light', systemPrefersLight);
  }
  if (primary) {
    html.style.setProperty('--primary', primary);
  }
  if (cardRadius !== undefined && cardRadius !== null && cardRadius !== '') {
    html.style.setProperty('--card-radius', `${cardRadius}px`);
  }
}

export function bindNavigation(activePage) {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    if (tab.dataset.page === activePage) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

export function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      window.location.href = 'login.html';
    });
  }
}

const supportsDialog = typeof HTMLDialogElement !== 'undefined';
let modalDialog;

function ensureModalDialog() {
  if (!supportsDialog) {
    return null;
  }
  if (!modalDialog) {
    modalDialog = document.createElement('dialog');
    modalDialog.className = 'app-dialog';
    document.body.appendChild(modalDialog);
  }
  return modalDialog;
}

function fallbackModal({ mode, title, text, inputValidator, defaultValue = '' }) {
  if (mode === 'confirm') {
    return { confirmed: window.confirm(text || title || '') };
  }
  if (mode === 'prompt') {
    const value = window.prompt(text || title || '', defaultValue);
    if (value === null) {
      return { confirmed: false, value: null };
    }
    if (inputValidator) {
      const message = inputValidator(value);
      if (message) {
        window.alert(message);
        return { confirmed: false, value: null };
      }
    }
    return { confirmed: true, value };
  }
  if (title || text) {
    window.alert(`${title ? `${title}\n` : ''}${text || ''}`);
  }
  return { confirmed: true };
}

function iconSymbol(icon) {
  switch (icon) {
    case 'error':
      return '!';
    case 'success':
      return '✓';
    case 'warning':
      return '!';
    case 'question':
      return '?';
    default:
      return 'i';
  }
}

function openModal({
  title,
  text,
  icon = 'info',
  confirmButtonText = 'Entendi',
  cancelButtonText = 'Cancelar',
  showCancel = false,
  mode = 'alert',
  inputLabel,
  inputPlaceholder,
  inputValidator,
  defaultValue = '',
} = {}) {
  if (!supportsDialog) {
    return Promise.resolve(
      fallbackModal({ mode, title, text, inputValidator, defaultValue })
    );
  }

  const dialog = ensureModalDialog();
  if (!dialog) {
    return Promise.resolve({ confirmed: true });
  }
  if (dialog.open) {
    dialog.close();
  }

  return new Promise((resolve) => {
    dialog.innerHTML = '';
    const form = document.createElement('form');
    form.className = 'app-dialog__panel';
    form.method = 'dialog';

    const iconBox = document.createElement('div');
    iconBox.className = `app-dialog__icon app-dialog__icon--${icon}`;
    iconBox.textContent = iconSymbol(icon);
    form.appendChild(iconBox);

    const content = document.createElement('div');
    content.className = 'app-dialog__content';
    if (title) {
      const heading = document.createElement('h3');
      heading.textContent = title;
      content.appendChild(heading);
    }
    if (text) {
      const paragraph = document.createElement('p');
      paragraph.className = 'app-dialog__text';
      paragraph.textContent = text;
      content.appendChild(paragraph);
    }
    form.appendChild(content);

    let input;
    let feedback;
    if (mode === 'prompt') {
      const label = document.createElement('label');
      label.className = 'app-dialog__input';
      if (inputLabel) {
        const span = document.createElement('span');
        span.textContent = inputLabel;
        label.appendChild(span);
      }
      input = document.createElement('input');
      input.type = 'text';
      input.value = defaultValue || '';
      if (inputPlaceholder) {
        input.placeholder = inputPlaceholder;
      }
      label.appendChild(input);
      form.appendChild(label);
      feedback = document.createElement('p');
      feedback.className = 'app-dialog__feedback';
      feedback.hidden = true;
      form.appendChild(feedback);
      input.addEventListener('input', () => {
        feedback.hidden = true;
      });
    }

    const actions = document.createElement('div');
    actions.className = 'app-dialog__actions';
    let cancelBtn;
    if (showCancel) {
      cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'ghost';
      cancelBtn.dataset.action = 'cancel';
      cancelBtn.textContent = cancelButtonText;
      actions.appendChild(cancelBtn);
    }
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'submit';
    confirmBtn.className = 'primary';
    confirmBtn.dataset.action = 'confirm';
    confirmBtn.textContent = confirmButtonText;
    actions.appendChild(confirmBtn);
    form.appendChild(actions);

    dialog.appendChild(form);

    const teardown = [];
    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      teardown.forEach((fn) => fn());
      if (dialog.open) {
        dialog.close();
      }
      dialog.innerHTML = '';
      resolve(result);
    };

    const handleConfirm = () => {
      if (mode === 'prompt' && input) {
        const value = input.value.trim();
        if (inputValidator) {
          const message = inputValidator(value);
          if (message) {
            if (feedback) {
              feedback.textContent = message;
              feedback.hidden = false;
            }
            input.focus();
            return;
          }
        }
        finish({ confirmed: true, value });
        return;
      }
      finish({ confirmed: true });
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      handleConfirm();
    });
    cancelBtn?.addEventListener('click', () => finish({ confirmed: false }));
    const handleCancelEvent = (event) => {
      event.preventDefault();
      finish({ confirmed: false });
    };
    dialog.addEventListener('cancel', handleCancelEvent, { once: true });
    const handleBackdropClick = (event) => {
      if (event.target === dialog) {
        finish({ confirmed: false });
      }
    };
    dialog.addEventListener('click', handleBackdropClick);
    teardown.push(() => dialog.removeEventListener('click', handleBackdropClick));

    dialog.showModal();
    if (input) {
      input.focus();
      input.select();
    } else {
      confirmBtn.focus();
    }
  });
}

export function showError(message, title = 'Algo deu errado') {
  return openModal({
    title,
    text: message,
    icon: 'error',
    confirmButtonText: 'Entendi',
  }).then(() => undefined);
}

export function showSuccess(message, title = 'Tudo certo!') {
  return openModal({
    title,
    text: message,
    icon: 'success',
    confirmButtonText: 'Fechar',
  }).then(() => undefined);
}

export async function confirmAction({
  title,
  text,
  icon = 'warning',
  confirmButtonText = 'Confirmar',
  cancelButtonText = 'Cancelar',
} = {}) {
  const result = await openModal({
    title,
    text,
    icon,
    mode: 'confirm',
    showCancel: true,
    confirmButtonText,
    cancelButtonText,
  });
  return Boolean(result?.confirmed);
}

export async function promptText({
  title,
  text,
  inputLabel,
  inputPlaceholder,
  confirmButtonText = 'Confirmar',
  cancelButtonText = 'Cancelar',
  icon = 'question',
  inputValidator,
  defaultValue = '',
} = {}) {
  const result = await openModal({
    title,
    text,
    icon,
    mode: 'prompt',
    showCancel: true,
    confirmButtonText,
    cancelButtonText,
    inputLabel,
    inputPlaceholder,
    inputValidator,
    defaultValue,
  });
  if (!result?.confirmed) {
    return null;
  }
  return result.value ?? '';
}

export async function initializePage(activePage) {
  const profile = await ensureAuthenticated();
  if (!profile) return null;
  let settings = null;
  try {
    settings = await authFetch('/settings', { method: 'GET' });
    if (settings?.primary || settings?.card_radius) {
      applyTheme(profile.theme_preference ?? settings.theme_preference, settings.primary, settings.card_radius);
    } else {
      applyTheme(profile.theme_preference ?? settings.theme_preference);
    }
  } catch (error) {
    console.warn('Não foi possível carregar configurações globais', error);
  }
  bindNavigation(activePage);
  setupLogout();
  return { profile, settings };
}

export function updateTopbar(user) {
  const nameSlot = document.getElementById('user-name');
  if (nameSlot && user) {
    nameSlot.textContent = user.name;
  }
}
