// === EXCEL IMPORT ===
// Multi-sheet workbook → user picks one or more sheets → bulk import per class
// Each sheet name becomes a class. Uses SheetJS (loaded via CDN as global XLSX).

import { state }           from './state.js';
import { resourceAction }  from './api.js';
import { showToast }       from './toast.js';
import { escapeHtml }      from './utils.js';

const PREVIEW_ROW_LIMIT     = 200;
const MAX_HEADER_SCAN_ROWS  = 10;
const MAX_FILE_SIZE_MB      = 10;

// Header detection — Thai header from teacher's actual file
const COLUMN_ALIASES = {
  studentNo:   ['ที่', 'ลำดับ', 'ลำดับที่', 'no', 'studentNo', 'order'],
  studentCode: ['เลขประจำตัวนักเรียน', 'เลขประจำตัว', 'รหัสนักเรียน', 'studentCode', 'code'],
  citizenId:   ['เลขประจำตัว 13 หลัก', 'เลขบัตรประชาชน', 'citizenId'],
  birthDate:   ['วัน/เดือน/ปีเกิด', 'วันเกิด', 'birthDate', 'dob'],
  name:        ['ชื่อ-สกุล', 'ชื่อ-นามสกุล', 'ชื่อสกุล', 'name', 'fullname'],
  male:        ['ชาย', 'male'],
  female:      ['หญิง', 'female'],
};

// Import session state
let workbook        = null;
let availableSheets = [];
let selectedSheets  = new Set();
let perSheetRows    = new Map();  // sheetName -> array of rows (with isDuplicate)

export function openImportPicker() {
  document.getElementById('importFileInput').click();
}

export async function handleFile(file) {
  if (!file) return;
  if (!window.XLSX) {
    showToast('ยังโหลด library Excel ไม่เสร็จ');
    return;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    showToast(`ไฟล์ใหญ่เกิน ${MAX_FILE_SIZE_MB} MB`);
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array' });
    availableSheets = workbook.SheetNames.filter(name =>
      name && name.toLowerCase() !== 'sheet7'
    );

    if (!availableSheets.length) {
      showToast('ไฟล์ Excel ไม่มี sheet ที่ใช้งานได้');
      return;
    }

    // Default: select the first sheet only
    selectedSheets = new Set([availableSheets[0]]);
    openImportModal();
    refreshAll();
  } catch (err) {
    showToast(`อ่านไฟล์ไม่ได้: ${err.message}`);
  }
}

function openImportModal() {
  document.getElementById('importModal').classList.add('open');
  document.body.classList.add('modal-open');
}

export function closeImportModal() {
  document.getElementById('importModal').classList.remove('open');
  document.body.classList.remove('modal-open');
  document.getElementById('importFileInput').value = '';
  workbook = null;
  availableSheets = [];
  selectedSheets = new Set();
  perSheetRows = new Map();
}

function refreshAll() {
  renderSheetPicker();
  parseSelectedSheets();
  renderPreview();
}

function renderSheetPicker() {
  const wrap = document.getElementById('importSheetPicker');
  if (!wrap) return;

  const allChecked = selectedSheets.size === availableSheets.length;

  wrap.innerHTML = `
    <div class="import-sheet-head">
      <div class="import-sheet-label">เลือก sheet ที่จะนำเข้า (เลือกได้หลาย):</div>
      <button type="button" class="btn-link" id="selectAllSheets">
        ${allChecked ? 'เอาออกทั้งหมด' : 'เลือกทั้งหมด'}
      </button>
    </div>
    <div class="import-sheet-grid">
      ${availableSheets.map(name => {
        const checked = selectedSheets.has(name);
        return `<label class="sheet-check${checked ? ' selected' : ''}">
          <input type="checkbox" data-sheet="${escapeHtml(name)}" ${checked ? 'checked' : ''}>
          <span>${escapeHtml(name)}</span>
        </label>`;
      }).join('')}
    </div>`;

  wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const name = cb.dataset.sheet;
      if (cb.checked) selectedSheets.add(name);
      else            selectedSheets.delete(name);
      refreshAll();
    });
  });

  document.getElementById('selectAllSheets')?.addEventListener('click', () => {
    selectedSheets = allChecked ? new Set() : new Set(availableSheets);
    refreshAll();
  });
}

function findColumn(headers, key) {
  const aliases = COLUMN_ALIASES[key];
  const normalized = headers.map(h => String(h).trim().toLowerCase());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias.toLowerCase());
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function findHeaderRow(matrix) {
  const nameAliases = COLUMN_ALIASES.name.map(a => a.toLowerCase());
  const maxScan = Math.min(matrix.length, MAX_HEADER_SCAN_ROWS);
  for (let i = 0; i < maxScan; i++) {
    // Guard against sparse/jagged rows that XLSX can emit
    if (!Array.isArray(matrix[i])) continue;
    const cells = matrix[i].map(c => String(c ?? '').trim().toLowerCase());
    if (cells.some(c => nameAliases.includes(c))) return i;
  }
  return -1;
}

