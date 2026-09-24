import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleHistory } from '../sample-history.mjs';
import { buildChartSpecs, buildGameFilters, filterHistory, normalizeHistoryRecord } from '../progress-analytics.mjs';

const now = new Date('2026-09-23T16:00:00.000Z');

test('sample history is isolated, stable for a seed, and covers every game mechanic', () => {
  const first = generateSampleHistory({ now, count: 1200, seed: 42 });
  const second = generateSampleHistory({ now, count: 1200, seed: 42 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 1200);
  assert.ok(first.every((record) => record.isSample === true));
  assert.ok(first.some((record) => record.timestamp.startsWith('2026-09-23')));
  assert.ok(first.some((record) => record.timestamp.startsWith('2026-09-22')));
  assert.ok(first.some((record) => Date.parse(record.timestamp) < now.getTime() - 30 * 86400000));
  assert.ok(new Set(first.map((record) => record.difficulty)).has('Custom'));
  assert.ok(first.some((record) => record.outcome === 'Correct'));
  assert.ok(first.some((record) => record.outcome === 'Incorrect'));
  assert.ok(first.some((record) => record.outcome === 'Timed Out'));
  assert.ok(first.filter((record) => record.outcome === 'Timed Out').every((record) => record.timeUsedSeconds > record.timeLimitSeconds));
  assert.ok(first.filter((record) => record.game === 'cash' && record.outcome === 'Incorrect')
    .every((record) => record.userAnswer !== record.cashTransactionType));
  assert.ok(first.filter((record) => record.game === 'memory' && record.outcome === 'Incorrect')
    .every((record) => record.correctValueCount < record.valueCount));
  assert.ok(first.filter((record) => record.game === 'task' && record.outcome === 'Incorrect')
    .every((record) => record.mistakes > 0));
  assert.ok(first.filter((record) => record.game === 'error-detection' && record.outcome === 'Incorrect')
    .every((record) => record.missedAnomalyCount + record.falseFlagCount > 0));
  assert.ok(first.filter((record) => record.game === 'fraud-inspection' && record.outcome === 'Incorrect')
    .every((record) => record.fraudFalseNegativeCount + record.fraudFalsePositiveCount > 0));

  const normalized = first.map(normalizeHistoryRecord).filter(Boolean);
  for (const game of ['cash', 'memory', 'task', 'error-detection', 'fraud-inspection']) {
    const records = normalized.filter((record) => record.game === game);
    assert.ok(records.length > 0, `${game} has sample records`);
    assert.ok(buildChartSpecs(records, game).some((spec) => spec.series[0].points.length), `${game} charts have data`);
    assert.ok(buildGameFilters(records, game).fields.some((field) => field.available > 0), `${game} filters have data`);
  }
  assert.ok(normalized.filter((record) => record.day >= '2026-08-25').length >= 500);
  assert.ok(filterHistory(first, { startDate: '2026-09-23', endDate: '2026-09-23' }).length > 0);
  assert.ok(filterHistory(first, { startDate: '2026-09-22', endDate: '2026-09-22' }).length > 0);
  assert.ok(filterHistory(first, { startDate: '2026-09-17', endDate: '2026-09-23' }).length > 0);
  assert.ok(filterHistory(first, { startDate: '2026-08-25', endDate: '2026-09-23' }).length >= 500);
  assert.equal(filterHistory(first, { attemptLimit: 30 }).length, 30);
  assert.equal(filterHistory(first, { attemptLimit: 50 }).length, 50);
});

test('sample history supports small and large stress sizes without losing recent date coverage', () => {
  for (const count of [10, 100, 500, 1000, 1200]) {
    const records = generateSampleHistory({ now, count, seed: count });
    assert.equal(records.length, count);
    assert.ok(filterHistory(records, { startDate: '2026-09-23', endDate: '2026-09-23' }).length > 0);
    assert.ok(filterHistory(records, { startDate: '2026-09-22', endDate: '2026-09-22' }).length > 0);
    assert.ok(filterHistory(records, { startDate: '2026-09-17', endDate: '2026-09-23' }).length > 0);
  }
});
