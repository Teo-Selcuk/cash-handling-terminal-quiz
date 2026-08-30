import {
  DENOMINATIONS,
  DIFFICULTY_CONFIG,
  MEMORY_MODE_CONFIG,
  TASK_MODE_CONFIG,
  buildBreakdown,
  countTotalCents,
  createMemoryChallenge,
  createTaskChallenge,
  createQuestion,
  formatBreakdown,
  formatMoney,
  parseCashShorthand,
  parseAmountToCents,
  resolveCashDifficultyPreset,
  resolveMemoryDifficultyPreset,
  resolveTaskDifficultyPreset,
  scoreMemoryAnswer,
  scoreTaskAttempt,
  scoreAnswer,
  summarizeHistory,
  toCsv,
} from './quiz-core.mjs';

const HISTORY_KEY = 'cash-handling-terminal-quiz-history-v1';
const THEME_KEY = 'cash-handling-terminal-quiz-theme-v1';
const PRESET_KEY = 'cash-handling-terminal-quiz-presets-v1';
const screens = ['setup', 'quiz', 'memory-read', 'memory-answer', 'task-briefing', 'task-workspace', 'feedback', 'summary', 'history'];
const refs = Object.fromEntries([
  'setup-form', 'setup-screen', 'quiz-screen', 'feedback-screen', 'summary-screen', 'history-screen',
  'memory-read-screen', 'memory-answer-screen', 'task-briefing-screen', 'task-workspace-screen', 'cash-setup-options', 'memory-setup-options', 'task-setup-options',
  'question-count', 'time-limit', 'cash-builder-toggle', 'auto-continue-toggle', 'question-progress', 'timer', 'amount-due',
  'tender-breakdown', 'answer-form', 'answer-amount', 'cash-builder-section', 'cash-builder-heading',
  'cash-builder-purpose', 'cash-builder', 'selected-total', 'builder-status', 'clear-builder', 'quick-cash-entry', 'apply-quick-cash', 'feedback-heading',
  'feedback-kicker', 'feedback-lead', 'feedback-details', 'next-question', 'session-metrics',
  'start-another', 'summary-history', 'open-history', 'back-to-setup', 'history-metrics',
  'history-outcome-diagram', 'history-outcome-legend', 'history-outcomes-summary', 'history-accuracy-chart',
  'history-rows', 'download-csv', 'clear-history', 'message', 'submit-answer', 'theme-toggle',
  'memory-question-count', 'memory-read-progress', 'memory-read-timer', 'memory-number', 'memory-read-hint', 'memory-answer-now',
  'memory-answer-form', 'memory-answer-list', 'memory-answer-progress', 'memory-answer-timer', 'memory-answer-heading', 'summary-heading',
  'task-question-count', 'task-briefing-progress', 'task-briefing-timer', 'task-briefing-heading', 'task-briefing-title', 'task-instruction-list', 'task-start-demo',
  'task-workspace-progress', 'task-timer', 'task-workspace-heading', 'task-phase-status', 'task-demo-controls', 'task-pause-demo', 'task-replay-demo', 'task-skip-demo',
  'task-tablist', 'task-tabpanel', 'task-workspace-content', 'task-workspace-dialog', 'task-save-workspace', 'task-demo-guide', 'task-demo-cursor', 'task-recall-note', 'task-row-template',
  'easy-description', 'medium-description', 'hard-description',
  'preset-editor', 'preset-level', 'preset-cash-fields', 'preset-memory-fields', 'preset-task-fields',
  'preset-cash-min-due', 'preset-cash-max-due', 'preset-cash-step', 'preset-cash-max-difference', 'preset-cash-split-count',
  'preset-memory-value-min', 'preset-memory-value-max', 'preset-memory-digit-min', 'preset-memory-digit-max',
  'preset-memory-read-time', 'preset-memory-write-time', 'preset-memory-decimals',
  'preset-task-step-min', 'preset-task-step-max', 'preset-task-rows', 'preset-task-tabs', 'preset-task-briefing-time', 'preset-task-recall-time', 'preset-task-demo-speed',
  'save-preset', 'reset-selected-preset', 'reset-all-presets',
].map((id) => [id, document.getElementById(id)]));

const savedPresetState = loadPresetState();

const state = {
  activeScreen: 'setup',
  game: 'cash',
  sessionId: '',
  difficulty: 'Easy',
  questionCount: 10,
  timeLimitSeconds: 30,
  cashBuilderEnabled: false,
  autoContinueOnTimeout: false,
  cashPresets: savedPresetState.cash,
  memoryPresets: savedPresetState.memory,
  taskPresets: savedPresetState.task,
  questionNumber: 0,
  question: null,
  results: [],
  builderCounts: new Map(),
  timerId: null,
  deadline: 0,
  answerSubmitted: false,
  memoryChallenge: null,
  taskChallenge: null,
  taskActionLog: [],
  taskPhase: '',
  taskDemoToken: 0,
  taskDemoAnimation: null,
  taskDemoPaused: false,
  taskDemoResume: null,
  taskRecallStartedAt: 0,
  taskActiveTabId: '',
  taskFieldValues: {},
  taskVerificationTabOpen: false,
  taskWorkspaceDisabled: false,
  timerTarget: null,
  timerExpiryAction: null,
};

function setMessage(message) {
  refs.message.textContent = message;
}

function builtInCashPresets() {
  return Object.fromEntries(Object.keys(DIFFICULTY_CONFIG).map((level) => [level, resolveCashDifficultyPreset(level)]));
}

function builtInMemoryPresets() {
  return Object.fromEntries(Object.keys(MEMORY_MODE_CONFIG).map((level) => [level, resolveMemoryDifficultyPreset(level)]));
}

function builtInTaskPresets() {
  return Object.fromEntries(Object.keys(TASK_MODE_CONFIG).map((level) => [level, resolveTaskDifficultyPreset(level)]));
}