function parseSelectedSheets() {
  perSheetRows = new Map();

  for (const sheetName of selectedSheets) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    // cellDates: true → real Date objects (not formatted strings) for date cells.
    // raw: true keeps numbers as numbers (studentCode stays "6814" not formatted).
    const matrix = XLSX.utils.sheet_to_json(ws, {
      header: 1, defval: '', raw: false, cellDates: true,
    });
    if (!matrix.length) { perSheetRows.set(sheetName, []); continue; }

    const headerIdx = findHeaderRow(matrix);
    if (headerIdx < 0) {
      perSheetRows.set(sheetName, []);
      continue;
    }

    const headers = matrix[headerIdx].map(h => String(h).trim());
    const col = {
      studentNo:   findColumn(headers, 'studentNo'),
      studentCode: findColumn(headers, 'studentCode'),
      birthDate:   findColumn(headers, 'birthDate'),
      name:        findColumn(headers, 'name'),
      male:        findColumn(headers, 'male'),
      female:      findColumn(headers, 'female'),
    };

    if (!col.name) { perSheetRows.set(sheetName, []); continue; }

    const dataRows = matrix.slice(headerIdx + 1).map(arr => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = arr[i] ?? ''; });
      return obj;
    });

    // Determine existing students for duplicate detection
    const existingClass = state.classes.find(c => c.name === sheetName);
    const existingCodes = new Set(
      state.students
        .filter(s => s.classId === existingClass?.id)
        .map(s => String(s.studentCode || ''))
    );

    const seenCodes = new Set();
    const rows = dataRows
      .map(r => ({
        sheet:       sheetName,
        studentNo:   readVal(r, col.studentNo),
        studentCode: String(readVal(r, col.studentCode) || '').trim(),
        birthDate:   formatBirthDate(readVal(r, col.birthDate)),
        name:        String(readVal(r, col.name)        || '').trim(),
        gender:      readGender(r, col),
      }))
      .filter(r => r.name);

    // Mark duplicates against existing students AND against earlier rows in
    // the same sheet (some teacher files have the same student listed twice).
    rows.forEach(r => {
      const codeStr = r.studentCode;
      if (codeStr && (existingCodes.has(codeStr) || seenCodes.has(codeStr))) {
        r.isDuplicate = true;
      } else {
        r.isDuplicate = false;
        if (codeStr) seenCodes.add(codeStr);
      }
    });

    perSheetRows.set(sheetName, rows);
  }
}

function readVal(row, colKey) {
  if (!colKey) return '';
  return row[colKey];
}

// Birthdays from Thai sheets are usually written as "19/12/2561" (Buddhist year).
// If Excel coerced the cell into a Date (only happens when the cell was a true
// date type), we'd lose the year-format intent — convert it back to D/M/YYYY+543.
// Otherwise pass the raw string through (teacher's preference wins).
function formatBirthDate(value) {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value)) {
    const d = value.getDate();
    const m = value.getMonth() + 1;
    const y = value.getFullYear();
    // Assume sheet was already in Buddhist year if year < 2200 (covers up to year 1657 CE / 2200 BE)
    const buddhist = y > 2200 ? y : y + 543;
    return `${d}/${m}/${buddhist}`;
  }
  return String(value).trim();
}

function readGender(row, col) {
  if (col.male   && String(readVal(row, col.male)).trim())   return 'M';
  if (col.female && String(readVal(row, col.female)).trim()) return 'F';
  return '';
}

