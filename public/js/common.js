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

export function applyTheme(preference = 'system', primary) {
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

function ensureSwal() {
  if (!window.Swal) {
    console.error('SweetAlert2 não foi carregado.');
    return false;
  }
  return true;
}

export function showError(message, title = 'Algo deu errado') {
  if (!ensureSwal()) {
    console.error(message);
    return Promise.resolve();
  }
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonText: 'Entendi',
  });
}

export function showSuccess(message, title = 'Tudo certo!') {
  if (!ensureSwal()) {
    console.info(message);
    return Promise.resolve();
  }
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonText: 'Fechar',
  });
}

export async function confirmAction({
  title,
  text,
  icon = 'warning',
  confirmButtonText = 'Confirmar',
  cancelButtonText = 'Cancelar',
} = {}) {
  if (!ensureSwal()) {
    return window.confirm(text || title || '');
  }
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    focusCancel: true,
    confirmButtonText,
    cancelButtonText,
  });
  return result.isConfirmed;
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
} = {}) {
  if (!ensureSwal()) {
    const value = window.prompt(text || title || '');
    if (!value) {
      return null;
    }
    if (inputValidator) {
      const validationMessage = inputValidator(value);
      if (validationMessage) {
        console.warn(validationMessage);
        return null;
      }
    }
    return value;
  }

  const result = await Swal.fire({
    title,
    text,
    input: 'text',
    inputLabel,
    inputPlaceholder,
    icon,
    showCancelButton: true,
    focusCancel: true,
    confirmButtonText,
    cancelButtonText,
    inputValidator,
  });
  if (!result.isConfirmed) {
    return null;
  }
  return result.value;
}

export async function initializePage(activePage) {
  const profile = await ensureAuthenticated();
  if (!profile) return null;
  let settings = null;
  try {
    settings = await authFetch('/settings', { method: 'GET' });
    if (settings?.primary) {
      applyTheme(profile.theme_preference ?? settings.theme_preference, settings.primary);
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
