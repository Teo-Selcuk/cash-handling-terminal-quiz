import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeAmount, readAmountCents, attachAmountFilter, AMOUNT_MAX_LENGTH } from '../amount-input.mjs';
import { numpadChoice } from '../numpad-shortcuts.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('index.html');

// A small stand-in for an <input>: enough for the filter's beforeinput and input listeners.
class FakeInput extends EventTarget {
  constructor(value = '') { super(); this.value = value; this.selectionStart = value.length; this.selectionEnd = value.length; }
  setRangeText(text, start, end) { this.value = this.value.slice(0, start) + text + this.value.slice(end); this.selectionStart = this.selectionEnd = start + text.length; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
}

function type(input, data) {
  const event = new Event('beforeinput', { cancelable: true });
  Object.assign(event, { inputType: 'insertText', data });
  input.dispatchEvent(event);
  if (event.defaultPrevented) return;
  input.setRangeText(data, input.selectionStart, input.selectionEnd);
  input.dispatchEvent(new Event('input'));
}

function paste(input, text) {
  input.setRangeText(text, input.selectionStart, input.selectionEnd);
  input.dispatchEvent(new Event('input'));
}

function filtered(value = '', options = {}) {
  const messages = [];
  const input = new FakeInput(value);
  attachAmountFilter(input, { ...options, onRemoved: (message) => messages.push(message) });
  return { input, messages };
}

const key = (code, target = { tagName: 'BODY' }) => ({ code, target });
const amountBox = { tagName: 'INPUT', type: 'text', dataset: { optionShortcuts: 'true' } };

test('keypad / * - pick Exact, Change, and Short on the page, on a choice, and inside the amount box', () => {
  for (const target of [{ tagName: 'BODY' }, { tagName: 'INPUT', type: 'radio' }, amountBox]) {
    assert.equal(numpadChoice(key('NumpadDivide', target), { active: true }), 'Exact');
    assert.equal(numpadChoice(key('NumpadMultiply', target), { active: true }), 'Change');
    assert.equal(numpadChoice(key('NumpadSubtract', target), { active: true }), 'Short');
  }
  // Other text boxes (fast cash entry, working notes) keep their keys.
  assert.equal(numpadChoice(key('NumpadSubtract', { tagName: 'INPUT', type: 'text', dataset: {} }), { active: true }), null);
  assert.equal(numpadChoice(key('Minus', amountBox), { active: true }), null, 'the main keyboard minus is not a shortcut');
  assert.match(html, /id="answer-amount"[^>]*data-option-shortcuts="true"/);
});

test('picking an answer keeps focus out of the cash builder and keeps the typed amount and cash counts', () => {
  const shortcut = app.slice(app.indexOf('// Number keypad shortcuts pick Exact'), app.indexOf('// Keypad shortcuts for the list games'));
  // Focus goes only to the chosen answer or the amount box, never to a denomination control.
  assert.match(shortcut, /\(choice !== 'Exact' && !amount\.disabled && amount\.getClientRects\(\)\.length \? amount : input\)\.focus/);
  assert.doesNotMatch(shortcut, /cash-builder|quick-cash-entry|denomination|builderCounts/);
  const change = app.slice(app.indexOf("document.querySelectorAll('input[name=\"answerType\"]').forEach"), app.indexOf("refs['answer-amount'].addEventListener('input', updateCashBuilder)"));
  assert.match(change, /refs\['answer-amount'\]\.disabled = selectedAnswerType\(\) === 'Exact'/);
  assert.doesNotMatch(change, /\.value = ''|resetBuilder|builderCounts|\.focus\(/, 'switching clears nothing and moves no focus');
  // Clicks and keys share the same change handler: the shortcut checks the choice and fires the same event.
  assert.match(shortcut, /input\.checked = true;\s*input\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
});

test('allowed amounts pass unchanged and read as cents', () => {
  for (const [text, cents] of [['12', 1200], ['12.3', 1230], ['12.35', 1235], ['.5', 50], ['12.', 1200]]) {
    assert.deepEqual(sanitizeAmount(text), { value: text, caret: null, removed: false, tooLong: false });
    assert.deepEqual(readAmountCents(text), { status: 'ok', cents });
  }
});

test('typing blocks letters, symbols, spaces, a second point, and a third decimal digit', () => {
  const { input, messages } = filtered();
  for (const char of '1a2 +-*/,$%3.4.5x6') type(input, char);
  // The "," arrives before any "." so it becomes the decimal point; later points and the third decimal are blocked.
  assert.equal(input.value, '12.34');
  assert.deepEqual(messages, []);
  const second = filtered('12.3');
  type(second.input, '.');
  type(second.input, '4');
  type(second.input, '5');
  assert.equal(second.input.value, '12.34', 'a third decimal digit is blocked');
});

test('the numpad decimal key, the period, and a mobile comma all enter the decimal point', () => {
  for (const char of ['.', ',']) {
    const { input } = filtered('7');
    type(input, char);
    type(input, '5');
    assert.equal(input.value, '7.5');
  }
});

test('pasting keeps only valid characters and says characters were removed', () => {
  const money = filtered();
  paste(money.input, '$1,234.56abc');
  assert.equal(money.input.value, '1234.56');
  assert.equal(money.messages.length, 1);
  assert.match(money.messages[0], /characters were removed/);
  const points = filtered();
  paste(points.input, '1.2.3');
  assert.equal(points.input.value, '1.23', 'only the first point is kept');
  assert.equal(points.messages.length, 1);
  assert.equal(sanitizeAmount('1.2.3').value, '1.23');
});

test('long entries are capped with a message', () => {
  const { input, messages } = filtered();
  paste(input, '12345678901234');
  assert.equal(input.value.length, AMOUNT_MAX_LENGTH);
  assert.match(messages[0], /at most 10 characters/);
  type(input, '9');
  assert.equal(input.value.length, AMOUNT_MAX_LENGTH);
});

test('the caret stays where it was after removed characters', () => {
  assert.deepEqual(sanitizeAmount('1a2b3', { caret: 4 }), { value: '123', caret: 2, removed: true, tooLong: false });
});

test('a blank box or a lone point is no answer, not zero', () => {
  assert.deepEqual(readAmountCents(''), { status: 'empty' });
  assert.deepEqual(readAmountCents('.'), { status: 'empty' });
  assert.deepEqual(readAmountCents('1.234'), { status: 'invalid' });
  assert.match(app, /typedAmount\.status === 'empty'\s*\? 'Enter the amount before submitting\.'/);
});

test('digit-only count fields accept digits and nothing else', () => {
  assert.equal(sanitizeAmount('1.5x', { decimal: false }).value, '15');
  const { input } = filtered('', { decimal: false });
  for (const char of '3.,4') type(input, char);
  assert.equal(input.value, '34');
});

test('editing keys are left to the browser; only inserted text is filtered', () => {
  const { input } = filtered('12.34');
  input.setSelectionRange(2, 2);
  for (const inputType of ['deleteContentBackward', 'deleteContentForward', 'insertLineBreak']) {
    const event = new Event('beforeinput', { cancelable: true });
    Object.assign(event, { inputType, data: null });
    input.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, `${inputType} is not blocked`);
  }
  // The filter adds no keydown listener, so arrows, Home, End, Tab, and Enter keep working.
  assert.doesNotMatch(read('amount-input.mjs'), /keydown/);
});

test('the amount box shows the decimal keypad on phones and every amount box on the cash screen is filtered', () => {
  assert.match(html, /id="answer-amount"[^>]*inputmode="decimal"/);
  assert.match(html, /id="amount-input-message"[^>]*aria-live="polite"/);
  assert.match(app, /attachAmountFilter\(refs\['answer-amount'\]/);
  assert.match(app, /input\.inputMode = 'decimal'; input\.placeholder = '0\.00'; input\.autocomplete = 'off'; attachAmountFilter\(input/);
});
