import { supabase } from './config.js';
import { showToast } from './utils.js';

// ─── Auth State ─────────────────────────────────────────────
let currentUser = null;

export function getUser() { return currentUser; }

// ─── Boot: listen to auth changes ───────────────────────────
export async function initAuth() {
  // Supabase automatically parses #access_token from the URL hash
  // when detectSessionInUrl:true is set in config.
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user ?? null;
  renderAuthGate(!currentUser);
  if (currentUser) {
    populateUserUI(currentUser);
    // Clean the token hash from the URL bar after Google redirect
    if (window.location.hash.includes('access_token')) {
      history.replaceState(null, '', window.location.pathname);
    }
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    renderAuthGate(!currentUser);
    if (currentUser) {
      populateUserUI(currentUser);
      if (window.location.hash.includes('access_token')) {
        history.replaceState(null, '', window.location.pathname);
      }
    }
  });
}

// ─── Show / hide auth gate vs app ───────────────────────────
function renderAuthGate(show) {
  const gate = document.getElementById('auth-gate');
  const shell = document.getElementById('app-shell');
  if (show) {
    gate.classList.remove('hidden');
    shell.classList.add('hidden');
    mountAuthUI();
  } else {
    gate.classList.add('hidden');
    shell.classList.remove('hidden');
  }
}

// ─── Mount auth UI into #auth-gate ──────────────────────────
let authMode = 'login'; // 'login' | 'signup' | 'forgot'

function mountAuthUI() {
  const gate = document.getElementById('auth-gate');
  gate.innerHTML = buildAuthHTML();
  attachAuthListeners();
}

function buildAuthHTML() {
  if (authMode === 'login') return loginHTML();
  if (authMode === 'signup') return signupHTML();
  return forgotHTML();
}

function loginHTML() {
  return `
  <div class="auth-bg">
    <div class="auth-card">
      <div class="auth-logo">
        <i class="fa-solid fa-chart-candlestick"></i>
        <span>TradeLog</span>
      </div>
      <h2 class="auth-title">Welcome back</h2>
      <p class="auth-sub">Sign in to your trading journal</p>

      <button class="btn-google" id="google-signin">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
        Continue with Google
      </button>

      <div class="auth-divider"><span>or</span></div>

      <form id="auth-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="auth-email" placeholder="trader@example.com" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <div class="input-eye">
            <input type="password" id="auth-password" placeholder="••••••••" required />
            <button type="button" class="eye-btn" id="toggle-pw"><i class="fa-solid fa-eye"></i></button>
          </div>
        </div>
        <div class="auth-row">
          <label class="checkbox-label">
            <input type="checkbox" id="remember-me" /> Remember me
          </label>
          <button type="button" class="link-btn" id="go-forgot">Forgot password?</button>
        </div>
        <button type="submit" class="btn-primary btn-full" id="auth-submit">
          <span id="auth-submit-text">Sign In</span>
          <span class="spinner hidden" id="auth-spinner"></span>
        </button>
      </form>

      <p class="auth-switch">Don't have an account? <button type="button" class="link-btn" id="go-signup">Sign up free</button></p>
    </div>
  </div>`;
}

function signupHTML() {
  return `
  <div class="auth-bg">
    <div class="auth-card">
      <div class="auth-logo">
        <i class="fa-solid fa-chart-candlestick"></i>
        <span>TradeLog</span>
      </div>
      <h2 class="auth-title">Create account</h2>
      <p class="auth-sub">Start tracking your trades today</p>

      <button class="btn-google" id="google-signin">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
        Continue with Google
      </button>

      <div class="auth-divider"><span>or</span></div>

      <form id="auth-form">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="auth-name" placeholder="John Trader" required />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="auth-email" placeholder="trader@example.com" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <div class="input-eye">
            <input type="password" id="auth-password" placeholder="Min 8 characters" required minlength="8" />
            <button type="button" class="eye-btn" id="toggle-pw"><i class="fa-solid fa-eye"></i></button>
          </div>
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input type="password" id="auth-confirm" placeholder="••••••••" required />
        </div>
        <button type="submit" class="btn-primary btn-full" id="auth-submit">
          <span id="auth-submit-text">Create Account</span>
          <span class="spinner hidden" id="auth-spinner"></span>
        </button>
      </form>

      <p class="auth-switch">Already have an account? <button type="button" class="link-btn" id="go-login">Sign in</button></p>
    </div>
  </div>`;
}

