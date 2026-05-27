/**
 * Classroom Tracker — Apps Script backend
 * Paste this into Google Apps Script editor (Extensions → Apps Script in your Sheet).
 *
 * Setup:
 *   1. Open the Google Sheet with the 6 tabs (Classes, Subjects, Students,
 *      Attendance, Homework, HomeworkScore).
 *   2. Extensions → Apps Script → paste this file as Code.gs.
 *   3. Update SHEET_ID below to your spreadsheet's ID (from URL).
 *   4. Update ALLOWED_EMAILS — only these accounts can read/write.
 *   5. Update CLIENT_ID — use the same OAuth Client ID as job-tracker.
 *   6. Deploy → New deployment → type: Web app → execute as: Me,
 *      access: Anyone with Google account → Deploy.
 *   7. Copy the Web app URL into js/config.js as API_URL.
 */

// ── Configuration ─────────────────────────────────────────────────────────

const SHEET_ID       = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const CLIENT_ID      = '479414655504-c6nfa84s18tl8ritag7kfqk0gsrtleer.apps.googleusercontent.com';
const ALLOWED_EMAILS = [
  'pisol.noti@gmail.com',
  // add more emails here if needed
];

const COLUMNS = {
  Classes:       ['id', 'name', 'year', 'active'],
  Subjects:      ['id', 'classId', 'name', 'maxAttendanceScore', 'maxHomeworkScore'],
  Students:      ['id', 'classId', 'studentNo', 'studentCode', 'name', 'birthDate', 'gender'],
  Attendance:    ['id', 'subjectId', 'date', 'studentId', 'status'],
  Homework:      ['id', 'subjectId', 'date', 'title', 'maxScore'],
  HomeworkScore: ['id', 'homeworkId', 'studentId', 'submitted', 'score'],
};

const RESOURCE_TO_SHEET = {
  class:         'Classes',
  subject:       'Subjects',
  student:       'Students',
  attendance:    'Attendance',
  homework:      'Homework',
  homeworkScore: 'HomeworkScore',
};

// ── Entry points ──────────────────────────────────────────────────────────

function doGet(e) {
  return handle_(e, null);
}

function doPost(e) {
  let payload = null;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Invalid JSON payload' });
  }
  return handle_(e, payload);
}

function handle_(e, payload) {
  try {
    const token = (payload && payload.token) || (e && e.parameter && e.parameter.token);
    const email = verifyToken_(token);

    if (!ALLOWED_EMAILS.includes(email)) {
      return jsonOut_({ ok: false, error: 'Email not allowed: ' + email });
    }

    // GET = read-only fetch all data
    if (!payload) {
      return jsonOut_({ ok: true, ...readAll_() });
    }

    const { action, resource } = payload;
    if (!action) return jsonOut_({ ok: false, error: 'Missing action' });

    let result;
    switch (action) {
      case 'add':        result = doAdd_(resource, payload.payload); break;
      case 'update':     result = doUpdate_(resource, payload.payload); break;
      case 'delete':     result = doDelete_(resource, payload.payload); break;
      case 'bulkAdd':    result = doBulkAdd_(resource, payload.payload); break;
      case 'bulkSet':    result = doBulkSet_(resource, payload.payload); break;
      case 'bulkDelete': result = doBulkDelete_(resource, payload.payload); break;
      default: return jsonOut_({ ok: false, error: 'Unknown action: ' + action });
    }

    return jsonOut_({ ok: true, ...readAll_(), result });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message || String(err) });
  }
}

// ── Token verification ────────────────────────────────────────────────────

function verifyToken_(token) {
  if (!token) throw new Error('No token');

  const url  = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);
  const res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error('token expired or invalid');

  const info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) throw new Error('audience mismatch');
  if (!info.email_verified)   throw new Error('email not verified');
  return info.email;
}

// ── Read everything ───────────────────────────────────────────────────────

function readAll_() {
  return {
    classes:       readSheet_('Classes'),
    subjects:      readSheet_('Subjects'),
    students:      readSheet_('Students'),
    attendance:    readSheet_('Attendance'),
    homework:      readSheet_('Homework'),
    homeworkScore: readSheet_('HomeworkScore'),
  };
}

