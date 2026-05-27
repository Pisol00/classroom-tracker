// === UTILS ===
// Small shared helpers

// Backend may return booleans as JS true/false, sheet strings "TRUE"/"true", or 1/0.
// Normalise all of them to a real boolean.
export function isTruthy(value) {
  return value === true
    || value === 1
    || value === 'TRUE'
    || value === 'true';
}

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Guards ──
// Centralize "must have a class/subject selected" checks so the toast message
// is consistent across every action that needs them.
import { state as appState } from './state.js';
import { showToast as _showToast } from './toast.js';

export function requireClass(message = 'กรุณาเลือกห้องก่อน') {
  if (!appState.currentClassId) { _showToast(message); return false; }
  return true;
}

export function requireSubject(message = 'กรุณาเลือกวิชาก่อน') {
  if (!appState.currentSubjectId) { _showToast(message); return false; }
  return true;
}

// Serialize a sequence of async ops by chaining each onto the previous promise.
// Ensures requests fire in order — second await won't run until first resolves.
// Use for inline edits / checkbox toggles where rapid clicks can race.
let _queueTail = Promise.resolve();
export function queueAsync(fn) {
  const next = _queueTail.then(() => fn()).catch(err => {
    console.error('Queued task failed:', err);
  });
  _queueTail = next.catch(() => {}); // never let rejection block the queue
  return next;
}

// Wrap an async action so the triggering button shows a spinner + is disabled
// while it's running. Caller can pass optional loadingLabel for the button.
export async function withLoading(btn, fn, loadingLabel) {
  if (!btn || btn.disabled) return;

  const originalHtml = btn.innerHTML;
  const originalDisabled = btn.disabled;
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${loadingLabel ? `<span>${loadingLabel}</span>` : ''}`;

  try {
    return await fn();
  } finally {
    btn.disabled = originalDisabled;
    btn.classList.remove('is-loading');
    btn.innerHTML = originalHtml;
  }
}

// Sort students by studentCode ascending — students without a code sink to the bottom
export function sortByCode(a, b) {
  const aCode = a.studentCode ? Number(a.studentCode) || a.studentCode : Infinity;
  const bCode = b.studentCode ? Number(b.studentCode) || b.studentCode : Infinity;
  if (aCode === Infinity && bCode === Infinity) return 0;
  if (aCode === Infinity) return 1;
  if (bCode === Infinity) return -1;
  return aCode - bCode;
}
