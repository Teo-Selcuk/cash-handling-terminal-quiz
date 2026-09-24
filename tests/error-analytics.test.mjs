import test from 'node:test';
import assert from 'node:assert/strict';
import { buildErrorAnalytics, ERROR_SEVERITY_BANDS } from '../progress-analytics.mjs';

function attempt(game, index, values = {}) {
  const gameType = {
    cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation',
    'error-detection': 'Error detection', 'fraud-inspection': 'Check & ID Fraud Inspection',
  }[game];
  return {
    game, gameType, timestamp: new Date(Date.UTC(2026, 8, 10, 12, index)).toISOString(),
    sessionId: `error-${game}-${index}`, questionNumber: 1, difficulty: 'Easy', outcome: 'Correct',
    ...values,
  };
}

test('overall rate is wrong completed attempts over completed attempts and complements accuracy', () => {
  const records = Array.from({ length: 100 }, (_, index) => attempt('cash', index, {
    outcome: index < 17 ? 'Incorrect' : 'Correct', cashTransactionType: 'Change', userAnswer: 'Change',
    amountDueCents: 1000, cashGivenCents: 2000, changeOrShortfallCents: 1000, userDeclaredAmountCents: 1000,
  }));
  records.push(attempt('cash', 101, { outcome: 'Not answered' }));
  const analytics = buildErrorAnalytics(records);
  assert.equal(analytics.summary.attempts, 100);
  assert.equal(analytics.summary.errors, 17);
  assert.equal(analytics.summary.errorRatePercent, 17);
  assert.equal(analytics.summary.accuracyPercent, 83);
  assert.equal(analytics.summary.errorRatePercent + analytics.summary.accuracyPercent, 100);
  assert.equal(analytics.summary.notAnswered, 1);
});

test('error percentages retain useful precision for non-even category counts', () => {
  const analytics = buildErrorAnalytics(Array.from({ length: 32 }, (_, index) => attempt('cash', index, {
    outcome: index < 3 ? 'Incorrect' : 'Correct', cashTransactionType: 'Change', userAnswer: 'Change',
    changeOrShortfallCents: 1000, userDeclaredAmountCents: index < 3 ? 950 : 1000,
  })));
  assert.equal(analytics.summary.errorRatePercent, 9.4);
  assert.equal(analytics.summary.accuracyPercent, 90.6);
  assert.equal(analytics.byCategory.find((group) => group.key === 'cash:amount:change').errorRatePercent, 9.4);
});

test('numeric cash error magnitude is separate from error rate and handles a zero target', () => {
  const analytics = buildErrorAnalytics([
    attempt('cash', 1, { outcome: 'Incorrect', cashTransactionType: 'Change', userAnswer: 'Change', changeOrShortfallCents: 2000, userDeclaredAmountCents: 1800 }),
    attempt('cash', 2, { outcome: 'Incorrect', cashTransactionType: 'Change', userAnswer: 'Change', changeOrShortfallCents: 10000, userDeclaredAmountCents: 7500 }),
    attempt('cash', 3, { cashTransactionType: 'Exact', userAnswer: 'Exact', changeOrShortfallCents: 0, userDeclaredAmountCents: 0 }),
    attempt('cash', 4, { outcome: 'Incorrect', cashTransactionType: 'Exact', userAnswer: 'Exact', changeOrShortfallCents: 0, userDeclaredAmountCents: 500 }),
  ]);
  assert.deepEqual(analytics.numeric.responses.map((row) => row.percentageError), [10, 25, 0, null]);
  assert.deepEqual(analytics.numeric.responses.map((row) => row.absoluteError), [200, 2500, 0, 500]);
  assert.equal(analytics.numeric.responses[3].percentageErrorLabel, 'N/A (correct answer is $0.00)');
  assert.equal(analytics.numeric.averagePercentageError, 11.67);
  assert.equal(analytics.numeric.medianPercentageError, 10);
  assert.equal(analytics.numeric.notApplicable, 1);
  assert.ok(Number.isFinite(analytics.numeric.responses[3].absoluteError));
});

