// === AUTH ===
// Google Sign-In + mock-mode bypass

import { GOOGLE_CLIENT_ID, USE_MOCK } from './config.js';
import { state }                       from './state.js';
import { showToast }                   from './toast.js';
import { loadAll, abortInflightRequests } from './api.js';
import { render }                      from './render.js';
import { escapeHtml }                  from './utils.js';
import { showSkeletons }               from './skeleton.js';

function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes  = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const json   = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function renderUserBadge() {
  const el = document.getElementById('userBadge');
  if (!el) return;

  if (!state.userInfo) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <img src="${escapeHtml(state.userInfo.picture || '')}" alt="" referrerpolicy="no-referrer">
    <span>${escapeHtml(state.userInfo.email || '')}</span>
    <button id="signOutBtn" type="button" title="ออกจากระบบ" aria-label="ออกจากระบบ">
      <i class="ti ti-logout" aria-hidden="true"></i>
    </button>`;

  document.getElementById('signOutBtn').addEventListener('click', signOut);
}

export function signOut() {
  abortInflightRequests();
  state.idToken  = '';
  state.userInfo = null;
  sessionStorage.removeItem('ct_token');
  sessionStorage.removeItem('ct_user');

  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();

  document.getElementById('app').classList.add('app-hidden');
  document.getElementById('loginOverlay').classList.remove('app-hidden');
  // Clear and re-render the Google button — the previous render is stale after logout
  document.getElementById('gisBtn').innerHTML = '';
  initGsi();
  renderUserBadge();
}

export function onCredential(response) {
  const info = decodeJwt(response.credential);
  if (!info) { showToast('ข้อมูลเข้าสู่ระบบไม่ถูกต้อง'); return; }

  state.idToken  = response.credential;
  state.userInfo = { email: info.email, name: info.name, picture: info.picture, exp: info.exp };
  sessionStorage.setItem('ct_token', state.idToken);
  sessionStorage.setItem('ct_user', JSON.stringify(state.userInfo));
  enterApp();
}

export async function enterApp() {
  document.getElementById('loginOverlay').classList.add('app-hidden');
  document.getElementById('app').classList.remove('app-hidden');
  renderUserBadge();

  // Show placeholders immediately so the UI doesn't appear blank during fetch
  showSkeletons();
  await loadAll();
  render();
}

export function initGsi() {
  if (!window.google?.accounts?.id) { setTimeout(initGsi, 200); return; }

  google.accounts.id.initialize({
    client_id:   GOOGLE_CLIENT_ID,
    callback:    onCredential,
    auto_select: false,
  });

  google.accounts.id.renderButton(
    document.getElementById('gisBtn'),
    { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 280 }
  );
}

export function bootstrap() {
  if (USE_MOCK) {
    // Skip Google Sign-In in mock mode for fast local dev
    state.userInfo = state.userInfo || { email: 'demo@local', name: 'ผู้ใช้ทดสอบ', picture: '', exp: 0 };
    enterApp();
    return;
  }

  const valid = state.idToken && state.userInfo && state.userInfo.exp * 1000 > Date.now() + 60_000;
  if (valid) {
    enterApp();
  } else {
    sessionStorage.removeItem('ct_token');
    sessionStorage.removeItem('ct_user');
    state.idToken  = '';
    state.userInfo = null;
    document.getElementById('loginOverlay').classList.remove('app-hidden');
    document.getElementById('app').classList.add('app-hidden');
    initGsi();
  }
}

document.addEventListener('auth:signout', signOut);
