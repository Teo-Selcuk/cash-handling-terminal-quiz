// Per-game speed goals and progressive levels. Goal progress is derived from the
// saved attempt history, so it persists wherever that history persists.
import { normalizeHistoryRecord } from './progress-analytics.mjs?v=20261017-perf';

export const GOAL_SUCCESS_PERCENT = 90;
export const GOAL_MINIMUM_QUESTIONS = 5;
export const GOAL_GAMES = Object.freeze(['cash', 'memory', 'task', 'error-detection', 'fraud-inspection']);

// Seconds per question to reach at >= 90% success. Hard times are provisional
// until confirmed by the product owner.
export const GOAL_LADDER = Object.freeze({
  Easy: Object.freeze([10, 7.5, 5]),
  Medium: Object.freeze([15, 12, 10, 7.5, 5]),
  Hard: Object.freeze([20, 15, 12, 10, 7.5]),
});
const LEVELS = Object.freeze(['Easy', 'Medium', 'Hard']);

export function goalsForGame(game) {
  if (!GOAL_GAMES.includes(game)) return [];
  return LEVELS.flatMap((level) => GOAL_LADDER[level].map((seconds, index) => ({
    id: `${game}:${level}:${seconds}`, game, level, seconds, step: index + 1, steps: GOAL_LADDER[level].length,
  })));
}

const round2 = (value) => Math.round(value * 100) / 100;

/** A round passes when success >= 90% and average seconds <= the goal (both inclusive). */
export function meetsGoal(round, goal) {
  if (!round || round.questions < GOAL_MINIMUM_QUESTIONS || round.averageSeconds === null) return false;
  return round.level === goal.level && round2(round.successPercent) >= GOAL_SUCCESS_PERCENT && round2(round.averageSeconds) <= goal.seconds;
}

/** Group saved attempts into completed timed rounds for one game, oldest first. */
export function roundsFromHistory(history, game) {
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
    const timed = session.rows.filter((row) => row.isAnswered && row.responseTimeSeconds !== null);
    const correct = session.rows.filter((row) => row.isCorrect).length;
    return {
      id: session.id, level: session.level, progressiveLevel: session.progressiveLevel,
      questions: session.rows.length, correct,
      successPercent: session.rows.length ? (correct / session.rows.length) * 100 : 0,
      averageSeconds: timed.length ? timed.reduce((sum, row) => sum + row.responseTimeSeconds, 0) / timed.length : null,
      timestampMs: Math.max(...session.rows.map((row) => row.timestampMs ?? 0)),
    };
  }).sort((a, b) => a.timestampMs - b.timestampMs);
}

/**
 * Walk rounds in time order. A round can pass the current goal and any later
 * goals of the same level it also meets; a level opens only after the previous
 * level's goals all pass.
 */
export function goalProgress(history, game) {
  const goals = goalsForGame(game);
  const rounds = roundsFromHistory(history, game);
  const passed = new Map();
  let current = 0;
  for (const round of rounds) {
    while (current < goals.length && meetsGoal(round, goals[current])) {
      passed.set(goals[current].id, round.id);
      current += 1;
    }
  }
  const levelOpen = (level) => goals.filter((goal) => LEVELS.indexOf(goal.level) < LEVELS.indexOf(level)).every((goal) => passed.has(goal.id));
  const scored = rounds.filter((round) => round.questions >= GOAL_MINIMUM_QUESTIONS);
  const timedRounds = scored.filter((round) => round.averageSeconds !== null);
  return {
    game,
    goals: goals.map((goal) => ({ ...goal, passed: passed.has(goal.id), unlocked: passed.has(goal.id) || goal === goals[current] })),
    current: goals[current] ?? null,
    passedCount: passed.size,
    total: goals.length,
    unlockedLevels: LEVELS.filter(levelOpen),
    bestSeconds: timedRounds.length ? round2(Math.min(...timedRounds.map((round) => round.averageSeconds))) : null,
    bestSuccessPercent: scored.length ? round2(Math.max(...scored.map((round) => round.successPercent))) : null,
    latest: scored.at(-1) ?? null,
    rounds: scored.length,
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
export function availableProgressiveLevels(history, game) {
  const levels = PROGRESSIVE_LEVELS[game] ?? [];
  const open = new Set(goalProgress(history, game).unlockedLevels);
  return levels.map((entry) => ({ ...entry, unlocked: open.has(entry.base) }));
}

/** Fraud inspection overrides for one progressive level. */
export function fraudProgressiveOverrides(entry) {
  const { subtlety, ...rest } = entry.settings;
  return { ...rest, signatureDifficulty: subtlety, handwritingSimilarity: subtlety, alterationSubtlety: subtlety,
    dateDifficulty: subtlety, nameMatchDifficulty: subtlety, amountMatchDifficulty: subtlety, idDifficulty: subtlety };
}
