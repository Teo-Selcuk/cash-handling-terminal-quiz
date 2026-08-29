import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DENOMINATIONS,
  DIFFICULTY_CONFIG,
  MEMORY_MODE_CONFIG,
  buildBreakdown,
  countTotalCents,
  createMemoryChallenge,
  createQuestion,
  formatMoney,
  parseCashShorthand,
  parseAmountToCents,
  scoreMemoryAnswer,
  scoreAnswer,
  summarizeHistory,
  toCsv,
} from '../quiz-core.mjs';

test('formats integer cents as US currency', () => {
  assert.equal(formatMoney(0), '$0.00');
  assert.equal(formatMoney(1234), '$12.34');
  assert.equal(formatMoney(250000), '$2,500.00');
});

test('parses valid monetary answers without floating point rounding', () => {
  assert.equal(parseAmountToCents('$1,234.50'), 123450);
  assert.equal(parseAmountToCents('.5'), 50);
  assert.equal(parseAmountToCents('12.345'), null);
  assert.equal(parseAmountToCents('-1'), null);
});

test('builds a valid denomination breakdown for bills and coins', () => {
  const breakdown = buildBreakdown(9003, DENOMINATIONS, 4, () => 0.31);
  assert.equal(countTotalCents(breakdown), 9003);
  assert.ok(breakdown.some((item) => item.cents === 1));
  assert.ok(breakdown.every((item) => item.count > 0));
});

test('generates questions that obey each difficulty contract', () => {
  for (const level of Object.keys(DIFFICULTY_CONFIG)) {
    const config = DIFFICULTY_CONFIG[level];
    for (let index = 0; index < 50; index += 1) {
      const question = createQuestion(level);
      assert.ok(question.dueCents >= config.minDue);
      assert.ok(question.dueCents <= config.maxDue);
      assert.equal(question.dueCents % config.step, 0);
      assert.ok(question.tenderedCents >= 100);
      assert.notEqual(question.tenderedCents % 100, 0);
      assert.equal(countTotalCents(question.breakdown), question.tenderedCents);

      if (question.expectedType === 'Change') {
        assert.equal(question.tenderedCents - question.dueCents, question.expectedAmountCents);
      } else if (question.expectedType === 'Short') {
        assert.equal(question.dueCents - question.tenderedCents, question.expectedAmountCents);
      } else {
        assert.equal(question.tenderedCents, question.dueCents);
        assert.equal(question.expectedAmountCents, 0);
      }
    }
  }
});

test('requires a matching cash-builder total only when cash-builder mode is enabled', () => {
  const question = { expectedType: 'Change', expectedAmountCents: 9003 };
  const validBreakdown = buildBreakdown(9003);
  const wrongBreakdown = buildBreakdown(9002);

  assert.equal(scoreAnswer(question, { type: 'Change', amountCents: 9003 }, false).correct, true);
  assert.equal(scoreAnswer(question, { type: 'Change', amountCents: 9003, breakdown: wrongBreakdown }, true).correct, false);
  assert.equal(scoreAnswer(question, { type: 'Change', amountCents: 9003, breakdown: validBreakdown }, true).correct, true);
});

test('parses fast cash-builder shorthand with bill and coin acronyms', () => {
  const parsed = parseCashShorthand('2x$10, one $1 bill, 2d, two quarters');

  assert.equal(parsed.valid, true);
  assert.equal(parsed.totalCents, 2170);
  assert.deepEqual(parsed.breakdown.map(({ cents, count }) => ({ cents, count })), [
    { cents: 1000, count: 2 },
    { cents: 100, count: 1 },
    { cents: 25, count: 2 },
    { cents: 10, count: 2 },
  ]);
  assert.equal(parseCashShorthand('2x$10, mystery-token').valid, false);
});

test('creates ordered decimal memory challenges from configurable value and digit ranges', () => {
  assert.deepEqual(MEMORY_MODE_CONFIG.Easy, {
    minimumDigits: 4,
    maximumDigits: 6,
    minimumValues: 1,
    maximumValues: 2,
    decimals: true,
    readSeconds: 5,
    writeSeconds: 10,
  });

  const challenge = createMemoryChallenge('Easy', {
    minimumDigits: 4,
    maximumDigits: 4,
    minimumValues: 3,
    maximumValues: 3,
    decimals: true,
    readSeconds: 4,
    writeSeconds: 8,
  }, () => 0.25);

  assert.deepEqual(challenge.values, ['3.222', '3.222', '3.222']);
  assert.deepEqual(challenge.digitsByValue, [4, 4, 4]);
  assert.equal(challenge.valueCount, 3);
  assert.equal(challenge.readSeconds, 4);
  assert.equal(challenge.writeSeconds, 8);
  assert.equal(scoreMemoryAnswer(challenge, ['3.222', '3.222', '3.222']).correct, true);
  assert.equal(scoreMemoryAnswer(challenge, ['3.222', '322.2', '3.222']).correct, false);
  assert.equal(scoreMemoryAnswer(challenge, ['3.222', '3.222']).correct, false);

  const upperRangeChallenge = createMemoryChallenge('Easy', {
    minimumDigits: 4,
    maximumDigits: 6,
    minimumValues: 1,
    maximumValues: 5,
    decimals: true,
  }, () => 0.999999);
  assert.equal(upperRangeChallenge.valueCount, 5);
  assert.deepEqual(upperRangeChallenge.digitsByValue, [6, 6, 6, 6, 6]);
  assert.ok(upperRangeChallenge.values.every((value) => /^\d+\.\d+$/.test(value)));
});

