export function digitsOnly(value = '') {
  return value ? String(value).replace(/\D+/g, '') : '';
}

export function nullIfEmpty(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}
