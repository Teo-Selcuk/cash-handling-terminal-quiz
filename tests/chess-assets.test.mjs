import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('pinned local chess dependencies retain their release bytes and licenses', async () => {
  for (const [file, expected] of [
    ['chess.mjs', '76c7c34f0e2e9ab076521a5d6fe786a9cce537bb1b6f29d32a9c9970b5b232d2'],
    ['stockfish-19-lite-single.js', 'd3344124ab067fb0b90ee77873bb8e9fbf5fc01bc525fe714b0f942581e889e6'],
    ['stockfish-19-lite-single.wasm', '57ac2d72312aba346760e3f173f687a8c211208e97a87268436f7f0e10bb5387'],
  ]) assert.equal(createHash('sha256').update(await readFile(new URL(`../assets/chess/${file}`, import.meta.url))).digest('hex'), expected, file);
  assert.match(await readFile(new URL('../assets/chess/chess-LICENSE', import.meta.url), 'utf8'), /Redistribution/);
  assert.match(await readFile(new URL('../assets/chess/stockfish-COPYING.txt', import.meta.url), 'utf8'), /GNU GENERAL PUBLIC LICENSE/);
  assert.match(await readFile(new URL('../assets/chess/README.md', import.meta.url), 'utf8'), /tree\/v19\.0\.0/);
});

test('Pages assembly includes every chess module and all locally referenced chess assets', async () => {
  const workflow = await readFile(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /cp chess-\*\.mjs _site\//);
  assert.match(workflow, /cp assets\/chess\/\* _site\/assets\/chess\//);
  const files = (await readdir(new URL('../', import.meta.url))).filter(f => /^chess-.*\.mjs$/.test(f));
  for (const file of files) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const [, path] of text.matchAll(/(?:from |new URL\()['"](\.\/[^'"]+)['"]/g)) await readFile(new URL(`../${path.slice(2)}`, import.meta.url));
  }
});
