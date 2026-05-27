// === CALENDAR ===
// Custom date picker popup (no native <input type="date"> — for consistent cross-browser UI)

import { MONTHS, DOWS }      from './config.js';
import { parseISO, toISO, sameDay } from './date.js';

let calState = null;

function calOutside(e) {
  if (!e.target.closest('.cal-pop') && !(calState && calState.anchor.contains(e.target))) {
    closeCal();
  }
}

function buildCal() {
  if (!calState) return;

  const { view, selected, pop } = calState;
  const year  = view.getFullYear();
  const month = view.getMonth();

  const firstDay    = new Date(year, month, 1);
  const startDow    = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysPrev    = new Date(year, month, 0).getDate();
  const today       = new Date();

  const cells = [];

  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ d: daysPrev - i, muted: true, date: new Date(year, month - 1, daysPrev - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ d: i, muted: false, date: new Date(year, month, i) });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const d = cells.length - (startDow + daysInMonth) + 1;
    cells.push({ d, muted: true, date: new Date(year, month + 1, d) });
  }

  pop.innerHTML = `
    <div class="cal-head">
      <div class="cal-title">${MONTHS[month]} ${year}</div>
      <div class="cal-nav">
        <button type="button" class="cal-btn" data-nav="-1" aria-label="เดือนก่อนหน้า">‹</button>
        <button type="button" class="cal-btn" data-nav="1"  aria-label="เดือนถัดไป">›</button>
      </div>
    </div>
    <div class="cal-grid">
      ${DOWS.map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.map(cell => {
        const isSelected = selected && sameDay(cell.date, selected);
        const isToday    = sameDay(cell.date, today);
        const classes    = ['cal-day'];
        if (cell.muted)  classes.push('muted');
        if (isToday)     classes.push('today');
        if (isSelected)  classes.push('selected');
        return `<button type="button" class="${classes.join(' ')}" data-iso="${toISO(cell.date)}">${cell.d}</button>`;
      }).join('')}
    </div>
    <div class="cal-foot">
      <button type="button" data-action="today">วันนี้</button>
      <button type="button" data-action="clear">ล้าง</button>
    </div>`;

  pop.querySelectorAll('.cal-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      calState.view = new Date(year, month + Number(btn.dataset.nav), 1);
      buildCal();
    });
  });

  pop.querySelectorAll('.cal-day').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      calState.onPick(btn.dataset.iso);
      closeCal();
    });
  });

  pop.querySelector('[data-action="today"]').addEventListener('click', e => {
    e.stopPropagation();
    calState.onPick(toISO(today));
    closeCal();
  });

  pop.querySelector('[data-action="clear"]').addEventListener('click', e => {
    e.stopPropagation();
    calState.onPick('');
    closeCal();
  });
}

export function closeCal() {
  document.querySelector('.cal-pop')?.remove();
  calState = null;
  document.removeEventListener('click', calOutside);
}

export function openCal(anchor, currentISO, onPick) {
  closeCal();

  const pop = document.createElement('div');
  pop.className = 'cal-pop';
  document.body.appendChild(pop);

  const selected = parseISO(currentISO);
  calState = { anchor, view: selected || new Date(), selected, pop, onPick };
  buildCal();

  const rect = anchor.getBoundingClientRect();
  const popW = 280;
  let left   = rect.left + window.scrollX;
  const top  = rect.bottom + window.scrollY + 6;

  if (left + popW > window.innerWidth - 12) {
    left = window.innerWidth - popW - 12;
  }

  pop.style.left = `${left}px`;
  pop.style.top  = `${top}px`;

  requestAnimationFrame(() => document.addEventListener('click', calOutside));
}