function forgotHTML() {
  return `
  <div class="auth-bg">
    <div class="auth-card">
      <div class="auth-logo">
        <i class="fa-solid fa-chart-candlestick"></i>
        <span>TradeLog</span>
      </div>
      <h2 class="auth-title">Reset password</h2>
      <p class="auth-sub">We'll send a reset link to your email</p>

      <form id="auth-form">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="auth-email" placeholder="trader@example.com" required />
        </div>
        <button type="submit" class="btn-primary btn-full" id="auth-submit">
          <span id="auth-submit-text">Send Reset Link</span>
          <span class="spinner hidden" id="auth-spinner"></span>
        </button>
      </form>

      <p class="auth-switch"><button type="button" class="link-btn" id="go-login">← Back to Sign In</button></p>
    </div>
  </div>`;
}

// ─── Attach listeners ────────────────────────────────────────
function attachAuthListeners() {
  document.getElementById('google-signin')?.addEventListener('click', signInWithGoogle);
  document.getElementById('auth-form')?.addEventListener('submit', handleFormSubmit);
  document.getElementById('go-signup')?.addEventListener('click', () => { authMode = 'signup'; mountAuthUI(); });
  document.getElementById('go-login')?.addEventListener('click', () => { authMode = 'login'; mountAuthUI(); });
  document.getElementById('go-forgot')?.addEventListener('click', () => { authMode = 'forgot'; mountAuthUI(); });
  document.getElementById('toggle-pw')?.addEventListener('click', () => {
    const pw = document.getElementById('auth-password');
    const icon = document.querySelector('#toggle-pw i');
    if (pw.type === 'password') { pw.type = 'text'; icon.className = 'fa-solid fa-eye-slash'; }
    else { pw.type = 'password'; icon.className = 'fa-solid fa-eye'; }
  });
}

// ─── Google OAuth ────────────────────────────────────────────
async function signInWithGoogle() {
  // Use the current page URL as the redirect target so it works
  // on any host (localhost, GitHub Pages, custom domain, etc.)
  const redirectTo = window.location.href.split('#')[0].split('?')[0];
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) showToast(error.message, 'error');
}

// ─── Form submit handler ─────────────────────────────────────
async function handleFormSubmit(e) {
  e.preventDefault();
  setLoading(true);

  const email = document.getElementById('auth-email')?.value.trim();
  const password = document.getElementById('auth-password')?.value;

  try {
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showToast('Welcome back!', 'success');

    } else if (authMode === 'signup') {
      const confirm = document.getElementById('auth-confirm')?.value;
      const name = document.getElementById('auth-name')?.value.trim();
      if (password !== confirm) throw new Error('Passwords do not match');
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
      showToast('Account created! Check your email to confirm.', 'success');

    } else if (authMode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/trading-journal/?reset=true',
      });
      if (error) throw error;
      showToast('Reset link sent! Check your inbox.', 'success');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  const btn = document.getElementById('auth-submit');
  const text = document.getElementById('auth-submit-text');
  const spinner = document.getElementById('auth-spinner');
  if (!btn) return;
  btn.disabled = loading;
  text?.classList.toggle('hidden', loading);
  spinner?.classList.toggle('hidden', !loading);
}

// ─── Sign out ────────────────────────────────────────────────
export async function signOut() {
  await supabase.auth.signOut();
  authMode = 'login';
  showToast('Signed out successfully', 'success');
}

// ─── Populate user UI ────────────────────────────────────────
function populateUserUI(user) {
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader';
  const email = user.email || '';
  const avatarLetter = name.charAt(0).toUpperCase();
  const avatarUrl = user.user_metadata?.avatar_url;

  const nameEl = document.getElementById('user-name');
  const emailEl = document.getElementById('user-email');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;
  if (avatarEl) {
    if (avatarUrl) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="avatar" />`;
    } else {
      avatarEl.textContent = avatarLetter;
    }
  }
}
