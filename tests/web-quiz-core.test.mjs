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
  resolveCashDifficultyPreset,
  resolveMemoryDifficultyPreset,
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

test('resolves editable cash and memory presets without changing the built-in defaults', () => {
  const cashPreset = resolveCashDifficultyPreset('Easy', {
    minDue: 2500,
    maxDue: 40000,
    step: 5,
    maxDifference: 12000,
    splitCount: 3,
  });
  const customCashQuestion = createQuestion('Easy', () => 0.25, cashPreset);

  assert.equal(DIFFICULTY_CONFIG.Easy.maxDue, 20000);
  assert.deepEqual(cashPreset, {
    minDue: 2500,
    maxDue: 40000,
    step: 5,
    maxDifference: 12000,
    splitCount: 3,
    allowed: DENOMINATIONS.map((denomination) => denomination.cents),
  });
  assert.ok(customCashQuestion.dueCents >= 2500);
  assert.ok(customCashQuestion.dueCents <= 40000);
  assert.equal(customCashQuestion.dueCents % 5, 0);
  assert.throws(() => resolveCashDifficultyPreset('Easy', { minDue: 50000, maxDue: 40000 }), RangeError);

  const memoryPreset = resolveMemoryDifficultyPreset('Medium', {
    minimumDigits: 12,
    maximumDigits: 12,
    minimumValues: 4,
    maximumValues: 4,
    decimals: false,
    readSeconds: 9,
    writeSeconds: 20,
  });
  const customMemoryChallenge = createMemoryChallenge('Medium', memoryPreset, () => 0.25);

  assert.deepEqual(MEMORY_MODE_CONFIG.Medium, {
    minimumDigits: 6,
    maximumDigits: 8,
    minimumValues: 2,
    maximumValues: 3,
    decimals: true,
    readSeconds: 4,
    writeSeconds: 8,
  });
  assert.equal(customMemoryChallenge.valueCount, 4);
  assert.deepEqual(customMemoryChallenge.digitsByValue, [12, 12, 12, 12]);
  assert.equal(customMemoryChallenge.readSeconds, 9);
  assert.equal(customMemoryChallenge.writeSeconds, 20);
  assert.throws(() => resolveMemoryDifficultyPreset('Medium', { minimumValues: 8, maximumValues: 4 }), RangeError);
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
  const compact = parseCashShorthand('2x10, 2x100, 2D, 3Q, 4N, 5P');

  assert.equal(compact.valid, true);
  assert.equal(compact.totalCents, 22120);
  assert.deepEqual(compact.breakdown.map(({ cents, count }) => ({ cents, count })), [
    { cents: 10000, count: 2 },
    { cents: 1000, count: 2 },
    { cents: 25, count: 3 },
    { cents: 10, count: 2 },
    { cents: 5, count: 4 },
    { cents: 1, count: 5 },
  ]);
  assert.equal(parseCashShorthand('2x$10, mystery-token').valid, false);
});

test('documents compact cash-builder entries without dollar signs', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /2x10, 2x100/);
  assert.match(html, /2D, 3Q, 4N, 5P/);
  assert.match(html, /placeholder="2x10, 2D, 3Q"/);
  assert.match(app, /2x10, 2x100, 2D, 3Q, 4N, 5P/);
});

test('can auto-continue to the next timeout-free screen in either web game', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="auto-continue-toggle"/);
  assert.match(html, /immediately start the next question when an answer timer expires/);
  assert.match(app, /autoContinueOnTimeout: false,/);
  assert.match(app, /state\.autoContinueOnTimeout = refs\['auto-continue-toggle'\]\.checked;/);
  assert.match(app, /if \(timedOut && state\.autoContinueOnTimeout\) \{\s*showNextQuestion\(\);\s*return;\s*\}/s);
  assert.match(app, /if \(timedOut && state\.autoContinueOnTimeout\) \{\s*showNextMemoryQuestion\(\);\s*return;\s*\}/s);
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

test('supports up to 100 values with up to 100 digits each for memory rounds', () => {
  const largestChallenge = createMemoryChallenge('Hard', {
    minimumDigits: 100,
    maximumDigits: 100,
    minimumValues: 100,
    maximumValues: 100,
    decimals: false,
  }, () => 0.5);

  assert.equal(largestChallenge.valueCount, 100);
  assert.equal(largestChallenge.values.length, 100);
  assert.ok(largestChallenge.values.every((value) => /^\d{100}$/.test(value)));
  assert.throws(() => createMemoryChallenge('Easy', { maximumDigits: 101 }), RangeError);
  assert.throws(() => createMemoryChallenge('Easy', { maximumValues: 101 }), RangeError);
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

test('uses the saved memory preset as the only range and timing configuration', async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="preset-memory-value-min"[^>]*max="100"/);
  assert.match(html, /id="preset-memory-value-max"[^>]*max="100"/);
  assert.match(html, /id="preset-memory-digit-min"[^>]*max="100"/);
  assert.match(html, /id="preset-memory-digit-max"[^>]*max="100"/);
  assert.match(html, /id="preset-memory-decimals"/);
  assert.match(html, /id="memory-question-count"/);
  assert.doesNotMatch(html, /id="memory-value-min"/);
  assert.doesNotMatch(html, /id="memory-value-max"/);
  assert.doesNotMatch(html, /id="memory-digit-min"/);
  assert.doesNotMatch(html, /id="memory-digit-max"/);
  assert.doesNotMatch(html, /id="memory-decimals"/);
  assert.match(html, /id="memory-answer-list"/);
  assert.doesNotMatch(html, /id="memory-digits"/);
  assert.match(app, /maximumDigits \+ \(state\.memoryChallenge\.decimals \? 1 : 0\)/);
  assert.match(app, /createMemoryChallenge\(state\.difficulty, state\.memoryPresets\[state\.difficulty\]\)/);
  assert.doesNotMatch(app, /applyMemoryModeDefaults/);
  assert.doesNotMatch(app, /memoryMinimumDigits/);
  assert.doesNotMatch(app, /state\.memory(?:Read|Write)Seconds/);
  assert.match(css, /\.memory-answer-list\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.memory-values li > span:last-child\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(css, /\.currency-input:focus-within\s*\{[^}]*outline:/s);
  assert.match(css, /\.currency-input input:focus-visible\s*\{[^}]*outline:\s*none;/s);
});

test('offers saved, resettable presets for the selected game and difficulty', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="preset-editor"/);
  assert.match(html, /id="save-preset"/);
  assert.match(html, /id="reset-selected-preset"/);
  assert.match(html, /id="reset-all-presets"/);
  assert.match(html, /id="preset-cash-max-due"/);
  assert.match(html, /id="preset-memory-digit-max"/);
  assert.match(app, /PRESET_KEY/);
  assert.match(app, /resolveCashDifficultyPreset/);
  assert.match(app, /resolveMemoryDifficultyPreset/);
  assert.match(app, /saveSelectedPreset/);
  assert.match(app, /resetAllPresets/);
});

test('cache-busts updated static assets so returning visitors receive new behavior', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /href="style\.css\?v=[^"]+"/);
  assert.match(html, /src="app\.js\?v=[^"]+"/);
});

test('exports history as escaped CSV with a header row', () => {
  const csv = toCsv([{ timestamp: '2026-08-27T12:00:00.000Z', outcome: 'Correct', note: 'Quarter, then "dime"' }]);
  assert.match(csv, /^timestamp,outcome,note\r?\n/);
  assert.match(csv, /"Quarter, then ""dime"""/);
});
