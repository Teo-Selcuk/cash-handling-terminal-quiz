import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleHistory, generateSampleChessHistory } from '../sample-history.mjs';
import { ChessSession } from '../chess-core.mjs';
import { summarizeChess, chessChartSpecs } from '../chess-analytics.mjs';
import { buildChartSpecs, buildErrorAnalytics, buildGameFilters, filterHistory, normalizeHistoryRecord } from '../progress-analytics.mjs';

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
  assert.ok(first.filter(record => record.game === 'typing').every(record => record.correct === (record.outcome === 'Correct')));

  const normalized = first.map(normalizeHistoryRecord).filter(Boolean);
  const errorAnalytics = buildErrorAnalytics(first);
  for (const game of ['cash', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing']) {
    const records = normalized.filter((record) => record.game === game);
    assert.ok(records.length > 0, `${game} has sample records`);
    assert.ok(buildChartSpecs(records, game).some((spec) => spec.series[0].points.length), `${game} charts have data`);
    assert.ok(buildGameFilters(records, game).fields.some((field) => field.available > 0), `${game} filters have data`);
    if (game !== 'typing') {
      assert.ok(errorAnalytics.byCategory.some((group) => group.game === game), `${game} has game-specific error categories`);
      assert.ok(errorAnalytics.byRawInput.some((group) => group.game === game), `${game} has raw-input error analytics`);
    } else assert.ok(records.every(row => Number.isFinite(row.wpm) && Number.isFinite(row.accuracyPercent)), 'typing samples include actual speed and accuracy');
  }
  assert.ok(errorAnalytics.byRawInput.some((group) => group.key.startsWith('cash:denomination:')), 'cash sample records include bill/coin breakdowns');
  assert.ok(errorAnalytics.byRawInput.some((group) => group.key.startsWith('memory:digit-position:')), 'memory sample records include digit-position results');
  assert.ok(errorAnalytics.inputCombinations.some((group) => group.game === 'cash'), 'cash has observed denomination-mix combinations');
  assert.ok(normalized.filter((record) => record.day >= '2026-08-25').length >= 500);
  assert.ok(filterHistory(first, { startDate: '2026-09-23', endDate: '2026-09-23' }).length > 0);
  assert.ok(filterHistory(first, { startDate: '2026-09-22', endDate: '2026-09-22' }).length > 0);
  assert.ok(filterHistory(first, { startDate: '2026-09-17', endDate: '2026-09-23' }).length > 0);
  assert.ok(filterHistory(first, { startDate: '2026-08-25', endDate: '2026-09-23' }).length >= 500);
  assert.equal(filterHistory(first, { attemptLimit: 30 }).length, 30);
  assert.equal(filterHistory(first, { attemptLimit: 50 }).length, 50);
});

test('sample chess includes replayable games, outcomes, clocks and lesson attempts without storage', () => {
  const data = generateSampleChessHistory({ now, seed: 42 });
  assert.deepEqual(data, generateSampleChessHistory({ now, seed: 42 }));
  for (const game of data.games) assert.doesNotThrow(() => ChessSession.restore(game));
  const summary = summarizeChess(data.games, data.lessons);
  assert.ok(summary.wins > 0 && summary.draws > 0 && summary.losses > 0);
  assert.ok(summary.completedLessons > 0 && summary.lateMoves > 0);
  assert.ok(chessChartSpecs(data.games, data.lessons).every(spec => spec.series[0].points.length));
  assert.ok(data.games.every(game => game.isSample && game.analysis.status === 'sample'));
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
