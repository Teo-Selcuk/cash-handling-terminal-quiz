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
// These fixtures are 10-attempt rounds, so they use a 10-attempt window.
const settings10 = { window: 10 };
const progressOf = (history, game, saved = {}) => goalProgress(history, game, { ...settings10, ...saved });
const levelsOf = (history, game) => availableProgressiveLevels(history, game, settings10);
const goal = (game, level, seconds) => goalsForGame(game).find((item) => item.level === level && item.seconds === seconds);

test('goal ladder matches the agreed times', () => {
  assert.deepEqual(GOAL_LADDER.Easy, [10, 7.5, 5]);
  assert.deepEqual(GOAL_LADDER.Medium, [15, 12, 10, 7.5, 5]);
  assert.deepEqual(goalsForGame('chess'), [], 'chess has no speed goal ladder');
});

test('Easy 10s at 90% passes and unlocks 7.5s', () => {
  const progress = progressOf(round('Easy', 9, 9), 'cash');
  assert.equal(progress.goals.find((item) => item.seconds === 10 && item.level === 'Easy').passed, true);
  assert.deepEqual([progress.current.level, progress.current.seconds], ['Easy', 7.5]);
  assert.equal(progress.passedCount, 3, '15s, 12s and 10s all pass at 9s');
});

test('a failed round does not unlock anything', () => {
  const weak = progressOf(round('Easy', 9, 8), 'cash');
  assert.equal(weak.passedCount, 0);
  assert.deepEqual([weak.current.level, weak.current.seconds], ['Easy', 15]);
  const slow = progressOf(round('Easy', 11, 10), 'cash');
  assert.equal(slow.passedCount, 2, 'only 15s and 12s are met at 11s');
  assert.deepEqual([slow.current.level, slow.current.seconds], ['Easy', 10]);
});

test('boundaries: exactly 10.0s and exactly 90% pass; 10.1s and 89.9% do not', () => {
  const g = goal('cash', 'Easy', 10);
  const base = { level: 'Easy', questions: 10 };
  assert.equal(meetsGoal({ ...base, successPercent: 90, averageSeconds: 10 }, g), true);
  assert.equal(meetsGoal({ ...base, successPercent: 90, averageSeconds: 10.1 }, g), false);
  assert.equal(meetsGoal({ ...base, successPercent: 89.9, averageSeconds: 5 }, g), false);
  assert.equal(progressOf(round('Easy', 10, 9), 'cash').passedCount, 3, 'saved round at exactly 10s and 9/10');
});

test('Medium unlocks only after every Easy goal passes', () => {
  const early = progressOf([...round('Medium', 4), ...round('Easy', 9)], 'cash');
  assert.equal(early.goals.filter((item) => item.level === 'Medium' && item.passed).length, 5, 'goals met earlier are checked off even before the level opens');
  assert.deepEqual(early.unlockedLevels, ['Easy']);
  const done = progressOf([...round('Easy', 4.9), ...round('Medium', 14)], 'cash');
  assert.deepEqual(done.unlockedLevels, ['Easy', 'Medium']);
  assert.equal(done.goals.filter((item) => item.level === 'Easy').every((item) => item.passed), true);
  assert.deepEqual([done.current.level, done.current.seconds], ['Medium', 12]);
});

test('goal progress persists: it is rebuilt from saved history after restart', () => {
  const saved = JSON.stringify([...round('Easy', 7), ...round('Easy', 6, 9, 10, 'memory')]);
  const restored = JSON.parse(saved);
  assert.equal(progressOf(restored, 'cash').passedCount, 4);
  assert.equal(progressOf(restored, 'memory').passedCount, 2, 'each game keeps its own goals');
  assert.equal(progressOf(restored, 'task').passedCount, 0);
});

test('guided practice and very short rounds never pass goals', () => {
  assert.equal(progressOf(round('Easy', 2, 10, 10, 'cash', { sessionMode: 'Guided practice' }), 'cash').passedCount, 0);
  assert.equal(progressOf(round('Easy', 2, 3, 3), 'cash').passedCount, 0);
});

test('an old attempt without timing is not counted toward speed', () => {
  const progress = progressOf(round('Easy', null), 'cash');
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
  assert.deepEqual(levelsOf([], 'cash').map((entry) => entry.unlocked), [true, true, false, false, false, false]);
  assert.deepEqual(levelsOf(round('Easy', 4), 'cash').map((entry) => entry.unlocked), [true, true, true, true, false, false]);
});

// ---- Rolling attempt window: any N consecutive attempts, across rounds ----
import { DEFAULT_GOAL_WINDOW, resolveGoalSettings, GOAL_WINDOW_LIMITS } from '../speed-goals.mjs';

