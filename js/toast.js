// === TOAST ===
// Non-blocking notification — replaces alert() calls

const ICON_MAP = {
  error:   'ti-alert-circle',
  success: 'ti-circle-check',
};

export function showToast(message, type = 'error') {
  const icon = ICON_MAP[type] ?? ICON_MAP.error;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  el.innerHTML = `<i class="ti ${icon}" aria-hidden="true"></i><span>${message}</span>`;
  document.body.appendChild(el);

  // Remove on the second animation (toastOut) ending — tied to CSS, no magic number
  let count = 0;
  el.addEventListener('animationend', () => {
    if (++count >= 2) el.remove();
  });
}
