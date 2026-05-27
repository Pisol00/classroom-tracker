// === CONFIG ===
// Static constants — API, options, display metadata

export const API_URL          = 'https://script.google.com/macros/s/AKfycbz7CDy-Med8T3xPs4GoBo8wIARjDD_6pL1_S7KhIYiAyK4eAM3YB30G5ccROEhNEnTVWw/exec';
export const GOOGLE_CLIENT_ID = '479414655504-c6nfa84s18tl8ritag7kfqk0gsrtleer.apps.googleusercontent.com';

// Tabs
export const TABS = [
  { id: 'students',   label: 'นักเรียน',  icon: 'ti-users' },
  { id: 'attendance', label: 'เช็คชื่อ',  icon: 'ti-calendar-check' },
  { id: 'homework',   label: 'การบ้าน',   icon: 'ti-notebook' },
];

// Attendance statuses
export const ATTENDANCE_STATUSES = ['present', 'absent', 'sick'];
export const ATTENDANCE_META = {
  present: { cls: 's-accepted',  icon: 'ti-circle-check',   label: 'มา' },
  absent:  { cls: 's-rejected',  icon: 'ti-circle-x',       label: 'ขาด' },
  sick:    { cls: 's-interview', icon: 'ti-medical-cross',  label: 'ป่วย' },
};

// Calendar
export const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const DOWS   = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// Dropdown options (filled dynamically from state — these are placeholders)
export const OPTIONS = {
  classFilter:   [],
  subjectFilter: [],
};

// Empty starting data — user adds classes/subjects/students themselves
export const MOCK = {
  classes:       [],
  subjects:      [],
  students:      [],
  attendance:    [],
  homework:      [],
  homeworkScore: [],
};

// When true, app uses MOCK instead of calling the API
export const USE_MOCK = false;
