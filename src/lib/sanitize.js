const UNSAFE = /[<>"'`]/g;
const ESC = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '`': '&#x60;' };

export function sanitizeText(value, maxLen = 1000) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLen).replace(UNSAFE, c => ESC[c]);
}

export function sanitizeEmail(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().slice(0, 254).replace(/[^a-z0-9@._+\-]/g, '');
}

export function sanitizePhone(value) {
  if (!value) return '';
  return String(value).trim().replace(/[^0-9+\-() ]/g, '').slice(0, 20);
}

export function sanitizeNumber(value, decimals = 2) {
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, '')) || 0;
  return parseFloat(n.toFixed(decimals));
}

export function sanitizeInt(value) {
  return parseInt(String(value).replace(/[^0-9\-]/g, ''), 10) || 0;
}

export function sanitizePercent(value) {
  const n = sanitizeInt(value);
  return Math.max(0, Math.min(100, n));
}

export function sanitizeForm(data, schema) {
  const out = {};
  for (const [k, type] of Object.entries(schema)) {
    if (!(k in data)) continue;
    if      (type === 'text')    out[k] = sanitizeText(data[k]);
    else if (type === 'email')   out[k] = sanitizeEmail(data[k]);
    else if (type === 'phone')   out[k] = sanitizePhone(data[k]);
    else if (type === 'number')  out[k] = sanitizeNumber(data[k]);
    else if (type === 'int')     out[k] = sanitizeInt(data[k]);
    else if (type === 'percent') out[k] = sanitizePercent(data[k]);
    else                         out[k] = data[k];
  }
  return out;
}
