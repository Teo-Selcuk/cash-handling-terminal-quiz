// Shared presentation for tables and chess history lists; gameplay storage is untouched.
import { tableExplanation, createExplanation } from './history-explanations.mjs?v=20261018-explain';
const sizes = new Map();
// Tables start minimized so History pages stay short; the toolbar opens them.
const DEFAULT_SIZE = 'minimized';
const openExplanations = new Set();
const LIST_EXPLANATIONS = {
  'chess-games': { what: 'Your saved chess games. Each card is one game: the result, the computer level, the clock, and your move times.', terms: [['Result', 'Win, draw, or loss for you.'], ['Late moves', 'Moves made with little time left on your clock.']] },
  'chess-lessons': { what: 'Your lesson tries. Each card is one lesson: whether you solved it and how many hints you used.', terms: [['Hints', 'How many times you asked for help.']] },
};
const setters = new WeakMap();
const HISTORY_PAGE_ID = 'history-screen', SECTION_ID = 'history-all-tables';
const slots = new WeakMap();
let bulk = 0;
const plural = (count) => `${count} table${count === 1 ? '' : 's'}`;
function buildToolbar(scope) {
  const toolbar = document.createElement('div'); toolbar.className = 'global-table-controls history-table-controls';
  toolbar.setAttribute('aria-label', 'All table sizes');
  for (const [label, size] of [['Minimize All Tables', 'minimized'], ['Expand All Tables', 'expanded'], ['Reset Tables to Default', DEFAULT_SIZE]]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button'; button.textContent = label;
    button.dataset.tableSize = size; button.dataset.reset = String(label.startsWith('Reset'));
    button.addEventListener('click', () => {
      bulk += 1;
      try { for (const shell of scope().querySelectorAll('.history-table-container')) setters.get(shell)?.(size); } finally { bulk -= 1; }
      refreshSection();
      for (const viewport of observed) queueMeasure(viewport);
    });
    toolbar.append(button);
  }
  return toolbar;
}
function globalControls(root) {
  const page = root.closest('dialog, .screen');
  if (!page || page.querySelector(':scope > .global-table-controls')) return;
  if (page.id === HISTORY_PAGE_ID) return; // The History page keeps these buttons inside its "All tables" section.
  page.prepend(buildToolbar(() => page));
}