function loadPresetState() {
  const presets = {
    cash: builtInCashPresets(),
    memory: builtInMemoryPresets(),
    task: builtInTaskPresets(),
  };
  try {
    const saved = JSON.parse(localStorage.getItem(PRESET_KEY) ?? 'null');
    for (const level of Object.keys(DIFFICULTY_CONFIG)) {
      if (saved?.cash?.[level]) presets.cash[level] = resolveCashDifficultyPreset(level, saved.cash[level]);
      if (saved?.memory?.[level]) presets.memory[level] = resolveMemoryDifficultyPreset(level, saved.memory[level]);
      if (saved?.task?.[level]) presets.task[level] = resolveTaskDifficultyPreset(level, saved.task[level]);
    }
  } catch {
    // Keep the shipped presets if a browser has an old or invalid saved value.
  }
  return presets;
}

function persistPresetState() {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify({ cash: state.cashPresets, memory: state.memoryPresets, task: state.taskPresets }));
    return true;
  } catch {
    setMessage('The preset is active for this visit, but this browser could not save it locally.');
    return false;
  }
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

function isCompactViewport() {
  return window.matchMedia?.('(max-width: 63.9375rem)').matches ?? false;
}

function showScreen(name) {
  for (const screen of screens) refs[`${screen}-screen`].hidden = screen !== name;
  state.activeScreen = name;
  const activeScreen = refs[`${name}-screen`];
  if (isCompactViewport()) activeScreen.scrollIntoView({ block: 'start', inline: 'nearest' });
  const roundInProgress = ['quiz', 'memory-read', 'memory-answer', 'task-briefing', 'task-workspace'].includes(name);
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

function hasPresetValues(preset, defaults, fields) {
  return fields.every((field) => preset[field] === defaults[field]);
}

function cashPresetDescription(level) {
  const preset = state.cashPresets[level];
  const defaults = DIFFICULTY_CONFIG[level];
  const defaultDescriptions = {
    Easy: 'Up to $200, quarter increments',
    Medium: 'Up to $1,000, exact cents',
    Hard: 'Up to $5,000, larger differences',
  };
  if (hasPresetValues(preset, defaults, ['minDue', 'maxDue', 'step', 'maxDifference', 'splitCount'])) return defaultDescriptions[level];
  const increment = preset.step === 1 ? 'exact cents' : `${formatMoney(preset.step)} increments`;
  return `Up to ${formatMoney(preset.maxDue)}, ${increment}, up to ${formatMoney(preset.maxDifference)} difference`;
}

function memoryPresetDescription(level) {
  const preset = state.memoryPresets[level];
  const defaults = MEMORY_MODE_CONFIG[level];
  const defaultDescriptions = {
    Easy: '1–2 values, 4–6 digits each',
    Medium: '2–3 values, 6–8 digits each',
    Hard: '3–5 values, 8–10 digits each',
  };
  if (hasPresetValues(preset, defaults, ['minimumValues', 'maximumValues', 'minimumDigits', 'maximumDigits', 'decimals', 'readSeconds', 'writeSeconds'])) return defaultDescriptions[level];
  return `${preset.minimumValues}–${preset.maximumValues} values, ${preset.minimumDigits}–${preset.maximumDigits} digits each`;
}

function taskPresetDescription(level) {
  const preset = state.taskPresets[level];
  const defaults = TASK_MODE_CONFIG[level];
  const defaultDescriptions = {
    Easy: '2–3 steps, 4 rows, 2 tabs',
    Medium: '4–5 steps, 6 rows, 3 tabs',
    Hard: '6–8 steps, 8 rows, 4 tabs',
  };
  if (hasPresetValues(preset, defaults, ['minimumSteps', 'maximumSteps', 'rows', 'tabs', 'briefingSeconds', 'recallSeconds', 'demoStepMilliseconds'])) return defaultDescriptions[level];
  return `${preset.minimumSteps}–${preset.maximumSteps} steps, ${preset.rows} rows, ${preset.tabs} tabs`;
}

function renderPresetEditor() {
  const game = selectedGame();
  const level = selectedDifficulty();
  const cashGame = game === 'cash';
  const memoryGame = game === 'memory';
  refs['preset-level'].textContent = level;
  refs['preset-cash-fields'].hidden = !cashGame;
  refs['preset-memory-fields'].hidden = !memoryGame;
  refs['preset-task-fields'].hidden = game !== 'task';

  if (cashGame) {
    const preset = state.cashPresets[level];
    refs['preset-cash-min-due'].value = (preset.minDue / 100).toFixed(2);
    refs['preset-cash-max-due'].value = (preset.maxDue / 100).toFixed(2);
    refs['preset-cash-step'].value = String(preset.step);
    refs['preset-cash-max-difference'].value = (preset.maxDifference / 100).toFixed(2);
    refs['preset-cash-split-count'].value = String(preset.splitCount);
    return;
  }

  if (memoryGame) {
    const preset = state.memoryPresets[level];
    refs['preset-memory-value-min'].value = String(preset.minimumValues);
    refs['preset-memory-value-max'].value = String(preset.maximumValues);
    refs['preset-memory-digit-min'].value = String(preset.minimumDigits);
    refs['preset-memory-digit-max'].value = String(preset.maximumDigits);
    refs['preset-memory-read-time'].value = String(preset.readSeconds);
    refs['preset-memory-write-time'].value = String(preset.writeSeconds);
    refs['preset-memory-decimals'].checked = preset.decimals;
    return;
  }

  const preset = state.taskPresets[level];
  refs['preset-task-step-min'].value = String(preset.minimumSteps);
  refs['preset-task-step-max'].value = String(preset.maximumSteps);
  refs['preset-task-rows'].value = String(preset.rows);
  refs['preset-task-tabs'].value = String(preset.tabs);
  refs['preset-task-briefing-time'].value = String(preset.briefingSeconds);
  refs['preset-task-recall-time'].value = String(preset.recallSeconds);
  refs['preset-task-demo-speed'].value = String(preset.demoStepMilliseconds / 1000);
}

function updateGameSetup() {
  const game = selectedGame();
  const memoryGame = game === 'memory';
  const taskGame = game === 'task';
  refs['cash-setup-options'].hidden = memoryGame || taskGame;
  refs['memory-setup-options'].hidden = !memoryGame;
  refs['task-setup-options'].hidden = !taskGame;
  const descriptions = Object.fromEntries(['Easy', 'Medium', 'Hard'].map((level) => [
    level,
    memoryGame ? memoryPresetDescription(level) : taskGame ? taskPresetDescription(level) : cashPresetDescription(level),
  ]));
  refs['easy-description'].textContent = descriptions.Easy;
  refs['medium-description'].textContent = descriptions.Medium;
  refs['hard-description'].textContent = descriptions.Hard;
  renderPresetEditor();
}

function readPresetCents(ref, label) {
  const cents = parseAmountToCents(ref.value);
  if (cents === null) throw new RangeError(`${label} must be a dollar amount with up to two decimal places.`);
  return cents;
}

function readPresetInteger(ref, label) {
  const value = Number(ref.value);
  if (!Number.isInteger(value)) throw new RangeError(`${label} must be a whole number.`);
  return value;
}

function readPresetDemoMilliseconds(ref) {
  const seconds = Number(ref.value);
  if (!Number.isFinite(seconds)) throw new RangeError('Demo seconds per step must be a number.');
  return Math.round(seconds * 1000);
}

function saveSelectedPreset() {
  const level = selectedDifficulty();
  const game = selectedGame();
  try {
    if (game === 'cash') {
      state.cashPresets[level] = resolveCashDifficultyPreset(level, {
        minDue: readPresetCents(refs['preset-cash-min-due'], 'Minimum amount due'),
        maxDue: readPresetCents(refs['preset-cash-max-due'], 'Maximum amount due'),
        step: readPresetInteger(refs['preset-cash-step'], 'Increment'),
        maxDifference: readPresetCents(refs['preset-cash-max-difference'], 'Maximum difference'),
        splitCount: readPresetInteger(refs['preset-cash-split-count'], 'Cash item count'),
      });
    } else if (game === 'memory') {
      state.memoryPresets[level] = resolveMemoryDifficultyPreset(level, {
        minimumValues: readPresetInteger(refs['preset-memory-value-min'], 'Minimum values'),
        maximumValues: readPresetInteger(refs['preset-memory-value-max'], 'Maximum values'),
        minimumDigits: readPresetInteger(refs['preset-memory-digit-min'], 'Minimum digits'),
        maximumDigits: readPresetInteger(refs['preset-memory-digit-max'], 'Maximum digits'),
        decimals: refs['preset-memory-decimals'].checked,
        readSeconds: readPresetInteger(refs['preset-memory-read-time'], 'Reading seconds'),
        writeSeconds: readPresetInteger(refs['preset-memory-write-time'], 'Writing seconds'),
      });
    } else {
      state.taskPresets[level] = resolveTaskDifficultyPreset(level, {
        minimumSteps: readPresetInteger(refs['preset-task-step-min'], 'Minimum steps'),
        maximumSteps: readPresetInteger(refs['preset-task-step-max'], 'Maximum steps'),
        rows: readPresetInteger(refs['preset-task-rows'], 'Rows'),
        tabs: readPresetInteger(refs['preset-task-tabs'], 'Tabs'),
        briefingSeconds: readPresetInteger(refs['preset-task-briefing-time'], 'Briefing seconds'),
        recallSeconds: readPresetInteger(refs['preset-task-recall-time'], 'Recall seconds'),
        demoStepMilliseconds: readPresetDemoMilliseconds(refs['preset-task-demo-speed']),
      });
    }
    const saved = persistPresetState();
    updateGameSetup();
    refs['preset-editor'].open = true;
    if (saved) setMessage(`Saved the ${level} ${game === 'cash' ? 'cash handling' : game === 'memory' ? 'number memory' : 'task simulation'} preset on this device.`);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'The preset could not be saved.');
  }
}