test('keeps one-value non-decimal memory challenges compatible with spaced answers', () => {
  const challenge = createMemoryChallenge('Medium', {
    minimumDigits: 6,
    maximumDigits: 6,
    minimumValues: 1,
    maximumValues: 1,
    decimals: false,
    readSeconds: 4,
    writeSeconds: 8,
  }, () => 0.25);

  assert.deepEqual(challenge.values, ['322222']);
  assert.equal(scoreMemoryAnswer(challenge, '322 222').correct, true);
  assert.equal(scoreMemoryAnswer(challenge, '322223').correct, false);
});

test('scores Exact, Change, and Short answers in normal mode', () => {
  const cases = [
    { expectedType: 'Exact', expectedAmountCents: 0, answer: { type: 'Exact', amountCents: 0 } },
    { expectedType: 'Change', expectedAmountCents: 725, answer: { type: 'Change', amountCents: 725 } },
    { expectedType: 'Short', expectedAmountCents: 340, answer: { type: 'Short', amountCents: 340 } },
  ];

  for (const { expectedType, expectedAmountCents, answer } of cases) {
    const score = scoreAnswer({ expectedType, expectedAmountCents }, answer, false);
    assert.equal(score.correct, true, `${expectedType} should be accepted without the cash builder`);
  }
});

test('summarizes saved answers for outcome diagrams and the accuracy chart', () => {
  const summary = summarizeHistory([
    { difficulty: 'Easy', outcome: 'Correct' },
    { difficulty: 'Easy', outcome: 'Incorrect' },
    { difficulty: 'Medium', outcome: 'Timed Out' },
    { difficulty: 'Hard', outcome: 'Correct' },
  ]);

  assert.deepEqual(summary.outcomes, [
    { key: 'correct', label: 'Correct', count: 2, percent: 50 },
    { key: 'incorrect', label: 'Incorrect', count: 1, percent: 25 },
    { key: 'timedOut', label: 'Timed out', count: 1, percent: 25 },
  ]);
  assert.deepEqual(summary.byDifficulty, [
    { level: 'Easy', answered: 2, correct: 1, accuracyPercent: 50 },
    { level: 'Medium', answered: 1, correct: 0, accuracyPercent: 0 },
    { level: 'Hard', answered: 1, correct: 1, accuracyPercent: 100 },
  ]);
});

test('cash-builder styling honors the hidden attribute when the mode is off', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.cash-builder\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
});

test('cash-builder controls meet the 44px mobile touch-target minimum', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.quantity-button\s*\{[^}]*width:\s*2\.75rem;[^}]*height:\s*2\.75rem;/s);
});

test('makes learners total the tendered cash and explains which cash to build', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(html, /id="amount-tendered"/);
  assert.match(html, /Add these bills and coins yourself/);
  assert.match(html, /id="cash-builder-purpose"/);
  assert.doesNotMatch(app, /amount-tendered/);
  assert.match(app, /Build the change you would give the customer in bills and coins\./);
  assert.match(app, /Build the additional bills and coins the customer still needs to give\./);
});

test('offers adjustable memory ranges and a single clean cash-entry focus boundary', async () => {
  const [html, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="memory-value-min"/);
  assert.match(html, /id="memory-value-max"/);
  assert.match(html, /id="memory-digit-min"/);
  assert.match(html, /id="memory-digit-max"/);
  assert.match(html, /id="memory-decimals"/);
  assert.match(html, /id="memory-answer-list"/);
  assert.doesNotMatch(html, /id="memory-digits"/);
  assert.match(css, /\.currency-input:focus-within\s*\{[^}]*outline:/s);
  assert.match(css, /\.currency-input input:focus-visible\s*\{[^}]*outline:\s*none;/s);
});

test('cache-busts the stylesheet so mobile fixes reach returning visitors', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /href="style\.css\?v=[^"]+"/);
});

test('exports history as escaped CSV with a header row', () => {
  const csv = toCsv([{ timestamp: '2026-08-27T12:00:00.000Z', outcome: 'Correct', note: 'Quarter, then "dime"' }]);
  assert.match(csv, /^timestamp,outcome,note\r?\n/);
  assert.match(csv, /"Quarter, then ""dime"""/);
});
