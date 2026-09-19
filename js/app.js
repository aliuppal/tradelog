import { initAuth, signOut } from './auth.js';
import { initRouter } from './router.js';
import { openTradeModal } from './modal.js';

async function boot() {
  await initAuth();

  // Only init router when app shell is visible
  const shell = document.getElementById('app-shell');
  if (!shell.classList.contains('hidden')) {
    initRouter();
    attachGlobalListeners();
  }

  // Watch for auth shell becoming visible
  const observer = new MutationObserver(() => {
    if (!shell.classList.contains('hidden')) {
      initRouter();
      attachGlobalListeners();
      observer.disconnect();
    }
  });
  observer.observe(shell, { attributes: true, attributeFilter: ['class'] });
}

function attachGlobalListeners() {
  // Sign out
  document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    await signOut();
  });

  // Desktop sidebar collapse toggle
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const sidebar = document.getElementById('sidebar');
  const collapseIcon = document.getElementById('sidebar-collapse-icon');

  // Restore saved state
  const savedCollapsed = localStorage.getItem('sidebar-collapsed');
  if (savedCollapsed === 'false') {
    sidebar?.classList.remove('collapsed');
    if (collapseIcon) collapseIcon.className = 'fa-solid fa-chevron-left';
  }

  collapseBtn?.addEventListener('click', () => {
    const isCollapsed = sidebar?.classList.toggle('collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed);
    if (collapseIcon) {
      collapseIcon.className = isCollapsed
        ? 'fa-solid fa-chevron-right'
        : 'fa-solid fa-chevron-left';
    }
  });

  // Mobile sidebar toggle
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
  });

  // Top bar add trade button
  document.getElementById('add-trade-btn-top')?.addEventListener('click', () => {
    openTradeModal();
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (sidebar?.classList.contains('open') && !sidebar.contains(e.target) && !document.getElementById('sidebar-toggle')?.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

boot();
