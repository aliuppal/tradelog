import { fetchTrades, aggregateByDate, countOutcomes } from '../db.js';
import { formatCurrency, pnlClass, toLocalDateStr } from '../utils.js';
import { openTradeModal } from '../modal.js';

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

export async function renderCalendar(container) {
  container.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;
  await drawCalendar(container);
}

async function drawCalendar(container) {
  // One query for the whole year: feeds the month grid and the year-by-month outcome table
  const yearTrades = await fetchTrades({ year: calYear });
  const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const trades = yearTrades.filter(t => t.trade_date?.startsWith(monthPrefix));
  const byDate = aggregateByDate(trades);
  const monthOutcomes = countOutcomes(trades);
  const yearRows = buildYearOutcomeRows(calYear, yearTrades);

  // Month totals
  const monthPnl = Object.values(byDate).reduce((a, d) => a + d.pnl, 0);
  const tradingDays = Object.keys(byDate).length;
  const winDays = Object.values(byDate).filter(d => d.result === 'win').length;
  const lossDays = Object.values(byDate).filter(d => d.result === 'loss').length;
  const beDays = tradingDays - winDays - lossDays;

  const monthName = new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

  // Build week rows for weekly PNL
  const weekRows = buildWeekRows(calYear, calMonth, byDate);

  container.innerHTML = `
    <div class="page calendar-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">PNL Calendar</h1>
          <p class="page-sub">Daily profit & loss heatmap</p>
        </div>
        <button class="btn-primary" id="cal-add-trade">
          <i class="fa-solid fa-plus"></i> Add Trade
        </button>
      </div>

      <!-- Month Summary -->
      <div class="cal-summary">
        <div class="cal-sum-item">
          <span class="cal-sum-label">Month P&L</span>
          <span class="cal-sum-val ${pnlClass(monthPnl)}">${formatCurrency(monthPnl, true)}</span>
        </div>
        <div class="cal-sum-item">
          <span class="cal-sum-label">Trading Days</span>
          <span class="cal-sum-val">${tradingDays}</span>
        </div>
        <div class="cal-sum-item">
          <span class="cal-sum-label">Win Days</span>
          <span class="cal-sum-val pnl-positive">${winDays}</span>
        </div>
        <div class="cal-sum-item">
          <span class="cal-sum-label">Loss Days</span>
          <span class="cal-sum-val pnl-negative">${lossDays}</span>
        </div>
        <div class="cal-sum-item">
          <span class="cal-sum-label">BE Days</span>
          <span class="cal-sum-val">${beDays}</span>
        </div>
        <div class="cal-sum-item">
          <span class="cal-sum-label">Day Win Rate</span>
          <span class="cal-sum-val ${tradingDays ? pnlClass(winDays - lossDays) : ''}">${tradingDays ? ((winDays / tradingDays) * 100).toFixed(0) + '%' : '—'}</span>
        </div>
      </div>

      <!-- Calendar Nav -->
      <div class="card cal-card">
        <div class="cal-nav">
          <button class="btn-icon" id="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
          <h2 class="cal-month-title">${monthName}</h2>
          <button class="btn-icon" id="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
        </div>

        <!-- Calendar + Weekly PNL side by side -->
        <div class="cal-layout">
          <div class="cal-main">
            <!-- Day-of-week headers -->
            <div class="cal-grid">
              ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
              ${buildCalendarCells(calYear, calMonth, byDate)}
            </div>
          </div>

          <div class="cal-side">
            <!-- Weekly PNL -->
            <div class="cal-weekly">
              <div class="weekly-header">Week P&L</div>
              ${weekRows.map(w => `
                <div class="weekly-row">
                  <span class="weekly-label">W${w.weekNum}</span>
                  <div class="weekly-bar-wrap">
                    <div class="weekly-bar ${w.pnl >= 0 ? 'bar-win' : 'bar-loss'}"
                         style="width:${w.barPct}%"></div>
                  </div>
                  <span class="weekly-pnl ${pnlClass(w.pnl)}">${w.pnl !== 0 ? formatCurrency(w.pnl, true) : '—'}</span>
                </div>`).join('')}
            </div>

            <!-- Month outcomes: TP / SL / BE -->
            ${outcomePanelHTML(monthOutcomes)}
          </div>
        </div>
      </div>

      <!-- Year: outcomes month by month -->
      <div class="card year-outcomes-card">
        <div class="card-header">
          <span class="card-title">${calYear} · Outcomes by Month</span>
        </div>
        <div class="table-wrap">
          <table class="trades-table year-outcomes-table">
            <thead>
              <tr>
                <th>Month</th>
                <th class="num outcome-col-tp">TP</th>
                <th class="num outcome-col-sl">SL</th>
                <th class="num outcome-col-be">BE</th>
                <th class="num">Win Days</th>
                <th class="num">Loss Days</th>
                <th class="num">BE Days</th>
                <th class="num">TP Rate</th>
                <th class="num">P&L</th>
              </tr>
            </thead>
            <tbody>
              ${yearRows.map(r => `
                <tr class="year-row ${r.month === calMonth ? 'year-row-current' : ''} ${r.total ? '' : 'year-row-empty'}" data-month="${r.month}" tabindex="0">
                  <td>${r.label}</td>
                  <td class="num mono">${r.total ? r.TP : '—'}</td>
                  <td class="num mono">${r.total ? r.SL : '—'}</td>
                  <td class="num mono">${r.total ? r.BE : '—'}</td>
                  <td class="num mono pnl-positive">${r.total ? r.winDays : '—'}</td>
                  <td class="num mono pnl-negative">${r.total ? r.lossDays : '—'}</td>
                  <td class="num mono">${r.total ? r.beDays : '—'}</td>
                  <td class="num mono">${tpRate(r)}</td>
                  <td class="num mono ${pnlClass(r.pnl)}">${r.total ? formatCurrency(r.pnl, true) : '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Day detail panel -->
      <div class="card day-detail-card hidden" id="day-detail">
        <div class="card-header">
          <span class="card-title" id="day-detail-title">Trades on —</span>
          <button class="btn-icon" id="day-detail-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="day-detail-body"></div>
      </div>
    </div>`;

  // Nav
  document.getElementById('cal-prev')?.addEventListener('click', async () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    await drawCalendar(container);
  });
  document.getElementById('cal-next')?.addEventListener('click', async () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    await drawCalendar(container);
  });

  document.getElementById('cal-add-trade')?.addEventListener('click', () => openTradeModal());
  document.getElementById('day-detail-close')?.addEventListener('click', () => {
    document.getElementById('day-detail')?.classList.add('hidden');
  });

  // Year table: jump to a month
  container.querySelectorAll('.year-row').forEach(row => {
    const go = async () => { calMonth = +row.dataset.month; await drawCalendar(container); };
    row.addEventListener('click', go);
    row.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });

  // Cell clicks
  container.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => showDayDetail(cell.dataset.date, byDate[cell.dataset.date], trades));
  });
}

// ─── Outcome helpers (TP / SL / BE) ──────────────────────────
const OUTCOME_LABELS = { TP: 'Take Profit', SL: 'Stop Loss', BE: 'Break Even' };

// TP rate = TP / (TP + SL); break-evens are excluded
function tpRate(c) {
  const decided = c.TP + c.SL;
  return decided ? `${Math.round((c.TP / decided) * 100)}%` : '—';
}

function outcomePanelHTML(c) {
  const tagged = c.TP + c.SL + c.BE;
  return `
    <div class="cal-outcomes">
      <div class="weekly-header">Month Outcomes</div>
      ${['TP', 'SL', 'BE'].map(k => `
        <div class="outcome-row">
          <span class="outcome-tag outcome-tag-${k.toLowerCase()}" title="${OUTCOME_LABELS[k]}">${k}</span>
          <div class="weekly-bar-wrap">
            <div class="outcome-bar outcome-bar-${k.toLowerCase()}" style="width:${tagged ? Math.round((c[k] / tagged) * 100) : 0}%"></div>
          </div>
          <span class="outcome-count">${c[k]}</span>
        </div>`).join('')}
      <div class="outcome-foot">
        <span>TP rate <strong>${tpRate(c)}</strong></span>
        ${c.untagged ? `<span title="Trades without a TP / SL / BE outcome">${c.untagged} untagged</span>` : ''}
      </div>
    </div>`;
}

function buildYearOutcomeRows(year, yearTrades) {
  return Array.from({ length: 12 }, (_, m) => {
    const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
    const monthTrades = yearTrades.filter(t => t.trade_date?.startsWith(prefix));
    const c = countOutcomes(monthTrades);
    const days = Object.values(aggregateByDate(monthTrades));
    const winDays = days.filter(d => d.result === 'win').length;
    const lossDays = days.filter(d => d.result === 'loss').length;
    return { ...c, winDays, lossDays, beDays: days.length - winDays - lossDays, month: m, label: new Date(year, m).toLocaleString('default', { month: 'long' }) };
  });
}

// ─── Build week rows for weekly PNL panel ────────────────────
function buildWeekRows(year, month, byDate) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks = [];
  let weekPnl = 0;
  let weekNum = 1;
  let dayOfWeek = firstDay;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    weekPnl += byDate[dateStr]?.pnl || 0;
    dayOfWeek = new Date(dateStr).getDay();

    // End of week (Saturday) or last day of month
    if (dayOfWeek === 6 || d === daysInMonth) {
      weeks.push({ weekNum, pnl: weekPnl });
      weekNum++;
      weekPnl = 0;
    }
  }

  // Calculate bar widths relative to max abs pnl
  const maxAbs = Math.max(...weeks.map(w => Math.abs(w.pnl)), 1);
  return weeks.map(w => ({
    ...w,
    barPct: Math.round((Math.abs(w.pnl) / maxAbs) * 100),
  }));
}

// ─── Build calendar day cells ────────────────────────────────
function buildCalendarCells(year, month, byDate) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toLocalDateStr();
  let html = '';

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = byDate[dateStr];
    const isToday = dateStr === today;
    const isWeekend = [0, 6].includes(new Date(dateStr).getDay());

    let cls = 'cal-cell';
    if (isToday) cls += ' today';
    if (isWeekend) cls += ' weekend';
    if (dayData) cls += ` day-${dayData.result}`;
    const isBeDay = dayData?.result === 'be';

    const intensity = dayData ? Math.min(Math.abs(dayData.pnl) / 500, 1) : 0;
    const alpha = dayData ? (0.2 + intensity * 0.6).toFixed(2) : '';
    const bgStyle = dayData ? `style="--day-alpha:${alpha}"` : '';

    html += `
      <div class="${cls}" data-date="${dateStr}" ${bgStyle}>
        <span class="cal-day-num">${d}</span>
        ${dayData ? `
          <span class="cal-pnl ${isBeDay ? '' : pnlClass(dayData.pnl)}">${formatCurrency(dayData.pnl, true)}</span>
          <span class="cal-trade-count">${isBeDay ? 'Break even' : `${dayData.count} trade${dayData.count !== 1 ? 's' : ''}`}</span>
        ` : ''}
      </div>`;
  }
  return html;
}

// ─── Day detail panel ────────────────────────────────────────
function showDayDetail(date, dayData, allTrades) {
  const panel = document.getElementById('day-detail');
  const title = document.getElementById('day-detail-title');
  const body = document.getElementById('day-detail-body');
  if (!panel || !title || !body) return;

  const dateObj = new Date(date + 'T00:00:00');
  const label = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  title.textContent = `Trades on ${label}`;

  const dayTrades = allTrades.filter(t => t.trade_date === date);
  if (!dayTrades.length) {
    body.innerHTML = `<div class="empty-state small"><i class="fa-solid fa-inbox"></i><p>No trades on this day</p><button class="btn-primary btn-sm mt-2" id="detail-add">Add Trade</button></div>`;
    document.getElementById('detail-add')?.addEventListener('click', () => openTradeModal({ trade_date: date }));
  } else {
    body.innerHTML = `
      <div class="day-trades-list">
        ${dayTrades.map(t => `
          <div class="day-trade-row" data-id="${t.id}">
            <div class="dtrow-left">
              <span class="symbol-badge">${t.symbol}</span>
              <div class="dtrow-info">
                <span class="dtrow-badges">
                  <span class="side-badge side-${t.side?.toLowerCase()}">${t.side}</span>
                  ${t.outcome ? `<span class="outcome-tag outcome-tag-${t.outcome.toLowerCase()}">${t.outcome}</span>` : ''}
                </span>
                <span class="dtrow-setup">${t.setup || '—'}</span>
              </div>
            </div>
            <div class="dtrow-right">
              <span class="dtrow-pnl ${pnlClass(t.pnl)}">${formatCurrency(t.pnl, true)}</span>
              <div class="dtrow-actions">
                <button class="btn-icon btn-xs edit-trade-btn" data-id="${t.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
              </div>
            </div>
          </div>`).join('')}
        <div class="day-total">
          <span>Day Total</span>
          <span class="${pnlClass(dayData?.pnl)}">${formatCurrency(dayData?.pnl || 0, true)}</span>
        </div>
      </div>`;
    body.querySelectorAll('.edit-trade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const trade = dayTrades.find(t => t.id === btn.dataset.id);
        if (trade) openTradeModal(trade);
      });
    });
  }

  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