test('cash categories use separate game-specific opportunity denominators and preserve co-occurring mistakes', () => {
  const records = [
    attempt('cash', 1, { outcome: 'Incorrect', cashTransactionType: 'Change', userAnswer: 'Short', changeOrShortfallCents: 700, userDeclaredAmountCents: 300, cashBuilder: true, userCashTotalCents: 250, customerBillRequestKind: 'specific', customerRequestResult: 'Not handled', cashDenominationStrictRequest: true, cashExpectedDenominationCounts: { 25: 4, 1000: 0 }, userCashDenominationCounts: { 25: 2, 1000: 1 } }),
    attempt('cash', 2, { cashTransactionType: 'Change', userAnswer: 'Change', changeOrShortfallCents: 700, userDeclaredAmountCents: 700, cashBuilder: true, userCashTotalCents: 700, customerBillRequestKind: 'specific', customerRequestResult: 'Handled', cashDenominationStrictRequest: true, cashExpectedDenominationCounts: { 25: 4, 1000: 0 }, userCashDenominationCounts: { 25: 4, 1000: 0 } }),
    attempt('cash', 3, { cashTransactionType: 'Exact', userAnswer: 'Exact', changeOrShortfallCents: 0, userDeclaredAmountCents: 0 }),
  ];
  const analytics = buildErrorAnalytics(records);
  const category = analytics.byCategory.find((item) => item.key === 'cash:amount:change');
  assert.deepEqual([category.opportunities, category.errors, category.errorRatePercent], [2, 1, 50]);
  assert.equal(analytics.byCategory.find((item) => item.key === 'cash:builder-total').errorRatePercent, 50);
  assert.equal(analytics.byCategory.find((item) => item.key === 'cash:customer-request').errorRatePercent, 50);
  const quarter = analytics.byRawInput.find((item) => item.key === 'cash:denomination:25');
  assert.deepEqual([quarter.opportunities, quarter.errors], [2, 1]);
  assert.ok([...analytics.attemptDetails.values()][0].mistakes.length >= 3);
});

test('memory uses sequence, digit-length and digit-position evidence without numeric deviation', () => {
  const analytics = buildErrorAnalytics([
    attempt('memory', 1, { expectedValues: ['1234'], answeredValues: ['1234'], digitsByValue: [4], totalDigits: 4, readTimeSeconds: 5 }),
    attempt('memory', 2, { outcome: 'Incorrect', expectedValues: ['1234'], answeredValues: ['1294'], digitsByValue: [4], totalDigits: 4, readTimeSeconds: 3 }),
    attempt('memory', 3, { outcome: 'Incorrect', expectedValues: ['123456'], answeredValues: ['12345'], digitsByValue: [6], totalDigits: 6, readTimeSeconds: 3 }),
  ]);
  assert.equal(analytics.numeric.responses.length, 0);
  const fourDigits = analytics.byCategory.find((item) => item.key === 'memory:value-length:4');
  assert.deepEqual([fourDigits.opportunities, fourDigits.errors, fourDigits.errorRatePercent], [2, 1, 50]);
  const positionThree = analytics.byRawInput.find((item) => item.key === 'memory:digit-position:3');
  assert.deepEqual([positionThree.opportunities, positionThree.errors], [3, 1]);
  assert.ok([...analytics.attemptDetails.values()].some((detail) => detail.mistakes.some((mistake) => mistake.label === 'Wrong digit · position 3')),
    'individual positional mistakes are retained for the selected attempt');
  assert.ok(analytics.byRawInput.some((item) => item.key === 'memory:missing-digit'));
  assert.ok(analytics.byRawInput.some((item) => item.key === 'memory:read-time:3'));
});

test('task analytics measure expected step targets and numeric invoice answers only', () => {
  const analytics = buildErrorAnalytics([
    attempt('task', 1, { workspaceKind: 'invoice', stepsExpected: 2, taskStepEvidence: [
      { type: 'set-text', targetId: 'task-invoice-calculation', targetLabel: 'Final total', expectedValue: '100', actualValue: '80', status: 'wrong-value' },
      { type: 'commit', targetId: 'task-save-workspace', targetLabel: 'Save changes', status: 'correct' },
    ], taskNumericResponses: [{ label: 'Invoice Final total', expectedValue: 100, submittedValue: 80 }] }),
    attempt('task', 2, { outcome: 'Incorrect', workspaceKind: 'invoice', stepsExpected: 1, taskStepEvidence: [
      { type: 'select-option', targetId: 'task-invoice-status', targetLabel: 'Review status', expectedValue: 'Approved', status: 'missing' },
    ] }),
  ]);
  const field = analytics.byRawInput.find((item) => item.key === 'task:field:task-invoice-calculation');
  assert.deepEqual([field.opportunities, field.errors], [1, 1]);
  assert.equal(analytics.numeric.responses.length, 1);
  assert.equal(analytics.numeric.responses[0].percentageError, 20);
  assert.equal(analytics.byCategory.find((item) => item.key === 'task:workspace:invoice').opportunities, 2);
  assert.ok(analytics.byRawInput.some((item) => item.key === 'task:field:task-invoice-status'));
});