// One collapsible section holds every History table. A hidden slot marks where each table was drawn, so tables of
// panels that were re-rendered or are not showing never appear here.
function historySection(page) {
  let section = page.querySelector(`:scope > #${SECTION_ID}`);
  if (section) return section;
  section = document.createElement('details'); section.id = SECTION_ID; section.className = 'all-tables-section';
  const summary = document.createElement('summary');
  const title = document.createElement('span'); title.className = 'all-tables-title'; title.textContent = 'All tables';
  const count = document.createElement('span'); count.className = 'all-tables-count'; count.setAttribute('role', 'status'); count.textContent = plural(0);
  const chevron = document.createElement('span'); chevron.className = 'all-tables-chevron'; chevron.setAttribute('aria-hidden', 'true'); chevron.textContent = '⌄';
  summary.append(title, count, chevron);
  const body = document.createElement('div'); body.className = 'all-tables-body';
  const empty = document.createElement('p'); empty.className = 'all-tables-empty'; empty.textContent = 'No attempts yet'; empty.hidden = true;
  const list = document.createElement('div'); list.className = 'all-tables-list';
  body.append(buildToolbar(() => page), empty, list);
  section.append(summary, body);
  section.addEventListener('toggle', () => { if (section.open) { refreshSection(); for (const viewport of observed) queueMeasure(viewport); } });
  page.append(section);
  // Tab and data-source switches hide whole panels without re-rendering; keep the list and count in step.
  if (typeof MutationObserver !== 'undefined') new MutationObserver(() => scheduleRefresh()).observe(page, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  return section;
}
// Chart data tables stay inside their charts (they are that chart's accessible data view); every other table moves here.
function adoptShell(page, shell) {
  if (slots.has(shell) || shell.closest('.chart-table-alternative, dialog')) return;
  const slot = document.createElement('span'); slot.hidden = true; slot.dataset.tableSlot = '';
  shell.before(slot); slots.set(shell, slot);
  const source = slot.parentElement?.closest('[id]')?.id; // Where the table was drawn, so it can still be found by that name.
  if (source) shell.dataset.tableSource = source;
  historySection(page).querySelector('.all-tables-list').append(shell);
}
// Tables built while detached (chart cards) are adopted once they are on the page.
function adoptLooseShells(page) {
  for (const shell of page.querySelectorAll('.history-table-container')) if (!shell.closest('#' + SECTION_ID)) adoptShell(page, shell);
}
let refreshQueued = false;
function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => { refreshQueued = false; refreshSection(); });
}
function refreshSection() {
  const section = document.getElementById(SECTION_ID);
  if (!section || bulk) return;
  const list = section.querySelector('.all-tables-list');
  let shown = 0; const sizesShown = [];
  for (const shell of [...list.children]) {
    const slot = slots.get(shell);
    if (!slot?.isConnected) { shell.remove(); continue; }
    const visible = !slot.parentElement?.closest('[hidden]') && dataRowCount(shell.querySelector('.history-table-viewport')) > 0;
    shell.hidden = !visible;
    if (visible) { shown += 1; sizesShown.push(shell.dataset.tableSize); }
  }
  section.querySelector('.all-tables-count').textContent = plural(shown);
  section.querySelector('.all-tables-empty').hidden = shown > 0;
  section.querySelector('.global-table-controls').hidden = shown === 0;
  for (const button of section.querySelectorAll('.global-table-controls button')) {
    button.setAttribute('aria-pressed', String(shown > 0 && button.dataset.reset !== 'true' && sizesShown.every((size) => size === button.dataset.tableSize)));
  }
}
const observed = new Set();
let serial = 0;
const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
  for (const { target } of entries) measure(target);
});

function readHeight(viewport) {
  if (viewport.closest('details:not([open])')) return null; // Closed tables are not drawn, so there is nothing to measure.
  const rows = [...viewport.querySelectorAll('tbody > tr')];
  let height = rows.slice(0, 28).reduce((sum, row) => sum + row.getBoundingClientRect().height, 0)
    + (viewport.querySelector('thead')?.getBoundingClientRect().height ?? 0)
    + (viewport.querySelector('caption')?.getBoundingClientRect().height ?? 0);
  if (!rows.length) {
    const items = [...viewport.querySelectorAll(':scope > article, :scope > ul > li')].slice(0, 28);
    if (items.length) height = items.at(-1).getBoundingClientRect().bottom - items[0].getBoundingClientRect().top;
  }
  return height;
}
const measureQueue = new Set();
function queueMeasure(viewport) {
  if (measureQueue.has(viewport)) return;
  if (!measureQueue.size) requestAnimationFrame(flushMeasure);
  measureQueue.add(viewport);
}
function flushMeasure() {
  const pending = [...measureQueue]; measureQueue.clear();
  const heights = pending.map((viewport) => (viewport.isConnected ? readHeight(viewport) : null));
  pending.forEach((viewport, index) => { if (heights[index] > 0) viewport.style.setProperty('--table-normal-height', `${Math.ceil(heights[index]) + 2}px`); });
}
function measure(viewport) { queueMeasure(viewport); }

// Empty tables show one full-width placeholder row; those are not attempts.
function dataRowCount(viewport) {
  const body = viewport.querySelector('tbody');
  if (!body) return rowCount(viewport);
  for (const row of body.rows) if (!(row.cells.length === 1 && row.cells[0].colSpan > 1)) return 1;
  return 0;
}

function rowCount(viewport) {
  return viewport.querySelector('tbody')?.rows.length ?? viewport.querySelectorAll(':scope > article, :scope > ul > li').length;
}

