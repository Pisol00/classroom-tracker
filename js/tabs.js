// === TABS ===
// Tab switching logic — only one panel visible at a time

import { TABS }   from './config.js';
import { state }  from './state.js';

export function renderTabs() {
  const nav = document.getElementById('tabsNav');
  nav.innerHTML = TABS.map(tab => `
    <button class="tab${state.currentTab === tab.id ? ' active' : ''}"
      type="button" data-tab="${tab.id}">
      <i class="ti ${tab.icon}" aria-hidden="true"></i>${tab.label}
    </button>`).join('');
}

export function showPanel(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === tabId);
  });
  renderTabs();
}