test('missing legacy task numeric targets stay unavailable instead of becoming zero', () => {
  const analytics = buildErrorAnalytics([attempt('task', 10, { taskNumericResponses: [
    { label: 'Invoice Final total', expectedValue: null, submittedValue: 5 },
  ] })]);
  assert.equal(analytics.numeric.responses.length, 0);
});

test('error detection counts each clue and fraud keeps present misses separate from absent false positives', () => {
  const analytics = buildErrorAnalytics([
    attempt('error-detection', 1, { puzzleFamilyId: 'cipher-check', difficulty: 'Hard', errorDetailEvidence: [
      { id: 'cipher-1', label: 'Cipher seal 1', isAnomaly: true, selected: false },
      { id: 'cipher-2', label: 'Cipher seal 2', isAnomaly: false, selected: true },
    ] }),
    attempt('fraud-inspection', 2, { outcome: 'Incorrect', fraudCaseDifficulty: 'Hard', fraudRunMode: 'standard', fraudCategoryResults: {
      'payee-mismatch': 'missed', 'amount-mismatch': 'false-positive', 'id-expired': 'valid',
    } }),
    attempt('fraud-inspection', 3, { fraudCaseDifficulty: 'Hard', fraudRunMode: 'standard', fraudCategoryResults: {
      'payee-mismatch': 'found', 'amount-mismatch': 'valid', 'id-expired': 'valid',
    } }),
  ]);
  const clue = analytics.byRawInput.find((item) => item.key === 'error-detection:clue:cipher-1');
  assert.deepEqual([clue.opportunities, clue.errors], [1, 1]);
  const payee = analytics.byRawInput.find((item) => item.key === 'fraud:issue-present:payee-mismatch');
  assert.deepEqual([payee.opportunities, payee.errors, payee.falseNegatives], [2, 1, 1]);
  const amount = analytics.byRawInput.find((item) => item.key === 'fraud:issue-absent:amount-mismatch');
  assert.deepEqual([amount.opportunities, amount.errors, amount.falsePositives], [2, 1, 1]);
  assert.equal(analytics.byDifficulty.find((item) => item.key === 'fraud-inspection:Hard').opportunities, 2);
});

test('a legacy fraud timeout counts each known present issue once without inventing absent-category choices', () => {
  const analytics = buildErrorAnalytics([
    attempt('fraud-inspection', 1, { outcome: 'Timed Out', fraudExpectedCategories: ['payee-mismatch'], fraudMissedCategories: ['payee-mismatch'], fraudCleanCase: false }),
  ]);
  const payee = analytics.byRawInput.find((group) => group.key === 'fraud:issue-present:payee-mismatch');
  assert.deepEqual([payee.opportunities, payee.errors, payee.falseNegatives], [1, 1, 1]);
});

test('error-detection timeout uses the saved clue selections instead of assigning every anomaly as missed', () => {
  const analytics = buildErrorAnalytics([attempt('error-detection', 99, { outcome: 'Timed Out', puzzleFamilyId: 'cipher-check', errorDetailEvidence: [
    { id: 'selected-anomaly', isAnomaly: true, selected: true },
    { id: 'unmarked-valid', isAnomaly: false, selected: false },
  ] })]);
  assert.equal(analytics.byRawInput.find((group) => group.key === 'error-detection:clue:selected-anomaly').errors, 0);
  assert.equal(analytics.summary.errorRatePercent, 100, 'the timeout remains an overall attempt error');
});

test('small samples stay visible but are excluded from ranked strengths and weaknesses', () => {
  const analytics = buildErrorAnalytics([
    attempt('cash', 1, { outcome: 'Incorrect', cashTransactionType: 'Change', userAnswer: 'Short', amountDueCents: 1000, cashGivenCents: 2000 }),
  ]);
  const change = analytics.byCategory.find((item) => item.key === 'cash:transaction-type');
  assert.equal(change.errorRatePercent, 100);
  assert.equal(change.displayRate, '100% (1 of 1)');
  assert.equal(change.eligibleForRanking, false);
  assert.ok(!analytics.weaknesses.some((item) => item.key === change.key));
});