function resetSelectedPreset() {
  const level = selectedDifficulty();
  const game = selectedGame();
  if (game === 'cash') state.cashPresets[level] = resolveCashDifficultyPreset(level);
  else if (game === 'memory') {
    state.memoryPresets[level] = resolveMemoryDifficultyPreset(level);
  } else {
    state.taskPresets[level] = resolveTaskDifficultyPreset(level);
  }
  const saved = persistPresetState();
  updateGameSetup();
  refs['preset-editor'].open = true;
  if (saved) setMessage(`Restored the normal ${level} ${game === 'cash' ? 'cash handling' : game === 'memory' ? 'number memory' : 'task simulation'} preset.`);
}

function resetAllPresets() {
  state.cashPresets = builtInCashPresets();
  state.memoryPresets = builtInMemoryPresets();
  state.taskPresets = builtInTaskPresets();
  const saved = persistPresetState();
  updateGameSetup();
  refs['preset-editor'].open = true;
  if (saved) setMessage('Restored all Easy, Medium, and Hard presets to their normal amounts and ranges.');
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

function startOptionalTimer(seconds, target, expiryAction) {
  if (seconds > 0) {
    startTimer(seconds, target, expiryAction);
    return;
  }
  stopTimer();
  target.textContent = 'Untimed';
  target.classList.remove('urgent');
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
  state.question = createQuestion(state.difficulty, Math.random, state.cashPresets[state.difficulty]);
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
  startTimer(state.memoryChallenge.writeSeconds, refs['memory-answer-timer'], () => submitMemoryAnswer(true));
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
    state.memoryChallenge.writeSeconds,
    Math.max(0, (Date.now() - (state.deadline - state.memoryChallenge.writeSeconds * 1000)) / 1000),
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
  state.memoryChallenge = createMemoryChallenge(state.difficulty, state.memoryPresets[state.difficulty]);
  state.answerSubmitted = false;
  refs['memory-read-progress'].textContent = `Round ${state.questionNumber} of ${state.questionCount}`;
  renderMemoryReadValues(state.memoryChallenge);
  refs['memory-read-hint'].textContent = `${state.memoryChallenge.valueCount} value${state.memoryChallenge.valueCount === 1 ? '' : 's'} in order · ${state.memoryChallenge.minimumDigits}–${state.memoryChallenge.maximumDigits} digits each${state.memoryChallenge.decimals ? ' · decimal points included' : ''}`;
  showScreen('memory-read');
  startTimer(state.memoryChallenge.readSeconds, refs['memory-read-timer'], showMemoryAnswer);
}

function renderTaskInstructions(challenge) {
  refs['task-instruction-list'].replaceChildren(...challenge.steps.map((step) => {
    const item = document.createElement('li');
    item.textContent = step.instruction;
    return item;
  }));
}

function taskVisibleTabs() {
  const workspace = state.taskChallenge.workspace;
  const openableTab = workspace.case?.openableTab;
  return openableTab && state.taskVerificationTabOpen
    ? [...workspace.tabs, { id: openableTab.id, label: openableTab.label }]
    : workspace.tabs;
}

function taskStoredValue(targetId, fallback) {
  return Object.hasOwn(state.taskFieldValues, targetId) ? state.taskFieldValues[targetId] : fallback;
}

function setTaskStoredValue(targetId, value) {
  state.taskFieldValues[targetId] = value;
  const target = document.getElementById(targetId);
  if (target instanceof HTMLInputElement && target.type === 'checkbox') target.checked = Boolean(value);
  else if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) target.value = String(value);
}

