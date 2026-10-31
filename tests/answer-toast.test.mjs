import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answerToastContent, shortenToastText, ANSWER_TOAST_CORRECT_MS, ANSWER_TOAST_WRONG_MS, ANSWER_TOAST_MAX_TEXT } from '../answer-toast.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const cash = (extra = {}) => ({
  gameType: 'Cash handling', questionNumber: 3, outcome: 'Incorrect', expectedAnswer: 'Give $3.25 in change',
  userAnswer: 'Short', userDeclaredAmount: '$3.25', userCashBreakdown: '', recommendedBreakdown: '3 x $1, 1 x 25¢', ...extra,
});

test('a correct answer says Correct, shows the answer given, and stays 3 seconds', () => {
  const content = answerToastContent(cash({ outcome: 'Correct', userAnswer: 'Change' }), { game: 'cash' });
  assert.equal(content.result, 'correct');
  assert.equal(content.title, 'Correct');
  assert.equal(content.kicker, 'Cash handling · Question 3');
  assert.deepEqual(content.lines, [['Your answer', 'Change $3.25']]);
  assert.equal(content.durationMs, ANSWER_TOAST_CORRECT_MS);
  assert.equal(ANSWER_TOAST_CORRECT_MS, 3000);
});

test('a wrong answer says Wrong and states the right answer with the answer given, for 4 seconds', () => {
  const content = answerToastContent(cash());
  assert.equal(content.result, 'incorrect');
  assert.equal(content.title, 'Wrong');
  assert.deepEqual(content.lines, [['Correct answer', 'Give $3.25 in change'], ['Your answer', 'Short $3.25']]);
  assert.equal(content.durationMs, ANSWER_TOAST_WRONG_MS);
  assert.equal(ANSWER_TOAST_WRONG_MS, 4000);
});

test('a timeout says the time ran out and still states the right answer', () => {
  const content = answerToastContent(cash({ outcome: 'Timed Out', userAnswer: '', userDeclaredAmount: '' }));
  assert.equal(content.result, 'timeout');
  assert.match(content.title, /Time's up/);
  assert.deepEqual(content.lines, [['Correct answer', 'Give $3.25 in change']]);
});

test('a wrong cash builder round also shows the cash to give and the cash picked', () => {
  const content = answerToastContent(cash({ userAnswer: 'Change', userCashTotal: '$3.00', userCashBreakdown: '3 x $1' }));
  assert.deepEqual(content.lines.map(([label]) => label), ['Correct answer', 'Your answer', 'Cash to give', 'Your cash']);
  assert.equal(content.lines[2][1], '3 x $1, 1 x 25¢');
});

test('each game names its right answer from its saved record', () => {
  const memory = answerToastContent({ gameType: 'Number memory', questionNumber: 1, outcome: 'Incorrect', expectedAnswer: 'Values: 12 • 34', userAnswer: '12 • 43' });
  assert.equal(memory.kicker, 'Number memory · Question 1');
  assert.deepEqual(memory.lines, [['Correct answer', '12 • 34'], ['Your answer', '12 • 43']]);
  const errors = answerToastContent({ gameType: 'Error detection', questionNumber: 2, outcome: 'Incorrect', expectedAnswer: 'Row 3', userAnswer: 'No clues marked.' });
  assert.deepEqual(errors.lines, [['Correct answer', 'Row 3'], ['Your answer', 'No clues marked.']]);
  const task = answerToastContent({ gameType: 'Task simulation', questionNumber: 2, outcome: 'Incorrect', expectedAnswer: '3 ordered steps' },
    { correctAnswer: '1. Open 2. Save 3. Close', yourAnswer: '1 of 3 steps in order' });
  assert.deepEqual(task.lines, [['Correct answer', '1. Open 2. Save 3. Close'], ['Your answer', '1 of 3 steps in order']]);
  const fraud = answerToastContent({ game: 'fraud-inspection', questionNumber: 4, outcome: 'Incorrect', expectedAnswer: 'x' },
    { correctAnswer: 'Expired ID', yourAnswer: 'No issues found', more: [['Hold decision', 'Accept · No hold']] });
  assert.equal(fraud.kicker, 'Check & ID fraud inspection · Question 4');
  assert.deepEqual(fraud.lines.map(([label]) => label), ['Correct answer', 'Your answer', 'Hold decision']);
});

test('typing shows its speed when exact and the expected text when not, shortened to fit', () => {
  const passage = 'word '.repeat(80).trim();
  const exact = answerToastContent({ game: 'typing', questionNumber: 1, outcome: 'Correct', expectedAnswer: passage, userAnswer: passage, wpm: 41.25, accuracyPercent: 100 });
  assert.deepEqual(exact.lines, [['Speed', '41.3 WPM · 100% character accuracy']]);
  const wrong = answerToastContent({ game: 'typing', questionNumber: 1, outcome: 'Incorrect', expectedAnswer: passage, userAnswer: 'wrod', wpm: 5, accuracyPercent: 20 });
  assert.equal(wrong.lines[0][0], 'Correct answer');
  assert.ok(wrong.lines[0][1].length <= ANSWER_TOAST_MAX_TEXT);
  assert.ok(wrong.lines[0][1].endsWith('…'));
  assert.equal(shortenToastText('  a \n b  '), 'a b');
});

test('every auto-continue path shows the note before moving on, and the note never takes focus', () => {
  const app = read('app.js');
  for (const next of ['showNextQuestion', 'showNextMemoryQuestion', 'showNextErrorDetectionQuestion', 'showNextTaskQuestion']) {
    assert.match(app, new RegExp(`if \\(state\\.autoContinue\\) \\{\\r?\\n    showAnswerToast\\(record[^]*?\\n    ${next}\\(\\);`), next);
  }
  assert.match(app, /if \(state\.autoContinue\) \{ showAnswerToast\(record\); showNextTypingRound\(\); return; \}/);
  assert.match(app, /if \(shouldAutoAdvance && !state\.fraudStoppedEarly\) \{[^]*?showAnswerToast\(record, \{/);
  assert.doesNotMatch(app, /answer-toast'\]\.focus/);
  const html = read('index.html');
  assert.match(html, /<aside id="answer-toast" class="answer-toast" role="status" aria-live="polite" aria-atomic="true" hidden>/);
  const css = read('style.css');
  assert.match(css, /\.answer-toast \{ position: fixed;[^}]*top: 1rem; right: 1rem;[^}]*pointer-events: none;/);
});
