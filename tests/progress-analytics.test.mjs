import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHistoryRecord, filterHistory, buildProgressModel, buildGameFilters,
  buildChartSpecs, buildConditionalReport, wilsonInterval, comparePeriods, findWeaknesses, recommendNextChallenge,
} from '../progress-analytics.mjs';

const at = (minute, extra = {}) => ({
  timestamp: new Date(Date.UTC(2026, 8, 1, 9, minute)).toISOString(),
  sessionId: `session-${minute}`, questionNumber: 1, difficulty: 'Easy',
  outcome: minute % 2 ? 'Correct' : 'Incorrect', timeUsedSeconds: 8, ...extra,
});

const cash = (minute, extra = {}) => at(minute, {
  gameType: 'Cash handling', amountDueCents: 12500, cashGivenCents: 22500,
  tenderBreakdown: [{ cents: 10000, category: 'Bill', count: 2 }, { cents: 2500, category: 'Bill', count: 1 }],
  tenderBillCount: 3, tenderCoinCount: 0, tenderPieceCount: 3, tenderDenominationTypes: 2,
  cashTransactionType: 'Change', changeOrShortfallCents: 10000, customerBillRequestKind: 'specific',
  ...extra,
});

const memory = (minute, extra = {}) => at(minute, {
  gameType: 'Number memory', expectedValues: ['12345678'], answeredValues: ['12345670'],
  digitsByValue: [8], totalDigits: 8, decimalMode: false, valueCount: 1,
  readTimeSeconds: 4, writeTimeSeconds: 8, correctValueCount: 0, mismatchPositions: [8],
  ...extra,
});

const task = (minute, extra = {}) => at(minute, {
  gameType: 'Task simulation', workspaceKind: 'invoice', stepsExpected: 5, stepsCompleted: 3,
  workspaceRows: 6, workspaceTabs: 3, briefingSeconds: 15, recallSeconds: 60,
  demoStepMilliseconds: 1200, sequenceAccuracyPercent: 60, mistakes: 2,
  taskMistakeCategories: ['missing', 'out-of-order'], ...extra,
});

const errorPuzzle = (minute, extra = {}) => at(minute, {
  gameType: 'Error detection', puzzleFamilyId: 'cipher-check', puzzleType: 'analytical',
  ruleLayers: 2, detailCount: 5, expectedErrorCount: 2, selectedErrorCount: 1,
  missedAnomalyCount: 1, falseFlagCount: 0, cleanPuzzle: false, timeLimitSeconds: 28,
  ...extra,
});

const fraudInspection = (minute, extra = {}) => at(minute, {
  gameType: 'Check & ID Fraud Inspection', game: 'fraud-inspection', sessionMode: 'standard',
  fraudRunMode: 'standard', fraudCaseDifficulty: 'Hard', fraudTimeLimitSeconds: 20,
  fraudExpectedCategories: ['endorsement-signature-mismatch'], fraudFalsePositiveCount: 1,
  fraudFalseNegativeCount: 0, fraudCleanCase: false, ...extra,
});

test('normalizes legacy records without inventing unavailable mechanics', () => {
  const normalized = normalizeHistoryRecord(at(1, { gameType: 'Cash handling' }), 0);
  assert.equal(normalized.game, 'cash');
  assert.equal(normalized.totalPieces, null);
  assert.equal(normalized.hasRecorded('totalPieces'), false);
  assert.equal(normalized.cashBuilder, null);
  assert.equal(normalized.hasRecorded('cashBuilder'), false);
  assert.equal(normalized.responseTimeSeconds, 8);
});

test('filters compound cash facets with intersection semantics', () => {
  const records = [cash(1), cash(2), cash(3, { outcome: 'Incorrect', cashTransactionType: 'Short' })];
  const filtered = filterHistory(records, {
    game: 'cash', outcomes: ['Incorrect'], cash: { totalPieces: { min: 2, max: 5 }, denominationTypes: { min: 2 }, transactionTypes: ['Change'] },
  });
  assert.deepEqual(filtered.map((row) => row.attemptId), ['session-2:1']);
});

test('offers mechanics that each game actually saves, not generic copies', () => {
  assert.ok(buildGameFilters(filterHistory([cash(1)], { game: 'cash' }), 'cash').fields.some((field) => field.id === 'cash.denominations'));
  assert.ok(buildGameFilters(filterHistory([memory(2)], { game: 'memory' }), 'memory').fields.some((field) => field.id === 'memory.totalDigits'));
  assert.ok(buildGameFilters(filterHistory([task(3)], { game: 'task' }), 'task').fields.some((field) => field.id === 'task.mistakeCategory'));
  assert.ok(buildGameFilters(filterHistory([errorPuzzle(4)], { game: 'error-detection' }), 'error-detection').fields.some((field) => field.id === 'error.cleanPuzzle'));
  assert.ok(buildGameFilters(filterHistory([fraudInspection(5)], { game: 'fraud-inspection' }), 'fraud-inspection').fields.some((field) => field.id === 'fraud.issueCategories'));
});

