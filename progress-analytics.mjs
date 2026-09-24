// Pure local-history analytics. Unknown fields stay unknown so older attempts are
// never represented as easier, faster, or more complete than they were recorded.

const ANSWERED_OUTCOMES = new Set(['Correct', 'Incorrect', 'Timed Out']);
const OUTCOMES = new Set([...ANSWERED_OUTCOMES, 'Not answered']);
const GAME_NAMES = Object.freeze({
  cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation', 'error-detection': 'Error detection',
  'fraud-inspection': 'Check & ID Fraud Inspection',
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

function cashWorkload(record) {
  if (!Array.isArray(record.tenderBreakdown)) return null;
  const terms = record.tenderBreakdown.filter((item) => integer(item.cents) > 0 && integer(item.count) > 0);
  return { terms: terms.length, multiplications: terms.filter((item) => item.count > 1).length,
    additions: Math.max(0, terms.length - 1), hundredBills: terms.filter((item) => item.cents === 10000).reduce((sum, item) => sum + item.count, 0) };
}

function digitDistance(expected, received) {
  if (!Array.isArray(expected) || !Array.isArray(received)) return null;
  let wrong = 0; let omitted = 0; let extra = 0; let decimal = 0;
  expected.forEach((value, index) => {
    const answer = String(received[index] ?? '').replaceAll(/\s/g, '');
    const target = String(value).replaceAll(/\s/g, '');
    const left = target.replace('.', ''); const right = answer.replace('.', '');
    for (let position = 0; position < Math.min(left.length, right.length); position += 1) wrong += Number(left[position] !== right[position]);
    omitted += Math.max(0, left.length - right.length);
    extra += Math.max(0, right.length - left.length);
    decimal += Number(target.includes('.') !== answer.includes('.') || (target.includes('.') && target.indexOf('.') !== answer.indexOf('.')));
  });
  return { wrong, omitted, extra, decimal };
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
  const answered = ANSWERED_OUTCOMES.has(record.outcome);
  const elapsed = positive(record.timeUsedSeconds);
  const digits = game === 'memory' ? memoryDigits(record) : null;
  const tenderValues = game === 'cash' ? denominationValues(record) : null;
  const workload = game === 'cash' ? cashWorkload(record) : null;
  const digitErrors = game === 'memory' && answered ? digitDistance(record.expectedValues, record.answeredValues) : null;
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
    isAnswered: answered,
    isCorrect: record.outcome === 'Correct',
    attemptAccuracyPercent: add('attemptAccuracyPercent', answered ? record.outcome === 'Correct' ? 100 : 0 : null),
    responseTimeSeconds: add('responseTimeSeconds', elapsed),
    difficulty: known(record.difficulty) ? String(record.difficulty) : null,
    session: known(record.sessionId) ? String(record.sessionId) : null,
    sessionMode: known(record.sessionMode) ? String(record.sessionMode) : null,
    totalPieces: add('totalPieces', integer(record.tenderPieceCount)),
    billCount: add('billCount', integer(record.tenderBillCount)),
    coinCount: add('coinCount', integer(record.tenderCoinCount)),
    denominationTypes: add('denominationTypes', integer(record.tenderDenominationTypes)),
    denominations: add('denominations', tenderValues),
    hundredBillCount: add('hundredBillCount', workload?.hundredBills ?? null),
    workloadMultiplications: add('workloadMultiplications', workload?.multiplications ?? null),
    workloadAdditions: add('workloadAdditions', workload?.additions ?? null),
    cashAddClicks: add('cashAddClicks', integer(record.cashAddClicks)),
    cashRemoveClicks: add('cashRemoveClicks', integer(record.cashRemoveClicks)),
    cashQuickEntries: add('cashQuickEntries', integer(record.cashQuickEntries)),
    cashClearClicks: add('cashClearClicks', integer(record.cashClearClicks)),
    dueCents: add('dueCents', dueCents),
    tenderCents: add('tenderCents', tenderCents),
    changeOrShortfallCents: add('changeOrShortfallCents', integer(record.changeOrShortfallCents)),
    cashSignedErrorCents: add('cashSignedErrorCents', answered && integer(record.userDeclaredAmountCents) !== null && integer(record.changeOrShortfallCents) !== null
      ? integer(record.userDeclaredAmountCents) - integer(record.changeOrShortfallCents) : null),
    cashWrongType: add('cashWrongType', answered && known(record.userAnswer) && known(record.cashTransactionType) ? record.userAnswer !== record.cashTransactionType : null),
    cashWrongAmount: add('cashWrongAmount', answered && known(record.userAnswer) && integer(record.userDeclaredAmountCents) !== null && integer(record.changeOrShortfallCents) !== null
      ? record.userAnswer === (record.cashTransactionType ?? derivedTransaction) && integer(record.userDeclaredAmountCents) !== integer(record.changeOrShortfallCents) : null),
    cashBuilderMismatch: add('cashBuilderMismatch', answered && record.cashBuilder === true && boolean(record.breakdownMatchesDeclaredAmount) !== null ? !record.breakdownMatchesDeclaredAmount : null),
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
    wrongDigits: add('wrongDigits', digitErrors?.wrong ?? null),
    omittedDigits: add('omittedDigits', digitErrors?.omitted ?? null),
    extraDigits: add('extraDigits', digitErrors?.extra ?? null),
    decimalErrors: add('decimalErrors', digitErrors?.decimal ?? null),
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
    taskMissingCount: add('taskMissingCount', integer(record.taskMissingCount)),
    taskExtraCount: add('taskExtraCount', integer(record.taskExtraCount)),
    taskOutOfOrderCount: add('taskOutOfOrderCount', integer(record.taskOutOfOrderCount)),
    taskTabChanges: add('taskTabChanges', integer(record.taskTabChanges)),
    taskCorrections: add('taskCorrections', integer(record.taskCorrections)),
    puzzleFamily: add('puzzleFamily', record.puzzleFamilyId ?? record.puzzleFamily),
    puzzleType: add('puzzleType', record.puzzleType),
    ruleLayers: add('ruleLayers', integer(record.ruleLayers)),
    clueCount: add('clueCount', integer(record.detailCount)),
    expectedAnomalyCount: add('expectedAnomalyCount', integer(record.expectedErrorCount)),
    selectedAnomalyCount: add('selectedAnomalyCount', integer(record.selectedErrorCount)),
    missedAnomalyCount: add('missedAnomalyCount', integer(record.missedAnomalyCount)),
    falseFlagCount: add('falseFlagCount', integer(record.falseFlagCount)),
    selectionDistance: add('selectionDistance', answered && game === 'error-detection' && integer(record.missedAnomalyCount) !== null && integer(record.falseFlagCount) !== null
      ? integer(record.missedAnomalyCount) + integer(record.falseFlagCount) : answered && game === 'fraud-inspection' && integer(record.fraudFalseNegativeCount) !== null && integer(record.fraudFalsePositiveCount) !== null
        ? integer(record.fraudFalseNegativeCount) + integer(record.fraudFalsePositiveCount) : null),
    cleanPuzzle: add('cleanPuzzle', typeof record.cleanPuzzle === 'boolean' ? record.cleanPuzzle : null),
    timeLimitSeconds: add('timeLimitSeconds', positive(record.timeLimitSeconds)),
    fraudRunMode: add('fraudRunMode', record.fraudRunMode),
    fraudCaseDifficulty: add('fraudCaseDifficulty', record.fraudCaseDifficulty),
    fraudTimeLimitSeconds: add('fraudTimeLimitSeconds', positive(record.fraudTimeLimitSeconds)),
    fraudExpectedIssueCount: add('fraudExpectedIssueCount', integer(record.fraudExpectedCategories?.length)),
    fraudFalsePositiveCount: add('fraudFalsePositiveCount', integer(record.fraudFalsePositiveCount)),
    fraudFalseNegativeCount: add('fraudFalseNegativeCount', integer(record.fraudFalseNegativeCount)),
    fraudExpectedCategories: add('fraudExpectedCategories', Array.isArray(record.fraudExpectedCategories)
      ? record.fraudExpectedCategories.filter((item) => typeof item === 'string' && item) : null),
    fraudCleanCase: add('fraudCleanCase', boolean(record.fraudCleanCase)),
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
  const fraud = filters.fraud ?? {};
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
  if (record.game === 'fraud-inspection') return selected(record.fraudRunMode, fraud.runModes)
    && selected(record.fraudCaseDifficulty, fraud.caseDifficulties)
    && range(record.fraudTimeLimitSeconds, fraud.timeLimitSeconds)
    && range(record.fraudExpectedIssueCount, fraud.expectedIssueCount)
    && range(record.fraudFalsePositiveCount, fraud.falsePositiveCount)
    && range(record.fraudFalseNegativeCount, fraud.missedIssueCount)
    && (!Array.isArray(fraud.issueCategories) || !fraud.issueCategories.length
      || fraud.issueCategories.some((id) => record.fraudExpectedCategories?.includes(id)))
    && (fraud.cleanCase === undefined || record.fraudCleanCase === fraud.cleanCase);
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
  if (game === 'fraud-inspection') fields.push(
    facetField('fraud.runModes', 'Speed training', selectedRecords, (record) => [record.fraudRunMode]),
    facetField('fraud.caseDifficulties', 'Case difficulty', selectedRecords, (record) => [record.fraudCaseDifficulty]),
    facetField('fraud.issueCategories', 'Actual issue category', selectedRecords, (record) => record.fraudExpectedCategories),
    rangeField('fraud.expectedIssueCount', 'Actual issues per case', 'issues', selectedRecords, 'fraudExpectedIssueCount'),
    rangeField('fraud.falsePositiveCount', 'False positives', 'issues', selectedRecords, 'fraudFalsePositiveCount'),
    rangeField('fraud.missedIssueCount', 'Missed issues', 'issues', selectedRecords, 'fraudFalseNegativeCount'),
    rangeField('fraud.timeLimitSeconds', 'Seconds per case', 'seconds', selectedRecords, 'fraudTimeLimitSeconds'),
    { id: 'fraud.cleanCase', label: 'Clean check and ID', type: 'boolean', available: countAvailable(selectedRecords, 'fraudCleanCase') },
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

export const ERROR_SEVERITY_BANDS = Object.freeze([
  Object.freeze({ key: 'correct', label: 'Correct', min: 0, max: 0 }),
  Object.freeze({ key: 'small', label: 'Small', min: 0, max: 5 }),
  Object.freeze({ key: 'moderate', label: 'Moderate', min: 5, max: 15 }),
  Object.freeze({ key: 'large', label: 'Large', min: 15, max: 30 }),
  Object.freeze({ key: 'very-large', label: 'Very large', min: 30, max: Infinity }),
]);

const ERROR_DISTRIBUTION_BANDS = Object.freeze([
  { key: 'zero', label: '0%', test: (value) => value === 0 },
  { key: '0-5', label: '>0–5%', test: (value) => value > 0 && value <= 5 },
  { key: '5-10', label: '>5–10%', test: (value) => value > 5 && value <= 10 },
  { key: '10-20', label: '>10–20%', test: (value) => value > 10 && value <= 20 },
  { key: '20-50', label: '>20–<50%', test: (value) => value > 20 && value < 50 },
  { key: '50-plus', label: '≥50%', test: (value) => value >= 50 },
]);

const CASH_DENOMINATION_LABELS = Object.freeze({
  10000: '$100 bills', 5000: '$50 bills', 2000: '$20 bills', 1000: '$10 bills', 500: '$5 bills', 100: '$1 bills',
  25: 'Quarters', 10: 'Dimes', 5: 'Nickels', 1: 'Pennies',
});

const FRAUD_ISSUE_LABELS = Object.freeze({
  'payee-mismatch': 'Payee/name mismatch', 'amount-mismatch': 'Written/numeric amount mismatch', 'date-issue': 'Check date issue',
  'check-alteration': 'Check alteration', 'handwriting-issue': 'Handwriting/ink issue', 'missing-required-field': 'Missing check field',
  'endorsement-missing': 'Missing endorsement', 'endorsement-signature-mismatch': 'Endorsement signature',
  'maker-signature-suspicious': 'Maker signature', 'check-number-mismatch': 'Check number/MICR', 'routing-issue': 'Routing control',
  'account-information-issue': 'Account information', 'id-expired': 'Expired ID',
  'id-information-inconsistent': 'ID information mismatch', 'id-altered': 'ID alteration',
});

function validDenominationCountMap(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([denomination, count]) => Object.hasOwn(CASH_DENOMINATION_LABELS, denomination)
      && integer(count) !== null && integer(count) >= 0));
}

function round2(value) { return Number.isFinite(value) ? Number(value.toFixed(2)) : null; }
function errorPercent(part, total) { return total ? Number(((part / total) * 100).toFixed(1)) : null; }
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function centsText(value) {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents)) return 'Not recorded';
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}$${Math.floor(absolute / 100).toLocaleString('en-US')}.${String(absolute % 100).padStart(2, '0')}`;
}

function errorSeverityFor(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  if (value === 0) return ERROR_SEVERITY_BANDS[0];
  if (value <= 5) return ERROR_SEVERITY_BANDS[1];
  if (value <= 15) return ERROR_SEVERITY_BANDS[2];
  if (value <= 30) return ERROR_SEVERITY_BANDS[3];
  return ERROR_SEVERITY_BANDS[4];
}

function numericErrorResponse({ record, game, label, expectedValue, submittedValue, unit = 'number', answerExpected = true }) {
  if (!answerExpected || !known(expectedValue) || !known(submittedValue)
      || !Number.isFinite(Number(expectedValue)) || !Number.isFinite(Number(submittedValue))) return null;
  const expected = Number(expectedValue);
  const submitted = Number(submittedValue);
  const difference = submitted - expected;
  const absoluteError = Math.abs(difference);
  const percentageError = expected === 0 ? absoluteError === 0 ? 0 : null : absoluteError / Math.abs(expected) * 100;
  return {
    attemptId: record.attemptId, game, label, timestamp: record.timestamp, outcome: record.outcome,
    expectedValue: expected, submittedValue: submitted, signedDifference: difference, absoluteError,
    percentageError: round2(percentageError), percentageErrorLabel: percentageError === null ? `N/A (correct answer is ${unit === 'cents' ? centsText(expected) : expected})` : `${round2(percentageError)}%`,
    unit, severity: errorSeverityFor(percentageError),
  };
}

function newErrorGroups() { return new Map(); }

function addErrorOpportunity(groups, { key, label, game, error, record, kind = 'category', percentageError = null, falseNegative = false, falsePositive = false }) {
  if (!groups.has(key)) groups.set(key, { key, label, game, kind, opportunities: 0, errors: 0, falseNegatives: 0, falsePositives: 0, attemptIds: new Set(), percentages: [] });
  const group = groups.get(key);
  group.opportunities += 1;
  group.errors += Number(Boolean(error));
  group.falseNegatives += Number(Boolean(falseNegative));
  group.falsePositives += Number(Boolean(falsePositive));
  group.attemptIds.add(record.attemptId);
  if (Number.isFinite(percentageError)) group.percentages.push(percentageError);
}

function finishErrorGroups(groups, minimumOpportunities, sortBy) {
  const rows = [...groups.values()].map((group) => {
    const interval = wilsonInterval(group.errors, group.opportunities);
    const ids = [...group.attemptIds];
    return {
      ...group, attemptIds: ids, attemptCount: ids.length, correct: group.opportunities - group.errors,
      errorRatePercent: errorPercent(group.errors, group.opportunities), displayRate: `${errorPercent(group.errors, group.opportunities)}% (${group.errors} of ${group.opportunities})`,
      interval, meanPercentageError: group.percentages.length ? round2(average(group.percentages)) : null,
      medianPercentageError: group.percentages.length ? round2(median(group.percentages)) : null,
      eligibleForRanking: group.opportunities >= minimumOpportunities,
      evidenceLabel: group.opportunities >= 10 ? 'Recurring signal' : group.opportunities >= minimumOpportunities ? 'Early signal' : 'Limited signal',
    };
  });
  const compare = (left, right) => {
    if (sortBy === 'errors') return right.errors - left.errors || right.opportunities - left.opportunities || left.label.localeCompare(right.label, undefined, { numeric: true });
    if (sortBy === 'attempts') return right.attemptCount - left.attemptCount || left.label.localeCompare(right.label, undefined, { numeric: true });
    if (sortBy === 'lowest') return left.errorRatePercent - right.errorRatePercent || right.opportunities - left.opportunities || left.label.localeCompare(right.label, undefined, { numeric: true });
    if (sortBy === 'magnitude') return (right.meanPercentageError ?? -1) - (left.meanPercentageError ?? -1) || right.opportunities - left.opportunities;
    if (sortBy === 'alphabetical') return left.label.localeCompare(right.label, undefined, { numeric: true });
    return right.errorRatePercent - left.errorRatePercent || right.opportunities - left.opportunities || left.label.localeCompare(right.label, undefined, { numeric: true });
  };
  return rows.sort(compare);
}

function summarizeErrorOutcomes(records) {
  const completed = records.filter((record) => ANSWERED_OUTCOMES.has(record.outcome));
  const incorrect = completed.filter((record) => record.outcome === 'Incorrect').length;
  const timedOut = completed.filter((record) => record.outcome === 'Timed Out').length;
  const errors = incorrect + timedOut;
  const correct = completed.filter((record) => record.outcome === 'Correct').length;
  return {
    attempts: completed.length, incorrect, timedOut, errors,
    errorRatePercent: errorPercent(errors, completed.length), accuracyPercent: errorPercent(correct, completed.length),
  };
}

function rateTrend(records) {
  const byDay = new Map();
  for (const record of records) {
    if (!record.day || !ANSWERED_OUTCOMES.has(record.outcome)) continue;
    if (!byDay.has(record.day)) byDay.set(record.day, []);
    byDay.get(record.day).push(record);
  }
  return [...byDay.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([day, rows]) => {
    const stats = summarizeErrorOutcomes(rows);
    return { key: day, label: day, value: stats.errorRatePercent, count: stats.attempts, errors: stats.errors,
      opportunities: stats.attempts, attemptIds: rows.map((record) => record.attemptId) };
  });
}

function addSettingGroups(rows, record, add) {
  const game = record.game;
  const settings = [];
  const difficulty = game === 'fraud-inspection' ? record.fraudCaseDifficulty ?? record.difficulty : record.difficulty;
  if (known(difficulty)) settings.push(['difficulty', `Difficulty · ${difficulty}`]);
  const timeLimit = game === 'fraud-inspection' ? record.fraudTimeLimitSeconds ?? record.timeLimitSeconds : record.timeLimitSeconds;
  if (known(timeLimit)) settings.push(['time-limit', `Time limit · ${timeLimit}s`]);
  if (game === 'cash') {
    if (known(record.answerMode)) settings.push(['answer-mode', `Answer mode · ${record.answerMode}`]);
    if (known(record.customerBillRequestKind)) settings.push(['customer-request', `Customer request · ${record.customerBillRequestKind}`]);
    if (known(record.cashSessionMode ?? record.sessionMode)) settings.push(['cash-mode', `Cash mode · ${record.cashSessionMode ?? record.sessionMode}`]);
  } else if (game === 'memory') {
    if (known(record.readTimeSeconds)) settings.push(['display-time', `Display · ${record.readTimeSeconds}s`]);
    if (known(record.writeTimeSeconds)) settings.push(['answer-time', `Answer time · ${record.writeTimeSeconds}s`]);
  } else if (game === 'task') {
    if (known(record.workspaceKind)) settings.push(['workspace', `Workflow · ${record.workspaceKind}`]);
    if (known(record.stepsExpected)) settings.push(['steps', `${record.stepsExpected} expected steps`]);
  } else if (game === 'error-detection') {
    if (known(record.puzzleFamilyId ?? record.puzzleFamily)) settings.push(['puzzle-family', `Puzzle · ${record.puzzleFamilyId ?? record.puzzleFamily}`]);
    if (known(record.ruleLayers)) settings.push(['rule-layers', `${record.ruleLayers} rule layers`]);
    if (known(record.detailCount)) settings.push(['clues', `${record.detailCount} clues`]);
  } else if (game === 'fraud-inspection') {
    if (known(record.fraudRunMode)) settings.push(['run-mode', `Run mode · ${record.fraudRunMode}`]);
    if (known(record.fraudExpectedCategories?.length)) settings.push(['issue-count', `${record.fraudExpectedCategories.length} actual issues`]);
  }
  settings.forEach(([key, label]) => add(rows, { key: `${game}:${key}:${label}`, label, game, error: record.outcome !== 'Correct', record }));
}

function addMemoryEvidence(record, byCategory, byRawInput, mistakeCounts, mistakesForAttempt) {
  const expected = Array.isArray(record.expectedValues) && record.expectedValues.length
    && record.expectedValues.every((value) => typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) ? record.expectedValues : null;
  const answered = Array.isArray(record.answeredValues) ? record.answeredValues.map((value) => String(value ?? '').replaceAll(/\s/g, '')) : null;
  if (!expected?.length || record.outcome === 'Not answered') return;
  const isTimeout = record.outcome === 'Timed Out';
  addErrorOpportunity(byCategory, { key: 'memory:exact-sequence', label: 'Exact number sequence', game: 'memory', error: record.outcome !== 'Correct', record });
  expected.forEach((target, valueIndex) => {
    const received = isTimeout ? '' : answered?.[valueIndex] ?? '';
    const targetDigits = target.replaceAll('.', '');
    const receivedDigits = received.replaceAll('.', '');
    const digitLength = targetDigits.length;
    const sequenceError = isTimeout || target !== received;
    const lengthKey = `memory:value-length:${digitLength}`;
    addErrorOpportunity(byCategory, { key: lengthKey, label: `${digitLength}-digit recall`, game: 'memory', error: sequenceError, record });
    if (sequenceError) {
      const reason = isTimeout ? 'Answer timeout' : received === '' ? 'Missing value' : 'Incorrect number';
      mistakesForAttempt.push({ key: `memory:${reason.toLowerCase().replaceAll(' ', '-')}`, label: reason, detail: `${valueIndex + 1}${valueIndex === 0 ? 'st' : valueIndex === 1 ? 'nd' : valueIndex === 2 ? 'rd' : 'th'} value (${digitLength} digits)` });
      mistakeCounts.set(reason, (mistakeCounts.get(reason) ?? 0) + 1);
    }
    if (known(record.readTimeSeconds)) {
      addErrorOpportunity(byRawInput, { key: `memory:read-time:${record.readTimeSeconds}`, label: `Display time · ${record.readTimeSeconds}s`, game: 'memory', error: sequenceError, record });
    }
    if (known(record.writeTimeSeconds)) {
      addErrorOpportunity(byRawInput, { key: `memory:write-time:${record.writeTimeSeconds}`, label: `Answer limit · ${record.writeTimeSeconds}s`, game: 'memory', error: sequenceError, record });
    }
    if (isTimeout) return;
    for (let position = 0; position < targetDigits.length; position += 1) {
      const receivedDigit = receivedDigits[position] ?? '';
      const missing = receivedDigit === '';
      const wrong = !missing && receivedDigit !== targetDigits[position];
      addErrorOpportunity(byRawInput, { key: `memory:digit-position:${position + 1}`, label: `Digit position ${position + 1}`, game: 'memory', error: missing || wrong, record });
      addErrorOpportunity(byRawInput, { key: 'memory:missing-digit', label: 'Missing digit', game: 'memory', error: missing, record });
      addErrorOpportunity(byRawInput, { key: 'memory:wrong-digit', label: 'Wrong digit', game: 'memory', error: wrong, record });
      if (missing || wrong) {
        const label = missing ? `Missing digit · position ${position + 1}` : `Wrong digit · position ${position + 1}`;
        mistakesForAttempt.push({ key: missing ? 'memory:missing-digit' : 'memory:wrong-digit', label,
          detail: `Value ${valueIndex + 1}: expected ${targetDigits[position]}, entered ${missing ? 'nothing' : receivedDigit}` });
        mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
      }
    }
    const extraDigit = receivedDigits.length > targetDigits.length;
    addErrorOpportunity(byRawInput, { key: 'memory:extra-digit', label: 'Added digit', game: 'memory', error: extraDigit, record });
    if (extraDigit) {
      const label = 'Added digit';
      mistakesForAttempt.push({ key: 'memory:extra-digit', label, detail: `Value ${valueIndex + 1} has ${receivedDigits.length - targetDigits.length} extra digit(s)` });
      mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
    }
    const decimalWrong = target.includes('.') !== received.includes('.') || (target.includes('.') && target.indexOf('.') !== received.indexOf('.'));
    addErrorOpportunity(byRawInput, { key: 'memory:decimal-placement', label: 'Decimal point placement', game: 'memory', error: decimalWrong, record });
    if (decimalWrong) {
      const label = 'Wrong decimal placement';
      mistakesForAttempt.push({ key: 'memory:decimal-placement', label, detail: `Value ${valueIndex + 1}: correct ${target}, entered ${received}` });
      mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
    }
  });
}

function addTaskEvidence(record, byCategory, byRawInput, numericResponses, mistakesForAttempt, mistakeCounts) {
  if (known(record.workspaceKind)) addErrorOpportunity(byCategory, {
    key: `task:workspace:${record.workspaceKind}`, label: `${record.workspaceKind[0].toUpperCase()}${record.workspaceKind.slice(1)} workflow`,
    game: 'task', error: record.outcome !== 'Correct', record,
  });
  const evidence = Array.isArray(record.taskStepEvidence) ? record.taskStepEvidence : null;
  if (evidence) for (const step of evidence) {
    const status = step?.status;
    if (!['correct', 'missing', 'wrong-value', 'out-of-order', 'wrong-target'].includes(status)) continue;
    const error = status !== 'correct';
    const fieldLabel = String(step.targetLabel || step.targetId || step.type || 'Expected action');
    const typeLabel = String(step.type || 'action');
    const expectedNumeric = typeof step.expectedValue === 'number' || typeof step.expectedValue === 'string' && /^-?(?:\d+|\d*\.\d+)$/.test(step.expectedValue.trim()) ? Number(step.expectedValue) : null;
    const actualNumeric = typeof step.actualValue === 'number' || typeof step.actualValue === 'string' && /^-?(?:\d+|\d*\.\d+)$/.test(step.actualValue.trim()) ? Number(step.actualValue) : null;
    const numericPercent = expectedNumeric !== null && actualNumeric !== null
      ? expectedNumeric === 0 ? actualNumeric === 0 ? 0 : null : Math.abs(actualNumeric - expectedNumeric) / Math.abs(expectedNumeric) * 100 : null;
    addErrorOpportunity(byCategory, { key: `task:action:${typeLabel}`, label: `${typeLabel.replaceAll('-', ' ')} actions`, game: 'task', error, record, percentageError: numericPercent });
    addErrorOpportunity(byRawInput, { key: `task:field:${step.targetId || fieldLabel}`, label: fieldLabel, game: 'task', error, record, percentageError: numericPercent });
    if (error) {
      const label = status === 'wrong-value' ? `Wrong value · ${fieldLabel}` : status === 'out-of-order' ? `Out of order · ${fieldLabel}` : status === 'wrong-target' ? `Wrong field · ${fieldLabel}` : `Missing action · ${fieldLabel}`;
      mistakesForAttempt.push({ key: `task:${status}`, label, detail: [known(step.expectedValue) ? `Expected ${step.expectedValue}` : '', known(step.actualValue) ? `entered ${step.actualValue}` : ''].filter(Boolean).join(', ') });
      mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
    }
  }
  if (Array.isArray(record.taskMistakeCategories)) for (const kind of ['missing', 'extra', 'out-of-order']) {
    addErrorOpportunity(byCategory, { key: `task:mistake:${kind}`, label: `${kind.replaceAll('-', ' ')} actions`, game: 'task', error: record.taskMistakeCategories.includes(kind), record });
  }
  if (Array.isArray(record.taskNumericResponses) && record.outcome !== 'Timed Out') for (const response of record.taskNumericResponses) {
    if (!response || typeof response !== 'object') continue;
    const numeric = numericErrorResponse({ record, game: 'task', label: response.label ?? 'Numeric task answer', expectedValue: response.expectedValue, submittedValue: response.submittedValue, answerExpected: response.submittedValue !== null });
    if (numeric) numericResponses.push(numeric);
  }
}

function addCashEvidence(record, byCategory, byRawInput, numericResponses, mistakesForAttempt, mistakeCounts) {
  const isTimeout = record.outcome === 'Timed Out';
  const type = record.cashTransactionType ?? record.transactionType;
  if (known(type)) {
    const typeWrong = isTimeout || (known(record.userAnswer) && record.userAnswer !== type);
    addErrorOpportunity(byCategory, { key: 'cash:transaction-type', label: 'Exact / Change / Short recognition', game: 'cash', error: typeWrong, record });
    if (typeWrong) {
      const label = `Wrong transaction type · ${type}`;
      mistakesForAttempt.push({ key: 'cash:transaction-type', label, detail: `Selected ${record.userAnswer || 'no answer'}` });
      mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
    }
  }
  const expectedCents = integer(record.changeOrShortfallCents);
  const submittedCents = integer(record.userDeclaredAmountCents);
  const answeredNumber = !isTimeout && known(record.userAnswer) && expectedCents !== null && submittedCents !== null;
  if (type && type !== 'Exact') {
    const amountError = isTimeout || (answeredNumber && expectedCents !== submittedCents);
    const amountKey = `cash:amount:${String(type).toLowerCase()}`;
    const amountPercent = answeredNumber ? expectedCents === 0 ? submittedCents === 0 ? 0 : null : Math.abs(submittedCents - expectedCents) / Math.abs(expectedCents) * 100 : null;
    addErrorOpportunity(byCategory, { key: amountKey, label: type === 'Change' ? 'Giving change amount' : 'Shortfall amount', game: 'cash', error: amountError, record, percentageError: amountPercent });
    if (amountError) {
      const difference = answeredNumber ? submittedCents - expectedCents : null;
      const label = answeredNumber ? difference > 0 ? 'Too much change / shortfall' : difference < 0 ? 'Too little change / shortfall' : 'Amount calculation' : 'Amount timeout';
      mistakesForAttempt.push({ key: 'cash:amount', label, detail: difference === null ? 'No numeric answer recorded' : `${centsText(Math.abs(difference))} away from the correct amount` });
      mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
    }
  }
  if (answeredNumber) {
    const numeric = numericErrorResponse({ record, game: 'cash', label: type === 'Change' ? 'Giving change amount' : type === 'Short' ? 'Shortfall amount' : 'Exact payment amount', expectedValue: expectedCents, submittedValue: submittedCents, unit: 'cents' });
    if (numeric) numericResponses.push(numeric);
  }
  if (record.cashBuilder === true && expectedCents !== null) {
    const builderError = isTimeout || integer(record.userCashTotalCents) === null || integer(record.userCashTotalCents) !== expectedCents;
    addErrorOpportunity(byCategory, { key: 'cash:builder-total', label: 'Cash Builder total', game: 'cash', error: builderError, record });
    if (builderError) {
      const label = 'Cash Builder total mismatch';
      mistakesForAttempt.push({ key: 'cash:builder-total', label, detail: `Expected ${centsText(expectedCents)}; selected ${integer(record.userCashTotalCents) === null ? 'no total' : centsText(record.userCashTotalCents)}` });
      mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
    }
  }
  if (known(record.customerBillRequestKind) && record.customerBillRequestKind !== 'Not requested') {
    const requestError = isTimeout || record.customerRequestResult !== 'Handled';
    addErrorOpportunity(byCategory, { key: 'cash:customer-request', label: 'Customer bill request', game: 'cash', error: requestError, record });
    if (requestError) {
      const label = 'Customer bill request not fulfilled';
      mistakesForAttempt.push({ key: 'cash:customer-request', label, detail: record.customerBillRequestHandling ?? '' });
      mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
    }
  }
  const expectedCounts = validDenominationCountMap(record.cashExpectedDenominationCounts) ? record.cashExpectedDenominationCounts : null;
  const submittedCounts = validDenominationCountMap(record.userCashDenominationCounts) ? record.userCashDenominationCounts : null;
  if (record.cashDenominationStrictRequest === true && expectedCounts && submittedCounts && !isTimeout) {
    const expectedBills = Object.entries(expectedCounts).filter(([cents]) => Number(cents) >= 100).reduce((sum, [, count]) => sum + Number(count), 0);
    const submittedBills = Object.entries(submittedCounts).filter(([cents]) => Number(cents) >= 100).reduce((sum, [, count]) => sum + Number(count), 0);
    const expectedCoins = Object.entries(expectedCounts).filter(([cents]) => Number(cents) < 100).reduce((sum, [, count]) => sum + Number(count), 0);
    const submittedCoins = Object.entries(submittedCounts).filter(([cents]) => Number(cents) < 100).reduce((sum, [, count]) => sum + Number(count), 0);
    for (const [key, label, expected, submitted] of [
      ['bill-count', 'Number of bills', expectedBills, submittedBills], ['coin-count', 'Number of coins', expectedCoins, submittedCoins],
    ]) {
      const error = expected !== submitted;
      addErrorOpportunity(byRawInput, { key: `cash:${key}`, label, game: 'cash', error, record });
      if (error) {
        const detail = `${label}: expected ${expected}, selected ${submitted}`;
        mistakesForAttempt.push({ key: `cash:${key}`, label: `Wrong ${label.toLowerCase()}`, detail });
        mistakeCounts.set(detail, (mistakeCounts.get(detail) ?? 0) + 1);
      }
    }
    if (expectedBills > 0 && expectedCoins > 0) {
      const error = submittedBills === 0 || submittedCoins === 0;
      addErrorOpportunity(byRawInput, { key: 'cash:mixed-bills-coins', label: 'Mixed bills + coins', game: 'cash', error, record });
      if (error) {
        const label = 'Mixed bill and coin request not followed';
        mistakesForAttempt.push({ key: 'cash:mixed-bills-coins', label, detail: 'The requested payout requires both bills and coins.' });
        mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
      }
    }
    for (const [denomination, label] of Object.entries(CASH_DENOMINATION_LABELS)) {
      const expected = Number(expectedCounts[denomination] ?? 0);
      const submitted = Number(submittedCounts[denomination] ?? 0);
      const error = expected !== submitted;
      addErrorOpportunity(byRawInput, { key: `cash:denomination:${denomination}`, label, game: 'cash', error, record });
      if (error) {
        const detail = `${label}: expected ${expected}, selected ${submitted}`;
        mistakesForAttempt.push({ key: `cash:denomination:${denomination}`, label: `Wrong ${label.toLowerCase()} count`, detail });
        mistakeCounts.set(detail, (mistakeCounts.get(detail) ?? 0) + 1);
      }
    }
  }
}

function addErrorDetectionEvidence(record, byCategory, byRawInput, mistakesForAttempt, mistakeCounts) {
  const family = record.puzzleFamilyId ?? record.puzzleFamily;
  if (known(family)) addErrorOpportunity(byCategory, { key: `error-detection:family:${family}`, label: `${family} puzzle`, game: 'error-detection', error: record.outcome !== 'Correct', record });
  if (Array.isArray(record.errorDetailEvidence)) {
    for (const clue of record.errorDetailEvidence) {
      if (!clue || typeof clue !== 'object') continue;
      const error = Boolean(clue.isAnomaly) !== Boolean(clue.selected);
      addErrorOpportunity(byRawInput, { key: `error-detection:clue:${clue.id}`, label: clue.label ?? clue.id, game: 'error-detection', error, record });
      if (error) {
        const label = clue.isAnomaly ? `Missed anomaly · ${clue.label ?? clue.id}` : `False positive · ${clue.label ?? clue.id}`;
        mistakesForAttempt.push({ key: 'error-detection:clue', label, detail: `Displayed ${clue.presentedValue ?? 'clue'}${known(clue.expectedValue) ? `; expected ${clue.expectedValue}` : ''}` });
        mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
      }
    }
  }
  const expectedIds = Array.isArray(record.expectedErrorIds) ? record.expectedErrorIds : null;
  const missedIds = Array.isArray(record.missedErrorIds) ? record.missedErrorIds : null;
  const flaggedIds = Array.isArray(record.falseFlagIds) ? record.falseFlagIds : null;
  const expectedCount = integer(record.expectedErrorCount) ?? expectedIds?.length ?? null;
  const missedCount = integer(record.missedAnomalyCount) ?? missedIds?.length ?? null;
  const falseFlagCount = integer(record.falseFlagCount) ?? flaggedIds?.length ?? null;
  if (expectedCount !== null && missedCount !== null) {
    const missedSet = new Set(missedIds ?? []);
    for (let index = 0; index < expectedCount; index += 1) addErrorOpportunity(byCategory, {
      key: 'error-detection:missed-anomaly', label: 'Missed anomaly', game: 'error-detection', error: missedIds ? missedSet.has(expectedIds[index]) : index < missedCount, record,
    });
  }
  if (expectedCount !== null && falseFlagCount !== null) {
    const clueCount = integer(record.detailCount);
    const validCount = clueCount === null ? null : Math.max(0, clueCount - expectedCount);
    if (validCount > 0) {
      // One clue-level trial per valid clue; the selected valid clues are false positives.
      const validIds = flaggedIds ?? Array.from({ length: falseFlagCount }, (_, index) => `false-${index}`);
      for (let index = 0; index < validCount; index += 1) addErrorOpportunity(byCategory, {
        key: 'error-detection:false-positive', label: 'False-positive clue selection', game: 'error-detection', error: validIds[index] !== undefined, record,
      });
    }
  }
}

function addFraudEvidence(record, byCategory, byRawInput, mistakesForAttempt, mistakeCounts) {
  const resultMap = record.fraudCategoryResults && typeof record.fraudCategoryResults === 'object' ? record.fraudCategoryResults : null;
  const expected = new Set(Array.isArray(record.fraudExpectedCategories) ? record.fraudExpectedCategories.filter((id) => typeof id === 'string' && id) : []);
  const missed = new Set(Array.isArray(record.fraudMissedCategories) ? record.fraudMissedCategories.filter((id) => typeof id === 'string' && id) : []);
  const falsePositive = new Set(Array.isArray(record.fraudFalsePositiveCategories) ? record.fraudFalsePositiveCategories.filter((id) => typeof id === 'string' && id) : []);
  if (resultMap) {
    for (const [id, outcome] of Object.entries(resultMap)) {
      if (!['found', 'missed', 'false-positive', 'valid'].includes(outcome)) continue;
      const label = FRAUD_ISSUE_LABELS[id] ?? id.replaceAll('-', ' ');
      const isPresent = outcome === 'found' || outcome === 'missed';
      const isFalseNegative = outcome === 'missed';
      const isFalsePositive = outcome === 'false-positive';
      const error = isFalseNegative || isFalsePositive;
      const opportunityKey = `fraud:issue-${isPresent ? 'present' : 'absent'}:${id}`;
      const opportunityLabel = isPresent ? `Missed ${label} when present` : `False positive · ${label} when absent`;
      addErrorOpportunity(byRawInput, { key: opportunityKey, label: opportunityLabel, game: 'fraud-inspection', error, record, falseNegative: isFalseNegative, falsePositive: isFalsePositive });
      addErrorOpportunity(byCategory, { key: `fraud:category:${isPresent ? 'present' : 'absent'}:${id}`, label: opportunityLabel, game: 'fraud-inspection', error, record, falseNegative: isFalseNegative, falsePositive: isFalsePositive });
      if (error) {
        const mistakeLabel = isFalseNegative ? `Missed ${label.toLowerCase()}` : `False positive · ${label.toLowerCase()}`;
        mistakesForAttempt.push({ key: isFalseNegative ? 'fraud:missed-issue' : 'fraud:false-positive', label: mistakeLabel, detail: `Issue ${id}` });
        mistakeCounts.set(mistakeLabel, (mistakeCounts.get(mistakeLabel) ?? 0) + 1);
      }
    }
  } else {
    for (const id of expected) {
      const isFalseNegative = missed.has(id);
      const label = FRAUD_ISSUE_LABELS[id] ?? id.replaceAll('-', ' ');
      const opportunityKey = `fraud:issue-present:${id}`;
      const opportunityLabel = `Missed ${label} when present`;
      addErrorOpportunity(byRawInput, { key: opportunityKey, label: opportunityLabel, game: 'fraud-inspection', error: isFalseNegative, record, falseNegative: isFalseNegative });
      addErrorOpportunity(byCategory, { key: `fraud:category:present:${id}`, label: opportunityLabel, game: 'fraud-inspection', error: isFalseNegative, record, falseNegative: isFalseNegative });
      if (isFalseNegative) {
        const mistakeLabel = `Missed ${label.toLowerCase()}`;
        mistakesForAttempt.push({ key: 'fraud:missed-issue', label: mistakeLabel, detail: `Issue ${id}` });
        mistakeCounts.set(mistakeLabel, (mistakeCounts.get(mistakeLabel) ?? 0) + 1);
      }
    }
    for (const id of falsePositive) {
      const label = FRAUD_ISSUE_LABELS[id] ?? id.replaceAll('-', ' ');
      const mistakeLabel = `False positive · ${label.toLowerCase()}`;
      mistakesForAttempt.push({ key: 'fraud:false-positive', label: mistakeLabel, detail: `Issue ${id}; absent-case opportunity count is unavailable in this older record` });
      mistakeCounts.set(mistakeLabel, (mistakeCounts.get(mistakeLabel) ?? 0) + 1);
    }
  }
  if (known(record.fraudCleanCase)) addErrorOpportunity(byCategory, {
    key: record.fraudCleanCase ? 'fraud:clean-case' : 'fraud:issue-case', label: record.fraudCleanCase ? 'Clean-case recognition' : 'Issue-bearing case review',
    game: 'fraud-inspection', error: record.outcome !== 'Correct', record,
  });
}

function addConditionCombination(groups, record) {
  if (record.outcome === 'Not answered') return;
  let key = null; let label = null; let game = record.game;
  if (game === 'cash' && known(record.cashTransactionType ?? record.transactionType) && known(record.difficulty)) {
    const kind = record.cashDenominationStrictRequest ? 'strict-request' : record.cashBuilder ? 'cash-builder' : 'standard';
    const transaction = String(record.cashTransactionType ?? record.transactionType).toLowerCase();
    key = `cash:${transaction}:${record.difficulty}:${kind}`;
    label = `${transaction === 'change' ? 'Giving Change' : transaction === 'short' ? 'Shortfall' : 'Exact payment'} · ${record.difficulty} · ${kind.replaceAll('-', ' ')}`;
  } else if (game === 'memory' && known(record.totalDigits) && known(record.readTimeSeconds) && known(record.difficulty)) {
    key = `memory:${record.totalDigits}-digits:${record.readTimeSeconds}s:${record.difficulty}`;
    label = `${record.totalDigits} digits · ${record.readTimeSeconds}s display · ${record.difficulty}`;
  } else if (game === 'task' && known(record.workspaceKind) && known(record.stepsExpected) && known(record.difficulty)) {
    key = `task:${record.workspaceKind}:${record.stepsExpected}:${record.difficulty}`;
    label = `${record.workspaceKind} · ${record.stepsExpected} steps · ${record.difficulty}`;
  } else if (game === 'error-detection' && known(record.puzzleFamilyId ?? record.puzzleFamily) && known(record.ruleLayers) && known(record.difficulty)) {
    const family = record.puzzleFamilyId ?? record.puzzleFamily;
    key = `error-detection:${family}:${record.ruleLayers}:${record.difficulty}`;
    label = `${family} · ${record.ruleLayers} rule layers · ${record.difficulty}`;
  } else if (game === 'fraud-inspection' && known(record.fraudCaseDifficulty ?? record.difficulty) && known(record.fraudRunMode)) {
    const difficulty = record.fraudCaseDifficulty ?? record.difficulty;
    key = `fraud-inspection:${difficulty}:${record.fraudRunMode}`;
    label = `${difficulty} case · ${record.fraudRunMode}`;
  }
  if (key) addErrorOpportunity(groups, { key, label, game, error: record.outcome !== 'Correct', record });
}

function addInputCombinationEvidence(groups, record, add) {
  const game = record.game;
  const difficulty = game === 'fraud-inspection' ? record.fraudCaseDifficulty ?? record.difficulty : record.difficulty;
  const timeLimit = game === 'fraud-inspection' ? record.fraudTimeLimitSeconds ?? record.timeLimitSeconds : record.timeLimitSeconds;
  const settings = [known(difficulty) ? String(difficulty) : '', known(timeLimit) ? `${timeLimit}s limit` : 'timer not recorded'].filter(Boolean).join(' · ');
  if (game === 'cash' && record.cashDenominationStrictRequest === true && record.cashExpectedDenominationCounts && record.userCashDenominationCounts && record.outcome !== 'Timed Out') {
    if (!validDenominationCountMap(record.cashExpectedDenominationCounts) || !validDenominationCountMap(record.userCashDenominationCounts)) return;
    const expected = record.cashExpectedDenominationCounts;
    const submitted = record.userCashDenominationCounts;
    const denominations = [...new Set([...Object.keys(expected), ...Object.keys(submitted)])]
      .filter((cents) => Number(expected[cents] ?? 0) > 0 || Number(submitted[cents] ?? 0) > 0)
      .map(Number).sort((left, right) => right - left);
    if (denominations.length) {
      const values = denominations.join('+');
      const mix = denominations.map((cents) => CASH_DENOMINATION_LABELS[cents] ?? `${cents}¢`).join(' + ');
      add(groups, { key: `cash:mix:${record.cashTransactionType ?? record.transactionType}:${values}:${settings}`,
        label: `Cash request · ${mix} · ${settings}`, game,
        error: denominations.some((cents) => Number(expected[cents] ?? 0) !== Number(submitted[cents] ?? 0)), record, kind: 'input-combination' });
    }
  }
  if (game === 'memory' && Array.isArray(record.expectedValues)) {
    const expectedDigits = Array.isArray(record.digitsByValue) ? record.digitsByValue : record.expectedValues.map((value) => String(value).replace('.', '').length);
    const displayTime = known(record.readTimeSeconds) ? `${record.readTimeSeconds}s display` : 'display time not recorded';
    const answerLimit = known(record.writeTimeSeconds) ? `${record.writeTimeSeconds}s answer limit` : 'answer limit not recorded';
    const memorySettings = [known(difficulty) ? String(difficulty) : '', displayTime, answerLimit].filter(Boolean).join(' · ');
    for (let index = 0; index < record.expectedValues.length; index += 1) {
      const expected = String(record.expectedValues[index]);
      const answered = record.outcome === 'Timed Out' ? '' : String(record.answeredValues?.[index] ?? '').replaceAll(/\s/g, '');
      const length = Number(expectedDigits[index]);
      if (!Number.isFinite(length)) continue;
      add(groups, { key: `memory:digits:${length}:${memorySettings}`, label: `${length}-digit recall · ${memorySettings}`, game,
        error: record.outcome === 'Timed Out' || expected !== answered, record, kind: 'input-combination' });
    }
  }
  if (game === 'task' && Array.isArray(record.taskStepEvidence)) for (const step of record.taskStepEvidence) {
    if (!['correct', 'missing', 'wrong-value', 'out-of-order', 'wrong-target'].includes(step?.status)) continue;
    const field = String(step.targetLabel || step.targetId || step.type || 'Expected task action');
    add(groups, { key: `task:field:${step.targetId || field}:${record.workspaceKind ?? 'workflow-unknown'}:${settings}`,
      label: `${record.workspaceKind ?? 'Task'} · ${field} · ${settings}`, game, error: step.status !== 'correct', record, kind: 'input-combination' });
  }
  if (game === 'error-detection' && Array.isArray(record.errorDetailEvidence)) {
    const family = record.puzzleFamilyId ?? record.puzzleFamily ?? 'Puzzle';
    for (const clue of record.errorDetailEvidence) {
      if (!clue || typeof clue !== 'object') continue;
      const error = Boolean(clue.isAnomaly) !== Boolean(clue.selected);
      add(groups, { key: `error-detection:clue:${clue.id}:${family}:${record.ruleLayers ?? 'layers-unknown'}:${settings}`,
        label: `${family} · ${clue.label ?? clue.id} · ${record.ruleLayers ?? 'unknown'} rule layers · ${settings}`,
        game, error, record, kind: 'input-combination' });
    }
  }
  if (game === 'fraud-inspection' && record.fraudCategoryResults && typeof record.fraudCategoryResults === 'object') {
    for (const [id, status] of Object.entries(record.fraudCategoryResults)) {
      if (!['found', 'missed', 'false-positive', 'valid'].includes(status)) continue;
      const error = status === 'missed' || status === 'false-positive';
      if (!error && !['found', 'valid'].includes(status)) continue;
      const issue = FRAUD_ISSUE_LABELS[id] ?? id;
      const mistake = status === 'missed' ? 'missed' : status === 'false-positive' ? 'false positive' : 'checked';
      add(groups, { key: `fraud:issue:${id}:${status === 'false-positive' || status === 'valid' ? 'absent' : 'present'}:${settings}`,
        label: `${issue} ${status === 'false-positive' || status === 'valid' ? 'absent' : 'present'} · ${mistake} · ${settings}`,
        game, error, record, kind: 'input-combination' });
    }
  }
}

/**
 * Analyze completed attempts from the already-filtered history set. The caller
 * may pass an explicitly matched earlier set for the change-over-time comparison.
 */
export function buildErrorAnalytics(history, { previousRecords = [], comparisonCurrentRecords = null, minimumOpportunities = 5, sortBy = 'error-rate', comparisonDisabled = false } = {}) {
  const records = modelRows(history);
  const completed = records.filter((record) => ANSWERED_OUTCOMES.has(record.outcome));
  const summary = summarizeErrorOutcomes(records);
  const byCategoryGroups = newErrorGroups();
  const byRawInputGroups = newErrorGroups();
  const bySettingGroups = newErrorGroups();
  const combinationGroups = newErrorGroups();
  const inputCombinationGroups = newErrorGroups();
  const numericResponses = [];
  const mistakeCounts = new Map();
  const attemptDetails = new Map();

  for (const record of completed) {
    const mistakesForAttempt = [];
    if (record.game === 'cash') addCashEvidence(record, byCategoryGroups, byRawInputGroups, numericResponses, mistakesForAttempt, mistakeCounts);
    if (record.game === 'memory') addMemoryEvidence(record, byCategoryGroups, byRawInputGroups, mistakeCounts, mistakesForAttempt);
    if (record.game === 'task') addTaskEvidence(record, byCategoryGroups, byRawInputGroups, numericResponses, mistakesForAttempt, mistakeCounts);
    if (record.game === 'error-detection') addErrorDetectionEvidence(record, byCategoryGroups, byRawInputGroups, mistakesForAttempt, mistakeCounts);
    if (record.game === 'fraud-inspection') addFraudEvidence(record, byCategoryGroups, byRawInputGroups, mistakesForAttempt, mistakeCounts);
    addSettingGroups(bySettingGroups, record, addErrorOpportunity);
    addConditionCombination(combinationGroups, record);
    addInputCombinationEvidence(inputCombinationGroups, record, addErrorOpportunity);
    attemptDetails.set(record.attemptId, { attemptId: record.attemptId, game: record.game, outcome: record.outcome, mistakes: mistakesForAttempt });
  }

  const byCategory = finishErrorGroups(byCategoryGroups, minimumOpportunities, sortBy);
  const byRawInput = finishErrorGroups(byRawInputGroups, minimumOpportunities, sortBy);
  // Difficulty groups are also useful as explicit setting comparisons.
  const difficultyMap = newErrorGroups();
  for (const record of completed) {
    const difficulty = record.game === 'fraud-inspection' ? record.fraudCaseDifficulty ?? record.difficulty : record.difficulty;
    if (known(difficulty)) addErrorOpportunity(difficultyMap, { key: `${record.game}:${difficulty}`, label: `${record.gameName} · ${difficulty}`, game: record.game, error: record.outcome !== 'Correct', record });
  }
  const difficultyGroups = finishErrorGroups(difficultyMap, minimumOpportunities, sortBy);
  const bySetting = finishErrorGroups(bySettingGroups, minimumOpportunities, sortBy);
  const combinations = finishErrorGroups(combinationGroups, minimumOpportunities, sortBy);
  const inputCombinations = finishErrorGroups(inputCombinationGroups, minimumOpportunities, sortBy);
  const eligibleSkills = [...byCategory, ...byRawInput, ...inputCombinations].filter((group) => group.eligibleForRanking);
  const weaknesses = eligibleSkills.filter((group) => group.errorRatePercent > 0).sort((left, right) => right.errorRatePercent - left.errorRatePercent || right.opportunities - left.opportunities).slice(0, 5);
  const strengths = eligibleSkills.filter((group) => group.errorRatePercent < 20).sort((left, right) => left.errorRatePercent - right.errorRatePercent || right.opportunities - left.opportunities).slice(0, 5);
  const mostCommonMistakes = [...mistakeCounts.entries()].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)).slice(0, 8);
  const sortedNumeric = [...numericResponses].sort((left, right) => (Date.parse(left.timestamp) || 0) - (Date.parse(right.timestamp) || 0));
  const percentResponses = sortedNumeric.filter((row) => row.percentageError !== null);
  const numericDistribution = ERROR_DISTRIBUTION_BANDS.map((band) => ({ key: band.key, label: band.label, count: percentResponses.filter((row) => band.test(row.percentageError)).length,
    attemptIds: percentResponses.filter((row) => band.test(row.percentageError)).map((row) => row.attemptId) }));
  const largestNumericError = [...sortedNumeric].sort((left, right) => right.absoluteError - left.absoluteError)[0] ?? null;
  const recentRows = completed.slice(-30);
  const recent = summarizeErrorOutcomes(recentRows);
  const longTerm = summary;
  const summaryWithMagnitude = {
    ...summary, notAnswered: records.filter((record) => record.outcome === 'Not answered').length,
    numericResponses: numericResponses.length, numericNotApplicable: numericResponses.filter((row) => row.percentageError === null).length,
    averagePercentageError: percentResponses.length ? round2(average(percentResponses.map((row) => row.percentageError))) : null,
    medianPercentageError: percentResponses.length ? round2(median(percentResponses.map((row) => row.percentageError))) : null,
    recentErrorRatePercent: recent.errorRatePercent, longTermErrorRatePercent: longTerm.errorRatePercent,
  };

  let comparison = { available: false, current: null, previous: null, errorRateDeltaPoints: null, improvementPoints: null, label: 'Not enough comparable attempts yet', categoryChanges: [] };
  if (!comparisonDisabled) {
    const prior = buildErrorAnalytics(previousRecords, { minimumOpportunities, sortBy, comparisonDisabled: true });
    const currentAnalytics = comparisonCurrentRecords === null ? null
      : buildErrorAnalytics(comparisonCurrentRecords, { minimumOpportunities, sortBy, comparisonDisabled: true });
    const current = currentAnalytics?.summary ?? recent;
    if (prior.summary.attempts >= minimumOpportunities && current.attempts >= minimumOpportunities) {
      const delta = round2(current.errorRatePercent - prior.summary.errorRatePercent);
      const numberCompared = prior.summary.attempts;
      const suffix = numberCompared === 1 ? 'attempt' : 'attempts';
      const currentGroups = currentAnalytics ? currentAnalytics.byRawInput.concat(currentAnalytics.byCategory, currentAnalytics.inputCombinations) : [];
      const changes = new Map(prior.byRawInput.concat(prior.byCategory, prior.inputCombinations).map((group) => [group.key, group]));
      comparison = {
        available: true,
        current,
        previous: prior.summary,
        errorRateDeltaPoints: delta,
        improvementPoints: delta === null ? null : -delta,
        label: `Previous ${numberCompared} relevant ${suffix}`,
        categoryChanges: currentGroups.filter((group) => group.eligibleForRanking && changes.has(group.key) && changes.get(group.key).eligibleForRanking)
          .map((group) => ({ key: group.key, label: group.label, currentErrorRatePercent: group.errorRatePercent,
            previousErrorRatePercent: changes.get(group.key).errorRatePercent,
            errorRateDeltaPoints: round2(group.errorRatePercent - changes.get(group.key).errorRatePercent),
            currentOpportunities: group.opportunities, previousOpportunities: changes.get(group.key).opportunities }))
          .sort((left, right) => (left.errorRateDeltaPoints ?? 0) - (right.errorRateDeltaPoints ?? 0)),
      };
    }
  }
  const sampleRows = records.filter((record) => record.isSample === true).length;
  const dataLabel = sampleRows === records.length && records.length ? 'Based on Sample Data' : sampleRows ? 'Mixed real and sample data' : null;
  const allAttemptIds = completed.map((record) => record.attemptId);
  const makeChart = (id, title, kind, metric, points, axisLabel) => ({
    id, title, kind, axisLabel, attemptIds: [...new Set(points.flatMap((point) => point.attemptIds ?? []))],
    series: [{ metric, points }],
  });
  const categoryPoints = byCategory.map((group) => ({ key: group.key, label: group.label, value: group.errorRatePercent, count: group.opportunities, opportunities: group.opportunities,
    errors: group.errors, attemptCount: group.attemptCount, attemptIds: group.attemptIds, interval: group.interval }));
  const rawInputPoints = byRawInput.map((group) => ({ key: group.key, label: group.label, value: group.errorRatePercent, count: group.opportunities, opportunities: group.opportunities,
    errors: group.errors, attemptCount: group.attemptCount, attemptIds: group.attemptIds, interval: group.interval }));
  const trendPoints = rateTrend(records);
  const magnitudePoints = sortedNumeric.map((row, index) => ({ key: row.attemptId, label: `Attempt ${index + 1}`, value: row.percentageError, count: 1,
    attemptIds: [row.attemptId], expectedValue: row.expectedValue, submittedValue: row.submittedValue, absoluteError: row.absoluteError }));
  return {
    summary: summaryWithMagnitude, byCategory, byRawInput, byDifficulty: difficultyGroups, bySetting,
    combinations, inputCombinations, weaknesses, strengths,
    highestErrorCategory: byCategory.filter((group) => group.eligibleForRanking).sort((left, right) => right.errorRatePercent - left.errorRatePercent)[0] ?? null,
    highestErrorRawInput: byRawInput.filter((group) => group.eligibleForRanking).sort((left, right) => right.errorRatePercent - left.errorRatePercent)[0] ?? null,
    highestErrorInputCombination: inputCombinations.filter((group) => group.eligibleForRanking).sort((left, right) => right.errorRatePercent - left.errorRatePercent)[0] ?? null,
    lowestErrorCategory: byCategory.filter((group) => group.eligibleForRanking).sort((left, right) => left.errorRatePercent - right.errorRatePercent)[0] ?? null,
    mostCommonMistakes,
    numeric: {
      responses: sortedNumeric,
      averagePercentageError: summaryWithMagnitude.averagePercentageError,
      medianPercentageError: summaryWithMagnitude.medianPercentageError,
      largestNumericError,
      notApplicable: summaryWithMagnitude.numericNotApplicable,
      distribution: numericDistribution,
      severityFor: errorSeverityFor,
    },
    trend: trendPoints, recent, longTerm, comparison, dataLabel, attemptDetails,
    charts: {
      category: makeChart('error-rate-category', 'Error Rate by Category', 'bar', 'error-rate', categoryPoints, 'Error rate (%)'),
      rawInput: makeChart('error-rate-raw-input', 'Error Rate by Raw Input', 'bar', 'error-rate', rawInputPoints, 'Error rate (%)'),
      trend: makeChart('error-rate-over-time', 'Error Rate Over Time', 'line', 'error-rate', trendPoints, 'Error rate (%)'),
      magnitude: makeChart('numeric-percentage-error', 'Numeric Error Magnitude by Attempt', 'line', 'percentage-error', magnitudePoints, 'Absolute percentage error'),
    },
    attemptIds: allAttemptIds,
  };
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

function groupedMeanPoints(records, getKey, getValue) {
  const groups = new Map();
  for (const row of records) {
    const key = getKey(row);
    const value = getValue(row);
    if (!known(key) || value === null || !Number.isFinite(value)) continue;
    const label = String(key);
    if (!groups.has(label)) groups.set(label, { rows: [], values: [] });
    groups.get(label).rows.push(row);
    groups.get(label).values.push(value);
  }
  return [...groups.entries()].map(([label, group]) => ({ ...aggregatePoint(label, label, group.rows), value: average(group.values), measure: 'mean' }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
}

function chart(id, title, points, options = {}) {
  return { id, title, kind: options.kind ?? 'bar', description: options.description ?? '', axisLabel: options.axisLabel,
    series: [{ id: options.seriesId ?? 'value', label: options.seriesLabel ?? title, metric: options.metric ?? 'accuracy', points }], attemptIds: [...new Set(points.flatMap((point) => point.attemptIds))] };
}
function band(value, bands, suffix = '') { if (value === null) return null; const found = bands.find(([max]) => value <= max); return found ? found[1] : `${bands.at(-1)[0]}+${suffix}`; }

const speedBand = (seconds) => seconds === null ? null : seconds <= 5 ? '0–5s' : seconds <= 10 ? '>5–10s' : seconds <= 15 ? '>10–15s' : '>15s';
const SPEED_BANDS = ['0–5s', '>5–10s', '>10–15s', '>15s'];
export function wilsonInterval(successes, attempts) {
  if (!attempts) return null;
  const z = 1.96;
  const p = successes / attempts;
  const divisor = 1 + z * z / attempts;
  const center = (p + z * z / (2 * attempts)) / divisor;
  const margin = z * Math.sqrt(p * (1 - p) / attempts + z * z / (4 * attempts * attempts)) / divisor;
  return [Math.max(0, Math.round((center - margin) * 100)), Math.min(100, Math.round((center + margin) * 100))];
}

function ratePoint(label, rows) {
  const correct = rows.filter((row) => row.isCorrect).length;
  return { key: label, label, value: percent(correct, rows.length), count: rows.length, correct,
    interval: wilsonInterval(correct, rows.length),
    attemptIds: rows.map((row) => row.attemptId) };
}

function conditionAxes(game) {
  const common = [['Speed', (row) => speedBand(row.responseTimeSeconds)]];
  if (game === 'cash') return [...common,
    ['Transaction', (row) => row.transactionType], ['Hundred-dollar bills', (row) => row.hundredBillCount === null ? null : row.hundredBillCount === 0 ? 'None' : row.hundredBillCount === 1 ? 'One' : 'Two or more'],
    ['Denomination present', (row) => row.denominations?.map((cents) => `$${(cents / 100).toFixed(2)}`)],
    ['Denomination load', (row) => row.denominationTypes], ['Customer request', (row) => row.customerRequestKind || (row.customerRequests === false ? 'None' : null)],
    ['Cash builder clicks', (row) => row.cashAddClicks === null ? null : band(row.cashAddClicks + (row.cashRemoveClicks ?? 0), [[0, '0'], [3, '1–3'], [8, '4–8']])],
    ['Inferred multiplications', (row) => row.workloadMultiplications], ['Inferred additions', (row) => row.workloadAdditions]];
  if (game === 'memory') return [...common, ['Digits per value', (row) => row.maxDigits], ['Total digits', (row) => row.totalDigits], ['Value count', (row) => row.valueCount],
    ['Decimal mode', (row) => row.decimalMode === null ? null : row.decimalMode ? 'Decimals' : 'Whole numbers'], ['Read seconds', (row) => row.readSeconds]];
  if (game === 'task') return [...common, ['Workflow', (row) => row.workspaceKind], ['Expected steps', (row) => row.expectedSteps],
    ['Workspace rows', (row) => row.workspaceRows], ['Workspace tabs', (row) => row.workspaceTabs], ['Recall limit', (row) => row.recallSeconds],
    ['Tab changes', (row) => row.taskTabChanges], ['Corrections', (row) => row.taskCorrections]];
  if (game === 'error-detection') return [...common, ['Puzzle family', (row) => row.puzzleFamily], ['Rule layers', (row) => row.ruleLayers],
    ['Clue count', (row) => row.clueCount], ['Puzzle type', (row) => row.puzzleType],
    ['Clean puzzle', (row) => row.cleanPuzzle === null ? null : row.cleanPuzzle ? 'Clean' : 'Has anomalies']];
  if (game === 'fraud-inspection') return [...common, ['Run mode', (row) => row.fraudRunMode], ['Case difficulty', (row) => row.fraudCaseDifficulty],
    ['Issue count', (row) => row.fraudExpectedIssueCount], ['Actual issue', (row) => row.fraudExpectedCategories],
    ['Clean case', (row) => row.fraudCleanCase === null ? null : row.fraudCleanCase ? 'Clean' : 'Has issues']];
  return common;
}

/** Conditional choices and exact rates share the filtered, normalized attempt set. */
export function buildConditionalReport(history, game = 'all', selectedIds = []) {
  const records = modelRows(history).filter((row) => row.isAnswered && (game === 'all' || row.game === game));
  const groups = new Map();
  for (const row of records) for (const [axis, getter] of conditionAxes(row.game)) {
    const values = getter(row);
    for (const value of Array.isArray(values) ? values : [values]) {
      if (!known(value)) continue;
      const id = `${row.game}|${axis}|${value}`;
      if (!groups.has(id)) groups.set(id, { id, label: `${axis}: ${value}`, game: row.game, axis, rows: [] });
      groups.get(id).rows.push(row);
    }
  }
  const choices = [...groups.values()].sort((a, b) => a.game.localeCompare(b.game) || a.label.localeCompare(b.label, undefined, { numeric: true }));
  const selected = [...new Set(selectedIds)].slice(0, 2).map((id) => groups.get(id)).filter(Boolean);
  const base = selected.length ? records.filter((row) => row.game === selected[0].game) : records;
  const matched = selected.length ? base.filter((row) => selected.every((group) => group.rows.includes(row))) : base;
  const eligible = base.filter((row) => selected.every((group) => {
    const axis = conditionAxes(row.game).find(([label]) => label === group.axis);
    return axis && known(axis[1](row));
  }));
  const rate = { ...ratePoint(selected.map((group) => group.label).join(' + ') || 'All answered attempts', matched), missing: base.length - eligible.length };
  const missingTime = base.filter((row) => row.responseTimeSeconds === null).length;
  const strata = new Map();
  for (const row of records) {
    const key = `${row.game}|${row.difficulty ?? '?'}|${row.sessionMode ?? row.fraudRunMode ?? '?'}`;
    if (!strata.has(key)) strata.set(key, { rows: [], correct: 0 });
    strata.get(key).rows.push(row);
    strata.get(key).correct += Number(row.isCorrect);
  }
  const summaries = choices.map((group) => {
    const qualifying = group.rows;
    const comparable = new Set();
    let expectedCorrect = 0;
    for (const row of qualifying) {
      const key = `${row.game}|${row.difficulty ?? '?'}|${row.sessionMode ?? row.fraudRunMode ?? '?'}`;
      const peers = strata.get(key);
      comparable.add(key);
      expectedCorrect += peers.correct / peers.rows.length;
    }
    const comparableCount = [...comparable].reduce((sum, key) => sum + strata.get(key).rows.length, 0);
    const point = ratePoint(group.label, qualifying);
    return { ...point, id: group.id, game: group.game, comparableCount,
      baselinePercent: qualifying.length ? Math.round(expectedCorrect / qualifying.length * 100) : null,
      gapPoints: qualifying.length ? point.value - Math.round(expectedCorrect / qualifying.length * 100) : null,
      evidence: qualifying.length >= 10 && comparableCount >= 20 ? 'Recurring' : qualifying.length >= 5 ? 'Early signal' : 'Limited' };
  });
  const ranked = summaries.filter((group) => group.count >= 5 && group.comparableCount >= 10);
  const strengths = ranked.filter((group) => group.gapPoints >= 10).sort((a, b) => b.gapPoints - a.gapPoints || b.count - a.count).slice(0, 4);
  const weaknesses = ranked.filter((group) => group.gapPoints <= -10).sort((a, b) => a.gapPoints - b.gapPoints || b.count - a.count).slice(0, 4);
  const distances = matched.map((row) => row.game === 'cash' ? row.cashSignedErrorCents === null ? null : Math.abs(row.cashSignedErrorCents)
    : row.game === 'memory' ? [row.wrongDigits, row.omittedDigits, row.extraDigits, row.decimalErrors].every((v) => v !== null) ? row.wrongDigits + row.omittedDigits + row.extraDigits + row.decimalErrors : null
      : row.game === 'task' ? [row.taskMissingCount, row.taskExtraCount, row.taskOutOfOrderCount].every((v) => v !== null) ? row.taskMissingCount + row.taskExtraCount + row.taskOutOfOrderCount : null
        : row.selectionDistance).filter((value) => value !== null);
  return { choices: choices.map(({ id, label, game: choiceGame, rows }) => ({ id, label: game === 'all' ? `${GAME_NAMES[choiceGame]} · ${label}` : label, count: rows.length })),
    selectedIds: selected.map((group) => group.id), rate, missingTime, notAnswered: modelRows(history).filter((row) => !row.isAnswered && (game === 'all' || row.game === game)).length,
    strengths, weaknesses, meanDistance: average(distances), distanceCount: distances.length,
    speed: SPEED_BANDS.map((label) => ratePoint(label, matched.filter((row) => speedBand(row.responseTimeSeconds) === label))),
    correctBy: [5, 10, 15].map((seconds) => {
      const measured = matched.filter((row) => row.responseTimeSeconds !== null);
      const point = ratePoint(`By ${seconds}s`, measured);
      point.correct = measured.filter((row) => row.isCorrect && row.responseTimeSeconds <= seconds).length;
      point.value = percent(point.correct, measured.length);
      point.interval = wilsonInterval(point.correct, measured.length);
      return { seconds, ...point };
    }) };
}

/** Return accessible, data-only specifications for shared and game-specific charts. */
export function buildChartSpecs(history, game = 'all') {
  const records = modelRows(history).filter((record) => game === 'all' || record.game === game);
  const model = buildProgressModel(records);
  const daily = model.daily;
  const timed = records.filter((record) => record.isAnswered && record.responseTimeSeconds !== null);
  const speedPoints = SPEED_BANDS.map((label) => ratePoint(label, timed.filter((row) => speedBand(row.responseTimeSeconds) === label))).filter((point) => point.count);
  const thresholdPoints = [5, 10, 15].map((seconds) => {
    const point = ratePoint(`By ${seconds}s`, timed);
    point.correct = timed.filter((row) => row.isCorrect && row.responseTimeSeconds <= seconds).length;
    point.value = percent(point.correct, timed.length);
    point.interval = wilsonInterval(point.correct, timed.length);
    return point;
  }).filter((point) => point.count);
  const specs = [
    chart('accuracy-over-time', 'Accuracy over time', daily.map((row) => ({ key: row.day, label: row.day, value: row.accuracyPercent, count: row.answered, attemptIds: row.attemptIds, detail: row })), { kind: 'line' }),
    chart('response-time-over-time', 'Response time over time', daily.filter((row) => row.averageResponseTimeSeconds !== null).map((row) => ({ key: row.day, label: row.day, value: row.averageResponseTimeSeconds, count: row.eligibleResponseAttempts, attemptIds: row.attemptIds, detail: row })), { kind: 'line', metric: 'time' }),
    chart('attempts-per-day', 'Attempts per day', daily.map((row) => ({ key: row.day, label: row.day, value: row.attempts, count: row.attempts, attemptIds: row.attemptIds, detail: row })), { metric: 'attempts' }),
    chart('outcomes', 'Correct, incorrect, and timed out', groupedPoints(records, (record) => record.outcome, 'attempts'), { metric: 'attempts' }),
    chart('speed-vs-accuracy', 'Speed versus accuracy', groupedPoints(records, (record) => record.difficulty).map((point) => ({ ...point, x: point.detail.averageResponseTimeSeconds, y: point.value })), { kind: 'scatter' }),
    chart('accuracy-by-response-band', 'Accuracy by response time', speedPoints),
    chart('correct-by-threshold', 'Correct by 5, 10, and 15 seconds', thresholdPoints),
    chart('performance-distribution', 'Response-time distribution', groupedPoints(records.filter((record) => record.responseTimeSeconds !== null), (record) => band(record.responseTimeSeconds, [[5, '0–5s'], [10, '6–10s'], [20, '11–20s'], [40, '21–40s']], 's'), 'attempts'), { metric: 'attempts' }),
    chart('best-vs-recent', 'First attempts versus recent attempts', [aggregatePoint('first', 'First 20', records.slice(0, 20)), aggregatePoint('recent', 'Recent 20', records.slice(-20))]),
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
    chart('cash-hundred-bills', 'Accuracy by $100 bill count', groupedPoints(records, (row) => row.hundredBillCount === null ? null : row.hundredBillCount === 0 ? 'None' : row.hundredBillCount === 1 ? 'One' : 'Two or more')),
    chart('cash-error-distance', 'Average absolute cents off by transaction', groupedMeanPoints(records, (row) => row.transactionType, (row) => row.cashSignedErrorCents === null ? null : Math.abs(row.cashSignedErrorCents)), { metric: 'cents' }),
    chart('cash-builder-actions', 'Cash-builder actions by result', groupedMeanPoints(records, (row) => row.outcome, (row) => [row.cashAddClicks, row.cashRemoveClicks, row.cashQuickEntries, row.cashClearClicks].every((value) => value !== null) ? row.cashAddClicks + row.cashRemoveClicks + row.cashQuickEntries + row.cashClearClicks : null), { metric: 'actions' }),
    chart('cash-workload', 'Accuracy by inferred arithmetic workload', groupedPoints(records, (row) => row.workloadMultiplications === null ? null : `${row.workloadMultiplications} ×, ${row.workloadAdditions} +`)),
    chart('cash-error-reasons', 'Cash answer error reasons', [
      ['Wrong transaction type', 'cashWrongType'], ['Wrong declared amount', 'cashWrongAmount'], ['Constructed cash mismatch', 'cashBuilderMismatch'],
    ].map(([label, field]) => aggregatePoint(field, label, records.filter((row) => row[field] === true), 'attempts')), { metric: 'attempts' }),
  );
  if (game === 'memory') specs.push(
    chart('memory-digit-length', 'Accuracy by digit length', groupedPoints(records, (record) => record.maxDigits)),
    chart('memory-digit-speed', 'Response time by digit length', groupedPoints(records, (record) => record.maxDigits, 'time'), { metric: 'time' }),
    chart('memory-total-load', 'Accuracy by total digit load', groupedPoints(records, (record) => record.totalDigits)),
    chart('memory-value-count', 'Performance by value count', groupedPoints(records, (record) => record.valueCount)),
    chart('memory-read-duration', 'Accuracy by display duration', groupedPoints(records, (record) => record.readSeconds)),
    chart('memory-mismatch-position', 'Mismatch position frequency', groupedPoints(records.filter((record) => record.mismatchPositions !== null), (record) => record.mismatchPositions, 'attempts'), { metric: 'attempts' }),
    chart('memory-decimal', 'Accuracy with and without decimals', groupedPoints(records, (row) => row.decimalMode === null ? null : row.decimalMode ? 'Decimals' : 'Whole numbers')),
    chart('memory-error-distance', 'Average digit errors by load', groupedMeanPoints(records, (row) => row.totalDigits, (row) => row.wrongDigits === null ? null : row.wrongDigits + row.omittedDigits + row.extraDigits + row.decimalErrors), { metric: 'digits' }),
    chart('memory-partial-recall', 'Average values recalled by digit load', groupedMeanPoints(records, (row) => row.totalDigits, (row) => row.correctValueCount !== null && row.valueCount > 0 ? row.correctValueCount / row.valueCount * 100 : null).map((point) => ({ ...point, value: Math.round(point.value) })), { axisLabel: 'Values recalled (%)' }),
  );
  if (game === 'task') specs.push(
    chart('task-workflow', 'Sequence quality by workflow', groupedPoints(records, (record) => record.workspaceKind)),
    chart('task-steps', 'Performance by expected steps', groupedPoints(records, (record) => record.expectedSteps)),
    chart('task-workspace-load', 'Performance by rows and tabs', groupedPoints(records, (record) => record.workspaceRows !== null && record.workspaceTabs !== null ? `${record.workspaceRows} rows · ${record.workspaceTabs} tabs` : null)),
    chart('task-timing', 'Performance by recall limit', groupedPoints(records, (record) => record.recallSeconds)),
    chart('task-mistake-type', 'Mistake category frequency', groupedPoints(records.filter((record) => record.taskMistakeCategories !== null), (record) => record.taskMistakeCategories, 'attempts'), { metric: 'attempts' }),
    chart('task-sequence-by-workflow', 'Average sequence accuracy by workflow', groupedMeanPoints(records, (row) => row.workspaceKind, (row) => row.sequenceAccuracyPercent).map((point) => ({ ...point, value: Math.round(point.value) })), { axisLabel: 'Sequence accuracy (%)' }),
    chart('task-action-distance', 'Average action errors by workflow', groupedMeanPoints(records, (row) => row.workspaceKind, (row) => row.taskMissingCount === null ? null : row.taskMissingCount + row.taskExtraCount + row.taskOutOfOrderCount), { metric: 'actions' }),
    chart('task-errors-by-speed', 'Average action errors by response time', groupedMeanPoints(records, (row) => speedBand(row.responseTimeSeconds), (row) => row.taskMissingCount === null ? null : row.taskMissingCount + row.taskExtraCount + row.taskOutOfOrderCount), { metric: 'actions' }),
  );
  if (game === 'error-detection') specs.push(
    chart('error-family', 'Accuracy by puzzle family', groupedPoints(records, (record) => record.puzzleFamily)),
    chart('error-rule-layer', 'Accuracy by rule layer', groupedPoints(records, (record) => record.ruleLayers)),
    chart('error-clues', 'Accuracy by clue count', groupedPoints(records, (record) => record.clueCount)),
    chart('error-anomaly-count', 'Accuracy by anomaly count', groupedPoints(records, (record) => record.expectedAnomalyCount)),
    chart('error-missed-versus-false', 'Missed anomalies versus false flags', [aggregatePoint('missed', 'Missed anomalies', records.filter((record) => (record.missedAnomalyCount ?? 0) > 0), 'attempts'), aggregatePoint('false', 'False flags', records.filter((record) => (record.falseFlagCount ?? 0) > 0), 'attempts')], { metric: 'attempts' }),
    chart('error-clean-puzzle', 'Clean-puzzle accuracy', groupedPoints(records, (record) => record.cleanPuzzle === null ? null : record.cleanPuzzle ? 'Clean' : 'Has anomalies')),
    chart('error-selection-distance', 'Average clue selections to fix by family', groupedMeanPoints(records, (row) => row.puzzleFamily, (row) => row.selectionDistance), { metric: 'selections' }),
    chart('cipher-rule-distance', 'Cipher Ring selection distance by rule layers', groupedMeanPoints(records.filter((row) => String(row.puzzleFamily).includes('cipher')), (row) => row.ruleLayers, (row) => row.selectionDistance), { metric: 'selections' }),
  );
  if (game === 'fraud-inspection') {
    specs.push(
      chart('fraud-run-mode', 'Exact-set accuracy by run mode', groupedPoints(records, (row) => row.fraudRunMode)),
      chart('fraud-difficulty', 'Exact-set accuracy by case difficulty', groupedPoints(records, (row) => row.fraudCaseDifficulty)),
      chart('fraud-clean', 'Exact-set accuracy by clean case', groupedPoints(records, (row) => row.fraudCleanCase === null ? null : row.fraudCleanCase ? 'Clean' : 'Has issues')),
      chart('fraud-issue-count', 'Exact-set accuracy by issue count', groupedPoints(records, (row) => row.fraudExpectedIssueCount)),
      chart('fraud-selection-distance', 'Average issue selections to fix by run mode', groupedMeanPoints(records, (row) => row.fraudRunMode, (row) => row.selectionDistance), { metric: 'selections' }),
    );
    const categoryRows = new Map();
    records.forEach((row) => Object.entries(row.fraudCategoryResults ?? {}).forEach(([id, result]) => {
      if (!categoryRows.has(id)) categoryRows.set(id, { found: [], missed: [], valid: [], falsePositive: [] });
      categoryRows.get(id)[result === 'false-positive' ? 'falsePositive' : result]?.push(row);
    }));
    specs.push(chart('fraud-issue-detection', 'Issue detection when present', [...categoryRows].map(([id, rows]) => {
      const present = [...rows.found, ...rows.missed];
      return { ...ratePoint(id, present), correct: rows.found.length, interval: wilsonInterval(rows.found.length, present.length), value: percent(rows.found.length, present.length) };
    }).filter((point) => point.count)));
    specs.push(chart('fraud-false-flags', 'False flags when issue absent', [...categoryRows].map(([id, rows]) => {
      const absent = [...rows.valid, ...rows.falsePositive];
      return { ...ratePoint(id, absent), correct: rows.falsePositive.length, interval: wilsonInterval(rows.falsePositive.length, absent.length), value: percent(rows.falsePositive.length, absent.length) };
    }).filter((point) => point.count), { axisLabel: 'False flags (%)' }));
  }
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
  if (game === 'fraud-inspection') {
    add('run-mode', 'Run mode', (record) => record.fraudRunMode, (value) => ({ game, fraud: { runModes: [value] } }), 'runMode');
    add('case-difficulty', 'Case difficulty', (record) => record.fraudCaseDifficulty, (value) => ({ game, fraud: { caseDifficulties: [value] } }), 'caseDifficulty');
    add('issues', 'Actual issue', (record) => record.fraudExpectedCategories, (value) => ({ game, fraud: { issueCategories: [value] } }), 'issueCategory');
    add('issue-count', 'Issue count', (record) => record.fraudExpectedIssueCount, (value) => ({ game, fraud: { expectedIssueCount: { min: Number(value), max: Number(value) } } }), 'issueCount');
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
