import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChartSpecs, deduplicateHistory, progressionSegments } from '../progress-analytics.mjs';
import { generateSampleHistory } from '../sample-history.mjs';

test('progression joins sparse dates but stops at missing values', () => {
  const points = [{ label: '2026-04-09', value: 50 }, { label: '2026-06-21', value: 80 },
    { label: '2026-07-01', value: null }, { label: '2026-08-01', value: 90 }, { label: '2026-10-03', value: 100 }];
  assert.deepEqual(progressionSegments(points), [[0, 1], [3, 4]]);
});

test('progression never joins different settings or invalid values', () => {
  const points = [{ value: 20, seriesKey: 'easy' }, { value: 30, seriesKey: 'hard' },
    { value: 40, seriesKey: 'hard' }, { value: NaN, seriesKey: 'hard' },
    { value: 50, seriesKey: 'hard' }, { value: 60, seriesKey: 'hard' }];
  assert.deepEqual(progressionSegments(points), [[1, 2], [4, 5]]);
  assert.deepEqual(progressionSegments([{ value: undefined }, { value: 20 }]), []);
});

test('response-time chart retains missing records as gaps in chronological order', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({ game: 'cash', difficulty: 'Easy',
    sessionId: `session-${index}`, questionNumber: 1, outcome: 'Correct',
    timestamp: new Date(Date.UTC(2026, 8, 1 + index * 4)).toISOString(), timeUsedSeconds: index === 2 ? null : 5 }));
  const spec = buildChartSpecs(rows.reverse(), 'cash').find(chart => chart.id === 'response-time-over-time');
  assert.deepEqual(spec.series[0].points.map(point => point.value), [5, 5, null, 5, 5]);
  assert.deepEqual(progressionSegments(spec.series[0].points), [[0, 1], [3, 4]]);
});

test('typing charts keep unanswered attempts and separate difficulty settings', () => {
  const template = generateSampleHistory({ seed: 47 }).find(row => row.game === 'typing' && row.outcome === 'Correct');
  const rows = Array.from({ length: 7 }, (_, index) => ({ ...template, attemptId: `typing-${index}`,
    sessionId: `typing-${index}`, timestamp: new Date(Date.UTC(2026, 8, 1 + index)).toISOString(),
    difficulty: index === 2 ? 'Hard' : 'Easy', outcome: index === 4 ? 'Not answered' : 'Correct' }));
  for (const id of ['typing-speed', 'typing-character-accuracy']) {
    const points = buildChartSpecs(deduplicateHistory([...rows].reverse()), 'typing').find(chart => chart.id === id).series[0].points;
    assert.deepEqual(progressionSegments(points), [[0, 1], [5, 6]]);
    assert.equal(points[4].value, null);
  }
});
