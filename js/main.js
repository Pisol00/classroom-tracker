// === MAIN ===
// Entry point — wires events, bootstraps app

import { bootstrap }                       from './auth.js';
import { render }                          from './render.js';
import { showPanel }                       from './tabs.js';
import { state }                           from './state.js';
import { resourceAction }                  from './api.js';
import { showToast }                       from './toast.js';
import {
  openImportPicker, handleFile, closeImportModal, confirmImport, downloadTemplate,
} from './import.js';
import {
  setAttendance, markAllPresent, openAttendanceDatePicker,
} from './attendance.js';
import {
  setHomeworkField, createHomework, deleteHomework,
} from './homework.js';
import { fmtDisplay } from './date.js';
import { openCal, closeCal } from './calendar.js';
import { showConfirm } from './confirm.js';
import { withLoading, requireClass, requireSubject } from './utils.js';

// ── Static event listeners ──

function wireStaticListeners() {
  // Tabs
  document.getElementById('tabsNav').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (btn) showPanel(btn.dataset.tab);
  });

  // Class selector — handle pick / delete / add
  document.getElementById('classSelector').addEventListener('click', async e => {
    if (e.target.closest('#btnAddClass')) {
      openClassModal();
      return;
    }
    const delBtn = e.target.closest('[data-delete-class]');
    if (delBtn) {
      e.stopPropagation();
      const id  = Number(delBtn.dataset.deleteClass);
      const cls = state.classes.find(c => c.id === id);
      const ok = await showConfirm({
        title:   'ลบห้องเรียน',
        message: `ลบห้อง "${cls?.name}" และข้อมูลทั้งหมดในห้องนี้ (วิชา นักเรียน การเช็คชื่อ การบ้าน) จะถูกลบไปด้วย`,
        okLabel: 'ลบห้อง',
        variant: 'danger',
      });
      if (!ok) return;
      await resourceAction('delete', 'class', { id });
      if (state.currentClassId === id) state.currentClassId = null;
      render();
      return;
    }
    const btn = e.target.closest('[data-class-id]');
    if (!btn) return;
    state.currentClassId   = Number(btn.dataset.classId);
    state.currentSubjectId = null;
    state.selectedHomeworkId = null;
    render();
  });

  // Subject selector — handle pick / delete / add
  document.getElementById('subjectSelector').addEventListener('click', async e => {
    if (e.target.closest('#btnAddSubject')) {
      if (!requireClass()) return;
      openSubjectModal();
      return;
    }
    const delBtn = e.target.closest('[data-delete-subject]');
    if (delBtn) {
      e.stopPropagation();
      const id  = Number(delBtn.dataset.deleteSubject);
      const sub = state.subjects.find(s => s.id === id);
      const ok = await showConfirm({
        title:   'ลบวิชา',
        message: `ลบวิชา "${sub?.name}" และข้อมูลที่เกี่ยวข้อง (การเช็คชื่อ การบ้าน คะแนน) จะถูกลบไปด้วย`,
        okLabel: 'ลบวิชา',
        variant: 'danger',
      });
      if (!ok) return;
      await resourceAction('delete', 'subject', { id });
      if (state.currentSubjectId === id) state.currentSubjectId = null;
      render();
      return;
    }
    const btn = e.target.closest('[data-subject-id]');
    if (!btn) return;
    state.currentSubjectId = Number(btn.dataset.subjectId);
    state.selectedHomeworkId = null;
    render();
  });

  // Class modal
  document.getElementById('classModalCloseX').addEventListener('click', closeClassModal);
  document.getElementById('classModalCancel').addEventListener('click', closeClassModal);
  document.getElementById('classModalSave').addEventListener('click', handleClassSave);
  document.getElementById('class_name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleClassSave();
  });

  // Subject modal
  document.getElementById('subjectModalCloseX').addEventListener('click', closeSubjectModal);
  document.getElementById('subjectModalCancel').addEventListener('click', closeSubjectModal);
  document.getElementById('subjectModalSave').addEventListener('click', handleSubjectSave);
  document.getElementById('subject_name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSubjectSave();
  });

  // ── Students tab ──
  document.getElementById('btnAddStudent').addEventListener('click', async e => {
    if (!requireClass()) return;
    await withLoading(e.currentTarget, async () => {
      const nextNo = Math.max(0, ...state.students.filter(s => s.classId === state.currentClassId).map(s => s.studentNo || 0)) + 1;
      await resourceAction('add', 'student', {
        classId: state.currentClassId,
        studentNo: nextNo,
        studentCode: '',
        name: 'นักเรียนใหม่',
        birthDate: '',
        gender: '',
      });
      render();
    }, 'กำลังเพิ่ม...');
  });

  document.getElementById('btnDeleteAllStudents').addEventListener('click', async e => {
    // Capture the button NOW — e.currentTarget becomes null after the first await
    const btn = e.currentTarget;
    if (!requireClass()) return;
    const students = state.students.filter(s => s.classId === state.currentClassId);
    if (!students.length) { showToast('ห้องนี้ไม่มีนักเรียน'); return; }

    const cls = state.classes.find(c => c.id === state.currentClassId);
    const ok = await showConfirm({
      title:   'ลบนักเรียนทั้งหมด',
      message: `ลบนักเรียนทั้ง ${students.length} คนในห้อง "${cls?.name}"? การเช็คชื่อและคะแนนการบ้านของทุกคนจะถูกลบไปด้วย`,
      okLabel: `ลบทั้งหมด (${students.length} คน)`,
      variant: 'danger',
    });
    if (!ok) return;

    await withLoading(btn, async () => {
      const success = await resourceAction('bulkDelete', 'student', students.map(s => s.id));
      if (success) {
        showToast(`ลบนักเรียน ${students.length} คนสำเร็จ`, 'success');
        render();
      }
    }, 'กำลังลบ...');
  });

  document.getElementById('btnImport').addEventListener('click', openImportPicker);
  document.getElementById('importFileInput').addEventListener('change', e => {
    handleFile(e.target.files[0]);
  });
  document.getElementById('importCancel').addEventListener('click', closeImportModal);
  document.getElementById('importCancel2').addEventListener('click', closeImportModal);
  document.getElementById('importConfirmBtn').addEventListener('click', async e => {
    await withLoading(e.currentTarget, async () => {
      await confirmImport();
      render();
    }, 'กำลังนำเข้า...');
  });
  document.getElementById('importTemplate').addEventListener('click', downloadTemplate);

  // Students delete delegation
  document.getElementById('studentsBody').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action="delete-student"]');
    if (!btn) return;
    const id = Number(btn.closest('tr').dataset.id);
    const stu = state.students.find(s => s.id === id);
    const ok = await showConfirm({
      title:   'ลบนักเรียน',
      message: `ลบ "${stu?.name || 'นักเรียนคนนี้'}" ออกจากห้อง? ข้อมูลการเช็คชื่อและคะแนนการบ้านจะถูกลบไปด้วย`,
      okLabel: 'ลบ',
      variant: 'danger',
    });
    if (!ok) return;
    await resourceAction('delete', 'student', { id });
    render();
  });

  // ── Attendance tab ──
  document.getElementById('attendanceDateBtn').addEventListener('click', e => {
    e.stopPropagation();
    openAttendanceDatePicker(e.currentTarget);
  });

  document.getElementById('btnMarkAllPresent').addEventListener('click', async e => {
    const btn = e.currentTarget;   // capture before await — currentTarget nulls out after
    if (!requireSubject()) return;
    const ok = await showConfirm({
      title:   'ทำเครื่องหมายมาทุกคน',
      message: 'จะตั้งสถานะ "มา" ให้นักเรียนทุกคนสำหรับวันนี้ (ทับข้อมูลเดิม)',
      okLabel: 'ยืนยัน',
      variant: 'primary',
      icon:    'ti-checks',
    });
    if (!ok) return;
    await withLoading(btn, async () => {
      await markAllPresent();
      render();
    }, 'กำลังบันทึก...');
  });

  document.getElementById('attendanceBody').addEventListener('click', async e => {
    const btn = e.target.closest('.att-btn[data-status]');
    if (!btn) return;
    const studentId = Number(btn.closest('[data-student-id]').dataset.studentId);
    await setAttendance(studentId, btn.dataset.status);
    render();
  });

  // ── Homework tab ──
  document.getElementById('btnAddHomework').addEventListener('click', () => {
    openHomeworkModal();
  });

  document.getElementById('homeworkList').addEventListener('click', e => {
    const card = e.target.closest('[data-hw-id]');
    if (!card) return;
    state.selectedHomeworkId = Number(card.dataset.hwId);
    render();
  });

  // Homework score table delegation
  document.getElementById('homeworkScoreBody').addEventListener('change', async e => {
    const input = e.target.closest('[data-field]');
    if (!input) return;
    const studentId = Number(input.closest('[data-student-id]').dataset.studentId);
    const field     = input.dataset.field;
    const value     = field === 'submitted' ? input.checked : Number(input.value) || 0;
    await setHomeworkField(studentId, field, value);
    render();
  });

  document.getElementById('btnDeleteHomework').addEventListener('click', async () => {
    const id = state.selectedHomeworkId;
    if (!id) return;
    const hw = state.homework.find(h => h.id === id);
    const ok = await showConfirm({
      title:   'ลบการบ้าน',
      message: `ลบ "${hw?.title || 'การบ้านนี้'}" และคะแนนของนักเรียนทุกคน?`,
      okLabel: 'ลบ',
      variant: 'danger',
    });
    if (!ok) return;
    await deleteHomework(id);
    state.selectedHomeworkId = null;
    render();
  });

  // Homework modal
  document.getElementById('hwModalCancel').addEventListener('click', closeHomeworkModal);
  document.getElementById('hwModalCancelX').addEventListener('click', closeHomeworkModal);
  document.getElementById('hwModalSave').addEventListener('click', handleHomeworkSave);
  document.getElementById('hw_date_btn').addEventListener('click', e => {
    e.stopPropagation();
    openCal(e.currentTarget, document.getElementById('hw_date').value, iso => setHwDate(iso));
  });

  // Esc closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
      document.body.classList.remove('modal-open');
    });
  });
}

