import {
  DENOMINATIONS,
  buildBreakdown,
  countTotalCents,
  createQuestion,
  formatBreakdown,
  formatMoney,
  parseAmountToCents,
  scoreAnswer,
  summarizeHistory,
  toCsv,
} from './quiz-core.mjs';

const HISTORY_KEY = 'cash-handling-terminal-quiz-history-v1';
const THEME_KEY = 'cash-handling-terminal-quiz-theme-v1';
const screens = ['setup', 'quiz', 'feedback', 'summary', 'history'];
const refs = Object.fromEntries([
  'setup-form', 'setup-screen', 'quiz-screen', 'feedback-screen', 'summary-screen', 'history-screen',
  'question-count', 'time-limit', 'cash-builder-toggle', 'question-progress', 'timer', 'amount-due',
  'amount-tendered', 'tender-breakdown', 'answer-form', 'answer-amount', 'cash-builder-section',
  'cash-builder', 'selected-total', 'builder-status', 'clear-builder', 'feedback-heading',
  'feedback-kicker', 'feedback-lead', 'feedback-details', 'next-question', 'session-metrics',
  'start-another', 'summary-history', 'open-history', 'back-to-setup', 'history-metrics',
  'history-outcome-diagram', 'history-outcome-legend', 'history-outcomes-summary', 'history-accuracy-chart',
  'history-rows', 'download-csv', 'clear-history', 'message', 'submit-answer', 'theme-toggle',
].map((id) => [id, document.getElementById(id)]));

const state = {
  activeScreen: 'setup',
  sessionId: '',
  difficulty: 'Easy',
  questionCount: 10,
  timeLimitSeconds: 30,
  cashBuilderEnabled: false,
  questionNumber: 0,
  question: null,
  results: [],
  builderCounts: new Map(),
  timerId: null,
  deadline: 0,
  answerSubmitted: false,
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
  refs['open-history'].disabled = name === 'quiz';
  if (name !== 'quiz') stopTimer();
  if (name === 'quiz') {
    window.setTimeout(() => document.querySelector('input[name="answerType"]')?.focus({ preventScroll: true }), 0);
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

function resetBuilder() {
  state.builderCounts = new Map(DENOMINATIONS.map((item) => [item.cents, 0]));
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

function selectedBreakdown() {
  return DENOMINATIONS
    .filter((item) => state.builderCounts.get(item.cents) > 0)
    .map((item) => ({ ...item, count: state.builderCounts.get(item.cents) }));
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
  refs['amount-tendered'].textContent = formatMoney(question.tenderedCents);
  refs['tender-breakdown'].textContent = question.breakdownText;
  refs['answer-form'].reset();
  refs['answer-amount'].disabled = true;
  refs['cash-builder-section'].hidden = !state.cashBuilderEnabled;
  resetBuilder();
}

function startTimer() {
  stopTimer();
  state.deadline = Date.now() + (state.timeLimitSeconds * 1000);
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 250);
}

function stopTimer() {
  if (state.timerId !== null) window.clearInterval(state.timerId);
  state.timerId = null;
}

function updateTimer() {
  const remainingMilliseconds = Math.max(0, state.deadline - Date.now());
  const remainingSeconds = remainingMilliseconds / 1000;
  refs.timer.textContent = formatSeconds(remainingSeconds);
  refs.timer.classList.toggle('urgent', remainingSeconds <= 5);
  if (remainingMilliseconds === 0 && !state.answerSubmitted) submitCurrentAnswer(true);
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
  startTimer();
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
    cell.colSpan = 5;
    cell.textContent = 'No saved answers yet. Complete a quiz to see history here.';
    row.append(cell);
    refs['history-rows'].append(row);
    return;
  }
  for (const record of [...history].reverse()) {
    const row = document.createElement('tr');
    const cells = [
      new Date(record.timestamp).toLocaleString(),
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
  if (state.activeScreen === 'quiz') {
    setMessage('Finish the current question before opening history.');
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
  link.download = 'Cash-Handling-Quiz-History.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setMessage('History CSV download started.');
}

refs['setup-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
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
  state.sessionId = makeSessionId();
  state.difficulty = difficulty;
  state.questionCount = questionCount;
  state.timeLimitSeconds = timeLimitSeconds;
  state.cashBuilderEnabled = refs['cash-builder-toggle'].checked;
  state.questionNumber = 0;
  state.results = [];
  showNextQuestion();
});

applyTheme(initialTheme());

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
refs['next-question'].addEventListener('click', showNextQuestion);
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
