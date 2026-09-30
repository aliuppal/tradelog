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

// Local-time YYYY-MM-DD (toISOString() is UTC and rolls the date early/late)
export function toLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Month helpers (keys are 'YYYY-MM') ───────────────────────
export function toMonthKey(date = new Date()) {
  return toLocalDateStr(date).slice(0, 7);
}

export function shiftMonthKey(key, delta) {
  const [y, m] = key.split('-');
  return toMonthKey(new Date(+y, +m - 1 + delta, 1));
}

export function formatMonthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

// Month selector: ‹ October 2026 › [This month] [All time]
// selected is a month key or 'all'
export function monthNavHTML(prefix, selected) {
  const isAll = selected === 'all';
  const current = toMonthKey();
  return `
    <div class="month-nav">
      <button class="btn-icon" id="${prefix}-month-prev" ${isAll ? 'disabled' : ''} title="Previous month"><i class="fa-solid fa-chevron-left"></i></button>
      <span class="month-nav-label">${isAll ? 'All time' : formatMonthLabel(selected)}</span>
      <button class="btn-icon" id="${prefix}-month-next" ${isAll ? 'disabled' : ''} title="Next month"><i class="fa-solid fa-chevron-right"></i></button>
      ${selected !== current ? `<button class="btn-secondary btn-sm" id="${prefix}-month-today">This month</button>` : ''}
      ${!isAll ? `<button class="btn-secondary btn-sm" id="${prefix}-month-all">All time</button>` : ''}
    </div>`;
}

// Wires monthNavHTML buttons; onChange receives the new month key or 'all'
export function bindMonthNav(prefix, selected, onChange) {
  document.getElementById(`${prefix}-month-prev`)?.addEventListener('click', () => onChange(shiftMonthKey(selected, -1)));
  document.getElementById(`${prefix}-month-next`)?.addEventListener('click', () => onChange(shiftMonthKey(selected, 1)));
  document.getElementById(`${prefix}-month-today`)?.addEventListener('click', () => onChange(toMonthKey()));
  document.getElementById(`${prefix}-month-all`)?.addEventListener('click', () => onChange('all'));
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
