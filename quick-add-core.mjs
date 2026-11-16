// Quick addition: a running total. Each question adds one small cash amount to the previous total, so you add to
// the value you just reached, again and again. X seconds per question, Y additions back to back per round. A round
// passes on a mistake limit or a correct-answer target, and a separate goal (a score or a streak) shows progress
// while the round runs. Pure module: no DOM.

export const QUICK_ADD_GAME = 'quick-add';
export const QUICK_ADD_GAME_NAME = 'Quick addition';

export const QUICK_ADD_PASS_RULES = Object.freeze({
  'max-mistakes': 'At most this many mistakes',
  'min-correct': 'At least this many correct',
});
export const QUICK_ADD_GOAL_TYPES = Object.freeze({
  score: 'Correct answers in the round',
  streak: 'Correct answers in a row',
});

// `minAdd` and `maxAdd` are whole dollars: the smallest and largest amount one step can add.
// `includeCents` lets a step add cents too, in 5¢ steps.
export const QUICK_ADD_PRESETS = Object.freeze({
  Easy: Object.freeze({ minAdd: 1, maxAdd: 9, includeCents: false, secondsPerQuestion: 8, additions: 10, passRule: 'max-mistakes', passValue: 2, goalType: 'streak', goalTarget: 5 }),
  Medium: Object.freeze({ minAdd: 5, maxAdd: 49, includeCents: false, secondsPerQuestion: 6, additions: 20, passRule: 'max-mistakes', passValue: 3, goalType: 'score', goalTarget: 17 }),
  Hard: Object.freeze({ minAdd: 10, maxAdd: 99, includeCents: true, secondsPerQuestion: 5, additions: 25, passRule: 'min-correct', passValue: 22, goalType: 'streak', goalTarget: 10 }),
});
export const QUICK_ADD_LIMITS = Object.freeze({ seconds: Object.freeze([2, 120]), additions: Object.freeze([1, 100]), amount: Object.freeze([1, 1000]) });

const whole = (value, min, max, fallback) => (value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value))
  ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback);

/** Clean typed or saved settings. Pass and goal numbers never exceed the number of additions; the largest add is never below the smallest. */
export function resolveQuickAddSettings(input = {}) {
  const difficulty = Object.hasOwn(QUICK_ADD_PRESETS, input.difficulty) ? input.difficulty : 'Easy';
  const preset = QUICK_ADD_PRESETS[difficulty];
  const additions = whole(input.additions, ...QUICK_ADD_LIMITS.additions, preset.additions);
  const passRule = Object.hasOwn(QUICK_ADD_PASS_RULES, input.passRule) ? input.passRule : preset.passRule;
  const goalType = Object.hasOwn(QUICK_ADD_GOAL_TYPES, input.goalType) ? input.goalType : preset.goalType;
  const passFallback = Math.min(additions, passRule === preset.passRule ? preset.passValue : passRule === 'max-mistakes' ? 0 : additions);
  const minAdd = whole(input.minAdd, ...QUICK_ADD_LIMITS.amount, preset.minAdd);
  const maxAdd = whole(input.maxAdd, minAdd, QUICK_ADD_LIMITS.amount[1], Math.max(minAdd, preset.maxAdd));
  return {
    difficulty,
    minAdd,
    maxAdd,
    includeCents: typeof input.includeCents === 'boolean' ? input.includeCents : preset.includeCents,
    secondsPerQuestion: whole(input.secondsPerQuestion, ...QUICK_ADD_LIMITS.seconds, preset.secondsPerQuestion),
    additions,
    passRule,
    passValue: whole(input.passValue, passRule === 'max-mistakes' ? 0 : 1, additions, passFallback),
    goalType,
    goalTarget: whole(input.goalTarget, 1, additions, Math.min(additions, preset.goalTarget)),
  };
}

export const formatCents = (cents) => `$${(cents / 100).toFixed(2)}`;
// Whole dollars print without ".00" in the question, so "$7 + $12" stays short; cents always show two digits.
const money = (cents) => (cents % 100 === 0 ? `$${cents / 100}` : formatCents(cents));

/** One question: add one amount to the previous total. The answer is the new total in cents. */
export function createQuickAddQuestion({ settings = {}, previousCents = 0, random = Math.random } = {}) {
  const resolved = resolveQuickAddSettings(settings);
  const step = resolved.includeCents ? 5 : 100;
  const lowest = resolved.minAdd * 100;
  const slots = Math.floor((resolved.maxAdd * 100 - lowest) / step);
  const addendCents = lowest + Math.floor(random() * (slots + 1)) * step;
  return {
    difficulty: resolved.difficulty,
    previousCents,
    addendCents,
    answerCents: previousCents + addendCents,
    expression: `${money(previousCents)} + ${money(addendCents)}`,
    hasCents: addendCents % 100 !== 0 || previousCents % 100 !== 0,
  };
}

/** Score one answer. `typedCents` is null for no answer; a timeout always counts as a mistake. */
export function scoreQuickAddAnswer(question, typedCents, timedOut = false) {
  if (timedOut) return { outcome: 'Timed Out', correct: false };
  if (!Number.isInteger(typedCents)) return { outcome: 'Incorrect', correct: false };
  const correct = typedCents === question.answerCents;
  return { outcome: correct ? 'Correct' : 'Incorrect', correct };
}

/**
 * Round progress from the outcomes so far (in order). Works mid-round and at the end:
 * `passStatus` is 'passed' or 'failed' once the rule is settled, else 'on-track'.
 */