function readSheet_(name) {
  const sheet = getSheet_(name);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const cols = COLUMNS[name];
  const range = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
  return range.map(row => {
    const obj = {};
    cols.forEach((c, i) => {
      let v = row[i];
      if (c === 'id' || c === 'classId' || c === 'subjectId' || c === 'studentId'
          || c === 'homeworkId' || c === 'studentNo' || c === 'year'
          || c === 'maxAttendanceScore' || c === 'maxHomeworkScore'
          || c === 'maxScore' || c === 'score') {
        v = v === '' || v == null ? null : Number(v);
      }
      obj[c] = v;
    });
    return obj;
  }).filter(r => r.id != null);   // skip blank rows
}

// ── Mutations ─────────────────────────────────────────────────────────────

function doAdd_(resource, data) {
  const sheetName = sheetNameFor_(resource);
  const sheet     = getSheet_(sheetName);
  const cols      = COLUMNS[sheetName];
  const newId     = nextId_(sheet);

  const row = cols.map(c => c === 'id' ? newId : (data[c] !== undefined ? data[c] : ''));
  sheet.appendRow(row);
  return { id: newId };
}

function doUpdate_(resource, data) {
  const sheetName = sheetNameFor_(resource);
  const sheet     = getSheet_(sheetName);
  const cols      = COLUMNS[sheetName];
  const idRow     = findRowById_(sheet, data.id);
  if (idRow < 0) throw new Error('Row not found: id=' + data.id);

  // Update only the fields provided
  const currentRow = sheet.getRange(idRow, 1, 1, cols.length).getValues()[0];
  const updated = cols.map((c, i) => data[c] !== undefined ? data[c] : currentRow[i]);
  sheet.getRange(idRow, 1, 1, cols.length).setValues([updated]);
  return { id: data.id };
}

function doDelete_(resource, data) {
  const sheetName = sheetNameFor_(resource);
  const sheet     = getSheet_(sheetName);
  const idRow     = findRowById_(sheet, data.id);
  if (idRow > 0) sheet.deleteRow(idRow);
  cascadeDelete_(resource, data.id);
  return { id: data.id };
}

// Delete many rows by id list in a single sheet-rewrite (much faster than N×delete)
function doBulkDelete_(resource, ids) {
  if (!ids || !ids.length) return { deleted: 0 };
  const idSet = new Set(ids.map(String));
  const sheetName = sheetNameFor_(resource);
  rewriteSheetExcluding_(sheetName, r => idSet.has(String(r.id)));
  // Cascade for each id
  ids.forEach(id => cascadeDelete_(resource, id));
  return { deleted: ids.length };
}

function doBulkAdd_(resource, rows) {
  if (!rows || !rows.length) return { added: 0 };
  const sheetName = sheetNameFor_(resource);
  const sheet     = getSheet_(sheetName);
  const cols      = COLUMNS[sheetName];
  let   nextId    = nextId_(sheet);

  const values = rows.map(data => cols.map(c => {
    if (c === 'id') return nextId++;
    return data[c] !== undefined ? data[c] : '';
  }));

  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, cols.length).setValues(values);
  return { added: rows.length };
}

// bulkSet: upsert by composite primary keys (used by attendance + homeworkScore)
function doBulkSet_(resource, rows) {
  if (!rows || !rows.length) return { upserted: 0 };
  const sheetName = sheetNameFor_(resource);
  const sheet     = getSheet_(sheetName);
  const cols      = COLUMNS[sheetName];
  const existing  = readSheet_(sheetName);

  let nextId = nextId_(sheet);
  const toAppend = [];

  for (const row of rows) {
    const matchIdx = findMatchByKeys_(existing, row, resource);
    if (matchIdx >= 0) {
      // Update existing row in sheet — its row number is matchIdx + 2 (header + 1-indexed)
      const sheetRow = matchIdx + 2;
      const current  = sheet.getRange(sheetRow, 1, 1, cols.length).getValues()[0];
      const merged   = cols.map((c, i) => row[c] !== undefined ? row[c] : current[i]);
      sheet.getRange(sheetRow, 1, 1, cols.length).setValues([merged]);
    } else {
      toAppend.push(cols.map(c => {
        if (c === 'id') return nextId++;
        return row[c] !== undefined ? row[c] : '';
      }));
    }
  }

  if (toAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, cols.length).setValues(toAppend);
  }
  return { upserted: rows.length };
}

