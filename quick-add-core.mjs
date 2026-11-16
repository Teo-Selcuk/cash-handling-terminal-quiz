// Quick addition: add a few small cash values (ones, tens and other bills, plus coins on Hard) against a short timer,
// over a set number of back-to-back additions. A round passes on a mistake limit or a correct-answer target, and a
// separate goal (a score or a streak) shows progress while the round runs. Pure module: no DOM.

export const QUICK_ADD_GAME = 'quick-add';
export const QUICK_ADD_GAME_NAME = 'Quick addition';

// Every value is in cents so coin sums never round.
export const QUICK_ADD_DENOMINATIONS = Object.freeze([
  Object.freeze({ cents: 10000, label: '$100', kind: 'Hundreds' }),
  Object.freeze({ cents: 5000, label: '$50', kind: 'Fifties' }),
  Object.freeze({ cents: 2000, label: '$20', kind: 'Twenties' }),
  Object.freeze({ cents: 1000, label: '$10', kind: 'Tens' }),
  Object.freeze({ cents: 500, label: '$5', kind: 'Fives' }),
  Object.freeze({ cents: 100, label: '$1', kind: 'Ones' }),
  Object.freeze({ cents: 25, label: '25¢', kind: 'Quarters' }),
  Object.freeze({ cents: 10, label: '10¢', kind: 'Dimes' }),
  Object.freeze({ cents: 5, label: '5¢', kind: 'Nickels' }),
]);
const BY_CENTS = new Map(QUICK_ADD_DENOMINATIONS.map((item) => [item.cents, item]));

export const QUICK_ADD_PASS_RULES = Object.freeze({
  'max-mistakes': 'At most this many mistakes',
  'min-correct': 'At least this many correct',
});
export const QUICK_ADD_GOAL_TYPES = Object.freeze({
  score: 'Correct answers in the round',
  streak: 'Correct answers in a row',
});

// `values` are the denominations a question can use; `terms` is the [fewest, most] values added in one question.
export const QUICK_ADD_PRESETS = Object.freeze({
  Easy: Object.freeze({ values: Object.freeze([1000, 500, 100]), terms: Object.freeze([2, 3]), secondsPerQuestion: 8, additions: 10, passRule: 'max-mistakes', passValue: 2, goalType: 'streak', goalTarget: 5 }),
  Medium: Object.freeze({ values: Object.freeze([2000, 1000, 500, 100]), terms: Object.freeze([3, 4]), secondsPerQuestion: 6, additions: 20, passRule: 'max-mistakes', passValue: 3, goalType: 'score', goalTarget: 17 }),
  Hard: Object.freeze({ values: Object.freeze([10000, 5000, 2000, 1000, 500, 100, 25, 10, 5]), terms: Object.freeze([4, 5]), secondsPerQuestion: 5, additions: 25, passRule: 'min-correct', passValue: 22, goalType: 'streak', goalTarget: 10 }),
});
export const QUICK_ADD_LIMITS = Object.freeze({ seconds: Object.freeze([2, 120]), additions: Object.freeze([1, 100]) });

const whole = (value, min, max, fallback) => (value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value))
  ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback);

/** Clean typed or saved settings. Pass and goal numbers never exceed the number of additions. */
export function resolveQuickAddSettings(input = {}) {
  const difficulty = Object.hasOwn(QUICK_ADD_PRESETS, input.difficulty) ? input.difficulty : 'Easy';
  const preset = QUICK_ADD_PRESETS[difficulty];
  const additions = whole(input.additions, ...QUICK_ADD_LIMITS.additions, preset.additions);
  const passRule = Object.hasOwn(QUICK_ADD_PASS_RULES, input.passRule) ? input.passRule : preset.passRule;
  const goalType = Object.hasOwn(QUICK_ADD_GOAL_TYPES, input.goalType) ? input.goalType : preset.goalType;
  const passFallback = Math.min(additions, passRule === preset.passRule ? preset.passValue : passRule === 'max-mistakes' ? 0 : additions);
  return {
    difficulty,
    secondsPerQuestion: whole(input.secondsPerQuestion, ...QUICK_ADD_LIMITS.seconds, preset.secondsPerQuestion),
    additions,
    passRule,
    passValue: whole(input.passValue, passRule === 'max-mistakes' ? 0 : 1, additions, passFallback),
    goalType,
    goalTarget: whole(input.goalTarget, 1, additions, Math.min(additions, preset.goalTarget)),
  };
}

