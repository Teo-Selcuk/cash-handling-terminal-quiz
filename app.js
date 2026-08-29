import {
  DENOMINATIONS,
  MEMORY_MODE_CONFIG,
  buildBreakdown,
  countTotalCents,
  createMemoryChallenge,
  createQuestion,
  formatBreakdown,
  formatMoney,
  parseCashShorthand,
  parseAmountToCents,
  scoreMemoryAnswer,
  scoreAnswer,
  summarizeHistory,
  toCsv,
} from './quiz-core.mjs';

const HISTORY_KEY = 'cash-handling-terminal-quiz-history-v1';
const THEME_KEY = 'cash-handling-terminal-quiz-theme-v1';
const screens = ['setup', 'quiz', 'memory-read', 'memory-answer', 'feedback', 'summary', 'history'];
const refs = Object.fromEntries([
  'setup-form', 'setup-screen', 'quiz-screen', 'feedback-screen', 'summary-screen', 'history-screen',
  'memory-read-screen', 'memory-answer-screen', 'cash-setup-options', 'memory-setup-options',
  'question-count', 'time-limit', 'cash-builder-toggle', 'auto-continue-toggle', 'question-progress', 'timer', 'amount-due',
  'tender-breakdown', 'answer-form', 'answer-amount', 'cash-builder-section', 'cash-builder-heading',
  'cash-builder-purpose', 'cash-builder', 'selected-total', 'builder-status', 'clear-builder', 'quick-cash-entry', 'apply-quick-cash', 'feedback-heading',
  'feedback-kicker', 'feedback-lead', 'feedback-details', 'next-question', 'session-metrics',
  'start-another', 'summary-history', 'open-history', 'back-to-setup', 'history-metrics',
  'history-outcome-diagram', 'history-outcome-legend', 'history-outcomes-summary', 'history-accuracy-chart',
  'history-rows', 'download-csv', 'clear-history', 'message', 'submit-answer', 'theme-toggle',
  'memory-question-count', 'memory-value-min', 'memory-value-max', 'memory-digit-min', 'memory-digit-max', 'memory-decimals',
  'memory-read-time', 'memory-write-time', 'memory-read-progress', 'memory-read-timer', 'memory-number', 'memory-read-hint',
  'memory-answer-form', 'memory-answer-list', 'memory-answer-progress', 'memory-answer-timer', 'memory-answer-heading', 'summary-heading',
  'easy-description', 'medium-description', 'hard-description',
].map((id) => [id, document.getElementById(id)]));

const state = {
  activeScreen: 'setup',
  game: 'cash',
  sessionId: '',
  difficulty: 'Easy',
  questionCount: 10,
  timeLimitSeconds: 30,
  cashBuilderEnabled: false,
  autoContinueOnTimeout: false,
  questionNumber: 0,
  question: null,
  results: [],
  builderCounts: new Map(),
  timerId: null,
  deadline: 0,
  answerSubmitted: false,
  memoryChallenge: null,
  memoryMinimumDigits: MEMORY_MODE_CONFIG.Easy.minimumDigits,
  memoryMaximumDigits: MEMORY_MODE_CONFIG.Easy.maximumDigits,
  memoryMinimumValues: MEMORY_MODE_CONFIG.Easy.minimumValues,
  memoryMaximumValues: MEMORY_MODE_CONFIG.Easy.maximumValues,
  memoryDecimals: MEMORY_MODE_CONFIG.Easy.decimals,
  memoryReadSeconds: MEMORY_MODE_CONFIG.Easy.readSeconds,
  memoryWriteSeconds: MEMORY_MODE_CONFIG.Easy.writeSeconds,
  timerTarget: null,
  timerExpiryAction: null,
};

function setMessage(message) {
  refs.message.textContent = message;
}

function savedTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === 'dark' || theme === 'light' ? theme : null;
  } catch {
    return null;
  }
}

function applyTheme(theme, persist = false) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selectedTheme;
  refs['theme-toggle'].setAttribute('aria-pressed', String(selectedTheme === 'dark'));
  refs['theme-toggle'].textContent = selectedTheme === 'dark' ? 'Light mode' : 'Dark mode';
  refs['theme-toggle'].setAttribute('aria-label', `Switch to ${selectedTheme === 'dark' ? 'light' : 'dark'} mode`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', selectedTheme === 'dark' ? '#0d1719' : '#123f46');
  if (!persist) return;
  try {
    localStorage.setItem(THEME_KEY, selectedTheme);
  } catch {
    setMessage('Dark mode is active for this visit, but this browser could not save the preference.');
  }
}

