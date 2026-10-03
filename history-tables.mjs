// Shared presentation for tables and chess history lists; gameplay storage is untouched.
const sizes = new Map();
const observed = new Set();
let serial = 0;
const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
  for (const { target } of entries) measure(target);
});

function measure(viewport) {
  const rows = [...viewport.querySelectorAll('tbody > tr')];
  let height = rows.slice(0, 28).reduce((sum, row) => sum + row.getBoundingClientRect().height, 0)
    + (viewport.querySelector('thead')?.getBoundingClientRect().height ?? 0)
    + (viewport.querySelector('caption')?.getBoundingClientRect().height ?? 0);
  if (!rows.length) {
    const items = [...viewport.querySelectorAll(':scope > article, :scope > ul > li')].slice(0, 28);
    if (items.length) height = items.at(-1).getBoundingClientRect().bottom - items[0].getBoundingClientRect().top;
  }
  if (height > 0) viewport.style.setProperty('--table-normal-height', `${Math.ceil(height) + 2}px`);
}

function rowCount(viewport) {
  return viewport.querySelector('tbody')?.rows.length ?? viewport.querySelectorAll(':scope > article, :scope > ul > li').length;
}

export function enhanceHistoryTables(root) {
  for (const viewport of observed) if (!viewport.isConnected) { observer?.unobserve(viewport); observed.delete(viewport); }
  for (const table of root.querySelectorAll('table')) {
    let viewport = table.closest('.history-table-viewport');
    if (!viewport) {
      viewport = table.parentElement.matches('.table-wrap, .table-scroll') ? table.parentElement : document.createElement('div');
      if (!viewport.contains(table)) { table.before(viewport); viewport.append(table); }
      const section = table.closest('section, article, dialog');
      const label = table.querySelector('caption')?.textContent || section?.querySelector('h3, h4, h2')?.textContent || 'History details';
      const key = table.querySelector('tbody[id]')?.id || viewport.parentElement.id || `${section?.id || section?.dataset.chartId || label}:table`;
      enhanceHistoryList(viewport, key, label);
    }
    const shell = viewport.parentElement;
    shell.querySelector('.history-table-count').textContent = `${table.tBodies[0]?.rows.length ?? 0} rows · ${shell.dataset.tableSize} view`;
    requestAnimationFrame(() => measure(viewport));
  }
}

export function enhanceHistoryList(viewport, key, label) {
  if (viewport.classList.contains('history-table-viewport')) {
    viewport.parentElement.querySelector('.history-table-count').textContent = `${rowCount(viewport)} rows · ${viewport.parentElement.dataset.tableSize} view`;
    requestAnimationFrame(() => measure(viewport));
    return;
  }
  const shell = document.createElement('div');
  shell.className = 'history-table-container';
  viewport.before(shell);
  shell.append(viewport);
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
    requestAnimationFrame(() => measure(viewport));
  };
  for (const [text, value] of [['Minimize Table', 'minimized'], ['Normal Table', 'normal'], ['Expand Table', 'expanded']]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button'; button.textContent = text;
    button.setAttribute('aria-controls', viewport.id); button.addEventListener('click', () => setSize(value));
    toolbar.append(button); buttons.push([button, value]);
  }
  shell.prepend(toolbar);
  setSize(sizes.get(key) ?? 'normal');
  if (!observed.has(viewport)) { observed.add(viewport); observer?.observe(viewport); }
}