export function summarizeQuickAddRound(outcomes, settings) {
  const resolved = resolveQuickAddSettings(settings);
  const done = outcomes.slice(0, resolved.additions);
  let streak = 0, bestStreak = 0, correct = 0, timedOut = 0;
  for (const outcome of done) {
    if (outcome === 'Correct') { correct += 1; streak += 1; bestStreak = Math.max(bestStreak, streak); } else streak = 0;
    if (outcome === 'Timed Out') timedOut += 1;
  }
  const answered = done.length;
  const mistakes = answered - correct;
  const remaining = resolved.additions - answered;
  const finished = remaining === 0;
  let passStatus;
  if (resolved.passRule === 'max-mistakes') passStatus = mistakes > resolved.passValue ? 'failed' : finished ? 'passed' : 'on-track';
  else passStatus = correct >= resolved.passValue ? 'passed' : correct + remaining < resolved.passValue ? 'failed' : 'on-track';
  const goalValue = resolved.goalType === 'score' ? correct : bestStreak;
  const goalMet = goalValue >= resolved.goalTarget;
  return {
    additions: resolved.additions, answered, remaining, finished, correct, mistakes, timedOut,
    currentStreak: streak, bestStreak,
    passRule: resolved.passRule, passValue: resolved.passValue, passStatus, passed: finished ? passStatus === 'passed' : null,
    goalType: resolved.goalType, goalTarget: resolved.goalTarget, goalValue: Math.min(goalValue, resolved.goalTarget), goalMet,
    goalPercent: Math.round(Math.min(goalValue, resolved.goalTarget) / resolved.goalTarget * 100),
  };
}

/** The pass rule in words, for setup notes and the results screen. */
export function passRuleText({ passRule, passValue, additions }) {
  return passRule === 'max-mistakes'
    ? `Pass with ${passValue} or fewer mistake${passValue === 1 ? '' : 's'} in ${additions} additions`
    : `Pass with ${passValue} or more correct in ${additions} additions`;
}

export function goalText({ goalType, goalTarget }) {
  return goalType === 'score' ? `Goal: ${goalTarget} correct in the round` : `Goal: ${goalTarget} correct in a row`;
}

/** Size groups for History charts: how big the added amount was, and how big the running total had grown. */
export function quickAddAmountBand(cents) {
  const dollars = Math.floor(cents / 100);
  return dollars < 10 ? '$1–$9' : dollars < 25 ? '$10–$24' : dollars < 50 ? '$25–$49' : dollars < 100 ? '$50–$99' : '$100+';
}
export function quickAddTotalBand(cents) {
  const dollars = Math.floor(cents / 100);
  return dollars < 50 ? '$0–$49' : dollars < 100 ? '$50–$99' : dollars < 250 ? '$100–$249' : dollars < 500 ? '$250–$499' : '$500+';
}

/** Fields one history record keeps. `round` is the round summary after this answer. */
export function quickAddRecordFields(question, settings, round = null) {
  const resolved = resolveQuickAddSettings(settings);
  return {
    game: QUICK_ADD_GAME, gameType: QUICK_ADD_GAME_NAME, sessionMode: QUICK_ADD_GAME_NAME,
    quickAddPreviousCents: question.previousCents, quickAddAddendCents: question.addendCents, quickAddAnswerCents: question.answerCents,
    quickAddExpression: question.expression, quickAddHasCents: question.hasCents,
    quickAddMinAdd: resolved.minAdd, quickAddMaxAdd: resolved.maxAdd,
    quickAddAdditions: resolved.additions, quickAddPassRule: resolved.passRule, quickAddPassValue: resolved.passValue,
    quickAddGoalType: resolved.goalType, quickAddGoalTarget: resolved.goalTarget,
    expectedAnswer: formatCents(question.answerCents),
    ...(round ? {
      quickAddRoundCorrect: round.correct, quickAddRoundMistakes: round.mistakes, quickAddStreak: round.currentStreak,
      ...(round.finished ? { quickAddRoundComplete: true, quickAddRoundPassed: round.passed, quickAddRoundGoalMet: round.goalMet } : {}),
    } : {}),
  };
}

/** Accuracy by size of the added amount, finished-round pass and goal rates, and a plain next step. */
export function summarizeQuickAddHistory(history = []) {
  const rows = history.filter((row) => row?.game === QUICK_ADD_GAME && ['Correct', 'Incorrect', 'Timed Out'].includes(row.outcome));
  const rounds = rows.filter((row) => row.quickAddRoundComplete === true);
  const groups = new Map();
  for (const row of rows) {
    const label = Number.isInteger(row.quickAddAddendCents) ? quickAddAmountBand(row.quickAddAddendCents) : 'Not recorded';
    const group = groups.get(label) ?? { label, answered: 0, correct: 0 };
    group.answered += 1; group.correct += Number(row.outcome === 'Correct');
    groups.set(label, group);
  }
  const sizes = [...groups.values()].map((group) => ({ ...group, accuracyPercent: Math.round(group.correct / group.answered * 100) }));
  const passed = rounds.filter((row) => row.quickAddRoundPassed === true).length;
  const goals = rounds.filter((row) => row.quickAddRoundGoalMet === true).length;
  const timedOut = rows.filter((row) => row.outcome === 'Timed Out').length;
  const recommendation = !rows.length
    ? 'No Quick addition answers saved yet. Start with Easy: 10 additions, 8 seconds each, adding $1 to $9 to the running total.'
    : timedOut > rows.length / 4
      ? `${timedOut} of ${rows.length} answers ran out of time. Add a second or two per question until timeouts are rare.`
      : rounds.length && passed / rounds.length >= 0.8
        ? `You passed ${passed} of ${rounds.length} finished rounds. Try one second less per question or a higher largest amount.`
        : 'Keep the same settings until you pass most rounds, then shorten the timer or raise the largest amount.';
  return { answered: rows.length, rounds: rounds.length, roundsPassed: passed, goalsMet: goals, sizes, recommendation };
}