test('defaults: cash needs 150 consecutive attempts, every other timed game 80, typing and Multitasker 10', () => {
  assert.deepEqual(DEFAULT_GOAL_WINDOW, { cash: 150, memory: 80, task: 80, 'error-detection': 80, 'fraud-inspection': 80, typing: 10, overload: 10, 'holds-verification': 80 });
  for (const game of ['typing', 'overload']) assert.equal(goalProgress([], game).settings.window, 10);
  assert.equal(goalProgress([], 'cash').settings.window, 150);
  for (const game of ['memory', 'task', 'error-detection', 'fraud-inspection']) assert.equal(goalProgress([], game).settings.window, 80);
});

test('cash Hard mode has a 5 second goal; other games stop at 7.5 seconds', () => {
  assert.deepEqual(goalsForGame('cash').filter((item) => item.level === 'Hard').map((item) => item.seconds), [20, 15, 12, 10, 7.5, 5]);
  assert.deepEqual(goalsForGame('memory').filter((item) => item.level === 'Hard').map((item) => item.seconds), [20, 15, 12, 10, 7.5]);
});

test('149 good attempts do not pass the 150-attempt goal; the 150th does', () => {
  const rounds = (count) => Array.from({ length: Math.ceil(count / 30) }, (_, i) => round('Easy', 9, 30, Math.min(30, count - i * 30))).flat();
  assert.equal(goalProgress(rounds(149), 'cash').passedCount, 0);
  assert.equal(goalProgress(rounds(150), 'cash').passedCount, 3);
});

test('the run may start anywhere: a bad start does not block a later good run', () => {
  const history = [...round('Easy', 20, 0, 10), ...round('Easy', 9, 10, 10), ...round('Easy', 9, 10, 10)];
  assert.equal(goalProgress(history, 'cash', { window: 20 }).passedCount, 3);
});

test('an earlier good run still counts after worse attempts follow', () => {
  const history = [...round('Easy', 9, 10, 10), ...round('Easy', 9, 10, 10), ...round('Easy', 30, 0, 10)];
  assert.equal(goalProgress(history, 'cash', { window: 20 }).passedCount, 3);
});

test('success is measured over the full run: 18 of 20 passes, 17 of 20 fails', () => {
  assert.equal(goalProgress([...round('Easy', 9, 10, 10), ...round('Easy', 9, 8, 10)], 'cash', { window: 20 }).passedCount, 3);
  assert.equal(goalProgress([...round('Easy', 9, 9, 10), ...round('Easy', 9, 8, 10)], 'cash', { window: 20 }).passedCount, 0);
});

test('average time is measured over the full run', () => {
  assert.equal(goalProgress([...round('Easy', 10, 10, 10), ...round('Easy', 10, 10, 10)], 'cash', { window: 20 }).passedCount, 3);
  assert.equal(goalProgress([...round('Easy', 11, 10, 10), ...round('Easy', 9, 10, 10)], 'cash', { window: 20 }).passedCount, 3, 'average of 11 and 9 is exactly 10');
  assert.equal(goalProgress([...round('Easy', 11, 10, 10), ...round('Easy', 9.5, 10, 10)], 'cash', { window: 20 }).passedCount, 2);
});

test('runs never mix difficulties and games', () => {
  const mixed = [...round('Easy', 9, 10, 10), ...round('Medium', 9, 10, 10), ...round('Easy', 9, 10, 10)];
  assert.equal(goalProgress(mixed, 'cash', { window: 20 }).passedCount, 3, 'Easy attempts around Medium ones are consecutive Easy attempts');
  assert.equal(goalProgress(round('Easy', 9, 10, 10), 'cash', { window: 20 }).passedCount, 0);
  assert.equal(goalProgress([...round('Easy', 9, 10, 10), ...round('Easy', 9, 10, 10, 'memory')], 'cash', { window: 20 }).passedCount, 0);
});

test('settings change the run length and the success rate for one game only', () => {
  const history = round('Easy', 9, 8, 10);
  assert.equal(goalProgress(history, 'cash', { window: 10 }).passedCount, 0);
  assert.equal(goalProgress(history, 'cash', { window: 10, successPercent: 80 }).passedCount, 3);
  const saved = { cash: { window: 10, successPercent: 80 }, memory: { window: 50 } };
  assert.equal(goalProgress(history, 'cash', saved).passedCount, 3);
  assert.equal(goalProgress(round('Easy', 9, 10, 10, 'memory'), 'memory', saved).passedCount, 0, 'memory still needs 50 attempts');
});

