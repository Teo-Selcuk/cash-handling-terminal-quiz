import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdvancedErrorAnalytics } from '../progress-analytics.mjs';
const row = (game, fields) => ({ game, outcome: 'Incorrect', timestamp: '2026-10-08T12:00:00Z', ...fields });
test('memory preserves zeros, positions, missing/extra digits and confusion denominators', () => {
  const result = buildAdvancedErrorAnalytics([
    row('memory', { expectedValues: ['583729', '0012'], answeredValues: ['583719', '001'] }),
    row('memory', { expectedValues: ['1234'], answeredValues: ['12345'] }),
    row('memory', { outcome: 'Timed Out', expectedValues: ['9999'], answeredValues: [] }),
  ]);
  assert.equal(result.memory.positions.find(p => p.key === '5').errors, 1);
  assert.equal(result.memory.confusion[2][1], 1);
  assert.equal(result.memory.confusion[7][1], 0);
  assert.equal(result.memory.missing, 1);
  assert.equal(result.memory.extra, 1);
  assert.equal(result.memory.details[1].expected, '0012');
  assert.equal(result.memory.positions[0].opportunities, 3);
  assert.equal(result.memory.unavailable, 1);
});
test('cash categories and opposite operation require exact evidence; borrow is a supported signature', () => {
  const cash = values => row('cash', { amountDueCents: 525, cashGivenCents: 1000, changeOrShortfallCents: 475, userAnswer: 'Change', ...values });
  const { cash: result } = buildAdvancedErrorAnalytics([
    cash({ userDeclaredAmountCents: 575 }), cash({ userDeclaredAmountCents: 476 }),
    cash({ userDeclaredAmountCents: 576 }), cash({ userDeclaredAmountCents: 1525 }),
    cash({ userDeclaredAmountCents: 425 }), cash({ userDeclaredAmountCents: 475 }),
    cash({ outcome: 'Timed Out', userAnswer: '', userDeclaredAmountCents: 0 }),
  ]);
  assert.deepEqual(result.details.map(r => r.component), ['Dollar-only', 'Cent-only', 'Both', 'Both', 'Cent-only', 'Correct']);
  assert.equal(result.details[0].carryBorrow, true);
  assert.equal(result.details[3].operatorConfusion, true);
  assert.equal(result.details[4].operatorConfusion, false);
  assert.equal(result.details[4].centOperatorConfusion, true);
  assert.equal(result.details[1].difference, 1);
  assert.equal(result.details[0].operation, 'subtraction');
  assert.equal(result.unavailable, 1);
});
test('explicit addition, carry signatures, shortfalls and unavailable legacy evidence', () => {
  const result = buildAdvancedErrorAnalytics([
    row('cash', { arithmeticOperation: 'addition', arithmeticLeftCents: 175, arithmeticRightCents: 150, changeOrShortfallCents: 325, userDeclaredAmountCents: 225, userAnswer: 'Change' }),
    row('cash', { amountDueCents: 1000, cashGivenCents: 525, changeOrShortfallCents: 475, userDeclaredAmountCents: 475, userAnswer: 'Short' }),
    row('cash', { changeOrShortfallCents: 123, userDeclaredAmountCents: 223, userAnswer: 'Change' }),
    row('memory', { expectedValues: [1234], answeredValues: ['1234'] }),
  ]);
  assert.equal(result.cash.details[0].carryBorrow, true);
  assert.equal(result.cash.details[0].operation, 'addition');
  assert.equal(result.cash.details[1].component, 'Correct');
  assert.equal(result.cash.details[2].operation, 'unavailable');
  assert.equal(result.cash.details[2].operatorConfusion, null);
  assert.equal(result.memory.unavailable, 1);
});
test('decimal mistakes, extra values and chronological position series retain raw evidence', () => {
  const result = buildAdvancedErrorAnalytics([
    row('memory', { sessionId: 'late', questionNumber: 1, timestamp: '2026-10-08T12:00:00Z', expectedValues: ['00.12'], answeredValues: ['001.2', '99'] }),
    row('memory', { sessionId: 'early', questionNumber: 1, timestamp: '2026-10-07T12:00:00Z', expectedValues: ['00.12'], answeredValues: ['00.12'] }),
    row('memory', { sessionId: 'unfinished', questionNumber: 1, outcome: 'Not answered', expectedValues: ['9999'], answeredValues: [] }),
  ]);
  assert.equal(result.memory.details.find(r => r.attemptId === 'late:1').decimalError, true);
  assert.equal(result.memory.extra, 2);
  assert.equal(result.memory.positions[0].accuracyPercent, 100);
  assert.deepEqual(result.charts.find(s => s.id === 'memory-position-1-time').series[0].points.map(p => p.key), ['2026-10-07', '2026-10-08']);
  assert.equal(result.memory.lengths[0].errorRatePercent, 50);
});
test('no crossing or indistinguishable opposite result cannot establish carry or operator confusion', () => {
  const result = buildAdvancedErrorAnalytics([
    row('cash', { amountDueCents: 100, cashGivenCents: 700, changeOrShortfallCents: 600, userDeclaredAmountCents: 700, userAnswer: 'Change' }),
    row('cash', { amountDueCents: 0, cashGivenCents: 700, changeOrShortfallCents: 700, userDeclaredAmountCents: 700, userAnswer: 'Change' }),
  ]);
  assert.equal(result.cash.details[0].carryBorrow, false);
  assert.equal(result.cash.details[0].operatorConfusion, false);
  assert.equal(result.cash.details[1].operatorConfusion, false);
  assert.equal(result.cash.categories.some(c => c.key === 'Likely carry/borrow omission'), false);
});
test('raw stable IDs normalize and completed answers replace checkpoints without double counting', () => {
  const records = [
    row('memory', { attemptId: 'stable', outcome: 'Not answered', expectedValues: ['0123'], answeredValues: [] }),
    row('memory', { attemptId: 'stable', outcome: 'Correct', expectedValues: ['0123'], answeredValues: ['0123'] }),
    row('memory', { attemptId: 'stable', outcome: 'Not answered', expectedValues: ['0123'], answeredValues: [] }),
  ];
  const result = buildAdvancedErrorAnalytics(records);
  assert.equal(result.memory.details.length, 1);
  assert.equal(result.memory.positions[0].opportunities, 1);
  assert.equal(result.memory.positions[0].accuracyPercent, 100);
});
