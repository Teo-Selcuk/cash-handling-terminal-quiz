import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DENOMINATIONS,
  DIFFICULTY_CONFIG,
  buildBreakdown,
  countTotalCents,
  createQuestion,
  formatMoney,
  parseAmountToCents,
  scoreAnswer,
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

test('exports history as escaped CSV with a header row', () => {
  const csv = toCsv([{ timestamp: '2026-08-27T12:00:00.000Z', outcome: 'Correct', note: 'Quarter, then "dime"' }]);
  assert.match(csv, /^timestamp,outcome,note\r?\n/);
  assert.match(csv, /"Quarter, then ""dime"""/);
});
