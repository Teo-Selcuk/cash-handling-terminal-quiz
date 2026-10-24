// Per-game progress projection: extends a game's own attempt history forward to guess success rate and answer
// speed at a few horizons, as a low / likely / high range. Pure: everything comes from the rows passed in.
import { deduplicateHistory } from './progress-analytics.mjs?v=20261021-fast';
import { goalMetric } from './speed-goals.mjs?v=20261021-goals';

const DAY_MS = 86400000;
export const PROJECTION_MINIMUM = Object.freeze({ attempts: 10, days: 14 });
export const PROJECTION_HORIZONS = Object.freeze([
  Object.freeze({ key: 'day', label: 'Next day', days: 1 }),
  Object.freeze({ key: 'few-days', label: 'Next few days', days: 3 }),
  Object.freeze({ key: 'week', label: 'Next week', days: 7 }),
  Object.freeze({ key: 'month', label: 'Next month', days: 30 }),
  Object.freeze({ key: 'six-months', label: '6 months', days: 182 }),
  Object.freeze({ key: 'year', label: '1 year', days: 365 }),
]);
// 1.28 standard errors either side: about 8 in 10 results land inside the range.
const RANGE_Z = 1.28;
const FIT_WINDOW = 200; // Only the latest attempts set the trend, so very old habits do not steer it.
const LEVEL_WINDOW = 20;
export const GAP_DAYS = 14;
export const PROJECTION_LIMITS = Object.freeze([
  'This is a guess made by extending your past trend. It is not a promise.',
  'Progress usually slows down over time, so the guess slows it down too.',
  'Results vary from day to day. The range shows how much.',
  'It assumes you keep practicing at about the same pace.',
]);
export const RANGE_MEANING = 'Likely is the middle guess. Low and high mark the range: about 8 in 10 times your result should land between them.';

const round1 = (value) => Math.round(value * 10) / 10;
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Least-squares line through (x, y): slope, intercept, slope standard error and spread of the points around it. */
export function linearFit(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, slopeError: 0, residualSd: 0 };
  const mx = mean(xs);
  const my = mean(ys);
  const sxx = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  const sxy = xs.reduce((sum, x, index) => sum + (x - mx) * (ys[index] - my), 0);
  const slope = sxx ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const sse = xs.reduce((sum, x, index) => sum + (ys[index] - (intercept + slope * x)) ** 2, 0);
  const residualSd = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  return { slope, intercept, slopeError: sxx ? residualSd / Math.sqrt(sxx) : 0, residualSd };
}

/** Future attempts, discounted because progress slows: H·ln(1 + N/H) grows more slowly than N. */
export const effectiveAttempts = (future, past) => (past > 0 ? past * Math.log(1 + future / past) : future);

/**
 * One measure's trend. `better` is 'higher' or 'lower'. The trend is called flat when the slope is smaller than
 * twice its own error or too small to matter; a flat trend is projected flat, never as a rise.
 */
export function measureTrend(points, { better = 'higher', smallChange = 1 } = {}) {
  if (points.length < 2) return null;
  const recent = points.slice(-FIT_WINDOW);
  const fit = linearFit(recent.map((point) => point.x), recent.map((point) => point.y));
  const lastX = recent.at(-1).x;
  const totalChange = fit.slope * (lastX - recent[0].x);
  const flat = Math.abs(fit.slope) < 2 * fit.slopeError || Math.abs(totalChange) < smallChange;
  // With no real trend the best guess of today's level is the plain average; otherwise it is the line's end.
  const level = flat ? mean(recent.map((point) => point.y)) : fit.intercept + fit.slope * lastX;
  const improving = !flat && (better === 'higher' ? fit.slope > 0 : fit.slope < 0);
  return {
    level, slope: flat ? 0 : fit.slope, rawSlope: fit.slope, slopeError: fit.slopeError, residualSd: fit.residualSd,
    used: recent.length, direction: flat ? 'flat' : improving ? 'improving' : 'falling',
    levelWindow: Math.min(LEVEL_WINDOW, recent.length),
  };
}

/** Low / likely / high after `future` more attempts. */
export function projectMeasure(trend, future, { min = 0, max = Infinity } = {}) {
  const effective = effectiveAttempts(future, trend.used);
  const likely = trend.level + trend.slope * effective;
  const spread = RANGE_Z * Math.sqrt((trend.slopeError * effective) ** 2 + trend.residualSd ** 2 / trend.levelWindow);
  const clamp = (value) => Math.min(max, Math.max(min, value));
  return { low: clamp(likely - spread), likely: clamp(likely), high: clamp(likely + spread) };
}

/** Attempts needed for the likely value to reach `target`, or null when the trend does not head there. */
export function attemptsToReach(trend, target, better) {
  const reached = better === 'higher' ? trend.level >= target : trend.level <= target;
  if (reached) return 0;
  if (!trend.slope || (better === 'higher') !== (trend.slope > 0)) return null;
  const effective = (target - trend.level) / trend.slope;
  const needed = trend.used * (Math.exp(effective / trend.used) - 1);
  return Number.isFinite(needed) && needed < 1e6 ? Math.ceil(needed) : null;
}

