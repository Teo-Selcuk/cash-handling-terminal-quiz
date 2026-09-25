import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAUD_INSPECTION_CATEGORIES,
  resolveFraudInspectionSettings,
  createFraudInspectionCase,
  scoreFraudInspectionAttempt,
  summarizeFraudHistory,
} from '../fraud-inspection.mjs';

function sequenceRandom(seed = 19) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

const fixedDate = new Date('2026-09-20T12:00:00.000Z');
const categoryIds = FRAUD_INSPECTION_CATEGORIES.map((item) => item.id);
const oneCategory = (id, extra = {}) => ({
  minimumErrors: 1,
  maximumErrors: 1,
  allowNoErrorCases: false,
  enabledCategories: [id],
  ...extra,
});

test('a clean check with a valid ID is scored correctly as no issues found', () => {
  const settings = resolveFraudInspectionSettings('Easy', {
    minimumErrors: 0, maximumErrors: 0, allowNoErrorCases: true,
  });
  const challenge = createFraudInspectionCase('Easy', settings, sequenceRandom(), fixedDate);
  const result = scoreFraudInspectionAttempt(challenge, ['no-issues']);

  assert.equal(challenge.expectedIssues.length, 0);
  assert.equal(result.correct, true);
  assert.equal(result.cleanCase, true);
  assert.notEqual(challenge.id.legalName, challenge.makerId.legalName);
  assert.match(challenge.id.idNumber, /^ID-\d{9}$/);
  assert.match(challenge.makerId.idNumber, /^ID-\d{9}$/);
  assert.notEqual(challenge.id.idNumber, challenge.makerId.idNumber);
  assert.match(challenge.check.routingNumber, /^990\d{6}$/);
  assert.match(challenge.check.accountNumber, /^\d{10}$/);
  assert.notEqual(challenge.check.accountNumber, challenge.id.idNumber.slice(3));
  assert.equal(challenge.check.makerSignature, challenge.makerId.signature);
  assert.equal(challenge.check.endorsementSignature, challenge.id.signature);
  assert.equal(challenge.check.routingNumber, challenge.tellerFile.routingNumber);
  assert.equal(challenge.check.accountNumber, challenge.tellerFile.accountNumber);
});

test('one payee typo changes only the payee match and is selectable as one issue', () => {
  const settings = resolveFraudInspectionSettings('Custom', oneCategory('payee-mismatch'));
  const challenge = createFraudInspectionCase('Custom', settings, sequenceRandom(4), fixedDate);
  const result = scoreFraudInspectionAttempt(challenge, ['payee-mismatch']);

  assert.notEqual(challenge.check.payeeName, challenge.id.legalName);
  assert.deepEqual(challenge.expectedIssues.map((issue) => issue.id), ['payee-mismatch']);
  assert.equal(result.correct, true);
});

test('multiple simultaneous issues can all be selected and scored', () => {
  const enabledCategories = ['payee-mismatch', 'amount-mismatch', 'date-issue', 'id-expired'];
  const settings = resolveFraudInspectionSettings('Custom', {
    minimumErrors: 3, maximumErrors: 4, allowNoErrorCases: false, enabledCategories,
  });
  const challenge = createFraudInspectionCase('Custom', settings, sequenceRandom(17), fixedDate);
  const selected = challenge.expectedIssues.map((issue) => issue.id);
  const result = scoreFraudInspectionAttempt(challenge, selected);

  assert.ok(result.expectedCount >= 3);
  assert.equal(result.correct, true);
  assert.equal(result.missedIssueIds.length, 0);
});

test('numeric and written amounts can disagree in the rendered document data', () => {
  const settings = resolveFraudInspectionSettings('Custom', oneCategory('amount-mismatch'));
  const challenge = createFraudInspectionCase('Custom', settings, sequenceRandom(11), fixedDate);

  assert.notEqual(challenge.check.numericAmount, challenge.check.writtenAmount);
  assert.match(challenge.expectedIssues[0].explanation, /amount/i);
});

test('date cases include subtle year changes, postdating, and the simulator stale-date rule', () => {
  const settings = resolveFraudInspectionSettings('Custom', oneCategory('date-issue', { dateDifficulty: 'hard' }));
  const variants = new Set([0, 0.2, 0.4, 0.6, 0.8].map((value) => {
    const challenge = createFraudInspectionCase('Custom', settings, () => value, fixedDate);
    return challenge.expectedIssues[0].variant;
  }));

  assert.ok(variants.has('year-change'));
  assert.ok(variants.has('postdated'));
  assert.ok(variants.has('stale'));
  assert.ok(variants.has('impossible'));
  assert.ok(variants.has('rewritten'));
  assert.equal(settings.staleAfterDays, 180);
});

