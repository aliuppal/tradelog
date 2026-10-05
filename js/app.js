import { initAuth, signOut } from './auth.js';
import { initRouter, navigateTo, getCurrentPage } from './router.js';
import { openTradeModal } from './modal.js';

async function boot() {
  await initAuth();

  const shell = document.getElementById('app-shell');

  const tryInit = () => {
    if (!shell.classList.contains('hidden')) {
      initRouter();
      attachGlobalListeners();
      return true;
    }
    return false;
  };

  if (!tryInit()) {
    const observer = new MutationObserver(() => {
      if (tryInit()) observer.disconnect();
    });
    observer.observe(shell, { attributes: true, attributeFilter: ['class'] });
  }
}

function attachGlobalListeners() {
  const sidebar = document.getElementById('sidebar');
  const pageContainer = document.getElementById('page-container');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const collapseIcon = document.getElementById('sidebar-collapse-icon');

  // ── Apply sidebar state and sync page-container margin ──────
  function applySidebarState(collapsed) {
    if (collapsed) {
      sidebar?.classList.add('collapsed');
      if (collapseIcon) collapseIcon.className = 'fa-solid fa-chevron-right';
    } else {
      sidebar?.classList.remove('collapsed');
      if (collapseIcon) collapseIcon.className = 'fa-solid fa-chevron-left';
    }
    syncPageMargin(collapsed);
  }

  function syncPageMargin(collapsed) {
    if (!pageContainer) return;
    const w = collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)';
    pageContainer.style.marginLeft = w;
    pageContainer.style.width = `calc(100% - ${w})`;
  }

  // Restore saved state (default: collapsed)
  const saved = localStorage.getItem('sidebar-collapsed');
  const startCollapsed = saved === null ? true : saved === 'true';
  applySidebarState(startCollapsed);

  // Toggle on button click
  collapseBtn?.addEventListener('click', () => {
    const nowCollapsed = !sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebar-collapsed', nowCollapsed);
    applySidebarState(nowCollapsed);
  });

  // ── Nav item tooltips when collapsed ─────────────────────────
  // Add title attributes for collapsed hover tooltips
  document.querySelectorAll('.nav-item').forEach(item => {
    const text = item.querySelector('span')?.textContent;
    if (text) item.setAttribute('title', text);
  });

  // ── Sign out ─────────────────────────────────────────────────
  document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    await signOut();
  });

  // ── Mobile sidebar toggle ─────────────────────────────────────
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
  });

  // ── Top bar / tab bar add trade — re-render the page after saving ──
  const addTrade = () => openTradeModal(null, () => navigateTo(getCurrentPage()));
  document.getElementById('add-trade-btn-top')?.addEventListener('click', addTrade);
  document.getElementById('tab-add-trade')?.addEventListener('click', addTrade);

  // ── Close sidebar on outside click (mobile) ───────────────────
  document.addEventListener('click', (e) => {
    if (sidebar?.classList.contains('open')
      && !sidebar.contains(e.target)
      && !document.getElementById('sidebar-toggle')?.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// ── Installable app (PWA) ──────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW registration failed', err));
  });
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  document.getElementById('install-btn')?.classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  document.getElementById('install-btn')?.classList.add('hidden');
});
document.getElementById('install-btn')?.addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  document.getElementById('install-btn')?.classList.add('hidden');
});

boot();
