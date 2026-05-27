// === API ===
// Apps Script backend integration (with mock-data fallback)

import { API_URL, USE_MOCK, MOCK } from './config.js';
import { state }                    from './state.js';
import { showToast }                from './toast.js';

function setLoading(isLoading) {
  state.isLoading = isLoading;
  document.body.style.cursor = isLoading ? 'progress' : '';
}

// Single shared AbortController — signOut aborts all in-flight requests
// so their responses can't overwrite state after the user has logged out.
let abortController = new AbortController();

export function abortInflightRequests() {
  abortController.abort();
  abortController = new AbortController();
}

// Returns a deep copy of MOCK so mutations don't poison the source
function freshMock() {
  return JSON.parse(JSON.stringify(MOCK));
}

function applyData(data) {
  state.classes       = data.classes       || [];
  state.subjects      = data.subjects      || [];
  state.students      = data.students      || [];
  state.attendance    = data.attendance    || [];
  state.homework      = data.homework      || [];
  state.homeworkScore = data.homeworkScore || [];
}

// ── Public ──

export async function fetchApi(payload) {
  if (USE_MOCK) {
    return handleMock(payload);
  }

  if (!state.idToken) {
    document.dispatchEvent(new CustomEvent('auth:signout'));
    throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  }

  const signal = abortController.signal;
  const opts = payload
    ? {
        method:  'POST',
        body:    JSON.stringify({ ...payload, token: state.idToken }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        signal,
      }
    : { signal };

  const url   = payload ? API_URL : `${API_URL}?token=${encodeURIComponent(state.idToken)}`;
  const res   = await fetch(url, opts);
  const data  = await res.json();

  if (!data.ok) {
    if (/token|allowed|expired|audience|not allowed/i.test(data.error || '')) {
      showToast(data.error || 'เข้าสู่ระบบไม่ผ่าน', 'error');
      document.dispatchEvent(new CustomEvent('auth:signout'));
    }
    throw new Error(data.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
  }
  return data;
}

export async function loadAll() {
  setLoading(true);
  try {
    if (USE_MOCK) {
      applyData(freshMock());
      return;
    }
    const data = await fetchApi();
    applyData(data);
  } catch (err) {
    if (!/ยังไม่ได้เข้าสู่ระบบ|token|allowed|expired|audience/i.test(err.message)) {
      showToast(`โหลดข้อมูลไม่สำเร็จ: ${err.message}`);
    }
  } finally {
    setLoading(false);
  }
}

// Generic resource CRUD — Apps Script expects { action, resource, payload }
const ACTION_LABEL = {
  add:        'เพิ่ม',
  update:     'อัปเดต',
  delete:     'ลบ',
  bulkAdd:    'นำเข้า',
  bulkSet:    'บันทึก',
  bulkDelete: 'ลบ',
};

export async function resourceAction(action, resource, payload) {
  setLoading(true);
  try {
    if (USE_MOCK) {
      mockMutate(action, resource, payload);
      return true;
    }
    const data = await fetchApi({ action, resource, payload });
    applyData(data);
    return true;
  } catch (err) {
    const label = ACTION_LABEL[action] || action;
    showToast(`${label}ไม่สำเร็จ: ${err.message}`);
    return false;
  } finally {
    setLoading(false);
  }
}

// ── Mock mutations (purely in-memory, lost on reload) ──

function mockMutate(action, resource, payload) {
  const collKey = {
    class:         'classes',
    subject:       'subjects',
    student:       'students',
    attendance:    'attendance',
    homework:      'homework',
    homeworkScore: 'homeworkScore',
  }[resource];

  if (!collKey) return;
  const coll = state[collKey];

  if (action === 'add') {
    const newId = Math.max(0, ...coll.map(r => r.id || 0)) + 1;
    coll.push({ ...payload, id: newId });
  } else if (action === 'bulkAdd') {
    let nextId = Math.max(0, ...coll.map(r => r.id || 0)) + 1;
    for (const row of payload) {
      coll.push({ ...row, id: nextId++ });
    }
  } else if (action === 'update') {
    const idx = coll.findIndex(r => r.id === payload.id);
    if (idx >= 0) coll[idx] = { ...coll[idx], ...payload };
  } else if (action === 'delete') {
    const idx = coll.findIndex(r => r.id === payload.id);
    if (idx >= 0) coll.splice(idx, 1);
    cascadeDelete(resource, payload.id);
  } else if (action === 'bulkSet') {
    // Used by attendance/homeworkScore: payload is an array of full rows
    // Upsert by primary keys
    for (const row of payload) {
      const idx = findMatchingRow(coll, row, resource);
      if (idx >= 0) coll[idx] = { ...coll[idx], ...row };
      else {
        const newId = Math.max(0, ...coll.map(r => r.id || 0)) + 1;
        coll.push({ ...row, id: newId });
      }
    }
  }
}

// Remove all dependent rows when a parent record is deleted (mock mode only)
function cascadeDelete(resource, id) {
  if (resource === 'class') {
    // Subjects of this class → trigger their own cascade
    const subjectsToDrop = state.subjects.filter(s => s.classId === id).map(s => s.id);
    state.subjects = state.subjects.filter(s => s.classId !== id);
    subjectsToDrop.forEach(sid => cascadeDelete('subject', sid));
    // Students of this class
    const studentsToDrop = state.students.filter(s => s.classId === id).map(s => s.id);
    state.students = state.students.filter(s => s.classId !== id);
    studentsToDrop.forEach(sid => cascadeDelete('student', sid));
  } else if (resource === 'subject') {
    state.attendance = state.attendance.filter(a => a.subjectId !== id);
    const hwToDrop = state.homework.filter(h => h.subjectId === id).map(h => h.id);
    state.homework = state.homework.filter(h => h.subjectId !== id);
    state.homeworkScore = state.homeworkScore.filter(s => !hwToDrop.includes(s.homeworkId));
  } else if (resource === 'student') {
    state.attendance    = state.attendance.filter(a => a.studentId !== id);
    state.homeworkScore = state.homeworkScore.filter(s => s.studentId !== id);
  } else if (resource === 'homework') {
    state.homeworkScore = state.homeworkScore.filter(s => s.homeworkId !== id);
  }
}

function findMatchingRow(coll, row, resource) {
  if (resource === 'attendance') {
    return coll.findIndex(r =>
      r.subjectId === row.subjectId && r.date === row.date && r.studentId === row.studentId);
  }
  if (resource === 'homeworkScore') {
    return coll.findIndex(r =>
      r.homeworkId === row.homeworkId && r.studentId === row.studentId);
  }
  return coll.findIndex(r => r.id === row.id);
}