function initialTheme() {
  return savedTheme() ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function makeSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showScreen(name) {
  for (const screen of screens) refs[`${screen}-screen`].hidden = screen !== name;
  state.activeScreen = name;
  const roundInProgress = ['quiz', 'memory-read', 'memory-answer'].includes(name);
  refs['open-history'].disabled = roundInProgress;
  if (!roundInProgress) stopTimer();
  if (name === 'quiz') {
    window.setTimeout(() => document.querySelector('input[name="answerType"]')?.focus({ preventScroll: true }), 0);
    return;
  }
  if (name === 'memory-answer') {
    window.setTimeout(() => refs['memory-answer-list'].querySelector('input')?.focus({ preventScroll: true }), 0);
    return;
  }
  const heading = document.querySelector(`#${name}-screen h2`);
  if (heading) window.setTimeout(() => heading.focus({ preventScroll: true }), 0);
}

function getHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    setMessage('Your answer was scored, but this browser could not save history locally.');
    return false;
  }
}

function persistRecord(record) {
  const history = getHistory();
  history.push(record);
  saveHistory(history);
}

function formatSeconds(seconds) {
  const rounded = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function selectedAnswerType() {
  return document.querySelector('input[name="answerType"]:checked')?.value ?? '';
}

function selectedGame() {
  return document.querySelector('input[name="game"]:checked')?.value ?? 'cash';
}

function selectedDifficulty() {
  return document.querySelector('input[name="difficulty"]:checked')?.value ?? 'Easy';
}

function applyMemoryModeDefaults() {
  const defaults = MEMORY_MODE_CONFIG[selectedDifficulty()];
  refs['memory-value-min'].value = String(defaults.minimumValues);
  refs['memory-value-max'].value = String(defaults.maximumValues);
  refs['memory-digit-min'].value = String(defaults.minimumDigits);
  refs['memory-digit-max'].value = String(defaults.maximumDigits);
  refs['memory-decimals'].checked = defaults.decimals;
  refs['memory-read-time'].value = String(defaults.readSeconds);
  refs['memory-write-time'].value = String(defaults.writeSeconds);
}

function updateGameSetup() {
  const game = selectedGame();
  const memoryGame = game === 'memory';
  refs['cash-setup-options'].hidden = memoryGame;
  refs['memory-setup-options'].hidden = !memoryGame;
  const descriptions = memoryGame
    ? {
      Easy: '1–2 values, 4–6 digits each',
      Medium: '2–3 values, 6–8 digits each',
      Hard: '3–5 values, 8–10 digits each',
    }
    : {
      Easy: 'Up to $200, quarter increments',
      Medium: 'Up to $1,000, exact cents',
      Hard: 'Up to $5,000, larger differences',
    };
  refs['easy-description'].textContent = descriptions.Easy;
  refs['medium-description'].textContent = descriptions.Medium;
  refs['hard-description'].textContent = descriptions.Hard;
}

function resetBuilder() {
  state.builderCounts = new Map(DENOMINATIONS.map((item) => [item.cents, 0]));
  refs['quick-cash-entry'].value = '';
  refs['cash-builder'].replaceChildren(...DENOMINATIONS.map(createDenominationRow));
  updateCashBuilder();
}

function createQuantityButton(label, accessibleName, onClick) {
  const button = document.createElement('button');
  button.className = 'quantity-button';
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('aria-label', accessibleName);
  button.addEventListener('click', onClick);
  return button;
}

function createDenominationRow(denomination) {
  const row = document.createElement('div');
  row.className = 'denomination-row';
  const name = document.createElement('strong');
  name.textContent = denomination.singular;
  const count = document.createElement('output');
  count.className = 'denomination-count';
  count.dataset.countFor = denomination.cents;
  count.textContent = '0';
  row.append(
    name,
    createQuantityButton('−', `Remove one ${denomination.singular}`, () => changeBuilderCount(denomination.cents, -1)),
    count,
    createQuantityButton('+', `Add one ${denomination.singular}`, () => changeBuilderCount(denomination.cents, 1)),
  );
  return row;
}

function changeBuilderCount(cents, change) {
  state.builderCounts.set(cents, Math.max(0, state.builderCounts.get(cents) + change));
  updateCashBuilder();
}

function applyQuickCashEntry() {
  const parsed = parseCashShorthand(refs['quick-cash-entry'].value);
  if (!parsed.valid) {
    setMessage(`${parsed.error} Separate entries with commas: 2x10, 2x100, 2D, 3Q, 4N, 5P.`);
    refs['quick-cash-entry'].focus();
    return;
  }

  state.builderCounts = new Map(DENOMINATIONS.map((item) => [item.cents, 0]));
  for (const item of parsed.breakdown) state.builderCounts.set(item.cents, item.count);
  refs['quick-cash-entry'].value = '';
  updateCashBuilder();
  setMessage(`Cash builder updated to ${formatMoney(parsed.totalCents)}. You can still adjust any bill or coin button.`);
}

function selectedBreakdown() {
  return DENOMINATIONS
    .filter((item) => state.builderCounts.get(item.cents) > 0)
    .map((item) => ({ ...item, count: state.builderCounts.get(item.cents) }));
}

function updateCashBuilderPurpose(type) {
  const copyByType = {
    Exact: {
      heading: 'No cash to build',
      purpose: 'The customer paid the exact amount, so select no bills or coins.',
    },
    Change: {
      heading: 'Build the change to give the customer',
      purpose: 'Build the change you would give the customer in bills and coins.',
    },
    Short: {
      heading: 'Build the cash the customer still owes',
      purpose: 'Build the additional bills and coins the customer still needs to give.',
    },
  };
  const copy = copyByType[type] ?? {
    heading: 'Choose an answer first',
    purpose: 'Choose Exact, Change, or Short to see what cash to build.',
  };

  refs['cash-builder-heading'].textContent = copy.heading;
  refs['cash-builder-purpose'].textContent = copy.purpose;
}

function updateCashBuilder() {
  const breakdown = selectedBreakdown();
  const total = countTotalCents(breakdown);
  refs['selected-total'].textContent = `Selected: ${formatMoney(total)}`;
  for (const denomination of DENOMINATIONS) {
    const count = refs['cash-builder'].querySelector(`[data-count-for="${denomination.cents}"]`);
    if (count) count.textContent = String(state.builderCounts.get(denomination.cents));
  }

  const type = selectedAnswerType();
  updateCashBuilderPurpose(type);
  const declaredAmount = type === 'Exact' ? 0 : parseAmountToCents(refs['answer-amount'].value);
  if (!type) {
    refs['builder-status'].textContent = 'Choose an answer to compare your cash selection.';
  } else if (declaredAmount === null) {
    refs['builder-status'].textContent = 'Enter the amount you declared, then match it with the selected cash.';
  } else if (total === declaredAmount) {
    refs['builder-status'].textContent = 'Selected cash matches the declared amount.';
  } else {
    const difference = Math.abs(total - declaredAmount);
    refs['builder-status'].textContent = total > declaredAmount
      ? `Selected cash is ${formatMoney(difference)} over the declared amount.`
      : `Selected cash is ${formatMoney(difference)} short of the declared amount.`;
  }
}

function renderQuestion() {
  const question = state.question;
  refs['question-progress'].textContent = `Question ${state.questionNumber} of ${state.questionCount}`;
  refs['amount-due'].textContent = formatMoney(question.dueCents);
  refs['tender-breakdown'].textContent = question.breakdownText;
  refs['answer-form'].reset();
  refs['answer-amount'].disabled = true;
  refs['cash-builder-section'].hidden = !state.cashBuilderEnabled;
  resetBuilder();
}

function startTimer(seconds, target, expiryAction) {
  stopTimer();
  state.deadline = Date.now() + (seconds * 1000);
  state.timerTarget = target;
  state.timerExpiryAction = expiryAction;
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 250);
}

