import { PATTERN_GAME_NAMES } from './pattern-games.mjs';
import { createDistractionSamples } from './distraction-sounds.mjs';
import {
  FRAUD_INSPECTION_CATEGORIES,
  createFraudInspectionCase,
  resolveFraudInspectionSettings,
  scoreFraudInspectionAttempt,
  summarizeFraudHistory,
} from './fraud-inspection.mjs?v=20260922-signature-portrait';
import { PRACTICE_GAMES, rankPracticeCandidates, recommendPractice, practiceSettings } from './adaptive-practice.mjs?v=20260918-progress';
import {
  buildChartSpecs, buildGameFilters, buildProgressModel, comparePeriods,
  filterHistory, recommendNextChallenge,
} from './progress-analytics.mjs?v=20260922-signature-portrait';
import {
  DENOMINATIONS,
  DIFFICULTY_CONFIG,
  ERROR_DETECTION_MODE_CONFIG,
  ERROR_DETECTION_PUZZLE_FAMILIES,
  MEMORY_MODE_CONFIG,
  TASK_MODE_CONFIG,
  buildBreakdown,
  countTotalCents,
  createErrorDetectionChallenge,
  createMemoryChallenge,
  createTaskChallenge,
  createQuestion,
  createCashGuidance,
  evaluateCustomerBillRequest,
  formatBreakdown,
  formatMoney,
  parseCashShorthand,
  parseAmountToCents,
  resolveCashDifficultyPreset,
  resolveErrorDetectionDifficultyPreset,
  resolveMemoryDifficultyPreset,
  resolveTaskDifficultyPreset,
  scoreMemoryAnswer,
  scoreTaskAttempt,
  scoreAnswer,
  scoreErrorDetectionAttempt,
  summarizeHistory,
  toCsv,
} from './quiz-core.mjs?v=20260908-practice';

const HISTORY_KEY = 'cash-handling-terminal-quiz-history-v1';
const THEME_KEY = 'cash-handling-terminal-quiz-theme-v1';
const PRESET_KEY = 'cash-handling-terminal-quiz-presets-v1';
const CURRENT_CHALLENGE_KEY = 'cash-handling-terminal-quiz-current-challenge-v1';
const screens = ['setup', 'quiz', 'memory-read', 'memory-answer', 'task-briefing', 'task-workspace', 'error-detection-briefing', 'error-detection', 'fraud-inspection', 'feedback', 'summary', 'history'];
const refs = Object.fromEntries([
  'setup-form', 'setup-screen', 'quiz-screen', 'feedback-screen', 'summary-screen', 'history-screen',
  'memory-read-screen', 'memory-answer-screen', 'task-briefing-screen', 'task-workspace-screen', 'error-detection-briefing-screen', 'error-detection-screen', 'fraud-inspection-screen', 'cash-setup-options', 'memory-setup-options', 'task-setup-options', 'error-detection-setup-options', 'fraud-setup-options',
  'question-count', 'time-limit', 'cash-builder-toggle', 'customer-bill-request-toggle', 'auto-continue-toggle', 'distraction-noise-toggle', 'question-progress', 'timer', 'amount-due',
  'tender-breakdown', 'customer-bill-request', 'customer-bill-request-text', 'customer-bill-request-status', 'flag-bill-request', 'answer-form', 'answer-amount', 'cash-builder-section', 'cash-builder-heading',
  'cash-builder-purpose', 'cash-builder', 'selected-total', 'builder-status', 'clear-builder', 'quick-cash-entry', 'apply-quick-cash', 'feedback-heading',
  'feedback-kicker', 'feedback-lead', 'feedback-details', 'next-question', 'session-metrics',
  'start-another', 'summary-history', 'open-history', 'back-to-setup', 'history-metrics',
  'history-outcome-diagram', 'history-outcome-legend', 'history-outcomes-summary', 'history-accuracy-chart',
  'history-rows', 'download-csv', 'clear-history', 'message', 'submit-answer', 'theme-toggle',
  'history-game-tabs', 'history-quick-ranges', 'history-common-filters', 'history-game-filters', 'clear-history-filters',
  'history-charts', 'history-comparison', 'history-recommendations', 'previous-challenges',
  'attempt-detail-dialog', 'attempt-detail-summary', 'attempt-detail-content', 'close-attempt-detail',
  'memory-question-count', 'memory-read-progress', 'memory-read-timer', 'memory-number', 'memory-read-hint', 'memory-answer-now',
  'memory-answer-form', 'memory-answer-list', 'memory-answer-progress', 'memory-answer-timer', 'memory-answer-heading', 'summary-heading',
  'task-question-count', 'task-briefing-progress', 'task-briefing-timer', 'task-briefing-heading', 'task-briefing-title', 'task-instruction-list', 'task-start-demo',
  'task-workspace-progress', 'task-timer', 'task-workspace-heading', 'task-phase-status', 'task-demo-controls', 'task-pause-demo', 'task-replay-demo', 'task-skip-demo',
  'task-tablist', 'task-tabpanel', 'task-workspace-content', 'task-workspace-dialog', 'task-save-workspace', 'task-demo-guide', 'task-demo-cursor', 'task-recall-note', 'task-row-template',
  'error-detection-question-count', 'error-detection-briefing-progress', 'error-detection-briefing-heading', 'error-detection-briefing-family', 'error-detection-briefing-title', 'error-detection-briefing-overview', 'error-detection-rule-steps', 'error-detection-example', 'error-detection-start-puzzle',
  'error-detection-progress', 'error-detection-timer', 'error-detection-heading', 'error-detection-title', 'error-detection-puzzle-family', 'error-detection-puzzle-legend', 'error-detection-detail-list', 'error-detection-no-errors', 'error-detection-selection-status', 'error-detection-form',
  'fraud-inspection-progress', 'fraud-inspection-timer', 'fraud-inspection-heading', 'fraud-policy-note', 'fraud-transaction-strip', 'fraud-document-grid', 'fraud-inspection-form', 'fraud-selection-status', 'fraud-issue-list', 'fraud-feedback', 'fraud-feedback-documents', 'fraud-feedback-issues',
  'fraud-question-count', 'fraud-time-limit', 'fraud-run-mode', 'fraud-custom-options', 'fraud-minimum-errors', 'fraud-maximum-errors', 'fraud-signature-difficulty', 'fraud-handwriting-similarity', 'fraud-alteration-subtlety', 'fraud-date-difficulty', 'fraud-name-difficulty', 'fraud-amount-difficulty', 'fraud-id-difficulty', 'fraud-field-density', 'fraud-allow-clean', 'fraud-zoom-enabled', 'fraud-show-timer', 'fraud-auto-next', 'fraud-instant-feedback', 'fraud-mix-difficulty', 'fraud-enabled-categories',
  'fraud-history-panel', 'fraud-history-metrics', 'fraud-history-weakness', 'fraud-history-categories', 'fraud-history-breakdowns', 'fraud-document-dialog', 'fraud-document-dialog-heading', 'fraud-document-dialog-view', 'close-fraud-document-dialog', 'custom-difficulty-card', 'preset-editor',
  'easy-description', 'medium-description', 'hard-description',
  'preset-editor', 'preset-level', 'preset-cash-fields', 'preset-memory-fields', 'preset-task-fields', 'preset-error-detection-fields',
  'preset-cash-min-due', 'preset-cash-max-due', 'preset-cash-step', 'preset-cash-max-difference', 'preset-cash-split-count',
  'preset-memory-value-min', 'preset-memory-value-max', 'preset-memory-digit-min', 'preset-memory-digit-max',
  'preset-memory-read-time', 'preset-memory-write-time', 'preset-memory-decimals',
  'preset-task-step-min', 'preset-task-step-max', 'preset-task-rows', 'preset-task-tabs', 'preset-task-briefing-time', 'preset-task-recall-time', 'preset-task-demo-speed',
  'preset-error-detection-details', 'preset-error-detection-errors', 'preset-error-detection-time',
  'save-preset', 'reset-selected-preset', 'reset-all-presets',
].map((id) => [id, document.getElementById(id)]));

const savedPresetState = loadPresetState();
const historyView = { filters: { game: 'all' }, activeRange: 'all', charts: new Map() };

const state = {
  activeScreen: 'setup',
  game: 'cash',
  sessionId: '',
  difficulty: 'Easy',
  questionCount: 10,
  timeLimitSeconds: 30,
  cashBuilderEnabled: false,
  customerBillRequestsEnabled: false,
  customerRequestFlagged: false,
  autoContinue: false,
  distractionNoisesEnabled: false,
  distractionAudioContext: null,
  distractionAudioSource: null,
  distractionAudioGain: null,
  distractionAudioLevelTimer: null,
  cashPresets: savedPresetState.cash,
  memoryPresets: savedPresetState.memory,
  taskPresets: savedPresetState.task,
  errorDetectionPresets: savedPresetState.errorDetection,
  practicePlan: null,
  currentChallenge: loadCurrentChallenge(),
  questionNumber: 0,
  question: null,
  results: [],
  builderCounts: new Map(),
  timerId: null,
  deadline: 0,
  answerSubmitted: false,
  memoryChallenge: null,
  taskChallenge: null,
  errorDetectionChallenge: null,
  errorDetailSelections: new Set(),
  errorDetectionFamilyDeck: [],
  errorDetectionStartedAt: 0,
  fraudSettings: null,
  fraudChallenge: null,
  fraudSelections: new Set(),
  fraudStartedAt: 0,
  fraudDocumentZooms: new Map(),
  fraudDialogZoom: 1,
  fraudRoundAdvanceTimer: null,
  fraudStoppedEarly: false,
  fraudLastScore: null,
  fraudCurrentStreak: 0,
  fraudBestStreak: 0,
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

function prepareDistractionAudio() {
  stopContinuousDistractionNoise();
  state.distractionNoisesEnabled = false;
  if (!refs['distraction-noise-toggle'].checked) return false;

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    setMessage('This browser does not support the optional distraction sounds. Your practice session will remain silent.');
    return false;
  }

  try {
    if (!state.distractionAudioContext || state.distractionAudioContext.state === 'closed') {
      state.distractionAudioContext = new AudioContextConstructor();
    }
    if (state.distractionAudioContext.state === 'suspended') {
      state.distractionAudioContext.resume().catch(() => {
        state.distractionNoisesEnabled = false;
        stopContinuousDistractionNoise();
        setMessage('Your browser kept audio paused, so distraction sounds are off for this session.');
      });
    }
    state.distractionNoisesEnabled = true;
    return true;
  } catch {
    setMessage('The optional distraction sounds could not start. Your practice session will remain silent.');
    return false;
  }
}

function varyContinuousDistractionNoise() {
  const audioContext = state.distractionAudioContext;
  const gain = state.distractionAudioGain;
  if (state.sessionEvidence?.continuousNoise && !state.sessionEvidence.sessionCompletedAt
      && (!state.distractionAudioSource || audioContext?.state !== 'running')) state.sessionEvidence.noiseMaintained = false;
  if (!state.distractionNoisesEnabled || !audioContext || !gain || audioContext.state !== 'running') return;
  const nextLevel = [0.009, 0.016, 0.027, 0.04][Math.floor(Math.random() * 4)];
  const now = audioContext.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
  gain.gain.linearRampToValueAtTime(nextLevel, now + 0.1);
  state.distractionAudioSource?.playbackRate.setTargetAtTime(0.7 + Math.random() * 0.9, now, 0.12);
}

function startContinuousDistractionNoise() {
  if (!state.distractionNoisesEnabled || !state.distractionAudioContext) return;
  const audioContext = state.distractionAudioContext;
  if (audioContext.state === 'suspended') {
    audioContext.resume().then(startContinuousDistractionNoise).catch(() => {
      state.distractionNoisesEnabled = false;
    });
    return;
  }
  if (audioContext.state !== 'running' || state.distractionAudioSource) return;

  const samples = createDistractionSamples(audioContext.sampleRate);
  const buffer = audioContext.createBuffer(1, samples.length, audioContext.sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  source.loop = true;
  gain.gain.setValueAtTime(0.009, audioContext.currentTime);
  source.connect(gain).connect(audioContext.destination);
  source.start();
  source.addEventListener('ended', () => {
    if (state.distractionAudioSource === source) {
      state.distractionAudioSource = null;
      state.distractionAudioGain = null;
    }
  });
  state.distractionAudioSource = source;
  state.sessionNoiseStarted = true;
  audioContext.onstatechange = () => {
    if (state.sessionEvidence?.continuousNoise && !state.sessionEvidence.sessionCompletedAt
        && audioContext.state !== 'running') state.sessionEvidence.noiseMaintained = false;
  };
  state.distractionAudioGain = gain;
  varyContinuousDistractionNoise();
  state.distractionAudioLevelTimer = window.setInterval(varyContinuousDistractionNoise, 650);
}

function stopContinuousDistractionNoise() {
  state.distractionNoisesEnabled = false;
  if (state.distractionAudioLevelTimer !== null) window.clearInterval(state.distractionAudioLevelTimer);
  state.distractionAudioLevelTimer = null;
  const source = state.distractionAudioSource;
  const gain = state.distractionAudioGain;
  state.distractionAudioSource = null;
  state.distractionAudioGain = null;
  try {
    source?.stop();
  } catch {
    // The source may already have stopped while a browser is suspending audio.
  }
  source?.disconnect();
  gain?.disconnect();
}

function resetDistractionAudioSetup() {
  stopContinuousDistractionNoise();
  state.distractionNoisesEnabled = false;
  refs['distraction-noise-toggle'].checked = false;
  state.distractionAudioContext?.suspend().catch(() => undefined);
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

function builtInErrorDetectionPresets() {
  return Object.fromEntries(Object.keys(ERROR_DETECTION_MODE_CONFIG).map((level) => [level, resolveErrorDetectionDifficultyPreset(level)]));
}

function renderFraudCategorySettings() {
  refs['fraud-enabled-categories'].replaceChildren(...FRAUD_INSPECTION_CATEGORIES.map((category) => {
    const label = document.createElement('label');
    label.className = 'history-facet';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = category.id;
    input.checked = true;
    const text = document.createElement('span');
    text.textContent = category.label;
    label.append(input, text);
    return label;
  }));
}

function loadPresetState() {
  const presets = {
    cash: builtInCashPresets(),
    memory: builtInMemoryPresets(),
    task: builtInTaskPresets(),
    errorDetection: builtInErrorDetectionPresets(),
  };
  try {
    const saved = JSON.parse(localStorage.getItem(PRESET_KEY) ?? 'null');
    for (const level of Object.keys(DIFFICULTY_CONFIG)) {
      if (saved?.cash?.[level]) presets.cash[level] = resolveCashDifficultyPreset(level, saved.cash[level]);
      if (saved?.memory?.[level]) presets.memory[level] = resolveMemoryDifficultyPreset(level, saved.memory[level]);
      if (saved?.task?.[level]) presets.task[level] = resolveTaskDifficultyPreset(level, saved.task[level]);
      if (saved?.errorDetection?.[level]) presets.errorDetection[level] = resolveErrorDetectionDifficultyPreset(level, saved.errorDetection[level]);
    }
  } catch {
    // Keep the shipped presets if a browser has an old or invalid saved value.
  }
  return presets;
}

function persistPresetState() {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify({
      cash: state.cashPresets,
      memory: state.memoryPresets,
      task: state.taskPresets,
      errorDetection: state.errorDetectionPresets,
    }));
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

function errorDetectionFamilyLabel(family) {
  const labels = {
    'symbol-matrix': 'Visual symbol matrix',
    'number-machine': 'Number machine',
    'cipher-check': 'Cipher ring check',
    'logic-schedule': 'Logic schedule board',
    'route-network': 'Visual route network',
  };
  return labels[family] ?? PATTERN_GAME_NAMES[family] ?? 'Anomaly puzzle';
}

function nextErrorDetectionPuzzleFamily() {
  if (state.errorDetectionFamilyDeck.length === 0) {
    const deck = [...ERROR_DETECTION_PUZZLE_FAMILIES];
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
    state.errorDetectionFamilyDeck = deck;
  }
  return state.errorDetectionFamilyDeck.shift();
}

function isCompactViewport() {
  return window.matchMedia?.('(max-width: 64rem)').matches ?? false;
}

function showScreen(name) {
  refs['fraud-feedback'].hidden = name !== 'feedback' || state.game !== 'fraud-inspection';
  for (const screen of screens) refs[`${screen}-screen`].hidden = screen !== name;
  state.activeScreen = name;
  const activeScreen = refs[`${name}-screen`];
  if (isCompactViewport()) activeScreen.scrollIntoView({ block: 'start', inline: 'nearest' });
  const roundInProgress = ['quiz', 'memory-read', 'memory-answer', 'task-briefing', 'task-workspace', 'error-detection-briefing', 'error-detection', 'fraud-inspection'].includes(name);
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
  if (name === 'fraud-inspection') {
    window.setTimeout(() => refs['fraud-issue-list'].querySelector('button')?.focus({ preventScroll: true }), 0);
    return;
  }
  if (name === 'error-detection') {
    window.setTimeout(() => refs['error-detection-detail-list'].querySelector('button')?.focus({ preventScroll: true }), 0);
    return;
  }
  if (name === 'fraud-inspection') {
    window.setTimeout(() => refs['fraud-issue-list'].querySelector('button')?.focus({ preventScroll: true }), 0);
    return;
  }
  const heading = document.querySelector(`#${name}-screen h2`);
  if (heading) window.setTimeout(() => heading.focus({ preventScroll: true }), 0);
}

function getHistory(strict = false) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    if (!Array.isArray(history)) throw new Error('Saved history is not a list.');
    return history;
  } catch (error) {
    if (strict) throw error;
    return [];
  }
}

function loadCurrentChallenge() {
  try {
    const saved = JSON.parse(localStorage.getItem(CURRENT_CHALLENGE_KEY) ?? 'null');
    return saved && typeof saved === 'object' && typeof saved.id === 'string' && typeof saved.game === 'string' ? saved : null;
  } catch {
    return null;
  }
}

function saveCurrentChallenge(plan) {
  if (!plan?.id || !plan?.game || !plan?.difficulty) return;
  const compact = {
    id: plan.id, game: plan.game, difficulty: plan.difficulty, stage: plan.stage ?? 0,
    title: plan.title, target: plan.target, reason: plan.reason, basis: plan.basis,
    preset: plan.preset, focus: plan.focus, options: plan.options, axis: plan.axis,
    questionCount: plan.questionCount, weaknessKey: plan.weaknessKey,
  };
  try {
    localStorage.setItem(CURRENT_CHALLENGE_KEY, JSON.stringify(compact));
    state.currentChallenge = compact;
  } catch {
    setMessage('This browser could not save the current challenge. Your history is unchanged.');
  }
}

function clearCurrentChallenge() {
  localStorage.removeItem(CURRENT_CHALLENGE_KEY);
  state.currentChallenge = null;
  if (state.activeScreen === 'history') renderHistory();
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    setMessage('This browser could not save quiz history locally. Progress may be lost on refresh.');
    return false;
  }
}

