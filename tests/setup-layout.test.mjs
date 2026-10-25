import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../style.css', import.meta.url), 'utf8'),
]);

test('setup game cards share one width and one row height', () => {
  const grid = html.match(/<div class="choice-grid game-choice-grid">([\s\S]*?)<\/div>/)[1];
  const cards = grid.match(/<label class="choice-card">/g) ?? [];
  assert.equal(cards.length, 9, 'nine game cards with the same markup class');
  assert.match(css, /\.game-choice-grid \{ grid-auto-rows: 1fr; \}/, 'all rows match the tallest card');
  assert.match(css, /\.game-choice-grid > \.choice-card \{[^}]*height: 100%[^}]*\}/);
  assert.match(css, /\.game-choice-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/, 'equal column widths');
  assert.match(css, /\.game-choice-grid > \.choice-card small \{ overflow-wrap: anywhere; \}/, 'long text wraps inside the card');
});

test('selected state is one shared rule for every card', () => {
  assert.match(css, /\.choice-card:has\(input:checked\), \.toggle-row:has\(input:checked\) \{ border-color: var\(--brand\);/);
  assert.match(css, /\.choice-card:has\(input:checked\) \{ box-shadow: inset 0 0 0 0\.0625rem var\(--brand\); \}/);
  assert.doesNotMatch(css, /input\[value="(?:cash|memory|task|error-detection|fraud-inspection|typing|overload|chess)"\]:checked/, 'no per-game selected style');
});