function stopTimer() {
  if (state.timerId !== null) window.clearInterval(state.timerId);
  state.timerId = null;
  state.timerTarget = null;
  state.timerExpiryAction = null;
}

function updateTimer() {
  const remainingMilliseconds = Math.max(0, state.deadline - Date.now());
  const remainingSeconds = remainingMilliseconds / 1000;
  const target = state.timerTarget ?? refs.timer;
  target.textContent = formatSeconds(remainingSeconds);
  target.classList.toggle('urgent', remainingSeconds <= 5);
  if (remainingMilliseconds === 0 && state.timerExpiryAction) {
    const expiryAction = state.timerExpiryAction;
    state.timerExpiryAction = null;
    expiryAction();
  }
}

function expectedAnswerText(question) {
  if (question.expectedType === 'Exact') return 'Exact amount';
  return question.expectedType === 'Change'
    ? `Give ${formatMoney(question.expectedAmountCents)} in change`
    : `Customer is ${formatMoney(question.expectedAmountCents)} short`;
}

function collectAnswer() {
  const type = selectedAnswerType();
  if (!type) {
    setMessage('Choose Exact, Change, or Short before submitting.');
    return null;
  }
  const amountCents = type === 'Exact' ? 0 : parseAmountToCents(refs['answer-amount'].value);
  if (amountCents === null) {
    setMessage('Enter a valid dollar amount with no more than two decimal places.');
    refs['answer-amount'].focus();
    return null;
  }
  return { type, amountCents, breakdown: selectedBreakdown() };
}