test('goal settings are cleaned: whole numbers inside the allowed range, defaults when missing', () => {
  assert.deepEqual(resolveGoalSettings('cash'), { window: 150, successPercent: 90 });
  assert.deepEqual(resolveGoalSettings('memory', { memory: { window: 40.6, successPercent: 95 } }), { window: 41, successPercent: 95 });
  assert.equal(resolveGoalSettings('cash', { cash: { window: 1 } }).window, GOAL_WINDOW_LIMITS.min);
  assert.equal(resolveGoalSettings('cash', { cash: { window: 99999 } }).window, GOAL_WINDOW_LIMITS.max);
  assert.equal(resolveGoalSettings('cash', { cash: { successPercent: 10 } }).successPercent, 50);
  assert.deepEqual(resolveGoalSettings('task', { task: { window: 'abc', successPercent: '' } }), { window: 80, successPercent: 90 });
  assert.deepEqual(resolveGoalSettings('task', null), { window: 80, successPercent: 90 });
});

test('progress reports the latest run so the screen can show how close the player is', () => {
  const progress = goalProgress([...round('Easy', 12, 9, 10), ...round('Easy', 8, 7, 10)], 'cash', { window: 20 });
  assert.equal(progress.window.size, 20);
  assert.equal(progress.window.attempts, 20);
  assert.equal(progress.window.latest.questions, 20);
  assert.equal(progress.window.latest.successPercent, 80);
  assert.equal(progress.window.latest.averageSeconds, 10);
});

test('progressive levels follow the configured run length', () => {
  const history = round('Easy', 4, 10, 10);
  assert.equal(availableProgressiveLevels(history, 'cash', { window: 10 })[2].unlocked, true);
  assert.equal(availableProgressiveLevels(history, 'cash')[2].unlocked, false, 'default 150-attempt run is not met yet');
});

// ---- Typing (words per minute) and Multitasker (seconds per action) ----
function typingTests(level, wpm, accuracyPercent, count) {
  return Array.from({ length: count }, (_, index) => ({ ...round(level, 30, 1, 1, 'typing')[0], wpm, accuracyPercent, attemptId: `t-${clock}-${index}` }));
}
function overloadRuns(level, overloadAverageResponse, overloadAccuracy, count) {
  return Array.from({ length: count }, () => ({ ...round(level, 60, 1, 1, 'overload')[0], sessionMode: 'standard', overloadAverageResponse, overloadAccuracy }));
}

test('typing goals are words per minute: faster passes, higher is better, character accuracy is the success rate', () => {
  assert.deepEqual(goalsForGame('typing').filter((item) => item.level === 'Easy').map((item) => [item.target, item.unit, item.better]), [[25, 'WPM', 'higher'], [30, 'WPM', 'higher'], [35, 'WPM', 'higher']]);
  const passed = goalProgress(typingTests('Easy', 30, 95, 10), 'typing');
  assert.equal(passed.passedCount, 2, '30 WPM passes the 25 and 30 WPM goals (exact limit passes)');
  assert.equal(passed.bestSpeed, 30);
  assert.equal(goalProgress(typingTests('Easy', 30, 89, 10), 'typing').passedCount, 0, 'below 90% character accuracy fails');
  assert.equal(goalProgress(typingTests('Easy', 30, 95, 9), 'typing').passedCount, 0, 'needs 10 tests by default');
  assert.equal(goalProgress(typingTests('Easy', 30, 95, 5), 'typing', { typing: { window: 5 } }).passedCount, 2, 'test count is a setting');
});

test('Multitasker goals are seconds per action at an action accuracy', () => {
  assert.deepEqual(goalsForGame('overload').filter((item) => item.level === 'Easy').map((item) => item.target), [4, 3.5, 3]);
  assert.equal(goalProgress(overloadRuns('Easy', 3.5, 92, 10), 'overload').passedCount, 2);
  assert.equal(goalProgress(overloadRuns('Easy', 3.5, 85, 10), 'overload').passedCount, 0);
  assert.equal(goalProgress(overloadRuns('Easy', 3.5, 85, 10), 'overload', { overload: { successPercent: 80 } }).passedCount, 2, 'success rate is a setting');
});

test('cash Easy ladder includes 15s and 12s', () => {
  assert.deepEqual(goalsForGame('cash').filter((item) => item.level === 'Easy').map((item) => item.target), [15, 12, 10, 7.5, 5]);
});

test('every goal met by any run is checked off, in any order, and the best run is reported', () => {
  const history = [...round('Easy', 4, 6), ...round('Easy', 9, 10)];
  const progress = progressOf(history, 'cash', { successPercent: 60 });
  assert.equal(progress.goals.find((item) => item.id === 'cash:Easy:5').passed, true, 'fast 60% run passes the hardest goal');
  assert.equal(progress.goals.find((item) => item.id === 'cash:Easy:15').passed, true);
  assert.equal(progress.bestWindow.Easy.successPercent, 100);
  assert.equal(progress.bestWindowSuccess, 100);
});