export function enhanceHistoryTables(root) {
  globalControls(root);
  const historyPage = root.closest('.screen');
  if (historyPage?.id === HISTORY_PAGE_ID) historySection(historyPage);
  for (const viewport of observed) if (!viewport.isConnected) { observer?.unobserve(viewport); observed.delete(viewport); }
  for (const table of root.querySelectorAll('table')) {
    let viewport = table.closest('.history-table-viewport');
    if (!viewport) {
      viewport = table.parentElement.matches('.table-wrap, .table-scroll') ? table.parentElement : document.createElement('div');
      if (!viewport.contains(table)) { table.before(viewport); viewport.append(table); }
      const section = table.closest('section, article, dialog');
      const label = table.querySelector('caption')?.textContent || section?.querySelector('h3, h4, h2')?.textContent || 'History details';
      const key = table.querySelector('tbody[id]')?.id || viewport.parentElement.id || `${section?.id || section?.dataset.chartId || label}:table`;
      enhanceHistoryList(viewport, key, label, tableExplanation(label, [...table.querySelectorAll('thead th')].map((th) => th.textContent)));
    }
    const shell = viewport.parentElement;
    shell.querySelector('.history-table-count').textContent = `${table.tBodies[0]?.rows.length ?? 0} rows · ${shell.dataset.tableSize} view`;
    queueMeasure(viewport);
  }
  if (historyPage?.id === HISTORY_PAGE_ID) adoptLooseShells(historyPage);
  if (document.getElementById(SECTION_ID)) refreshSection();
}

export function enhanceHistoryList(viewport, key, label, explanation = LIST_EXPLANATIONS[key] ?? tableExplanation(label)) {
  globalControls(viewport);
  if (viewport.classList.contains('history-table-viewport')) {
    viewport.parentElement.querySelector('.history-table-count').textContent = `${rowCount(viewport)} rows · ${viewport.parentElement.dataset.tableSize} view`;
    queueMeasure(viewport);
    return;
  }
  const shell = document.createElement('div');
  shell.className = 'history-table-container';
  viewport.before(shell);
  shell.append(viewport);
  const page = shell.closest('.screen');
  const inHistory = page?.id === HISTORY_PAGE_ID;
  viewport.classList.add('history-table-viewport');
  viewport.id ||= `history-table-viewport-${++serial}`;
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', `${label} scrollable details`);
  const toolbar = document.createElement('div');
  toolbar.className = 'history-table-controls';
  const title = document.createElement('strong'); title.textContent = label;
  const count = document.createElement('span'); count.className = 'history-table-count'; count.setAttribute('role', 'status');
  toolbar.append(title, count);
  const buttons = [];
  const setSize = size => {
    sizes.set(key, size); shell.dataset.tableSize = size; viewport.hidden = size === 'minimized';
    count.textContent = `${rowCount(viewport)} rows · ${size} view`;
    for (const [button, value] of buttons) { button.setAttribute('aria-pressed', String(value === size)); button.setAttribute('aria-expanded', String(size !== 'minimized')); }
    if (shell.closest('#' + SECTION_ID)) refreshSection();
    queueMeasure(viewport);
  };
  for (const [text, value] of [['Minimize Table', 'minimized'], ['Normal Table', 'normal'], ['Expand Table', 'expanded']]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button'; button.textContent = text;
    button.setAttribute('aria-controls', viewport.id); button.addEventListener('click', () => setSize(value));
    toolbar.append(button); buttons.push([button, value]);
  }
  const note = createExplanation(explanation, 'What this table shows');
  note.open = openExplanations.has(key);
  note.addEventListener('toggle', () => { if (note.open) openExplanations.add(key); else openExplanations.delete(key); });
  shell.prepend(toolbar, note);
  setters.set(shell, setSize);
  setSize(sizes.get(key) ?? DEFAULT_SIZE);
  if (inHistory) { adoptShell(page, shell); scheduleRefresh(); }
  if (!observed.has(viewport)) { observed.add(viewport); observer?.observe(viewport); }
}