function recordAnswer(answer, score, timedOut, elapsedSeconds) {
  const question = state.question;
  const selectedCash = answer?.breakdown ?? [];
  const outcome = timedOut ? 'Timed Out' : score.correct ? 'Correct' : 'Incorrect';
  const declaredAmount = answer ? formatMoney(answer.amountCents) : '';
  return {
    timestamp: new Date().toISOString(),
    sessionId: state.sessionId,
    gameType: 'Cash handling',
    difficulty: state.difficulty,
    questionNumber: state.questionNumber,
    answerMode: state.cashBuilderEnabled ? 'Cash builder' : 'Normal',
    timeLimitSeconds: state.timeLimitSeconds,
    timeUsedSeconds: Number(elapsedSeconds.toFixed(1)),
    amountDue: formatMoney(question.dueCents),
    amountDueCents: question.dueCents,
    cashGivenTotal: formatMoney(question.tenderedCents),
    cashGivenCents: question.tenderedCents,
    cashBreakdown: question.breakdownText,
    expectedAnswer: expectedAnswerText(question),
    recommendedBreakdown: formatBreakdown(buildBreakdown(question.expectedAmountCents)),
    userAnswer: answer?.type ?? '',
    userDeclaredAmount: declaredAmount,
    userDeclaredAmountCents: answer?.amountCents ?? 0,
    userCashTotal: state.cashBuilderEnabled ? formatMoney(score.cashTotalCents) : '',
    userCashTotalCents: state.cashBuilderEnabled ? score.cashTotalCents : 0,
    userCashBreakdown: state.cashBuilderEnabled ? formatBreakdown(selectedCash) : '',
    breakdownMatchesDeclaredAmount: score.breakdownMatches,
    outcome,
  };
}

function populateFeedback(record, score) {
  const question = state.question;
  const correct = score.correct;
  refs['feedback-kicker'].textContent = record.outcome === 'Timed Out' ? 'Time expired' : 'Answer result';
  refs['feedback-heading'].textContent = correct ? 'Correct' : record.outcome === 'Timed Out' ? 'Time expired' : 'Not quite';
  refs['feedback-heading'].dataset.result = correct ? 'correct' : 'incorrect';
  refs['feedback-lead'].textContent = correct
    ? 'You handled this transaction correctly.'
    : `The correct response was: ${expectedAnswerText(question)}.`;
  refs['feedback-details'].replaceChildren();
  const details = [
    ['Customer owes', formatMoney(question.dueCents)],
    ['Customer gave', `${formatMoney(question.tenderedCents)} — ${question.breakdownText}`],
    ['Your answer', record.userAnswer ? `${record.userAnswer}${record.userDeclaredAmount ? ` ${record.userDeclaredAmount}` : ''}` : 'No answer'],
    ['Example breakdown', formatBreakdown(buildBreakdown(question.expectedAmountCents))],
    ['Time used', `${record.timeUsedSeconds.toFixed(1)} seconds`],
  ];
  if (state.cashBuilderEnabled) details.splice(3, 0, ['Selected cash', `${record.userCashTotal} — ${record.userCashBreakdown}`]);
  for (const [term, description] of details) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = description;
    refs['feedback-details'].append(dt, dd);
  }
}