function recordTaskAction(action) {
  if (state.taskPhase !== 'recall' || state.answerSubmitted) return;
  state.taskActionLog.push(action);
  refs['task-phase-status'].textContent = `${state.taskActionLog.length} action${state.taskActionLog.length === 1 ? '' : 's'} recorded. Save changes when you are done.`;
}

function bindTaskControl(control, type) {
  control.addEventListener('change', () => {
    const value = type === 'toggle-checkbox' ? control.checked : control.value.trim();
    setTaskStoredValue(control.id, value);
    recordTaskAction({ type, targetId: control.id, value });
  });
}

function appendTaskTextField(parent, { id, label, value = '', disabled, inputMode = 'text', className = '' }) {
  const field = document.createElement('label');
  field.className = className;
  field.textContent = label;
  const input = document.createElement('input');
  input.id = id;
  input.type = 'text';
  input.inputMode = inputMode;
  input.autocomplete = 'off';
  input.value = String(taskStoredValue(id, value));
  input.disabled = disabled;
  field.append(input);
  bindTaskControl(input, 'set-text');
  parent.append(field);
  return input;
}

function appendTaskSelectField(parent, { id, label, options, value, disabled, className = '' }) {
  const field = document.createElement('label');
  field.className = className;
  field.textContent = label;
  const select = document.createElement('select');
  select.id = id;
  select.disabled = disabled;
  for (const optionValue of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    select.append(option);
  }
  select.value = String(taskStoredValue(id, value));
  field.append(select);
  bindTaskControl(select, 'select-option');
  parent.append(field);
  return select;
}

function appendTaskCheckboxField(parent, { id, label, checked = false, disabled, className = '' }) {
  const field = document.createElement('label');
  field.className = `task-checkbox-field ${className}`.trim();
  const input = document.createElement('input');
  input.id = id;
  input.type = 'checkbox';
  input.checked = Boolean(taskStoredValue(id, checked));
  input.disabled = disabled;
  const text = document.createElement('span');
  text.textContent = label;
  field.append(input, text);
  bindTaskControl(input, 'toggle-checkbox');
  parent.append(field);
  return input;
}

function taskSection(className, heading, description = '') {
  const section = document.createElement('section');
  section.className = className;
  const title = document.createElement('h3');
  title.textContent = heading;
  section.append(title);
  if (description) {
    const copy = document.createElement('p');
    copy.textContent = description;
    section.append(copy);
  }
  return section;
}

function updateTaskTabButtons() {
  for (const tab of taskVisibleTabs()) {
    const button = document.getElementById(tab.id);
    const selected = tab.id === state.taskActiveTabId;
    if (button) {
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
  }
}

function setTaskTab(tabId) {
  const activeTab = taskVisibleTabs().find((tab) => tab.id === tabId);
  if (!activeTab) return;
  state.taskActiveTabId = tabId;
  refs['task-tabpanel'].setAttribute('aria-labelledby', tabId);
  refs['task-workspace-heading'].textContent = `${state.taskChallenge.title} · ${activeTab.label}`;
  updateTaskTabButtons();
  renderTaskWorkspaceContent(state.taskWorkspaceDisabled);
}

function activateTaskTab(tab, record = false) {
  setTaskTab(tab.id);
  if (record) recordTaskAction({ type: 'activate-tab', targetId: tab.id, value: tab.label });
}

function renderTaskTabs(disabled) {
  const tabs = taskVisibleTabs();
  refs['task-tablist'].replaceChildren(...tabs.map((tab) => {
    const button = document.createElement('button');
    button.id = tab.id;
    button.className = 'task-tab';
    button.type = 'button';
    button.role = 'tab';
    button.textContent = tab.label;
    button.setAttribute('aria-controls', 'task-tabpanel');
    button.setAttribute('aria-selected', String(tab.id === state.taskActiveTabId));
    button.tabIndex = tab.id === state.taskActiveTabId ? 0 : -1;
    button.disabled = disabled;
    button.addEventListener('click', () => activateTaskTab(tab, true));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = tabs.findIndex((item) => item.id === tab.id);
      const nextIndex = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];
      document.getElementById(nextTab.id)?.focus();
      activateTaskTab(nextTab, true);
    });
    return button;
  }));
}

