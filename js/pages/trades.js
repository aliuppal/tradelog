import { fetchAllTrades, deleteTrade } from '../db.js';
import { formatCurrency, formatDate, pnlClass, showToast } from '../utils.js';
import { openTradeModal } from '../modal.js';

let allTrades = [];
let filtered = [];
let sortKey = 'trade_date';
let sortDir = -1;
let searchQuery = '';
let filterSide = 'all';
let filterSymbol = '';

export async function renderTrades(container) {
  container.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;
  allTrades = await fetchAllTrades();
  applyFilters();
  mountTradesUI(container);
}

function mountTradesUI(container) {
  const symbols = [...new Set(allTrades.map(t => t.symbol).filter(Boolean))].sort();

  container.innerHTML = `
    <div class="page trades-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Trade Log</h1>
          <p class="page-sub">${allTrades.length} total trades</p>
        </div>
        <button class="btn-primary" id="tl-add-trade">
          <i class="fa-solid fa-plus"></i> Add Trade
        </button>
      </div>

      <!-- Filters -->
      <div class="card filters-bar">
        <div class="filter-left">
          <div class="search-box">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="tl-search" placeholder="Search symbol, setup, notes..." value="${searchQuery}" />
          </div>
          <select id="tl-side-filter" class="filter-select">
            <option value="all" ${filterSide==='all'?'selected':''}>All Sides</option>
            <option value="LONG" ${filterSide==='LONG'?'selected':''}>Long</option>
            <option value="SHORT" ${filterSide==='SHORT'?'selected':''}>Short</option>
          </select>
          <select id="tl-symbol-filter" class="filter-select">
            <option value="">All Symbols</option>
            ${symbols.map(s => `<option value="${s}" ${filterSymbol===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <span class="filter-count">${filtered.length} result${filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <!-- Table -->
      <div class="card table-card">
        ${filtered.length ? tradesTableHTML() : emptyHTML()}
      </div>
    </div>`;

  // Listeners
  document.getElementById('tl-add-trade')?.addEventListener('click', () => openTradeModal(null, onTradeChange));
  document.getElementById('tl-search')?.addEventListener('input', e => { searchQuery = e.target.value; applyFilters(); refreshTable(); });
  document.getElementById('tl-side-filter')?.addEventListener('change', e => { filterSide = e.target.value; applyFilters(); refreshTable(); });
  document.getElementById('tl-symbol-filter')?.addEventListener('change', e => { filterSymbol = e.target.value; applyFilters(); refreshTable(); });

  attachTableListeners();
}

function tradesTableHTML() {
  return `
    <div class="table-wrap">
      <table class="trades-table">
        <thead>
          <tr>
            ${th('Date', 'trade_date')}
            ${th('Symbol', 'symbol')}
            ${th('Side', 'side')}
            ${th('Entry', 'entry_price')}
            ${th('Exit', 'exit_price')}
            ${th('Qty', 'quantity')}
            ${th('P&L', 'pnl')}
            ${th('R:R', 'rr')}
            ${th('Setup', 'setup')}
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="trades-tbody">
          ${filtered.map(tradeRowHTML).join('')}
        </tbody>
      </table>
    </div>`;
}

function th(label, key) {
  const active = sortKey === key;
  const icon = active ? (sortDir === 1 ? '↑' : '↓') : '';
  return `<th class="sortable ${active ? 'sort-active' : ''}" data-key="${key}">${label} <span class="sort-icon">${icon}</span></th>`;
}

function tradeRowHTML(t) {
  const pnl = parseFloat(t.pnl) || 0;
  return `
    <tr data-id="${t.id}">
      <td>${formatDate(t.trade_date)}</td>
      <td><span class="symbol-badge">${t.symbol || '—'}</span></td>
      <td><span class="side-badge side-${t.side?.toLowerCase()}">${t.side || '—'}</span></td>
      <td class="mono">${t.entry_price || '—'}</td>
      <td class="mono">${t.exit_price || '—'}</td>
      <td class="mono">${t.quantity || '—'}</td>
      <td class="mono ${pnlClass(pnl)}">${formatCurrency(pnl, true)}</td>
      <td class="mono">${t.rr ? t.rr + 'R' : '—'}</td>
      <td><span class="setup-tag">${t.setup || '—'}</span></td>
      <td class="notes-cell">${t.notes ? `<span class="notes-preview" title="${t.notes}">${t.notes.slice(0, 40)}${t.notes.length > 40 ? '…' : ''}</span>` : '—'}</td>
      <td>
        <div class="row-actions">
          <button class="btn-icon btn-xs edit-btn" data-id="${t.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon btn-xs delete-btn" data-id="${t.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
}

function emptyHTML() {
  return `<div class="empty-state"><i class="fa-solid fa-chart-line"></i><p>No trades found</p><p class="empty-sub">Add your first trade to get started</p><button class="btn-primary" id="empty-add-trade">Add Trade</button></div>`;
}

function attachTableListeners() {
  // Sort
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = -1; }
      applyFilters();
      refreshTable();
    });
  });

  // Edit
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const trade = allTrades.find(t => t.id === btn.dataset.id);
      if (trade) openTradeModal(trade, onTradeChange);
    });
  });

  // Delete
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this trade? This cannot be undone.')) return;
      try {
        await deleteTrade(btn.dataset.id);
        allTrades = allTrades.filter(t => t.id !== btn.dataset.id);
        applyFilters();
        refreshTable();
        showToast('Trade deleted', 'success');
      } catch (e) { showToast(e.message, 'error'); }
    });
  });

  document.getElementById('empty-add-trade')?.addEventListener('click', () => openTradeModal(null, onTradeChange));
}

function refreshTable() {
  const tbody = document.getElementById('trades-tbody');
  const tableCard = document.querySelector('.table-card');
  const countEl = document.querySelector('.filter-count');
  if (countEl) countEl.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
  if (tableCard) {
    tableCard.innerHTML = filtered.length ? tradesTableHTML() : emptyHTML();
    attachTableListeners();
  }
}

function applyFilters() {
  filtered = allTrades.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || (t.symbol || '').toLowerCase().includes(q) || (t.setup || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q);
    const matchSide = filterSide === 'all' || t.side === filterSide;
    const matchSymbol = !filterSymbol || t.symbol === filterSymbol;
    return matchSearch && matchSide && matchSymbol;
  });

  filtered.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === 'pnl' || sortKey === 'entry_price' || sortKey === 'exit_price' || sortKey === 'rr') {
      va = parseFloat(va) || 0;
      vb = parseFloat(vb) || 0;
    }
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });
}

async function onTradeChange() {
  allTrades = await fetchAllTrades();
  applyFilters();
  refreshTable();
}
