// === HOMEWORK TAB ===

import { state }           from './state.js';
import { resourceAction }  from './api.js';
import { escapeHtml, sortByCode, queueAsync } from './utils.js';
import { isoToDisplay }    from './date.js';

function getStudents() {
  return state.students.filter(s => s.classId === state.currentClassId);
}

function getHomework() {
  return state.homework
    .filter(h => h.subjectId === state.currentSubjectId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function renderHomework() {
  const list = document.getElementById('homeworkList');
  if (!list) return;

  if (!state.currentSubjectId) {
    list.innerHTML = `<div class="empty-state">
      <i class="ti ti-notebook-off" aria-hidden="true"></i>
      <p>เลือกวิชาก่อนจัดการการบ้าน</p>
    </div>`;
    document.getElementById('homeworkScoreSection').classList.add('hidden');
    return;
  }

  const homework = getHomework();

  if (!homework.length) {
    list.innerHTML = `<div class="empty-state">
      <i class="ti ti-notebook" aria-hidden="true"></i>
      <p>ยังไม่มีการบ้าน — กด <strong>เพิ่มการบ้าน</strong></p>
    </div>`;
    document.getElementById('homeworkScoreSection').classList.add('hidden');
    return;
  }

  list.innerHTML = homework.map(hw => `
    <button class="hw-card${state.selectedHomeworkId === hw.id ? ' selected' : ''}"
      type="button" data-hw-id="${hw.id}">
      <div class="hw-title">${escapeHtml(hw.title)}</div>
      <div class="hw-meta">
        <span><i class="ti ti-calendar" aria-hidden="true"></i>${isoToDisplay(hw.date)}</span>
        <span><i class="ti ti-star" aria-hidden="true"></i>เต็ม ${hw.maxScore}</span>
      </div>
    </button>`).join('');

  if (state.selectedHomeworkId && homework.find(h => h.id === state.selectedHomeworkId)) {
    renderHomeworkScores();
  } else {
    document.getElementById('homeworkScoreSection').classList.add('hidden');
  }
}

function renderHomeworkScores() {
  const section = document.getElementById('homeworkScoreSection');
  const tbody   = document.getElementById('homeworkScoreBody');
  if (!section || !tbody) return;

  const hw = state.homework.find(h => h.id === state.selectedHomeworkId);
  if (!hw) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  document.getElementById('homeworkScoreTitle').textContent =
    `${hw.title} — ${isoToDisplay(hw.date)} (เต็ม ${hw.maxScore})`;

  const students = getStudents().sort(sortByCode);

  tbody.innerHTML = students.map(student => {
    const score = state.homeworkScore.find(s =>
      s.homeworkId === hw.id && s.studentId === student.id);
    const submitted = !!score?.submitted;
    const points    = score?.score ?? '';

    return `<tr data-student-id="${student.id}">
      <td class="td-center">${student.studentNo ?? ''}</td>
      <td class="td-center muted">${escapeHtml(student.studentCode || '')}</td>
      <td><span class="company-name">${escapeHtml(student.name)}</span></td>
      <td class="td-center">
        <input type="checkbox" class="chk" ${submitted ? 'checked' : ''} data-field="submitted" aria-label="ส่งงาน">
      </td>
      <td class="td-center">
        <input type="number" class="score-input" data-field="score" value="${points}" min="0" max="${hw.maxScore}" inputmode="numeric">
        <span class="score-max">/ ${hw.maxScore}</span>
      </td>
    </tr>`;
  }).join('');
}

export function setHomeworkField(studentId, field, value) {
  const hwId = state.selectedHomeworkId;
  if (!hwId) return;
  // Serialize so rapid typing in score fields can't interleave requests.
  return queueAsync(async () => {
    const existing = state.homeworkScore.find(s =>
      s.homeworkId === hwId && s.studentId === studentId);

    if (existing) {
      if (existing[field] === value) return;
      await resourceAction('update', 'homeworkScore', { id: existing.id, [field]: value });
    } else {
      const row = {
        homeworkId: hwId,
        studentId,
        submitted: field === 'submitted' ? value : false,
        score:     field === 'score'     ? value : 0,
      };
      await resourceAction('add', 'homeworkScore', row);
    }
  });
}

export async function createHomework({ title, date, maxScore }) {
  const payload = { subjectId: state.currentSubjectId, title, date, maxScore };
  return resourceAction('add', 'homework', payload);
}

export async function deleteHomework(id) {
  return resourceAction('delete', 'homework', { id });
}