function renderRecordsWorkspace(disabled) {
  const challenge = state.taskChallenge;
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap task-table-wrap';
  const table = document.createElement('table');
  table.className = 'task-table';
  const header = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const column of challenge.workspace.columns) {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.textContent = column;
    headerRow.append(heading);
  }
  header.append(headerRow);
  const body = document.createElement('tbody');
  for (const row of challenge.workspace.rows) {
    const fragment = refs['task-row-template'].content.cloneNode(true);
    const name = fragment.querySelector('.task-row-name');
    const reference = fragment.querySelector('.task-reference');
    const status = fragment.querySelector('.task-status');
    const priority = fragment.querySelector('.task-priority');
    const complete = fragment.querySelector('.task-complete');
    name.textContent = row.name;
    reference.id = `task-row-${row.id}-reference`;
    reference.value = String(taskStoredValue(reference.id, row.reference));
    reference.disabled = disabled;
    reference.setAttribute('aria-label', `Reference for ${row.name}`);
    status.id = `task-row-${row.id}-status`;
    status.value = String(taskStoredValue(status.id, row.status));
    status.disabled = disabled;
    status.setAttribute('aria-label', `Status for ${row.name}`);
    priority.id = `task-row-${row.id}-priority`;
    priority.value = String(taskStoredValue(priority.id, row.priority));
    priority.disabled = disabled;
    priority.setAttribute('aria-label', `Priority for ${row.name}`);
    complete.id = `task-row-${row.id}-complete`;
    complete.checked = Boolean(taskStoredValue(complete.id, row.complete));
    complete.disabled = disabled;
    complete.setAttribute('aria-label', `Complete ${row.name}'s record`);
    bindTaskControl(reference, 'set-text');
    bindTaskControl(status, 'select-option');
    bindTaskControl(priority, 'select-option');
    bindTaskControl(complete, 'toggle-checkbox');
    body.append(fragment);
  }
  table.append(header, body);
  tableWrap.append(table);
  refs['task-workspace-content'].replaceChildren(tableWrap);
}

function openTaskVerificationTab(record = false) {
  const openableTab = state.taskChallenge.workspace.case?.openableTab;
  if (!openableTab) return;
  state.taskVerificationTabOpen = true;
  renderTaskTabs(state.taskWorkspaceDisabled);
  renderTaskWorkspaceContent(state.taskWorkspaceDisabled);
  if (record) recordTaskAction({ type: 'open-workspace-tab', targetId: openableTab.openerId, value: openableTab.label });
}

function renderCaseworkWorkspace(disabled) {
  const caseData = state.taskChallenge.workspace.case;
  if (state.taskActiveTabId === caseData.openableTab.id) {
    const verification = taskSection('task-verification-layout', 'Verification workspace', 'Confirm the source number, then copy it into the secure field.');
    const source = document.createElement('p');
    source.className = 'task-source-number';
    source.textContent = `Source control number: ${caseData.verificationSource}`;
    verification.append(source);
    appendTaskTextField(verification, {
      id: 'task-case-verification', label: 'Verification code', value: '', disabled, inputMode: 'numeric', className: 'task-wide-field',
    });
    refs['task-workspace-content'].replaceChildren(verification);
    return;
  }

  const layout = document.createElement('div');
  layout.className = 'task-casework-layout';
  const summary = taskSection('task-case-summary', 'Case overview', `Request ${caseData.requestId} · ${caseData.person}`);
  const summaryList = document.createElement('dl');
  for (const [term, description] of [['Customer', caseData.person], ['Request', caseData.requestId], ['Source number', caseData.verificationSource]]) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = description;
    summaryList.append(dt, dd);
  }
  summary.append(summaryList);
  const details = taskSection('task-case-details', 'Update case', 'The information panel stays open while you switch between case pages.');
  const fields = document.createElement('div');
  fields.className = 'task-form-grid';
  appendTaskTextField(fields, { id: 'task-case-reference', label: 'Case reference', value: '', disabled, inputMode: 'text' });
  appendTaskSelectField(fields, { id: 'task-case-status', label: 'Case status', options: ['Open', 'Needs review', 'Escalated', 'Resolved'], value: caseData.status, disabled });
  appendTaskSelectField(fields, { id: 'task-case-queue', label: 'Queue', options: ['General', 'Billing', 'Compliance', 'Priority'], value: caseData.queue, disabled });
  appendTaskCheckboxField(fields, { id: 'task-case-followup', label: 'Follow-up required', checked: false, disabled });
  details.append(fields);
  const actions = document.createElement('div');
  actions.className = 'task-inline-actions';
  const noteButton = document.createElement('button');
  noteButton.id = 'task-open-case-dialog';
  noteButton.className = 'secondary-button';
  noteButton.type = 'button';
  noteButton.textContent = 'Add case note';
  noteButton.disabled = disabled;
  noteButton.addEventListener('click', () => openTaskDialog(true));
  const tabButton = document.createElement('button');
  tabButton.id = caseData.openableTab.openerId;
  tabButton.className = 'text-button';
  tabButton.type = 'button';
  tabButton.textContent = 'Open verification in a new workspace tab';
  tabButton.disabled = disabled || state.taskVerificationTabOpen;
  tabButton.addEventListener('click', () => openTaskVerificationTab(true));
  actions.append(noteButton, tabButton);
  details.append(actions);
  layout.append(summary, details);
  refs['task-workspace-content'].replaceChildren(layout);
}

function renderInvoiceWorkspace(disabled) {
  const invoice = state.taskChallenge.workspace.invoice;
  const layout = document.createElement('div');
  layout.className = 'task-invoice-layout';
  const summary = taskSection('task-invoice-summary', 'Invoice review', `${invoice.invoiceId} · ${invoice.person}`);
  const total = document.createElement('p');
  total.className = 'task-formula-display';
  total.textContent = invoice.formula.expression;
  summary.append(total);
  const verification = taskSection('task-invoice-verification-card', 'Source check', 'Read the control number and copy it to the verification field.');
  const source = document.createElement('p');
  source.className = 'task-source-number';
  source.textContent = `Control number: ${invoice.verification.source}`;
  verification.append(source);
  const form = taskSection('task-invoice-form', 'Apply updates', 'Complete the formula, verify the source value, then save the invoice.');
  const fields = document.createElement('div');
  fields.className = 'task-form-grid';
  appendTaskTextField(fields, { id: 'task-invoice-calculation', label: 'Final total', value: '', disabled, inputMode: 'numeric' });
  appendTaskTextField(fields, { id: 'task-invoice-verification', label: 'Verification code', value: '', disabled, inputMode: 'numeric' });
  appendTaskTextField(fields, { id: 'task-invoice-reference', label: 'Invoice reference', value: '', disabled, inputMode: 'text' });
  appendTaskSelectField(fields, { id: 'task-invoice-status', label: 'Review status', options: ['Draft', 'Ready for review', 'Approved', 'On hold'], value: invoice.status, disabled });
  appendTaskSelectField(fields, { id: 'task-invoice-category', label: 'Cost category', options: ['Services', 'Materials', 'Travel', 'Operations'], value: invoice.category, disabled });
  appendTaskTextField(fields, { id: 'task-invoice-note', label: 'Review note', value: '', disabled, inputMode: 'text' });
  appendTaskCheckboxField(fields, { id: 'task-invoice-approved', label: 'Approval received', checked: false, disabled });
  appendTaskCheckboxField(fields, { id: 'task-invoice-verified', label: 'Source number verified', checked: false, disabled });
  form.append(fields);
  layout.append(summary, verification, form);
  refs['task-workspace-content'].replaceChildren(layout);
}

