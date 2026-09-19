import { fetchAllTrades, computeStats, aggregateByDate } from '../db.js';
import { formatCurrency, formatPct, pnlClass } from '../utils.js';
import { openTradeModal } from '../modal.js';

export async function renderDashboard(container) {
  container.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;

  const trades = await fetchAllTrades();
  const stats = computeStats(trades);
  const now = new Date();
  const thisMonth = trades.filter(t => t.trade_date?.startsWith(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`));
  const monthStats = computeStats(thisMonth);

  // Recent 5 trades
  const recent = trades.slice(0, 5);

  container.innerHTML = `
    <div class="page dashboard-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-sub">Your trading performance at a glance</p>
        </div>
        <button class="btn-primary" id="dash-add-trade">
          <i class="fa-solid fa-plus"></i> Add Trade
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        ${kpiCard('Total P&L', formatCurrency(stats?.totalPnl || 0, true), stats?.totalPnl || 0, 'fa-dollar-sign', 'All time')}
        ${kpiCard('Win Rate', formatPct(stats?.winRate || 0), stats?.winRate > 50 ? 1 : -1, 'fa-trophy', `${stats?.wins || 0}W / ${stats?.losses || 0}L`)}
        ${kpiCard('Total Trades', stats?.totalTrades || 0, 0, 'fa-repeat', 'All time', false)}
        ${kpiCard('Profit Factor', stats?.profitFactor === Infinity ? '∞' : (stats?.profitFactor || 0).toFixed(2), (stats?.profitFactor || 0) >= 1 ? 1 : -1, 'fa-scale-balanced', 'Gross profit / loss', false)}
        ${kpiCard('Month P&L', formatCurrency(monthStats?.totalPnl || 0, true), monthStats?.totalPnl || 0, 'fa-calendar', 'This month')}
        ${kpiCard('Avg Win', formatCurrency(stats?.avgWin || 0), 1, 'fa-arrow-trend-up', 'Per winning trade')}
        ${kpiCard('Avg Loss', formatCurrency(stats?.avgLoss || 0), -1, 'fa-arrow-trend-down', 'Per losing trade', false)}
        ${kpiCard('Max Drawdown', formatCurrency(-(stats?.maxDrawdown || 0)), -1, 'fa-chart-area', 'Peak to trough')}
      </div>

      <!-- Equity Chart + Recent Trades -->
      <div class="dash-grid">
        <div class="card chart-card">
          <div class="card-header">
            <span class="card-title">Equity Curve</span>
          </div>
          <div class="chart-wrap">
            <canvas id="equity-chart"></canvas>
          </div>
        </div>

        <div class="card recent-card">
          <div class="card-header">
            <span class="card-title">Recent Trades</span>
            <a href="#trades" class="link-btn" id="view-all-trades">View all</a>
          </div>
          ${recent.length ? recentTradesHTML(recent) : '<div class="empty-state small"><i class="fa-solid fa-inbox"></i><p>No trades yet</p></div>'}
        </div>
      </div>

      <!-- Win/Loss Bar -->
      <div class="card mt-4">
        <div class="card-header"><span class="card-title">Win / Loss Distribution</span></div>
        <div class="chart-wrap short">
          <canvas id="winloss-chart"></canvas>
        </div>
      </div>
    </div>`;

  document.getElementById('dash-add-trade')?.addEventListener('click', () => openTradeModal());
  document.getElementById('view-all-trades')?.addEventListener('click', (e) => {
    e.preventDefault();
    import('../router.js').then(m => m.navigateTo('trades'));
  });

  renderEquityChart(stats?.equity || []);
  renderWinLossChart(stats);
}

function kpiCard(label, value, trend, icon, sub, colorValue = true) {
  const cls = colorValue ? (parseFloat(trend) > 0 ? 'kpi-positive' : parseFloat(trend) < 0 ? 'kpi-negative' : '') : '';
  return `
    <div class="card kpi-card">
      <div class="kpi-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="kpi-body">
        <span class="kpi-label">${label}</span>
        <span class="kpi-value ${cls}">${value}</span>
        <span class="kpi-sub">${sub}</span>
      </div>
    </div>`;
}

function recentTradesHTML(trades) {
  return `<div class="recent-list">${trades.map(t => `
    <div class="recent-item">
      <div class="recent-left">
        <span class="symbol-badge">${t.symbol}</span>
        <div>
          <span class="recent-side side-${t.side?.toLowerCase()}">${t.side}</span>
          <span class="recent-date">${t.trade_date}</span>
        </div>
      </div>
      <span class="recent-pnl ${pnlClass(t.pnl)}">${formatCurrency(t.pnl, true)}</span>
    </div>`).join('')}</div>`;
}

function renderEquityChart(equity) {
  const canvas = document.getElementById('equity-chart');
  if (!canvas || !equity.length) return;
  const labels = equity.map(e => e.date);
  const data = equity.map(e => e.equity);
  const lastVal = data[data.length - 1] || 0;
  const color = lastVal >= 0 ? '#26a69a' : '#ef5350';

  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: color + '20',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ' $' + ctx.parsed.y.toFixed(2) }
      }},
      scales: {
        x: { display: true, ticks: { color: '#888', maxTicksLimit: 6 }, grid: { color: '#ffffff08' } },
        y: { display: true, ticks: { color: '#888', callback: v => '$' + v }, grid: { color: '#ffffff08' } }
      }
    }
  });
}

function renderWinLossChart(stats) {
  const canvas = document.getElementById('winloss-chart');
  if (!canvas || !stats) return;
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Wins', 'Losses', 'Break Even'],
      datasets: [{
        data: [stats.wins, stats.losses, stats.totalTrades - stats.wins - stats.losses],
        backgroundColor: ['#26a69a', '#ef5350', '#888'],
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#888' }, grid: { display: false } },
        y: { ticks: { color: '#888', stepSize: 1 }, grid: { color: '#ffffff08' } }
      }
    }
  });
}
