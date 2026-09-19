// ─── Toast Notifications ─────────────────────────────────────
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}

// ─── Currency Formatter ───────────────────────────────────────
export function formatCurrency(val, showPlus = false) {
  const n = parseFloat(val) || 0;
  const str = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Math.abs(n));
  if (n < 0) return `-${str}`;
  if (showPlus && n > 0) return `+${str}`;
  return str;
}

// ─── Percent formatter ────────────────────────────────────────
export function formatPct(val, showPlus = false) {
  const n = parseFloat(val) || 0;
  const str = Math.abs(n).toFixed(2) + '%';
  if (n < 0) return `-${str}`;
  if (showPlus && n > 0) return `+${str}`;
  return str;
}

// ─── Date helpers ─────────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function toLocalDateStr(date = new Date()) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ─── PNL color class ─────────────────────────────────────────
export function pnlClass(val) {
  const n = parseFloat(val) || 0;
  if (n > 0) return 'pnl-positive';
  if (n < 0) return 'pnl-negative';
  return 'pnl-neutral';
}

// ─── Debounce ─────────────────────────────────────────────────
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─── Generate unique local ID (for optimistic UI) ────────────
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
