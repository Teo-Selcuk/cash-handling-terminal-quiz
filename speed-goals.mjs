// Per-game speed goals and progressive levels. Goal progress is derived from the
// saved attempt history, so it persists wherever that history persists.
import { normalizeHistoryRecord, deduplicateHistory } from './progress-analytics.mjs?v=20261017-perf';

export const GOAL_SUCCESS_PERCENT = 90;
export const GOAL_MINIMUM_QUESTIONS = 5;
// A goal passes on any run of consecutive attempts (one difficulty, one game) as long as the run is this long.
// Cash handling asks for a longer run than the other games. Both numbers can be changed per game in the app.
// Typing counts tests and Multitasker counts runs, so their runs are shorter.
export const DEFAULT_GOAL_WINDOW = Object.freeze({ cash: 150, memory: 80, task: 80, 'error-detection': 80, 'fraud-inspection': 80, typing: 10, overload: 10 });
export const GOAL_WINDOW_LIMITS = Object.freeze({ min: 5, max: 1000 });
export const GOAL_SUCCESS_LIMITS = Object.freeze({ min: 50, max: 100 });
export const GOAL_SETTINGS_KEY = 'cash-handling-terminal-quiz-goal-settings-v1';

/** Clean one game's saved goal settings: whole attempt count and success percent inside the allowed range. */
export function resolveGoalSettings(game, saved = {}) {
  const clamp = (value, { min, max }, fallback) => (Number.isFinite(Number(value)) && value !== '' && value !== null ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback);
  const source = saved?.[game] ?? saved ?? {};
  return {
    window: clamp(source.window, GOAL_WINDOW_LIMITS, DEFAULT_GOAL_WINDOW[game] ?? 80),
    successPercent: clamp(source.successPercent, GOAL_SUCCESS_LIMITS, GOAL_SUCCESS_PERCENT),
  };
}

