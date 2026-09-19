import { renderDashboard } from './pages/dashboard.js';
import { renderCalendar } from './pages/calendar.js';
import { renderTrades } from './pages/trades.js';
import { renderStats } from './pages/stats.js';
import { renderJournal } from './pages/journal.js';

const pages = {
  dashboard: { title: 'Dashboard', render: renderDashboard },
  calendar:  { title: 'PNL Calendar', render: renderCalendar },
  trades:    { title: 'Trade Log', render: renderTrades },
  stats:     { title: 'Statistics', render: renderStats },
  journal:   { title: 'Journal Notes', render: renderJournal },
};

let currentPage = 'dashboard';

export function initRouter() {
  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page);
    });
  });

  // Hash-based routing on load
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(pages[hash] ? hash : 'dashboard');
}

export function navigateTo(page) {
  if (!pages[page]) page = 'dashboard';
  currentPage = page;
  window.location.hash = page;

  // Update active nav
  document.querySelectorAll('.nav-item').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });

  // Update topbar title
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = pages[page].title;

  // Render page
  const container = document.getElementById('page-container');
  if (container) {
    container.innerHTML = '<div class="page-loading"><span class="spinner"></span></div>';
    setTimeout(() => pages[page].render(container), 50);
  }

  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
}

export function getCurrentPage() { return currentPage; }