function submitCurrentAnswer(timedOut = false) {
  if (state.answerSubmitted) return;
  const answer = timedOut ? null : collectAnswer();
  if (!timedOut && !answer) return;

  state.answerSubmitted = true;
  stopTimer();
  const elapsedSeconds = Math.min(state.timeLimitSeconds, Math.max(0, (Date.now() - (state.deadline - state.timeLimitSeconds * 1000)) / 1000));
  const score = timedOut
    ? { correct: false, breakdownMatches: false, cashTotalCents: 0 }
    : scoreAnswer(state.question, answer, state.cashBuilderEnabled);
  const record = recordAnswer(answer, score, timedOut, elapsedSeconds);
  state.results.push(record);
  persistRecord(record);
  if (timedOut && state.autoContinueOnTimeout) {
    showNextQuestion();
    return;
  }
  populateFeedback(record, score);
  showScreen('feedback');
}

function showNextQuestion() {
  state.questionNumber += 1;
  if (state.questionNumber > state.questionCount) {
    renderSummary();
    showScreen('summary');
    return;
  }
  state.question = createQuestion(state.difficulty);
  state.answerSubmitted = false;
  renderQuestion();
  showScreen('quiz');
  startTimer(state.timeLimitSeconds, refs.timer, () => submitCurrentAnswer(true));
}

function renderMemoryReadValues(challenge) {
  refs['memory-number'].replaceChildren(...challenge.values.map((value, index) => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    const label = document.createElement('span');
    number.textContent = value;
    label.className = 'memory-value-index';
    label.textContent = `Value ${index + 1}`;
    item.append(label, number);
    return item;
  }));
}

function renderMemoryAnswerInputs(valueCount) {
  refs['memory-answer-list'].replaceChildren(...Array.from({ length: valueCount }, (_, index) => {
    const label = document.createElement('label');
    const helper = document.createElement('small');
    const input = document.createElement('input');
    const inputId = `memory-answer-${index + 1}`;
    label.className = 'memory-answer-field';
    label.htmlFor = inputId;
    label.append(`Value ${index + 1}`);
    helper.textContent = `Enter value ${index + 1} of ${valueCount}`;
    input.id = inputId;
    input.name = `memoryAnswer${index + 1}`;
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.maxLength = state.memoryChallenge.maximumDigits + (state.memoryChallenge.decimals ? 1 : 0);
    input.placeholder = 'Type the value you remember';
    input.required = true;
    input.setAttribute('aria-describedby', `${inputId}-help`);
    helper.id = `${inputId}-help`;
    label.append(helper, input);
    return label;
  }));
}

function memoryAnswerValues() {
  return [...refs['memory-answer-list'].querySelectorAll('input')].map((input) => input.value);
}

function showMemoryAnswer() {
  renderMemoryAnswerInputs(state.memoryChallenge.valueCount);
  refs['memory-answer-progress'].textContent = `Round ${state.questionNumber} of ${state.questionCount}`;
  showScreen('memory-answer');
  startTimer(state.memoryWriteSeconds, refs['memory-answer-timer'], () => submitMemoryAnswer(true));
}

function recordMemoryAnswer(answer, score, timedOut, elapsedSeconds) {
  const challenge = state.memoryChallenge;
  return {
    timestamp: new Date().toISOString(),
    sessionId: state.sessionId,
    gameType: 'Number memory',
    difficulty: state.difficulty,
    questionNumber: state.questionNumber,
    valueCount: challenge.valueCount,
    digitsPerValue: `${challenge.minimumDigits}–${challenge.maximumDigits}`,
    readTimeSeconds: challenge.readSeconds,
    writeTimeSeconds: challenge.writeSeconds,
    timeUsedSeconds: Number(elapsedSeconds.toFixed(1)),
    expectedAnswer: `Values: ${challenge.value}`,
    userAnswer: answer.join(' • '),
    outcome: timedOut ? 'Timed Out' : score.correct ? 'Correct' : 'Incorrect',
  };
}