test('fraud inspection history filters preserve actual issue, timer, and run-mode evidence', () => {
  const records = [
    fraudInspection(6),
    fraudInspection(7, { fraudExpectedCategories: ['id-expired'], fraudRunMode: 'rapid-review', fraudTimeLimitSeconds: 15 }),
  ];
  const filtered = filterHistory(records, {
    game: 'fraud-inspection',
    fraud: { issueCategories: ['endorsement-signature-mismatch'], timeLimitSeconds: { min: 20 }, runModes: ['standard'] },
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].fraudExpectedIssueCount, 1);
  assert.equal(filtered[0].fraudFalsePositiveCount, 1);
});

test('progress and comparisons use answered attempts without treating missing time as zero', () => {
  const records = [cash(1, { outcome: 'Correct', timeUsedSeconds: 10 }), cash(2, { outcome: 'Incorrect', timeUsedSeconds: null })];
  const model = buildProgressModel(filterHistory(records));
  assert.equal(model.accuracyPercent, 50);
  assert.equal(model.averageResponseTimeSeconds, 10);
  const comparison = comparePeriods(filterHistory([...records, cash(24 * 60 + 1, { outcome: 'Correct', timeUsedSeconds: 5 })]), {
    previous: { start: '2026-09-01', end: '2026-09-01' }, current: { start: '2026-09-02', end: '2026-09-02' },
  });
  assert.equal(comparison.current.accuracyPercent, 100);
  assert.equal(comparison.accuracyDelta, 50);
});

test('charts only expose attempt ids from the supplied filtered attempt set', () => {
  const filtered = filterHistory([cash(1), cash(2), cash(3, { outcome: 'Correct' })], { game: 'cash', outcomes: ['Correct'] });
  const allowed = new Set(filtered.map((row) => row.attemptId));
  const specs = buildChartSpecs(filtered, 'cash');
  assert.ok(specs.some((spec) => spec.id === 'cash-denomination-accuracy'));
  for (const spec of specs) {
    for (const series of spec.series) for (const point of series.points) {
      assert.ok(point.attemptIds.every((id) => allowed.has(id)), `${spec.id} includes only filtered attempts`);
    }
  }
});

test('speed bands and cumulative thresholds count 5, 10, and 15 second boundaries', () => {
  const records = [cash(1, { outcome: 'Correct', timeUsedSeconds: 5 }), cash(2, { outcome: 'Incorrect', timeUsedSeconds: 10 }),
    cash(3, { outcome: 'Correct', timeUsedSeconds: 15 }), cash(4, { outcome: 'Timed Out', timeUsedSeconds: 16 }),
    cash(5, { outcome: 'Not answered', timeUsedSeconds: null })];
  const specs = buildChartSpecs(records, 'cash');
  const bands = specs.find((spec) => spec.id === 'accuracy-by-response-band').series[0].points;
  assert.deepEqual(bands.map((point) => [point.label, point.value, point.count]), [['0–5s', 100, 1], ['>5–10s', 0, 1], ['>10–15s', 100, 1], ['>15s', 0, 1]]);
  const thresholds = specs.find((spec) => spec.id === 'correct-by-threshold').series[0].points;
  assert.deepEqual(thresholds.map((point) => [point.correct, point.count, point.value]), [[1, 4, 25], [1, 4, 25], [2, 4, 50]]);
});

test('combined conditions use their actual intersection and disclose missing legacy fields', () => {
  const records = [cash(1, { outcome: 'Correct', cashTransactionType: 'Change' }), cash(2, { outcome: 'Incorrect', cashTransactionType: 'Change' }),
    cash(3, { outcome: 'Correct', cashTransactionType: 'Exact', tenderBreakdown: [{ cents: 5000, count: 1 }] }),
    cash(4, { outcome: 'Correct', cashTransactionType: 'Change', tenderBreakdown: undefined })];
  const all = buildConditionalReport(records, 'cash');
  const change = all.choices.find((choice) => choice.id === 'cash|Transaction|Change');
  const hundred = all.choices.find((choice) => choice.id === 'cash|Hundred-dollar bills|Two or more');
  const report = buildConditionalReport(records, 'cash', [change.id, hundred.id]);
  assert.deepEqual([report.rate.correct, report.rate.count, report.rate.value, report.rate.missing], [1, 2, 50, 1]);
  assert.deepEqual(wilsonInterval(0, 0), null);
  assert.ok(wilsonInterval(1, 2)[0] < 50 && wilsonInterval(1, 2)[1] > 50);
});