function findMatchByKeys_(existing, row, resource) {
  if (resource === 'attendance') {
    return existing.findIndex(r =>
      String(r.subjectId) === String(row.subjectId)
      && String(r.date)      === String(row.date)
      && String(r.studentId) === String(row.studentId));
  }
  if (resource === 'homeworkScore') {
    return existing.findIndex(r =>
      String(r.homeworkId) === String(row.homeworkId)
      && String(r.studentId) === String(row.studentId));
  }
  return existing.findIndex(r => String(r.id) === String(row.id));
}

// ── Cascade delete ────────────────────────────────────────────────────────
//
// Strategy: read each sheet ONCE, build the predicate of which rows to keep,
// then rewrite the sheet in a single setValues() call. This keeps complexity
// to O(N) per sheet and avoids the deleteRow-in-loop slowness that hits
// the Apps Script 6-minute limit on large datasets.

function cascadeDelete_(resource, parentId) {
  // Collect "to delete" predicates per sheet — applied as a single rewrite at the end
  const sweep = {
    Subjects:      null,
    Students:      null,
    Attendance:    null,
    Homework:      null,
    HomeworkScore: null,
  };

  if (resource === 'class') {
    // Read the dependency tree once
    const subjects = readSheet_('Subjects').filter(s => String(s.classId) === String(parentId));
    const students = readSheet_('Students').filter(s => String(s.classId) === String(parentId));
    const subjectIds = new Set(subjects.map(s => String(s.id)));
    const studentIds = new Set(students.map(s => String(s.id)));
    const hwOfSubjects = readSheet_('Homework').filter(h => subjectIds.has(String(h.subjectId)));
    const hwIds = new Set(hwOfSubjects.map(h => String(h.id)));

    sweep.Subjects      = r => subjectIds.has(String(r.id));
    sweep.Students      = r => studentIds.has(String(r.id));
    sweep.Attendance    = r => subjectIds.has(String(r.subjectId)) || studentIds.has(String(r.studentId));
    sweep.Homework      = r => subjectIds.has(String(r.subjectId));
    sweep.HomeworkScore = r => hwIds.has(String(r.homeworkId)) || studentIds.has(String(r.studentId));

  } else if (resource === 'subject') {
    const subjectIds = new Set([String(parentId)]);
    const hwOfSubjects = readSheet_('Homework').filter(h => subjectIds.has(String(h.subjectId)));
    const hwIds = new Set(hwOfSubjects.map(h => String(h.id)));

    sweep.Attendance    = r => subjectIds.has(String(r.subjectId));
    sweep.Homework      = r => subjectIds.has(String(r.subjectId));
    sweep.HomeworkScore = r => hwIds.has(String(r.homeworkId));

  } else if (resource === 'student') {
    const studentIds = new Set([String(parentId)]);
    sweep.Attendance    = r => studentIds.has(String(r.studentId));
    sweep.HomeworkScore = r => studentIds.has(String(r.studentId));

  } else if (resource === 'homework') {
    sweep.HomeworkScore = r => String(r.homeworkId) === String(parentId);
  }

  for (const sheetName in sweep) {
    if (sweep[sheetName]) rewriteSheetExcluding_(sheetName, sweep[sheetName]);
  }
}

// Read sheet once → filter out rows matching predicate → rewrite remaining rows in one shot.
function rewriteSheetExcluding_(sheetName, shouldDeletePredicate) {
  const sheet = getSheet_(sheetName);
  const last  = sheet.getLastRow();
  if (last < 2) return;

  const cols    = COLUMNS[sheetName];
  const rawData = sheet.getRange(2, 1, last - 1, cols.length).getValues();

  // Determine which rows survive
  const survivors = rawData.filter(rowArr => {
    const obj = {};
    cols.forEach((c, j) => { obj[c] = rowArr[j]; });
    return !shouldDeletePredicate(obj);
  });

  if (survivors.length === rawData.length) return;   // nothing to delete

  // Clear the data area, then write survivors back in a single call
  sheet.getRange(2, 1, rawData.length, cols.length).clearContent();
  if (survivors.length) {
    sheet.getRange(2, 1, survivors.length, cols.length).setValues(survivors);
  }
}

// ── Sheet helpers ─────────────────────────────────────────────────────────

function getSheet_(name) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function sheetNameFor_(resource) {
  const name = RESOURCE_TO_SHEET[resource];
  if (!name) throw new Error('Unknown resource: ' + resource);
  return name;
}

function findRowById_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function nextId_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return 1;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues().flat();
  let max = 0;
  for (const v of ids) {
    const n = Number(v);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

// ── JSON response ─────────────────────────────────────────────────────────

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
