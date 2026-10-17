import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeHistory } from '../quiz-core.mjs';
import { buildChartSpecs } from '../progress-analytics.mjs';
import { generateSampleHistory } from '../sample-history.mjs';

const history = generateSampleHistory({ seed: 7 });
const games = ['cash', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing', 'overload'];

test('difficulty rows add up to the outcome totals for every game', () => {
  for (const game of games) {
    const rows = history.filter((record) => record.game === game);
    const summary = summarizeHistory(rows);
    assert.equal(summary.byDifficulty.reduce((sum, level) => sum + level.answered, 0), summary.answered, `${game}: every attempt counted once`);
    assert.equal(summary.byDifficulty.reduce((sum, level) => sum + level.correct, 0), summary.correct, `${game}: correct counts agree`);
  }
});

test('Custom and unrecorded difficulties keep their own row instead of disappearing', () => {
  const summary = summarizeHistory([
    { outcome: 'Correct', difficulty: 'Easy' }, { outcome: 'Correct', difficulty: 'Custom' }, { outcome: 'Incorrect' },
  ]);
  assert.deepEqual(summary.byDifficulty.map((level) => [level.level, level.correct, level.answered]),
    [['Easy', 1, 1], ['Medium', 0, 0], ['Hard', 0, 0], ['Custom', 1, 1], ['Not recorded', 0, 1]]);
});

test('no game history page repeats a chart or shows the removed duplicates', () => {
  for (const game of ['all', ...games]) {
    const specs = buildChartSpecs(history, game);
    const ids = specs.map((spec) => spec.id);
    const titles = specs.map((spec) => spec.title);
    assert.equal(new Set(ids).size, ids.length, `${game}: unique chart ids`);
    assert.equal(new Set(titles).size, titles.length, `${game}: unique chart titles`);
    assert.ok(!ids.includes('outcomes'), `${game}: answer outcomes appear once, in the summary diagram`);
    assert.ok(!ids.includes('correct-by-threshold'), `${game}: correct-by-time appears once, in the performance report`);
  }
});
