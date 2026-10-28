import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roundEndAction, ROUND_END_GUARD_MS } from '../round-shortcuts.mjs';

const press = (key, extra = {}) => ({ key, code: '', target: { tagName: 'H2' }, ...extra });
const later = { shownAt: 0, now: ROUND_END_GUARD_MS + 1 };

test('Enter, keypad Enter and R replay; Escape and M return to the main menu', () => {
  assert.equal(roundEndAction(press('Enter'), later), 'replay');
  assert.equal(roundEndAction(press('Enter', { code: 'NumpadEnter' }), later), 'replay');
  assert.equal(roundEndAction(press('r'), later), 'replay');
  assert.equal(roundEndAction(press('R'), later), 'replay');
  assert.equal(roundEndAction(press('Escape'), later), 'menu');
  assert.equal(roundEndAction(press('m'), later), 'menu');
  assert.equal(roundEndAction(press('x'), later), null);
});

test('the key that ended the round, held keys, modifiers, typing and focused buttons do not trigger', () => {
  assert.equal(roundEndAction(press('Enter'), { shownAt: 1000, now: 1000 + ROUND_END_GUARD_MS - 1 }), null);
  assert.equal(roundEndAction(press('Enter', { repeat: true }), later), null);
  assert.equal(roundEndAction(press('r', { ctrlKey: true }), later), null);
  assert.equal(roundEndAction(press('r', { target: { tagName: 'TEXTAREA' } }), later), null);
  assert.equal(roundEndAction(press('Enter', { target: { tagName: 'BUTTON' } }), later), null, 'Enter presses the focused button instead');
  assert.equal(roundEndAction(press('Escape', { target: { tagName: 'BUTTON' } }), later), 'menu');
  assert.equal(roundEndAction(press('Enter', { defaultPrevented: true }), later), null);
});

test('every game end screen offers replay and main menu with the keys shown', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const overload = readFileSync(new URL('../overload-ui.mjs', import.meta.url), 'utf8');
  const chess = readFileSync(new URL('../chess-ui.mjs', import.meta.url), 'utf8');
  // Cash, memory, task, error detection, fraud inspection and typing all finish on the shared summary screen.
  assert.match(html, /id="play-again"[^>]*>Play again · same settings \(Enter\)</);
  assert.match(html, /id="start-another"[^>]*>Main menu \(Esc\)</);
  assert.match(app, /state\.activeScreen !== 'summary'[\s\S]{0,200}roundEndAction/);
  assert.match(app, /function replaySameSettings\(\) \{\s*refs\['setup-form'\]\.requestSubmit\(\);/);
  assert.match(overload, /Another run · same settings \(Enter\)/);
  assert.match(overload, /roundEndAction\(e,\{shownAt:finishedAt\}\)/);
  assert.match(chess, /roundEndAction\(event, \{ shownAt: resultShownAt \}\)/);
  assert.match(html, /id="chess-rematch" hidden>Rematch \(Enter\)</);
});
