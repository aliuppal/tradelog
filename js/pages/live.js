import { supabase } from '../config.js';
import { getUser } from '../auth.js';
import { showToast, formatCurrency, formatDate, toLocalDateStr, pnlClass } from '../utils.js';

const BROKERS = ['Exness', 'MEXC', 'Binance', 'Bybit', 'Other'];
const BROKER_COLORS = {
  Exness: '#00c853', MEXC: '#1976d2', Binance: '#f0b90b',
  Bybit: '#f7a600', Other: '#9da3b4',
};

// ─── DB helpers ───────────────────────────────────────────────
async function fetchAccounts() {
  const user = getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('live_accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function fetchLogs(accountId = null) {
  const user = getUser();
  if (!user) return [];
  let q = supabase.from('live_account_logs').select('*, live_accounts(broker, account_name)').eq('user_id', user.id).order('log_date', { ascending: false });
  if (accountId) q = q.eq('account_id', accountId);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return data || [];
}

async function saveAccount(payload, id = null) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');
  if (id) {
    const { data, error } = await supabase.from('live_accounts').update(payload).eq('id', id).eq('user_id', user.id).select().single();
    if (error) throw error; return data;
  }
  const { data, error } = await supabase.from('live_accounts').insert([{ ...payload, user_id: user.id }]).select().single();
  if (error) throw error; return data;
}

async function deleteAccount(id) {
  const user = getUser();
  const { error } = await supabase.from('live_accounts').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

async function saveLog(payload, id = null) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');
  if (id) {
    const { data, error } = await supabase.from('live_account_logs').update(payload).eq('id', id).eq('user_id', user.id).select().single();
    if (error) throw error; return data;
  }
  const { data, error } = await supabase.from('live_account_logs').insert([{ ...payload, user_id: user.id }]).select().single();
  if (error) throw error; return data;
}

async function deleteLog(id) {
  const user = getUser();
  const { error } = await supabase.from('live_account_logs').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

// ─── Monthly aggregation ──────────────────────────────────────
function groupByMonth(logs) {
  const map = {};
  for (const l of logs) {
    const key = l.log_date?.slice(0, 7); // YYYY-MM
    if (!map[key]) map[key] = { pnl: 0, count: 0 };
    map[key].pnl += parseFloat(l.pnl) || 0;
    map[key].count++;
  }
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

// ─── Page render ──────────────────────────────────────────────
let selectedAccountId = null;

export async function renderLive(container) {
  container.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;
  const [accounts, logs] = await Promise.all([fetchAccounts(), fetchLogs()]);
  mountLive(container, accounts, logs);
}

function mountLive(container, accounts, logs) {
  // Total across all accounts this month
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLogs = logs.filter(l => l.log_date?.startsWith(thisMonthKey));
  const monthTotal = monthLogs.reduce((s, l) => s + (parseFloat(l.pnl) || 0), 0);
  const allTimeTotal = logs.reduce((s, l) => s + (parseFloat(l.pnl) || 0), 0);

  const filteredLogs = selectedAccountId ? logs.filter(l => l.account_id === selectedAccountId) : logs;
  const monthlyGroups = groupByMonth(filteredLogs);

  container.innerHTML = `
    <div class="page live-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Live Accounts</h1>
          <p class="page-sub">Track real money accounts across brokers</p>
        </div>
        <button class="btn-primary" id="la-add-btn"><i class="fa-solid fa-plus"></i> Add Account</button>
      </div>

      <!-- Summary -->
      <div class="fa-summary">
        <div class="card fa-sum-card">
          <span class="fa-sum-label">Accounts</span>
          <span class="fa-sum-val">${accounts.length}</span>
        </div>
        <div class="card fa-sum-card">
          <span class="fa-sum-label">Month P&L</span>
          <span class="fa-sum-val ${pnlClass(monthTotal)}">${formatCurrency(monthTotal, true)}</span>
        </div>
        <div class="card fa-sum-card">
          <span class="fa-sum-label">All-Time P&L</span>
          <span class="fa-sum-val ${pnlClass(allTimeTotal)}">${formatCurrency(allTimeTotal, true)}</span>
        </div>
        <div class="card fa-sum-card">
          <span class="fa-sum-label">Total Log Entries</span>
          <span class="fa-sum-val">${logs.length}</span>
        </div>
      </div>

      <div class="live-layout">
        <!-- Accounts sidebar -->
        <div class="live-accounts-panel">
          <div class="card" style="padding:0;overflow:hidden">
            <div class="live-panel-header">
              <span class="card-title">Accounts</span>
            </div>
            ${accounts.length ? accounts.map(a => accountItem(a, selectedAccountId)).join('') :
              `<div class="empty-state small"><i class="fa-solid fa-wallet"></i><p>No accounts yet</p></div>`}
          </div>
        </div>

        <!-- Logs panel -->
        <div class="live-logs-panel">
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                ${selectedAccountId
                  ? `Logs — ${accounts.find(a => a.id === selectedAccountId)?.account_name || 'Account'}`
                  : 'All Logs'}
              </span>
              <div style="display:flex;gap:8px;align-items:center">
                ${selectedAccountId ? `<button class="btn-secondary btn-sm" id="la-clear-filter"><i class="fa-solid fa-xmark"></i> Clear filter</button>` : ''}
                <button class="btn-primary btn-sm" id="la-add-log-btn" ${!accounts.length ? 'disabled' : ''}>
                  <i class="fa-solid fa-plus"></i> Add Log
                </button>
              </div>
            </div>
            ${filteredLogs.length ? logsTableHTML(filteredLogs) :
              `<div class="empty-state small"><i class="fa-solid fa-receipt"></i><p>No logs yet</p></div>`}
          </div>

          <!-- Monthly totals -->
          ${monthlyGroups.length ? `
            <div class="card mt-4">
              <div class="card-header"><span class="card-title">Monthly P&L Totals</span></div>
              <div class="monthly-totals">
                ${monthlyGroups.map(([month, d]) => `
                  <div class="monthly-row">
                    <span class="monthly-label">${formatMonthLabel(month)}</span>
                    <span class="monthly-count">${d.count} log${d.count !== 1 ? 's' : ''}</span>
                    <span class="monthly-pnl ${pnlClass(d.pnl)}">${formatCurrency(d.pnl, true)}</span>
                  </div>`).join('')}
              </div>
            </div>` : ''}
        </div>
      </div>
    </div>

    <!-- Account Modal -->
    <div id="la-modal" class="modal-overlay hidden">
      <div class="modal" id="la-modal-inner"></div>
    </div>
    <!-- Log Modal -->
    <div id="la-log-modal" class="modal-overlay hidden">
      <div class="modal" style="max-width:480px" id="la-log-modal-inner"></div>
    </div>`;

  // Account actions
  document.getElementById('la-add-btn')?.addEventListener('click', () => openAccountModal(null, container, accounts));
  document.getElementById('la-clear-filter')?.addEventListener('click', () => { selectedAccountId = null; renderLive(container); });
  document.getElementById('la-add-log-btn')?.addEventListener('click', () => openLogModal(null, container, accounts));

  container.querySelectorAll('.la-account-item').forEach(item => {
    item.addEventListener('click', () => {
      selectedAccountId = item.dataset.id === selectedAccountId ? null : item.dataset.id;
      renderLive(container);
    });
  });
  container.querySelectorAll('.la-edit-acc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const acc = accounts.find(a => a.id === btn.dataset.id);
      if (acc) openAccountModal(acc, container, accounts);
    });
  });
  container.querySelectorAll('.la-delete-acc').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this account and all its logs?')) return;
      try { await deleteAccount(btn.dataset.id); showToast('Account deleted', 'success'); renderLive(container); }
      catch (err) { showToast(err.message, 'error'); }
    });
  });
  container.querySelectorAll('.la-edit-log').forEach(btn => {
    btn.addEventListener('click', () => {
      const log = logs.find(l => l.id === btn.dataset.id);
      if (log) openLogModal(log, container, accounts);
    });
  });
  container.querySelectorAll('.la-delete-log').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this log entry?')) return;
      try { await deleteLog(btn.dataset.id); showToast('Log deleted', 'success'); renderLive(container); }
      catch (err) { showToast(err.message, 'error'); }
    });
  });
}

