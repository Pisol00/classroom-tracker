// === ATTENDANCE TAB ===

import { state }                              from './state.js';
import { ATTENDANCE_STATUSES, ATTENDANCE_META } from './config.js';
import { resourceAction }                     from './api.js';
import { escapeHtml, sortByCode, queueAsync } from './utils.js';
import { openCal }                            from './calendar.js';
import { fmtDisplay }                         from './date.js';

function getStudents() {
  return state.students.filter(s => s.classId === state.currentClassId);
}

function getStatus(studentId) {
  const row = state.attendance.find(a =>
    a.subjectId === state.currentSubjectId
    && a.date      === state.currentDate
    && a.studentId === studentId);
  return row?.status || '';
}

export function renderAttendance() {
  const tbody = document.getElementById('attendanceBody');
  if (!tbody) return;

  // Date display
  const dateBtn = document.getElementById('attendanceDateBtn');
  if (dateBtn) dateBtn.textContent = fmtDisplay(state.currentDate);

  const students = getStudents();
  if (!state.currentSubjectId) {
    tbody.innerHTML = emptyRow('เลือกวิชาก่อนเช็คชื่อ');
    renderAttendanceStats(students, []);
    return;
  }

  if (!students.length) {
    tbody.innerHTML = emptyRow('ห้องนี้ยังไม่มีนักเรียน');
    renderAttendanceStats([], []);
    return;
  }

  tbody.innerHTML = students
    .sort(sortByCode)
    .map(student => {
      const status = getStatus(student.id);
      return `<tr data-id="${student.id}">
        <td class="td-center">${student.studentNo ?? ''}</td>
        <td class="td-center muted">${escapeHtml(student.studentCode || '')}</td>
        <td>
          <span class="company-name">${escapeHtml(student.name)}</span>
        </td>
        <td>
          <div class="att-radio" data-student-id="${student.id}">
            ${ATTENDANCE_STATUSES.map(s => {
              const meta = ATTENDANCE_META[s];
              return `<button type="button" class="att-btn ${meta.cls}${status === s ? ' selected' : ''}" data-status="${s}">
                <i class="ti ${meta.icon}" aria-hidden="true"></i>${meta.label}
              </button>`;
            }).join('')}
          </div>
        </td>
      </tr>`;
    }).join('');

  renderAttendanceStats(students, todayAttendance());
}

function todayAttendance() {
  return state.attendance.filter(a =>
    a.subjectId === state.currentSubjectId && a.date === state.currentDate);
}

function renderAttendanceStats(students, att) {
  const el = document.getElementById('attendanceStats');
  if (!el) return;
  const present = att.filter(a => a.status === 'present').length;
  const absent  = att.filter(a => a.status === 'absent').length;
  const sick    = att.filter(a => a.status === 'sick').length;
  const unset   = students.length - present - absent - sick;

  el.innerHTML = `
    <span class="stat-pill"><span class="dot" style="background:#639922"></span>มา <b>${present}</b></span>
    <span class="stat-pill"><span class="dot" style="background:#E24B4A"></span>ขาด <b>${absent}</b></span>
    <span class="stat-pill"><span class="dot" style="background:#EF9F27"></span>ป่วย <b>${sick}</b></span>
    <span class="stat-pill muted"><span class="dot" style="background:#9c9588"></span>ยังไม่ระบุ <b>${unset}</b></span>`;
}

function emptyRow(text) {
  return `<tr><td colspan="4">
    <div class="empty-state">
      <i class="ti ti-calendar-x" aria-hidden="true"></i><p>${text}</p>
    </div>
  </td></tr>`;
}

export function setAttendance(studentId, status) {
  if (!state.currentSubjectId) return;
  // Serialize via queueAsync so rapid clicks don't race — each lookup uses
  // the latest state.attendance after the previous request completed.
  return queueAsync(async () => {
    const existing = state.attendance.find(a =>
      a.subjectId === state.currentSubjectId
      && a.date      === state.currentDate
      && a.studentId === studentId);

    if (existing) {
      if (existing.status === status) return;
      await resourceAction('update', 'attendance', { id: existing.id, status });
    } else {
      const row = { subjectId: state.currentSubjectId, date: state.currentDate, studentId, status };
      await resourceAction('add', 'attendance', row);
    }
  });
}

export async function markAllPresent() {
  const students = getStudents();
  const payload = students.map(s => ({
    subjectId: state.currentSubjectId,
    date:      state.currentDate,
    studentId: s.id,
    status:    'present',
  }));
  await resourceAction('bulkSet', 'attendance', payload);
}

export function openAttendanceDatePicker(anchor) {
  openCal(anchor, state.currentDate, iso => {
    if (!iso) return;
    state.currentDate = iso;
    renderAttendance();
  });
}