// ── Modal lifecycle helpers (focus management) ──
// Remember which element opened a modal so we can restore focus on close (a11y).

let _lastFocusBeforeModal = null;

function openModal(modalId, focusSelector) {
  _lastFocusBeforeModal = document.activeElement;
  document.getElementById(modalId).classList.add('open');
  document.body.classList.add('modal-open');
  if (focusSelector) {
    requestAnimationFrame(() => document.querySelector(focusSelector)?.focus());
  }
}

function closeModalById(modalId) {
  document.getElementById(modalId).classList.remove('open');
  document.body.classList.remove('modal-open');
  if (_lastFocusBeforeModal && document.body.contains(_lastFocusBeforeModal)) {
    _lastFocusBeforeModal.focus();
  }
  _lastFocusBeforeModal = null;
}

// ── Class modal ──

function openClassModal() {
  document.getElementById('class_name').value = '';
  openModal('classModal', '#class_name');
}

function closeClassModal() {
  closeModalById('classModal');
}

async function handleClassSave() {
  const name = document.getElementById('class_name').value.trim();
  if (!name) { showToast('กรุณาใส่ชื่อห้อง'); return; }
  const btn = document.getElementById('classModalSave');
  await withLoading(btn, async () => {
    await resourceAction('add', 'class', {
      name,
      year: new Date().getFullYear(),
      active: true,
    });
    closeClassModal();
    render();
  }, 'กำลังบันทึก...');
}

