import test from 'node:test';
import assert from 'node:assert/strict';
import { goalProgress, meetsGoal, goalsForGame, PROGRESSIVE_LEVELS, progressiveDifficulty, availableProgressiveLevels, fraudProgressiveOverrides, GOAL_LADDER } from '../speed-goals.mjs';
import { resolveCashDifficultyPreset } from '../quiz-core.mjs';
import { resolveFraudInspectionSettings } from '../fraud-inspection.mjs';

let clock = Date.UTC(2026, 9, 1);
// One saved round: `correct` of `count` right, each answer taking `seconds`.
function round(level, seconds, correct = 10, count = 10, game = 'cash', extra = {}) {
  const sessionId = `s-${clock}`;
  return Array.from({ length: count }, (_, index) => ({
    game, difficulty: level, sessionId, attemptId: `${sessionId}-${index}`, questionNumber: index + 1, sessionMode: 'Testing',
    timestamp: new Date(clock += 1000).toISOString(), outcome: index < correct ? 'Correct' : 'Incorrect', timeUsedSeconds: seconds, ...extra,
  }));
}
const goal = (game, level, seconds) => goalsForGame(game).find((item) => item.level === level && item.seconds === seconds);

test('goal ladder matches the agreed times', () => {
  assert.deepEqual(GOAL_LADDER.Easy, [10, 7.5, 5]);
  assert.deepEqual(GOAL_LADDER.Medium, [15, 12, 10, 7.5, 5]);
  assert.deepEqual(goalsForGame('typing'), [], 'untimed-goal games have no ladder');
});

test('Easy 10s at 90% passes and unlocks 7.5s', () => {
  const progress = goalProgress(round('Easy', 9, 9), 'cash');
  assert.equal(progress.goals.find((item) => item.seconds === 10 && item.level === 'Easy').passed, true);
  assert.deepEqual([progress.current.level, progress.current.seconds], ['Easy', 7.5]);
  assert.equal(progress.passedCount, 1);
});

test('a failed round does not unlock anything', () => {
  for (const history of [round('Easy', 9, 8), round('Easy', 11, 10)]) {
    const progress = goalProgress(history, 'cash');
    assert.equal(progress.passedCount, 0);
    assert.deepEqual([progress.current.level, progress.current.seconds], ['Easy', 10]);
  }
});

test('boundaries: exactly 10.0s and exactly 90% pass; 10.1s and 89.9% do not', () => {
  const g = goal('cash', 'Easy', 10);
  const base = { level: 'Easy', questions: 10 };
  assert.equal(meetsGoal({ ...base, successPercent: 90, averageSeconds: 10 }, g), true);
  assert.equal(meetsGoal({ ...base, successPercent: 90, averageSeconds: 10.1 }, g), false);
  assert.equal(meetsGoal({ ...base, successPercent: 89.9, averageSeconds: 5 }, g), false);
  assert.equal(goalProgress(round('Easy', 10, 9), 'cash').passedCount, 1, 'saved round at exactly 10s and 9/10');
});

test('Medium unlocks only after every Easy goal passes', () => {
  const early = goalProgress([...round('Medium', 4), ...round('Easy', 9)], 'cash');
  assert.equal(early.goals.filter((item) => item.level === 'Medium' && item.passed).length, 0, 'Medium rounds before unlock do not count');
  assert.deepEqual(early.unlockedLevels, ['Easy']);
  const done = goalProgress([...round('Easy', 4.9), ...round('Medium', 14)], 'cash');
  assert.deepEqual(done.unlockedLevels, ['Easy', 'Medium']);
  assert.equal(done.goals.filter((item) => item.level === 'Easy').every((item) => item.passed), true);
  assert.deepEqual([done.current.level, done.current.seconds], ['Medium', 12]);
});

test('goal progress persists: it is rebuilt from saved history after restart', () => {
  const saved = JSON.stringify([...round('Easy', 7), ...round('Easy', 6, 9, 10, 'memory')]);
  const restored = JSON.parse(saved);
  assert.equal(goalProgress(restored, 'cash').passedCount, 2);
  assert.equal(goalProgress(restored, 'memory').passedCount, 2, 'each game keeps its own goals');
  assert.equal(goalProgress(restored, 'task').passedCount, 0);
});

test('guided practice and very short rounds never pass goals', () => {
  assert.equal(goalProgress(round('Easy', 2, 10, 10, 'cash', { sessionMode: 'Guided practice' }), 'cash').passedCount, 0);
  assert.equal(goalProgress(round('Easy', 2, 3, 3), 'cash').passedCount, 0);
});

test('an old attempt without timing is not counted toward speed', () => {
  const progress = goalProgress(round('Easy', null), 'cash');
  assert.equal(progress.passedCount, 0);
  assert.equal(progress.bestSeconds, null);
});

test('progressive levels: each is harder than the previous, never easier on any axis', () => {
  for (const [game, levels] of Object.entries(PROGRESSIVE_LEVELS)) {
    for (let index = 1; index < levels.length; index++) {
      const before = progressiveDifficulty(game, levels[index - 1]);
      const after = progressiveDifficulty(game, levels[index]);
      assert.ok(after.every((value, axis) => value >= before[axis]), `${game} L${index + 1} never easier`);
      assert.ok(after.some((value, axis) => value > before[axis]), `${game} L${index + 1} harder on some axis`);
    }
  }
});

test('progressive levels produce valid game settings', () => {
  for (const entry of PROGRESSIVE_LEVELS.cash) {
    const preset = resolveCashDifficultyPreset(entry.base, entry.preset);
    assert.equal(preset.splitCount, entry.preset.splitCount);
  }
  for (const entry of PROGRESSIVE_LEVELS['fraud-inspection']) {
    const settings = resolveFraudInspectionSettings(entry.base, fraudProgressiveOverrides(entry));
    assert.equal(settings.timeLimitSeconds, entry.settings.timeLimitSeconds);
    assert.equal(settings.maximumErrors, entry.settings.maximumErrors);
    assert.equal(settings.alterationSubtlety, entry.settings.subtlety);
  }
});

test('progressive levels open with the goal ladder', () => {
  assert.deepEqual(availableProgressiveLevels([], 'cash').map((entry) => entry.unlocked), [true, true, false, false, false, false]);
  assert.deepEqual(availableProgressiveLevels(round('Easy', 4), 'cash').map((entry) => entry.unlocked), [true, true, true, true, false, false]);
});
