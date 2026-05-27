// === DATE ===
// Single source of truth for date conversions
//
// Two formats in use:
//   - ISO    "YYYY-MM-DD"  — used for storage, calendar internals, <input type="date">
//   - Display "D/M/YYYY"    — used in API payloads and rendered cells

const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function parseISO(str) {
  if (!str) return null;
  const parts = String(str).split('-');
  if (parts.length !== 3) return null;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

export function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function sameDay(a, b) {
  return !!(a && b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth()    === b.getMonth()
    && a.getDate()     === b.getDate());
}

// "YYYY-MM-DD" → "D/M/YYYY"
export function isoToDisplay(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  return parts.length === 3
    ? `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`
    : iso;
}

// "D/M/YYYY" → "YYYY-MM-DD"
export function displayToIso(display) {
  if (!display) return '';
  if (String(display).includes('-')) return display;
  const parts = String(display).split('/');
  return parts.length === 3
    ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    : display;
}

// "YYYY-MM-DD" → "D เดือน YYYY" (เช่น "5 มี.ค. 2026")
export function fmtDisplay(iso) {
  const date = parseISO(iso);
  if (!date) return 'เลือกวันที่';
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}
