import { setToken, getToken, applyTheme } from './common.js';

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');

if (getToken()) {
  window.location.href = 'dashboard.html';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Não foi possível autenticar.');
    }

    const { token, user } = await response.json();
    setToken(token, user);
    applyTheme(user?.theme_preference);
    window.location.href = 'dashboard.html';
  } catch (error) {
    errorBox.textContent = error.message;
  }
});
