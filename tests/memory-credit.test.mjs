import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreMemoryAnswer, memoryCredit, summarizeHistory } from '../quiz-core.mjs';
import { normalizeHistoryRecord, buildProgressModel, buildChartSpecs, comparePeriods } from '../progress-analytics.mjs';

test('value credit scales from one through twelve values; digits are a separate metric', () => {
  for (let count = 1; count <= 12; count++) {
    const values = Array(count).fill('01234');
    const correct = Math.floor(count / 2);
    const answers = values.map((v, i) => i < correct ? v : '01235');
    const score = scoreMemoryAnswer({ values }, answers);
    assert.equal(score.attemptScore, correct / count);
    assert.equal(score.correctValueCount, correct);
    assert.equal(score.correctDigitCount, correct * 5 + (count - correct) * 4);
    assert.equal(score.totalDigitCount, count * 5);
  }
});

test('old raw history derives credit without mutation, while missing evidence stays unknown', () => {
  const row = { gameType: 'Number memory', outcome: 'Incorrect', expectedValues: ['58372', '94168'], answeredValues: ['58312', '94168'] };
  const original = JSON.stringify(row);
  assert.equal(memoryCredit(row).attemptScore, 0.5);
  assert.equal(memoryCredit(row).digitAccuracyPercent, 90);
  assert.equal(normalizeHistoryRecord(row).attemptAccuracyPercent, 50);
  assert.equal(JSON.stringify(row), original);
  assert.equal(memoryCredit({ gameType: 'Number memory', outcome: 'Incorrect' }), null);
  assert.equal(memoryCredit({ outcome: 'Incorrect', valueCount: 4, correctValueCount: 3 }).attemptScore, 0.75);
  assert.equal(memoryCredit({ outcome: 'Not answered', expectedValues: ['123'], answeredValues: [] }), null);
  assert.equal(memoryCredit({ outcome: 'Incorrect', expectedValues: ['0123'], answeredValues: [123] }), null);
  assert.equal(scoreMemoryAnswer({ values: ['123'] }, ['12x']).correctDigitCount, 2);
});

test('session, history, daily charts and comparisons use the same fractional points', () => {
  const row = (id, expectedValues, answeredValues) => ({ attemptId: id, game: 'memory', gameType: 'Number memory', difficulty: 'Easy', outcome: 'Incorrect', timestamp: '2026-10-11T12:00:00Z', expectedValues, answeredValues });
  const rows = [row('a', ['123', '456'], ['123', '000']), row('b', ['123', '456', '789'], ['123', '456', '000'])];
  const model = buildProgressModel(rows);
  assert.equal(model.totalPoints, 0.5 + 2 / 3);
  assert.equal(model.accuracyPercent, 58.33);
  assert.equal(model.daily[0].accuracyPercent, 58.33);
  assert.equal(summarizeHistory(rows).accuracyPercent, 58.33);
  assert.equal(buildChartSpecs(rows, 'memory').find(c => c.id === 'accuracy-over-time').series[0].points[0].value, 58.33);
  assert.equal(comparePeriods(rows, rows).accuracyDelta, 0);
});

test('decimal placement, missing and extra digits preserve strict value scoring', () => {
  const score = scoreMemoryAnswer({ values: ['00.12', '1234', '56'] }, ['001.2', '123', '567']);
  assert.equal(score.attemptScore, 0);
  assert.equal(score.correctDigitCount, 9);
  assert.equal(score.totalDigitCount, 10);
  assert.equal(score.extraDigitCount, 1);
});