function populateMemoryFeedback(record, score) {
  const correct = score.correct;
  refs['feedback-kicker'].textContent = record.outcome === 'Timed Out' ? 'Time expired' : 'Memory result';
  refs['feedback-heading'].textContent = correct ? 'Correct' : record.outcome === 'Timed Out' ? 'Time expired' : 'Not quite';
  refs['feedback-heading'].dataset.result = correct ? 'correct' : 'incorrect';
  refs['feedback-lead'].textContent = correct
    ? `You recalled all ${state.memoryChallenge.valueCount} values in the correct order.`
    : `The correct sequence was ${state.memoryChallenge.value}.`;
  const details = [
    ['Values to remember', state.memoryChallenge.value],
    ['Your entries', record.userAnswer || 'No entry'],
    ['Values per round', `${state.memoryChallenge.valueCount}`],
    ['Digits per value', `${state.memoryChallenge.minimumDigits}–${state.memoryChallenge.maximumDigits}`],
    ['Reading time', `${state.memoryChallenge.readSeconds} seconds`],
    ['Writing time used', `${record.timeUsedSeconds.toFixed(1)} seconds`],
  ];
  refs['feedback-details'].replaceChildren();
  for (const [term, description] of details) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = description;
    refs['feedback-details'].append(dt, dd);
  }
}

function submitMemoryAnswer(timedOut = false) {
  if (state.answerSubmitted) return;
  state.answerSubmitted = true;
  const elapsedSeconds = Math.min(
    state.memoryWriteSeconds,
    Math.max(0, (Date.now() - (state.deadline - state.memoryWriteSeconds * 1000)) / 1000),
  );
  stopTimer();
  const answer = timedOut ? [] : memoryAnswerValues();
  const score = scoreMemoryAnswer(state.memoryChallenge, answer);
  const record = recordMemoryAnswer(answer, score, timedOut, elapsedSeconds);
  state.results.push(record);
  persistRecord(record);
  if (timedOut && state.autoContinueOnTimeout) {
    showNextMemoryQuestion();
    return;
  }
  populateMemoryFeedback(record, score);
  showScreen('feedback');
}

function showNextMemoryQuestion() {
  state.questionNumber += 1;
  if (state.questionNumber > state.questionCount) {
    renderSummary();
    showScreen('summary');
    return;
  }
  state.memoryChallenge = createMemoryChallenge(state.difficulty, {
    minimumDigits: state.memoryMinimumDigits,
    maximumDigits: state.memoryMaximumDigits,
    minimumValues: state.memoryMinimumValues,
    maximumValues: state.memoryMaximumValues,
    decimals: state.memoryDecimals,
    readSeconds: state.memoryReadSeconds,
    writeSeconds: state.memoryWriteSeconds,
  });
  state.answerSubmitted = false;
  refs['memory-read-progress'].textContent = `Round ${state.questionNumber} of ${state.questionCount}`;
  renderMemoryReadValues(state.memoryChallenge);
  refs['memory-read-hint'].textContent = `${state.memoryChallenge.valueCount} value${state.memoryChallenge.valueCount === 1 ? '' : 's'} in order · ${state.memoryChallenge.minimumDigits}–${state.memoryChallenge.maximumDigits} digits each${state.memoryChallenge.decimals ? ' · decimal points included' : ''}`;
  showScreen('memory-read');
  startTimer(state.memoryReadSeconds, refs['memory-read-timer'], showMemoryAnswer);
}

function makeMetrics(records) {
  const summary = summarizeHistory(records);
  const averageTime = summary.answered ? records.reduce((sum, record) => sum + Number(record.timeUsedSeconds || 0), 0) / summary.answered : 0;
  return [
    [`${summary.answered}`, 'Questions'],
    [`${summary.accuracyPercent}%`, 'Accuracy'],
    [`${averageTime.toFixed(1)}s`, 'Average time'],
  ];
}

function renderMetrics(target, metrics) {
  target.replaceChildren(...metrics.map(([value, label]) => {
    const metric = document.createElement('div');
    metric.className = 'metric';
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = value;
    span.textContent = label;
    metric.append(strong, span);
    return metric;
  }));
}

function renderSummary() {
  refs['summary-heading'].textContent = state.game === 'memory' ? 'Your memory results' : 'Your cash results';
  renderMetrics(refs['session-metrics'], makeMetrics(state.results));
}