export const GOAL_GAMES = Object.freeze(['cash', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing', 'overload']);

const finite = (value) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null);
// How each game scores one attempt for goals. success: 0-100 for that attempt. speed: the timed measure, or null.
// Typing goals are words per minute (higher is better) at a character accuracy; Multitasker goals are the
// average action response time at an action accuracy. Every other game uses right answers and answer time.
const ANSWER_METRIC = Object.freeze({
  unit: 's', better: 'lower', minimumQuestions: GOAL_MINIMUM_QUESTIONS, attemptName: 'attempts',
  success: (row) => (row.isCorrect ? 100 : 0),
  speed: (row) => (row.isAnswered && row.responseTimeSeconds !== null ? row.responseTimeSeconds : null),
});
export const GOAL_METRICS = Object.freeze({
  typing: Object.freeze({
    unit: 'WPM', better: 'higher', minimumQuestions: 1, attemptName: 'tests',
    success: (row) => finite(row.accuracyPercent) ?? (row.isCorrect ? 100 : 0),
    speed: (row) => (row.isAnswered ? finite(row.wpm) : null),
  }),
  overload: Object.freeze({
    unit: 's', better: 'lower', minimumQuestions: 1, attemptName: 'runs',
    success: (row) => finite(row.overloadAccuracy) ?? (row.isCorrect ? 100 : 0),
    speed: (row) => finite(row.overloadAverageResponse),
  }),
});
export const goalMetric = (game) => GOAL_METRICS[game] ?? ANSWER_METRIC;

// Seconds per question to reach at >= 90% success. Hard times are provisional
// until confirmed by the product owner.
export const GOAL_LADDER = Object.freeze({
  Easy: Object.freeze([10, 7.5, 5]),
  Medium: Object.freeze([15, 12, 10, 7.5, 5]),
  Hard: Object.freeze([20, 15, 12, 10, 7.5]),
});
// Cash handling goes one step further on Hard. Typing steps are words per minute;
// Multitasker steps are seconds per action.
const GAME_LADDER = Object.freeze({
  cash: Object.freeze({ ...GOAL_LADDER, Hard: Object.freeze([20, 15, 12, 10, 7.5, 5]) }),
  typing: Object.freeze({ Easy: Object.freeze([25, 30, 35]), Medium: Object.freeze([30, 40, 50]), Hard: Object.freeze([40, 50, 60, 70]) }),
  overload: Object.freeze({ Easy: Object.freeze([4, 3.5, 3]), Medium: Object.freeze([3.5, 3, 2.5]), Hard: Object.freeze([3, 2.5, 2]) }),
});
const LEVELS = Object.freeze(['Easy', 'Medium', 'Hard']);

export function goalsForGame(game) {
  if (!GOAL_GAMES.includes(game)) return [];
  const ladder = GAME_LADDER[game] ?? GOAL_LADDER;
  const { unit, better } = goalMetric(game);
  // `seconds` stays on time goals for older callers; `target` is the goal in the game's own unit.
  return LEVELS.flatMap((level) => ladder[level].map((target, index) => ({
    id: `${game}:${level}:${target}`, game, level, target, unit, better, ...(unit === 's' ? { seconds: target } : {}),
    step: index + 1, steps: ladder[level].length,
  })));
}

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * A run of attempts passes when it is long enough, success >= the required percent and its average speed reaches
 * the goal: seconds <= the goal, or words per minute >= the goal (all inclusive). `settings.window` is the run
 * length; without it any run of at least one attempt counts.
 */
export function meetsGoal(run, goal, { window = 1, successPercent = GOAL_SUCCESS_PERCENT } = {}) {
  const speed = run?.averageSpeed ?? run?.averageSeconds ?? null;
  if (!run || run.questions < window || speed === null) return false;
  const target = goal.target ?? goal.seconds;
  const fast = goal.better === 'higher' ? round2(speed) >= target : round2(speed) <= target;
  return run.level === goal.level && round2(run.successPercent) >= successPercent && fast;
}

/** Group saved attempts into completed timed rounds for one game, oldest first. */
export function roundsFromHistory(history, game) {
  const metric = goalMetric(game);
  const sessions = new Map();
  (Array.isArray(history) ? history : []).forEach((record, index) => {
    const row = normalizeHistoryRecord(record, index);
    if (!row || row.game !== game || !row.session || !LEVELS.includes(row.difficulty)) return;
    if (/guided/i.test(row.sessionMode ?? '')) return;
    const session = sessions.get(row.session) ?? { id: row.session, level: row.difficulty, rows: [], progressiveLevel: record.progressiveLevel ?? null };
    session.rows.push(row);
    sessions.set(row.session, session);
  });
  return [...sessions.values()].map((session) => {
    const speeds = session.rows.map(metric.speed).filter((value) => value !== null);
    const correct = session.rows.filter((row) => row.isCorrect).length;
    const averageSpeed = speeds.length ? speeds.reduce((sum, value) => sum + value, 0) / speeds.length : null;
    return {
      id: session.id, level: session.level, progressiveLevel: session.progressiveLevel,
      questions: session.rows.length, correct,
      successPercent: session.rows.length ? session.rows.reduce((sum, row) => sum + metric.success(row), 0) / session.rows.length : 0,
      averageSpeed, averageSeconds: metric.unit === 's' ? averageSpeed : null,
      timestampMs: Math.max(...session.rows.map((row) => row.timestampMs ?? 0)),
    };
  }).sort((a, b) => a.timestampMs - b.timestampMs);
}

/**
 * Walk attempts in time order. After each attempt, the latest `window` attempts of that difficulty form a run. A run
 * can pass the current goal and any later goals of the same level it also meets; a level opens only after the
 * previous level's goals all pass.
 */
export function goalProgress(history, game, savedSettings = {}) {
  const goals = goalsForGame(game);
  const rounds = roundsFromHistory(history, game);
  const settings = resolveGoalSettings(game, savedSettings);
  const metric = goalMetric(game);
  const passed = new Map();
  let current = 0;
  // Per difficulty: running totals so every run is measured in constant time.
  const levels = Object.fromEntries(LEVELS.map((level) => [level, { count: 0, correct: [0], success: [0], seconds: [0], timed: [0] }]));
  const runAt = (level, size) => {
    const track = levels[level];
    const from = track.count - size;
    const timed = track.timed[track.count] - track.timed[from];
    const averageSpeed = timed ? (track.seconds[track.count] - track.seconds[from]) / timed : null;
    return {
      level, questions: size, correct: track.correct[track.count] - track.correct[from],
      successPercent: (track.success[track.count] - track.success[from]) / size,
      averageSpeed, averageSeconds: metric.unit === 's' ? averageSpeed : null,
    };
  };
  const rows = deduplicateHistory(Array.isArray(history) ? history : []).filter((row) => row.game === game && row.session && LEVELS.includes(row.difficulty) && !/guided/i.test(row.sessionMode ?? ''));
  for (const row of rows) {
    const track = levels[row.difficulty];
    const speed = metric.speed(row);
    const timed = speed !== null;
    track.correct.push(track.correct[track.count] + (row.isCorrect ? 1 : 0));
    track.success.push(track.success[track.count] + metric.success(row));
    track.seconds.push(track.seconds[track.count] + (timed ? speed : 0));
    track.timed.push(track.timed[track.count] + (timed ? 1 : 0));
    track.count += 1;
    if (track.count < settings.window) continue;
    const run = runAt(row.difficulty, settings.window);
    while (current < goals.length && meetsGoal(run, goals[current], settings)) {
      passed.set(goals[current].id, row.session);
      current += 1;
    }
  }
  const currentLevel = goals[current]?.level ?? null;
  const track = currentLevel ? levels[currentLevel] : null;
  const latestSize = track ? Math.min(track.count, settings.window) : 0;
  const window = {
    size: settings.window, successPercentRequired: settings.successPercent, level: currentLevel,
    attempts: track?.count ?? 0, latest: latestSize ? runAt(currentLevel, latestSize) : null,
  };
  const levelOpen = (level) => goals.filter((goal) => LEVELS.indexOf(goal.level) < LEVELS.indexOf(level)).every((goal) => passed.has(goal.id));
  const scored = rounds.filter((round) => round.questions >= metric.minimumQuestions);
  const timedRounds = scored.filter((round) => round.averageSpeed !== null);
  const speeds = timedRounds.map((round) => round.averageSpeed);
  return {
    game,
    goals: goals.map((goal) => ({ ...goal, passed: passed.has(goal.id), unlocked: passed.has(goal.id) || goal === goals[current] })),
    current: goals[current] ?? null,
    passedCount: passed.size,
    total: goals.length,
    unlockedLevels: LEVELS.filter(levelOpen),
    unit: metric.unit, better: metric.better, attemptName: metric.attemptName,
    bestSpeed: speeds.length ? round2(metric.better === 'higher' ? Math.max(...speeds) : Math.min(...speeds)) : null,
    bestSeconds: speeds.length && metric.unit === 's' ? round2(Math.min(...speeds)) : null,
    bestSuccessPercent: scored.length ? round2(Math.max(...scored.map((round) => round.successPercent))) : null,
    latest: scored.at(-1) ?? null,
    rounds: scored.length,
    window,
    settings,
  };
}

// Progressive levels: each step is harder than the last on at least one axis
// and never easier on any. `base` is the difficulty the round is saved under.
export const PROGRESSIVE_LEVELS = Object.freeze({
  cash: Object.freeze([
    { level: 1, base: 'Easy', label: 'Up to $200, 1 cash item, 20s', preset: { maxDue: 20000, splitCount: 1 }, timeLimitSeconds: 20 },
    { level: 2, base: 'Easy', label: 'Up to $200, 3 cash items, 15s', preset: { maxDue: 20000, splitCount: 3 }, timeLimitSeconds: 15 },
    { level: 3, base: 'Medium', label: 'Up to $1,000, 4 cash items, 15s', preset: { maxDue: 100000, splitCount: 4 }, timeLimitSeconds: 15 },
    { level: 4, base: 'Medium', label: 'Up to $1,000, 6 cash items, 12s', preset: { maxDue: 100000, splitCount: 6 }, timeLimitSeconds: 12 },
    { level: 5, base: 'Hard', label: 'Up to $5,000, 8 cash items, 10s', preset: { maxDue: 500000, splitCount: 8 }, timeLimitSeconds: 10 },
    { level: 6, base: 'Hard', label: 'Up to $5,000, 10 cash items, 7s', preset: { maxDue: 500000, splitCount: 10 }, timeLimitSeconds: 7 },
  ]),
  'fraud-inspection': Object.freeze([
    { level: 1, base: 'Easy', label: 'Up to 2 issues, 60s, few fields', settings: { maximumErrors: 2, timeLimitSeconds: 60, fieldDensity: 'low', subtlety: 'easy' } },
    { level: 2, base: 'Easy', label: 'Up to 3 issues, 45s, few fields', settings: { maximumErrors: 3, timeLimitSeconds: 45, fieldDensity: 'low', subtlety: 'easy' } },
    { level: 3, base: 'Medium', label: 'Up to 4 issues, 40s, more fields, subtler', settings: { maximumErrors: 4, timeLimitSeconds: 40, fieldDensity: 'medium', subtlety: 'medium' } },
    { level: 4, base: 'Medium', label: 'Up to 4 issues, 30s, more fields, subtler', settings: { maximumErrors: 4, timeLimitSeconds: 30, fieldDensity: 'medium', subtlety: 'medium' } },
    { level: 5, base: 'Hard', label: 'Up to 5 issues, 20s, all fields, very subtle', settings: { maximumErrors: 5, timeLimitSeconds: 20, fieldDensity: 'high', subtlety: 'hard' } },
    { level: 6, base: 'Hard', label: 'Up to 6 issues, 15s, all fields, very subtle', settings: { maximumErrors: 6, timeLimitSeconds: 15, fieldDensity: 'high', subtlety: 'hard' } },
  ]),
});

const RANK = { easy: 0, low: 0, medium: 1, hard: 2, high: 2 };
/** Numeric difficulty vector: larger is harder on every axis. */
export function progressiveDifficulty(game, entry) {
  if (game === 'cash') return [entry.preset.maxDue, entry.preset.splitCount, -entry.timeLimitSeconds];
  const s = entry.settings;
  return [s.maximumErrors, -s.timeLimitSeconds, RANK[s.fieldDensity], RANK[s.subtlety]];
}

/** Levels the player may choose: a level opens when its base difficulty is open in the goal ladder. */
export function availableProgressiveLevels(history, game, savedSettings = {}) {
  const levels = PROGRESSIVE_LEVELS[game] ?? [];
  const open = new Set(goalProgress(history, game, savedSettings).unlockedLevels);
  return levels.map((entry) => ({ ...entry, unlocked: open.has(entry.base) }));
}

/** Fraud inspection overrides for one progressive level. */
export function fraudProgressiveOverrides(entry) {
  const { subtlety, ...rest } = entry.settings;
  return { ...rest, signatureDifficulty: subtlety, handwritingSimilarity: subtlety, alterationSubtlety: subtlety,
    dateDifficulty: subtlety, nameMatchDifficulty: subtlety, amountMatchDifficulty: subtlety, idDifficulty: subtlety };
}