test('missing endorsement and an endorsement signature mismatch are distinct issues', () => {
  const missingSettings = resolveFraudInspectionSettings('Custom', oneCategory('endorsement-missing'));
  const missing = createFraudInspectionCase('Custom', missingSettings, sequenceRandom(7), fixedDate);
  assert.equal(missing.check.endorsementSignature, '');

  const mismatchSettings = resolveFraudInspectionSettings('Custom', oneCategory('endorsement-signature-mismatch'));
  const mismatch = createFraudInspectionCase('Custom', mismatchSettings, sequenceRandom(8), fixedDate);
  assert.notEqual(mismatch.check.endorsementSignature, mismatch.id.signature);
});

test('maker signature mismatch is an independent issue against the maker ID', () => {
  const settings = resolveFraudInspectionSettings('Custom', oneCategory('maker-signature-suspicious'));
  const makerCase = createFraudInspectionCase('Custom', settings, sequenceRandom(2), fixedDate);
  assert.ok(makerCase.expectedIssues.some((issue) => issue.id === 'maker-signature-suspicious'));
  assert.equal(makerCase.check.makerName, makerCase.makerId.legalName);
  assert.notEqual(makerCase.check.makerSignature, makerCase.makerId.signature);
  assert.equal(makerCase.check.endorsementSignature, makerCase.id.signature);
  assert.deepEqual(makerCase.expectedIssues[0].regions, ['check-maker-signature', 'maker-id-signature']);
});

test('payee and maker signatures can both be wrong in the same case', () => {
  const settings = resolveFraudInspectionSettings('Custom', {
    minimumErrors: 2, maximumErrors: 2, allowNoErrorCases: false,
    enabledCategories: ['endorsement-signature-mismatch', 'maker-signature-suspicious'],
  });
  const challenge = createFraudInspectionCase('Custom', settings, sequenceRandom(33), fixedDate);
  assert.deepEqual(new Set(challenge.expectedIssues.map((issue) => issue.id)), new Set(settings.enabledCategories));
  assert.notEqual(challenge.check.endorsementSignature, challenge.id.signature);
  assert.notEqual(challenge.check.makerSignature, challenge.makerId.signature);
  assert.equal(scoreFraudInspectionAttempt(challenge, settings.enabledCategories).correct, true);
});

test('routing and account anomalies compare separate check fields with the teller file', () => {
  for (const [category, field] of [['routing-issue', 'routingNumber'], ['account-information-issue', 'accountNumber']]) {
    const settings = resolveFraudInspectionSettings('Custom', oneCategory(category));
    const challenge = createFraudInspectionCase('Custom', settings, sequenceRandom(31), fixedDate);
    assert.notEqual(challenge.check[field], challenge.tellerFile[field]);
    assert.equal(scoreFraudInspectionAttempt(challenge, [category]).correct, true);
  }
});

test('natural signature variation on a clean case is not labeled suspicious', () => {
  const settings = resolveFraudInspectionSettings('Custom', {
    minimumErrors: 0, maximumErrors: 0, allowNoErrorCases: true, signatureDifficulty: 'hard',
  });
  const challenge = createFraudInspectionCase('Custom', settings, sequenceRandom(23), fixedDate);

  assert.equal(challenge.signatureVariationIsValid, true);
  assert.equal(challenge.expectedIssues.some((issue) => issue.id === 'endorsement-signature-mismatch'), false);
});

test('expired IDs and subtle document alterations are visible data-backed issues', () => {
  const expiredSettings = resolveFraudInspectionSettings('Custom', oneCategory('id-expired'));
  const expired = createFraudInspectionCase('Custom', expiredSettings, sequenceRandom(9), fixedDate);
  assert.ok(expired.id.expirationDate < expired.exerciseDate);

  const alterationSettings = resolveFraudInspectionSettings('Custom', oneCategory('check-alteration', { alterationSubtlety: 'hard' }));
  const altered = createFraudInspectionCase('Custom', alterationSettings, sequenceRandom(10), fixedDate);
  assert.ok(altered.check.alterationMarks.length > 0);
  assert.equal(altered.expectedIssues[0].id, 'check-alteration');
});

