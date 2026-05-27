// === SKELETON LOADING ===
// Render placeholder UI while initial data is loading.
// Used once on first load — once render() is called with real data, this gets overwritten.

export function showSkeletons() {
  renderClassPillSkeleton();
  renderSubjectPillSkeleton();
  renderStudentsSkeleton();
  renderAttendanceSkeleton();
  renderHomeworkSkeleton();
}

function renderClassPillSkeleton() {
  const el = document.getElementById('classSelector');
  if (el) el.innerHTML = pillsSkeleton(4);
}

function renderSubjectPillSkeleton() {
  const el = document.getElementById('subjectSelector');
  if (el) el.innerHTML = pillsSkeleton(3);
}

function pillsSkeleton(count) {
  return Array.from({ length: count })
    .map(() => '<span class="skeleton skeleton-pill"></span>')
    .join('');
}

function renderStudentsSkeleton() {
  const tbody = document.getElementById('studentsBody');
  if (!tbody) return;
  tbody.innerHTML = rowsSkeleton(8, 8);
}

function renderAttendanceSkeleton() {
  const tbody = document.getElementById('attendanceBody');
  if (!tbody) return;
  tbody.innerHTML = rowsSkeleton(8, 4);
}

function renderHomeworkSkeleton() {
  const list = document.getElementById('homeworkList');
  if (!list) return;
  list.innerHTML = Array.from({ length: 4 })
    .map(() => `
      <div class="hw-card" style="cursor:default">
        <div class="skeleton skeleton-text skeleton-text-md" style="margin-bottom:10px"></div>
        <div class="skeleton skeleton-text skeleton-text-sm"></div>
      </div>`).join('');
}

function rowsSkeleton(rowCount, colCount) {
  const cell = '<td><span class="skeleton skeleton-text skeleton-text-md"></span></td>';
  const row  = `<tr class="skeleton-row">${cell.repeat(colCount)}</tr>`;
  return row.repeat(rowCount);
}