// ── Subject modal ──

function openSubjectModal() {
  document.getElementById('subject_name').value = '';
  openModal('subjectModal', '#subject_name');
}

function closeSubjectModal() {
  closeModalById('subjectModal');
}

async function handleSubjectSave() {
  const name = document.getElementById('subject_name').value.trim();
  if (!name) { showToast('กรุณาใส่ชื่อวิชา'); return; }
  if (!state.currentClassId) { showToast('เลือกห้องก่อน'); return; }
  const btn = document.getElementById('subjectModalSave');
  await withLoading(btn, async () => {
    await resourceAction('add', 'subject', {
      classId: state.currentClassId,
      name,
      maxAttendanceScore: 10,
      maxHomeworkScore:   20,
    });
    closeSubjectModal();
    render();
  }, 'กำลังบันทึก...');
}

function setHwDate(iso) {
  document.getElementById('hw_date').value         = iso || '';
  document.getElementById('hw_date_btn').textContent = iso ? fmtDisplay(iso) : 'เลือกวันที่';
}

function openHomeworkModal() {
  if (!requireSubject()) return;
  document.getElementById('hw_title').value    = '';
  document.getElementById('hw_maxScore').value = 10;
  setHwDate(state.currentDate);
  openModal('homeworkModal', '#hw_title');
}

function closeHomeworkModal() {
  closeCal();
  closeModalById('homeworkModal');
}

async function handleHomeworkSave() {
  const title    = document.getElementById('hw_title').value.trim();
  const date     = document.getElementById('hw_date').value;
  const maxScore = Number(document.getElementById('hw_maxScore').value) || 10;

  if (!title) { showToast('กรุณาใส่ชื่อการบ้าน'); return; }
  if (!date)  { showToast('กรุณาเลือกวันที่'); return; }

  const btn = document.getElementById('hwModalSave');
  await withLoading(btn, async () => {
    await createHomework({ title, date, maxScore });
    closeHomeworkModal();
    render();
  }, 'กำลังบันทึก...');
}

// ── App entry point ──

window.addEventListener('load', () => {
  wireStaticListeners();
  bootstrap();
});