test('difficulty presets change both time and document inspection complexity', () => {
  const easy = resolveFraudInspectionSettings('Easy');
  const medium = resolveFraudInspectionSettings('Medium');
  const hard = resolveFraudInspectionSettings('Hard');

  assert.deepEqual([easy.timeLimitSeconds, medium.timeLimitSeconds, hard.timeLimitSeconds], [60, 40, 20]);
  assert.ok(easy.maximumErrors < medium.maximumErrors);
  assert.ok(hard.alterationSubtlety === 'hard');
  assert.ok(hard.fieldDensity === 'high');
});

test('custom settings clamp invalid ranges and preserve no-error cases and selected categories', () => {
  const settings = resolveFraudInspectionSettings('Custom', {
    timeLimitSeconds: 15, questionCount: 7, minimumErrors: 0, maximumErrors: 5,
    allowNoErrorCases: true, enabledCategories: ['date-issue', 'unknown-category'],
  });
  const challenge = createFraudInspectionCase('Custom', settings, sequenceRandom(27), fixedDate);

  assert.equal(settings.timeLimitSeconds, 15);
  assert.equal(settings.questionCount, 7);
  assert.deepEqual(settings.enabledCategories, ['date-issue']);
  assert.ok(challenge.expectedIssues.length <= 1);
});

test('fraud history reports timings, category misses, difficulty, and a supported weakness', () => {
  const records = [
    { gameType: 'Check & ID Fraud Inspection', outcome: 'Incorrect', difficulty: 'Hard', timeUsedSeconds: 11, fraudCleanCase: false, fraudClassificationAccuracyPercent: 70, fraudFalsePositiveCount: 1, fraudFalseNegativeCount: 3, fraudSelectableCategoryCount: 10, fraudExpectedCategories: ['endorsement-signature-mismatch'], fraudSelectedCategories: [], fraudCategoryResults: { 'endorsement-signature-mismatch': 'missed' } },
    { gameType: 'Check & ID Fraud Inspection', outcome: 'Correct', difficulty: 'Hard', timeUsedSeconds: 18, fraudCleanCase: true, fraudCorrectlyRecognizedClean: true, fraudClassificationAccuracyPercent: 100, fraudFalsePositiveCount: 0, fraudFalseNegativeCount: 0, fraudSelectableCategoryCount: 10, fraudExpectedCategories: [], fraudSelectedCategories: [], fraudCategoryResults: {} },
    { gameType: 'Check & ID Fraud Inspection', outcome: 'Incorrect', difficulty: 'Medium', timeUsedSeconds: 21, fraudCleanCase: false, fraudClassificationAccuracyPercent: 70, fraudFalsePositiveCount: 1, fraudFalseNegativeCount: 3, fraudSelectableCategoryCount: 10, fraudExpectedCategories: ['endorsement-signature-mismatch'], fraudSelectedCategories: [], fraudCategoryResults: { 'endorsement-signature-mismatch': 'missed' } },
    { gameType: 'Check & ID Fraud Inspection', outcome: 'Incorrect', difficulty: 'Hard', timeUsedSeconds: 15, fraudCleanCase: false, fraudClassificationAccuracyPercent: 70, fraudFalsePositiveCount: 1, fraudFalseNegativeCount: 3, fraudSelectableCategoryCount: 10, fraudExpectedCategories: ['endorsement-signature-mismatch'], fraudSelectedCategories: [], fraudCategoryResults: { 'endorsement-signature-mismatch': 'missed' } },
    { gameType: 'Check & ID Fraud Inspection', outcome: 'Not answered', difficulty: 'Hard', timeUsedSeconds: 0, fraudExpectedCategories: ['id-expired'], fraudCategoryResults: {} },
  ];
  const summary = summarizeFraudHistory(records);

  assert.equal(summary.casesReviewed, 4);
  assert.equal(summary.medianInspectionTimeSeconds, 16.5);
  assert.equal(summary.cleanChecksCorrectlyRecognized, 1);
  assert.equal(summary.weakestCategory.id, 'endorsement-signature-mismatch');
  assert.equal(summary.weakestCategory.expectedCount, 3);
  assert.ok(summary.byDifficulty.some((group) => group.difficulty === 'Medium'));
});