export const formatCents = (cents) => `$${(cents / 100).toFixed(2)}`;
const pick = (random, list) => list[Math.floor(random() * list.length)];

/** One question: a few cash values to add. The answer is their total in cents. */
export function createQuickAddQuestion({ difficulty = 'Easy', random = Math.random } = {}) {
  const preset = QUICK_ADD_PRESETS[difficulty] ?? QUICK_ADD_PRESETS.Easy;
  const [fewest, most] = preset.terms;
  const count = fewest + Math.floor(random() * (most - fewest + 1));
  const values = Array.from({ length: count }, () => pick(random, preset.values));
  // Hard keeps at least one coin, so every Hard question has cents to carry.
  if (difficulty === 'Hard' && !values.some((cents) => cents < 100)) values[Math.floor(random() * count)] = pick(random, [25, 10, 5]);
  const labels = values.map((cents) => BY_CENTS.get(cents).label);
  const largest = Math.max(...values);
  return {
    difficulty,
    values,
    labels,
    expression: labels.join(' + '),
    terms: count,
    answerCents: values.reduce((sum, cents) => sum + cents, 0),
    largestLabel: BY_CENTS.get(largest).label,
    hasCoins: values.some((cents) => cents < 100),
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

/** Fields one history record keeps. `round` is the round summary after this answer. */
export function quickAddRecordFields(question, settings, round = null) {
  const resolved = resolveQuickAddSettings(settings);
  return {
    game: QUICK_ADD_GAME, gameType: QUICK_ADD_GAME_NAME, sessionMode: QUICK_ADD_GAME_NAME,
    quickAddValuesCents: [...question.values], quickAddExpression: question.expression, quickAddAnswerCents: question.answerCents,
    quickAddTermCount: question.terms, quickAddLargest: question.largestLabel, quickAddHasCoins: question.hasCoins,
    quickAddAdditions: resolved.additions, quickAddPassRule: resolved.passRule, quickAddPassValue: resolved.passValue,
    quickAddGoalType: resolved.goalType, quickAddGoalTarget: resolved.goalTarget,
    expectedAnswer: formatCents(question.answerCents),
    ...(round ? {
      quickAddRoundCorrect: round.correct, quickAddRoundMistakes: round.mistakes, quickAddStreak: round.currentStreak,
      ...(round.finished ? { quickAddRoundComplete: true, quickAddRoundPassed: round.passed, quickAddRoundGoalMet: round.goalMet } : {}),
    } : {}),
  };
}

/** Accuracy by how many values were added, plus finished-round pass and goal rates and a plain next step. */
export function summarizeQuickAddHistory(history = []) {
  const rows = history.filter((row) => row?.game === QUICK_ADD_GAME && ['Correct', 'Incorrect', 'Timed Out'].includes(row.outcome));
  const rounds = rows.filter((row) => row.quickAddRoundComplete === true);
  const groups = new Map();
  for (const row of rows) {
    const label = Number.isInteger(row.quickAddTermCount) ? `${row.quickAddTermCount} values` : 'Not recorded';
    const group = groups.get(label) ?? { label, answered: 0, correct: 0 };
    group.answered += 1; group.correct += Number(row.outcome === 'Correct');
    groups.set(label, group);
  }
  const sizes = [...groups.values()].map((group) => ({ ...group, accuracyPercent: Math.round(group.correct / group.answered * 100) }));
  const passed = rounds.filter((row) => row.quickAddRoundPassed === true).length;
  const goals = rounds.filter((row) => row.quickAddRoundGoalMet === true).length;
  const timedOut = rows.filter((row) => row.outcome === 'Timed Out').length;
  const recommendation = !rows.length
    ? 'No Quick addition answers saved yet. Start with Easy: 10 additions, 8 seconds each.'
    : timedOut > rows.length / 4
      ? `${timedOut} of ${rows.length} answers ran out of time. Add a second or two per question until timeouts are rare.`
      : rounds.length && passed / rounds.length >= 0.8
        ? `You passed ${passed} of ${rounds.length} finished rounds. Try one second less per question or the next difficulty.`
        : 'Keep the same settings until you pass most rounds, then shorten the timer.';
  return { answered: rows.length, rounds: rounds.length, roundsPassed: passed, goalsMet: goals, sizes, recommendation };
}
