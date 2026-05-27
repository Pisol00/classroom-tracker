// === STUDENTS TAB ===

import { state }           from './state.js';
import { resourceAction }  from './api.js';
import { escapeHtml, sortByCode, queueAsync } from './utils.js';

function getStudents() {
  return state.students.filter(s => s.classId === state.currentClassId);
}

// Build a per-student stats map in a single pass over each collection,
// instead of re-scanning attendance/homework/scores for every student row.
// O(students + attendance + homework + scores) instead of O(students × all).
function buildStatsMap(classId) {
  const subjectIdsOfClass = new Set(
    state.subjects.filter(s => s.classId === classId).map(s => s.id)
  );
  const hwIdsOfClass = new Set(
    state.homework.filter(h => subjectIdsOfClass.has(h.subjectId)).map(h => h.id)
  );

  const attTotals = new Map();     // studentId → {present, total}
  for (const a of state.attendance) {
    if (!subjectIdsOfClass.has(a.subjectId)) continue;
    const t = attTotals.get(a.studentId) || { present: 0, total: 0 };
    t.total += 1;
    if (a.status === 'present') t.present += 1;
    attTotals.set(a.studentId, t);
  }

  const hwSubmitted = new Map();   // studentId → submitted count
  for (const hs of state.homeworkScore) {
    if (!hwIdsOfClass.has(hs.homeworkId) || !hs.submitted) continue;
    hwSubmitted.set(hs.studentId, (hwSubmitted.get(hs.studentId) || 0) + 1);
  }

  const totalHw = hwIdsOfClass.size;

  return function statsFor(studentId) {
    const att = attTotals.get(studentId);
    const attPct = att && att.total
      ? Math.round((att.present / att.total) * 100)
      : null;
    const hwPct = totalHw
      ? Math.round(((hwSubmitted.get(studentId) || 0) / totalHw) * 100)
      : null;
    return { attPct, hwPct };
  };
}

export function renderStudents() {
  const tbody = document.getElementById('studentsBody');
  if (!tbody) return;

  const students = getStudents();
  document.getElementById('studentsCount').textContent = `${students.length} คน`;

  if (!state.currentClassId) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <i class="ti ti-school" aria-hidden="true"></i>
        <p>ยังไม่มีห้องเรียน — กด <strong>+ เพิ่มห้อง</strong> ด้านบน หรือ <strong>นำเข้าจาก Excel</strong></p>
      </div>
    </td></tr>`;
    return;
  }

  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <i class="ti ti-users" aria-hidden="true"></i>
        <p>ยังไม่มีนักเรียน — กด <strong>นำเข้าจาก Excel</strong> หรือ <strong>เพิ่มนักเรียน</strong></p>
      </div>
    </td></tr>`;
    return;
  }

  const statsFor = buildStatsMap(state.currentClassId);
  tbody.innerHTML = students
    .sort(sortByCode)
    .map(student => {
      const { attPct, hwPct } = statsFor(student.id);
      return `<tr data-id="${student.id}">
        <td class="td-center">${student.studentNo ?? ''}</td>
        <td class="td-center">
          ${student.studentCode ? escapeHtml(student.studentCode) : '<span class="sal-none">—</span>'}
        </td>
        <td>
          <span class="cell-edit company-name" contenteditable="plaintext-only"
            data-field="name" data-placeholder="ชื่อ-สกุล"
            data-empty="${student.name ? '0' : '1'}">${escapeHtml(student.name)}</span>
        </td>
        <td>
          <span class="cell-date-text">${escapeHtml(displayBirthDate(student.birthDate)) || '<span class="sal-none">—</span>'}</span>
        </td>
        <td class="td-center">${renderGender(student.gender)}</td>
        <td class="td-center">${formatPct(attPct)}</td>
        <td class="td-center">${formatPct(hwPct)}</td>
        <td class="td-center">
          <div class="act-cell">
            <button class="act-btn del" type="button"
              data-action="delete-student"
              aria-label="ลบนักเรียน" title="ลบ">
              <i class="ti ti-trash" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

  bindStudentInlineEdits();
}

function formatPct(pct) {
  if (pct == null) return '<span class="sal-none">—</span>';
  return `<span class="pct${pct >= 80 ? ' pct-good' : pct >= 50 ? ' pct-warn' : ' pct-bad'}">${pct}%</span>`;
}

function renderGender(g) {
  if (g === 'M') return '<span class="gender-tag gender-m">ช</span>';
  if (g === 'F') return '<span class="gender-tag gender-f">ญ</span>';
  return '<span class="sal-none">—</span>';
}

// Birth dates can arrive in three shapes after a roundtrip through Sheets:
//   - "19/12/2561"           ← original text from Excel (keep as-is)
//   - "2560-09-10T17:00:00.000Z"  ← Apps Script serialized a Date cell back to ISO
//   - Date object            ← fresh from Excel before save
// Normalise everything to D/M/YYYY+543 for display.
function displayBirthDate(value) {
  if (!value) return '';
  const str = String(value);
  // Already in Thai display format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) return str;

  // Try parsing ISO/Date
  const d = new Date(str);
  if (!isNaN(d)) {
    const day   = d.getUTCDate();
    const month = d.getUTCMonth() + 1;
    let year    = d.getUTCFullYear();
    // If year is CE (< 2200) → convert to BE; if already BE, leave alone
    if (year < 2200) year += 543;
    return `${day}/${month}/${year}`;
  }
  return str;
}

function bindStudentInlineEdits() {
  document.querySelectorAll('#studentsBody .cell-edit').forEach(el => {
    const id    = Number(el.closest('tr').dataset.id);
    const field = el.dataset.field;

    el.addEventListener('blur', () => {
      const value = el.textContent.trim();
      // Serialize edits — rapid focus changes won't race
      queueAsync(async () => {
        const student = state.students.find(s => s.id === id);
        if (!student || student[field] === value) return;
        await resourceAction('update', 'student', { id, [field]: value });
      });
    });

    el.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); el.textContent = state.students.find(s => s.id === id)?.[field] || ''; el.blur(); }
    });
  });
}