function accountItem(a, selectedId) {
  const color = BROKER_COLORS[a.broker] || BROKER_COLORS.Other;
  return `
    <div class="la-account-item ${a.id === selectedId ? 'selected' : ''}" data-id="${a.id}">
      <div class="la-broker-dot" style="background:${color}"></div>
      <div class="la-acc-info">
        <span class="la-acc-name">${a.account_name || a.broker}</span>
        <span class="la-acc-sub">${a.broker} · ${formatCurrency(a.account_size || 0)}</span>
        ${a.asset_type ? `<span class="la-acc-type">${a.asset_type}</span>` : ''}
      </div>
      <div class="la-acc-actions">
        <button class="btn-icon btn-xs la-edit-acc" data-id="${a.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon btn-xs la-delete-acc" data-id="${a.id}" style="color:var(--red)"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
}

function logsTableHTML(logs) {
  return `
    <div class="table-wrap">
      <table class="trades-table">
        <thead><tr>
          <th>Date</th><th>Account</th><th>P&L</th><th>Note</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td>${formatDate(l.log_date)}</td>
              <td>
                <span class="la-broker-tag" style="background:${BROKER_COLORS[l.live_accounts?.broker]||'#555'}20;color:${BROKER_COLORS[l.live_accounts?.broker]||'#9da3b4'}">
                  ${l.live_accounts?.broker || '—'}
                </span>
                <span style="font-size:0.78rem;color:var(--text-muted);margin-left:4px">${l.live_accounts?.account_name || ''}</span>
              </td>
              <td class="mono ${pnlClass(l.pnl)}">${formatCurrency(l.pnl, true)}</td>
              <td class="notes-cell">${l.note ? `<span class="notes-preview" title="${l.note}">${l.note.slice(0,50)}${l.note.length>50?'…':''}</span>` : '—'}</td>
              <td>
                <div class="row-actions">
                  <button class="btn-icon btn-xs la-edit-log" data-id="${l.id}"><i class="fa-solid fa-pen"></i></button>
                  <button class="btn-icon btn-xs la-delete-log" data-id="${l.id}" style="color:var(--red)"><i class="fa-solid fa-trash"></i></button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function formatMonthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

// ─── Account modal ────────────────────────────────────────────
function openAccountModal(acc, container, accounts) {
  const overlay = document.getElementById('la-modal');
  const inner = document.getElementById('la-modal-inner');
  const d = acc || {};

  inner.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${acc ? 'Edit' : 'Add'} Live Account</h2>
      <button class="btn-icon" id="la-modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form id="la-acc-form">
      <div class="form-grid">
        <div class="form-group">
          <label>Broker <span class="required">*</span></label>
          <select id="la-broker" required>
            <option value="">Select...</option>
            ${BROKERS.map(b => `<option value="${b}" ${d.broker===b?'selected':''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Account Name / Label</label>
          <input type="text" id="la-name" value="${d.account_name||''}" placeholder="e.g. My Scalping Account" />
        </div>
        <div class="form-group">
          <label>Account Size ($)</label>
          <input type="number" id="la-size" value="${d.account_size||''}" placeholder="10000" step="any" />
        </div>
        <div class="form-group">
          <label>Currency</label>
          <select id="la-currency">
            ${['USD','USDT','EUR','GBP','BTC'].map(c => `<option value="${c}" ${(d.currency||'USD')===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Asset Type</label>
          <select id="la-asset">
            <option value="">Select...</option>
            ${['Futures','Spot','CFDs','Forex','Options'].map(t => `<option value="${t}" ${d.asset_type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="la-active">
            <option value="true" ${d.is_active!==false?'selected':''}>Active</option>
            <option value="false" ${d.is_active===false?'selected':''}>Inactive</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label>Notes</label>
          <textarea id="la-notes" rows="2" placeholder="Any details...">${d.notes||''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="la-modal-cancel">Cancel</button>
        <button type="submit" class="btn-primary">
          <span>${acc ? 'Save Changes' : 'Add Account'}</span>
        </button>
      </div>
    </form>`;

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const close = () => { overlay.classList.add('hidden'); document.body.style.overflow = ''; };
  document.getElementById('la-modal-close')?.addEventListener('click', close);
  document.getElementById('la-modal-cancel')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('la-acc-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      broker:       document.getElementById('la-broker').value,
      account_name: document.getElementById('la-name').value.trim() || null,
      account_size: parseFloat(document.getElementById('la-size').value) || null,
      currency:     document.getElementById('la-currency').value,
      asset_type:   document.getElementById('la-asset').value || null,
      is_active:    document.getElementById('la-active').value === 'true',
      notes:        document.getElementById('la-notes').value.trim() || null,
    };
    try {
      await saveAccount(payload, acc?.id || null);
      showToast(acc ? 'Account updated' : 'Account added', 'success');
      close(); renderLive(container);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Log modal ────────────────────────────────────────────────
function openLogModal(log, container, accounts) {
  const overlay = document.getElementById('la-log-modal');
  const inner = document.getElementById('la-log-modal-inner');
  const d = log || {};
  const activeAccounts = accounts.filter(a => a.is_active !== false);

  inner.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${log ? 'Edit' : 'Add'} Log Entry</h2>
      <button class="btn-icon" id="la-log-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form id="la-log-form">
      <div class="form-grid">
        <div class="form-group form-full">
          <label>Account <span class="required">*</span></label>
          <select id="la-log-account" required>
            <option value="">Select account...</option>
            ${accounts.map(a => `<option value="${a.id}" ${(d.account_id||selectedAccountId)===a.id?'selected':''}>${a.broker} — ${a.account_name || formatCurrency(a.account_size||0)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Date <span class="required">*</span></label>
          <input type="date" id="la-log-date" value="${d.log_date || toLocalDateStr()}" required />
        </div>
        <div class="form-group">
          <label>P&L ($) <span class="required">*</span></label>
          <input type="number" id="la-log-pnl" value="${d.pnl||''}" placeholder="0.00" step="any" required />
        </div>
        <div class="form-group form-full">
          <label>Note</label>
          <textarea id="la-log-note" rows="2" placeholder="What happened today?">${d.note||''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="la-log-cancel">Cancel</button>
        <button type="submit" class="btn-primary">${log ? 'Save Changes' : 'Add Log'}</button>
      </div>
    </form>`;

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const close = () => { overlay.classList.add('hidden'); document.body.style.overflow = ''; };
  document.getElementById('la-log-close')?.addEventListener('click', close);
  document.getElementById('la-log-cancel')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('la-log-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      account_id: document.getElementById('la-log-account').value,
      log_date:   document.getElementById('la-log-date').value,
      pnl:        parseFloat(document.getElementById('la-log-pnl').value) || 0,
      note:       document.getElementById('la-log-note').value.trim() || null,
    };
    try {
      await saveLog(payload, log?.id || null);
      showToast(log ? 'Log updated' : 'Log added', 'success');
      close(); renderLive(container);
    } catch (err) { showToast(err.message, 'error'); }
  });
}
