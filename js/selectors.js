// === SELECTORS ===
// Top-bar class + subject pill selectors (with add/delete buttons)

import { state } from './state.js';

// Pre-render normalization — must be called BEFORE any tab renders so that all
// modules see the same currentClassId / currentSubjectId values. Don't put this
// inside render functions: that creates a side effect during rendering.
export function ensureSelections() {
  if (!state.classes.find(c => c.id === state.currentClassId)) {
    state.currentClassId = state.classes[0]?.id ?? null;
  }
  const subjectsForClass = state.subjects.filter(s => s.classId === state.currentClassId);
  if (!subjectsForClass.find(s => s.id === state.currentSubjectId)) {
    state.currentSubjectId = subjectsForClass[0]?.id ?? null;
  }
}

export function renderSelectors() {
  renderClassSelector();
  renderSubjectSelector();
}

function renderClassSelector() {
  const sel = document.getElementById('classSelector');
  if (!sel) return;

  const pills = state.classes.map(c => `
    <div class="pill-wrap${c.id === state.currentClassId ? ' active' : ''}">
      <button class="pill" type="button" data-class-id="${c.id}">${c.name}</button>
      <button class="pill-del" type="button" data-delete-class="${c.id}" aria-label="ลบห้อง" title="ลบห้อง">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    </div>`).join('');

  sel.innerHTML = pills + `
    <button class="pill-add" type="button" id="btnAddClass" aria-label="เพิ่มห้อง">
      <i class="ti ti-plus" aria-hidden="true"></i>เพิ่มห้อง
    </button>`;
}

function renderSubjectSelector() {
  const sel = document.getElementById('subjectSelector');
  if (!sel) return;

  if (!state.currentClassId) {
    sel.innerHTML = '<span class="pill-empty">เลือกห้องก่อน</span>';
    return;
  }

  const subjects = state.subjects.filter(s => s.classId === state.currentClassId);

  const pills = subjects.map(s => `
    <div class="pill-wrap${s.id === state.currentSubjectId ? ' active' : ''}">
      <button class="pill" type="button" data-subject-id="${s.id}">${s.name}</button>
      <button class="pill-del" type="button" data-delete-subject="${s.id}" aria-label="ลบวิชา" title="ลบวิชา">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    </div>`).join('');

  sel.innerHTML = pills + `
    <button class="pill-add" type="button" id="btnAddSubject" aria-label="เพิ่มวิชา">
      <i class="ti ti-plus" aria-hidden="true"></i>เพิ่มวิชา
    </button>`;
}