/** Turn saved attempts of one quiz game into projection rows: { timestampMs, session, level, success, speed }. */
export function projectionRows(history, game) {
  const metric = goalMetric(game);
  // deduplicateHistory hands back normalized rows (game, isAnswered, timestampMs, responseTimeSeconds, ...).
  return deduplicateHistory(Array.isArray(history) ? history : [])
    .filter((row) => row && row.game === game && row.isAnswered && Number.isFinite(row.timestampMs))
    .map((row) => ({
      timestampMs: row.timestampMs, session: row.session, level: row.difficulty,
      success: game === 'memory' && Number.isFinite(row.attemptScore) ? row.attemptScore * 100 : metric.success(row),
      speed: metric.speed(row),
    }))
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

/** Chess games as projection rows: success is a win (100) or not (0); speed is your average seconds per move. */
export function chessProjectionRows(games = []) {
  return games.filter((game) => game?.result && Number.isFinite(Date.parse(game.startedAt))).map((game) => {
    const moves = (game.moves ?? []).filter((move) => move.color === game.player && Number.isFinite(move.elapsedMs));
    return {
      timestampMs: Date.parse(game.startedAt), session: game.id, level: game.settings?.difficulty ?? null,
      success: game.result.winner === game.player ? 100 : 0,
      speed: moves.length ? moves.reduce((sum, move) => sum + move.elapsedMs, 0) / moves.length / 1000 : null,
    };
  }).sort((a, b) => a.timestampMs - b.timestampMs);
}

export function practicePace(rows) {
  const first = rows[0].timestampMs;
  const last = rows.at(-1).timestampMs;
  const spanDays = (last - first) / DAY_MS;
  const weeks = Math.max(1, spanDays / 7);
  const sessions = new Set(rows.map((row, index) => row.session ?? `row-${index}`)).size;
  return { spanDays, weeks, attempts: rows.length, sessions, attemptsPerWeek: rows.length / weeks, sessionsPerWeek: sessions / weeks };
}

export function practiceGaps(rows, now = Date.now()) {
  let longest = { days: 0, from: null, to: null };
  for (let index = 1; index < rows.length; index += 1) {
    const days = (rows[index].timestampMs - rows[index - 1].timestampMs) / DAY_MS;
    if (days > longest.days) longest = { days, from: rows[index - 1].timestampMs, to: rows[index].timestampMs };
  }
  const sinceLast = (now - rows.at(-1).timestampMs) / DAY_MS;
  const notes = [];
  if (longest.days >= GAP_DAYS) notes.push(`There was a break of ${Math.round(longest.days)} days in your practice. Breaks slow progress, so treat the guess with extra care.`);
  if (sinceLast >= GAP_DAYS) notes.push(`Your last try was ${Math.round(sinceLast)} days ago. The guess assumes you start again at your old pace.`);
  return { longestDays: longest.days, sinceLastDays: sinceLast, notes };
}

const speedText = (value, unit) => (unit === 'WPM' ? `${round1(value)} WPM` : `${round1(value)} s`);

function adviceLine({ success, speed, goal, unit, better, successTrend, attemptName }) {
  if (attemptName === 'games') {
    const line = success.level >= 50 ? 'Your win rate is strong: try a stronger computer level.' : 'Focus on fewer mistakes: take more time on each move and replay games you lost.';
    return successTrend.direction === 'falling' ? `${line} Your recent results are slipping, so shorter, more regular sessions may help.` : line;
  }
  const required = goal?.successPercent ?? 90;
  const accurate = success.level >= required;
  const target = goal?.target;
  const fast = speed === null || target === undefined || target === null ? null : better === 'higher' ? speed.level >= target : speed.level <= target;
  let line;
  if (fast === null) line = accurate ? 'Keep going: your success rate is strong. Try a harder level to keep growing.' : 'Focus on accuracy: slow down and check each answer before you submit.';
  else if (accurate && !fast) line = `Focus on speed: accuracy is steady, but ${unit === 'WPM' ? 'typing is slow' : 'answers are slow'} for the next goal.`;
  else if (!accurate && fast) line = 'Focus on accuracy: you are fast enough, but too many answers are wrong.';
  else if (!accurate && !fast) line = 'Focus on accuracy first, then speed: get answers right, and speed will follow.';
  else line = 'Both parts of the next goal are in reach: finish a full run in a row to check it off.';
  if (successTrend.direction === 'falling') line += ' Your recent results are slipping, so shorter, more regular sessions may help.';
  return line;
}

/**
 * Projection for one game. `rows` come from projectionRows / chessProjectionRows. `goal` (optional) is the next
 * speed goal: { level, target, unit, better, successPercent, window }.
 */
export function buildProjection(rows, { now = Date.now(), unit = 's', better = 'lower', goal = null, attemptName = 'attempts' } = {}) {
  const sorted = [...(rows ?? [])].filter((row) => Number.isFinite(row?.timestampMs)).sort((a, b) => a.timestampMs - b.timestampMs);
  if (!sorted.length) return { status: 'empty', message: 'No attempts yet.' };
  const pace = practicePace(sorted);
  if (sorted.length < PROJECTION_MINIMUM.attempts || pace.spanDays < PROJECTION_MINIMUM.days) {
    return { status: 'insufficient', message: 'Not enough data yet',
      detail: `A projection needs at least ${PROJECTION_MINIMUM.attempts} ${attemptName} over ${PROJECTION_MINIMUM.days} days. You have ${sorted.length} ${attemptName} over ${Math.floor(pace.spanDays)} ${Math.floor(pace.spanDays) === 1 ? 'day' : 'days'}.`, pace };
  }
  const successPoints = sorted.map((row, index) => ({ x: index, y: row.success }));
  const speedPoints = sorted.map((row, index) => ({ x: index, y: row.speed })).filter((point) => Number.isFinite(point.y));
  const successTrend = measureTrend(successPoints, { better: 'higher', smallChange: 2 });
  const speedTrend = speedPoints.length >= 2 ? measureTrend(speedPoints, { better, smallChange: Math.max(0.05 * Math.abs(mean(speedPoints.map((point) => point.y))), 0.1) }) : null;
  const speedLimits = { min: unit === 'WPM' ? 0 : 0.1 };
  const horizons = PROJECTION_HORIZONS.map((horizon) => {
    const future = pace.attemptsPerWeek * (horizon.days / 7);
    return { ...horizon, future,
      success: projectMeasure(successTrend, future, { min: 0, max: 100 }),
      speed: speedTrend ? projectMeasure(speedTrend, future, speedLimits) : null };
  });
  let goalPlan = null;
  if (goal) {
    const levelRows = sorted.filter((row) => row.level === goal.level);
    const useLevel = levelRows.length >= PROJECTION_MINIMUM.attempts;
    const base = useLevel ? levelRows : sorted;
    const levelSuccess = measureTrend(base.map((row, index) => ({ x: index, y: row.success })), { better: 'higher', smallChange: 2 }) ?? successTrend;
    const levelSpeedPoints = base.map((row, index) => ({ x: index, y: row.speed })).filter((point) => Number.isFinite(point.y));
    const levelSpeed = levelSpeedPoints.length >= 2 ? measureTrend(levelSpeedPoints, { better, smallChange: 0.1 }) : speedTrend;
    const forSuccess = attemptsToReach(levelSuccess, goal.successPercent, 'higher');
    const forSpeed = levelSpeed ? attemptsToReach(levelSpeed, goal.target, better) : null;
    const trendAttempts = forSuccess === null || forSpeed === null ? null : Math.max(forSuccess, forSpeed);
    // A goal is checked off by a run of `window` attempts in a row, so that run comes on top.
    const totalAttempts = trendAttempts === null ? null : trendAttempts + (goal.window ?? 0);
    const levelPace = useLevel ? practicePace(levelRows).attemptsPerWeek : pace.attemptsPerWeek;
    goalPlan = { ...goal, usedLevelOnly: useLevel, successLevel: levelSuccess.level, speedLevel: levelSpeed?.level ?? null,
      attemptsForSuccess: forSuccess, attemptsForSpeed: forSpeed, totalAttempts,
      weeksAtCurrentPace: totalAttempts === null || !levelPace ? null : totalAttempts / levelPace,
      attemptsPerWeekFor4Weeks: totalAttempts === null ? null : Math.ceil(totalAttempts / 4), levelPace };
  }
  return {
    status: 'ok', pace, successTrend, speedTrend, horizons, goal: goalPlan, unit, better, attemptName,
    gaps: practiceGaps(sorted, now),
    // Advice compares the goal's own level when there is a goal, so it matches the goal lines above it.
    advice: adviceLine({ success: goalPlan ? { level: goalPlan.successLevel } : successTrend,
      speed: goalPlan ? (goalPlan.speedLevel === null ? null : { level: goalPlan.speedLevel }) : speedTrend, goal, unit, better, successTrend, attemptName }),
    limits: PROJECTION_LIMITS, rangeMeaning: RANGE_MEANING,
    paceText: `About ${round1(pace.sessionsPerWeek)} sessions per week (${round1(pace.attemptsPerWeek)} ${attemptName} per week).`,
    trendText: [
      successTrend.direction === 'flat' ? 'Success rate: flat. It has held about steady, so the guess stays level.'
        : successTrend.direction === 'improving' ? `Success rate: rising by about ${round1(successTrend.slope * 10)} points every 10 ${attemptName}.`
          : `Success rate: falling by about ${round1(Math.abs(successTrend.slope) * 10)} points every 10 ${attemptName}. The guess shows that honestly.`,
      !speedTrend ? 'Speed: not enough timed answers to see a trend.'
        : speedTrend.direction === 'flat' ? 'Speed: flat. It has held about steady, so the guess stays level.'
          : speedTrend.direction === 'improving' ? `Speed: getting better by about ${speedText(Math.abs(speedTrend.slope) * 10, unit)} every 10 ${attemptName}.`
            : `Speed: getting worse by about ${speedText(Math.abs(speedTrend.slope) * 10, unit)} every 10 ${attemptName}. The guess shows that honestly.`,
    ],
  };
}
