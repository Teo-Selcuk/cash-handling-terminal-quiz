import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../history-tables.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('History tables live in one "All tables" section that starts collapsed', () => {
  assert.match(source, /createElement\('details'\)/, 'the section is a details element');
  assert.match(source, /textContent = 'All tables'/);
  assert.doesNotMatch(source, /section\.open\s*=\s*true|setAttribute\('open'/, 'it is never opened by default');
  assert.match(source, /No attempts yet/, 'empty state message');
  assert.match(source, /history-all-tables/);
});

test('Minimize and Expand all sit inside the section and every control stays in sync', () => {
  assert.match(source, /Minimize All Tables/);
  assert.match(source, /Expand All Tables/);
  assert.match(source, /aria-pressed/, 'global buttons mirror the per-table state');
  assert.match(source, /page\.id === HISTORY_PAGE_ID\) return/, 'History keeps the buttons in the section, not above it');
});

test('closed tables are not measured or drawn, and chart data tables stay inside their charts', () => {
  assert.match(source, /closest\('details:not\(\[open\]\)'\)/);
  assert.match(source, /\.chart-table-alternative/);
  assert.match(css, /\.all-tables-section/);
  assert.match(css, /chess-history-selected[^{]*:not\(#history-all-tables\)/, 'the section stays visible on the Chess tab');
});

test('the History table module and stylesheet are preloaded under the version app.js imports', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const imported = app.match(/history-tables\.mjs\?v=([\w-]+)/)[1];
  assert.match(html, new RegExp(`history-tables\\.mjs\\?v=${imported}`));
  assert.match(html, /style\.css\?v=[\w-]+/);
});
