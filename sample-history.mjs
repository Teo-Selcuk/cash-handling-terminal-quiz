const DAY_MS = 86400000;
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Custom'];
const GAMES = ['cash', 'memory', 'task', 'error-detection', 'fraud-inspection'];
const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 25, 10, 5, 1];
const FRAUD_CATEGORIES = [
  'payee-mismatch', 'amount-mismatch', 'date-issue', 'check-alteration', 'handwriting-issue',
  'missing-required-field', 'endorsement-missing', 'endorsement-signature-mismatch',
  'maker-signature-suspicious', 'check-number-mismatch', 'routing-issue', 'account-information-issue',
  'id-expired', 'id-information-inconsistent', 'id-altered',
];
const ERROR_FAMILIES = ['cipher-check', 'pattern-sequence', 'visual-ledger', 'transaction-rule'];
const TASK_CATEGORIES = ['missing', 'extra', 'out-of-order', 'wrong-tab', 'uncorrected'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function randomSource(seed) {
  let value = Number(seed) >>> 0 || 1;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function select(random, values) { return values[Math.floor(random() * values.length)]; }
function selectUnique(random, values, count) {
  const pool = [...values];
  const chosen = [];
  while (chosen.length < Math.min(count, pool.length)) chosen.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return chosen;
}

function dateFor(index, recentCount, count, now) {
  const dayIndex = index < recentCount
    ? index % 30
    : 31 + Math.floor(((index - recentCount) / Math.max(1, count - recentCount - 1)) * 150);
  const date = new Date(now);
  date.setDate(date.getDate() - dayIndex);
  date.setHours(8 + (Math.floor(index / 30) % 9), (index * 17) % 60, (index * 13) % 60, 0);
  return date;
}

function cashRecord(record, random, index) {
  const due = 100 + Math.floor(random() * 60000);
  const delta = select(random, [0, 0, 1, 5, 25, 100, 500, 1250, -25, -100, -500]);
  const tendered = Math.max(0, due + delta);
  const counts = new Map();
  let remaining = tendered;
  for (const denomination of DENOMINATIONS) {
    const count = Math.min(Math.floor(remaining / denomination), Math.floor(random() * 4));
    if (count) { counts.set(denomination, count); remaining -= denomination * count; }
  }
  if (remaining) counts.set(1, (counts.get(1) ?? 0) + remaining);
  const tenderBreakdown = [...counts].map(([cents, count]) => ({ cents, category: cents >= 100 ? 'Bill' : 'Coin', count }));
  const pieces = tenderBreakdown.reduce((sum, item) => sum + item.count, 0);
  const bills = tenderBreakdown.filter((item) => item.cents >= 100).reduce((sum, item) => sum + item.count, 0);
  const type = delta > 0 ? 'Change' : delta < 0 ? 'Short' : 'Exact';
  const wrongType = type === 'Exact' ? 'Change' : type === 'Change' ? 'Short' : 'Change';
  const outcome = record.outcome === 'Correct' ? type : select(random, [wrongType, wrongType]);
  const hasRequest = index % 7 === 0;
  const requestKind = hasRequest ? select(random, ['specific', 'remainder', 'mixed', 'low', 'high', 'mismatch']) : '';
  const cashBuilder = index % 3 === 0 || hasRequest;
  const strictRequest = hasRequest && ['specific', 'remainder', 'high'].includes(requestKind);
  const expectedCounts = {};
  let payoutRemaining = Math.abs(delta);
  for (const denomination of DENOMINATIONS) {
    const count = Math.floor(payoutRemaining / denomination);
    if (count) { expectedCounts[denomination] = count; payoutRemaining -= count * denomination; }
  }
  const selectedCounts = { ...expectedCounts };
  if (strictRequest && record.outcome === 'Incorrect' && random() < 0.5) {
    const denomination = select(random, DENOMINATIONS);
    selectedCounts[denomination] = Math.max(0, (selectedCounts[denomination] ?? 0) + (random() < 0.5 ? 1 : -1));
  }
  const declaredAmount = record.outcome === 'Correct' ? Math.abs(delta) : Math.max(0, Math.abs(delta) + select(random, [1, 5, 25, 100]));
  const selectedTotal = cashBuilder ? Object.entries(selectedCounts).reduce((sum, [cents, count]) => sum + Number(cents) * count, 0) : 0;
  const answerMode = hasRequest ? 'Cash builder + customer requests' : cashBuilder ? 'Cash builder' : 'Normal';
  return {
    ...record, game: 'cash', gameType: 'Cash handling',
    amountDueCents: due, cashGivenCents: tendered, tenderBreakdown, tenderDenominationCounts: Object.fromEntries(counts),
    tenderBillCount: bills, tenderCoinCount: pieces - bills, tenderPieceCount: pieces, tenderDenominationTypes: tenderBreakdown.length,
    cashTransactionType: type, changeOrShortfallCents: Math.abs(delta), userAnswer: record.outcome === 'Timed Out' ? '' : outcome,
    userDeclaredAmountCents: declaredAmount,
    answerMode, cashBuilder, customerRequests: hasRequest,
    customerBillRequestKind: requestKind,
    customerRequestResult: !hasRequest ? 'Not requested' : record.outcome === 'Timed Out' || record.outcome === 'Incorrect' && random() < 0.65 ? 'Not handled' : 'Handled',
    ...(cashBuilder ? { userCashTotalCents: selectedTotal, userCashBreakdown: JSON.stringify(selectedCounts) } : {}),
    ...(strictRequest ? {
      cashDenominationStrictRequest: true,
      cashExpectedDenominationCounts: expectedCounts,
      userCashDenominationCounts: record.outcome === 'Timed Out' ? null : selectedCounts,
    } : {}),
    cashAddClicks: pieces, cashRemoveClicks: Math.floor(random() * 3), cashQuickEntries: Math.floor(random() * 4), cashClearClicks: Math.floor(random() * 2),
    breakdownMatchesDeclaredAmount: record.outcome === 'Timed Out' ? false : selectedTotal === declaredAmount,
  };
}

function memoryRecord(record, random) {
  const valueCount = 1 + Math.floor(random() * 3);
  const digitCounts = Array.from({ length: valueCount }, () => 4 + Math.floor(random() * 9));
  const expectedValues = digitCounts.map((length) => Array.from({ length }, () => Math.floor(random() * 10)).join(''));
  const correctValueCount = record.outcome === 'Correct' ? valueCount : record.outcome === 'Timed Out' ? 0 : Math.floor(random() * valueCount);
  const answeredValues = record.outcome === 'Timed Out' ? [] : expectedValues.map((value, index) => index < correctValueCount ? value
    : value.slice(0, -1) + String((Number(value.at(-1)) + 1) % 10));
  return {
    ...record, game: 'memory', gameType: 'Number memory', expectedValues, answeredValues, valueCount,
    digitsByValue: digitCounts, totalDigits: digitCounts.reduce((sum, digits) => sum + digits, 0), decimalMode: false,
    readTimeSeconds: select(random, [1, 2, 3, 5, 8]), writeTimeSeconds: record.timeLimitSeconds,
    correctValueCount, mismatchPositions: record.outcome === 'Correct' ? [] : [digitCounts.at(-1)],
    memoryStreak: correctValueCount === valueCount ? 1 + Math.floor(random() * 12) : 0,
    expectedAnswer: expectedValues.join(' • '), userAnswer: record.outcome === 'Timed Out' ? '' : answeredValues.join(' • '),
  };
}

function taskRecord(record, random) {
  const stepsExpected = 2 + Math.floor(random() * 9);
  const mistakes = record.outcome === 'Correct' ? 0 : record.outcome === 'Timed Out' ? stepsExpected : 1 + Math.floor(random() * 4);
  const workspaceKind = select(random, ['records', 'invoice', 'casework']);
  const targetPool = workspaceKind === 'invoice'
    ? ['task-invoice-calculation', 'task-invoice-status', 'task-invoice-category', 'task-invoice-reference', 'task-invoice-verified', 'task-invoice-approved', 'task-invoice-note', 'task-invoice-verification', 'task-tab-calculations', 'task-save-workspace']
    : workspaceKind === 'casework'
      ? ['task-case-status', 'task-case-queue', 'task-case-reference', 'task-case-followup', 'task-case-verification', 'task-case-note', 'task-confirm-case-note', 'task-open-verification-tab', 'task-tab-case-details', 'task-save-workspace']
      : ['task-row-1-status', 'task-row-2-priority', 'task-row-3-complete', 'task-row-4-reference', 'task-row-1-priority', 'task-row-2-status', 'task-row-3-reference', 'task-row-4-complete', 'task-tab-orders', 'task-save-workspace'];
  const targetIds = targetPool.slice(0, stepsExpected);
  const taskStepEvidence = targetIds.map((targetId, stepNumber) => {
    const numeric = targetId === 'task-invoice-calculation';
    const expectedValue = numeric ? 250 + Math.floor(random() * 9750)
      : targetId.includes('status') ? select(random, ['Review', 'Approved', 'On hold'])
        : targetId.includes('priority') ? select(random, ['Normal', 'High', 'Urgent'])
          : targetId.includes('complete') || targetId.includes('verified') || targetId.includes('followup') ? true
            : `REF-${1000 + Math.floor(random() * 9000)}`;
    let status = record.outcome === 'Correct' ? 'correct' : record.outcome === 'Timed Out' ? 'missing'
      : select(random, ['wrong-value', 'missing', 'out-of-order', 'correct']);
    if (record.outcome === 'Incorrect' && stepNumber === 0) status = select(random, ['wrong-value', 'missing', 'out-of-order']);
    const actualValue = status === 'correct' ? expectedValue : status === 'missing' ? null
      : numeric ? Math.max(0, expectedValue + select(random, [-500, -100, 75, 250]))
        : typeof expectedValue === 'boolean' ? !expectedValue : `${expectedValue}-wrong`;
    const label = targetId === 'task-invoice-calculation' ? 'Invoice · Final total'
      : targetId === 'task-invoice-status' || targetId === 'task-case-status' ? 'Workflow · Status'
        : targetId === 'task-invoice-category' ? 'Invoice · Cost category'
          : targetId.includes('priority') ? 'Record · Priority' : targetId.includes('reference') ? 'Workflow · Reference' : targetId.replaceAll('task-', '').replaceAll('-', ' ');
    const type = targetId.includes('status') || targetId.includes('category') || targetId.includes('priority') ? 'select-option'
      : targetId.includes('complete') || targetId.includes('approved') || targetId.includes('verified') || targetId.includes('followup') ? 'toggle-checkbox'
        : targetId.startsWith('task-tab-') ? 'activate-tab' : targetId === 'task-save-workspace' ? 'commit'
          : targetId.includes('open-') ? 'open-workspace-tab' : targetId.includes('case-note') ? 'set-text' : 'set-text';
    return { stepNumber: stepNumber + 1, type, targetId, targetLabel: label, expectedValue, actualValue, status };
  });
  const categories = [...new Set([
    ...(taskStepEvidence.some((step) => step.status === 'missing') ? ['missing'] : []),
    ...(taskStepEvidence.some((step) => step.status === 'out-of-order') ? ['out-of-order'] : []),
    ...(record.outcome === 'Incorrect' && random() < 0.35 ? ['extra'] : []),
  ])];
  const taskNumericResponses = taskStepEvidence.filter((step) => step.targetId === 'task-invoice-calculation').map((step) => ({
    label: 'Invoice Final total', expectedValue: Number(step.expectedValue),
    submittedValue: Number.isFinite(Number(step.actualValue)) ? Number(step.actualValue) : null,
  }));
  return {
    ...record, game: 'task', gameType: 'Task simulation', workspaceKind,
    workspaceRows: 3 + Math.floor(random() * 10), workspaceTabs: 2 + Math.floor(random() * 5),
    stepsExpected, stepsCompleted: record.outcome === 'Timed Out' ? 0 : Math.max(0, stepsExpected - mistakes), mistakes,
    sequenceAccuracyPercent: Math.round((stepsExpected - mistakes) / stepsExpected * 100), taskMistakeCategories: [...new Set(categories)],
    taskStepEvidence, taskNumericResponses,
    taskMissingCount: Number(categories.includes('missing')), taskExtraCount: Number(categories.includes('extra')),
    taskOutOfOrderCount: Number(categories.includes('out-of-order')), taskTabChanges: Math.floor(random() * 8),
    taskCorrections: Math.floor(random() * 3), briefingSeconds: 10 + Math.floor(random() * 30),
    recallSeconds: record.timeLimitSeconds, demoStepMilliseconds: 700 + Math.floor(random() * 1200),
    expectedAnswer: `${stepsExpected} ordered steps`, userAnswer: record.outcome === 'Timed Out' ? '' : `${stepsExpected - mistakes} completed steps`,
  };
}

function errorRecord(record, random) {
  const detailCount = 4 + Math.floor(random() * 9);
  const expectedErrorCount = random() < 0.12 ? 0 : 1 + Math.floor(random() * Math.min(5, detailCount));
  let missedAnomalyCount = record.outcome === 'Correct' ? 0 : record.outcome === 'Timed Out' ? expectedErrorCount : Math.min(expectedErrorCount, Math.floor(random() * 3));
  let falseFlagCount = record.outcome === 'Correct' || record.outcome === 'Timed Out' ? 0 : Math.floor(random() * 3);
  if (record.outcome === 'Incorrect' && missedAnomalyCount === 0 && falseFlagCount === 0) {
    if (expectedErrorCount) missedAnomalyCount = 1; else falseFlagCount = 1;
  }
  const expectedErrorIds = Array.from({ length: expectedErrorCount }, (_, i) => `error-${i + 1}`);
  const missedErrorIds = expectedErrorIds.slice(0, missedAnomalyCount);
  const selectedDetailIds = expectedErrorIds.slice(missedAnomalyCount);
  const falseFlagIds = Array.from({ length: falseFlagCount }, (_, i) => `valid-${i + 1}`);
  selectedDetailIds.push(...falseFlagIds);
  const familyId = select(random, ERROR_FAMILIES);
  const errorDetailEvidence = Array.from({ length: detailCount }, (_, index) => {
    const id = index < expectedErrorCount ? expectedErrorIds[index] : `valid-${index - expectedErrorCount + 1}`;
    const isAnomaly = expectedErrorIds.includes(id);
    return { id, label: `${familyId.replaceAll('-', ' ')} clue ${index + 1}`, presentedValue: isAnomaly ? `Anomalous detail ${index + 1}` : `Valid detail ${index + 1}`,
      expectedValue: `Rule-consistent detail ${index + 1}`, isAnomaly, selected: selectedDetailIds.includes(id) };
  });
  return {
    ...record, game: 'error-detection', gameType: 'Error detection', puzzleFamilyId: familyId,
    puzzleFamily: select(random, ['Cipher check', 'Pattern sequence', 'Visual ledger', 'Transaction rule']),
    puzzleType: select(random, ['Analytical', 'Visual']), ruleLayers: 1 + Math.floor(random() * 4), detailCount,
    expectedErrorCount, selectedErrorCount: selectedDetailIds.length,
    correctlyFlagged: expectedErrorCount - missedAnomalyCount, missedAnomalyCount, falseFlagCount,
    expectedErrorIds, selectedDetailIds, missedErrorIds, falseFlagIds,
    errorDetailEvidence,
    cleanPuzzle: expectedErrorCount === 0, timeLimitSeconds: record.timeLimitSeconds,
    expectedAnswer: expectedErrorCount ? `${expectedErrorCount} anomalies` : 'No anomalies.',
    userAnswer: record.outcome === 'Timed Out' ? '' : record.outcome === 'Correct' ? 'Exact anomaly set' : `${missedAnomalyCount} missed, ${falseFlagCount} false flags`,
  };
}

function fraudRecord(record, random) {
  const actualCount = random() < 0.12 ? 0 : Math.floor(random() * (record.difficulty === 'Easy' ? 3 : 6));
  const fraudExpectedCategories = selectUnique(random, FRAUD_CATEGORIES, actualCount);
  let fraudFalseNegativeCount = record.outcome === 'Correct' ? 0 : record.outcome === 'Timed Out' ? actualCount : Math.min(actualCount, Math.floor(random() * 3));
  let fraudFalsePositiveCount = record.outcome === 'Correct' || record.outcome === 'Timed Out' ? 0 : Math.floor(random() * 3);
  if (record.outcome === 'Incorrect' && fraudFalseNegativeCount === 0 && fraudFalsePositiveCount === 0) {
    if (actualCount) fraudFalseNegativeCount = 1; else fraudFalsePositiveCount = 1;
  }
  const fraudSelectedCategories = fraudExpectedCategories.slice(fraudFalseNegativeCount);
  if (fraudFalsePositiveCount) fraudSelectedCategories.push(...selectUnique(random, FRAUD_CATEGORIES.filter((id) => !fraudExpectedCategories.includes(id)), fraudFalsePositiveCount));
  const fraudCategoryResults = Object.fromEntries(FRAUD_CATEGORIES.map((id) => [id,
    fraudExpectedCategories.includes(id) ? fraudSelectedCategories.includes(id) ? 'found' : 'missed'
      : fraudSelectedCategories.includes(id) ? 'false-positive' : 'valid']));
  return {
    ...record, game: 'fraud-inspection', gameType: 'Check & ID Fraud Inspection',
    fraudRunMode: record.fraudRunMode, fraudCaseDifficulty: record.difficulty,
    fraudTimeLimitSeconds: record.timeLimitSeconds, fraudExpectedCategories, fraudSelectedCategories,
    fraudExpectedIssueCount: actualCount, fraudFalseNegativeCount, fraudFalsePositiveCount,
    fraudCorrectlyIdentifiedCount: actualCount - fraudFalseNegativeCount,
    fraudSelectableCategoryCount: FRAUD_CATEGORIES.length, fraudCategoryResults,
    fraudCleanCase: actualCount === 0, fraudCorrectlyRecognizedClean: actualCount === 0 && fraudSelectedCategories.length === 0,
    fraudSignatureError: fraudExpectedCategories.includes('maker-signature-suspicious'),
    fraudDateError: fraudExpectedCategories.includes('date-issue'), fraudAmountError: fraudExpectedCategories.includes('amount-mismatch'),
    fraudNameError: fraudExpectedCategories.includes('payee-mismatch'), fraudIdError: fraudExpectedCategories.some((id) => id.startsWith('id-')),
    expectedAnswer: actualCount ? fraudExpectedCategories.join(', ') : 'Clean check and ID',
    userAnswer: record.outcome === 'Timed Out' ? '' : fraudSelectedCategories.join(', ') || 'No issues found',
  };
}

/** Make isolated fake local-history rows. No browser storage is read or written. */
export function generateSampleHistory({ now = new Date(), count = 1200, seed = Math.floor(Math.random() * 0xFFFFFFFF) } = {}) {
  const total = clamp(Math.floor(Number(count) || 1200), 1, 10000);
  const random = randomSource(seed);
  const recentCount = Math.ceil(total * 0.85);
  const outcomes = ['Correct', 'Correct', 'Correct', 'Correct', 'Incorrect'];
  const attemptsByGameDay = new Map();
  const sessionModes = new Map();
  const rows = [];
  for (let index = 0; index < total; index += 1) {
    const dayIndex = index < recentCount ? index % 30 : 31 + Math.floor(((index - recentCount) / Math.max(1, total - recentCount - 1)) * 150);
    const daysOnDate = index < recentCount ? Math.floor(index / 30) : index - recentCount;
    const elapsed = random() < 0.025 ? 65 + Math.floor(random() * 140) : 3 + random() * (4 + (daysOnDate % 13) * 2.7);
    const timeLimitSeconds = elapsed > 60 ? 30 : 60;
    const outcome = elapsed > timeLimitSeconds ? 'Timed Out' : select(random, outcomes);
    const game = GAMES[index % GAMES.length];
    const dateGameKey = `${dayIndex}:${game}`;
    const attemptInDateGame = attemptsByGameDay.get(dateGameKey) ?? 0;
    attemptsByGameDay.set(dateGameKey, attemptInDateGame + 1);
    const sessionId = `sample-${dayIndex}-${game}-${Math.floor(attemptInDateGame / 5)}`;
    if (!sessionModes.has(sessionId)) {
      if (game === 'cash') sessionModes.set(sessionId, { sessionMode: select(random, ['Guided practice', 'Testing']) });
      else if (game === 'fraud-inspection') {
        const fraudRunMode = select(random, ['standard', 'rapid-review', 'sudden-death', 'endurance']);
        sessionModes.set(sessionId, { sessionMode: ({ standard: 'Standard', 'rapid-review': 'Rapid Review', 'sudden-death': 'Sudden Death', endurance: 'Endurance' })[fraudRunMode], fraudRunMode });
      } else sessionModes.set(sessionId, {});
    }
    const timestamp = dateFor(index, recentCount, total, new Date(now));
    const common = {
      isSample: true, attemptId: `sample-${Number(seed) >>> 0}-${index}`, timestamp: timestamp.toISOString(), sessionId,
      questionNumber: attemptInDateGame % 5 + 1, difficulty: DIFFICULTIES[index % DIFFICULTIES.length], outcome,
      timeUsedSeconds: Number(elapsed.toFixed(1)), timeLimitSeconds,
      ...sessionModes.get(sessionId),
      expectedAnswer: '', userAnswer: '',
    };
    const row = game === 'cash' ? cashRecord(common, random, index)
      : game === 'memory' ? memoryRecord(common, random)
        : game === 'task' ? taskRecord(common, random)
          : game === 'error-detection' ? errorRecord(common, random) : fraudRecord(common, random);
    rows.push(row);
  }
  return rows;
}
