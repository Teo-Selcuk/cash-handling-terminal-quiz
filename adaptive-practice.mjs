import {
  ERROR_DETECTION_PUZZLE_FAMILIES, formatMoney, resolveCashDifficultyPreset,
  resolveMemoryDifficultyPreset, resolveTaskDifficultyPreset, resolveErrorDetectionDifficultyPreset,
} from './quiz-core.mjs?v=20260908-practice';
import { PATTERN_GAME_NAMES } from './pattern-games.mjs';

export const PRACTICE_GAMES = Object.freeze({ cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation', 'error-detection': 'Error detection' });
const resolvers = { cash: resolveCashDifficultyPreset, memory: resolveMemoryDifficultyPreset, task: resolveTaskDifficultyPreset, 'error-detection': resolveErrorDetectionDifficultyPreset };
const familyNames = { 'symbol-matrix': 'Visual symbol matrix', 'number-machine': 'Number machine', 'cipher-check': 'Cipher ring check', 'logic-schedule': 'Logic schedule board', 'route-network': 'Visual route network', ...PATTERN_GAME_NAMES };
const progressionRule = 'Next step: at least 90% correct over 10 rounds across two completed sessions, with at least 80% in each. Below 70% over 5 completed rounds suggests one smaller step.';
const bounded = (value, min, max) => Math.max(min, Math.min(max, value));
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const objectFromJson = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
};

function gameOf(record) {
  return Object.hasOwn(PRACTICE_GAMES, record.game) ? record.game
    : Object.keys(PRACTICE_GAMES).find((game) => PRACTICE_GAMES[game] === record.gameType)
      ?? (record.gameType == null && record.amountDueCents != null ? 'cash' : null);
}

function recentHistory(history, game, difficulty) {
  const unique = new Map();
  (Array.isArray(history) ? history : []).forEach((r, index) => {
    if (!r || typeof r !== 'object' || gameOf(r) !== game || r.difficulty !== difficulty
        || !['Correct', 'Incorrect', 'Timed Out', 'Not answered'].includes(r.outcome)) return;
    const key = r.sessionId && integer(r.questionNumber, 1, 100) ? `${r.sessionId}:${r.questionNumber}` : `legacy:${index}`;
    const previous = unique.get(key);
    if (previous && r.outcome === 'Not answered' && previous.outcome !== 'Not answered') return;
    unique.set(key, { ...r, _index: index });
  });
  return [...unique.values()].sort((a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0) || a._index - b._index).slice(-120);
}

function sessionOptions(record, game) {
  const options = { distraction: record.continuousNoise === true };
  if (game === 'cash') {
    options.cashSessionMode = record.sessionMode === 'Guided practice' ? 'guided' : 'testing';
    options.cashBuilder = record.cashBuilder === true || /Cash builder/.test(record.answerMode ?? '');
    options.customerRequests = record.customerRequests === true || /customer requests/.test(record.answerMode ?? '');
    options.timeLimitSeconds = integer(record.timeLimitSeconds, 3, 300) ? record.timeLimitSeconds : 30;
  }
  return options;
}

function sourcePreset(record, game, difficulty, currentPreset) {
  try { return resolvers[game](difficulty, objectFromJson(record.settingsJson) ?? currentPreset ?? {}); }
  catch { return resolvers[game](difficulty); }
}

function memoryValues(record) {
  const parse = (value) => typeof value === 'string' ? value.split('•').map((part) => part.trim()) : [];
  const expected = Array.isArray(record.expectedValues) ? record.expectedValues
    : typeof record.expectedAnswer === 'string' && record.expectedAnswer.startsWith('Values: ') ? parse(record.expectedAnswer.slice(8)) : [];
  const answered = Array.isArray(record.answeredValues) ? record.answeredValues : parse(record.userAnswer);
  if (!expected.length || expected.length > 100 || expected.some((v) => typeof v !== 'string' || !/^\d+(?:\.\d+)?$/.test(v) || v.replace('.', '').length > 100)) return null;
  return { expected, answered };
}

function evidenceFor(records) {
  return records.map((r) => ({ sessionId: r.sessionId ?? '', questionNumber: r.questionNumber ?? null, timestamp: r.timestamp ?? '', outcome: r.outcome }));
}

function groupsFor(records, game, difficulty, currentPreset) {
  const groups = new Map();
  function add(record, focusKey, title, preset, focus, axis, correct, detail = '') {
    const options = sessionOptions(record, game);
    // Different settings and conditions must not impersonate one measured threshold.
    const key = JSON.stringify([focusKey, options, record.sessionMode ?? 'legacy', preset]);
    if (!groups.has(key)) groups.set(key, { key, title, preset, focus, axis, options, observations: [], detail });
    groups.get(key).observations.push({ record, correct });
  }
  for (const r of records) {
    if (r.practicePlanJson) continue;
    const preset = sourcePreset(r, game, difficulty, currentPreset);
    if (game === 'memory') {
      const values = memoryValues(r);
      if (!values) continue;
      const { expected, answered } = values;
      const decimals = expected.some((v) => v.includes('.'));
      const counts = new Map();
      expected.forEach((value, i) => {
        const digits = value.replace('.', '').length;
        if (!counts.has(digits)) counts.set(digits, true);
        counts.set(digits, counts.get(digits) && r.outcome !== 'Timed Out' && value === String(answered[i] ?? '').replaceAll(/\s/g, ''));
      });
      // One observation per digit length per round avoids inflating evidence from a large list.
      for (const [digits, correct] of counts) {
        const target = Math.max(1, digits - 1);
        const settings = { ...preset, minimumDigits: target, maximumDigits: target,
          minimumValues: expected.length, maximumValues: expected.length, decimals,
          readSeconds: integer(r.readTimeSeconds, 1, 60) ? r.readTimeSeconds : preset.readSeconds,
          writeSeconds: integer(r.writeTimeSeconds, 1, 300) ? r.writeTimeSeconds : preset.writeSeconds };
        delete settings.digits;
        add(r, `digits:${digits}`, `${digits} digits with ${expected.length} value${expected.length === 1 ? '' : 's'}`, settings, {}, 'digits', correct,
          `Practice ${target} digits${target < digits ? ', one digit below this observed length' : ', the minimum supported length'}. Keep the value count and recorded timing fixed.`);
      }
    } else if (game === 'cash') {
      if (!integer(r.amountDueCents, 100, 10000000) || !integer(r.cashGivenCents, 100, 20000000)) continue;
      const type = r.cashGivenCents > r.amountDueCents ? 'Change' : r.cashGivenCents < r.amountDueCents ? 'Short' : 'Exact';
      const bands = [100, 5000, 10000, 20000, 50000, 100000, 500000, 1000000, 10000001];
      const index = bands.findIndex((upper) => upper > r.amountDueCents);
      if (index < 1) continue;
      const low = bands[index - 1];
      const high = Math.min(10000000, bands[index] - 1);
      const settings = { ...preset, minDue: Math.max(preset.minDue, low), maxDue: Math.min(preset.maxDue, high) };
      if (settings.minDue > settings.maxDue) { settings.minDue = low; settings.maxDue = high; }
      settings.maxDifference = Math.max(preset.step, Math.floor(preset.maxDifference * 0.8 / preset.step) * preset.step);
      if (type === 'Exact') settings.splitCount = Math.max(1, preset.splitCount - 1);
      add(r, `${type}:${low}`, `${type} at ${formatMoney(low)} to ${formatMoney(high)}`, settings, { expectedType: type }, type === 'Exact' ? 'cashItems' : 'difference', r.outcome === 'Correct',
        type === 'Exact' ? `Focus on exact payments in this amount band with a cash split count of ${settings.splitCount}.`
          : `Focus on this amount band and reduce the maximum difference from ${formatMoney(preset.maxDifference)} to ${formatMoney(settings.maxDifference)}.`);
    } else if (game === 'task') {
      if (!integer(r.stepsExpected, 2, 10)) continue;
      const kind = ['records', 'casework', 'invoice'].includes(r.workspaceKind) ? r.workspaceKind : null;
      const steps = Math.max(2, r.stepsExpected - 1);
      const settings = { ...preset, minimumSteps: steps, maximumSteps: steps };
      if (integer(r.timeLimitSeconds, 0, 900)) settings.recallSeconds = r.timeLimitSeconds;
      add(r, `${kind ?? 'mixed'}:${r.stepsExpected}`, `${kind ?? 'Mixed workflow'} with ${r.stepsExpected} steps`, settings,
        kind ? { workspaceKind: kind } : {}, 'steps', r.outcome === 'Correct',
        `Practice ${steps} steps${steps < r.stepsExpected ? ', one fewer than these rounds' : ', the minimum supported sequence'}.${kind ? '' : ' Older records do not identify the workflow; this plan uses mixed workflows.'}`);
    } else {
      if (!integer(r.detailCount, 3, 8)) continue;
      const family = ERROR_DETECTION_PUZZLE_FAMILIES.includes(r.puzzleFamilyId) ? r.puzzleFamilyId
        : ERROR_DETECTION_PUZZLE_FAMILIES.find((id) => familyNames[id] === r.puzzleFamily);
      if (!family) continue;
      const details = Math.max(3, r.detailCount - 1);
      const settings = { ...preset, details, maximumErrors: Math.min(details, preset.maximumErrors) };
      if (integer(r.timeLimitSeconds, 3, 300)) settings.timeLimitSeconds = r.timeLimitSeconds;
      add(r, `${family}:${r.detailCount}`, `${familyNames[family]} with ${r.detailCount} clues`, settings, { puzzleFamily: family }, 'clues', r.outcome === 'Correct',
        `Practice the same puzzle family with ${details} clues${details < r.detailCount ? ', one fewer to check' : ', the minimum supported count'}. Keep the rule difficulty fixed.`);
    }
  }
  return [...groups.values()];
}

function validatePlan(raw, game, difficulty) {
  const axes = { cash: ['difference', 'cashItems'], memory: ['digits'], task: ['steps'], 'error-detection': ['clues'] };
  if (!raw || raw.game !== game || raw.difficulty !== difficulty || typeof raw.id !== 'string'
      || typeof raw.target !== 'string' || typeof raw.basis !== 'string' || !Array.isArray(raw.evidence)
      || !objectFromJson(raw.preset) || !objectFromJson(raw.focus)
      || !integer(raw.questionCount, 1, 100) || !objectFromJson(raw.options) || typeof raw.options.distraction !== 'boolean'
      || !integer(raw.stage, 0, 10000) || !axes[game].includes(raw.axis)) return null;
  if (game === 'cash' && (!['guided', 'testing'].includes(raw.options.cashSessionMode)
      || typeof raw.options.cashBuilder !== 'boolean' || typeof raw.options.customerRequests !== 'boolean'
      || !integer(raw.options.timeLimitSeconds, 3, 300))) return null;
  try {
    const preset = resolvers[game](difficulty, raw.preset);
    const focus = raw.focus ?? {};
    if (focus.expectedType && !['Change', 'Short', 'Exact'].includes(focus.expectedType)) return null;
    if (focus.workspaceKind && !['records', 'casework', 'invoice'].includes(focus.workspaceKind)) return null;
    if (focus.puzzleFamily && !ERROR_DETECTION_PUZZLE_FAMILIES.includes(focus.puzzleFamily)) return null;
    return { ...raw, preset, focus };
  } catch { return null; }
}

function changeStep(plan, direction) {
  const p = { ...plan.preset };
  if (plan.axis === 'digits') p.minimumDigits = p.maximumDigits = bounded(p.maximumDigits + direction, 1, 100);
  if (plan.axis === 'steps') p.minimumSteps = p.maximumSteps = bounded(p.maximumSteps + direction, 2, 10);
  if (plan.axis === 'clues') {
    p.details = bounded(p.details + direction, 3, 8);
    p.maximumErrors = Math.min(p.maximumErrors, p.details);
  }
  if (plan.axis === 'cashItems') p.splitCount = bounded(p.splitCount + direction, 1, p.allowed.length);
  if (plan.axis === 'difference') {
    const increment = Math.max(p.step, Math.round(p.maxDifference * 0.2 / p.step) * p.step);
    p.maxDifference = bounded(p.maxDifference + direction * increment, p.step, 10000000);
  }
  return resolvers[plan.game](plan.difficulty, p);
}

function continuingPlan(records, game, difficulty) {
  const tagged = records.map((r) => ({ record: r, plan: validatePlan(objectFromJson(r.practicePlanJson), game, difficulty) })).filter((entry) => entry.plan);
  const latest = tagged.at(-1)?.plan;
  if (!latest) return null;
  const signature = (p) => JSON.stringify([p.id, p.stage, p.preset, p.focus, p.options]);
  const completed = tagged.filter(({ record, plan }) => signature(plan) === signature(latest)
    && record.sessionId && Number.isFinite(Date.parse(record.sessionCompletedAt))).map(({ record }) => record);
  const recentSessions = [...new Set(completed.map((r) => r.sessionId))].slice(-2);
  const rounds = recentSessions.flatMap((id) => completed.filter((r) => r.sessionId === id).slice(-10));
  const correct = rounds.filter((r) => r.outcome === 'Correct').length;
  const sessions = new Map();
  for (const r of rounds) {
    if (!sessions.has(r.sessionId)) sessions.set(r.sessionId, []);
    sessions.get(r.sessionId).push(r);
  }
  const mastered = rounds.length >= 10 && correct / rounds.length >= 0.9 && sessions.size >= 2
    && [...sessions.values()].every((rows) => rows.filter((r) => r.outcome === 'Correct').length / rows.length >= 0.8);
  const struggling = rounds.length >= 5 && correct / rounds.length < 0.7;
  const direction = mastered ? 1 : struggling ? -1 : 0;
  const preset = direction ? changeStep(latest, direction) : latest.preset;
  const changed = JSON.stringify(preset) !== JSON.stringify(latest.preset);
  const action = changed ? direction > 0 ? 'Increase one step' : 'Reduce one step' : 'Keep this practice level';
  return { ...latest, preset, stage: latest.stage + (changed ? 1 : 0), title: `${action}: ${latest.target}`,
    reason: `${correct} of ${rounds.length} recent rounds correct across ${sessions.size} completed session${sessions.size === 1 ? '' : 's'} at this practice level. ${action}. ${latest.basis}`,
    evidence: evidenceFor(rounds), progress: { correct, rounds: rounds.length, sessions: sessions.size }, progressionRule };
}

export function recommendPractice(history, game, difficulty, currentPreset) {
  if (!Object.hasOwn(resolvers, game)) throw new RangeError('Unknown practice module.');
  resolvers[game](difficulty);
  const reached = recentHistory(history, game, difficulty);
  const records = reached.filter((r) => r.outcome !== 'Not answered');
  const result = { game, difficulty, attempts: records.length, unanswered: reached.length - records.length, plans: [] };
  const ongoing = continuingPlan(records, game, difficulty);
  if (ongoing) result.plans.push(ongoing);
  const baselineTimes = records.map((record) => Number(record.timeUsedSeconds)).filter((value) => Number.isFinite(value) && value >= 0);
  const baselineTime = baselineTimes.length ? baselineTimes.reduce((sum, value) => sum + value, 0) / baselineTimes.length : null;
  const baselineAccuracy = records.length ? records.filter((record) => record.outcome === 'Correct').length / records.length * 100 : null;
  const groups = groupsFor(records, game, difficulty, currentPreset).map((g) => {
    const observations = g.observations.slice(-20);
    const misses = observations.filter((o) => !o.correct).length;
    const times = observations.map(({ record }) => Number(record.timeUsedSeconds)).filter((value) => Number.isFinite(value) && value >= 0);
    const averageTime = times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : null;
    const speedSlowdownPercent = baselineTime && averageTime ? Math.round(((averageTime / baselineTime) - 1) * 100) : 0;
    const slowResponses = baselineTime ? observations.filter(({ record }) => Number(record.timeUsedSeconds) >= baselineTime * 1.2).length : 0;
    const accuracy = (1 - misses / observations.length) * 100;
    const accuracyGap = baselineAccuracy === null ? 0 : Math.round(baselineAccuracy - accuracy);
    const latest = Math.max(...observations.map(({ record }) => Date.parse(record.timestamp) || 0));
    return { ...g, observations, misses, rate: misses / observations.length, averageTime, baselineTime,
      speedSlowdownPercent, slowResponses, accuracy, baselineAccuracy, accuracyGap, latest };
  }).filter((g) => g.observations.length >= 5
    && ((g.misses >= 2 && g.rate > 0.2) || (g.slowResponses >= 2 && g.speedSlowdownPercent >= 20)))
    .sort((a, b) => b.accuracyGap - a.accuracyGap || b.speedSlowdownPercent - a.speedSlowdownPercent
      || b.latest - a.latest || b.observations.length - a.observations.length || a.key.localeCompare(b.key));
  for (const g of groups) {
    const id = `${game}:${difficulty}:${g.key}`;
    if (id === ongoing?.id) continue;
    const observations = g.observations.map((o) => o.record);
    const timeouts = observations.filter((r) => r.outcome === 'Timed Out').length;
    let reason = `${g.misses} of ${observations.length} recent rounds missed on ${g.title} (${timeouts} timed out).`;
    if (g.speedSlowdownPercent >= 20) reason += ` Average response time was ${g.averageTime.toFixed(1)}s versus ${g.baselineTime.toFixed(1)}s across this game's comparable rounds (${g.speedSlowdownPercent}% slower).`;
    if (game === 'error-detection') {
      const missed = observations.reduce((sum, r) => sum + Math.max(0, Number(r.expectedErrorCount || 0) - Number(r.correctlyFlagged || 0)), 0);
      const falseMarks = observations.reduce((sum, r) => sum + Math.max(0, Number(r.falseFlagCount || 0)), 0);
      reason += ` These rounds contain ${missed} missed anomalies and ${falseMarks} false marks.`;
    }
    if (observations.some((r) => !objectFromJson(r.settingsJson))) reason += ' Older records lack full settings; unrecorded settings use your current preset.';
    let preset;
    try { preset = resolvers[game](difficulty, g.preset); } catch { continue; }
    const plan = { id, game, difficulty, stage: 0, target: g.title, title: `Focused practice: ${g.title}`,
      basis: reason, reason: `${reason}${g.detail ? ` ${g.detail}` : ''}`, preset, focus: g.focus, options: g.options, axis: g.axis,
      questionCount: 10, evidence: evidenceFor(observations), progressionRule,
      evidenceStats: { attempts: observations.length, errors: g.misses, timeouts, accuracyPercent: Math.round(g.accuracy), baselineAccuracyPercent: Math.round(g.baselineAccuracy ?? g.accuracy),
        accuracyGap: g.accuracyGap, averageResponseTimeSeconds: g.averageTime, baselineResponseTimeSeconds: g.baselineTime, speedSlowdownPercent: g.speedSlowdownPercent, latest: g.latest } };
    result.plans.push(plan);
    if (result.plans.length >= 3) break;
  }
  result.message = records.length < 5 ? 'Complete at least 5 scored rounds at this difficulty to build a practice recommendation.'
    : result.plans.length ? `Based on up to ${reached.length} recent reached rounds at ${difficulty}.`
      : 'No repeated weak spot has enough comparable evidence yet. Continue regular practice.';
  return result;
}

/**
 * Return comparable, game-specific plan candidates in one deterministic global
 * order. The visible UI chooses one, while manual review can still expose it.
 */
export function rankPracticeCandidates(history, presets = {}) {
  const candidates = [];
  for (const game of Object.keys(PRACTICE_GAMES)) {
    for (const difficulty of ['Easy', 'Medium', 'Hard']) {
      const currentPreset = presets?.[game]?.[difficulty] ?? presets?.[game] ?? undefined;
      const result = recommendPractice(history, game, difficulty, currentPreset);
      result.plans.filter((plan) => plan.evidenceStats).forEach((plan) => {
        candidates.push({ ...plan, rank: plan.evidenceStats });
      });
    }
  }
  return candidates.sort((left, right) => right.rank.accuracyGap - left.rank.accuracyGap
    || right.rank.speedSlowdownPercent - left.rank.speedSlowdownPercent || right.rank.latest - left.rank.latest
    || right.rank.attempts - left.rank.attempts || left.id.localeCompare(right.id));
}

export function practiceSettings(plan) {
  const p = plan.preset;
  const seconds = (value) => value === 0 ? 'Untimed' : `${value}s`;
  const rows = [['Difficulty', plan.difficulty], ['Rounds', String(plan.questionCount)]];
  if (plan.game === 'cash') rows.push(['Amount due', `${formatMoney(p.minDue)} to ${formatMoney(p.maxDue)}`], ['Transaction', plan.focus.expectedType ?? 'Mixed'],
    ['Maximum difference', formatMoney(p.maxDifference)], ['Increment', formatMoney(p.step)], ['Cash split count', String(p.splitCount)],
    ['Session', plan.options.cashSessionMode === 'guided' ? 'Guided practice, untimed' : `Testing, ${plan.options.timeLimitSeconds}s`],
    ['Cash builder / requests', `${plan.options.cashBuilder ? 'On' : 'Off'} / ${plan.options.customerRequests ? 'On' : 'Off'}`]);
  if (plan.game === 'memory') rows.push(['Digits per value', String(p.maximumDigits)], ['Values per round', String(p.maximumValues)],
    ['Decimals', p.decimals ? 'On' : 'Off'], ['Read / write time', `${p.readSeconds}s / ${p.writeSeconds}s`]);
  if (plan.game === 'task') rows.push(['Workflow', plan.focus.workspaceKind ?? 'Mixed'], ['Steps', String(p.maximumSteps)], ['Rows / tabs', `${p.rows} / ${p.tabs}`],
    ['Briefing / recall', `${seconds(p.briefingSeconds)} / ${seconds(p.recallSeconds)}`], ['Demo per step', `${p.demoStepMilliseconds / 1000}s`]);
  if (plan.game === 'error-detection') rows.push(['Puzzle family', familyNames[plan.focus.puzzleFamily] ?? 'Mixed'], ['Clues', String(p.details)],
    ['Maximum anomalies', String(p.maximumErrors)], ['Time per round', `${p.timeLimitSeconds}s`]);
  rows.push(['Distraction sounds', plan.options.distraction ? 'On' : 'Off']);
  return rows;
}
