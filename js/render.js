// === RENDER ===
// Top-level render orchestrator — delegates to per-tab modules

import { renderTabs }                  from './tabs.js';
import { renderStudents }              from './students.js';
import { renderAttendance }            from './attendance.js';
import { renderHomework }              from './homework.js';
import { renderSelectors, ensureSelections } from './selectors.js';

export function render() {
  // Normalize selection invariants BEFORE any view reads them — render is pure after this.
  ensureSelections();
  renderSelectors();
  renderTabs();
  renderStudents();
  renderAttendance();
  renderHomework();
}