function persistRecord(record) {
  if (!state.sessionEvidence || state.sessionEvidence.sessionId !== state.sessionId) {
    state.sessionEvidence = {
      sessionId: state.sessionId, evidenceVersion: 2, game: state.game,
      difficulty: state.difficulty, plannedQuestions: state.questionCount,
      sessionStartedAt: new Date().toISOString(), sessionCompletedAt: null,
      sessionElapsedSeconds: 0, autoContinue: state.autoContinue,
      continuousNoise: refs['distraction-noise-toggle'].checked,
      noiseMaintained: refs['distraction-noise-toggle'].checked && state.distractionNoisesEnabled,
      cashBuilder: state.game === 'cash' && state.cashBuilderEnabled,
      customerRequests: state.game === 'cash' && state.customerBillRequestsEnabled,
    };
    state.sessionEvidenceStarted = performance.now();
    state.sessionNoiseStarted = false;
  }
  const evidence = state.sessionEvidence;
  if (record.outcome !== 'Not answered' && (state.results.length === state.questionCount || state.fraudStoppedEarly)) {
    evidence.sessionCompletedAt = new Date().toISOString();
    evidence.sessionElapsedSeconds = (performance.now() - state.sessionEvidenceStarted) / 1000;
    evidence.noiseMaintained = evidence.noiseMaintained && state.sessionNoiseStarted
      && state.distractionAudioContext?.state === 'running';
  }
  const history = getHistory();
  const savedRecord = { ...record, ...evidence,
    settingsJson: JSON.stringify(sessionPreset()),
    ...(state.practicePlan ? { practicePlanJson: JSON.stringify({ ...state.practicePlan, evidence: [] }) } : {}),
  };
  const index = history.findIndex((saved) => saved?.sessionId === record.sessionId && saved?.questionNumber === record.questionNumber);
  if (index === -1) history.push(savedRecord);
  else history[index] = savedRecord;
  // Completion and captured settings belong to the session, including its earlier answers.
  if (evidence.sessionCompletedAt) {
    for (let i = 0; i < history.length; i += 1) {
      if (history[i]?.sessionId === record.sessionId) history[i] = { ...history[i], ...evidence };
    }
  }
  saveHistory(history);
}

function persistUnansweredRound(record) {
  // Checkpoint before interaction, so refresh/crash needs no unload handler.
  // Submission replaces this record; future rounds are never pre-created.
  persistRecord({ ...record, outcome: 'Not answered', userAnswer: '' });
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

function errorDetectionPresetDescription(level) {
  const preset = state.errorDetectionPresets[level];
  const defaults = ERROR_DETECTION_MODE_CONFIG[level];
  const defaultDescriptions = {
    Easy: '4 clues, one rule, up to 1 anomaly',
    Medium: '5 clues, two linked rules, up to 2 anomalies',
    Hard: '6 clues, three linked rules, up to 3 anomalies',
  };
  if (hasPresetValues(preset, defaults, ['details', 'maximumErrors', 'timeLimitSeconds'])) return defaultDescriptions[level];
  return `${preset.details} clues, up to ${preset.maximumErrors} anomalies, ${preset.timeLimitSeconds}s`;
}

function gameLabel(game) {
  if (game === 'cash') return 'cash handling';
  if (game === 'memory') return 'number memory';
  if (game === 'task') return 'task simulation';
  if (game === 'error-detection') return 'error detection puzzle';
  return 'check and ID fraud inspection';
}

function renderPresetEditor() {
  const game = selectedGame();
  const level = selectedDifficulty();
  if (game === 'fraud-inspection') {
    refs['preset-editor'].hidden = true;
    return;
  }
  refs['preset-editor'].hidden = false;
  const cashGame = game === 'cash';
  const memoryGame = game === 'memory';
  const errorDetectionGame = game === 'error-detection';
  refs['preset-level'].textContent = level;
  refs['preset-cash-fields'].hidden = !cashGame;
  refs['preset-memory-fields'].hidden = !memoryGame;
  refs['preset-task-fields'].hidden = game !== 'task';
  refs['preset-error-detection-fields'].hidden = !errorDetectionGame;

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

  if (errorDetectionGame) {
    const preset = state.errorDetectionPresets[level];
    refs['preset-error-detection-details'].value = String(preset.details);
    refs['preset-error-detection-errors'].value = String(preset.maximumErrors);
    refs['preset-error-detection-time'].value = String(preset.timeLimitSeconds);
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
  if (selectedDifficulty() === 'Custom' && game !== 'fraud-inspection') {
    document.querySelector('input[name="difficulty"][value="Easy"]').checked = true;
  }
  const memoryGame = game === 'memory';
  const taskGame = game === 'task';
  const errorDetectionGame = game === 'error-detection';
  const fraudGame = game === 'fraud-inspection';
  const difficulty = selectedDifficulty();
  refs['custom-difficulty-card'].hidden = !fraudGame;
  refs['cash-setup-options'].hidden = memoryGame || taskGame || errorDetectionGame || fraudGame;
  refs['memory-setup-options'].hidden = !memoryGame;
  refs['task-setup-options'].hidden = !taskGame;
  refs['error-detection-setup-options'].hidden = !errorDetectionGame;
  refs['fraud-setup-options'].hidden = !fraudGame;
  refs['fraud-custom-options'].hidden = !fraudGame || difficulty !== 'Custom';
  if (fraudGame) {
    const preset = resolveFraudInspectionSettings(difficulty === 'Custom' ? 'Medium' : difficulty);
    if (difficulty !== 'Custom') refs['fraud-time-limit'].value = String(preset.timeLimitSeconds);
    refs['fraud-question-count'].value = String(preset.questionCount);
  }
  const descriptions = Object.fromEntries(['Easy', 'Medium', 'Hard'].map((level) => [
    level,
    memoryGame
      ? memoryPresetDescription(level)
      : taskGame
        ? taskPresetDescription(level)
        : errorDetectionGame
          ? errorDetectionPresetDescription(level)
          : cashPresetDescription(level),
  ]));
  refs['easy-description'].textContent = descriptions.Easy;
  refs['medium-description'].textContent = descriptions.Medium;
  refs['hard-description'].textContent = descriptions.Hard;
  renderPresetEditor();
  renderPracticeRecommendations(document.getElementById('setup-recommendations'), game, selectedDifficulty());
  renderActivePractice();
}

function updateFraudRunModeControls() {
  const mode = refs['fraud-run-mode'].value;
  const lockedCount = mode === 'rapid-review' || mode === 'endurance';
  refs['fraud-question-count'].disabled = lockedCount;
  refs['fraud-time-limit'].disabled = mode === 'rapid-review';
  if (mode === 'rapid-review') {
    refs['fraud-question-count'].value = '10';
    refs['fraud-time-limit'].value = '15';
  } else if (mode === 'endurance') {
    refs['fraud-question-count'].value = '30';
  } else {
    if (refs['fraud-question-count'].value === '30') refs['fraud-question-count'].value = '10';
    if (refs['fraud-time-limit'].value === '15') {
      const selected = selectedDifficulty() === 'Custom' ? 'Medium' : selectedDifficulty();
      refs['fraud-time-limit'].value = String(resolveFraudInspectionSettings(selected).timeLimitSeconds);
    }
  }
}

function presetFor(game, difficulty) {
  const presets = { cash: state.cashPresets, memory: state.memoryPresets, task: state.taskPresets, 'error-detection': state.errorDetectionPresets };
  return presets[game][difficulty];
}

function sessionPreset() {
  if (state.game === 'fraud-inspection') return state.fraudSettings;
  return state.practicePlan?.preset ?? presetFor(state.game, state.difficulty);
}

function appendPracticeSettings(target, plan) {
  const list = document.createElement('dl');
  list.className = 'practice-settings';
  for (const [label, value] of practiceSettings(plan)) {
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    list.append(term, detail);
  }
  target.append(list);
}

function renderPracticeRecommendations(target, game, difficulty, history = getHistory()) {
  if (game === 'fraud-inspection') {
    const fraudSummary = summarizeFraudHistory(history);
    const summary = document.createElement('p');
    summary.className = 'practice-note';
    summary.textContent = fraudSummary.recommendedChallenge;
    target.replaceChildren(summary);
    return;
  }
  const result = recommendPractice(history, game, difficulty, presetFor(game, difficulty));
  target.replaceChildren();
  const summary = document.createElement('p');
  summary.className = 'practice-note';
  summary.textContent = `${result.message}${result.unanswered ? ` ${result.unanswered} unanswered rounds excluded from these recommendations.` : ''}`;
  target.append(summary);
  for (const plan of result.plans.slice(0, 1)) {
    const item = document.createElement('article');
    item.className = 'practice-recommendation';
    const title = document.createElement('h4');
    title.textContent = plan.title;
    const reason = document.createElement('p');
    reason.textContent = plan.reason;
    const progress = document.createElement('p');
    progress.className = 'practice-note';
    progress.textContent = plan.progressionRule;
    const review = document.createElement('details');
    const label = document.createElement('summary');
    label.textContent = 'Proposed settings and evidence';
    review.append(label);
    appendPracticeSettings(review, plan);
    const evidence = document.createElement('ul');
    evidence.className = 'practice-evidence';
    for (const row of plan.evidence) {
      const entry = document.createElement('li');
      const date = new Date(row.timestamp);
      entry.textContent = `${Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()} - round ${row.questionNumber ?? '?'} - ${row.outcome}`;
      evidence.append(entry);
    }
    review.append(evidence);
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'secondary-button';
    apply.textContent = 'Use practice plan';
    apply.addEventListener('click', () => applyPracticePlan(plan));
    item.append(title, reason, review, progress, apply);
    target.append(item);
  }
}

function renderActivePractice() {
  const panel = document.getElementById('active-practice');
  panel.hidden = !state.practicePlan;
  const content = document.getElementById('active-practice-settings');
  content.replaceChildren();
  if (!state.practicePlan) return;
  document.getElementById('active-practice-title').textContent = state.practicePlan.title;
  document.getElementById('active-practice-reason').textContent = state.practicePlan.reason;
  appendPracticeSettings(content, state.practicePlan);
}

function applyPracticePlan(plan) {
  resetDistractionAudioSetup();
  document.querySelector(`input[name="game"][value="${plan.game}"]`).checked = true;
  document.querySelector(`input[name="difficulty"][value="${plan.difficulty}"]`).checked = true;
  refs[plan.game === 'cash' ? 'question-count' : `${plan.game}-question-count`].value = String(plan.questionCount);
  refs['distraction-noise-toggle'].checked = plan.options.distraction;
  if (plan.game === 'cash') {
    refs['cash-builder-toggle'].checked = plan.options.cashBuilder;
    refs['customer-bill-request-toggle'].checked = plan.options.customerRequests;
    refs['time-limit'].value = String(plan.options.timeLimitSeconds);
    document.querySelector(`input[name="cashSessionMode"][value="${plan.options.cashSessionMode}"]`).checked = true;
  }
  state.practicePlan = plan;
  updateGameSetup();
  showScreen('setup');
  document.getElementById('active-practice').scrollIntoView({ block: 'nearest' });
  setMessage('Practice plan ready. Review the settings and start the quiz. Your saved presets are unchanged.');
}

function clearPracticePlan() {
  state.practicePlan = null;
  renderActivePractice();
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
  clearPracticePlan();
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
    } else if (game === 'task') {
      state.taskPresets[level] = resolveTaskDifficultyPreset(level, {
        minimumSteps: readPresetInteger(refs['preset-task-step-min'], 'Minimum steps'),
        maximumSteps: readPresetInteger(refs['preset-task-step-max'], 'Maximum steps'),
        rows: readPresetInteger(refs['preset-task-rows'], 'Rows'),
        tabs: readPresetInteger(refs['preset-task-tabs'], 'Tabs'),
        briefingSeconds: readPresetInteger(refs['preset-task-briefing-time'], 'Briefing seconds'),
        recallSeconds: readPresetInteger(refs['preset-task-recall-time'], 'Recall seconds'),
        demoStepMilliseconds: readPresetDemoMilliseconds(refs['preset-task-demo-speed']),
      });
    } else {
      state.errorDetectionPresets[level] = resolveErrorDetectionDifficultyPreset(level, {
        details: readPresetInteger(refs['preset-error-detection-details'], 'Details per card'),
        maximumErrors: readPresetInteger(refs['preset-error-detection-errors'], 'Maximum errors'),
        timeLimitSeconds: readPresetInteger(refs['preset-error-detection-time'], 'Seconds per round'),
      });
    }
    const saved = persistPresetState();
    updateGameSetup();
    refs['preset-editor'].open = true;
    if (saved) setMessage(`Saved the ${level} ${gameLabel(game)} preset on this device.`);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'The preset could not be saved.');
  }
}

function resetSelectedPreset() {
  clearPracticePlan();
  const level = selectedDifficulty();
  const game = selectedGame();
  if (game === 'cash') state.cashPresets[level] = resolveCashDifficultyPreset(level);
  else if (game === 'memory') {
    state.memoryPresets[level] = resolveMemoryDifficultyPreset(level);
  } else if (game === 'task') {
    state.taskPresets[level] = resolveTaskDifficultyPreset(level);
  } else {
    state.errorDetectionPresets[level] = resolveErrorDetectionDifficultyPreset(level);
  }
  const saved = persistPresetState();
  updateGameSetup();
  refs['preset-editor'].open = true;
  if (saved) setMessage(`Restored the normal ${level} ${gameLabel(game)} preset.`);
}