test('derives cash, memory, task, and selection distance only from recorded evidence', () => {
  const c = normalizeHistoryRecord(cash(1, { userAnswer: 'Change', userDeclaredAmountCents: 9999, cashBuilder: true, breakdownMatchesDeclaredAmount: false,
    cashAddClicks: 2, cashRemoveClicks: 1, cashQuickEntries: 1, cashClearClicks: 0 }));
  assert.deepEqual([c.hundredBillCount, c.workloadMultiplications, c.workloadAdditions, c.cashSignedErrorCents, c.cashWrongAmount, c.cashBuilderMismatch], [2, 1, 1, -1, true, true]);
  const m = normalizeHistoryRecord(memory(2, { expectedValues: ['12.3'], answeredValues: ['1.45'] }));
  assert.deepEqual([m.wrongDigits, m.omittedDigits, m.extraDigits, m.decimalErrors], [2, 0, 0, 1]);
  assert.equal(normalizeHistoryRecord(errorPuzzle(3)).selectionDistance, 1);
  assert.equal(normalizeHistoryRecord(fraudInspection(4)).selectionDistance, 1);
  assert.equal(normalizeHistoryRecord(task(5)).taskMissingCount, null);
});

test('fraud charts use present and absent categories as separate denominators', () => {
  const records = [
    fraudInspection(1, { fraudCategoryResults: { 'id-expired': 'found', 'payee-mismatch': 'valid' } }),
    fraudInspection(2, { fraudCategoryResults: { 'id-expired': 'missed', 'payee-mismatch': 'false-positive' } }),
    fraudInspection(3, { fraudCategoryResults: { 'id-expired': 'valid', 'payee-mismatch': 'valid' } }),
  ];
  const specs = buildChartSpecs(records, 'fraud-inspection');
  const found = specs.find((spec) => spec.id === 'fraud-issue-detection').series[0].points.find((point) => point.key === 'id-expired');
  const falseFlags = specs.find((spec) => spec.id === 'fraud-false-flags').series[0].points.find((point) => point.key === 'payee-mismatch');
  assert.deepEqual([found.correct, found.count, found.value], [1, 2, 50]);
  assert.deepEqual([falseFlags.correct, falseFlags.count, falseFlags.value], [1, 3, 33]);
});

test('weakness and next challenge require repeated evidence and can identify speed-only gaps', () => {
  const insufficient = Array.from({ length: 4 }, (_, index) => memory(index));
  assert.equal(findWeaknesses(filterHistory(insufficient), 'memory').length, 0);
  const rows = [
    ...Array.from({ length: 6 }, (_, index) => memory(index, { outcome: 'Correct', timeUsedSeconds: 20 })),
    ...Array.from({ length: 6 }, (_, index) => memory(index + 10, { expectedValues: ['1234'], answeredValues: ['1234'], digitsByValue: [4], totalDigits: 4, outcome: 'Correct', timeUsedSeconds: 5 })),
  ];
  const recommendation = recommendNextChallenge(filterHistory(rows));
  assert.equal(recommendation.game, 'memory');
  assert.match(recommendation.reason, /slower/i);
  assert.equal(recommendation.evidenceCount, 6);
});

test('derives completed prior challenges from immutable attempt evidence and stops recommending recovered strengths', () => {
  const original = Array.from({ length: 6 }, (_, index) => memory(index));
  const plan = { id: 'memory-8', title: 'Focused 8-digit memory', game: 'memory' };
  const recovered = Array.from({ length: 10 }, (_, index) => memory(index + 20, {
    outcome: 'Correct', answeredValues: ['12345678'], practicePlanJson: JSON.stringify(plan),
    sessionId: `practice-${Math.floor(index / 5)}`, questionNumber: index % 5 + 1,
  }));
  const recommendation = recommendNextChallenge(filterHistory([...original, ...recovered]), {
    currentChallenge: { id: 'memory-8', weaknessKey: 'memory:digits:8' },
  });
  assert.equal(recommendation.recoveredCurrent, true);
  assert.deepEqual(recommendation.previousChallenges, [{
    id: 'memory-8', title: 'Focused 8-digit memory', game: 'memory', attempts: 10, accuracyPercent: 100, startedAccuracyPercent: 100, finishedAccuracyPercent: 100, completed: true,
  }]);
});
