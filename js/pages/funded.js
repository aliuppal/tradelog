import { supabase } from '../config.js';
import { getUser } from '../auth.js';
import { showToast, formatCurrency, formatDate, toLocalDateStr } from '../utils.js';

// ─── DB helpers ───────────────────────────────────────────────
async function fetchFunded() {
  const user = getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('funded_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

async function saveFunded(payload, id = null) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');
  if (id) {
    const { data, error } = await supabase.from('funded_accounts').update(payload).eq('id', id).eq('user_id', user.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('funded_accounts').insert([{ ...payload, user_id: user.id }]).select().single();
  if (error) throw error;
  return data;
}

async function deleteFunded(id) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('funded_accounts').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

// ─── Monthly cost aggregation ─────────────────────────────────
// Groups accounts by the month of start_date, sums purchase_price
function groupByPurchaseMonth(accounts) {
  const map = {};
  for (const a of accounts) {
    if (!a.purchase_price) continue;
    // Use start_date month; fall back to created_at month
    const rawDate = a.start_date || a.created_at?.slice(0, 10);
    if (!rawDate) continue;
    const key = rawDate.slice(0, 7); // YYYY-MM
    if (!map[key]) map[key] = { total: 0, count: 0, accounts: [] };
    map[key].total += parseFloat(a.purchase_price);
    map[key].count++;
    map[key].accounts.push(a);
  }
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

function formatMonthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

// ─── Page render ──────────────────────────────────────────────
export async function renderFunded(container) {
  container.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;
  const accounts = await fetchFunded();
  mount(container, accounts);
}

function mount(container, accounts) {
  const active    = accounts.filter(a => a.status === 'active').length;
  const breached  = accounts.filter(a => a.status === 'breached').length;
  const totalCapital = accounts.filter(a => a.status === 'active')
    .reduce((s, a) => s + parseFloat(a.account_size || 0), 0);
  const totalSpent = accounts.reduce((s, a) => s + parseFloat(a.purchase_price || 0), 0);

  // Monthly cost data
  const monthlyGroups = groupByPurchaseMonth(accounts);

  // Current month cost
  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const thisMonthCost = monthlyGroups.find(([k]) => k === thisMonthKey)?.[1]?.total || 0;

  container.innerHTML = `
    <div class="page funded-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Funded Accounts</h1>
          <p class="page-sub">Track your prop firm challenges and funded accounts</p>
        </div>
        <button class="btn-primary" id="fa-add-btn">
          <i class="fa-solid fa-plus"></i> Add Account
        </button>
      </div>

      <!-- KPI Summary -->
      <div class="fa-summary">
        <div class="card fa-sum-card">
          <span class="fa-sum-label">Total Accounts</span>
          <span class="fa-sum-val">${accounts.length}</span>
        </div>
        <div class="card fa-sum-card">
          <span class="fa-sum-label">Active</span>
          <span class="fa-sum-val pnl-positive">${active}</span>
        </div>
        <div class="card fa-sum-card">
          <span class="fa-sum-label">Breached</span>
          <span class="fa-sum-val pnl-negative">${breached}</span>
        </div>
        <div class="card fa-sum-card">
          <span class="fa-sum-label">Active Capital</span>
          <span class="fa-sum-val">${formatCurrency(totalCapital)}</span>
        </div>
        <div class="card fa-sum-card">
          <span class="fa-sum-label">Total Spent</span>
          <span class="fa-sum-val pnl-negative">${formatCurrency(totalSpent)}</span>
        </div>
        <div class="card fa-sum-card">
          <span class="fa-sum-label">This Month Cost</span>
          <span class="fa-sum-val pnl-negative">${formatCurrency(thisMonthCost)}</span>
        </div>
      </div>

      <div class="funded-layout">
        <!-- Accounts Grid -->
        <div class="funded-main">
          ${accounts.length ? `
            <div class="fa-grid" id="fa-grid">
              ${accounts.map(accountCard).join('')}
            </div>` : `
            <div class="card">
              <div class="empty-state">
                <i class="fa-solid fa-building-columns"></i>
                <p>No funded accounts yet</p>
                <p class="empty-sub">Add your first prop firm account to get started</p>
                <button class="btn-primary mt-2" id="fa-empty-add">Add Account</button>
              </div>
            </div>`}
        </div>

        <!-- Monthly Cost Breakdown sidebar -->
        <div class="funded-cost-panel">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Monthly Spend</span>
              <span class="fa-sum-label" style="font-size:0.72rem;color:var(--text-muted)">Total: ${formatCurrency(totalSpent)}</span>
            </div>
            ${monthlyGroups.length ? `
              <div class="monthly-totals">
                ${monthlyGroups.map(([month, d]) => `
                  <div class="monthly-row ${month === thisMonthKey ? 'monthly-current' : ''}">
                    <div class="monthly-left">
                      <span class="monthly-label">${formatMonthLabel(month)}</span>
                      <span class="monthly-count">${d.count} account${d.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span class="monthly-pnl pnl-negative">${formatCurrency(d.total)}</span>
                  </div>`).join('')}
              </div>` : `
              <div class="empty-state small">
                <i class="fa-solid fa-receipt"></i>
                <p>No purchase prices added yet</p>
                <p class="empty-sub">Add a purchase price when creating accounts</p>
              </div>`}
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div id="fa-modal" class="modal-overlay hidden">
      <div class="modal" id="fa-modal-inner"></div>
    </div>`;

  // Listeners
  document.getElementById('fa-add-btn')?.addEventListener('click', () => openFAModal(null, container));
  document.getElementById('fa-empty-add')?.addEventListener('click', () => openFAModal(null, container));

  container.querySelectorAll('.fa-edit-btn').forEach(btn => {
    const acc = accounts.find(a => a.id === btn.dataset.id);
    btn.addEventListener('click', () => { if (acc) openFAModal(acc, container); });
  });

  container.querySelectorAll('.fa-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this account? This cannot be undone.')) return;
      try {
        await deleteFunded(btn.dataset.id);
        showToast('Account deleted', 'success');
        renderFunded(container);
      } catch (e) { showToast(e.message, 'error'); }
    });
  });

  container.querySelectorAll('.fa-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await saveFunded({ status: btn.dataset.status }, btn.dataset.id);
        showToast(`Status → ${btn.dataset.status}`, 'success');
        renderFunded(container);
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

// ─── Account card ─────────────────────────────────────────────
function accountCard(a) {
  const statusConfig = {
    active:   { cls: 'status-active',   icon: 'fa-circle-check',  label: 'Active' },
    breached: { cls: 'status-breached', icon: 'fa-circle-xmark',  label: 'Breached' },
    passed:   { cls: 'status-passed',   icon: 'fa-trophy',         label: 'Passed' },
    expired:  { cls: 'status-expired',  icon: 'fa-clock',          label: 'Expired' },
    inactive: { cls: 'status-inactive', icon: 'fa-circle-minus',   label: 'Inactive' },
  };
  const s = statusConfig[a.status] || statusConfig.inactive;

  const otherStatuses = Object.entries(statusConfig)
    .filter(([k]) => k !== a.status)
    .map(([k, v]) => `<button class="dropdown-item fa-status-btn" data-id="${a.id}" data-status="${k}">
      <i class="fa-solid ${v.icon}"></i> Set ${v.label}
    </button>`).join('');

  return `
    <div class="card fa-card ${a.status === 'breached' ? 'fa-card-breached' : a.status === 'active' ? 'fa-card-active' : ''}">
      <div class="fa-card-header">
        <div class="fa-company">
          <span class="fa-company-name">${a.company}</span>
          <span class="fa-asset-badge">${a.asset_type}</span>
        </div>
        <span class="status-badge ${s.cls}">
          <i class="fa-solid ${s.icon}"></i> ${s.label}
        </span>
      </div>

      <div class="fa-size">${formatCurrency(a.account_size)} <span class="fa-currency">${a.currency || 'USD'}</span></div>

      <div class="fa-type-row">
        <span class="fa-type-badge">${a.account_type}</span>
        ${a.login_id ? `<span class="fa-login">ID: ${a.login_id}</span>` : ''}
      </div>

      <!-- Purchase price badge -->
      ${a.purchase_price ? `
        <div class="fa-purchase-row">
          <i class="fa-solid fa-tag"></i>
          <span>Purchased: <strong>${formatCurrency(a.purchase_price)}</strong></span>
          ${a.start_date ? `<span class="fa-purchase-date">${formatDate(a.start_date)}</span>` : ''}
        </div>` : ''}

      <div class="fa-metrics">
        ${a.profit_target   ? `<div class="fa-metric"><span class="fa-metric-label">Target</span><span class="fa-metric-val pnl-positive">+${a.profit_target}%</span></div>` : ''}
        ${a.max_drawdown    ? `<div class="fa-metric"><span class="fa-metric-label">Max DD</span><span class="fa-metric-val pnl-negative">-${a.max_drawdown}%</span></div>` : ''}
        ${a.daily_loss_limit? `<div class="fa-metric"><span class="fa-metric-label">Daily Loss</span><span class="fa-metric-val pnl-negative">-${a.daily_loss_limit}%</span></div>` : ''}
      </div>

      <div class="fa-dates">
        ${a.start_date ? `<span><i class="fa-solid fa-play"></i> ${formatDate(a.start_date)}</span>` : ''}
        ${a.end_date   ? `<span><i class="fa-solid fa-flag-checkered"></i> ${formatDate(a.end_date)}</span>` : ''}
      </div>

      ${a.notes ? `<p class="fa-notes">${a.notes}</p>` : ''}

      <div class="fa-card-footer">
        <div class="dropdown-wrap">
          <button class="btn-secondary btn-sm dropdown-trigger">
            <i class="fa-solid fa-circle-half-stroke"></i> Status
            <i class="fa-solid fa-chevron-down" style="font-size:0.6rem"></i>
          </button>
          <div class="dropdown-menu">${otherStatuses}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-icon fa-edit-btn" data-id="${a.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon fa-delete-btn" data-id="${a.id}" title="Delete" style="color:var(--red)"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>`;
}

// ─── Modal ────────────────────────────────────────────────────
function openFAModal(acc, container) {
  const overlay = document.getElementById('fa-modal');
  const inner = document.getElementById('fa-modal-inner');
  if (!overlay || !inner) return;
  const d = acc || {};

  inner.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${acc ? 'Edit' : 'Add'} Funded Account</h2>
      <button class="btn-icon" id="fa-modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <form id="fa-form" autocomplete="off">
      <div class="form-grid">
        <div class="form-group">
          <label>Company / Prop Firm <span class="required">*</span></label>
          <input type="text" id="fa-company" value="${d.company||''}" placeholder="e.g. FTMO, Topstep, MyForexFunds" required />
        </div>
        <div class="form-group">
          <label>Account Type <span class="required">*</span></label>
          <select id="fa-account-type" required>
            <option value="">Select...</option>
            ${['Challenge','Evaluation','Funded','Express','Instant Funding','Swing','Step 1','Step 2'].map(t =>
              `<option value="${t}" ${d.account_type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Asset Type <span class="required">*</span></label>
          <select id="fa-asset-type" required>
            <option value="">Select...</option>
            ${['Futures','CFDs','Forex','Crypto','Stocks'].map(t =>
              `<option value="${t}" ${d.asset_type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Account Size ($) <span class="required">*</span></label>
          <input type="number" id="fa-size" value="${d.account_size||''}" placeholder="100000" required step="any" />
        </div>
        <div class="form-group">
          <label>Purchase Price ($)</label>
          <input type="number" id="fa-purchase-price" value="${d.purchase_price||''}" placeholder="e.g. 149" step="any" />
        </div>
        <div class="form-group">
          <label>Currency</label>
          <select id="fa-currency">
            ${['USD','EUR','GBP','USDT'].map(c =>
              `<option value="${c}" ${(d.currency||'USD')===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="fa-status">
            ${['active','breached','passed','expired','inactive'].map(s =>
              `<option value="${s}" ${(d.status||'active')===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input type="date" id="fa-start" value="${d.start_date||''}" />
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input type="date" id="fa-end" value="${d.end_date||''}" />
        </div>
        <div class="form-group">
          <label>Profit Target (%)</label>
          <input type="number" id="fa-profit-target" value="${d.profit_target||''}" placeholder="10" step="any" />
        </div>
        <div class="form-group">
          <label>Max Drawdown (%)</label>
          <input type="number" id="fa-max-dd" value="${d.max_drawdown||''}" placeholder="5" step="any" />
        </div>
        <div class="form-group">
          <label>Daily Loss Limit (%)</label>
          <input type="number" id="fa-daily-loss" value="${d.daily_loss_limit||''}" placeholder="2" step="any" />
        </div>
        <div class="form-group">
          <label>Account / Login ID</label>
          <input type="text" id="fa-login-id" value="${d.login_id||''}" placeholder="12345678" />
        </div>
        <div class="form-group form-full">
          <label>Notes</label>
          <textarea id="fa-notes" rows="2" placeholder="Any additional details...">${d.notes||''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="fa-modal-cancel">Cancel</button>
        <button type="submit" class="btn-primary" id="fa-save-btn">
          <span id="fa-save-text">${acc ? 'Save Changes' : 'Add Account'}</span>
          <span class="spinner hidden" id="fa-spinner"></span>
        </button>
      </div>
    </form>`;

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const close = () => { overlay.classList.add('hidden'); document.body.style.overflow = ''; };
  document.getElementById('fa-modal-close')?.addEventListener('click', close);
  document.getElementById('fa-modal-cancel')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('fa-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('fa-save-btn');
    const text = document.getElementById('fa-save-text');
    const spinner = document.getElementById('fa-spinner');
    btn.disabled = true; text.classList.add('hidden'); spinner.classList.remove('hidden');

    const payload = {
      company:          document.getElementById('fa-company').value.trim(),
      account_type:     document.getElementById('fa-account-type').value,
      asset_type:       document.getElementById('fa-asset-type').value,
      account_size:     parseFloat(document.getElementById('fa-size').value) || null,
      purchase_price:   parseFloat(document.getElementById('fa-purchase-price').value) || null,
      currency:         document.getElementById('fa-currency').value,
      status:           document.getElementById('fa-status').value,
      start_date:       document.getElementById('fa-start').value || null,
      end_date:         document.getElementById('fa-end').value || null,
      profit_target:    parseFloat(document.getElementById('fa-profit-target').value) || null,
      max_drawdown:     parseFloat(document.getElementById('fa-max-dd').value) || null,
      daily_loss_limit: parseFloat(document.getElementById('fa-daily-loss').value) || null,
      login_id:         document.getElementById('fa-login-id').value.trim() || null,
      notes:            document.getElementById('fa-notes').value.trim() || null,
    };

    try {
      await saveFunded(payload, acc?.id || null);
      showToast(acc ? 'Account updated' : 'Account added', 'success');
      close();
      renderFunded(container);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; text.classList.remove('hidden'); spinner.classList.add('hidden');
    }
  });
}