function renderPreview() {
  const allRows = [...perSheetRows.values()].flat();
  const toAdd   = allRows.filter(r => !r.isDuplicate);
  const toSkip  = allRows.filter(r =>  r.isDuplicate);

  // Group new-class summary
  const newClasses = [...selectedSheets].filter(name => !state.classes.some(c => c.name === name));

  document.getElementById('importPreviewSummary').innerHTML = `
    ${newClasses.length ? `<div class="stat-pill"><span class="dot" style="background:var(--text)"></span>สร้างห้องใหม่ <b>${newClasses.length}</b> ห้อง</div>` : ''}
    <div class="stat-pill"><span class="dot" style="background:#639922"></span>จะเพิ่ม <b>${toAdd.length}</b> คน</div>
    ${toSkip.length ? `<div class="stat-pill"><span class="dot" style="background:#EF9F27"></span>ข้ามที่ซ้ำ <b>${toSkip.length}</b> คน</div>` : ''}
    ${selectedSheets.size > 1 ? `<div class="stat-pill muted"><span class="dot" style="background:#9c9588"></span>จาก <b>${selectedSheets.size}</b> sheet</div>` : ''}
  `;

  const tbody = document.getElementById('importPreviewBody');
  if (!allRows.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ti ti-table-off" aria-hidden="true"></i><p>${selectedSheets.size ? 'ไม่พบข้อมูลใน sheet ที่เลือก' : 'เลือก sheet เพื่อดูข้อมูล'}</p></div></td></tr>`;
  } else {
    tbody.innerHTML = allRows.slice(0, PREVIEW_ROW_LIMIT).map(r => `
      <tr class="${r.isDuplicate ? 'row-skip' : ''}">
        <td class="td-center"><span class="sheet-tag">${escapeHtml(r.sheet)}</span></td>
        <td class="td-center">${escapeHtml(String(r.studentNo ?? ''))}</td>
        <td class="td-center">${escapeHtml(r.studentCode)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td class="td-center">${escapeHtml(r.birthDate)}</td>
        <td class="td-center">${genderLabel(r.gender)}</td>
        <td class="td-center">
          ${r.isDuplicate
            ? '<span class="tag tag-warn">ข้าม</span>'
            : '<span class="tag tag-ok">ใหม่</span>'}
        </td>
      </tr>`).join('');

    if (allRows.length > 200) {
      tbody.innerHTML += `<tr><td colspan="7" class="td-center muted">… อีก ${allRows.length - PREVIEW_ROW_LIMIT} แถว</td></tr>`;
    }
  }

  const btn = document.getElementById('importConfirmBtn');
  btn.textContent = toAdd.length
    ? `นำเข้า ${toAdd.length} คน${selectedSheets.size > 1 ? ` (${selectedSheets.size} ห้อง)` : ''}`
    : 'ไม่มีข้อมูลใหม่ที่จะนำเข้า';
  btn.disabled = !toAdd.length;
}

function genderLabel(g) {
  if (g === 'M') return '<span class="gender-tag gender-m">ช</span>';
  if (g === 'F') return '<span class="gender-tag gender-f">ญ</span>';
  return '';
}

export async function confirmImport() {
  const allRows = [...perSheetRows.values()].flat().filter(r => !r.isDuplicate);
  if (!allRows.length) return;

  let totalImported = 0;
  let firstClassId  = null;

  // Process sheet by sheet — create class if needed, then bulkAdd its students
  for (const sheetName of selectedSheets) {
    const rows = (perSheetRows.get(sheetName) || []).filter(r => !r.isDuplicate);
    if (!rows.length) continue;

    let classId = state.classes.find(c => c.name === sheetName)?.id;
    if (!classId) {
      const ok = await resourceAction('add', 'class', {
        name:   sheetName,
        year:   new Date().getFullYear(),
        active: true,
      });
      if (!ok) {
        showToast(`สร้างห้อง "${sheetName}" ไม่สำเร็จ`);
        continue;
      }
      classId = state.classes.find(c => c.name === sheetName)?.id;
      if (!classId) continue;
    }

    if (firstClassId == null) firstClassId = classId;

    const payload = rows.map(r => ({
      classId,
      studentNo:   Number(r.studentNo) || 0,
      studentCode: r.studentCode,
      name:        r.name,
      birthDate:   r.birthDate,
      gender:      r.gender,
    }));

    const ok = await resourceAction('bulkAdd', 'student', payload);
    if (ok) totalImported += payload.length;
  }

  if (totalImported > 0) {
    showToast(`นำเข้านักเรียน ${totalImported} คนเข้า ${selectedSheets.size} ห้องสำเร็จ`, 'success');
    if (firstClassId) state.currentClassId = firstClassId;
    closeImportModal();
  }
}

export function downloadTemplate() {
  if (!window.XLSX) { showToast('ยังโหลด library Excel ไม่เสร็จ'); return; }

  const data = [
    { 'ที่': 1, 'เลขประจำตัวนักเรียน': '6814', 'วัน/เดือน/ปีเกิด': '19/12/2561', 'ชื่อ-สกุล': 'เด็กชายกฤตรินทร์ เหล็กกล้า', 'ชาย': 1, 'หญิง': '' },
    { 'ที่': 2, 'เลขประจำตัวนักเรียน': '6828', 'วัน/เดือน/ปีเกิด': '08/08/2561', 'ชื่อ-สกุล': 'เด็กหญิงรวิภาณต์ สุขะวัฒนสินธุ์', 'ชาย': '', 'หญิง': 1 },
  ];
  const ws = XLSX.utils.json_to_sheet(data, {
    header: ['ที่', 'เลขประจำตัวนักเรียน', 'วัน/เดือน/ปีเกิด', 'ชื่อ-สกุล', 'ชาย', 'หญิง'],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ป.1');
  XLSX.writeFile(wb, 'students-template.xlsx');
}
