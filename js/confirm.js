// === CONFIRM ===
// Promise-based confirm modal — replaces native confirm()
//
// Usage:
//   const ok = await showConfirm({
//     title:   'ลบห้องเรียน',
//     message: 'ลบห้อง "ม.4/1" และข้อมูลทั้งหมด?',
//     okLabel: 'ลบ',
//     variant: 'danger',
//   });

let resolveCurrent = null;

export function showConfirm({
  title    = 'ยืนยันการทำรายการ',
  message  = '',
  okLabel  = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  variant  = 'danger',   // 'danger' | 'primary'
  icon     = 'ti-alert-triangle',
} = {}) {
  return new Promise(resolve => {
    resolveCurrent = resolve;

    document.getElementById('confirmModalTitle').textContent   = title;
    document.getElementById('confirmModalMessage').textContent = message;
    document.getElementById('confirmModalCancel').textContent  = cancelLabel;

    const iconEl = document.getElementById('confirmModalIcon');
    iconEl.innerHTML = `<i class="ti ${icon}" aria-hidden="true"></i>`;
    iconEl.className = `confirm-icon confirm-icon--${variant}`;

    const okBtn = document.getElementById('confirmModalOk');
    okBtn.textContent = okLabel;
    okBtn.className   = variant === 'danger' ? 'btn-danger' : 'btn-primary';

    document.getElementById('confirmModal').classList.add('open');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => okBtn.focus());
  });
}

function close(result) {
  document.getElementById('confirmModal').classList.remove('open');
  document.body.classList.remove('modal-open');
  if (resolveCurrent) {
    resolveCurrent(result);
    resolveCurrent = null;
  }
}

// Wire static listeners once (module loads after DOM in <script type="module">)
function wireConfirmListeners() {
  document.getElementById('confirmModalOk')?.addEventListener('click', () => close(true));
  document.getElementById('confirmModalCancel')?.addEventListener('click', () => close(false));
  document.getElementById('confirmModalCloseX')?.addEventListener('click', () => close(false));

  // Click backdrop closes
  document.getElementById('confirmModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) close(false);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireConfirmListeners);
} else {
  wireConfirmListeners();
}

// Esc on confirm modal → resolve(false). Must run before the global modal-closer
// so the promise is settled, not just the DOM closed.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const modal = document.getElementById('confirmModal');
  if (modal?.classList.contains('open')) close(false);
}, true);
