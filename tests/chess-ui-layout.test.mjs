import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, board, ui] = await Promise.all(['index.html', 'style.css', 'chess-board.mjs', 'chess-ui.mjs']
  .map((file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));

const hex = (value) => value.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16) / 255);
const luminance = (color) => {
  const [r, g, b] = hex(color).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const last = (pattern) => [...css.matchAll(pattern)].at(-1)?.[1];

test('the chess board keeps a square shape and fits the window height', () => {
  assert.match(css, /#chess-screen \.chess-board \{ aspect-ratio: 1 \/ 1;/);
  assert.match(css, /#chess-screen \.chess-board, #chess-screen \.chess-clocks \{ width: min\(100%, max\(18rem, calc\(100dvh - [\d.]+rem\)\)\);/);
});

test('board, move list, and controls are separate panels', () => {
  const layout = html.slice(html.indexOf('<div class="chess-layout">'), html.indexOf('</aside>'));
  assert.ok(layout.indexOf('id="chess-board"') < layout.indexOf('<aside class="chess-sidebar">'), 'board in its own column');
  for (const id of ['chess-game-actions', 'chess-review', 'chess-moves-card']) assert.ok(layout.indexOf(`id="${id}"`) > layout.indexOf('<aside class="chess-sidebar">'), `${id} in the tools column`);
});

test('pieces have readable contrast on both square colors', () => {
  const light = last(/button\.chess-square\.square-light \{ background: (#[0-9a-f]{6}); \}/gi);
  const dark = last(/button\.chess-square\.square-dark \{ background: (#[0-9a-f]{6}); \}/gi);
  const white = css.match(/\[data-piece-color="w"\] \.piece-body \{ fill: (#[0-9a-f]{6}); stroke: (#[0-9a-f]{6}); \}/i);
  const black = css.match(/\[data-piece-color="b"\] \.piece-body \{ fill: (#[0-9a-f]{6}); stroke: (#[0-9a-f]{6}); \}/i);
  assert.ok(contrast(black[1], light) >= 3 && contrast(black[1], dark) >= 3, 'black pieces on both squares');
  assert.ok(contrast(white[1], dark) >= 3, 'white pieces on dark squares');
  assert.ok(contrast(white[2], light) >= 3, 'white piece outline on light squares');
  assert.ok(contrast(white[1], black[1]) >= 7, 'the two sides are clearly different');
  assert.match(board, /SHAPES = \{[\s\S]*p:[\s\S]*r:[\s\S]*n:[\s\S]*b:[\s\S]*q:[\s\S]*k:/, 'solid SVG shape for every piece');
  assert.doesNotMatch(board, /♙|♔/, 'no hollow glyphs that look alike');
});

test('review has visible first, previous, next, and last controls with a move counter', () => {
  for (const id of ['first', 'prev', 'next', 'last']) assert.match(html, new RegExp(`id="chess-review-${id}"`));
  assert.match(html, /id="chess-review-position"/);
  assert.match(ui, /el\('review-first'\)\.addEventListener/);
  assert.match(ui, /el\('review-last'\)\.addEventListener/);
  assert.match(ui, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowRight'/);
});
