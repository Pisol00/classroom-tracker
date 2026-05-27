// === STATE ===
// Shared mutable state for the classroom tracker

export const state = {
  // Data collections
  classes:       [],
  subjects:      [],
  students:      [],
  attendance:    [],
  homework:      [],
  homeworkScore: [],

  // UI state
  currentTab:        'students',     // 'students' | 'attendance' | 'homework'
  currentClassId:    null,
  currentSubjectId:  null,
  currentDate:       new Date().toISOString().slice(0, 10),
  selectedHomeworkId: null,

  // Auth
  idToken:   sessionStorage.getItem('ct_token') || '',
  userInfo:  loadUserInfo(),

  // Flags
  isLoading: false,
};

function loadUserInfo() {
  try {
    return JSON.parse(sessionStorage.getItem('ct_user') || 'null');
  } catch {
    return null;
  }
}