function renderTaskWorkspaceContent(disabled) {
  if (!state.taskChallenge) return;
  const kind = state.taskChallenge.workspace.kind;
  if (kind === 'casework') renderCaseworkWorkspace(disabled);
  else if (kind === 'invoice') renderInvoiceWorkspace(disabled);
  else renderRecordsWorkspace(disabled);
}

function closeTaskDialog() {
  if (refs['task-workspace-dialog'].open) refs['task-workspace-dialog'].close();
}

function openTaskDialog(record = false) {
  const dialog = refs['task-workspace-dialog'];
  if (!dialog.open) dialog.showModal();
  if (record) recordTaskAction({ type: 'open-dialog', targetId: 'task-open-case-dialog', value: 'Add case note' });
}

function renderTaskDialog(disabled) {
  const dialog = refs['task-workspace-dialog'];
  closeTaskDialog();
  dialog.replaceChildren();
  if (state.taskChallenge.workspace.kind !== 'casework') return;
  const heading = document.createElement('h3');
  heading.id = 'task-workspace-dialog-heading';
  heading.textContent = 'Add case note';
  const copy = document.createElement('p');
  copy.textContent = 'Add the exact note from the workflow before confirming it.';
  const form = document.createElement('div');
  form.className = 'task-dialog-form';
  appendTaskTextField(form, { id: 'task-case-note', label: 'Case note', value: '', disabled, inputMode: 'text' });
  const confirm = document.createElement('button');
  confirm.id = 'task-confirm-case-note';
  confirm.className = 'primary-button';
  confirm.type = 'button';
  confirm.textContent = 'Add note';
  confirm.disabled = disabled;
  confirm.addEventListener('click', () => {
    recordTaskAction({ type: 'confirm-dialog', targetId: confirm.id });
    closeTaskDialog();
  });
  form.append(confirm);
  dialog.setAttribute('aria-labelledby', heading.id);
  dialog.append(heading, copy, form);
}

function resetTaskWorkspace() {
  closeTaskDialog();
  state.taskFieldValues = {};
  state.taskVerificationTabOpen = false;
  state.taskActiveTabId = state.taskChallenge.workspace.tabs[0].id;
}

function renderTaskWorkspace(disabled) {
  state.taskWorkspaceDisabled = disabled;
  if (!taskVisibleTabs().some((tab) => tab.id === state.taskActiveTabId)) {
    state.taskActiveTabId = taskVisibleTabs()[0].id;
  }
  renderTaskTabs(disabled);
  setTaskTab(state.taskActiveTabId);
  renderTaskDialog(disabled);
  refs['task-save-workspace'].disabled = disabled;
}

function applyTaskDemoStep(step) {
  if (step.type === 'activate-tab') {
    const tab = taskVisibleTabs().find((item) => item.id === step.targetId);
    if (tab) activateTaskTab(tab);
  } else if (step.type === 'open-workspace-tab') {
    openTaskVerificationTab();
  } else if (step.type === 'open-dialog') {
    openTaskDialog();
  } else if (step.type === 'confirm-dialog') {
    closeTaskDialog();
  } else if (step.type === 'set-text' || step.type === 'select-option' || step.type === 'toggle-checkbox') {
    setTaskStoredValue(step.targetId, step.value);
  }
}

function cancelTaskDemo() {
  state.taskDemoToken += 1;
  state.taskDemoAnimation?.cancel();
  state.taskDemoAnimation = null;
  state.taskDemoPaused = false;
  state.taskDemoResume?.();
  state.taskDemoResume = null;
  hideTaskDemoGuide();
  refs['task-demo-cursor'].hidden = true;
}

function taskReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

async function waitForTaskDemoResume(token) {
  while (state.taskDemoPaused && state.taskDemoToken === token) {
    await new Promise((resolve) => {
      state.taskDemoResume = resolve;
    });
  }
}

function hideTaskDemoGuide() {
  refs['task-demo-guide'].hidden = true;
  refs['task-demo-guide'].textContent = '';
  delete refs['task-demo-guide'].dataset.direction;
}

function taskDemoGuideDirection(target) {
  const targetBounds = target.getBoundingClientRect();
  const viewportCenter = window.innerHeight / 2;
  if (targetBounds.top > viewportCenter + 16) return 'down';
  if (targetBounds.bottom < viewportCenter - 16) return 'up';
  return 'across';
}

function updateTaskDemoGuide(transition, direction, state) {
  if (!isCompactViewport()) return;
  const guide = refs['task-demo-guide'];
  const action = state === 'arrived'
    ? 'Now at'
    : direction === 'up' ? 'Scrolling up to'
      : direction === 'down' ? 'Scrolling down to'
        : 'Moving to';
  const source = transition.previousInstruction ? `From ${transition.previousInstruction} · ` : '';
  guide.hidden = false;
  guide.dataset.direction = direction;
  guide.textContent = `${source}${action} step ${transition.stepNumber} of ${transition.stepCount}: ${transition.instruction}`;
}

async function waitForTaskDemoScroll(token) {
  if (taskReducedMotion()) return;
  await new Promise((resolve) => {
    let frames = 0;
    const nextFrame = () => {
      if (state.taskDemoToken !== token || frames >= 18) {
        resolve();
        return;
      }
      frames += 1;
      window.requestAnimationFrame(nextFrame);
    };
    window.requestAnimationFrame(nextFrame);
  });
}