function renderHistoryVisuals(summary) {
  refs['history-outcomes-summary'].textContent = summary.answered
    ? `${summary.correct} of ${summary.answered} correct`
    : 'No answers yet';
  refs['history-outcome-diagram'].replaceChildren();

  if (summary.answered === 0) {
    const empty = document.createElement('p');
    empty.className = 'chart-empty';
    empty.textContent = 'Complete a question to populate this diagram.';
    refs['history-outcome-diagram'].append(empty);
  } else {
    for (const outcome of summary.outcomes) {
      const segment = document.createElement('span');
      segment.className = `outcome-segment outcome-${outcome.key}`;
      segment.style.setProperty('--segment-size', `${outcome.percent}%`);
      segment.setAttribute('aria-hidden', 'true');
      refs['history-outcome-diagram'].append(segment);
    }
  }

  refs['history-outcome-legend'].replaceChildren(...summary.outcomes.map((outcome) => {
    const item = document.createElement('li');
    const marker = document.createElement('span');
    marker.className = `legend-marker outcome-${outcome.key}`;
    marker.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = `${outcome.label}: ${outcome.count} (${outcome.percent}%)`;
    item.append(marker, label);
    return item;
  }));

  refs['history-accuracy-chart'].replaceChildren(...summary.byDifficulty.map((level) => {
    const row = document.createElement('div');
    row.className = 'bar-chart-row';
    const label = document.createElement('span');
    label.className = 'bar-chart-label';
    label.textContent = level.level;
    const track = document.createElement('div');
    track.className = 'bar-chart-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = 'bar-chart-fill';
    fill.style.setProperty('--bar-size', `${level.accuracyPercent}%`);
    track.append(fill);
    const value = document.createElement('span');
    value.className = 'bar-chart-value';
    value.textContent = `${level.accuracyPercent}% (${level.correct}/${level.answered})`;
    row.append(label, track, value);
    return row;
  }));
}

function renderHistory() {
  const history = getHistory();
  const summary = summarizeHistory(history);
  const levelMetrics = summary.byDifficulty.map((level) => [`${level.accuracyPercent}%`, `${level.level} accuracy`]);
  renderMetrics(refs['history-metrics'], [...makeMetrics(history), ...levelMetrics]);
  renderHistoryVisuals(summary);
  refs['history-rows'].replaceChildren();
  if (history.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'empty-row';
    cell.colSpan = 6;
    cell.textContent = 'No saved answers yet. Complete a game to see history here.';
    row.append(cell);
    refs['history-rows'].append(row);
    return;
  }
  for (const record of [...history].reverse()) {
    const row = document.createElement('tr');
    const cells = [
      new Date(record.timestamp).toLocaleString(),
      record.gameType ?? 'Cash handling',
      record.difficulty,
      record.outcome,
      `${Number(record.timeUsedSeconds || 0).toFixed(1)}s`,
      record.expectedAnswer,
    ];
    row.append(...cells.map((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      return cell;
    }));
    refs['history-rows'].append(row);
  }
}

function openHistory() {
  if (['quiz', 'memory-read', 'memory-answer'].includes(state.activeScreen)) {
    setMessage('Finish the current round before opening history.');
    return;
  }
  renderHistory();
  showScreen('history');
}

function downloadHistory() {
  const history = getHistory();
  if (history.length === 0) {
    setMessage('There is no history to download yet.');
    return;
  }
  const csv = toCsv(history);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Cash-and-Memory-Game-History.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setMessage('History CSV download started.');
}

