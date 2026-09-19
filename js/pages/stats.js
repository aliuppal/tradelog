import { fetchAllTrades, computeStats } from '../db.js';
import { formatCurrency, formatPct, pnlClass } from '../utils.js';

export async function renderStats(container) {
  container.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;
  const trades = await fetchAllTrades();
  const stats = computeStats(trades);

  if (!trades.length) {
    container.innerHTML = `<div class="page"><div class="page-header"><h1 class="page-title">Statistics</h1></div><div class="empty-state"><i class="fa-solid fa-chart-bar"></i><p>No trades to analyze yet</p></div></div>`;
    return;
  }

  // PNL by symbol
  const bySymbol = {};
  for (const t of trades) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { pnl: 0, count: 0, wins: 0 };
    bySymbol[t.symbol].pnl += parseFloat(t.pnl) || 0;
    bySymbol[t.symbol].count++;
    if ((parseFloat(t.pnl) || 0) > 0) bySymbol[t.symbol].wins++;
  }

  // PNL by setup
  const bySetup = {};
  for (const t of trades) {
    const s = t.setup || 'No Setup';
    if (!bySetup[s]) bySetup[s] = { pnl: 0, count: 0, wins: 0 };
    bySetup[s].pnl += parseFloat(t.pnl) || 0;
    bySetup[s].count++;
    if ((parseFloat(t.pnl) || 0) > 0) bySetup[s].wins++;
  }

  // PNL by day of week
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const byDow = Array(7).fill(null).map(() => ({ pnl: 0, count: 0 }));
  for (const t of trades) {
    const d = new Date(t.trade_date + 'T00:00:00').getDay();
    byDow[d].pnl += parseFloat(t.pnl) || 0;
    byDow[d].count++;
  }

  container.innerHTML = `
    <div class="page stats-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Statistics</h1>
          <p class="page-sub">Deep dive into your trading performance</p>
        </div>
      </div>

      <!-- Overview Stats -->
      <div class="stats-overview">
        ${statRow('Total P&L', formatCurrency(stats.totalPnl, true), stats.totalPnl)}
        ${statRow('Total Trades', stats.totalTrades, 0, false)}
        ${statRow('Win Rate', formatPct(stats.winRate), stats.winRate - 50)}
        ${statRow('Profit Factor', stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2), stats.profitFactor - 1, false)}
        ${statRow('Avg Win', formatCurrency(stats.avgWin, true), 1)}
        ${statRow('Avg Loss', formatCurrency(stats.avgLoss), -1)}
        ${statRow('Best Trade', formatCurrency(Math.max(...trades.map(t=>parseFloat(t.pnl)||0)), true), 1)}
        ${statRow('Worst Trade', formatCurrency(Math.min(...trades.map(t=>parseFloat(t.pnl)||0)), true), -1)}
        ${statRow('Max Drawdown', formatCurrency(-stats.maxDrawdown), -1)}
        ${statRow('Win/Loss Count', `${stats.wins} / ${stats.losses}`, 0, false)}
      </div>

      <!-- Charts Row -->
      <div class="stats-charts-grid">
        <div class="card">
          <div class="card-header"><span class="card-title">Equity Curve</span></div>
          <div class="chart-wrap"><canvas id="stats-equity"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">P&L by Day of Week</span></div>
          <div class="chart-wrap"><canvas id="stats-dow"></canvas></div>
        </div>
      </div>

      <div class="stats-charts-grid">
        <div class="card">
          <div class="card-header"><span class="card-title">P&L by Symbol</span></div>
          <div class="chart-wrap"><canvas id="stats-symbol"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">P&L by Setup</span></div>
          <div class="chart-wrap"><canvas id="stats-setup"></canvas></div>
        </div>
      </div>

      <!-- Symbol breakdown table -->
      <div class="card mt-4">
        <div class="card-header"><span class="card-title">Symbol Breakdown</span></div>
        <div class="table-wrap">
          <table class="trades-table">
            <thead><tr><th>Symbol</th><th>Trades</th><th>Win Rate</th><th>Total P&L</th></tr></thead>
            <tbody>
              ${Object.entries(bySymbol).sort((a,b) => b[1].pnl - a[1].pnl).map(([sym, d]) => `
                <tr>
                  <td><span class="symbol-badge">${sym}</span></td>
                  <td>${d.count}</td>
                  <td>${((d.wins / d.count) * 100).toFixed(0)}%</td>
                  <td class="${pnlClass(d.pnl)}">${formatCurrency(d.pnl, true)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  renderEquityChart(stats.equity);
  renderDowChart(byDow, dow);
  renderSymbolChart(bySymbol);
  renderSetupChart(bySetup);
}

function statRow(label, value, trend, colorize = true) {
  const cls = colorize ? (trend > 0 ? 'pnl-positive' : trend < 0 ? 'pnl-negative' : '') : '';
  return `<div class="card stat-row"><span class="stat-label">${label}</span><span class="stat-val ${cls}">${value}</span></div>`;
}

function renderEquityChart(equity) {
  const canvas = document.getElementById('stats-equity');
  if (!canvas) return;
  const lastVal = equity[equity.length - 1]?.equity || 0;
  const color = lastVal >= 0 ? '#26a69a' : '#ef5350';
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: equity.map(e => e.date),
      datasets: [{ data: equity.map(e => e.equity), borderColor: color, backgroundColor: color + '18', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#888', maxTicksLimit: 6 }, grid: { color: '#ffffff08' } }, y: { ticks: { color: '#888', callback: v => '$' + v }, grid: { color: '#ffffff08' } } } }
  });
}

function renderDowChart(byDow, labels) {
  const canvas = document.getElementById('stats-dow');
  if (!canvas) return;
  const data = byDow.map(d => d.pnl);
  const colors = data.map(v => v >= 0 ? '#26a69a' : '#ef5350');
  new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#888' }, grid: { display: false } }, y: { ticks: { color: '#888', callback: v => '$' + v }, grid: { color: '#ffffff08' } } } }
  });
}

function renderSymbolChart(bySymbol) {
  const canvas = document.getElementById('stats-symbol');
  if (!canvas) return;
  const sorted = Object.entries(bySymbol).sort((a, b) => b[1].pnl - a[1].pnl);
  const labels = sorted.map(([k]) => k);
  const data = sorted.map(([, v]) => v.pnl);
  const colors = data.map(v => v >= 0 ? '#26a69a' : '#ef5350');
  new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#888' }, grid: { display: false } }, y: { ticks: { color: '#888', callback: v => '$' + v }, grid: { color: '#ffffff08' } } } }
  });
}

function renderSetupChart(bySetup) {
  const canvas = document.getElementById('stats-setup');
  if (!canvas) return;
  const sorted = Object.entries(bySetup).sort((a, b) => b[1].pnl - a[1].pnl);
  const labels = sorted.map(([k]) => k);
  const data = sorted.map(([, v]) => v.pnl);
  const colors = data.map(v => v >= 0 ? '#26a69a' : '#ef5350');
  new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#888' }, grid: { display: false } }, y: { ticks: { color: '#888', callback: v => '$' + v }, grid: { color: '#ffffff08' } } } }
  });
}