function resetAllPresets() {
  clearPracticePlan();
  state.cashPresets = builtInCashPresets();
  state.memoryPresets = builtInMemoryPresets();
  state.taskPresets = builtInTaskPresets();
  state.errorDetectionPresets = builtInErrorDetectionPresets();
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

function customerRequestHandlingText(request, score) {
  if (!request) return '';
  if (score.customerRequestFlagged) return 'Flagged as impossible';
  if (!request.isValid) return score.breakdownMatches ? 'Exact amount provided instead' : 'Not resolved';
  return score.customerRequestMatches ? 'Honored' : 'Not honored';
}

function updateCustomerBillRequestStatus() {
  const request = state.question?.customerBillRequest;
  if (!request) return;

  const flagged = Boolean(request.canFlag && state.customerRequestFlagged);
  refs['flag-bill-request'].setAttribute('aria-pressed', String(flagged));
  refs['flag-bill-request'].textContent = flagged ? 'Unflag request' : 'Flag impossible request';
  if (flagged) {
    refs['customer-bill-request-status'].textContent = 'Request flagged. Calculate the correct change; no cash selection is required for this invalid request.';
    return;
  }
  if (!request.isValid) {
    refs['customer-bill-request-status'].textContent = 'This request cannot be fulfilled as stated. Flag it or give the exact change with available bills and coins.';
    return;
  }
  const evaluation = evaluateCustomerBillRequest(request, selectedBreakdown());
  refs['customer-bill-request-status'].textContent = evaluation.matches
    ? 'Selected bills follow the customer request.'
    : 'Build the exact change while following the customer’s bill preference.';
}

function renderCustomerBillRequest() {
  const request = state.question?.customerBillRequest;
  refs['customer-bill-request'].hidden = !request;
  if (!request) return;
  refs['customer-bill-request-text'].textContent = request.text;
  refs['flag-bill-request'].hidden = !request.canFlag;
  updateCustomerBillRequestStatus();
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
  if (state.customerRequestFlagged && state.question?.customerBillRequest?.canFlag) {
    refs['builder-status'].textContent = 'The impossible request is flagged. You may submit after calculating the correct change.';
  } else if (!type) {
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
  updateCustomerBillRequestStatus();
}

function renderQuestion() {
  const question = state.question;
  state.customerRequestFlagged = false;
  refs['question-progress'].textContent = `Question ${state.questionNumber} of ${state.questionCount}`;
  refs['amount-due'].textContent = formatMoney(question.dueCents);
  refs['tender-breakdown'].textContent = question.breakdownText;
  refs['answer-form'].reset();
  refs['answer-amount'].disabled = true;
  refs['cash-builder-section'].hidden = !state.cashBuilderEnabled;
  resetBuilder();
  renderCustomerBillRequest();
  const panel = document.getElementById('cash-guidance');
  panel.replaceChildren();
  panel.hidden = state.cashSessionMode !== 'guided';
  if (!panel.hidden) {
    const guide = createCashGuidance(question);
    for (const [title, text] of [['Customer says', guide.customer], ['1. Count and compare', guide.calculation], ['2. Say to the customer', guide.say], ['3. Enter your answer', guide.answer], ['4. Handle the cash', [guide.request, guide.cash].filter(Boolean).join(' ')]]) {
      const heading = document.createElement('h3');
      heading.textContent = title;
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      panel.append(heading, paragraph);
    }
  }
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
  return {
    type,
    amountCents,
    breakdown: selectedBreakdown(),
    requestFlagged: state.customerRequestFlagged,
  };
}

function recordAnswer(answer, score, timedOut, elapsedSeconds) {
  const question = state.question;
  const selectedCash = answer?.breakdown ?? [];
  const customerRequest = question.customerBillRequest;
  const outcome = timedOut ? 'Timed Out' : score.correct ? 'Correct' : 'Incorrect';
  const declaredAmount = answer ? formatMoney(answer.amountCents) : '';
  const tenderBreakdown = question.breakdown.map(({ cents, category, count, singular, plural }) => ({ cents, category, count, singular, plural }));
  const tenderBillCount = tenderBreakdown.filter((item) => item.category === 'Bill').reduce((sum, item) => sum + item.count, 0);
  const tenderCoinCount = tenderBreakdown.filter((item) => item.category === 'Coin').reduce((sum, item) => sum + item.count, 0);
  const transactionType = question.expectedType;
  return {
    timestamp: new Date().toISOString(),
    sessionId: state.sessionId,
    gameType: 'Cash handling',
    sessionMode: state.cashSessionMode === 'guided' ? 'Guided practice' : 'Testing',
    difficulty: state.difficulty,
    questionNumber: state.questionNumber,
    answerMode: state.customerBillRequestsEnabled ? 'Cash builder + customer requests' : state.cashBuilderEnabled ? 'Cash builder' : 'Normal',
    timeLimitSeconds: state.timeLimitSeconds,
    timeUsedSeconds: Number(elapsedSeconds.toFixed(1)),
    amountDue: formatMoney(question.dueCents),
    amountDueCents: question.dueCents,
    cashGivenTotal: formatMoney(question.tenderedCents),
    cashGivenCents: question.tenderedCents,
    cashBreakdown: question.breakdownText,
    tenderBreakdown,
    tenderDenominationCounts: Object.fromEntries(tenderBreakdown.map((item) => [item.cents, item.count])),
    tenderBillCount,
    tenderCoinCount,
    tenderPieceCount: tenderBillCount + tenderCoinCount,
    tenderDenominationTypes: tenderBreakdown.length,
    cashTransactionType: transactionType,
    changeOrShortfallCents: question.expectedAmountCents,
    expectedAnswer: expectedAnswerText(question),
    recommendedBreakdown: formatBreakdown(customerRequest?.expectedBreakdown ?? buildBreakdown(question.expectedAmountCents)),
    userAnswer: answer?.type ?? '',
    userDeclaredAmount: declaredAmount,
    userDeclaredAmountCents: answer?.amountCents ?? 0,
    userCashTotal: state.cashBuilderEnabled ? formatMoney(score.cashTotalCents) : '',
    userCashTotalCents: state.cashBuilderEnabled ? score.cashTotalCents : 0,
    userCashBreakdown: state.cashBuilderEnabled ? formatBreakdown(selectedCash) : '',
    breakdownMatchesDeclaredAmount: score.breakdownMatches,
    customerBillRequest: customerRequest?.text ?? '',
    customerBillRequestKind: customerRequest?.kind ?? '',
    customerBillRequestHandling: customerRequestHandlingText(customerRequest, score),
    customerRequestResult: customerRequest ? (score.customerRequestMatches ? 'Handled' : 'Not handled') : 'Not requested',
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
    ['Example breakdown', record.recommendedBreakdown],
    ['Time used', `${record.timeUsedSeconds.toFixed(1)} seconds`],
  ];
  if (question.customerBillRequest) details.splice(2, 0,
    ['Customer request', record.customerBillRequest],
    ['Request handling', record.customerBillRequestHandling],
  );
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
  const elapsedSeconds = Math.max(0, (Date.now() - state.cashQuestionStartedAt) / 1000);
  const score = timedOut
    ? { correct: false, breakdownMatches: false, cashTotalCents: 0 }
    : scoreAnswer(state.question, answer, state.cashBuilderEnabled, state.question.customerBillRequest);
  const record = recordAnswer(answer, score, timedOut, elapsedSeconds);
  state.results.push(record);
  persistRecord(record);
  if (state.results.length === state.questionCount) stopContinuousDistractionNoise();
  if (state.autoContinue) {
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
  state.question = createQuestion(state.difficulty, Math.random, sessionPreset(), { customerBillRequests: state.customerBillRequestsEnabled, ...state.practicePlan?.focus });
  persistUnansweredRound(recordAnswer(null, { correct: false, breakdownMatches: false, cashTotalCents: 0 }, false, 0));
  state.answerSubmitted = false;
  renderQuestion();
  showScreen('quiz');
  state.cashQuestionStartedAt = Date.now();
  startOptionalTimer(state.timeLimitSeconds, refs.timer, () => submitCurrentAnswer(true));
  startContinuousDistractionNoise();
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
  const expectedValues = [...challenge.values];
  const normalizedAnswer = answer.map((value) => String(value ?? '').replaceAll(/\s/g, ''));
  const mismatchPositions = [];
  let correctValueCount = 0;
  expectedValues.forEach((expected, index) => {
    const received = normalizedAnswer[index] ?? '';
    if (expected === received) correctValueCount += 1;
    const expectedDigits = expected.replace('.', '');
    const receivedDigits = received.replace('.', '');
    for (let position = 0; position < expectedDigits.length; position += 1) {
      if (expectedDigits[position] !== receivedDigits[position]) mismatchPositions.push(position + 1);
    }
  });
  return {
    timestamp: new Date().toISOString(),
    sessionId: state.sessionId,
    gameType: 'Number memory',
    difficulty: state.difficulty,
    questionNumber: state.questionNumber,
    valueCount: challenge.valueCount,
    expectedValues,
    answeredValues: [...answer],
    digitsByValue: [...challenge.digitsByValue],
    totalDigits: challenge.digitsByValue.reduce((sum, digits) => sum + digits, 0),
    decimalMode: challenge.values.some((value) => value.includes('.')),
    digitsPerValue: `${challenge.minimumDigits}–${challenge.maximumDigits}`,
    readTimeSeconds: challenge.readSeconds,
    writeTimeSeconds: challenge.writeSeconds,
    timeUsedSeconds: Number(elapsedSeconds.toFixed(1)),
    answerDurationSeconds: Number(elapsedSeconds.toFixed(1)),
    correctValueCount,
    mismatchPositions: [...new Set(mismatchPositions)],
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
  if (state.results.length === state.questionCount) stopContinuousDistractionNoise();
  if (state.autoContinue) {
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
  state.memoryChallenge = createMemoryChallenge(state.difficulty, sessionPreset());
  persistUnansweredRound(recordMemoryAnswer([], { correct: false }, false, 0));
  state.answerSubmitted = false;
  refs['memory-read-progress'].textContent = `Round ${state.questionNumber} of ${state.questionCount}`;
  renderMemoryReadValues(state.memoryChallenge);
  refs['memory-read-hint'].textContent = `${state.memoryChallenge.valueCount} value${state.memoryChallenge.valueCount === 1 ? '' : 's'} in order · ${state.memoryChallenge.minimumDigits}–${state.memoryChallenge.maximumDigits} digits each${state.memoryChallenge.decimals ? ' · decimal points included' : ''}`;
  showScreen('memory-read');
  startTimer(state.memoryChallenge.readSeconds, refs['memory-read-timer'], showMemoryAnswer);
  startContinuousDistractionNoise();
}

function detailsForErrorIds(ids) {
  const selected = new Set(ids);
  return state.errorDetectionChallenge.details.filter((detail) => selected.has(detail.id));
}

function describeErrorDetails(ids, showExpected = false) {
  const details = detailsForErrorIds(ids);
  if (details.length === 0) return 'No anomalies.';
  return details.map((detail) => `${detail.label}: ${showExpected ? detail.expectedValue : detail.value}`).join(' · ');
}

function updateErrorDetectionSelection() {
  const selectedCount = state.errorDetailSelections.size;
  refs['error-detection-selection-status'].textContent = selectedCount
    ? `${selectedCount} clue${selectedCount === 1 ? '' : 's'} marked anomalous.`
    : refs['error-detection-no-errors'].checked
      ? 'This puzzle is marked as having no anomalies.'
      : 'No clues marked.';
  for (const button of refs['error-detection-detail-list'].querySelectorAll('button')) {
    const selected = state.errorDetailSelections.has(button.dataset.detailId);
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('.error-detection-detail-status').textContent = selected ? 'Marked anomaly' : 'Mark if anomalous';
  }
}

function toggleErrorDetail(detailId) {
  if (state.errorDetailSelections.has(detailId)) state.errorDetailSelections.delete(detailId);
  else state.errorDetailSelections.add(detailId);
  if (state.errorDetailSelections.size > 0) refs['error-detection-no-errors'].checked = false;
  updateErrorDetectionSelection();
}

function selectedErrorDetailIds() {
  return state.errorDetectionChallenge.details
    .filter((detail) => state.errorDetailSelections.has(detail.id))
    .map((detail) => detail.id);
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [attribute, value] of Object.entries(attributes)) element.setAttribute(attribute, String(value));
  return element;
}

function renderErrorDetectionVisual(visual) {
  if (!visual) return null;
  if (visual.type === 'symbol') {
    const symbol = document.createElement('span');
    symbol.className = 'puzzle-visual puzzle-visual-symbol';
    symbol.dataset.shape = visual.shape;
    symbol.dataset.color = visual.color;
    symbol.dataset.fill = visual.fill;
    symbol.setAttribute('role', 'img');
    symbol.setAttribute('aria-label', visual.ariaLabel);
    const glyph = document.createElement('span');
    glyph.className = 'puzzle-symbol-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    symbol.append(glyph);
    return symbol;
  }
  if (visual.type === 'route') {
    const positions = {
      A: [50, 9], B: [82, 27], C: [82, 63], D: [50, 81], E: [18, 63], F: [18, 27],
    };
    const svg = svgElement('svg', {
      class: 'puzzle-visual puzzle-visual-route', viewBox: '0 0 100 90', role: 'img', 'aria-label': visual.ariaLabel,
    });
    const ring = [...visual.path, visual.path[0]];
    svg.append(svgElement('polyline', {
      class: 'puzzle-route-ring', points: [...Object.values(positions), positions.A].map((point) => point.join(',')).join(' '),
    }));
    for (let index = 0; index < visual.path.length - 1; index += 1) {
      const from = positions[visual.path[index]];
      const to = positions[visual.path[index + 1]];
      svg.append(svgElement('line', {
        class: 'puzzle-route-active', x1: from[0], y1: from[1], x2: to[0], y2: to[1],
      }));
    }
    for (const [label, point] of Object.entries(positions)) {
      const active = ring.includes(label);
      svg.append(svgElement('circle', {
        class: active ? 'puzzle-route-node is-active' : 'puzzle-route-node', cx: point[0], cy: point[1], r: 7,
      }));
      const text = svgElement('text', { class: 'puzzle-route-label', x: point[0], y: point[1] + 3, 'text-anchor': 'middle' });
      text.textContent = label;
      svg.append(text);
    }
    return svg;
  }
  return null;
}

function createErrorDetectionExampleCase(example, variant) {
  const caseCard = document.createElement('div');
  const heading = document.createElement('strong');
  const visual = renderErrorDetectionVisual(example.visual);
  const value = document.createElement('span');
  caseCard.className = `error-detection-example-case ${variant}`;
  heading.textContent = example.label;
  value.className = 'error-detection-example-value';
  value.textContent = example.value;
  caseCard.append(heading);
  if (visual) caseCard.append(visual);
  caseCard.append(value);
  return caseCard;
}

function renderErrorDetectionBriefing(challenge) {
  refs['error-detection-briefing-progress'].textContent = `Round ${state.questionNumber} of ${state.questionCount}`;
  refs['error-detection-briefing-family'].textContent = errorDetectionFamilyLabel(challenge.family);
  refs['error-detection-briefing-title'].textContent = challenge.title;
  refs['error-detection-briefing-overview'].textContent = challenge.briefing.overview;
  refs['error-detection-rule-steps'].replaceChildren(...challenge.briefing.ruleSteps.map((step) => {
    const item = document.createElement('li');
    item.textContent = step;
    return item;
  }));
  const examples = document.createElement('div');
  const explanation = document.createElement('p');
  examples.className = 'error-detection-example-cases';
  examples.append(
    createErrorDetectionExampleCase(challenge.briefing.example.valid, 'is-valid'),
    createErrorDetectionExampleCase(challenge.briefing.example.anomaly, 'is-anomaly'),
  );
  explanation.className = 'error-detection-example-explanation';
  explanation.textContent = challenge.briefing.example.explanation;
  refs['error-detection-example'].replaceChildren(examples, explanation);
}

function showErrorDetectionBriefing() {
  renderErrorDetectionBriefing(state.errorDetectionChallenge);
  showScreen('error-detection-briefing');
}

function renderErrorDetectionCard(challenge) {
  refs['error-detection-progress'].textContent = `Round ${state.questionNumber} of ${state.questionCount}`;
  refs['error-detection-title'].textContent = challenge.title;
  refs['error-detection-puzzle-family'].textContent = errorDetectionFamilyLabel(challenge.family);
  refs['error-detection-puzzle-legend'].textContent = challenge.puzzle.legend;
  refs['error-detection-detail-list'].dataset.puzzleType = challenge.puzzle.type;
  state.errorDetailSelections = new Set();
  refs['error-detection-no-errors'].checked = false;
  refs['error-detection-detail-list'].replaceChildren(...challenge.details.map((detail) => {
    const button = document.createElement('button');
    const content = document.createElement('span');
    const copy = document.createElement('span');
    const label = document.createElement('span');
    const value = document.createElement('span');
    const status = document.createElement('span');
    button.className = 'error-detection-detail';
    button.type = 'button';
    button.dataset.detailId = detail.id;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${detail.label}: ${detail.value}. Mark this clue if it is anomalous.`);
    content.className = 'error-detection-detail-content';
    copy.className = 'error-detection-detail-copy';
    label.className = 'error-detection-detail-label';
    label.textContent = detail.label;
    value.className = 'error-detection-detail-value';
    value.textContent = detail.value;
    status.className = 'error-detection-detail-status';
    const visual = renderErrorDetectionVisual(detail.visual);
    copy.append(label, value);
    if (visual) content.append(visual);
    content.append(copy);
    button.append(content, status);
    button.addEventListener('click', () => toggleErrorDetail(detail.id));
    return button;
  }));
  updateErrorDetectionSelection();
}

function recordErrorDetectionAttempt(score, timedOut, elapsedSeconds) {
  const challenge = state.errorDetectionChallenge;
  const expectedDetails = detailsForErrorIds(score.expectedErrorIds);
  const selectedDetails = detailsForErrorIds(score.selectedDetailIds);
  return {
    timestamp: new Date().toISOString(),
    sessionId: state.sessionId,
    gameType: 'Error detection',
    difficulty: state.difficulty,
    questionNumber: state.questionNumber,
    scenario: challenge.title,
    puzzleFamily: errorDetectionFamilyLabel(challenge.family),
    puzzleFamilyId: challenge.family,
    puzzleType: challenge.puzzle.visual ? 'Visual' : 'Analytical',
    ruleLayers: challenge.ruleLayers,
    rule: challenge.rule,
    detailCount: challenge.detailsCount,
    expectedErrorCount: score.errorCount,
    selectedErrorCount: score.selectedDetailIds.length,
    correctlyFlagged: score.correctlyFlagged,
    missedAnomalyCount: score.missedErrorIds.length,
    falseFlagCount: score.falseFlagIds.length,
    cleanPuzzle: score.errorCount === 0,
    missedErrors: describeErrorDetails(score.missedErrorIds, true),
    falseFlags: describeErrorDetails(score.falseFlagIds),
    timeLimitSeconds: challenge.timeLimitSeconds,
    timeUsedSeconds: Number(elapsedSeconds.toFixed(1)),
    expectedAnswer: expectedDetails.length
      ? expectedDetails.map((detail) => `${detail.label} should be ${detail.expectedValue}`).join(' · ')
      : 'No anomalies.',
    userAnswer: selectedDetails.length ? describeErrorDetails(score.selectedDetailIds) : 'No clues marked.',
    outcome: timedOut ? 'Timed Out' : score.correct ? 'Correct' : 'Incorrect',
  };
}

function populateErrorDetectionFeedback(record, score) {
  const correct = score.correct;
  refs['feedback-kicker'].textContent = record.outcome === 'Timed Out' ? 'Time expired' : 'Puzzle result';
  refs['feedback-heading'].textContent = correct ? 'Correct' : record.outcome === 'Timed Out' ? 'Time expired' : 'Not quite';
  refs['feedback-heading'].dataset.result = correct ? 'correct' : 'incorrect';
  refs['feedback-lead'].textContent = correct
    ? 'You pinpointed every anomaly and left the valid clues alone.'
    : score.errorCount === 0
      ? 'This was a clean puzzle: no clues violated the rule.'
      : 'Review the missed anomalies and any valid clues that were marked.';
  const details = [
    ['Puzzle', record.scenario],
    ['Family', record.puzzleFamily],
    ['Your marks', record.userAnswer],
    ['Correct marks', record.expectedAnswer],
    ['Correctly marked', `${record.correctlyFlagged} of ${record.expectedErrorCount}`],
    ['Missed anomalies', record.missedErrors],
    ['False marks', record.falseFlags],
    ['Time used', `${record.timeUsedSeconds.toFixed(1)} seconds`],
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

function submitErrorDetectionAttempt(timedOut = false) {
  if (state.answerSubmitted) return;
  if (!timedOut && state.errorDetailSelections.size === 0 && !refs['error-detection-no-errors'].checked) {
    setMessage('Mark an anomalous clue or choose No anomalies before submitting.');
    refs['error-detection-no-errors'].focus();
    return;
  }
  state.answerSubmitted = true;
  const elapsedSeconds = Math.min(
    state.errorDetectionChallenge.timeLimitSeconds,
    Math.max(0, (Date.now() - state.errorDetectionStartedAt) / 1000),
  );
  stopTimer();
  const score = scoreErrorDetectionAttempt(state.errorDetectionChallenge, selectedErrorDetailIds(), timedOut);
  const record = recordErrorDetectionAttempt(score, timedOut, elapsedSeconds);
  state.results.push(record);
  persistRecord(record);
  if (state.results.length === state.questionCount) stopContinuousDistractionNoise();
  if (state.autoContinue) {
    showNextErrorDetectionQuestion();
    return;
  }
  populateErrorDetectionFeedback(record, score);
  showScreen('feedback');
}

function showNextErrorDetectionQuestion() {
  state.questionNumber += 1;
  if (state.questionNumber > state.questionCount) {
    renderSummary();
    showScreen('summary');
    return;
  }
  state.errorDetectionChallenge = createErrorDetectionChallenge(state.difficulty, {
    ...sessionPreset(),
    puzzleFamily: state.practicePlan?.focus.puzzleFamily ?? nextErrorDetectionPuzzleFamily(),
  });
  state.answerSubmitted = false;
  state.errorDetectionStartedAt = 0;
  persistUnansweredRound(recordErrorDetectionAttempt(scoreErrorDetectionAttempt(state.errorDetectionChallenge, [], true), false, 0));
  showErrorDetectionBriefing();
}

function startErrorDetectionPuzzle() {
  if (!state.errorDetectionChallenge || state.answerSubmitted) return;
  renderErrorDetectionCard(state.errorDetectionChallenge);
  showScreen('error-detection');
  state.errorDetectionStartedAt = Date.now();
  startTimer(state.errorDetectionChallenge.timeLimitSeconds, refs['error-detection-timer'], () => submitErrorDetectionAttempt(true));
  startContinuousDistractionNoise();
}

function escapeSvgText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function svgText(x, y, value, size = 16, weight = 500, color = '#253236', extra = '') {
  return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="' + weight
    + '" fill="' + color + '" ' + extra + '>' + escapeSvgText(value) + '</text>';
}

function markedRegion(challenge, region) {
  return challenge.document.issueRegions.includes(region) ? 'fraud-marked' : '';
}

function svgField(challenge, region, x, y, width, label, value, options = {}) {
  const height = options.height ?? 58;
  const ink = challenge.document.palette.ink;
  const accent = challenge.document.palette.accent;
  const groupClass = markedRegion(challenge, region);
  const memoColor = challenge.check.memoInk === 'blue-bold' ? '#245f94'
    : challenge.check.memoInk === 'violet-fine' ? '#665085' : ink;
  const memoStyle = challenge.check.memoHandwriting
    ? 'font-family="cursive" font-style="italic" font-weight="750"'
    : '';
  const text = options.signature
    ? signatureSvgText(value, options.variation, x + 12, y + height - 12, options.ink ?? accent, width - 24)
    : svgText(x + 12, y + height - 13, value, options.valueSize ?? 17, options.weight ?? 650,
      region === 'check-memo' ? memoColor : ink, region === 'check-memo' ? memoStyle : '');
  const alteration = challenge.check.alterationMarks.find((item) =>
    (item.field === 'amount' ? 'check-numeric-amount' : 'check-' + item.field) === region);
  const subtleAlteration = challenge.settings.alterationSubtlety === 'hard';
  const patch = alteration
    ? '<path d="M' + (x + width - (subtleAlteration ? 104 : 136)) + ' ' + (y + 17) + 'h'
      + (subtleAlteration ? 46 : 77) + 'l-8 18h-' + (subtleAlteration ? 44 : 75) + 'z" fill="#fffef8" opacity=".96"/>'
      + '<path d="M' + (x + width - (subtleAlteration ? 109 : 141)) + ' ' + (y + 13) + 'l'
      + (subtleAlteration ? 53 : 83) + ' 1m-' + (subtleAlteration ? 48 : 78) + ' 25 '
      + (subtleAlteration ? 39 : 69) + ' -2" stroke="#a48763" stroke-width=".8" opacity="' + (subtleAlteration ? '.42' : '.72') + '"/>'
    : '';
  const idPatch = challenge.id.alterationMarks.length && region === 'id-address'
    ? '<path d="M' + (x + width - 105) + ' ' + (y + 18) + 'h59v16h-59z" fill="#fffef8" opacity=".92"/>'
      + '<path d="M' + (x + width - 109) + ' ' + (y + 15) + 'l67 0" stroke="#8a765a" stroke-width=".8" opacity=".7"/>'
    : '';
  return '<g class="fraud-doc-field ' + groupClass + '" data-region="' + region + '">'
    + '<rect class="fraud-field-bg" x="' + x + '" y="' + y + '" width="' + width + '" height="' + height
    + '" rx="4" fill="#ffffff" fill-opacity=".42" stroke="' + challenge.document.palette.rule + '"/>'
    + svgText(x + 12, y + 17, label, 10, 750, accent, 'letter-spacing="1"')
    + patch + idPatch + text + '</g>';
}

const SIGNATURE_GLYPHS = {
  A: [27, 'M0 1 C6-2 8-23 16-29 C24-35 26-22 19-12 C13-4 7-1 7 3 C8 6 19 2 27-3 M8-13 Q15-11 22-10'],
  B: [25, 'M0 1 C7-1 6-17 7-28 C8-35 14-34 19-29 C24-23 14-17 8-14 C5-12 9-12 14-12 C25-12 25-4 19 1 C13 5 5 3 0 1'],
  C: [27, 'M1 0 C8-2 20-4 24-17 C28-29 18-33 11-26 C4-19 3-4 10 1 C16 5 22 1 27-3'],
  D: [27, 'M0 1 C7-1 7-16 7-28 C8-34 15-34 21-28 C30-19 23-4 15 1 C10 4 4 3 0 1'],
  E: [24, 'M1 1 C8-1 8-17 9-28 C10-34 15-32 19-29 C22-27 18-23 14-22 C10-21 7-19 9-16 C11-13 18-15 21-12 C24-9 17-8 13-7 C7-5 6 1 12 2 C17 3 21 0 24-2'],
  F: [24, 'M0 1 C7-1 8-19 9-29 C10-35 16-34 20-30 C23-27 18-24 14-22 C10-20 8-18 9-15 C12-11 18-15 22-13 M7-15 Q14-14 22-12'],
  G: [28, 'M2 0 C9-2 20-3 24-17 C28-29 18-33 11-26 C4-19 3-4 10 1 C16 5 24 1 27-4 C29-7 24-9 20-8 C17-7 19-3 25-2'],
  H: [29, 'M0 1 C7-1 7-17 8-29 C9-35 14-34 15-28 C15-21 11-8 10-1 C10 4 16 2 21-3 C25-7 24-13 25-22 C26-31 31-32 31-24 C31-14 26-5 22 0 C18 5 13 3 10-1'],
  I: [17, 'M1 1 C7-3 8-17 9-27 C10-34 15-33 14-26 C13-16 9-3 12 1 C13 3 16 1 18-1'],
  J: [21, 'M4-3 C7-10 9-23 10-30 C11-36 16-34 15-27 C14-17 11-4 7 4 C3 12-5 11-6 6 C-7 2-3 0 1 1'],
  K: [27, 'M0 1 C7-1 7-17 8-29 C9-35 14-34 14-27 C14-20 10-7 10-1 C10 3 18-4 23-11 C27-17 23-19 19-15 C15-11 20-3 28 1'],
  L: [21, 'M1 1 C7-1 8-18 9-29 C10-36 15-34 14-26 C13-15 8-3 11 1 C13 4 18 0 22-3'],
  M: [35, 'M0 1 C6-1 6-17 7-27 C8-34 13-34 15-27 C17-19 16-10 17-8 C18-8 22-26 26-30 C30-34 33-29 31-22 C28-11 25-2 28 1 C30 3 35-1 38-4'],
  N: [30, 'M0 1 C7-1 7-17 8-28 C9-35 14-34 16-27 C18-20 15-9 16-7 C18-7 23-26 28-30 C32-33 35-29 32-21 C29-12 25-3 28 1 C30 3 34 0 37-3'],
  O: [29, 'M1 0 C6-6 7-20 13-28 C19-35 27-31 26-22 C24-11 15 1 8 3 C2 4-2-1 1-7'],
  P: [25, 'M0 1 C7-1 7-17 8-29 C9-35 14-34 19-30 C25-25 20-17 13-13 C9-11 7-10 8-7'],
  Q: [30, 'M1 0 C6-6 7-20 13-28 C19-35 27-31 26-22 C24-11 15 1 8 3 C2 4-2-1 1-7 M18-5 C21 0 26 4 31 5'],
  R: [27, 'M0 1 C7-1 7-17 8-29 C9-35 14-34 19-30 C25-25 20-17 13-13 C9-11 7-10 8-7 C10-2 18-7 25 1'],
  S: [25, 'M22-28 C16-34 8-29 9-23 C10-18 21-15 21-9 C21-2 12 4 5 2 C1 1 0-2 2-4'],
  T: [24, 'M1-15 Q11-17 23-14 M3 1 C10-2 10-18 11-29 C12-35 17-34 16-27 C15-16 12-3 15 1 C17 4 22 0 25-3'],
  U: [29, 'M5-28 C7-34 12-33 12-26 C12-15 7-1 13 2 C18 5 23-5 25-17 C26-25 26-32 31-31 C36-30 31-14 27-4 C24 4 17 7 12 2'],
  V: [29, 'M3-28 C5-34 10-33 10-26 C10-16 8-2 13 1 C17 4 22-10 25-22 C27-31 32-32 32-25 C31-15 25-2 19 2 C12 7 8 2 8-7'],
  W: [38, 'M2-28 C4-34 9-33 9-26 C9-16 7-2 12 1 C16 4 20-9 22-17 C23-22 27-21 27-16 C26-7 23-1 27 1 C31 4 35-11 38-23 C40-31 45-31 44-23 C42-12 36 1 29 3 C23 5 21 0 22-7'],
  X: [27, 'M2-28 C4-34 9-32 10-26 C12-16 17-6 22 0 C25 4 30 1 31-4 M27-30 C24-21 17-12 10-5 C5 0 2 3-2 2'],
  Y: [29, 'M3-28 C5-34 10-33 10-26 C10-17 8-6 12-5 C17-4 21-15 24-25 C26-33 31-32 31-25 C30-17 23 0 17 9 C12 17 4 15 4 9 C4 5 9 3 14 5'],
  Z: [27, 'M3-27 C9-32 20-32 25-29 C28-27 23-21 18-16 C12-10 6-4 7-1 C8 3 20 0 27-4'],
  a: [22, 'M0 0 C3-1 5-12 10-13 C17-14 16-3 11 0 C6 3 4-6 9-9 C14-12 18-3 22 0'],
  b: [21, 'M0 0 C5-1 5-17 6-28 C7-34 12-33 13-28 C14-21 8-13 4-8 C1-4 3 1 8 1 C14 1 17-4 21-1'],
  c: [20, 'M0 0 C4-1 6-10 12-12 C17-14 20-10 16-8 C10-5 4-5 4 0 C5 3 13 2 20-1'],
  d: [22, 'M0 0 C4-1 5-10 10-12 C16-14 16-4 11 0 C6 3 4-6 10-9 C15-12 19-5 18-1 C17-12 19-25 20-31 C21-36 26-34 24-27 C22-16 19-4 22 0'],
  e: [20, 'M0 0 C4-1 6-10 11-12 C16-14 18-10 14-8 C10-6 5-6 5-2 C5 3 13 2 20-2'],
  f: [18, 'M0 1 C6-2 9-14 11-26 C12-34 17-35 16-29 C14-18 9-2 12 7 C14 13 20 8 22 3 M4-12 Q12-14 21-12'],
  g: [22, 'M0 0 C4-1 5-10 10-12 C16-14 16-4 11 0 C6 3 4-6 10-9 C15-12 19-5 17 2 C15 10 9 16 4 13 C0 11 3 7 9 7 C15 7 19 3 22-1'],
  h: [22, 'M0 0 C5-1 6-17 7-28 C8-34 13-33 13-27 C12-17 8-5 9-1 C10 3 15-9 19-11 C23-13 24-7 22-2 C21 2 24 2 27-1'],
  i: [12, 'M0 0 C4-1 5-7 7-12 C9-16 13-14 11-9 C9-4 8-1 11 0 C13 1 15-1 17-3 M8-22 Q9-24 10-22'],
  j: [14, 'M1 0 C5-2 7-9 9-13 C11-17 15-15 13-10 C11-5 9 2 6 9 C3 16-4 15-4 10 C-4 7 0 5 4 6 M10-22 Q11-24 12-22'],
  k: [21, 'M0 0 C5-1 6-17 7-28 C8-34 13-33 13-27 C12-17 8-4 9-1 C10 3 17-11 21-12 C24-12 21-7 17-4 C13-1 16 1 22 1'],
  l: [13, 'M0 0 C6-2 8-18 9-29 C10-36 15-34 14-27 C13-16 9-4 12-1 C14 1 17-1 19-3'],
  m: [31, 'M0 0 C4-1 5-7 8-12 C11-16 15-12 13-7 C12-3 10 1 13 1 C16 1 19-10 23-12 C27-14 28-8 26-3 C25 1 27 2 30-1 C33-5 36-12 40-12 C44-12 42-5 40-1 C39 2 42 2 45-1'],
  n: [22, 'M0 0 C4-1 5-7 8-12 C11-16 15-12 13-7 C12-3 10 1 13 1 C17 1 20-10 24-12 C28-14 28-7 26-2 C25 2 28 2 31-1'],
  o: [21, 'M1 0 C5-2 7-11 13-13 C18-14 19-9 16-5 C12 0 5 4 2 1 C-1-2 4-9 10-12 C15-14 19-5 23 0'],
  p: [21, 'M0 0 C4-1 5-8 8-12 C11-16 16-13 14-8 C12-3 6 0 5 2 C4 8 3 15 2 20 C1 26-4 27-4 21 C-3 13 1 2 4-6'],
  q: [22, 'M0 0 C4-1 5-8 9-12 C13-16 17-12 14-7 C11-2 6 1 4-1 C0-4 6-11 11-13 C17-15 20-5 18 5 C17 12 15 20 14 25 C13 30 8 30 9 24 C10 16 14 5 18-4'],
  r: [17, 'M0 0 C4-1 5-8 8-12 C11-16 15-12 13-8 C12-5 10-2 13-3 C17-5 18-11 23-12 C27-13 27-7 24-4'],
  s: [18, 'M15-12 C9-16 3-10 7-6 C11-2 18-3 16 2 C14 7 4 4 1 1'],
  t: [17, 'M0 0 C5-1 7-13 9-25 C10-32 15-32 14-25 C13-16 9-3 13 0 C15 2 18 0 21-3 M4-11 Q12-13 20-11'],
  u: [22, 'M0 0 C4-2 7-11 10-13 C14-15 16-10 13-5 C10 0 9 3 13 1 C17-1 20-11 24-12 C28-13 26-5 25-1 C24 2 27 2 30-1'],
  v: [21, 'M0 0 C4-2 7-11 10-13 C14-15 15-9 12-4 C10 0 12 2 16-1 C21-6 22-14 27-13 C32-12 27-3 24 0'],
  w: [30, 'M0 0 C4-2 7-11 10-13 C14-15 15-9 12-4 C10 0 12 2 16-1 C20-5 22-14 26-13 C30-12 26-4 25-1 C24 2 27 2 31-2 C35-7 36-14 40-13 C44-12 39-2 36 1'],
  x: [20, 'M0 0 C5-4 13-11 18-13 C21-14 19-9 15-6 C10-2 6 1 9 2 C12 3 17-2 22-5 M4-12 C8-6 14-1 19 1'],
  y: [21, 'M0 0 C4-2 7-11 10-13 C14-15 15-9 12-4 C10 0 12 2 16-1 C21-6 22-14 27-13 C32-12 26 3 20 12 C16 18 9 16 10 11 C11 7 17 5 23 5'],
  z: [19, 'M2-11 C7-14 14-14 18-12 C20-11 16-7 12-4 C7 0 5 2 9 2 C13 2 18-1 22-4'],
  '.': [8, 'M2 1 Q3 2 4 1'],
  "'": [7, 'M3-23 Q5-27 6-29'],
  '-': [12, 'M2-6 Q8-8 14-7'],
};

function signatureSvgText(value, variation, x, y, color, maxWidth = 480) {
  const style = variation ?? { style: 1, size: 24, slant: -2, spacing: 0 };
  const text = String(value ?? '').trim();
  const spacing = Number(style.spacing) || 0;
  const letters = [];
  let naturalWidth = 0;
  for (const [index, character] of Array.from(text).entries()) {
    if (character === ' ') {
      letters.push({ space: true, index });
      naturalWidth += 11 + spacing;
      continue;
    }
    const [advance, path] = SIGNATURE_GLYPHS[character] ?? SIGNATURE_GLYPHS[character.toLowerCase()] ?? SIGNATURE_GLYPHS.n;
    letters.push({ character, advance, path, index, x: naturalWidth });
    naturalWidth += advance + spacing;
  }
  const flourish = style.style % 2 === 0;
  const flourishWidth = flourish ? 25 : 0;
  const scale = Math.min((Number(style.size) || 24) / 27, maxWidth / Math.max(1, naturalWidth + flourishWidth));
  const skew = Math.max(-9, Math.min(2, -4 - (Number(style.slant) || 0) * 0.45));
  const stroke = (2.05 + (style.style % 3) * 0.16).toFixed(2);
  let previous = null;
  const strokes = letters.map((letter) => {
    if (letter.space) {
      previous = null;
      return '';
    }
    const jitter = ((style.style + letter.index * 3) % 5 - 2) * 0.65;
    const rotation = ((style.style * 5 + letter.index * 7) % 5 - 2) * 0.65;
    const connector = previous
      ? '<path d="M' + (previous.x + previous.advance - 1) + ' ' + previous.jitter
        + ' Q' + (previous.x + previous.advance + 2) + ' ' + (previous.jitter - 1) + ' ' + letter.x + ' ' + jitter + '"/>'
      : '';
    previous = { x: letter.x, advance: letter.advance, jitter };
    return connector + '<path d="' + letter.path + '" transform="translate(' + letter.x + ' ' + jitter
      + ') rotate(' + rotation + ')"/>';
  }).join('');
  const flourishStroke = flourish
    ? '<path d="M' + (naturalWidth - spacing - 2) + ' 1 C' + (naturalWidth + 4) + ' 8 ' + (naturalWidth + 13)
      + ' -8 ' + (naturalWidth + 20) + ' -5 C' + (naturalWidth + 16) + ' 3 ' + (naturalWidth + 9) + ' 5 '
      + (naturalWidth + 25) + ' 1"/>'
    : '';
  return '<g class="fraud-signature" aria-label="Handwritten signature for ' + escapeSvgText(text)
    + '" transform="translate(' + x + ' ' + y + ') scale(' + scale.toFixed(3) + ') skewX(' + skew + ')"'
    + ' fill="none" stroke="' + escapeSvgText(color) + '" stroke-width="' + stroke
    + '" stroke-linecap="round" stroke-linejoin="round" opacity=".94">'
    + strokes + flourishStroke + '</g>';
}

function renderFraudCheckSvg(challenge, feedback = false) {
  const check = challenge.check;
  const palette = challenge.document.palette;
  const attributes = [
    'role="img"',
    'aria-label="Fictional check front and endorsement area for case ' + escapeSvgText(challenge.caseId) + '"',
    'viewBox="0 0 860 690"',
    'xmlns="http://www.w3.org/2000/svg"',
  ].join(' ');
  const title = '<title>Training sample check and endorsement</title>'
    + '<desc>Fictional check with written fields and a back endorsement area. Not negotiable and contains no real account data.</desc>';
  const front = [
    '<rect x="8" y="8" width="844" height="425" rx="16" fill="' + palette.paper + '" stroke="' + palette.accent + '" stroke-width="3"/>',
    '<rect x="8" y="8" width="844" height="55" rx="16" fill="' + palette.accent + '"/>',
    svgText(30, 43, challenge.document.olderDesign ? 'CEDARLINE SAVINGS · TRAINING DRAFT' : 'CEDARLINE COMMUNITY COOPERATIVE', 20, 800, '#ffffff'),
    svgText(668, 39, 'TRAINING SAMPLE', 12, 800, '#ffffff', 'letter-spacing="1"'),
    svgText(728, 91, 'NO REAL VALUE', 10, 800, palette.accent, 'letter-spacing="1"'),
    svgField(challenge, 'check-number', 29, 78, 160, 'CHECK NO.', check.checkNumber, { valueSize: 22 }),
    svgField(challenge, 'check-date', 671, 78, 157, 'DATE', check.dateText, { valueSize: 15 }),
    svgField(challenge, 'check-payee', 29, 151, 519, 'PAY TO THE ORDER OF', check.payeeName, { valueSize: 20 }),
    svgField(challenge, 'check-numeric-amount', 565, 151, 263, 'AMOUNT', check.numericAmount, { valueSize: 21 }),
    svgField(challenge, 'check-written-amount', 29, 223, 799, 'AMOUNT IN WORDS', check.writtenAmount, { valueSize: 16 }),
    svgField(challenge, 'check-maker-signature', 463, 302, 365, 'AUTHORIZED MAKER SIGNATURE', check.makerSignature || '', { signature: true, variation: check.makerSignatureVariation }),
    svgField(challenge, 'check-memo', 29, 302, 406, 'MEMO / NOTE', check.memoText, { valueSize: 16 }),
    svgText(32, 391, check.makerName, 13, 650, palette.ink),
    svgText(32, 412, 'Fictional drawer · invented training fields', 10, 500, '#536569'),
    challenge.settings.fieldDensity === 'low' ? '' : svgText(519, 121, 'Ref. ' + check.referenceNumber, 10, 550, '#536569'),
    '<rect x="29" y="443" width="802" height="57" rx="7" fill="#f5f4ed" stroke="' + palette.rule + '"/>',
    svgText(44, 466, 'MICR LINE · FICTIONAL PLACEHOLDERS', 9, 800, palette.accent, 'letter-spacing="1"'),
    '<g class="fraud-doc-field ' + (feedback && markedRegion(challenge, 'check-micr') ? 'fraud-marked' : '') + '" data-region="check-micr">',
    svgText(44, 490, '⑆ ' + check.routingNumber + ' ⑆  ' + check.accountNumber + ' ⑆  ' + check.micrCheckNumber, 16, 700, palette.ink, 'font-family="ui-monospace,monospace" letter-spacing="1"'),
    '</g>',
  ].join('');
  const endorsement = [
    '<rect x="8" y="520" width="844" height="158" rx="14" fill="' + palette.paper + '" stroke="' + palette.accent + '" stroke-width="3"/>',
    '<rect x="8" y="520" width="844" height="38" rx="12" fill="' + palette.rule + '"/>',
    svgText(28, 546, 'CHECK BACK · PAYEE ENDORSEMENT AREA', 13, 800, palette.ink, 'letter-spacing="1"'),
    svgText(30, 578, 'ENDORSE HERE', 10, 750, palette.accent, 'letter-spacing="1"'),
    '<g class="fraud-doc-field ' + (feedback && markedRegion(challenge, 'check-endorsement') ? 'fraud-marked' : '') + '" data-region="check-endorsement">',
    '<path d="M30 641 H820" stroke="' + palette.rule + '" stroke-width="2"/>',
    check.endorsementSignature
      ? signatureSvgText(check.endorsementSignature, check.endorsementVariation, 42, 630, palette.accent, 755)
      : svgText(42, 626, '', 22, 500, palette.ink),
    '</g>',
    svgText(30, 663, 'TRAINING EXAMPLE ONLY · endorsement comparison uses the customer ID shown beside it', 10, 550, '#536569'),
  ].join('');
  return '<svg class="fraud-document-svg fraud-check-svg" ' + attributes + '>' + title + front + endorsement + '</svg>';
}

function renderFraudIdSvg(challenge, feedback = false) {
  const identity = challenge.id;
  const palette = challenge.document.palette;
  const attributes = [
    'role="img"',
    'aria-label="Fictional customer identification card for ' + escapeSvgText(identity.legalName) + '"',
    'viewBox="0 0 860 540"',
    'xmlns="http://www.w3.org/2000/svg"',
  ].join(' ');
  const fields = [
    '<rect x="8" y="8" width="844" height="524" rx="20" fill="' + palette.paper + '" stroke="' + palette.accent + '" stroke-width="3"/>',
    '<rect x="8" y="8" width="844" height="92" rx="18" fill="' + palette.accent + '"/>',
    svgText(34, 47, 'STATE OF ' + identity.issuingState + ' · RESIDENT IDENTIFICATION', 18, 800, '#ffffff', 'letter-spacing=".5"'),
    svgText(34, 76, 'FICTIONAL TRAINING CARD · NOT A REAL ID', 11, 700, '#ffffff', 'letter-spacing="1"'),
    '<g class="fraud-doc-field ' + (feedback && markedRegion(challenge, 'id-photo') ? 'fraud-marked' : '') + '" data-region="id-photo">',
    '<image href="assets/fraud/id-portrait-' + (identity.portrait === 'female' ? 'female' : 'male')
      + '-20260922.jpg" x="44" y="136" width="194" height="242" preserveAspectRatio="xMidYMid slice" aria-label="Fictional training portrait"/>',
    identity.photoObscured
      ? '<path d="M45 244 C88 230 136 254 237 237 L237 271 C172 286 101 260 45 280 Z" fill="#fffef8" fill-opacity=".77" stroke="#9c866b" stroke-width="1.2"/><path d="M52 252 Q130 250 231 246 M49 269 Q133 266 231 257" fill="none" stroke="#aa9476" stroke-width="1" opacity=".75"/>'
      : '',
    '<rect class="fraud-photo-frame" x="37" y="129" width="208" height="256" rx="9" fill="none" stroke="' + palette.rule + '" stroke-width="2"/>',
    '</g>',
    svgField(challenge, 'id-name', 278, 129, 542, 'FULL LEGAL NAME', identity.legalName, { valueSize: 23 }),
    svgField(challenge, 'id-number', 278, 202, 248, 'ID NUMBER · FICTIONAL', identity.idNumber, { valueSize: 15 }),
    svgField(challenge, 'id-birth-date', 540, 202, 280, 'DATE OF BIRTH', identity.dateOfBirth, { valueSize: 17 }),
    svgField(challenge, 'id-address', 278, 275, 542, 'RESIDENCE ADDRESS', identity.address, { valueSize: 14 }),
    svgField(challenge, 'id-expiration', 278, 348, 248, 'EXPIRES', identity.expirationText, { valueSize: 18 }),
    svgField(challenge, 'id-issue-date', 540, 348, 280, 'ISSUED', new Date(identity.issueDate + 'T00:00:00Z').toLocaleDateString('en-US'), { valueSize: 17 }),
    '<g class="fraud-doc-field ' + (feedback && markedRegion(challenge, 'id-signature') ? 'fraud-marked' : '') + '" data-region="id-signature">',
    '<path d="M278 461h490" stroke="' + palette.rule + '" stroke-width="2"/>',
    signatureSvgText(identity.signature, identity.signatureVariation, 290, 450, palette.accent, 468),
    '</g>',
    svgText(278, 486, 'CUSTOMER SIGNATURE', 10, 750, palette.accent, 'letter-spacing="1"'),
    '<g transform="rotate(-17 420 260)" opacity=".11">',
    svgText(211, 280, 'SAMPLE · NOT FOR IDENTIFICATION', 38, 900, palette.accent, 'letter-spacing="3"'),
    '</g>',
    svgText(36, 416, 'REFERENCE ONLY', 10, 800, palette.accent, 'letter-spacing="1"'),
    svgText(36, 442, identity.issuingState, 17, 800, palette.ink),
  ];
  return '<svg class="fraud-document-svg fraud-id-svg" ' + attributes + '><title>Fictional customer ID</title>'
    + '<desc>Training-only identification card with made-up name, address, dates, and number.</desc>' + fields.join('') + '</svg>';
}

function makeFraudDocumentCard(kind, title, markup) {
  const article = document.createElement('article');
  article.className = 'fraud-document-card';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const tools = document.createElement('div');
  tools.className = 'fraud-document-tools';
  const viewport = document.createElement('div');
  viewport.className = 'fraud-doc-viewport';
  viewport.dataset.fraudViewport = kind;
  const stage = document.createElement('div');
  stage.className = 'fraud-doc-stage';
  stage.innerHTML = markup;
  viewport.append(stage);
  const controls = [
    ['−', 'Zoom out ' + title.toLowerCase(), 'out'],
    ['+', 'Zoom in ' + title.toLowerCase(), 'in'],
    ['Reset zoom', 'Reset ' + title.toLowerCase() + ' zoom', 'reset'],
    ['Enlarge', 'Enlarge ' + title.toLowerCase(), 'enlarge'],
  ];
  for (const [label, accessible, action] of controls) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = action === 'enlarge' ? 'text-button' : 'secondary-button';
    button.textContent = label;
    button.setAttribute('aria-label', accessible);
    button.dataset.fraudDocumentAction = action;
    button.dataset.fraudDocument = kind;
    if (!state.fraudSettings.zoomAvailable && action !== 'enlarge') button.hidden = true;
    button.addEventListener('click', () => {
      const currentZoom = state.fraudDocumentZooms.get(kind) ?? 1;
      if (action === 'in') setFraudDocumentZoom(kind, currentZoom + 0.2, article);
      else if (action === 'out') setFraudDocumentZoom(kind, currentZoom - 0.2, article);
      else if (action === 'reset') setFraudDocumentZoom(kind, 1, article);
      else openFraudDocument(kind);
    });
    tools.append(button);
  }
  if (!state.fraudSettings.zoomAvailable) tools.querySelector('[data-fraud-document-action="enlarge"]').hidden = true;
  article.append(heading, tools, viewport);
  setFraudDocumentZoom(kind, state.fraudDocumentZooms.get(kind) ?? 1, article);
  return article;
}

function setFraudDocumentZoom(kind, zoom, root = document) {
  const bounded = Math.max(1, Math.min(2.5, Math.round(zoom * 100) / 100));
  state.fraudDocumentZooms.set(kind, bounded);
  const viewport = root.querySelector('[data-fraud-viewport="' + kind + '"]');
  const svg = viewport?.querySelector('svg');
  if (svg) svg.style.width = (bounded * 100) + '%';
}

function renderFraudDocuments(target, challenge, feedback = false) {
  const check = makeFraudDocumentCard('check', 'CHECK · FRONT AND ENDORSEMENT', renderFraudCheckSvg(challenge, feedback));
  const identity = makeFraudDocumentCard('id', 'CUSTOMER IDENTIFICATION', renderFraudIdSvg(challenge, feedback));
  target.replaceChildren(check, identity);
}

function renderFraudIssueOptions() {
  const challenge = state.fraudChallenge;
  refs['fraud-issue-list'].replaceChildren();
  const choices = challenge.availableIssueOptions.map((category) => [category.id, category.label]);
  choices.push(['no-issues', 'No Issues Found']);
  for (const [id, label] of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fraud-issue-option';
    button.dataset.issueId = id;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = label;
    button.addEventListener('click', () => toggleFraudIssue(id));
    refs['fraud-issue-list'].append(button);
  }
  updateFraudSelectionStatus();
}

function toggleFraudIssue(id) {
  if (state.answerSubmitted) return;
  if (id === 'no-issues') {
    state.fraudSelections.clear();
    state.fraudSelections.add(id);
  } else {
    state.fraudSelections.delete('no-issues');
    if (state.fraudSelections.has(id)) state.fraudSelections.delete(id);
    else state.fraudSelections.add(id);
  }
  updateFraudSelectionStatus();
}

function updateFraudSelectionStatus() {
  refs['fraud-issue-list'].querySelectorAll('button[data-issue-id]').forEach((button) => {
    const pressed = state.fraudSelections.has(button.dataset.issueId);
    button.setAttribute('aria-pressed', String(pressed));
  });
  const count = [...state.fraudSelections].filter((id) => id !== 'no-issues').length;
  refs['fraud-selection-status'].textContent = state.fraudSelections.has('no-issues')
    ? 'No Issues Found selected.'
    : count ? count + ' issue' + (count === 1 ? '' : 's') + ' selected.'
      : 'Choose one or more issues, or mark No Issues Found.';
}

function renderFraudInspectionQuestion() {
  const challenge = state.fraudChallenge;
  state.fraudSelections = new Set();
  const level = state.difficulty === 'Custom' ? 'CUSTOM · ' + challenge.caseDifficulty.toUpperCase() : state.difficulty.toUpperCase();
  refs['fraud-inspection-progress'].textContent = 'Case ' + state.questionNumber + ' of ' + state.questionCount + ' · ' + level;
  refs['fraud-inspection-timer'].hidden = !state.fraudSettings.showTimer;
  refs['fraud-policy-note'].textContent = challenge.policy + ' Dates and controls are simulator examples only.';
  refs['fraud-transaction-strip'].replaceChildren();
  const facts = [
    ['Exercise date', challenge.exerciseDateText],
    ['Customer role', challenge.customerIsMaker ? 'Payee and check maker' : 'Payee only; front signature belongs to another maker'],
    ['Route control', challenge.check.routingControl],
    ['Account control', challenge.check.accountControl],
  ];
  for (const [label, value] of facts) {
    const item = document.createElement('div');
    const term = document.createElement('strong');
    const description = document.createElement('span');
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    refs['fraud-transaction-strip'].append(item);
  }
  renderFraudDocuments(refs['fraud-document-grid'], challenge);
  renderFraudIssueOptions();
}

function recordFraudInspectionAttempt(score, timedOut, elapsedSeconds) {
  const challenge = state.fraudChallenge;
  const selectedCategories = [...state.fraudSelections].filter((id) => id !== 'no-issues');
  const expectedIssues = challenge.expectedIssues;
  const categoryLabels = new Map(FRAUD_INSPECTION_CATEGORIES.map((category) => [category.id, category.label]));
  return {
    timestamp: new Date().toISOString(),
    sessionId: state.sessionId,
    game: 'fraud-inspection',
    gameType: 'Check & ID Fraud Inspection',
    sessionMode: state.fraudSettings.runMode,
    difficulty: state.difficulty,
    questionNumber: state.questionNumber,
    scenario: 'Fictional check and ID inspection',
    outcome: timedOut ? 'Timed Out' : score.correct ? 'Correct' : 'Incorrect',
    expectedAnswer: expectedIssues.length ? expectedIssues.map((issue) => issue.label).join(' · ') : 'No issues found.',
    userAnswer: selectedCategories.length ? selectedCategories.map((id) => categoryLabels.get(id)).join(' · ') : 'No issues found.',
    timeLimitSeconds: state.fraudSettings.timeLimitSeconds,
    timeUsedSeconds: Number(elapsedSeconds.toFixed(1)),
    fraudCaseId: challenge.caseId,
    fraudCaseDifficulty: challenge.caseDifficulty,
    fraudRunMode: state.fraudSettings.runMode,
    fraudTimeLimitSeconds: state.fraudSettings.timeLimitSeconds,
    fraudTimeUsedSeconds: Number(elapsedSeconds.toFixed(1)),
    fraudExpectedCategories: expectedIssues.map((issue) => issue.id),
    fraudExpectedIssues: expectedIssues.map((issue) => ({ id: issue.id, label: issue.label, explanation: issue.explanation, regions: issue.regions })),
    fraudSelectedCategories: selectedCategories,
    fraudFoundCategories: score.correctlySelectedIds,
    fraudMissedCategories: score.missedIssueIds,
    fraudFalsePositiveCategories: score.falsePositiveIds,
    fraudFalseNegativeCount: score.missedIssueIds.length,
    fraudFalsePositiveCount: score.falsePositiveIds.length,
    fraudSelectableCategoryCount: challenge.enabledCategories.length,
    fraudClassificationAccuracyPercent: score.accuracyPercent,
    fraudFalsePositiveRatePercent: score.falsePositiveRatePercent,
    fraudMissedIssueRatePercent: score.missedIssueRatePercent,
    fraudCategoryResults: score.categoryResults,
    fraudCleanCase: score.cleanCase,
    fraudCorrectlyRecognizedClean: score.correctlyRecognizedClean,
    fraudCustomerIsMaker: challenge.customerIsMaker,
    fraudSignatureVariationIsValid: challenge.signatureVariationIsValid,
    fraudExpiredId: expectedIssues.some((issue) => issue.id === 'id-expired'),
    fraudRunStoppedEarly: state.fraudStoppedEarly,
    fraudCurrentStreak: state.fraudCurrentStreak,
    fraudBestStreak: state.fraudBestStreak,
    outcomeDetail: timedOut ? 'Time expired' : score.correct ? 'Exact issue set' : 'Review did not match all actual issues',
  };
}

function populateFraudInspectionFeedback(record, score) {
  refs['feedback-kicker'].textContent = record.outcome === 'Timed Out' ? 'Inspection time expired' : 'Inspection result';
  refs['feedback-heading'].textContent = score.correct ? 'Correct review' : record.outcome === 'Timed Out' ? 'Time expired' : 'Review the documents';
  refs['feedback-heading'].dataset.result = score.correct ? 'correct' : 'incorrect';
  refs['feedback-lead'].textContent = score.correct
    ? 'You found the complete issue set and left valid details alone.'
    : score.cleanCase ? 'This was a clean case. Review any valid details you marked.'
      : 'Compare the check and ID again. The highlighted fields show each actual issue.';
  renderFraudDocuments(refs['fraud-feedback-documents'], state.fraudChallenge, true);
  refs['fraud-feedback-issues'].replaceChildren();
  const actualById = new Map(state.fraudChallenge.expectedIssues.map((issue) => [issue.id, issue]));
  const selected = new Set(state.fraudChallenge.enabledCategories
    .filter((id) => score.categoryResults[id] === 'found'));
  const falseFlags = new Set(score.falsePositiveIds);
  const missed = new Set(score.missedIssueIds);
  const appendIssueFeedback = (className, symbol, label, explanation) => {
    const item = document.createElement('li');
    item.className = className;
    const marker = document.createElement('strong');
    const copy = document.createElement('span');
    marker.textContent = symbol + ' ';
    copy.textContent = label + (explanation ? ' — ' + explanation : '');
    item.append(marker, copy);
    refs['fraud-feedback-issues'].append(item);
  };
  for (const id of selected) {
    const issue = actualById.get(id);
    appendIssueFeedback('fraud-feedback-correct', '✓ Correct selection:', issue.label, issue.explanation);
  }
  for (const id of falseFlags) {
    const issue = actualById.get(id);
    const label = FRAUD_INSPECTION_CATEGORIES.find((category) => category.id === id)?.label ?? id;
    appendIssueFeedback('fraud-feedback-false', '✗ Incorrect selection:', label, 'This detail is valid in this training case.');
  }
  for (const id of missed) {
    const issue = actualById.get(id);
    appendIssueFeedback('fraud-feedback-missed', '! Missed issue:', issue.label, issue.explanation);
  }
  if (!state.fraudChallenge.expectedIssues.length && !falseFlags.size) {
    appendIssueFeedback('fraud-feedback-correct', '✓', 'No issue — the documents are valid for this scenario.', state.fraudChallenge.validOddity || 'No suspicious features are present.');
  }
  refs['fraud-feedback'].hidden = false;
  refs['feedback-details'].replaceChildren();
  const details = [
    ['Actual issues', String(score.expectedCount)],
    ['Correctly found', String(score.correctlySelectedIds.length)],
    ['Missed issues', String(score.missedIssueIds.length)],
    ['False positives', String(score.falsePositiveIds.length)],
    ['Case accuracy', score.accuracyPercent + '%'],
    ['Time used', record.timeUsedSeconds.toFixed(1) + ' seconds'],
    ['Run type', record.fraudRunMode],
  ];
  for (const [label, value] of details) {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    refs['feedback-details'].append(term, description);
  }
}

function submitFraudInspectionAttempt(timedOut = false) {
  if (state.answerSubmitted || !state.fraudChallenge) return;
  if (!timedOut && state.fraudSelections.size === 0) {
    setMessage('Select one or more issues or choose No Issues Found before submitting.');
    refs['fraud-issue-list'].querySelector('button')?.focus();
    return;
  }
  state.answerSubmitted = true;
  const elapsedSeconds = Math.min(state.fraudSettings.timeLimitSeconds,
    Math.max(0, (Date.now() - state.fraudStartedAt) / 1000));
  stopTimer();
  const selected = state.fraudSelections.has('no-issues') ? [] : [...state.fraudSelections];
  const score = scoreFraudInspectionAttempt(state.fraudChallenge, selected, timedOut);
  state.fraudCurrentStreak = score.correct ? state.fraudCurrentStreak + 1 : 0;
  state.fraudBestStreak = Math.max(state.fraudBestStreak, state.fraudCurrentStreak);
  const suddenDeathFailure = state.fraudSettings.runMode === 'sudden-death'
    && (timedOut || score.missedIssueIds.length > 0 || score.falsePositiveIds.length > 0);
  if (suddenDeathFailure) state.fraudStoppedEarly = true;
  const record = recordFraudInspectionAttempt(score, timedOut, elapsedSeconds);
  state.results.push(record);
  persistRecord(record);
  const complete = state.results.length >= state.questionCount || state.fraudStoppedEarly;
  if (complete) stopContinuousDistractionNoise();
  const shouldAutoAdvance = state.fraudSettings.automaticNext || state.autoContinue;
  populateFraudInspectionFeedback(record, score);
  refs['next-question'].textContent = state.fraudStoppedEarly ? 'View run results' : 'Next case (Enter)';
  showScreen('feedback');
  if (shouldAutoAdvance && !state.fraudStoppedEarly) {
    window.clearTimeout(state.fraudRoundAdvanceTimer);
    state.fraudRoundAdvanceTimer = window.setTimeout(showNextFraudInspectionCase, state.fraudSettings.instantFeedback ? 1400 : 650);
  }
}

function showNextFraudInspectionCase() {
  window.clearTimeout(state.fraudRoundAdvanceTimer);
  state.fraudRoundAdvanceTimer = null;
  if (state.fraudStoppedEarly) {
    renderSummary();
    showScreen('summary');
    return;
  }
  state.questionNumber += 1;
  if (state.questionNumber > state.questionCount) {
    renderSummary();
    showScreen('summary');
    return;
  }
  state.fraudChallenge = createFraudInspectionCase(state.difficulty, state.fraudSettings);
  state.answerSubmitted = false;
  state.fraudStartedAt = 0;
  const initialScore = scoreFraudInspectionAttempt(state.fraudChallenge, []);
  persistUnansweredRound(recordFraudInspectionAttempt(initialScore, false, 0));
  renderFraudInspectionQuestion();
  showScreen('fraud-inspection');
  state.fraudStartedAt = Date.now();
  startTimer(state.fraudSettings.timeLimitSeconds, refs['fraud-inspection-timer'], () => submitFraudInspectionAttempt(true));
  startContinuousDistractionNoise();
}

function startFraudInspection() {
  state.fraudSettings = resolveFraudInspectionSettings(state.difficulty, state.fraudSettings, state.fraudSettings.runMode);
  state.questionCount = state.fraudSettings.questionCount;
  state.timeLimitSeconds = state.fraudSettings.timeLimitSeconds;
  state.autoContinue = state.fraudSettings.automaticNext || refs['auto-continue-toggle'].checked;
  state.fraudStoppedEarly = false;
  state.fraudDocumentZooms = new Map();
  showNextFraudInspectionCase();
}

function openFraudDocument(kind) {
  const challenge = state.fraudChallenge;
  if (!challenge) return;
  const markup = kind === 'check' ? renderFraudCheckSvg(challenge) : renderFraudIdSvg(challenge);
  refs['fraud-document-dialog-heading'].textContent = kind === 'check' ? 'Check front and endorsement' : 'Customer identification';
  refs['fraud-document-dialog-view'].innerHTML = markup;
  state.fraudDialogZoom = 1;
  const svg = refs['fraud-document-dialog-view'].querySelector('svg');
  if (svg) svg.style.width = '100%';
  if (!refs['fraud-document-dialog'].open) refs['fraud-document-dialog'].showModal();
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

function createTaskCaseNoteButton(disabled) {
  const button = document.createElement('button');
  button.id = 'task-open-case-dialog';
  button.className = 'secondary-button';
  button.type = 'button';
  button.textContent = 'Add case note';
  button.disabled = disabled;
  button.addEventListener('click', () => openTaskDialog(true));
  return button;
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
    const actions = document.createElement('div');
    actions.className = 'task-inline-actions';
    actions.append(createTaskCaseNoteButton(disabled));
    verification.append(actions);
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
  const noteButton = createTaskCaseNoteButton(disabled);
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
  startContinuousDistractionNoise();
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

function taskActionMatches(expected, action) {
  if (!expected || !action || expected.type !== action.type || expected.targetId !== action.targetId) return false;
  if (expected.value === undefined) return true;
  return typeof expected.value === 'boolean' ? expected.value === action.value : String(expected.value) === String(action.value ?? '');
}

function taskActionAnalytics(challenge, actionLog) {
  const expected = challenge.steps;
  const completed = [];
  const extra = [];
  const outOfOrder = [];
  let next = 0;
  for (const action of actionLog) {
    if (taskActionMatches(expected[next], action)) {
      completed.push(action.type);
      next += 1;
    } else if (expected.slice(next + 1).some((step) => taskActionMatches(step, action))) outOfOrder.push(action.type);
    else extra.push(action.type);
  }
  return {
    expectedActionCategories: [...new Set(expected.map((step) => step.type))],
    completedActionCategories: [...new Set(completed)],
    taskMissingActions: [...new Set(expected.slice(next).map((step) => step.type))],
    taskExtraActions: [...new Set(extra)],
    taskOutOfOrderActions: [...new Set(outOfOrder)],
    taskMistakeCategories: [...new Set([
      ...(next < expected.length ? ['missing'] : []),
      ...(extra.length ? ['extra'] : []),
      ...(outOfOrder.length ? ['out-of-order'] : []),
    ])],
  };
}

function recordTaskAttempt(score, timedOut, elapsedSeconds) {
  const challenge = state.taskChallenge;
  const actionAnalytics = taskActionAnalytics(challenge, state.taskActionLog);
  return {
    timestamp: new Date().toISOString(),
    sessionId: state.sessionId,
    gameType: 'Task simulation',
    taskTitle: challenge.title,
    workspaceKind: challenge.workspace.kind,
    workspaceRows: challenge.workspace.rows?.length ?? 0,
    workspaceTabs: challenge.workspace.tabs?.length ?? 0,
    briefingSeconds: challenge.briefingSeconds,
    recallSeconds: challenge.recallSeconds,
    demoStepMilliseconds: challenge.demoStepMilliseconds,
    difficulty: state.difficulty,
    questionNumber: state.questionNumber,
    stepsExpected: score.expectedSteps,
    stepsCompleted: score.completedSteps,
    mistakes: score.mistakes,
    sequenceAccuracyPercent: score.sequenceAccuracyPercent,
    ...actionAnalytics,
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
  if (state.results.length === state.questionCount) stopContinuousDistractionNoise();
  if (state.autoContinue) {
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
  state.taskChallenge = createTaskChallenge(state.difficulty, { ...sessionPreset(), ...state.practicePlan?.focus });
  persistUnansweredRound(recordTaskAttempt(scoreTaskAttempt(state.taskChallenge, [], true), false, 0));
  state.answerSubmitted = false;
  showTaskBriefing();
}

function makeMetrics(records) {
  const summary = summarizeHistory(records);
  const averageTime = summary.answered ? records.reduce((sum, record) => sum + Number(record.timeUsedSeconds || 0), 0) / summary.answered : 0;
  if (state.game === 'fraud-inspection') {
    const fraud = summarizeFraudHistory(records);
    return [
      [String(fraud.casesReviewed), 'Cases reviewed'],
      [fraud.exactSetAccuracyPercent === null ? '—' : fraud.exactSetAccuracyPercent + '%', 'Exact-case accuracy'],
      [fraud.accuracyPercent === null ? '—' : Math.round(fraud.accuracyPercent) + '%', 'Issue-choice accuracy'],
      [String(fraud.falsePositiveCount), 'False positives'],
      [String(fraud.missedIssueCount), 'Missed issues'],
      [fraud.averageInspectionTimeSeconds === null ? '—' : fraud.averageInspectionTimeSeconds.toFixed(1) + 's', 'Average inspection'],
      [String(fraud.cleanChecksCorrectlyRecognized), 'Clean cases recognized'],
      [String(fraud.currentStreak), 'Current perfect streak'],
      [String(fraud.bestStreak), 'Best perfect streak'],
    ];
  }
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
  if (state.game === 'error-detection') {
    const missedErrors = records.reduce((sum, record) => sum + Number(record.expectedErrorCount || 0) - Number(record.correctlyFlagged || 0), 0);
    const falseFlags = records.reduce((sum, record) => sum + Number(record.falseFlagCount || 0), 0);
    return [
      [`${summary.answered}`, 'Rounds'],
      [`${summary.accuracyPercent}%`, 'Perfect puzzles'],
      [`${missedErrors}`, 'Missed anomalies'],
      [`${falseFlags}`, 'False marks'],
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
  stopContinuousDistractionNoise();
  refs['summary-heading'].textContent = state.game === 'memory'
    ? 'Your memory results'
    : state.game === 'task'
      ? 'Your task simulation results'
      : state.game === 'error-detection'
        ? 'Your error detection results'
        : state.game === 'fraud-inspection'
          ? 'Your fraud inspection results'
        : 'Your cash results';
  renderMetrics(refs['session-metrics'], makeMetrics(state.results));
  renderPracticeRecommendations(document.getElementById('summary-recommendations'), state.game, state.difficulty);
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

  const accuracyAxis = document.createElement('div');
  accuracyAxis.className = 'bar-chart-axis';
  const category = document.createElement('span');
  category.textContent = 'Difficulty';
  const scale = document.createElement('span');
  scale.textContent = 'Accuracy (%)  0%   20%   40%   60%   80%   100%';
  accuracyAxis.append(category, scale);
  refs['history-accuracy-chart'].replaceChildren(accuracyAxis, ...summary.byDifficulty.map((level) => {
    const row = document.createElement('div');
    row.className = 'bar-chart-row';
    const label = document.createElement('span');
    label.className = 'bar-chart-label';
    label.textContent = level.level;
    const track = document.createElement('div');
    track.className = 'bar-chart-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = `bar-chart-fill ${chartColorClass({ id: 'accuracy-by-difficulty', kind: 'bar', series: [{ metric: 'accuracy' }] }, { key: level.level, value: level.accuracyPercent }, 0)}`;
    fill.style.setProperty('--bar-size', `${level.accuracyPercent}%`);
    track.append(fill);
    const value = document.createElement('span');
    value.className = 'bar-chart-value';
    value.textContent = `${level.accuracyPercent}% (${level.correct}/${level.answered})`;
    row.append(label, track, value);
    return row;
  }));
}

function historyPresetMap() {
  return { cash: state.cashPresets, memory: state.memoryPresets, task: state.taskPresets, 'error-detection': state.errorDetectionPresets };
}

function localIsoDate(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function shiftDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

function fieldPath(fieldId) {
  if (fieldId === 'task.mistakeCategory') return ['task', 'mistakeCategories'];
  return fieldId.split('.');
}

function filterValue(fieldId, value) {
  if (fieldId === 'cash.denominations') return Math.round(Number(String(value).replace('$', '')) * 100);
  return value;
}

function readFilterPath(path) {
  return path.reduce((value, part) => value?.[part], historyView.filters);
}

function writeFilterPath(path, value) {
  let target = historyView.filters;
  path.slice(0, -1).forEach((part) => {
    if (!target[part] || typeof target[part] !== 'object') target[part] = {};
    target = target[part];
  });
  const key = path.at(-1);
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) delete target[key];
  else target[key] = value;
}

function rerenderHistoryForFilter() {
  if (state.activeScreen === 'history') renderHistory();
}

function appendFacetFilter(target, field) {
  const options = field.options ?? [];
  const group = document.createElement('fieldset');
  group.className = 'history-filter-group';
  const legend = document.createElement('legend');
  legend.textContent = `${field.label}${options.length ? '' : ' (not recorded yet)'}`;
  group.append(legend);
  if (!options.length) {
    const unavailable = document.createElement('p');
    unavailable.className = 'practice-note';
    unavailable.textContent = 'New attempts record this game-specific field. Older attempts remain available in the rest of History.';
    group.append(unavailable);
    target.append(group);
    return;
  }
  const values = document.createElement('div');
  values.className = 'history-facet-list';
  const path = fieldPath(field.id);
  const active = readFilterPath(path) ?? [];
  for (const option of options) {
    const label = document.createElement('label');
    label.className = 'history-facet';
    const input = document.createElement('input');
    input.type = 'checkbox';
    const value = filterValue(field.id, option);
    input.checked = active.some((item) => String(item) === String(value));
    input.addEventListener('change', () => {
      const next = [...(readFilterPath(path) ?? [])];
      const found = next.findIndex((item) => String(item) === String(value));
      if (input.checked && found < 0) next.push(value);
      if (!input.checked && found >= 0) next.splice(found, 1);
      writeFilterPath(path, next.length ? next : undefined);
      rerenderHistoryForFilter();
    });
    const text = document.createElement('span');
    text.textContent = option;
    label.append(input, text);
    values.append(label);
  }
  group.append(values);
  target.append(group);
}

function appendSessionFilter(target, field) {
  const options = field.options ?? [];
  const group = document.createElement('fieldset');
  group.className = 'history-filter-group history-session-filter';
  const picker = document.createElement('details');
  picker.className = 'history-session-picker';
  picker.open = historyView.openFacet === field.id;
  picker.addEventListener('toggle', () => { historyView.openFacet = picker.open ? field.id : null; });
  const summary = document.createElement('summary');
  const path = fieldPath(field.id);
  const active = readFilterPath(path) ?? [];
  summary.textContent = `Sessions${active.length ? ` (${active.length} selected)` : ''}`;
  picker.append(summary);
  const panel = document.createElement('div');
  panel.className = 'history-session-options';
  if (!options.length) {
    panel.textContent = 'No session identifiers were recorded yet.';
  } else {
    for (const option of options) {
      const label = document.createElement('label');
      label.className = 'history-facet';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = active.some((item) => String(item) === String(option));
      input.addEventListener('change', () => {
        const next = [...(readFilterPath(path) ?? [])];
        const found = next.findIndex((item) => String(item) === String(option));
        if (input.checked && found < 0) next.push(option);
        if (!input.checked && found >= 0) next.splice(found, 1);
        writeFilterPath(path, next.length ? next : undefined);
        historyView.openFacet = field.id;
        rerenderHistoryForFilter();
      });
      const text = document.createElement('span');
      text.textContent = option;
      label.append(input, text);
      panel.append(label);
    }
  }
  picker.append(panel);
  group.append(picker);
  target.append(group);
}

function appendRangeFilter(target, field) {
  const group = document.createElement('fieldset');
  group.className = 'history-filter-group history-range-filter';
  const legend = document.createElement('legend');
  legend.textContent = `${field.label}${field.available === 0 ? ' (not recorded yet)' : ''}`;
  group.append(legend);
  const path = fieldPath(field.id);
  const bounds = readFilterPath(path) ?? {};
  const cents = field.unit === 'cents';
  for (const [key, labelText] of [['min', `Minimum${cents ? ' ($)' : ''}`], ['max', `Maximum${cents ? ' ($)' : ''}`]]) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = cents ? '0.01' : '1';
    input.min = '0';
    const stored = bounds[key];
    input.value = stored === undefined ? '' : cents ? (Number(stored) / 100).toFixed(2) : String(stored);
    input.addEventListener('change', () => {
      const next = { ...(readFilterPath(path) ?? {}) };
      const parsed = input.value === '' ? undefined : Number(input.value) * (cents ? 100 : 1);
      if (!Number.isFinite(parsed)) return;
      if (parsed === undefined) delete next[key]; else next[key] = parsed;
      writeFilterPath(path, Object.keys(next).length ? next : undefined);
      historyView.activeRange = 'custom';
      rerenderHistoryForFilter();
    });
    label.append(input);
    group.append(label);
  }
  target.append(group);
}

function appendBooleanFilter(target, field) {
  const group = document.createElement('label');
  group.className = 'history-filter-group history-boolean-filter';
  const span = document.createElement('span');
  span.textContent = field.label;
  const select = document.createElement('select');
  select.append(new Option('Any', ''), new Option('Yes', 'true'), new Option('No', 'false'));
  const path = fieldPath(field.id);
  const value = readFilterPath(path);
  select.value = value === undefined ? '' : String(value);
  select.addEventListener('change', () => {
    writeFilterPath(path, select.value === '' ? undefined : select.value === 'true');
    rerenderHistoryForFilter();
  });
  group.append(span, select);
  target.append(group);
}

function appendDateFilter(target) {
  const group = document.createElement('fieldset');
  group.className = 'history-filter-group history-date-filter';
  const legend = document.createElement('legend');
  legend.textContent = 'Custom date range';
  group.append(legend);
  for (const [key, labelText] of [['startDate', 'From'], ['endDate', 'To']]) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'date';
    input.value = historyView.filters[key] ?? '';
    input.addEventListener('change', () => {
      if (input.value) historyView.filters[key] = input.value; else delete historyView.filters[key];
      delete historyView.filters.attemptLimit;
      historyView.activeRange = 'custom';
      rerenderHistoryForFilter();
    });
    label.append(input);
    group.append(label);
  }
  target.append(group);
}

function appendOptionalModesFilter(target) {
  const group = document.createElement('fieldset');
  group.className = 'history-filter-group';
  const legend = document.createElement('legend');
  legend.textContent = 'Optional modes enabled';
  group.append(legend);
  const labels = { distraction: 'Distraction sounds', cashBuilder: 'Cash builder', customerRequests: 'Customer requests' };
  const values = document.createElement('div');
  values.className = 'history-facet-list';
  for (const [key, labelText] of Object.entries(labels)) {
    const label = document.createElement('label');
    label.className = 'history-facet';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = historyView.filters.optionalModes?.[key] === true;
    input.addEventListener('change', () => {
      const next = { ...(historyView.filters.optionalModes ?? {}) };
      if (input.checked) next[key] = true; else delete next[key];
      if (Object.keys(next).length) historyView.filters.optionalModes = next; else delete historyView.filters.optionalModes;
      rerenderHistoryForFilter();
    });
    const text = document.createElement('span');
    text.textContent = labelText;
    label.append(input, text);
    values.append(label);
  }
  group.append(values);
  target.append(group);
}

function renderHistoryFilters(records) {
  refs['history-game-tabs'].querySelectorAll('button').forEach((button) => {
    const selected = button.dataset.historyGame === historyView.filters.game;
    button.setAttribute('aria-pressed', String(selected));
  });
  refs['history-quick-ranges'].querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.historyRange === historyView.activeRange));
  });
  const definition = buildGameFilters(records, historyView.filters.game);
  refs['history-common-filters'].replaceChildren();
  refs['history-game-filters'].replaceChildren();
  appendDateFilter(refs['history-common-filters']);
  for (const field of definition.fields) {
    const target = field.id.includes('.') ? refs['history-game-filters'] : refs['history-common-filters'];
    if (field.id === 'optionalModes') appendOptionalModesFilter(target);
    else if (field.id === 'sessions') appendSessionFilter(target, field);
    else if (field.type === 'range') appendRangeFilter(target, field);
    else if (field.type === 'boolean') appendBooleanFilter(target, field);
    else if (field.type === 'facet') appendFacetFilter(target, field);
  }
}

function renderProgressMetrics(model) {
  const time = model.averageResponseTimeSeconds === null ? 'Not recorded' : `${model.averageResponseTimeSeconds.toFixed(1)}s`;
  renderMetrics(refs['history-metrics'], [
    [`${model.attempts}`, 'Attempts'], [`${model.accuracyPercent ?? '—'}%`, 'Completed accuracy'], [`${time}`, 'Average response time'],
    [`${model.attemptsToday}`, 'Attempts today'], [`${model.attemptsPerDay === null ? '—' : model.attemptsPerDay.toFixed(1)}`, 'Attempts per day'],
    [`${model.accuracyPerDay ?? '—'}%`, 'Accuracy per day'], [`${model.speedPerDay === null ? '—' : `${model.speedPerDay.toFixed(1)}s`}`, 'Average speed per day'],
    [`${model.longestCorrectStreak}`, 'Best correct streak'],
  ]);
}

function chartSvgElement(name, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function chartValue(point, metric) {
  if (point.value === null || point.value === undefined) return 'Not recorded';
  if (metric === 'time') return `${Number(point.value).toFixed(1)}s`;
  if (metric === 'attempts') return `${point.value}`;
  return `${point.value}%`;
}

function chartAxisLabel(metric) {
  if (metric === 'time') return 'Response time (seconds)';
  if (metric === 'attempts') return 'Attempts';
  return 'Accuracy (%)';
}

function chartTickStep(max, metric) {
  if (metric === 'accuracy') return 20;
  const rough = Math.max(1, max) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

function chartScale(values, metric) {
  const maximum = Math.max(0, ...values.filter(Number.isFinite));
  const step = chartTickStep(maximum, metric);
  const max = metric === 'accuracy' ? 100 : Math.max(step, Math.ceil(maximum / step) * step);
  const ticks = [];
  for (let value = 0; value <= max + step / 100; value += step) ticks.push(Number(value.toFixed(8)));
  return { max, ticks };
}

function chartTickValue(value, metric) {
  return metric === 'time' ? `${value}s` : metric === 'accuracy' ? `${value}%` : String(value);
}

function chartColorClass(spec, point, index) {
  const metric = spec.series[0].metric;
  const outcome = String(point.key ?? '').toLowerCase();
  if (spec.id === 'outcomes') {
    if (outcome === 'correct') return 'chart-value-success';
    if (outcome === 'incorrect') return 'chart-value-danger';
    return 'chart-value-muted';
  }
  if (metric === 'accuracy') {
    if (point.value < 60) return 'chart-value-danger';
    if (point.value < 85) return 'chart-value-caution';
    return 'chart-value-success';
  }
  if (spec.kind === 'bar') return `chart-value-series-${index % 4}`;
  return 'chart-value-primary';
}

function openAttemptDetails(records, attemptIds, heading) {
  const rows = records.filter((record) => attemptIds.includes(record.attemptId));
  refs['attempt-detail-summary'].textContent = `${rows.length} contributing attempt${rows.length === 1 ? '' : 's'} — ${heading}`;
  refs['attempt-detail-content'].replaceChildren();
  if (!rows.length) refs['attempt-detail-content'].textContent = 'No saved attempts match this chart mark.';
  else {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap attempt-detail-table';
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>When</th><th>Game</th><th>Result</th><th>Time</th><th>Details</th></tr></thead>';
    const body = document.createElement('tbody');
    for (const record of rows.slice().reverse()) {
      const row = document.createElement('tr');
      const details = [record.expectedAnswer, record.userAnswer].filter(Boolean).join(' → ') || 'No answer detail recorded';
      for (const value of [new Date(record.timestamp).toLocaleString(), record.gameName, record.outcome,
        record.responseTimeSeconds === null ? 'Not recorded' : `${record.responseTimeSeconds.toFixed(1)}s`, details]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body);
    wrap.append(table);
    refs['attempt-detail-content'].append(wrap);
  }
  if (typeof refs['attempt-detail-dialog'].showModal === 'function') refs['attempt-detail-dialog'].showModal();
  else refs['attempt-detail-dialog'].open = true;
}

function renderChartCard(spec, records) {
  const view = historyView.charts.get(spec.id) ?? { start: 0, count: 12, visible: true, compare: false };
  historyView.charts.set(spec.id, view);
  const card = document.createElement('article');
  card.className = 'interactive-chart visual-card';
  const heading = document.createElement('div');
  heading.className = 'visual-heading';
  const title = document.createElement('h4');
  title.textContent = spec.title;
  const controls = document.createElement('div');
  controls.className = 'chart-controls';
  const control = (label, action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-button';
    button.textContent = label;
    button.addEventListener('click', () => { action(); renderHistory(); });
    controls.append(button);
  };
  control(view.visible ? 'Hide data' : 'Show data', () => { view.visible = !view.visible; });
  control('Zoom in', () => { view.count = Math.max(1, Math.floor(view.count / 1.5)); view.notice = 'Zoomed in. Drag across the plot to choose an exact range.'; });
  control('Zoom out', () => { view.count = Math.min(60, view.count + 6); });
  control('Earlier', () => { view.start = Math.max(0, view.start - Math.max(1, Math.floor(view.count / 2))); });
  control('Later', () => { view.start = Math.min(Math.max(0, spec.series[0].points.length - view.count), view.start + Math.max(1, Math.floor(view.count / 2))); });
  control('Reset', () => { Object.assign(view, { start: 0, count: 12, visible: true, compare: false, notice: 'Showing the default chart range.' }); });
  control(view.compare ? 'Hide comparison' : 'Compare periods', () => { view.compare = !view.compare; });
  heading.append(title, controls);
  card.append(heading);
  const status = document.createElement('p');
  status.className = 'chart-note chart-hover';
  status.textContent = view.notice ?? `${spec.attemptIds.length} eligible filtered attempt${spec.attemptIds.length === 1 ? '' : 's'}.`;
  card.append(status);
  const selectionHint = document.createElement('p');
  selectionHint.className = 'chart-selection-hint';
  selectionHint.textContent = 'Drag across the plot to zoom to those marks. Reset returns to the default range.';
  card.append(selectionHint);
  const series = spec.series[0];
  const sourcePoints = series.points.slice(view.start, view.start + view.count);
  const points = sourcePoints.filter((point) => {
    const value = spec.kind === 'scatter' ? point.y : point.value;
    return value !== null && value !== undefined && Number.isFinite(Number(value))
      && (spec.kind !== 'scatter' || (point.x !== null && point.x !== undefined && Number.isFinite(Number(point.x))));
  });
  if (!view.visible || !points.length) {
    const empty = document.createElement('p');
    empty.className = 'chart-empty';
    empty.textContent = view.visible ? 'This chart has no recorded values for the current filters.' : 'Data is hidden. Choose Show data to display it.';
    card.append(empty);
    return card;
  }
  const svg = chartSvgElement('svg', { class: 'analytics-svg', viewBox: '0 0 760 330', role: 'img', 'aria-label': `${spec.title}. Drag across the plot to zoom to selected marks. Each mark can be selected to inspect exact attempts.`, 'data-chart-window': `${view.start}:${view.count}` });
  const plot = { left: 72, right: 24, top: 24, bottom: 254 };
  const plotWidth = 760 - plot.left - plot.right;
  const plotHeight = plot.bottom - plot.top;
  const metric = series.metric;
  const values = points.map((point) => Number(spec.kind === 'scatter' ? point.y : point.value)).filter(Number.isFinite);
  const scale = chartScale(values, metric);
  const yFor = (value) => plot.bottom - (Number(value) / scale.max * plotHeight);
  const xValues = spec.kind === 'scatter' ? points.map((point) => Number(point.x)).filter(Number.isFinite) : [];
  const xScale = spec.kind === 'scatter' ? chartScale(xValues, 'time') : null;
  const xFor = (point, index) => spec.kind === 'scatter'
    ? plot.left + (Number(point.x) / xScale.max * plotWidth)
    : plot.left + ((index + 0.5) / Math.max(points.length, 1) * plotWidth);
  const yAxis = chartSvgElement('g', { class: 'chart-axis chart-y-axis' });
  scale.ticks.forEach((tick) => {
    const y = yFor(tick);
    yAxis.append(chartSvgElement('line', { class: 'chart-grid-line', x1: plot.left, y1: y, x2: plot.left + plotWidth, y2: y }));
    const label = chartSvgElement('text', { class: 'chart-y-tick', x: plot.left - 8, y: y + 4, 'text-anchor': 'end' });
    label.textContent = chartTickValue(tick, metric);
    yAxis.append(label);
  });
  yAxis.append(chartSvgElement('line', { class: 'chart-axis-line', x1: plot.left, y1: plot.top, x2: plot.left, y2: plot.bottom }));
  const yTitle = chartSvgElement('text', { class: 'chart-axis-title', x: 16, y: (plot.top + plot.bottom) / 2, transform: `rotate(-90 16 ${(plot.top + plot.bottom) / 2})`, 'text-anchor': 'middle' });
  yTitle.textContent = chartAxisLabel(metric);
  yAxis.append(yTitle);
  const xAxis = chartSvgElement('g', { class: 'chart-axis chart-x-axis' });
  xAxis.append(chartSvgElement('line', { class: 'chart-axis-line', x1: plot.left, y1: plot.bottom, x2: plot.left + plotWidth, y2: plot.bottom }));
  const tickIndexes = points.length <= 6 ? points.map((_, index) => index) : [...new Set([0, Math.round((points.length - 1) / 4), Math.round((points.length - 1) / 2), Math.round((points.length - 1) * 3 / 4), points.length - 1])];
  if (spec.kind === 'scatter') {
    xScale.ticks.forEach((tick) => {
      const x = plot.left + (tick / xScale.max * plotWidth);
      xAxis.append(chartSvgElement('line', { class: 'chart-axis-line', x1: x, y1: plot.bottom, x2: x, y2: plot.bottom + 5 }));
      const label = chartSvgElement('text', { class: 'chart-x-tick', x, y: plot.bottom + 19, 'text-anchor': 'middle' });
      label.textContent = chartTickValue(tick, 'time');
      xAxis.append(label);
    });
  } else tickIndexes.forEach((index) => {
    const x = xFor(points[index], index);
    xAxis.append(chartSvgElement('line', { class: 'chart-axis-line', x1: x, y1: plot.bottom, x2: x, y2: plot.bottom + 5 }));
    const label = chartSvgElement('text', { class: 'chart-x-tick', x, y: plot.bottom + 19, 'text-anchor': 'middle' });
    label.textContent = points[index].label.length > 12 ? `${points[index].label.slice(0, 11)}…` : points[index].label;
    xAxis.append(label);
  });
  const xTitle = chartSvgElement('text', { class: 'chart-axis-title', x: plot.left + plotWidth / 2, y: 320, 'text-anchor': 'middle' });
  xTitle.textContent = spec.kind === 'scatter' ? 'Response time (seconds)' : points.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.label)) ? 'Date' : 'Category';
  xAxis.append(xTitle);
  svg.append(yAxis, xAxis);
  const selection = chartSvgElement('rect', { class: 'chart-selection', x: plot.left, y: plot.top, width: 0, height: plotHeight, visibility: 'hidden' });
  svg.append(selection);
  const linePoints = [];
  const lineSegments = [];
  points.forEach((point, index) => {
    const value = Number(spec.kind === 'scatter' ? point.y : point.value);
    if (!Number.isFinite(value)) return;
    const x = xFor(point, index);
    const y = yFor(value);
    const width = plotWidth / Math.max(points.length, 1);
    const height = Math.max(2, plot.bottom - y);
    if (spec.kind === 'line' || spec.kind === 'scatter') {
      linePoints.push(`${x},${y}`);
      if (index > 0) lineSegments.push({ x1: xFor(points[index - 1], index - 1), y1: yFor(Number(spec.kind === 'scatter' ? points[index - 1].y : points[index - 1].value)), x2: x, y2: y, color: chartColorClass(spec, point, index) });
    }
    const colorClass = chartColorClass(spec, point, index);
    const mark = chartSvgElement('g', { class: `analytics-mark ${colorClass}`, role: 'button', tabindex: '0', 'aria-label': `${point.label}: ${chartValue(point, series.metric)} from ${point.attemptIds.length} attempts` });
    const shape = chartSvgElement(spec.kind === 'line' || spec.kind === 'scatter' ? 'circle' : 'rect', spec.kind === 'line' || spec.kind === 'scatter'
      ? { cx: x, cy: y, r: Math.max(4, Math.min(8, width * 0.18)) }
      : { x: x - Math.max(3, width * 0.32), y, width: Math.max(5, width * 0.64), height, rx: 2 });
    const activate = () => openAttemptDetails(records, point.attemptIds, `${spec.title}: ${point.label}`);
    mark.addEventListener('click', activate);
    mark.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    });
    mark.addEventListener('mouseenter', () => { status.textContent = `${point.label}: ${chartValue(point, series.metric)} from ${point.attemptIds.length} attempt${point.attemptIds.length === 1 ? '' : 's'}.`; });
    mark.addEventListener('focus', () => { status.textContent = `${point.label}: ${chartValue(point, series.metric)} from ${point.attemptIds.length} attempt${point.attemptIds.length === 1 ? '' : 's'}.`; });
    const tooltip = chartSvgElement('title');
    tooltip.textContent = `${point.label}: ${chartValue(point, series.metric)}`;
    mark.append(tooltip, shape);
    if (spec.kind === 'bar' || spec.kind === 'line' || spec.kind === 'scatter') {
      const label = chartSvgElement('text', { class: 'chart-value-label', x, y: Math.max(plot.top + 11, y - 7), 'text-anchor': 'middle' });
      label.textContent = spec.kind === 'scatter' ? `${point.label}: ${chartValue(point, series.metric)}` : chartValue(point, series.metric);
      mark.append(label);
    }
    svg.append(mark);
  });
  if (linePoints.length > 1 && spec.kind === 'line') {
    const path = chartSvgElement('polyline', { class: 'chart-series-line', points: linePoints.join(' '), fill: 'none' });
    svg.insertBefore(path, svg.querySelector('.analytics-mark'));
  }
  if (lineSegments.length) lineSegments.forEach((segment) => svg.insertBefore(chartSvgElement('line', { class: `chart-series-segment ${segment.color}`, x1: segment.x1, y1: segment.y1, x2: segment.x2, y2: segment.y2 }), svg.querySelector('.analytics-mark')));
  let drag = null;
  let suppressClick = false;
  const plotX = (event) => {
    const bounds = svg.getBoundingClientRect();
    return Math.max(plot.left, Math.min(plot.left + plotWidth, (event.clientX - bounds.left) / bounds.width * 760));
  };
  const updateSelection = () => {
    const left = Math.min(drag.startX, drag.currentX);
    selection.setAttribute('x', left);
    selection.setAttribute('width', Math.abs(drag.currentX - drag.startX));
    selection.setAttribute('visibility', drag.moved ? 'visible' : 'hidden');
  };
  svg.addEventListener('pointerdown', (event) => {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const x = plotX(event);
    drag = { pointerId: event.pointerId, startX: x, currentX: x, moved: false };
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.currentX = plotX(event);
    drag.moved ||= Math.abs(drag.currentX - drag.startX) > 12;
    if (drag.moved) event.preventDefault();
    updateSelection();
  });
  const finishSelection = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const completed = drag;
    drag = null;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (!completed.moved) return;
    const left = Math.min(completed.startX, completed.currentX);
    const right = Math.max(completed.startX, completed.currentX);
    const selected = points.map((point, index) => ({ index, x: xFor(point, index) })).filter(({ x }) => x >= left && x <= right).map(({ index }) => index);
    if (!selected.length || selected.length === points.length) return;
    view.start += selected[0];
    view.count = selected.at(-1) - selected[0] + 1;
    view.notice = `Zoomed to ${view.count} selected mark${view.count === 1 ? '' : 's'}.`;
    suppressClick = true;
    renderHistory();
  };
  svg.addEventListener('pointerup', finishSelection);
  svg.addEventListener('pointercancel', () => { drag = null; selection.setAttribute('visibility', 'hidden'); });
  svg.addEventListener('click', (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }, true);
  card.append(svg);
  if (view.compare) {
    const compare = document.createElement('p');
    compare.className = 'chart-note';
    compare.textContent = 'The range comparison above uses the same active filters; pan and zoom keep this chart focused on the selected marks.';
    card.append(compare);
  }
  const tableDetails = document.createElement('details');
  tableDetails.className = 'chart-table-alternative';
  const summary = document.createElement('summary');
  summary.textContent = 'Table alternative';
  tableDetails.append(summary);
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Category</th><th>Value</th><th>Attempts</th></tr></thead>';
  const body = document.createElement('tbody');
  points.forEach((point) => {
    const row = document.createElement('tr');
    [point.label, chartValue(point, series.metric), String(point.attemptIds.length)].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
  table.append(body);
  tableDetails.append(table);
  card.append(tableDetails);
  return card;
}

function renderHistoryCharts(records) {
  const specs = buildChartSpecs(records, historyView.filters.game);
  refs['history-charts'].replaceChildren(...specs.map((spec) => renderChartCard(spec, records)));
}

function currentComparison(history, filtered) {
  const filters = { ...historyView.filters };
  delete filters.startDate; delete filters.endDate; delete filters.attemptLimit;
  const comparable = filterHistory(history, filters);
  const range = historyView.activeRange;
  if (range === '30a' || range === '50a') {
    const count = range === '30a' ? 30 : 50;
    const current = buildProgressModel(filtered);
    const previous = buildProgressModel(comparable.slice(Math.max(0, comparable.length - count * 2), Math.max(0, comparable.length - count)));
    return { current, previous, accuracyDelta: current.accuracyPercent === null || previous.accuracyPercent === null ? null : current.accuracyPercent - previous.accuracyPercent,
      responseTimeDelta: current.averageResponseTimeSeconds === null || previous.averageResponseTimeSeconds === null ? null : current.averageResponseTimeSeconds - previous.averageResponseTimeSeconds };
  }
  if (range === 'all') {
    const current = buildProgressModel(filtered.slice(-20));
    const previous = buildProgressModel(filtered.slice(0, 20));
    return { current, previous, accuracyDelta: current.accuracyPercent === null || previous.accuracyPercent === null ? null : current.accuracyPercent - previous.accuracyPercent,
      responseTimeDelta: current.averageResponseTimeSeconds === null || previous.averageResponseTimeSeconds === null ? null : current.averageResponseTimeSeconds - previous.averageResponseTimeSeconds };
  }
  const start = historyView.filters.startDate;
  const end = historyView.filters.endDate;
  if (!start || !end) return { current: buildProgressModel(filtered), previous: buildProgressModel([]), accuracyDelta: null, responseTimeDelta: null };
  const days = Math.max(1, Math.round((Date.parse(`${end}T00:00:00`) - Date.parse(`${start}T00:00:00`)) / 86400000) + 1);
  const priorEnd = new Date(`${start}T00:00:00`);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - days + 1);
  return comparePeriods(comparable, { current: { start, end }, previous: { start: localIsoDate(priorStart), end: localIsoDate(priorEnd) } });
}

function renderHistoryComparison(history, filtered) {
  const comparison = currentComparison(history, filtered);
  const current = comparison.current;
  const previous = comparison.previous;
  const time = (value) => value === null ? '—' : `${value.toFixed(1)}s`;
  const delta = (value, suffix = '') => value === null ? 'No comparable prior range' : `${value > 0 ? '+' : ''}${value}${suffix}`;
  refs['history-comparison'].replaceChildren(...[
    [`${current.accuracyPercent ?? '—'}%`, `Accuracy (${delta(comparison.accuracyDelta, ' points')})`],
    [time(current.averageResponseTimeSeconds), `Speed (${delta(comparison.responseTimeDelta === null ? null : Number(comparison.responseTimeDelta.toFixed(1)), 's')})`],
    [`${current.attempts}`, `${previous.attempts} previous attempts`],
  ].map(([value, label]) => {
    const item = document.createElement('div');
    item.className = 'comparison-metric';
    const strong = document.createElement('strong');
    strong.textContent = value;
    const span = document.createElement('span');
    span.textContent = label;
    item.append(strong, span);
    return item;
  }));
}

function fallbackChallenge(recommendation) {
  if (!recommendation?.game || !recommendation?.difficulty) return null;
  const game = recommendation.game;
  const preset = { ...presetFor(game, recommendation.difficulty) };
  const focus = {};
  const filters = recommendation.focusFilter ?? {};
  let axisDetail = 'Keep the recorded workload focused while you repeat this pattern.';
  if (game === 'cash') {
    const type = filters.cash?.transactionTypes?.[0];
    if (type) focus.expectedType = type;
    if (recommendation.axis === 'pieces') {
      preset.splitCount = Math.max(1, preset.splitCount - 1);
      axisDetail = 'Use one fewer cash split first, then return to the observed piece load after sustained success.';
    }
  }
  if (game === 'memory') {
    const observed = Number(filters.memory?.digitsPerValue?.max ?? filters.memory?.totalDigits?.max);
    if (Number.isFinite(observed)) {
      const safe = Math.max(1, observed - 1);
      preset.minimumDigits = safe;
      preset.maximumDigits = safe;
      axisDetail = `Start one digit below the observed ${observed}-digit threshold, then raise only digit length after sustained success.`;
    }
  }
  if (game === 'task') {
    const kind = filters.task?.workflowKinds?.[0];
    if (kind) focus.workspaceKind = kind;
    const observed = Number(filters.task?.expectedSteps?.max);
    if (Number.isFinite(observed)) {
      const safe = Math.max(2, observed - 1);
      preset.minimumSteps = safe;
      preset.maximumSteps = safe;
      axisDetail = `Start with ${safe} steps, then raise only the workflow step count after sustained success.`;
    }
  }
  if (game === 'error-detection') {
    const family = filters.error?.puzzleFamilies?.[0];
    if (family) focus.puzzleFamily = family;
    const observed = Number(filters.error?.clueCount?.max);
    if (Number.isFinite(observed)) {
      preset.details = Math.max(3, observed - 1);
      preset.maximumErrors = Math.min(preset.maximumErrors, preset.details);
      axisDetail = `Start with ${preset.details} clues, then raise only clue count after sustained success.`;
    }
  }
  const options = game === 'cash'
    ? { distraction: false, cashSessionMode: 'testing', cashBuilder: false, customerRequests: false, timeLimitSeconds: state.timeLimitSeconds || 30 }
    : { distraction: false };
  return {
    ...recommendation, id: recommendation.id, game, difficulty: recommendation.difficulty, preset, focus, options,
    questionCount: 10, title: `Recommended next challenge: ${recommendation.target}`, basis: axisDetail,
    progressionRule: 'Complete two successful sessions before raising only this same workload axis.',
  };
}

function renderRecommendedChallenge(records) {
  const candidates = rankPracticeCandidates(records, historyPresetMap());
  const recommendation = recommendNextChallenge(records, { candidatePlans: candidates, currentChallenge: state.currentChallenge });
  const target = refs['history-recommendations'];
  const previous = refs['previous-challenges'];
  target.replaceChildren();
  previous.replaceChildren();
  let plan = recommendation.challenge ? recommendation : null;
  if (plan && (!plan.preset || !plan.options)) plan = fallbackChallenge(recommendation);
  const currentCandidate = state.currentChallenge && candidates.find((candidate) => candidate.id === state.currentChallenge.id);
  if (currentCandidate && !recommendation.recoveredCurrent) plan = { ...currentCandidate, ...state.currentChallenge, reason: state.currentChallenge.reason ?? currentCandidate.reason };
  if (!plan || !plan.preset || !plan.options) {
    const note = document.createElement('p');
    note.className = 'practice-note';
    note.textContent = recommendation.reason;
    target.append(note);
  } else {
    const card = document.createElement('article');
    card.className = 'practice-recommendation';
    const title = document.createElement('h4');
    title.textContent = `${PRACTICE_GAMES[plan.game]} — ${plan.target}`;
    const why = document.createElement('p');
    why.textContent = `Why recommended: ${recommendation.reason}`;
    const detail = document.createElement('p');
    detail.className = 'practice-note';
    detail.textContent = `Evidence: ${recommendation.evidenceCount ?? plan.evidenceStats?.attempts ?? 0} comparable attempts. ${plan.progressionRule ?? 'Only the relevant workload axis changes after sustained success.'}`;
    const review = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Review proposed settings';
    review.append(summary);
    appendPracticeSettings(review, plan);
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'secondary-button';
    apply.textContent = 'Use practice plan';
    apply.addEventListener('click', () => { saveCurrentChallenge({ ...plan, weaknessKey: recommendation.weaknessKey }); applyPracticePlan(plan); });
    card.append(title, why, detail, review, apply);
    if (state.currentChallenge?.id === plan.id) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'text-button';
      clear.textContent = 'Clear current challenge';
      clear.addEventListener('click', clearCurrentChallenge);
      card.append(clear);
    }
    target.append(card);
  }
  if (recommendation.previousChallenges.length) {
    const heading = document.createElement('h4');
    heading.textContent = 'Previous challenges';
    const list = document.createElement('ul');
    list.className = 'previous-challenge-list';
    recommendation.previousChallenges.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = `${entry.title}: started ${entry.startedAccuracyPercent ?? '—'}%, finished ${entry.finishedAccuracyPercent ?? '—'}% across ${entry.attempts} attempts${entry.completed ? ' — Completed' : ''}.`;
      list.append(item);
    });
    previous.append(heading, list);
  }
}

function renderHistoryRows(records) {
  refs['history-rows'].replaceChildren();
  if (records.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'empty-row'; cell.colSpan = 6;
    cell.textContent = 'No saved attempts match these filters.';
    row.append(cell); refs['history-rows'].append(row); return;
  }
  for (const record of records.slice().reverse()) {
    const row = document.createElement('tr');
    row.tabIndex = 0;
    row.title = 'Open attempt details';
    const open = () => openAttemptDetails(records, [record.attemptId], 'Selected attempt');
    row.addEventListener('click', open);
    row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    const cells = [new Date(record.timestamp).toLocaleString(), `${record.gameName}${record.sessionMode ? ` · ${record.sessionMode}` : ''}`,
      record.difficulty ?? 'Not recorded', record.outcome, record.responseTimeSeconds === null ? 'Not recorded' : `${record.responseTimeSeconds.toFixed(1)}s`, record.expectedAnswer ?? 'Not recorded'];
    row.append(...cells.map((value) => { const cell = document.createElement('td'); cell.textContent = value; return cell; }));
    refs['history-rows'].append(row);
  }
}

function renderFraudHistory(records) {
  const visible = historyView.filters.game === 'fraud-inspection';
  refs['fraud-history-panel'].hidden = !visible;
  if (!visible) return;
  const summary = summarizeFraudHistory(records.filter((record) => record.game === 'fraud-inspection'));
  const rate = (value) => value === null ? 'Not enough data' : value + '%';
  renderMetrics(refs['fraud-history-metrics'], [
    [String(summary.casesReviewed), 'Cases reviewed'],
    [rate(summary.exactSetAccuracyPercent), 'Exact-case accuracy'],
    [rate(summary.accuracyPercent === null ? null : Math.round(summary.accuracyPercent)), 'Accuracy across issue choices'],
    [summary.averageInspectionTimeSeconds === null ? '—' : summary.averageInspectionTimeSeconds.toFixed(1) + 's', 'Average inspection time'],
    [summary.medianInspectionTimeSeconds === null ? '—' : summary.medianInspectionTimeSeconds.toFixed(1) + 's', 'Median inspection time'],
    [rate(summary.falsePositiveRatePercent), 'False-positive rate'],
    [rate(summary.missedIssueRatePercent), 'Missed-issue rate'],
    [String(summary.cleanChecksCorrectlyRecognized), 'Clean checks correctly recognized'],
    [String(summary.currentStreak), 'Current perfect streak'],
    [String(summary.bestStreak), 'Best perfect streak'],
    [summary.mostFrequentlyMissedCategory ? summary.mostFrequentlyMissedCategory.label : 'None recorded', 'Most frequently missed type'],
  ]);
  refs['fraud-history-weakness'].textContent = summary.weakestCategory
    ? 'Weakest area: ' + summary.weakestCategory.label.toLowerCase() + ' (' + summary.weakestCategory.accuracyPercent + '% across ' + summary.weakestCategory.expectedCount + ' examples). ' + summary.recommendedChallenge
    : summary.recommendedChallenge;
  refs['fraud-history-categories'].replaceChildren();
  if (!summary.byCategory.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = 'Category results will appear after an inspection is submitted.';
    row.append(cell);
    refs['fraud-history-categories'].append(row);
  } else {
    for (const category of summary.byCategory) {
      const row = document.createElement('tr');
      const values = [
        category.label,
        String(category.foundCount),
        String(category.missedCount),
        String(category.falsePositiveCount),
        category.expectedCount ? category.accuracyPercent + '% (' + category.foundCount + '/' + category.expectedCount + ')' : '—',
      ];
      for (const value of values) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      refs['fraud-history-categories'].append(row);
    }
  }
  const groups = [
    ['Performance by case difficulty', summary.byDifficulty.map((group) => group.difficulty + ': '
      + (group.accuracyPercent === null ? 'no scored cases' : Math.round(group.accuracyPercent) + '% across ' + group.cases + ' cases'))],
    ['Performance by timer', summary.byTimer.map((group) => group.seconds + ' seconds: '
      + (group.accuracyPercent === null ? 'no scored cases' : Math.round(group.accuracyPercent) + '% across ' + group.cases + ' cases'))],
  ];
  refs['fraud-history-breakdowns'].replaceChildren(...groups.map(([headingText, values]) => {
    const article = document.createElement('article');
    article.className = 'fraud-history-breakdown';
    const heading = document.createElement('h4');
    heading.textContent = headingText;
    const list = document.createElement('ul');
    if (values.length) {
      for (const value of values) {
        const item = document.createElement('li');
        item.textContent = value;
        list.append(item);
      }
    } else {
      const item = document.createElement('li');
      item.textContent = 'No cases recorded yet.';
      list.append(item);
    }
    article.append(heading, list);
    return article;
  }));
}

function renderHistory() {
  const history = getHistory();
  const gameOnly = filterHistory(history, { game: historyView.filters.game });
  renderHistoryFilters(gameOnly);
  const records = filterHistory(history, historyView.filters);
  const model = buildProgressModel(records);
  renderProgressMetrics(model);
  renderHistoryVisuals(summarizeHistory(records));
  renderRecommendedChallenge(records);
  renderHistoryComparison(history, records);
  renderHistoryCharts(records);
  renderHistoryRows(records);
  renderFraudHistory(records);
}

function applyHistoryQuickRange(kind) {
  delete historyView.filters.startDate; delete historyView.filters.endDate; delete historyView.filters.attemptLimit;
  historyView.activeRange = kind;
  if (kind === 'today') historyView.filters.startDate = historyView.filters.endDate = shiftDate(0);
  if (kind === 'yesterday') historyView.filters.startDate = historyView.filters.endDate = shiftDate(-1);
  if (kind === '7d') { historyView.filters.startDate = shiftDate(-6); historyView.filters.endDate = shiftDate(0); }
  if (kind === '30d') { historyView.filters.startDate = shiftDate(-29); historyView.filters.endDate = shiftDate(0); }
  if (kind === '30a') historyView.filters.attemptLimit = 30;
  if (kind === '50a') historyView.filters.attemptLimit = 50;
  rerenderHistoryForFilter();
}

function openHistory() {
  if (['quiz', 'memory-read', 'memory-answer', 'task-briefing', 'task-workspace', 'error-detection'].includes(state.activeScreen)) {
    setMessage('Finish the current round before opening history.');
    return;
  }
  stopContinuousDistractionNoise();
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
  prepareDistractionAudio();
  const game = selectedGame();
  const difficulty = selectedDifficulty();
  if (state.practicePlan && (state.practicePlan.game !== game || state.practicePlan.difficulty !== difficulty)) clearPracticePlan();
  state.sessionId = makeSessionId();
  state.game = game;
  state.difficulty = difficulty;
  state.questionNumber = 0;
  state.results = [];
  state.errorDetectionFamilyDeck = [];
  state.errorDetectionStartedAt = 0;
  state.autoContinue = refs['auto-continue-toggle'].checked;

  if (game === 'fraud-inspection') {
    const runMode = refs['fraud-run-mode'].value;
    const questionCount = Number(refs['fraud-question-count'].value);
    const timeLimitSeconds = Number(refs['fraud-time-limit'].value);
    const custom = difficulty === 'Custom';
    const enabledCategories = custom
      ? [...refs['fraud-enabled-categories'].querySelectorAll('input:checked')].map((input) => input.value)
      : undefined;
    if (custom && !enabledCategories.length) {
      setMessage('Enable at least one issue category for Custom inspection.');
      refs['fraud-enabled-categories'].querySelector('input')?.focus();
      return;
    }
    if (custom && Number(refs['fraud-minimum-errors'].value) > Number(refs['fraud-maximum-errors'].value)) {
      setMessage('The minimum issue count cannot exceed the maximum.');
      refs['fraud-minimum-errors'].focus();
      return;
    }
    if (custom && Number(refs['fraud-maximum-errors'].value) === 0 && !refs['fraud-allow-clean'].checked) {
      setMessage('Allow no-error cases or set a maximum of at least one issue.');
      refs['fraud-maximum-errors'].focus();
      return;
    }
    if (!['rapid-review', 'endurance'].includes(runMode)
        && (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100)) {
      setMessage('Choose between 1 and 100 inspection cases.');
      refs['fraud-question-count'].focus();
      return;
    }
    if (runMode !== 'rapid-review'
        && (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 5 || timeLimitSeconds > 300)) {
      setMessage('Choose between 5 and 300 seconds per inspection.');
      refs['fraud-time-limit'].focus();
      return;
    }
    const overrides = {
      questionCount,
      timeLimitSeconds,
      ...(custom ? {
        minimumErrors: Number(refs['fraud-minimum-errors'].value),
        maximumErrors: Number(refs['fraud-maximum-errors'].value),
        allowNoErrorCases: refs['fraud-allow-clean'].checked,
        signatureDifficulty: refs['fraud-signature-difficulty'].value,
        handwritingSimilarity: refs['fraud-handwriting-similarity'].value,
        alterationSubtlety: refs['fraud-alteration-subtlety'].value,
        dateDifficulty: refs['fraud-date-difficulty'].value,
        nameMatchDifficulty: refs['fraud-name-difficulty'].value,
        amountMatchDifficulty: refs['fraud-amount-difficulty'].value,
        idDifficulty: refs['fraud-id-difficulty'].value,
        fieldDensity: refs['fraud-field-density'].value,
        zoomAvailable: refs['fraud-zoom-enabled'].checked,
        showTimer: refs['fraud-show-timer'].checked,
        automaticNext: refs['fraud-auto-next'].checked,
        instantFeedback: refs['fraud-instant-feedback'].checked,
        randomDifficultyMixing: refs['fraud-mix-difficulty'].checked,
        enabledCategories,
      } : {}),
    };
    state.fraudSettings = resolveFraudInspectionSettings(difficulty, overrides, runMode);
    if (state.fraudSettings.minimumErrors > state.fraudSettings.enabledCategories.length) {
      setMessage('Lower the minimum issues or enable more issue categories.');
      refs['fraud-minimum-errors'].focus();
      return;
    }
    state.fraudStoppedEarly = false;
    state.fraudCurrentStreak = 0;
    state.fraudBestStreak = 0;
    state.fraudDocumentZooms = new Map();
    startFraudInspection();
    return;
  }

  if (game === 'error-detection') {
    const questionCount = Number(refs['error-detection-question-count'].value);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 100) {
      setMessage('Choose between 1 and 100 Error Detection rounds.');
      refs['error-detection-question-count'].focus();
      return;
    }
    state.questionCount = questionCount;
    showNextErrorDetectionQuestion();
    return;
  }

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
  state.cashSessionMode = new FormData(refs['setup-form']).get('cashSessionMode') === 'guided' ? 'guided' : 'testing';
  state.timeLimitSeconds = state.cashSessionMode === 'guided' ? 0 : timeLimitSeconds;
  state.customerBillRequestsEnabled = refs['customer-bill-request-toggle'].checked;
  state.cashBuilderEnabled = refs['cash-builder-toggle'].checked || state.customerBillRequestsEnabled;
  refs['cash-builder-toggle'].checked = state.cashBuilderEnabled;
  showNextQuestion();
});

applyTheme(initialTheme());
renderFraudCategorySettings();
updateGameSetup();
updateFraudRunModeControls();

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
refs['cash-builder-toggle'].addEventListener('change', () => {
  if (!refs['cash-builder-toggle'].checked && refs['customer-bill-request-toggle'].checked) {
    refs['customer-bill-request-toggle'].checked = false;
    setMessage('Customer bill requests were turned off because they require the cash builder.');
  }
});
refs['customer-bill-request-toggle'].addEventListener('change', () => {
  if (refs['customer-bill-request-toggle'].checked) {
    refs['cash-builder-toggle'].checked = true;
    setMessage('Cash builder turned on for customer bill requests.');
  }
});
refs['flag-bill-request'].addEventListener('click', () => {
  const request = state.question?.customerBillRequest;
  if (!request?.canFlag) return;
  state.customerRequestFlagged = !state.customerRequestFlagged;
  updateCashBuilder();
});
refs['next-question'].addEventListener('click', () => {
  if (state.game === 'memory') showNextMemoryQuestion();
  else if (state.game === 'task') showNextTaskQuestion();
  else if (state.game === 'error-detection') showNextErrorDetectionQuestion();
  else if (state.game === 'fraud-inspection') showNextFraudInspectionCase();
  else showNextQuestion();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || event.repeat) return;
  if (state.activeScreen !== 'feedback' || event.target.closest('dialog[open]')) return;
  event.preventDefault();
  refs['next-question'].click();
});
refs['memory-answer-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  submitMemoryAnswer();
});
refs['memory-answer-now'].addEventListener('click', showMemoryAnswer);
refs['error-detection-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  submitErrorDetectionAttempt();
});
refs['fraud-inspection-form'].addEventListener('submit', (event) => {
  event.preventDefault();
  submitFraudInspectionAttempt();
});
refs['fraud-run-mode'].addEventListener('change', updateFraudRunModeControls);
refs['close-fraud-document-dialog'].addEventListener('click', () => refs['fraud-document-dialog'].close());
refs['fraud-document-dialog'].addEventListener('click', (event) => {
  if (event.target === refs['fraud-document-dialog']) refs['fraud-document-dialog'].close();
});
refs['fraud-document-dialog'].querySelectorAll('[data-fraud-dialog-zoom]').forEach((button) => button.addEventListener('click', () => {
  state.fraudDialogZoom = Math.max(0.7, Math.min(2.5, Math.round((state.fraudDialogZoom + Number(button.dataset.fraudDialogZoom)) * 100) / 100));
  const svg = refs['fraud-document-dialog-view'].querySelector('svg');
  if (svg) svg.style.width = (state.fraudDialogZoom * 100) + '%';
}));
refs['fraud-document-dialog'].querySelector('[data-fraud-dialog-reset]').addEventListener('click', () => {
  state.fraudDialogZoom = 1;
  const svg = refs['fraud-document-dialog-view'].querySelector('svg');
  if (svg) svg.style.width = '100%';
});
refs['error-detection-start-puzzle'].addEventListener('click', startErrorDetectionPuzzle);
refs['error-detection-no-errors'].addEventListener('change', () => {
  if (refs['error-detection-no-errors'].checked) state.errorDetailSelections.clear();
  updateErrorDetectionSelection();
});
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
refs['start-another'].addEventListener('click', () => {
  clearPracticePlan();
  resetDistractionAudioSetup();
  updateGameSetup();
  showScreen('setup');
});
refs['open-history'].addEventListener('click', openHistory);
refs['summary-history'].addEventListener('click', openHistory);
refs['back-to-setup'].addEventListener('click', () => {
  clearPracticePlan();
  resetDistractionAudioSetup();
  updateGameSetup();
  showScreen('setup');
});
refs['theme-toggle'].addEventListener('click', () => {
  const isDark = document.documentElement.dataset.theme === 'dark';
  applyTheme(isDark ? 'light' : 'dark', true);
});
refs['download-csv'].addEventListener('click', downloadHistory);
refs['history-game-tabs'].addEventListener('click', (event) => {
  const button = event.target.closest('button[data-history-game]');
  if (!button) return;
  historyView.filters = { game: button.dataset.historyGame };
  historyView.activeRange = 'all';
  renderHistory();
});
refs['history-quick-ranges'].addEventListener('click', (event) => {
  const button = event.target.closest('button[data-history-range]');
  if (button) applyHistoryQuickRange(button.dataset.historyRange);
});
refs['clear-history-filters'].addEventListener('click', () => {
  historyView.filters = { game: historyView.filters.game ?? 'all' };
  historyView.activeRange = 'all';
  renderHistory();
});
refs['close-attempt-detail'].addEventListener('click', () => refs['attempt-detail-dialog'].close());
refs['attempt-detail-dialog'].addEventListener('click', (event) => {
  if (event.target === refs['attempt-detail-dialog']) refs['attempt-detail-dialog'].close();
});
refs['clear-history'].addEventListener('click', () => {
  if (window.confirm('Clear all saved quiz history from this browser? This cannot be undone.')) {
    localStorage.removeItem(HISTORY_KEY);
    clearPracticePlan();
    // A current challenge is derived from the saved attempts, so it must not
    // survive an explicit full-history clear without the evidence behind it.
    localStorage.removeItem(CURRENT_CHALLENGE_KEY);
    state.currentChallenge = null;
    renderHistory();
    setMessage('Saved quiz history was cleared from this browser.');
  }
});

document.getElementById('clear-practice-plan').addEventListener('click', clearPracticePlan);
refs['setup-form'].addEventListener('input', (event) => {
  if (event.target.id === 'auto-continue-toggle') return;
  if (['question-count', 'memory-question-count', 'task-question-count', 'error-detection-question-count'].includes(event.target.id)) {
    if (state.practicePlan) state.practicePlan.questionCount = Number(event.target.value);
    renderActivePractice();
    return;
  }
  if (state.practicePlan) {
    clearPracticePlan();
    setMessage('Setup changed. The practice plan was cleared; your selected preset is active.');
  }
});
window.addEventListener('storage', (event) => {
  if (event.key !== HISTORY_KEY && event.key !== null) return;
  if (state.activeScreen === 'history') renderHistory();
  if (state.activeScreen === 'setup') {
    clearPracticePlan();
    updateGameSetup();
  }
});


// Explicit pairing; connection secrets stay in memory and are removed from the URL.
function setupQRAlarmConnection() {
  const status = document.querySelector('#qralarm-status');
  const input = document.querySelector('#qralarm-link');
  let connection = null;
  let pollTimer = null;
  const fields = ['sessionId', 'questionNumber', 'outcome', 'timeUsedSeconds',
    'evidenceVersion', 'game', 'difficulty', 'plannedQuestions', 'sessionStartedAt',
    'sessionCompletedAt', 'sessionElapsedSeconds', 'autoContinue', 'continuousNoise',
    'noiseMaintained', 'cashBuilder', 'customerRequests'];
  async function exchange(endpoint, body) {
    const response = await fetch(connection.bridge + endpoint, {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-QR-Token': connection.token, 'X-QR-Source': connection.source },
      body: JSON.stringify({ version: 2, ...body }), signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error('Connection rejected.');
    return response.json();
  }
  async function poll() {
    try {
      const request = await exchange('/poll', {});
      if (request.request_id) {
        let body;
        try {
          const records = getHistory(true).map((record) => {
            if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid saved history.');
            return Object.fromEntries(fields.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
          });
          body = { records };
        } catch {
          body = { error: 'Unable to read saved browser history' };
        }
        await exchange('/history', { request_id: request.request_id, captured_at: Date.now() / 1000, ...body });
        status.textContent = body.error ? 'Unavailable — saved history could not be read.' : 'Connected';
      }
      pollTimer = window.setTimeout(poll, 500);
    } catch {
      status.textContent = 'Reconnect required — use info <QR ID> --connect in QRAlarm.';
      connection = null;
    }
  }
  async function connect(link) {
    window.clearTimeout(pollTimer);
    try {
      const params = new URL(link).hash.slice(1);
      const values = Object.fromEntries(new URLSearchParams(params));
      const endpoint = new URL(values.bridge);
      if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1'
          || !endpoint.port || endpoint.pathname !== '/' || endpoint.search || endpoint.hash
          || endpoint.username || endpoint.password
          || !/^[A-Za-z0-9_-]{32,128}$/.test(values.token ?? '')
          || !/^[A-Za-z0-9_-]{1,128}$/.test(values.source ?? '')) throw new Error('Invalid pairing link.');
      connection = { ...values, bridge: endpoint.origin };
      let browserId = localStorage.getItem('qralarm-browser-history-id');
      if (!browserId) {
        browserId = crypto.randomUUID();
        localStorage.setItem('qralarm-browser-history-id', browserId);
      }
      await exchange('/pair', { browser_id: browserId });
      input.value = '';
      status.textContent = 'Connected';
      poll();
    } catch {
      connection = null;
      status.textContent = 'Unavailable — use a fresh pairing link for this browser history.';
    }
  }
  document.querySelector('#qralarm-connect').addEventListener('click', () => connect(input.value));
  function connectFromFragment() {
    if (!new URLSearchParams(location.hash.slice(1)).has('bridge')) return;
    const link = location.href;
    history.replaceState(null, '', location.pathname + location.search);
    document.querySelector('#qralarm-connection').open = true;
    connect(link);
  }
  window.addEventListener('hashchange', connectFromFragment);
  connectFromFragment();
  window.addEventListener('pagehide', () => { window.clearTimeout(pollTimer); connection = null; });
}
setupQRAlarmConnection();