refs['setup-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  const game = selectedGame();
  const difficulty = selectedDifficulty();
  state.sessionId = makeSessionId();
  state.game = game;
  state.difficulty = difficulty;
  state.questionNumber = 0;
  state.results = [];
  state.autoContinueOnTimeout = refs['auto-continue-toggle'].checked;

  if (game === 'memory') {
    const questionCount = Number(refs['memory-question-count'].value);
    const minimumValues = Number(refs['memory-value-min'].value);
    const maximumValues = Number(refs['memory-value-max'].value);
    const minimumDigits = Number(refs['memory-digit-min'].value);
    const maximumDigits = Number(refs['memory-digit-max'].value);
    const readSeconds = Number(refs['memory-read-time'].value);
    const writeSeconds = Number(refs['memory-write-time'].value);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) {
      setMessage('Choose between 1 and 100 memory rounds.');
      refs['memory-question-count'].focus();
      return;
    }
    if (!Number.isInteger(minimumValues) || minimumValues < 1 || minimumValues > 100) {
      setMessage('Choose a minimum of 1 to 100 values per round.');
      refs['memory-value-min'].focus();
      return;
    }
    if (!Number.isInteger(maximumValues) || maximumValues < 1 || maximumValues > 100) {
      setMessage('Choose a maximum of 1 to 100 values per round.');
      refs['memory-value-max'].focus();
      return;
    }
    if (minimumValues > maximumValues) {
      setMessage('The minimum values per round cannot be greater than the maximum.');
      refs['memory-value-min'].focus();
      return;
    }
    if (!Number.isInteger(minimumDigits) || minimumDigits < 1 || minimumDigits > 100) {
      setMessage('Choose a minimum of 1 to 100 digits per value.');
      refs['memory-digit-min'].focus();
      return;
    }
    if (!Number.isInteger(maximumDigits) || maximumDigits < 1 || maximumDigits > 100) {
      setMessage('Choose a maximum of 1 to 100 digits per value.');
      refs['memory-digit-max'].focus();
      return;
    }
    if (minimumDigits > maximumDigits) {
      setMessage('The minimum digits per value cannot be greater than the maximum.');
      refs['memory-digit-min'].focus();
      return;
    }
    if (!Number.isInteger(readSeconds) || readSeconds < 1 || readSeconds > 60) {
      setMessage('Choose from 1 to 60 seconds to read the number.');
      refs['memory-read-time'].focus();
      return;
    }
    if (!Number.isInteger(writeSeconds) || writeSeconds < 1 || writeSeconds > 300) {
      setMessage('Choose from 1 to 300 seconds to write the number.');
      refs['memory-write-time'].focus();
      return;
    }
    state.questionCount = questionCount;
    state.memoryMinimumValues = minimumValues;
    state.memoryMaximumValues = maximumValues;
    state.memoryMinimumDigits = minimumDigits;
    state.memoryMaximumDigits = maximumDigits;
    state.memoryDecimals = refs['memory-decimals'].checked;
    state.memoryReadSeconds = readSeconds;
    state.memoryWriteSeconds = writeSeconds;
    showNextMemoryQuestion();
    return;
  }

  const questionCount = Number(refs['question-count'].value);
  const timeLimitSeconds = Number(refs['time-limit'].value);
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) {
    setMessage('Choose between 1 and 100 questions.');
    refs['question-count'].focus();
    return;
  }
  if (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 3 || timeLimitSeconds > 300) {
    setMessage('Choose between 3 and 300 seconds per question.');
    refs['time-limit'].focus();
    return;
  }
  state.questionCount = questionCount;
  state.timeLimitSeconds = timeLimitSeconds;
  state.cashBuilderEnabled = refs['cash-builder-toggle'].checked;
  showNextQuestion();
});

applyTheme(initialTheme());
updateGameSetup();

refs['answer-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  submitCurrentAnswer();
});

document.querySelectorAll('input[name="answerType"]').forEach((input) => input.addEventListener('change', () => {
  const exact = selectedAnswerType() === 'Exact';
  refs['answer-amount'].disabled = exact;
  if (exact) refs['answer-amount'].value = '';
  updateCashBuilder();
}));
refs['answer-amount'].addEventListener('input', updateCashBuilder);
refs['clear-builder'].addEventListener('click', resetBuilder);
refs['apply-quick-cash'].addEventListener('click', applyQuickCashEntry);
refs['next-question'].addEventListener('click', () => {
  if (state.game === 'memory') showNextMemoryQuestion();
  else showNextQuestion();
});
refs['memory-answer-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  submitMemoryAnswer();
});
document.querySelectorAll('input[name="game"]').forEach((input) => input.addEventListener('change', () => {
  updateGameSetup();
  if (selectedGame() === 'memory') applyMemoryModeDefaults();
}));
document.querySelectorAll('input[name="difficulty"]').forEach((input) => input.addEventListener('change', () => {
  if (selectedGame() === 'memory') applyMemoryModeDefaults();
}));
refs['start-another'].addEventListener('click', () => showScreen('setup'));
refs['open-history'].addEventListener('click', openHistory);
refs['summary-history'].addEventListener('click', openHistory);
refs['back-to-setup'].addEventListener('click', () => showScreen('setup'));
refs['theme-toggle'].addEventListener('click', () => {
  const isDark = document.documentElement.dataset.theme === 'dark';
  applyTheme(isDark ? 'light' : 'dark', true);
});
refs['download-csv'].addEventListener('click', downloadHistory);
refs['clear-history'].addEventListener('click', () => {
  if (window.confirm('Clear all saved quiz history from this browser? This cannot be undone.')) {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    setMessage('Saved quiz history was cleared from this browser.');
  }
});
