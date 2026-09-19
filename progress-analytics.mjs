// Pure local-history analytics. Unknown fields stay unknown so older attempts are
// never represented as easier, faster, or more complete than they were recorded.

const ANSWERED_OUTCOMES = new Set(['Correct', 'Incorrect', 'Timed Out']);
const OUTCOMES = new Set([...ANSWERED_OUTCOMES, 'Not answered']);
const GAME_NAMES = Object.freeze({
  cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation', 'error-detection': 'Error detection',
});
const GAME_BY_NAME = new Map(Object.entries(GAME_NAMES).map(([key, value]) => [value.toLowerCase(), key]));
const known = (value) => value !== null && value !== undefined && value !== '';
const boolean = (value) => typeof value === 'boolean' ? value : null;
const number = (value) => known(value) && Number.isFinite(Number(value)) ? Number(value) : null;
const positive = (value) => {
  const parsed = number(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
};
const integer = (value) => {
  const parsed = number(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
};
const percent = (part, total) => total ? Math.round((part / total) * 100) : null;
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const dateValue = (value) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const dayOf = (value) => {
  const parsed = dateValue(value);
  if (parsed === null) return null;
  const date = new Date(parsed);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const range = (value, bounds = {}) => {
  if (!bounds || (bounds.min === undefined && bounds.max === undefined)) return true;
  if (value === null || value === undefined) return false;
  return (bounds.min === undefined || value >= Number(bounds.min)) && (bounds.max === undefined || value <= Number(bounds.max));
};
const selected = (value, options) => !Array.isArray(options) || !options.length || options.includes(value);
const escaped = (value) => String(value ?? '').replace(/[|\\]/g, '\\$&');

export function gameOf(record) {
  if (!record || typeof record !== 'object') return null;
  if (Object.hasOwn(GAME_NAMES, record.game)) return record.game;
  const name = String(record.gameType ?? '').toLowerCase();
  return GAME_BY_NAME.get(name) ?? (record.amountDueCents != null ? 'cash' : null);
}

function denominationValues(record) {
  if (!Array.isArray(record.tenderBreakdown)) return null;
  const values = record.tenderBreakdown
    .filter((item) => item && integer(item.cents) !== null && integer(item.count) !== null && item.count > 0)
    .map((item) => integer(item.cents));
  return values.length ? [...new Set(values)] : [];
}

function memoryDigits(record) {
  if (Array.isArray(record.digitsByValue) && record.digitsByValue.every((value) => integer(value) !== null)) return record.digitsByValue.map(integer);
  if (!Array.isArray(record.expectedValues)) return null;
  const values = record.expectedValues.filter((value) => typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value));
  return values.length === record.expectedValues.length ? values.map((value) => value.replace('.', '').length) : null;
}

function taskCategories(record) {
  return Array.isArray(record.taskMistakeCategories)
    ? record.taskMistakeCategories.filter((item) => typeof item === 'string' && item)
    : null;
}

function normalizedAttemptId(record, index) {
  if (typeof record.attemptId === 'string' && record.attemptId) return record.attemptId;
  if (record.sessionId && integer(record.questionNumber) !== null) return `${record.sessionId}:${record.questionNumber}`;
  return `legacy:${index}:${escaped(record.timestamp)}`;
}

/** Return an additive normalized view of one history record. */
export function normalizeHistoryRecord(record, index = 0) {
  if (!record || typeof record !== 'object' || !OUTCOMES.has(record.outcome)) return null;
  const game = gameOf(record);
  if (!game) return null;
  const elapsed = positive(record.timeUsedSeconds);
  const digits = game === 'memory' ? memoryDigits(record) : null;
  const tenderValues = game === 'cash' ? denominationValues(record) : null;
  const dueCents = integer(record.amountDueCents);
  const tenderCents = integer(record.cashGivenCents);
  const derivedTransaction = dueCents !== null && tenderCents !== null
    ? tenderCents > dueCents ? 'Change' : tenderCents < dueCents ? 'Short' : 'Exact' : null;
  const mismatch = Array.isArray(record.mismatchPositions)
    ? record.mismatchPositions.filter((value) => integer(value) !== null).map(integer) : null;
  const optionalModeValues = {
    distraction: boolean(record.continuousNoise), cashBuilder: boolean(record.cashBuilder), customerRequests: boolean(record.customerRequests),
  };
  const optionalModes = Object.values(optionalModeValues).some((value) => value !== null) ? optionalModeValues : null;
  const available = new Set();
  const add = (name, value) => { if (known(value)) available.add(name); return value; };
  const attempt = {
    ...record,
    attemptId: normalizedAttemptId(record, index),
    sourceIndex: index,
    game,
    gameName: GAME_NAMES[game],
    day: dayOf(record.timestamp),
    timestampMs: dateValue(record.timestamp),
    isAnswered: ANSWERED_OUTCOMES.has(record.outcome),
    isCorrect: record.outcome === 'Correct',
    attemptAccuracyPercent: add('attemptAccuracyPercent', ANSWERED_OUTCOMES.has(record.outcome) ? record.outcome === 'Correct' ? 100 : 0 : null),
    responseTimeSeconds: add('responseTimeSeconds', elapsed),
    difficulty: known(record.difficulty) ? String(record.difficulty) : null,
    session: known(record.sessionId) ? String(record.sessionId) : null,
    sessionMode: known(record.sessionMode) ? String(record.sessionMode) : null,
    totalPieces: add('totalPieces', integer(record.tenderPieceCount)),
    billCount: add('billCount', integer(record.tenderBillCount)),
    coinCount: add('coinCount', integer(record.tenderCoinCount)),
    denominationTypes: add('denominationTypes', integer(record.tenderDenominationTypes)),
    denominations: add('denominations', tenderValues),
    dueCents: add('dueCents', dueCents),
    tenderCents: add('tenderCents', tenderCents),
    changeOrShortfallCents: add('changeOrShortfallCents', integer(record.changeOrShortfallCents)),
    transactionType: add('transactionType', record.cashTransactionType ?? derivedTransaction),
    customerRequestKind: add('customerRequestKind', record.customerBillRequestKind),
    customerRequestResult: add('customerRequestResult', record.customerRequestResult),
    answerMode: add('answerMode', record.answerMode),
    cashBuilder: add('cashBuilder', boolean(record.cashBuilder)),
    customerRequests: add('customerRequests', boolean(record.customerRequests)),
    optionalModes: add('optionalModes', optionalModes),
    digitsByValue: add('digitsByValue', digits),
    maxDigits: add('maxDigits', digits?.length ? Math.max(...digits) : null),
    totalDigits: add('totalDigits', integer(record.totalDigits) ?? (digits?.length ? digits.reduce((sum, value) => sum + value, 0) : null)),
    valueCount: add('valueCount', integer(record.valueCount) ?? digits?.length ?? null),
    decimalMode: add('decimalMode', typeof record.decimalMode === 'boolean' ? record.decimalMode : Array.isArray(record.expectedValues) ? record.expectedValues.some((value) => String(value).includes('.')) : null),
    readSeconds: add('readSeconds', positive(record.readTimeSeconds)),
    writeSeconds: add('writeSeconds', positive(record.writeTimeSeconds)),
    correctValueCount: add('correctValueCount', integer(record.correctValueCount)),
    mismatchPositions: add('mismatchPositions', mismatch),
    workspaceKind: add('workspaceKind', record.workspaceKind),
    expectedSteps: add('expectedSteps', integer(record.stepsExpected)),
    completedSteps: add('completedSteps', integer(record.stepsCompleted)),
    workspaceRows: add('workspaceRows', integer(record.workspaceRows)),
    workspaceTabs: add('workspaceTabs', integer(record.workspaceTabs)),
    briefingSeconds: add('briefingSeconds', positive(record.briefingSeconds)),
    recallSeconds: add('recallSeconds', positive(record.recallSeconds)),
    demoStepMilliseconds: add('demoStepMilliseconds', positive(record.demoStepMilliseconds)),
    sequenceAccuracyPercent: add('sequenceAccuracyPercent', positive(record.sequenceAccuracyPercent)),
    totalMistakes: add('totalMistakes', integer(record.mistakes)),
    taskMistakeCategories: add('taskMistakeCategories', taskCategories(record)),
    puzzleFamily: add('puzzleFamily', record.puzzleFamilyId ?? record.puzzleFamily),
    puzzleType: add('puzzleType', record.puzzleType),
    ruleLayers: add('ruleLayers', integer(record.ruleLayers)),
    clueCount: add('clueCount', integer(record.detailCount)),
    expectedAnomalyCount: add('expectedAnomalyCount', integer(record.expectedErrorCount)),
    selectedAnomalyCount: add('selectedAnomalyCount', integer(record.selectedErrorCount)),
    missedAnomalyCount: add('missedAnomalyCount', integer(record.missedAnomalyCount)),
    falseFlagCount: add('falseFlagCount', integer(record.falseFlagCount)),
    cleanPuzzle: add('cleanPuzzle', typeof record.cleanPuzzle === 'boolean' ? record.cleanPuzzle : null),
    timeLimitSeconds: add('timeLimitSeconds', positive(record.timeLimitSeconds)),
  };
  attempt.hasRecorded = (field) => available.has(field);
  attempt.recordedFields = available;
  return attempt;
}

/** Match the existing checkpoint behavior: a submitted answer replaces its checkpoint. */
export function deduplicateHistory(history) {
  const unique = new Map();
  (Array.isArray(history) ? history : []).forEach((record, index) => {
    const normalized = normalizeHistoryRecord(record, index);
    if (!normalized) return;
    const previous = unique.get(normalized.attemptId);
    if (previous && normalized.outcome === 'Not answered' && previous.outcome !== 'Not answered') return;
    unique.set(normalized.attemptId, normalized);
  });
  return [...unique.values()].sort((left, right) => (left.timestampMs ?? 0) - (right.timestampMs ?? 0) || left.sourceIndex - right.sourceIndex);
}

function listMatches(record, values) {
  return !Array.isArray(values) || !values.length || values.every((value) => record.denominations?.includes(Number(value)));
}

function optionalModesMatch(record, modes) {
  if (!modes || typeof modes !== 'object') return true;
  return Object.entries(modes).every(([key, enabled]) => enabled !== true || record.optionalModes?.[key] === true);
}

function gameMatches(record, filters) {
  const cash = filters.cash ?? {};
  const memory = filters.memory ?? {};
  const task = filters.task ?? {};
  const error = filters.error ?? {};
  if (record.game === 'cash') return listMatches(record, cash.denominations)
    && range(record.billCount, cash.billCount) && range(record.coinCount, cash.coinCount)
    && range(record.totalPieces, cash.totalPieces) && range(record.denominationTypes, cash.denominationTypes)
    && range(record.dueCents, cash.dueCents) && range(record.tenderCents, cash.tenderCents)
    && range(record.changeOrShortfallCents, cash.changeOrShortfallCents)
    && selected(record.transactionType, cash.transactionTypes) && selected(record.customerRequestKind, cash.customerRequestKinds)
    && selected(record.customerRequestResult, cash.customerRequestResults) && selected(record.answerMode, cash.answerModes)
    && selected(record.sessionMode, cash.sessionModes);
  if (record.game === 'memory') return range(record.maxDigits, memory.digitsPerValue)
    && range(record.totalDigits, memory.totalDigits) && range(record.valueCount, memory.valueCount)
    && range(record.readSeconds, memory.readSeconds) && range(record.writeSeconds, memory.writeSeconds)
    && range(record.correctValueCount, memory.correctValueCount)
    && (memory.decimalMode === undefined || record.decimalMode === memory.decimalMode)
    && (!Array.isArray(memory.mismatchPositions) || !memory.mismatchPositions.length || memory.mismatchPositions.some((position) => record.mismatchPositions?.includes(Number(position))));
  if (record.game === 'task') return selected(record.workspaceKind, task.workflowKinds)
    && range(record.expectedSteps, task.expectedSteps) && range(record.workspaceRows, task.rows)
    && range(record.workspaceTabs, task.tabs) && range(record.briefingSeconds, task.briefingSeconds)
    && range(record.recallSeconds, task.recallSeconds) && range(record.demoStepMilliseconds, task.demoStepMilliseconds)
    && range(record.sequenceAccuracyPercent, task.sequenceAccuracyPercent) && range(record.totalMistakes, task.totalMistakes)
    && (!Array.isArray(task.mistakeCategories) || !task.mistakeCategories.length || task.mistakeCategories.some((item) => record.taskMistakeCategories?.includes(item)));
  if (record.game === 'error-detection') return selected(record.puzzleFamily, error.puzzleFamilies)
    && selected(record.puzzleType, error.puzzleTypes) && range(record.ruleLayers, error.ruleLayers)
    && range(record.clueCount, error.clueCount) && range(record.expectedAnomalyCount, error.expectedAnomalyCount)
    && range(record.selectedAnomalyCount, error.selectedAnomalyCount) && range(record.missedAnomalyCount, error.missedAnomalyCount)
    && range(record.falseFlagCount, error.falseFlagCount) && range(record.timeLimitSeconds, error.timeLimitSeconds)
    && (error.cleanPuzzle === undefined || record.cleanPuzzle === error.cleanPuzzle);
  return true;
}

/** Apply all common and game-specific filters as one intersection. */
export function filterHistory(history, filters = {}) {
  let records = deduplicateHistory(history);
  const game = filters.game ?? 'all';
  const start = filters.startDate ?? filters.dateRange?.start;
  const end = filters.endDate ?? filters.dateRange?.end;
  records = records.filter((record) => (game === 'all' || record.game === game)
    && selected(record.outcome, filters.outcomes)
    && selected(record.difficulty, filters.difficulties)
    && selected(record.session, filters.sessions)
    && selected(record.sessionMode, filters.sessionModes)
    && range(record.attemptAccuracyPercent, filters.accuracyPercent)
    && (!start || (record.day && record.day >= start))
    && (!end || (record.day && record.day <= end))
    && range(record.responseTimeSeconds, filters.responseTimeSeconds)
    && optionalModesMatch(record, filters.optionalModes)
    && gameMatches(record, filters));
  const limit = Number(filters.attemptLimit ?? 0);
  return limit > 0 ? records.slice(-limit) : records;
}

const commonFields = (records) => [
  { id: 'outcomes', label: 'Outcome', type: 'facet', options: unique(records.map((record) => record.outcome)) },
  { id: 'difficulties', label: 'Difficulty', type: 'facet', options: unique(records.map((record) => record.difficulty)) },
  { id: 'sessions', label: 'Session', type: 'facet', options: unique(records.map((record) => record.session)) },
  { id: 'sessionModes', label: 'Session mode', type: 'facet', options: unique(records.map((record) => record.sessionMode)) },
  { id: 'accuracyPercent', label: 'Attempt accuracy', type: 'range', unit: '%', available: countAvailable(records, 'attemptAccuracyPercent') },
  { id: 'responseTimeSeconds', label: 'Response time', type: 'range', unit: 'seconds', available: countAvailable(records, 'responseTimeSeconds') },
  { id: 'optionalModes', label: 'Optional modes', type: 'modes', options: ['distraction', 'cashBuilder', 'customerRequests'] },
];
const rangeField = (id, label, unit, records, key) => ({ id, label, type: 'range', unit, available: countAvailable(records, key) });
const facetField = (id, label, records, getter) => ({ id, label, type: 'facet', options: unique(records.flatMap((record) => getter(record) ?? [])) });
function unique(values) { return [...new Set(values.filter(known).map(String))].sort((left, right) => left.localeCompare(right, undefined, { numeric: true })); }
function countAvailable(records, key) { return records.filter((record) => record[key] !== null && record[key] !== undefined).length; }

/** Describe the controls supported by actual fields of the selected game. */
export function buildGameFilters(history, game = 'all') {
  const records = Array.isArray(history) && history.every((record) => record?.attemptId) ? history : filterHistory(history, { game });
  const selectedRecords = game === 'all' ? records : records.filter((record) => record.game === game);
  const fields = game === 'all' ? commonFields(selectedRecords) : [...commonFields(selectedRecords)];
  if (game === 'cash') fields.push(
    facetField('cash.denominations', 'Contains denominations', selectedRecords, (record) => record.denominations?.map((value) => `$${(value / 100).toFixed(2)}`)),
    rangeField('cash.billCount', 'Bills given', 'pieces', selectedRecords, 'billCount'), rangeField('cash.coinCount', 'Coins given', 'pieces', selectedRecords, 'coinCount'),
    rangeField('cash.totalPieces', 'Total pieces', 'pieces', selectedRecords, 'totalPieces'), rangeField('cash.denominationTypes', 'Denomination types', 'types', selectedRecords, 'denominationTypes'),
    rangeField('cash.dueCents', 'Amount due', 'cents', selectedRecords, 'dueCents'), rangeField('cash.tenderCents', 'Tendered value', 'cents', selectedRecords, 'tenderCents'),
    rangeField('cash.changeOrShortfallCents', 'Change or shortfall', 'cents', selectedRecords, 'changeOrShortfallCents'), facetField('cash.transactionTypes', 'Transaction type', selectedRecords, (record) => [record.transactionType]),
    facetField('cash.customerRequestKinds', 'Customer request', selectedRecords, (record) => [record.customerRequestKind]), facetField('cash.customerRequestResults', 'Request result', selectedRecords, (record) => [record.customerRequestResult]),
    facetField('cash.answerModes', 'Answer mode', selectedRecords, (record) => [record.answerMode]), facetField('cash.sessionModes', 'Guided or testing', selectedRecords, (record) => [record.sessionMode]),
  );
  if (game === 'memory') fields.push(
    rangeField('memory.digitsPerValue', 'Digits per value', 'digits', selectedRecords, 'maxDigits'), rangeField('memory.totalDigits', 'Total digit load', 'digits', selectedRecords, 'totalDigits'),
    rangeField('memory.valueCount', 'Values per round', 'values', selectedRecords, 'valueCount'), { id: 'memory.decimalMode', label: 'Decimal mode', type: 'boolean', available: countAvailable(selectedRecords, 'decimalMode') },
    rangeField('memory.readSeconds', 'Display time', 'seconds', selectedRecords, 'readSeconds'), rangeField('memory.writeSeconds', 'Answer limit', 'seconds', selectedRecords, 'writeSeconds'),
    rangeField('memory.correctValueCount', 'Correct values', 'values', selectedRecords, 'correctValueCount'), facetField('memory.mismatchPositions', 'Mismatch position', selectedRecords, (record) => record.mismatchPositions),
  );
  if (game === 'task') fields.push(
    facetField('task.workflowKinds', 'Workflow', selectedRecords, (record) => [record.workspaceKind]), rangeField('task.expectedSteps', 'Expected steps', 'steps', selectedRecords, 'expectedSteps'),
    rangeField('task.rows', 'Workspace rows', 'rows', selectedRecords, 'workspaceRows'), rangeField('task.tabs', 'Workspace tabs', 'tabs', selectedRecords, 'workspaceTabs'),
    rangeField('task.briefingSeconds', 'Briefing limit', 'seconds', selectedRecords, 'briefingSeconds'), rangeField('task.recallSeconds', 'Recall limit', 'seconds', selectedRecords, 'recallSeconds'),
    rangeField('task.demoStepMilliseconds', 'Demo pace', 'milliseconds', selectedRecords, 'demoStepMilliseconds'), rangeField('task.sequenceAccuracyPercent', 'Sequence accuracy', '%', selectedRecords, 'sequenceAccuracyPercent'),
    rangeField('task.totalMistakes', 'Total mistakes', 'actions', selectedRecords, 'totalMistakes'), facetField('task.mistakeCategory', 'Mistake category', selectedRecords, (record) => record.taskMistakeCategories),
  );
  if (game === 'error-detection') fields.push(
    facetField('error.puzzleFamilies', 'Puzzle family', selectedRecords, (record) => [record.puzzleFamily]), facetField('error.puzzleTypes', 'Puzzle type', selectedRecords, (record) => [record.puzzleType]),
    rangeField('error.ruleLayers', 'Rule layers', 'layers', selectedRecords, 'ruleLayers'), rangeField('error.clueCount', 'Clues', 'clues', selectedRecords, 'clueCount'),
    rangeField('error.expectedAnomalyCount', 'Expected anomalies', 'anomalies', selectedRecords, 'expectedAnomalyCount'), { id: 'error.cleanPuzzle', label: 'Clean puzzle', type: 'boolean', available: countAvailable(selectedRecords, 'cleanPuzzle') },
    rangeField('error.selectedAnomalyCount', 'Selected anomalies', 'anomalies', selectedRecords, 'selectedAnomalyCount'), rangeField('error.missedAnomalyCount', 'Missed anomalies', 'anomalies', selectedRecords, 'missedAnomalyCount'),
    rangeField('error.falseFlagCount', 'False flags', 'flags', selectedRecords, 'falseFlagCount'), rangeField('error.timeLimitSeconds', 'Time limit', 'seconds', selectedRecords, 'timeLimitSeconds'),
  );
  return { game, availableAttempts: selectedRecords.length, fields };
}

function modelRows(records) { return Array.isArray(records) && records.every((record) => record?.attemptId) ? records : deduplicateHistory(records); }

/** Build consistent cards, daily trends, streaks, and comparison inputs from records. */
export function buildProgressModel(history) {
  const records = modelRows(history);
  const answered = records.filter((record) => record.isAnswered);
  const correct = answered.filter((record) => record.isCorrect);
  const times = answered.map((record) => record.responseTimeSeconds).filter((value) => value !== null);
  const dailyMap = new Map();
  records.forEach((record) => {
    if (!record.day) return;
    if (!dailyMap.has(record.day)) dailyMap.set(record.day, []);
    dailyMap.get(record.day).push(record);
  });
  const daily = [...dailyMap.entries()].map(([day, rows]) => {
    const rowModel = buildProgressModelShallow(rows);
    return { day, ...rowModel, attemptIds: rows.map((row) => row.attemptId) };
  }).sort((left, right) => left.day.localeCompare(right.day));
  const correctOnly = answered.filter((record) => record.outcome === 'Correct');
  let running = 0;
  let longestStreak = 0;
  for (const record of answered) { running = record.isCorrect ? running + 1 : 0; longestStreak = Math.max(longestStreak, running); }
  const currentStreak = [...answered].reverse().findIndex((record) => !record.isCorrect);
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = records.filter((record) => record.day === today);
  return {
    attemptIds: records.map((record) => record.attemptId), attempts: records.length, answered: answered.length, correct: correct.length,
    incorrect: answered.filter((record) => record.outcome === 'Incorrect').length, timedOut: answered.filter((record) => record.outcome === 'Timed Out').length,
    accuracyPercent: percent(correct.length, answered.length), averageResponseTimeSeconds: average(times), eligibleResponseAttempts: times.length,
    attemptsToday: todayRows.length, attemptsPerDay: average(daily.map((row) => row.attempts)), accuracyPerDay: average(daily.map((row) => row.accuracyPercent).filter((value) => value !== null)),
    speedPerDay: average(daily.map((row) => row.averageResponseTimeSeconds).filter((value) => value !== null)), daily,
    bestAccuracyPercent: daily.length ? Math.max(...daily.map((row) => row.accuracyPercent ?? 0)) : null,
    recentAccuracyPercent: buildProgressModelShallow(answered.slice(-20)).accuracyPercent,
    longestCorrectStreak: longestStreak, currentCorrectStreak: currentStreak === -1 ? correctOnly.length : currentStreak,
  };
}

function buildProgressModelShallow(records) {
  const answered = records.filter((record) => record.isAnswered);
  const correct = answered.filter((record) => record.isCorrect);
  const times = answered.map((record) => record.responseTimeSeconds).filter((value) => value !== null);
  return { attempts: records.length, answered: answered.length, correct: correct.length, accuracyPercent: percent(correct.length, answered.length), averageResponseTimeSeconds: average(times), eligibleResponseAttempts: times.length };
}

/** Compare explicit date periods; dates are inclusive calendar days. */
export function comparePeriods(history, periods = {}) {
  const records = modelRows(history);
  const inPeriod = (period) => records.filter((record) => record.day && (!period?.start || record.day >= period.start) && (!period?.end || record.day <= period.end));
  const currentRows = inPeriod(periods.current);
  const previousRows = inPeriod(periods.previous);
  const current = buildProgressModel(currentRows);
  const previous = buildProgressModel(previousRows);
  return {
    current, previous,
    accuracyDelta: current.accuracyPercent === null || previous.accuracyPercent === null ? null : current.accuracyPercent - previous.accuracyPercent,
    responseTimeDelta: current.averageResponseTimeSeconds === null || previous.averageResponseTimeSeconds === null ? null : current.averageResponseTimeSeconds - previous.averageResponseTimeSeconds,
    attemptsDelta: current.attempts - previous.attempts,
  };
}

function aggregatePoint(key, label, rows, metric = 'accuracy') {
  const model = buildProgressModelShallow(rows);
  return {
    key, label, count: metric === 'attempts' ? model.attempts : model.answered,
    value: metric === 'attempts' ? model.attempts : metric === 'time' ? model.averageResponseTimeSeconds : model.accuracyPercent,
    attemptIds: rows.map((record) => record.attemptId), detail: model,
  };
}

function groupedPoints(records, getKey, metric = 'accuracy') {
  const groups = new Map();
  records.forEach((record) => {
    const values = getKey(record);
    const entries = Array.isArray(values) ? values : [values];
    entries.filter(known).forEach((entry) => {
      const label = String(entry);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(record);
    });
  });
  return [...groups.entries()].map(([label, rows]) => aggregatePoint(label, label, rows, metric)).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
}

function chart(id, title, points, options = {}) {
  return { id, title, kind: options.kind ?? 'bar', description: options.description ?? '', series: [{ id: options.seriesId ?? 'value', label: options.seriesLabel ?? title, metric: options.metric ?? 'accuracy', points }], attemptIds: [...new Set(points.flatMap((point) => point.attemptIds))] };
}
function band(value, bands, suffix = '') { if (value === null) return null; const found = bands.find(([max]) => value <= max); return found ? found[1] : `${bands.at(-1)[0]}+${suffix}`; }

/** Return accessible, data-only specifications for shared and game-specific charts. */
export function buildChartSpecs(history, game = 'all') {
  const records = modelRows(history).filter((record) => game === 'all' || record.game === game);
  const model = buildProgressModel(records);
  const daily = model.daily;
  const specs = [
    chart('accuracy-over-time', 'Accuracy over time', daily.map((row) => ({ key: row.day, label: row.day, value: row.accuracyPercent, count: row.answered, attemptIds: row.attemptIds, detail: row })), { kind: 'line' }),
    chart('response-time-over-time', 'Response time over time', daily.filter((row) => row.averageResponseTimeSeconds !== null).map((row) => ({ key: row.day, label: row.day, value: row.averageResponseTimeSeconds, count: row.eligibleResponseAttempts, attemptIds: row.attemptIds, detail: row })), { kind: 'line', metric: 'time' }),
    chart('attempts-per-day', 'Attempts per day', daily.map((row) => ({ key: row.day, label: row.day, value: row.attempts, count: row.attempts, attemptIds: row.attemptIds, detail: row })), { metric: 'attempts' }),
    chart('outcomes', 'Correct, incorrect, and timed out', groupedPoints(records, (record) => record.outcome, 'attempts'), { metric: 'attempts' }),
    chart('accuracy-by-difficulty', 'Accuracy by difficulty', groupedPoints(records, (record) => record.difficulty)),
    chart('speed-vs-accuracy', 'Speed versus accuracy', groupedPoints(records, (record) => record.difficulty).map((point) => ({ ...point, x: point.detail.averageResponseTimeSeconds, y: point.value })), { kind: 'scatter' }),
    chart('performance-distribution', 'Response-time distribution', groupedPoints(records.filter((record) => record.responseTimeSeconds !== null), (record) => band(record.responseTimeSeconds, [[5, '0–5s'], [10, '6–10s'], [20, '11–20s'], [40, '21–40s']], 's'), 'attempts'), { metric: 'attempts' }),
    chart('best-vs-recent', 'First attempts versus recent attempts', [aggregatePoint('first', 'First 20', records.slice(0, 20)), aggregatePoint('recent', 'Recent 20', records.slice(-20))]),
    chart('difficulty-progression', 'Difficulty progression', groupedPoints(records, (record) => record.difficulty, 'attempts'), { kind: 'line', metric: 'attempts' }),
    chart('improvement-by-period', 'Improvement by period', [aggregatePoint('first-ten', 'First 10', records.slice(0, 10)), aggregatePoint('recent-ten', 'Recent 10', records.slice(-10))]),
    chart('consistency', 'Daily consistency', daily.map((row) => ({ key: row.day, label: row.day, value: row.accuracyPercent, count: row.answered, attemptIds: row.attemptIds, detail: row })), { kind: 'line' }),
  ];
  const weaknesses = findWeaknesses(records, game);
  if (weaknesses.length) specs.push(chart('weakest-variables', 'Weakest recorded variables', weaknesses.slice(0, 8).map((weakness) => ({
    key: weakness.key, label: weakness.label, value: weakness.accuracyPercent, count: weakness.attempts, attemptIds: weakness.attemptIds, detail: weakness,
  }))));
  const strongGroups = groupedPoints(records, (record) => game === 'all' ? record.gameName : record.difficulty)
    .filter((point) => point.value !== null).sort((left, right) => right.value - left.value || right.count - left.count).slice(0, 8);
  if (strongGroups.length) specs.push(chart('strongest-variables', 'Strongest documented variables', strongGroups));
  if (game === 'cash') specs.push(
    chart('cash-denomination-accuracy', 'Accuracy by denomination', groupedPoints(records.filter((record) => record.denominations !== null), (record) => record.denominations.map((value) => `$${(value / 100).toFixed(2)}`))),
    chart('cash-pieces', 'Performance by total pieces', groupedPoints(records, (record) => band(record.totalPieces, [[3, '1–3'], [7, '4–7'], [12, '8–12']], ' pieces'))),
    chart('cash-denomination-types', 'Performance by denomination types', groupedPoints(records, (record) => record.denominationTypes)),
    chart('cash-transaction-type', 'Performance by transaction type', groupedPoints(records, (record) => record.transactionType)),
    chart('cash-due-band', 'Performance by amount due', groupedPoints(records, (record) => band(record.dueCents, [[5000, '$0–50'], [10000, '$50–100'], [50000, '$100–500']], ' cents'))),
    chart('cash-customer-request', 'Performance by customer request', groupedPoints(records, (record) => record.customerRequestKind ?? 'No request')),
  );
  if (game === 'memory') specs.push(
    chart('memory-digit-length', 'Accuracy by digit length', groupedPoints(records, (record) => record.maxDigits)),
    chart('memory-digit-speed', 'Response time by digit length', groupedPoints(records, (record) => record.maxDigits, 'time'), { metric: 'time' }),
    chart('memory-total-load', 'Accuracy by total digit load', groupedPoints(records, (record) => record.totalDigits)),
    chart('memory-value-count', 'Performance by value count', groupedPoints(records, (record) => record.valueCount)),
    chart('memory-read-duration', 'Accuracy by display duration', groupedPoints(records, (record) => record.readSeconds)),
    chart('memory-mismatch-position', 'Mismatch position frequency', groupedPoints(records.filter((record) => record.mismatchPositions !== null), (record) => record.mismatchPositions, 'attempts'), { metric: 'attempts' }),
  );
  if (game === 'task') specs.push(
    chart('task-workflow', 'Sequence quality by workflow', groupedPoints(records, (record) => record.workspaceKind)),
    chart('task-steps', 'Performance by expected steps', groupedPoints(records, (record) => record.expectedSteps)),
    chart('task-workspace-load', 'Performance by rows and tabs', groupedPoints(records, (record) => record.workspaceRows !== null && record.workspaceTabs !== null ? `${record.workspaceRows} rows · ${record.workspaceTabs} tabs` : null)),
    chart('task-timing', 'Performance by recall limit', groupedPoints(records, (record) => record.recallSeconds)),
    chart('task-mistake-type', 'Mistake category frequency', groupedPoints(records.filter((record) => record.taskMistakeCategories !== null), (record) => record.taskMistakeCategories, 'attempts'), { metric: 'attempts' }),
  );
  if (game === 'error-detection') specs.push(
    chart('error-family', 'Accuracy by puzzle family', groupedPoints(records, (record) => record.puzzleFamily)),
    chart('error-rule-layer', 'Accuracy by rule layer', groupedPoints(records, (record) => record.ruleLayers)),
    chart('error-clues', 'Accuracy by clue count', groupedPoints(records, (record) => record.clueCount)),
    chart('error-anomaly-count', 'Accuracy by anomaly count', groupedPoints(records, (record) => record.expectedAnomalyCount)),
    chart('error-missed-versus-false', 'Missed anomalies versus false flags', [aggregatePoint('missed', 'Missed anomalies', records.filter((record) => (record.missedAnomalyCount ?? 0) > 0), 'attempts'), aggregatePoint('false', 'False flags', records.filter((record) => (record.falseFlagCount ?? 0) > 0), 'attempts')], { metric: 'attempts' }),
    chart('error-clean-puzzle', 'Clean-puzzle accuracy', groupedPoints(records, (record) => record.cleanPuzzle === null ? null : record.cleanPuzzle ? 'Clean' : 'Has anomalies')),
  );
  return specs.filter((spec) => spec.series.some((series) => series.points.length));
}

function weaknessGroups(records, game) {
  const groups = [];
  const add = (id, label, getter, filterPatch, axis) => {
    const map = new Map();
    records.forEach((record) => {
      const values = getter(record);
      const entries = Array.isArray(values) ? values : [values];
      entries.filter(known).forEach((value) => {
        const key = String(value);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(record);
      });
    });
    map.forEach((rows, key) => groups.push({ key: `${game}:${id}:${key}`, label: `${label}: ${key}`, rows, filterPatch: filterPatch(key), axis }));
  };
  if (game === 'cash') {
    add('transaction', 'Transaction', (record) => record.transactionType, (value) => ({ game: 'cash', cash: { transactionTypes: [value] } }), 'transaction');
    add('pieces', 'Total pieces', (record) => band(record.totalPieces, [[3, '1–3'], [7, '4–7'], [12, '8–12']], ' pieces'), (value) => ({ game: 'cash', cash: { totalPieces: value === '1–3' ? { min: 1, max: 3 } : value === '4–7' ? { min: 4, max: 7 } : { min: 8, max: 12 } } }), 'pieces');
    add('denominations', 'Denomination', (record) => record.denominations?.map((value) => `$${(value / 100).toFixed(2)}`), (value) => ({ game: 'cash', cash: { denominations: [Math.round(Number(value.slice(1)) * 100)] } }), 'denomination');
  }
  if (game === 'memory') {
    add('digits', 'Digits per value', (record) => record.maxDigits, (value) => ({ game: 'memory', memory: { digitsPerValue: { min: Number(value), max: Number(value) } } }), 'digits');
    add('load', 'Total digit load', (record) => record.totalDigits, (value) => ({ game: 'memory', memory: { totalDigits: { min: Number(value), max: Number(value) } } }), 'totalDigits');
    add('values', 'Value count', (record) => record.valueCount, (value) => ({ game: 'memory', memory: { valueCount: { min: Number(value), max: Number(value) } } }), 'valueCount');
  }
  if (game === 'task') {
    add('workflow', 'Workflow', (record) => record.workspaceKind, (value) => ({ game: 'task', task: { workflowKinds: [value] } }), 'workflow');
    add('steps', 'Expected steps', (record) => record.expectedSteps, (value) => ({ game: 'task', task: { expectedSteps: { min: Number(value), max: Number(value) } } }), 'steps');
    add('mistake', 'Mistake type', (record) => record.taskMistakeCategories, (value) => ({ game: 'task', task: { mistakeCategories: [value] } }), 'mistakeCategory');
  }
  if (game === 'error-detection') {
    add('family', 'Puzzle family', (record) => record.puzzleFamily, (value) => ({ game: 'error-detection', error: { puzzleFamilies: [value] } }), 'family');
    add('clues', 'Clue count', (record) => record.clueCount, (value) => ({ game: 'error-detection', error: { clueCount: { min: Number(value), max: Number(value) } } }), 'clues');
    add('rules', 'Rule layers', (record) => record.ruleLayers, (value) => ({ game: 'error-detection', error: { ruleLayers: { min: Number(value), max: Number(value) } } }), 'ruleLayers');
  }
  return groups;
}

/** Find recurring, explainable weak groups; one poor attempt can never qualify. */
export function findWeaknesses(history, game = 'all') {
  const records = modelRows(history).filter((record) => record.isAnswered && (game === 'all' || record.game === game));
  const result = [];
  Object.keys(GAME_NAMES).filter((key) => game === 'all' || key === game).forEach((currentGame) => {
    const gameRows = records.filter((record) => record.game === currentGame);
    const baseline = buildProgressModelShallow(gameRows);
    if (gameRows.length < 5 || baseline.accuracyPercent === null) return;
    weaknessGroups(gameRows, currentGame).forEach((group) => {
      const rows = group.rows.filter((record) => record.isAnswered);
      if (rows.length < 5) return;
      const model = buildProgressModelShallow(rows);
      const errors = rows.filter((record) => !record.isCorrect).length;
      const slow = baseline.averageResponseTimeSeconds && model.averageResponseTimeSeconds
        ? rows.filter((record) => record.responseTimeSeconds !== null && record.responseTimeSeconds >= baseline.averageResponseTimeSeconds * 1.2).length : 0;
      const accuracyGap = baseline.accuracyPercent - model.accuracyPercent;
      const speedSlowdownPercent = baseline.averageResponseTimeSeconds && model.averageResponseTimeSeconds
        ? Math.round(((model.averageResponseTimeSeconds / baseline.averageResponseTimeSeconds) - 1) * 100) : 0;
      // Slow responses are evidence for speed-only practice; wrong and timed-out
      // answers remain the stricter evidence gate for an accuracy diagnosis.
      if ((errors + slow) < 2 || (accuracyGap < 10 && speedSlowdownPercent < 20)) return;
      const latest = Math.max(...rows.map((record) => record.timestampMs ?? 0));
      result.push({ ...group, game: currentGame, attempts: rows.length, errors, slow, accuracyPercent: model.accuracyPercent,
        averageResponseTimeSeconds: model.averageResponseTimeSeconds, baselineAccuracyPercent: baseline.accuracyPercent,
        baselineResponseTimeSeconds: baseline.averageResponseTimeSeconds, accuracyGap, speedSlowdownPercent, latest,
        attemptIds: rows.map((record) => record.attemptId), score: Math.max(0, accuracyGap) * 2 + Math.max(0, speedSlowdownPercent) + Math.min(rows.length, 20) / 10 });
    });
  });
  return result.sort((left, right) => right.score - left.score || right.latest - left.latest || right.attempts - left.attempts || left.key.localeCompare(right.key));
}

function previousChallengeEvidence(records) {
  const plans = new Map();
  records.forEach((record) => {
    let plan;
    try { plan = typeof record.practicePlanJson === 'string' ? JSON.parse(record.practicePlanJson) : record.practicePlanJson; } catch { return; }
    if (!plan?.id || !record.isAnswered) return;
    if (!plans.has(plan.id)) plans.set(plan.id, { id: plan.id, title: plan.title ?? plan.target ?? 'Practice challenge', game: plan.game, records: [] });
    plans.get(plan.id).records.push(record);
  });
  return [...plans.values()].map((plan) => {
    const ordered = plan.records.slice().sort((left, right) => (left.timestampMs ?? 0) - (right.timestampMs ?? 0));
    const model = buildProgressModelShallow(ordered);
    const started = buildProgressModelShallow(ordered.slice(0, Math.min(5, ordered.length)));
    const finished = buildProgressModelShallow(ordered.slice(-Math.min(10, ordered.length)));
    return { id: plan.id, title: plan.title, game: plan.game, attempts: plan.records.length, accuracyPercent: model.accuracyPercent,
      startedAccuracyPercent: started.accuracyPercent, finishedAccuracyPercent: finished.accuracyPercent,
      completed: plan.records.length >= 10 && finished.accuracyPercent !== null && finished.accuracyPercent >= 90 };
  });
}

/** Select one global, explainable next challenge from the weakest supported group. */
export function recommendNextChallenge(history, options = {}) {
  const records = modelRows(history);
  const weaknesses = findWeaknesses(records, options.game ?? 'all');
  const recovered = previousChallengeEvidence(records);
  const current = options.currentChallenge ?? null;
  const currentRecovered = current?.id && recovered.some((entry) => entry.id === current.id && entry.completed);
  const usable = weaknesses.filter((weakness) => !(currentRecovered && current?.weaknessKey === weakness.key));
  const weakness = usable[0];
  if (!weakness) return { challenge: null, previousChallenges: recovered, recoveredCurrent: Boolean(currentRecovered), reason: 'No recurring weakness has enough evidence yet.' };
  const sourceCandidates = Array.isArray(options.candidatePlans) ? options.candidatePlans : [];
  const candidate = sourceCandidates.find((plan) => plan?.game === weakness.game && plan?.difficulty === weakness.rows[0]?.difficulty) ?? null;
  const description = `Your accuracy is ${weakness.accuracyPercent}% across ${weakness.attempts} comparable attempts versus ${weakness.baselineAccuracyPercent}% for ${GAME_NAMES[weakness.game]}.`
    + (weakness.speedSlowdownPercent >= 20 ? ` These attempts are ${weakness.speedSlowdownPercent}% slower than that game baseline.` : '');
  return {
    ...(candidate ?? {}), id: candidate?.id ?? `next:${weakness.key}`, game: weakness.game, difficulty: candidate?.difficulty ?? weakness.rows[0]?.difficulty ?? 'Easy',
    target: candidate?.target ?? weakness.label, title: candidate?.title ?? `Recommended next challenge: ${weakness.label}`,
    weaknessKey: weakness.key, focusFilter: weakness.filterPatch, axis: candidate?.axis ?? weakness.axis,
    evidenceCount: weakness.attempts, accuracyPercent: weakness.accuracyPercent, baselineAccuracyPercent: weakness.baselineAccuracyPercent,
    speedSlowdownPercent: weakness.speedSlowdownPercent, attemptIds: weakness.attemptIds, reason: description,
    previousChallenges: recovered, recoveredCurrent: Boolean(currentRecovered), challenge: candidate ?? true,
  };
}