async function animateTaskCursor(target, duration, token, transition) {
  target.classList.add('task-demo-target');
  if (isCompactViewport()) {
    const direction = taskDemoGuideDirection(target);
    updateTaskDemoGuide(transition, direction, 'moving');
    target.scrollIntoView({ behavior: taskReducedMotion() ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
    await waitForTaskDemoScroll(token);
    if (state.taskDemoToken !== token) return;
    updateTaskDemoGuide(transition, 'arrived', 'arrived');
  }
  if (taskReducedMotion()) return;
  const rect = target.getBoundingClientRect();
  const cursor = refs['task-demo-cursor'];
  const transform = `translate(${Math.round(rect.left + (rect.width / 2) - 12)}px, ${Math.round(rect.top + (rect.height / 2) - 12)}px)`;
  cursor.hidden = false;
  const animation = cursor.animate([
    { transform: cursor.style.transform || 'translate(-100vw, -100vh)', opacity: 0.2 },
    { transform, opacity: 1 },
  ], { duration: Math.max(250, Math.round(duration * 0.75)), easing: 'ease-out', fill: 'forwards' });
  state.taskDemoAnimation = animation;
  await animation.finished.catch(() => undefined);
  if (state.taskDemoToken === token) cursor.style.transform = transform;
  state.taskDemoAnimation = null;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function runTaskDemo(token) {
  for (const [index, step] of state.taskChallenge.steps.entries()) {
    await waitForTaskDemoResume(token);
    if (state.taskDemoToken !== token) return;
    const target = document.getElementById(step.targetId);
    const transition = {
      instruction: step.instruction,
      previousInstruction: state.taskChallenge.steps[index - 1]?.instruction ?? '',
      stepCount: state.taskChallenge.steps.length,
      stepNumber: index + 1,
    };
    refs['task-phase-status'].textContent = `Watch: ${step.instruction}`;
    if (target) await animateTaskCursor(target, state.taskChallenge.demoStepMilliseconds, token, transition);
    if (state.taskDemoToken !== token) return;
    applyTaskDemoStep(step);
    target?.classList.remove('task-demo-target');
    await wait(Math.max(120, Math.round(state.taskChallenge.demoStepMilliseconds * 0.2)));
  }
  if (state.taskDemoToken === token) startTaskRecall();
}

function startTaskDemo() {
  cancelTaskDemo();
  stopTimer();
  const token = state.taskDemoToken;
  state.taskPhase = 'demo';
  state.answerSubmitted = false;
  resetTaskWorkspace();
  renderTaskWorkspace(true);
  refs['task-workspace-progress'].textContent = `Round ${state.questionNumber} of ${state.questionCount} · Watch`;
  refs['task-demo-controls'].hidden = false;
  refs['task-pause-demo'].textContent = 'Pause';
  refs['task-recall-note'].textContent = 'The workspace will reset before your recall attempt.';
  showScreen('task-workspace');
  runTaskDemo(token);
}

function toggleTaskDemoPause() {
  if (state.taskPhase !== 'demo') return;
  state.taskDemoPaused = !state.taskDemoPaused;
  if (state.taskDemoPaused) {
    state.taskDemoAnimation?.pause();
    refs['task-pause-demo'].textContent = 'Resume';
    refs['task-phase-status'].textContent = 'Demonstration paused.';
  } else {
    state.taskDemoAnimation?.play();
    state.taskDemoResume?.();
    state.taskDemoResume = null;
    refs['task-pause-demo'].textContent = 'Pause';
  }
}

function startTaskRecall() {
  cancelTaskDemo();
  state.taskPhase = 'recall';
  state.answerSubmitted = false;
  state.taskActionLog = [];
  state.taskRecallStartedAt = Date.now();
  resetTaskWorkspace();
  renderTaskWorkspace(false);
  refs['task-workspace-progress'].textContent = `Round ${state.questionNumber} of ${state.questionCount} · Your turn`;
  refs['task-demo-controls'].hidden = true;
  refs['task-phase-status'].textContent = 'Instructions are hidden. Repeat the workflow, then save your changes.';
  refs['task-recall-note'].textContent = 'Use the tabs and controls from memory. Feedback appears only after you save or time runs out.';
  startOptionalTimer(state.taskChallenge.recallSeconds, refs['task-timer'], () => submitTaskAttempt(true));
  window.setTimeout(() => refs['task-tablist'].querySelector('button')?.focus({ preventScroll: true }), 0);
}

function showTaskBriefing() {
  state.taskPhase = 'briefing';
  renderTaskInstructions(state.taskChallenge);
  refs['task-briefing-title'].textContent = state.taskChallenge.title;
  refs['task-briefing-progress'].textContent = `Round ${state.questionNumber} of ${state.questionCount} · Briefing`;
  showScreen('task-briefing');
  if (state.taskChallenge.briefingSeconds === 0) {
    refs['task-briefing-timer'].textContent = 'Starting';
    window.setTimeout(startTaskDemo, 0);
    return;
  }
  startTimer(state.taskChallenge.briefingSeconds, refs['task-briefing-timer'], startTaskDemo);
}

function taskActionDescription(action) {
  const labels = {
    'activate-tab': `Opened ${action.value}`,
    'open-workspace-tab': `Opened ${action.value} workspace tab`,
    'open-dialog': 'Opened a dialog',
    'set-text': `Entered ${action.value}`,
    'select-option': `Selected ${action.value}`,
    'toggle-checkbox': action.value ? 'Marked complete' : 'Cleared complete',
    'confirm-dialog': 'Confirmed dialog entry',
    commit: 'Saved changes',
  };
  return labels[action.type] ?? 'Used a workspace control';
}

function recordTaskAttempt(score, timedOut, elapsedSeconds) {
  const challenge = state.taskChallenge;
  return {
    timestamp: new Date().toISOString(),
    sessionId: state.sessionId,
    gameType: 'Task simulation',
    taskTitle: challenge.title,
    difficulty: state.difficulty,
    questionNumber: state.questionNumber,
    stepsExpected: score.expectedSteps,
    stepsCompleted: score.completedSteps,
    mistakes: score.mistakes,
    sequenceAccuracyPercent: score.sequenceAccuracyPercent,
    timeLimitSeconds: challenge.recallSeconds,
    timeUsedSeconds: Number(elapsedSeconds.toFixed(1)),
    expectedAnswer: `${score.expectedSteps} ordered steps`,
    outcome: timedOut ? 'Timed Out' : score.correct ? 'Correct' : 'Incorrect',
  };
}

function appendFeedbackDetails(details) {
  refs['feedback-details'].replaceChildren();
  for (const [term, description] of details) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = description;
    refs['feedback-details'].append(dt, dd);
  }
}

function populateTaskFeedback(record, score) {
  const correct = score.correct;
  refs['feedback-kicker'].textContent = record.outcome === 'Timed Out' ? 'Time expired' : 'Task simulation result';
  refs['feedback-heading'].textContent = correct ? 'Correct' : record.outcome === 'Timed Out' ? 'Time expired' : 'Review the workflow';
  refs['feedback-heading'].dataset.result = correct ? 'correct' : 'incorrect';
  refs['feedback-lead'].textContent = correct
    ? `You completed all ${score.expectedSteps} steps in order.`
    : `You completed ${score.completedSteps} of ${score.expectedSteps} expected steps with ${score.mistakes} extra or out-of-order action${score.mistakes === 1 ? '' : 's'}.`;
  appendFeedbackDetails([
    ['Expected steps', state.taskChallenge.steps.map((step, index) => `${index + 1}. ${step.instruction}`).join(' ')],
    ['Your actions', state.taskActionLog.length ? state.taskActionLog.map(taskActionDescription).join(' → ') : 'No actions recorded'],
    ['Sequence accuracy', `${score.sequenceAccuracyPercent}%`],
    ['Time used', `${record.timeUsedSeconds.toFixed(1)} seconds`],
  ]);
}

function submitTaskAttempt(timedOut = false) {
  if (state.answerSubmitted || state.taskPhase !== 'recall') return;
  state.answerSubmitted = true;
  const elapsed = Math.max(0, (Date.now() - state.taskRecallStartedAt) / 1000);
  const elapsedSeconds = state.taskChallenge.recallSeconds > 0
    ? Math.min(state.taskChallenge.recallSeconds, elapsed)
    : elapsed;
  stopTimer();
  const score = scoreTaskAttempt(state.taskChallenge, state.taskActionLog, timedOut);
  const record = recordTaskAttempt(score, timedOut, elapsedSeconds);
  state.results.push(record);
  persistRecord(record);
  if (timedOut && state.autoContinueOnTimeout) {
    showNextTaskQuestion();
    return;
  }
  populateTaskFeedback(record, score);
  showScreen('feedback');
}

function showNextTaskQuestion() {
  state.questionNumber += 1;
  if (state.questionNumber > state.questionCount) {
    renderSummary();
    showScreen('summary');
    return;
  }
  state.taskChallenge = createTaskChallenge(state.difficulty, state.taskPresets[state.difficulty]);
  state.answerSubmitted = false;
  showTaskBriefing();
}

function makeMetrics(records) {
  const summary = summarizeHistory(records);
  const averageTime = summary.answered ? records.reduce((sum, record) => sum + Number(record.timeUsedSeconds || 0), 0) / summary.answered : 0;
  if (state.game === 'task') {
    const averageSequenceAccuracy = summary.answered
      ? records.reduce((sum, record) => sum + Number(record.sequenceAccuracyPercent || 0), 0) / summary.answered
      : 0;
    const mistakes = records.reduce((sum, record) => sum + Number(record.mistakes || 0), 0);
    return [
      [`${summary.answered}`, 'Rounds'],
      [`${summary.accuracyPercent}%`, 'Perfect rounds'],
      [`${averageSequenceAccuracy.toFixed(0)}%`, 'Sequence accuracy'],
      [`${mistakes}`, 'Mistakes'],
      [`${averageTime.toFixed(1)}s`, 'Average time'],
    ];
  }
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
  refs['summary-heading'].textContent = state.game === 'memory'
    ? 'Your memory results'
    : state.game === 'task' ? 'Your task simulation results' : 'Your cash results';
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
  if (['quiz', 'memory-read', 'memory-answer', 'task-briefing', 'task-workspace'].includes(state.activeScreen)) {
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

  if (game === 'task') {
    const questionCount = Number(refs['task-question-count'].value);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) {
      setMessage('Choose between 1 and 100 task simulation rounds.');
      refs['task-question-count'].focus();
      return;
    }
    state.questionCount = questionCount;
    showNextTaskQuestion();
    return;
  }

  if (game === 'memory') {
    const questionCount = Number(refs['memory-question-count'].value);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) {
      setMessage('Choose between 1 and 100 memory rounds.');
      refs['memory-question-count'].focus();
      return;
    }
    state.questionCount = questionCount;
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
  else if (state.game === 'task') showNextTaskQuestion();
  else showNextQuestion();
});
refs['memory-answer-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  submitMemoryAnswer();
});
refs['memory-answer-now'].addEventListener('click', showMemoryAnswer);
refs['task-start-demo'].addEventListener('click', startTaskDemo);
refs['task-pause-demo'].addEventListener('click', toggleTaskDemoPause);
refs['task-replay-demo'].addEventListener('click', startTaskDemo);
refs['task-skip-demo'].addEventListener('click', () => {
  if (state.taskPhase !== 'demo') return;
  cancelTaskDemo();
  startTaskRecall();
});
refs['task-save-workspace'].addEventListener('click', () => {
  if (state.taskPhase !== 'recall' || state.answerSubmitted) return;
  recordTaskAction({ type: 'commit', targetId: 'task-save-workspace' });
  submitTaskAttempt();
});
document.querySelectorAll('input[name="game"]').forEach((input) => input.addEventListener('change', () => {
  updateGameSetup();
}));
document.querySelectorAll('input[name="difficulty"]').forEach((input) => input.addEventListener('change', () => {
  updateGameSetup();
}));
refs['save-preset'].addEventListener('click', saveSelectedPreset);
refs['reset-selected-preset'].addEventListener('click', resetSelectedPreset);
refs['reset-all-presets'].addEventListener('click', resetAllPresets);
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