test('difficulty and relevant raw-input combinations require five opportunities and compare by percentage points', () => {
  const current = Array.from({ length: 5 }, (_, index) => attempt('cash', index, {
    outcome: index < 3 ? 'Incorrect' : 'Correct', difficulty: 'Hard', cashTransactionType: 'Change', userAnswer: index < 3 ? 'Short' : 'Change',
    amountDueCents: 1000, cashGivenCents: 2000, changeOrShortfallCents: 1000, userDeclaredAmountCents: index < 3 ? 500 : 1000,
    customerBillRequestKind: 'specific', cashExpectedDenominationCounts: { 25: 2 }, userCashDenominationCounts: { 25: index < 3 ? 1 : 2 }, cashDenominationStrictRequest: true,
  }));
  const previous = Array.from({ length: 5 }, (_, index) => attempt('cash', index + 20, {
    outcome: index === 0 ? 'Incorrect' : 'Correct', difficulty: 'Hard', cashTransactionType: 'Change', userAnswer: index === 0 ? 'Short' : 'Change',
    amountDueCents: 1000, cashGivenCents: 2000, changeOrShortfallCents: 1000, userDeclaredAmountCents: index === 0 ? 500 : 1000,
    customerBillRequestKind: 'specific', cashExpectedDenominationCounts: { 25: 2 }, userCashDenominationCounts: { 25: index === 0 ? 1 : 2 }, cashDenominationStrictRequest: true,
  }));
  const analytics = buildErrorAnalytics(current, { previousRecords: previous, minimumOpportunities: 5 });
  const level = analytics.byDifficulty.find((item) => item.key === 'cash:Hard');
  assert.equal(level.errorRatePercent, 60);
  const combo = analytics.combinations.find((item) => item.key === 'cash:change:Hard:strict-request');
  assert.deepEqual([combo.opportunities, combo.errors], [5, 3]);
  assert.equal(analytics.comparison.errorRateDeltaPoints, 40);
  assert.equal(analytics.comparison.label, 'Previous 5 relevant attempts');
});

test('cash raw-input combinations isolate denomination mismatches and honor the five-opportunity threshold', () => {
  const records = Array.from({ length: 6 }, (_, index) => attempt('cash', index, {
    outcome: index < 2 ? 'Incorrect' : 'Correct', cashTransactionType: 'Change', difficulty: 'Hard', timeLimitSeconds: 15,
    customerBillRequestKind: 'specific', cashDenominationStrictRequest: true,
    cashExpectedDenominationCounts: { 25: 2, 10: 1 },
    userCashDenominationCounts: index === 0 ? { 25: 1, 10: 1 } : { 25: 2, 10: 1 },
    userAnswer: 'Change', changeOrShortfallCents: 60, userDeclaredAmountCents: index === 1 ? 50 : 60,
  }));
  const analytics = buildErrorAnalytics(records);
  const combo = analytics.inputCombinations.find((group) => group.label.includes('Quarters + Dimes'));
  assert.deepEqual([combo.opportunities, combo.errors, combo.errorRatePercent], [6, 1, 16.7]);
  assert.equal(combo.eligibleForRanking, true);
  assert.ok(analytics.weaknesses.some((group) => group.key === combo.key));
  assert.equal(analytics.byCategory.find((group) => group.key === 'cash:amount:change').errors, 1,
    'a numeric amount mistake remains separate from the denomination-mix rate');
});

test('legacy records remain usable and distribution/severity bands handle zero and boundary values', () => {
  assert.deepEqual(ERROR_SEVERITY_BANDS.map((band) => band.label), ['Correct', 'Small', 'Moderate', 'Large', 'Very large']);
  const analytics = buildErrorAnalytics([
    attempt('cash', 1, { outcome: 'Correct' }),
    attempt('cash', 2, { outcome: 'Incorrect' }),
  ]);
  assert.equal(analytics.summary.errorRatePercent, 50);
  assert.equal(analytics.numeric.responses.length, 0);
  assert.equal(analytics.numeric.medianPercentageError, null);
  assert.deepEqual(analytics.numeric.distribution.map((item) => item.count), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(analytics.numeric.severityFor(0), ERROR_SEVERITY_BANDS[0]);
  assert.equal(analytics.numeric.severityFor(5).label, 'Small');
});
