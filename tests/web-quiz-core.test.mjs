import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPatternGame, PATTERN_GAME_NAMES } from '../pattern-games.mjs';
import { createDistractionSamples } from '../distraction-sounds.mjs';

import {
  DENOMINATIONS,
  DIFFICULTY_CONFIG,
  ERROR_DETECTION_MODE_CONFIG,
  ERROR_DETECTION_PUZZLE_FAMILIES,
  MEMORY_MODE_CONFIG,
  TASK_MODE_CONFIG,
  buildBreakdown,
  createCustomerBillRequest,
  createErrorDetectionChallenge,
  countTotalCents,
  createMemoryChallenge,
  createTaskChallenge,
  createQuestion,
  evaluateCustomerBillRequest,
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
} from '../quiz-core.mjs';

test('formats integer cents as US currency', () => {
  assert.equal(formatMoney(0), '$0.00');
  assert.equal(formatMoney(1234), '$12.34');
  assert.equal(formatMoney(250000), '$2,500.00');
});

test('parses valid monetary answers without floating point rounding', () => {
  assert.equal(parseAmountToCents('$1,234.50'), 123450);
  assert.equal(parseAmountToCents('.5'), 50);
  assert.equal(parseAmountToCents('12.345'), null);
  assert.equal(parseAmountToCents('-1'), null);
});

test('builds a valid denomination breakdown for bills and coins', () => {
  const breakdown = buildBreakdown(9003, DENOMINATIONS, 4, () => 0.31);
  assert.equal(countTotalCents(breakdown), 9003);
  assert.ok(breakdown.some((item) => item.cents === 1));
  assert.ok(breakdown.every((item) => item.count > 0));
});

test('handles exact, preference, mismatched, and unsupported customer bill requests', () => {
  const targetCents = 32000;
  const requestKinds = ['specific', 'remainder', 'mixed', 'low', 'high'];

  for (const kind of requestKinds) {
    const request = createCustomerBillRequest(targetCents, () => 0.25, kind);
    assert.equal(request.kind, kind);
    assert.equal(request.isValid, true);
    assert.equal(request.targetCents, targetCents);
    assert.equal(countTotalCents(request.expectedBreakdown), targetCents);
    assert.equal(evaluateCustomerBillRequest(request, request.expectedBreakdown).matches, true, `${kind} request should accept its example breakdown`);
  }

  const specific = createCustomerBillRequest(targetCents, () => 0.25, 'specific');
  const highBills = createCustomerBillRequest(targetCents, () => 0.25, 'high');
  assert.equal(evaluateCustomerBillRequest(specific, highBills.expectedBreakdown).matches, false);

  const mismatched = createCustomerBillRequest(targetCents, () => 0.25, 'mismatch');
  assert.equal(mismatched.isValid, false);
  assert.equal(mismatched.canFlag, true);
  assert.equal(mismatched.requestedCents, 35000);
  assert.match(mismatched.text, /10 x \$20 bills, 1 x \$50 bill, and 1 x \$100 bill/i);
  assert.match(mismatched.text, /does not equal/i);

  const unsupported = createCustomerBillRequest(targetCents, () => 0.25, 'unsupported');
  assert.equal(unsupported.isValid, false);
  assert.equal(unsupported.canFlag, true);
  assert.match(unsupported.text, /\$30 bill/i);
});

test('accepts an exact payout or a flag for an impossible customer bill request', () => {
  const question = { expectedType: 'Change', expectedAmountCents: 32000 };
  const mismatched = createCustomerBillRequest(32000, () => 0.25, 'mismatch');
  const exactBreakdown = buildBreakdown(32000);

  assert.equal(scoreAnswer(question, {
    type: 'Change', amountCents: 32000, breakdown: exactBreakdown,
  }, true, mismatched).correct, true);
  assert.equal(scoreAnswer(question, {
    type: 'Change', amountCents: 32000, breakdown: [], requestFlagged: true,
  }, true, mismatched).correct, true);

  const validRequest = createCustomerBillRequest(32000, () => 0.25, 'specific');
  assert.equal(scoreAnswer(question, {
    type: 'Change', amountCents: 32000, breakdown: exactBreakdown,
  }, true, validRequest).correct, false);
  assert.equal(scoreAnswer(question, {
    type: 'Change', amountCents: 32000, breakdown: validRequest.expectedBreakdown,
  }, true, validRequest).correct, true);
});

test('generates questions that obey each difficulty contract', () => {
  for (const level of Object.keys(DIFFICULTY_CONFIG)) {
    const config = DIFFICULTY_CONFIG[level];
    for (let index = 0; index < 50; index += 1) {
      const question = createQuestion(level);
      assert.ok(question.dueCents >= config.minDue);
      assert.ok(question.dueCents <= config.maxDue);
      assert.equal(question.dueCents % config.step, 0);
      assert.ok(question.tenderedCents >= 100);
      assert.notEqual(question.tenderedCents % 100, 0);
      assert.equal(countTotalCents(question.breakdown), question.tenderedCents);

      if (question.expectedType === 'Change') {
        assert.equal(question.tenderedCents - question.dueCents, question.expectedAmountCents);
      } else if (question.expectedType === 'Short') {
        assert.equal(question.dueCents - question.tenderedCents, question.expectedAmountCents);
      } else {
        assert.equal(question.tenderedCents, question.dueCents);
        assert.equal(question.expectedAmountCents, 0);
      }
    }
  }
});

test('adds customer bill requests only to opted-in change questions', () => {
  const changeRandomizer = (() => {
    const values = [0.5, 0.1, 0.8];
    return () => values.shift() ?? 0.25;
  })();
  const requestedChange = createQuestion('Easy', changeRandomizer, {}, {
    customerBillRequests: true,
    customerRequestKind: 'mismatch',
  });
  assert.equal(requestedChange.expectedType, 'Change');
  assert.equal(requestedChange.customerBillRequest.kind, 'mismatch');
  assert.equal(requestedChange.customerBillRequest.targetCents, requestedChange.expectedAmountCents);

  const exactRandomizer = (() => {
    const values = [0.5, 0.95];
    return () => values.shift() ?? 0.25;
  })();
  const exactQuestion = createQuestion('Easy', exactRandomizer, {}, { customerBillRequests: true });
  assert.equal(exactQuestion.expectedType, 'Exact');
  assert.equal(exactQuestion.customerBillRequest, null);
});

test('resolves editable cash and memory presets without changing the built-in defaults', () => {
  const cashPreset = resolveCashDifficultyPreset('Easy', {
    minDue: 2500,
    maxDue: 40000,
    step: 5,
    maxDifference: 12000,
    splitCount: 3,
  });
  const customCashQuestion = createQuestion('Easy', () => 0.25, cashPreset);

  assert.equal(DIFFICULTY_CONFIG.Easy.maxDue, 20000);
  assert.deepEqual(cashPreset, {
    minDue: 2500,
    maxDue: 40000,
    step: 5,
    maxDifference: 12000,
    splitCount: 3,
    allowed: DENOMINATIONS.map((denomination) => denomination.cents),
  });
  assert.ok(customCashQuestion.dueCents >= 2500);
  assert.ok(customCashQuestion.dueCents <= 40000);
  assert.equal(customCashQuestion.dueCents % 5, 0);
  assert.throws(() => resolveCashDifficultyPreset('Easy', { minDue: 50000, maxDue: 40000 }), RangeError);

  const memoryPreset = resolveMemoryDifficultyPreset('Medium', {
    minimumDigits: 12,
    maximumDigits: 12,
    minimumValues: 4,
    maximumValues: 4,
    decimals: false,
    readSeconds: 9,
    writeSeconds: 20,
  });
  const customMemoryChallenge = createMemoryChallenge('Medium', memoryPreset, () => 0.25);

  assert.deepEqual(MEMORY_MODE_CONFIG.Medium, {
    minimumDigits: 6,
    maximumDigits: 8,
    minimumValues: 2,
    maximumValues: 3,
    decimals: true,
    readSeconds: 4,
    writeSeconds: 8,
  });
  assert.equal(customMemoryChallenge.valueCount, 4);
  assert.deepEqual(customMemoryChallenge.digitsByValue, [12, 12, 12, 12]);
  assert.equal(customMemoryChallenge.readSeconds, 9);
  assert.equal(customMemoryChallenge.writeSeconds, 20);
  assert.throws(() => resolveMemoryDifficultyPreset('Medium', { minimumValues: 8, maximumValues: 4 }), RangeError);
});

test('resolves editable task presets without changing the built-in defaults', () => {
  const taskPreset = resolveTaskDifficultyPreset('Medium', {
    minimumSteps: 5,
    maximumSteps: 7,
    rows: 10,
    tabs: 4,
    briefingSeconds: 30,
    recallSeconds: 120,
    demoStepMilliseconds: 1750,
  });

  assert.deepEqual(TASK_MODE_CONFIG.Medium, {
    minimumSteps: 4,
    maximumSteps: 5,
    rows: 6,
    tabs: 3,
    briefingSeconds: 15,
    recallSeconds: 60,
    demoStepMilliseconds: 1100,
  });
  assert.equal(taskPreset.maximumSteps, 7);
  assert.equal(taskPreset.rows, 10);
  assert.equal(taskPreset.demoStepMilliseconds, 1750);
  assert.throws(() => resolveTaskDifficultyPreset('Easy', { minimumSteps: 8, maximumSteps: 3 }), RangeError);
  assert.throws(() => resolveTaskDifficultyPreset('Easy', { rows: 2 }), RangeError);
  assert.throws(() => resolveTaskDifficultyPreset('Easy', { tabs: 6 }), RangeError);
  assert.throws(() => resolveTaskDifficultyPreset('Easy', { briefingSeconds: 301 }), RangeError);
  assert.throws(() => resolveTaskDifficultyPreset('Easy', { recallSeconds: 901 }), RangeError);
  assert.throws(() => resolveTaskDifficultyPreset('Easy', { demoStepMilliseconds: 249 }), RangeError);
});

test('resolves editable Error Detection presets without changing shipped difficulty', () => {
  const preset = resolveErrorDetectionDifficultyPreset('Medium', {
    details: 7,
    maximumErrors: 3,
    timeLimitSeconds: 42,
  });

  assert.deepEqual(ERROR_DETECTION_MODE_CONFIG.Hard, {
    details: 6,
    maximumErrors: 3,
    timeLimitSeconds: 20,
  });
  assert.deepEqual(preset, {
    details: 7,
    maximumErrors: 3,
    timeLimitSeconds: 42,
  });
  assert.throws(() => resolveErrorDetectionDifficultyPreset('Easy', { details: 2 }), RangeError);
  assert.throws(() => resolveErrorDetectionDifficultyPreset('Easy', { maximumErrors: 7 }), RangeError);
  assert.throws(() => resolveErrorDetectionDifficultyPreset('Easy', { timeLimitSeconds: 301 }), RangeError);
});

test('generates Error Detection puzzles with zero, one, and multiple pinpointable anomalies', () => {
  const noAnomalyPuzzle = createErrorDetectionChallenge('Easy', { details: 4, maximumErrors: 1 }, () => 0);
  const oneAnomalyPuzzle = createErrorDetectionChallenge('Easy', { details: 4, maximumErrors: 1 }, () => 0.999999);
  const manyAnomalyPuzzle = createErrorDetectionChallenge('Hard', { details: 6, maximumErrors: 3 }, () => 0.999999);

  for (const challenge of [noAnomalyPuzzle, oneAnomalyPuzzle, manyAnomalyPuzzle]) {
    const detailIds = new Set(challenge.details.map((detail) => detail.id));
    assert.match(challenge.id, /^error-detection-/);
    assert.ok(challenge.family);
    assert.ok(challenge.title);
    assert.ok(challenge.puzzle?.type);
    assert.ok(challenge.briefing?.overview);
    assert.ok(Array.isArray(challenge.briefing?.ruleSteps));
    assert.ok(challenge.briefing.ruleSteps.length >= 2);
    assert.ok(challenge.briefing.example?.valid?.value);
    assert.ok(challenge.briefing.example?.anomaly?.value);
    assert.equal(challenge.details.length, challenge.detailsCount);
    assert.ok(challenge.details.every((detail) => detail.label && detail.value && detail.expectedValue && detail.correction));
    assert.ok(challenge.errorIds.every((id) => detailIds.has(id)));
  }

  assert.equal(noAnomalyPuzzle.errorIds.length, 0);
  assert.equal(oneAnomalyPuzzle.errorIds.length, 1);
  assert.equal(manyAnomalyPuzzle.errorIds.length, 3);
});

test('varies Error Detection across visual and analytical puzzle families with a learn-before-timed walkthrough', () => {
  const challenges = ERROR_DETECTION_PUZZLE_FAMILIES.slice(0, 5)
    .map((puzzleFamily) => createErrorDetectionChallenge('Hard', { puzzleFamily, details: 6, maximumErrors: 0 }, () => 0.4));

  assert.deepEqual(challenges.map((challenge) => challenge.family), [
    'symbol-matrix',
    'number-machine',
    'cipher-check',
    'logic-schedule',
    'route-network',
  ]);
  assert.ok(challenges.some((challenge) => challenge.puzzle.visual === true));
  assert.ok(challenges.some((challenge) => challenge.puzzle.visual === false));
  assert.ok(challenges.every((challenge) => challenge.briefing.example.explanation));
  assert.ok(challenges.every((challenge) => challenge.details.every((detail) => detail.expectedValue && detail.correction)));

  const forcedRoute = createErrorDetectionChallenge('Easy', {
    details: 4,
    maximumErrors: 0,
    puzzleFamily: 'route-network',
  }, () => 0);
  assert.equal(forcedRoute.family, 'route-network');
  const forcedMatrix = createErrorDetectionChallenge('Hard', {
    details: 4,
    maximumErrors: 0,
    puzzleFamily: 'symbol-matrix',
  }, () => 0);
  assert.match(forcedMatrix.briefing.ruleSteps[0], /upper-left tile is/i);
  assert.match(forcedMatrix.briefing.ruleSteps.at(-1), /two steps right/i);

  const forcedSchedule = createErrorDetectionChallenge('Hard', {
    details: 4,
    maximumErrors: 0,
    puzzleFamily: 'logic-schedule',
  }, () => 0);
  assert.match(forcedSchedule.briefing.ruleSteps[0], /row 1 begins/i);
  assert.match(forcedSchedule.briefing.ruleSteps[1], /weekdays advance/i);

  assert.throws(() => createErrorDetectionChallenge('Easy', {
    details: 4,
    maximumErrors: 0,
    puzzleFamily: 'unknown-family',
  }), RangeError);
});

test('makes Error Detection difficulty increase rule depth instead of only shortening the timer', () => {
  const easy = createErrorDetectionChallenge('Easy', { details: 4, maximumErrors: 0 }, () => 0.01);
  const medium = createErrorDetectionChallenge('Medium', { details: 5, maximumErrors: 0 }, () => 0.01);
  const hard = createErrorDetectionChallenge('Hard', { details: 6, maximumErrors: 0 }, () => 0.01);

  assert.equal(easy.ruleLayers, 1);
  assert.equal(medium.ruleLayers, 2);
  assert.equal(hard.ruleLayers, 3);
  assert.ok(easy.briefing.ruleSteps.length < medium.briefing.ruleSteps.length);
  assert.ok(medium.briefing.ruleSteps.length < hard.briefing.ruleSteps.length);
});

test('ten new pattern games give independently calculated answers at all three difficulties', () => {
  const cases = {
    'sequence-ladder': [1, ['2', '2', '3']],
    'interleaved-streams': [1, ['3 · 31 · 5 · 34 · 7 · 37', '3 · 31 · 5 · 28 · 7 · 25', '3 · 31 · 5 · 28 · 9 · 22']],
    'mirror-code': [1, ['PKGD', 'KGDP', 'LHEQ']],
    'rotation-compass': [1, ['→', '↓', '↓']],
    'binary-overlay': [1, ['0000', '0000', '1111']],
    'balance-scales': [1, ['28', '24', '24']],
    'coordinate-fold': [1, ['(-2, -1)', '(1, -2)', '(1, 2)']],
    'clock-jumps': [1, ['22:50', '22:50', '20:50']],
    'letter-grid': [5, ['E', 'F', 'G']],
    'sorting-network': [1, ['2, 2, 3, 3, 3', '3, 3, 3, 2, 2', '3, 2']],
  };
  assert.equal(Object.keys(PATTERN_GAME_NAMES).length, 10);
  for (const [family, [clue, answers]] of Object.entries(cases)) {
    for (const [index, level] of ['Easy', 'Medium', 'Hard'].entries()) {
      const game = createPatternGame(family, level, () => 0);
      assert.equal(game.details[clue - 1].expectedValue.split(' ⇒ ')[1], answers[index], `${family} ${level}`);
    }
  }
});

test('all 15 puzzle families preserve exact anomaly scoring, worked examples, and difficulty layers', () => {
  assert.equal(ERROR_DETECTION_PUZZLE_FAMILIES.length, 15);
  for (const family of ERROR_DETECTION_PUZZLE_FAMILIES) {
    for (const [index, level] of ['Easy', 'Medium', 'Hard'].entries()) {
      for (let seed = 0; seed < 20; seed += 1) {
        let randomState = seed + 1;
        const rng = () => ((randomState = (1664525 * randomState + 1013904223) >>> 0) / 4294967296);
        const challenge = createErrorDetectionChallenge(level, { puzzleFamily: family, details: 6, maximumErrors: 3 }, rng);
        assert.equal(challenge.family, family);
        assert.equal(challenge.briefing.ruleSteps.length, index + 2);
        assert.equal(new Set(challenge.details.map((detail) => detail.id)).size, 6);
        assert.notEqual(challenge.briefing.example.valid.value, challenge.briefing.example.anomaly.value);
        const actualErrors = challenge.details.filter((detail) => detail.value !== detail.expectedValue).map((detail) => detail.id);
        assert.deepEqual(challenge.errorIds, actualErrors);
        assert.equal(scoreErrorDetectionAttempt(challenge, actualErrors).correct, true);
        const toggled = new Set(actualErrors);
        const id = challenge.details[0].id;
        if (toggled.has(id)) toggled.delete(id); else toggled.add(id);
        assert.equal(scoreErrorDetectionAttempt(challenge, [...toggled]).correct, false);
        assert.equal(scoreErrorDetectionAttempt(challenge, actualErrors, true).correct, false);
      }
    }
  }
});

test('distraction soundtrack contains bounded, sustained, varied tonal phrases', () => {
  const rate = 8000;
  const a = createDistractionSamples(rate, () => 0.2);
  const b = createDistractionSamples(rate, () => 0.8);
  assert.equal(a.length, rate * 16);
  assert.ok(a.every((value) => Number.isFinite(value) && Math.abs(value) <= 0.8));
  assert.notDeepEqual(a, b);
  const signatures = new Set();
  for (let second = 0; second < 16; second += 1) {
    const phrase = a.slice(second * rate, (second + 1) * rate);
    const rms = Math.sqrt(phrase.reduce((sum, value) => sum + value * value, 0) / rate);
    assert.ok(rms > 0.05, `audible energy in phrase ${second}`);
    assert.ok(Math.abs(phrase[0]) < 0.001);
    signatures.add(phrase.slice(100, 110).join(','));
  }
  assert.ok(signatures.size >= 6);
});

test('scores Error Detection selections as an exact set, including no-error cards', () => {
  const challenge = {
    details: [{ id: 'detail-a' }, { id: 'detail-b' }, { id: 'detail-c' }],
    errorIds: ['detail-a', 'detail-c'],
  };
  const perfect = scoreErrorDetectionAttempt(challenge, ['detail-c', 'detail-a']);
  const missedAndFalse = scoreErrorDetectionAttempt(challenge, ['detail-b']);
  const timedOut = scoreErrorDetectionAttempt(challenge, ['detail-a', 'detail-c'], true);

  assert.equal(perfect.correct, true);
  assert.deepEqual(perfect.missedErrorIds, []);
  assert.deepEqual(perfect.falseFlagIds, []);
  assert.deepEqual(perfect.selectedDetailIds, ['detail-a', 'detail-c']);
  assert.equal(missedAndFalse.correct, false);
  assert.deepEqual(missedAndFalse.missedErrorIds, ['detail-a', 'detail-c']);
  assert.deepEqual(missedAndFalse.falseFlagIds, ['detail-b']);
  assert.equal(timedOut.correct, false);
  assert.equal(timedOut.timedOut, true);
  assert.equal(scoreErrorDetectionAttempt({ details: [{ id: 'detail-a' }], errorIds: [] }, []).correct, true);
});

test('generates deterministic task challenges with valid, unique targets and instructions', () => {
  for (const level of Object.keys(TASK_MODE_CONFIG)) {
    const preset = resolveTaskDifficultyPreset(level);
    for (let index = 0; index < 125; index += 1) {
      const challenge = createTaskChallenge(level, preset, () => (index % 100) / 100);
      const targetIds = new Set(challenge.workspace.targetIds);

      assert.match(challenge.id, /^task-/);
      assert.ok(challenge.steps.length >= preset.minimumSteps);
      assert.ok(challenge.steps.length <= preset.maximumSteps);
      assert.equal(challenge.steps.at(-1).type, 'commit');
      assert.notEqual(challenge.steps[0].type, 'commit');
      assert.ok(challenge.steps.every((step) => targetIds.has(step.targetId)));
      assert.equal(new Set(challenge.steps.map((step) => step.instruction)).size, challenge.steps.length);
      assert.ok(challenge.workspace.rows.every((row) => row.name && row.id));
    }
  }
});

test('generates distinct task workspace layouts with dialogs, new tabs, verification, and formulas', () => {
  const fullStepPreset = { minimumSteps: 9, maximumSteps: 9 };
  const byLayout = [0.01, 0.4, 0.8].map((value) => createTaskChallenge('Hard', fullStepPreset, () => value));
  const [records, casework, invoice] = byLayout;

  assert.deepEqual(byLayout.map((challenge) => challenge.workspace.kind), ['records', 'casework', 'invoice']);
  for (const level of Object.keys(TASK_MODE_CONFIG)) {
    assert.deepEqual(
      [0.01, 0.4, 0.8].map((value) => createTaskChallenge(level, { minimumSteps: 3, maximumSteps: 3 }, () => value).workspace.kind),
      ['records', 'casework', 'invoice'],
    );
  }
  for (const challenge of byLayout) {
    assert.equal(challenge.steps.at(-1).type, 'commit');
    assert.equal(new Set(challenge.steps.map((step) => step.instruction)).size, challenge.steps.length);
    assert.ok(challenge.steps.every((step) => challenge.workspace.targetIds.includes(step.targetId)));
  }

  assert.ok(records.workspace.rows.length > 0);
  assert.ok(casework.steps.some((step) => step.type === 'open-dialog'));
  assert.ok(casework.steps.some((step) => step.type === 'open-workspace-tab'));
  assert.ok(casework.steps.some((step) => step.type === 'confirm-dialog'));
  assert.equal(casework.workspace.dialog.targetId, 'task-case-note');

  assert.match(invoice.workspace.formula.expression, /[+×÷]/);
  assert.ok(Number.isSafeInteger(invoice.workspace.formula.result));
  assert.equal(invoice.workspace.verification.source.length, 4);
  assert.ok(invoice.steps.some((step) => step.targetId === 'task-invoice-verification'));
  assert.ok(invoice.steps.some((step) => step.targetId === 'task-invoice-calculation'));
  assert.match(invoice.steps.find((step) => step.targetId === 'task-invoice-reference')?.instruction ?? '', /Enter INV-\d+ in Invoice reference\./);

  for (const [operationRandom, expression] of [[0.01, /\+/], [0.4, /×/], [0.8, /÷/]]) {
    const values = [0, 0.8, 0.1, operationRandom];
    let index = 0;
    const challenge = createTaskChallenge('Easy', { minimumSteps: 3, maximumSteps: 3 }, () => values[index++ % values.length]);
    assert.match(challenge.workspace.formula.expression, expression);
  }
});

test('scores task attempts by semantic sequence and reports end-only mistakes', () => {
  const challenge = {
    steps: [
      { type: 'activate-tab', targetId: 'tab-orders', value: 'Orders', instruction: 'Open Orders.' },
      { type: 'set-text', targetId: 'row-1-reference', value: '4827', instruction: 'Enter 4827.' },
      { type: 'select-option', targetId: 'row-1-status', value: 'Review', instruction: 'Set Review.' },
      { type: 'commit', targetId: 'task-save-workspace', instruction: 'Save.' },
    ],
  };
  const exact = [
    { type: 'activate-tab', targetId: 'tab-orders', value: 'Orders' },
    { type: 'set-text', targetId: 'row-1-reference', value: '4827' },
    { type: 'select-option', targetId: 'row-1-status', value: 'Review' },
    { type: 'commit', targetId: 'task-save-workspace' },
  ];

  assert.deepEqual(scoreTaskAttempt(challenge, exact), {
    correct: true,
    completedSteps: 4,
    expectedSteps: 4,
    mistakes: 0,
    sequenceAccuracyPercent: 100,
    timedOut: false,
  });
  assert.deepEqual(scoreTaskAttempt(challenge, [
    exact[0],
    { type: 'set-text', targetId: 'row-1-reference', value: '1111' },
    exact[1],
    exact[2],
    exact[3],
  ]), {
    correct: false,
    completedSteps: 4,
    expectedSteps: 4,
    mistakes: 1,
    sequenceAccuracyPercent: 100,
    timedOut: false,
  });
  assert.equal(scoreTaskAttempt(challenge, [exact[2], ...exact]).mistakes, 1);
  assert.equal(scoreTaskAttempt(challenge, exact, true).correct, false);
  assert.equal(scoreTaskAttempt(challenge, exact, true).timedOut, true);
});

test('requires a matching cash-builder total only when cash-builder mode is enabled', () => {
  const question = { expectedType: 'Change', expectedAmountCents: 9003 };
  const validBreakdown = buildBreakdown(9003);
  const wrongBreakdown = buildBreakdown(9002);

  assert.equal(scoreAnswer(question, { type: 'Change', amountCents: 9003 }, false).correct, true);
  assert.equal(scoreAnswer(question, { type: 'Change', amountCents: 9003, breakdown: wrongBreakdown }, true).correct, false);
  assert.equal(scoreAnswer(question, { type: 'Change', amountCents: 9003, breakdown: validBreakdown }, true).correct, true);
});

test('parses fast cash-builder shorthand with bill and coin acronyms', () => {
  const parsed = parseCashShorthand('2x$10, one $1 bill, 2d, two quarters');

  assert.equal(parsed.valid, true);
  assert.equal(parsed.totalCents, 2170);
  assert.deepEqual(parsed.breakdown.map(({ cents, count }) => ({ cents, count })), [
    { cents: 1000, count: 2 },
    { cents: 100, count: 1 },
    { cents: 25, count: 2 },
    { cents: 10, count: 2 },
  ]);
  const compact = parseCashShorthand('2x10, 2x100, 2D, 3Q, 4N, 5P');

  assert.equal(compact.valid, true);
  assert.equal(compact.totalCents, 22120);
  assert.deepEqual(compact.breakdown.map(({ cents, count }) => ({ cents, count })), [
    { cents: 10000, count: 2 },
    { cents: 1000, count: 2 },
    { cents: 25, count: 3 },
    { cents: 10, count: 2 },
    { cents: 5, count: 4 },
    { cents: 1, count: 5 },
  ]);
  assert.equal(parseCashShorthand('2x$10, mystery-token').valid, false);
});

test('documents compact cash-builder entries without dollar signs', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /2x10, 2x100/);
  assert.match(html, /2D, 3Q, 4N, 5P/);
  assert.match(html, /placeholder="2x10, 2D, 3Q"/);
  assert.match(app, /2x10, 2x100, 2D, 3Q, 4N, 5P/);
});

test('can auto-continue to the next timeout-free screen in all web games', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="auto-continue-toggle"/);
  assert.match(html, /Immediately advance to the next round when its timer expires/);
  assert.match(html, /In Error Detection, this opens the next rule briefing/);
  assert.match(app, /autoContinueOnTimeout: false,/);
  assert.match(app, /state\.autoContinueOnTimeout = refs\['auto-continue-toggle'\]\.checked;/);
  assert.match(app, /if \(timedOut && state\.autoContinueOnTimeout\) \{\s*showNextQuestion\(\);\s*return;\s*\}/s);
  assert.match(app, /if \(timedOut && state\.autoContinueOnTimeout\) \{\s*showNextMemoryQuestion\(\);\s*return;\s*\}/s);
  assert.match(app, /if \(timedOut && state\.autoContinueOnTimeout\) \{\s*showNextTaskQuestion\(\);\s*return;\s*\}/s);
  assert.match(app, /if \(timedOut && state\.autoContinueOnTimeout\) \{\s*showNextErrorDetectionQuestion\(\);\s*return;\s*\}/s);
});

test('provides a fourth Error Detection puzzle game with a rule walkthrough, visual clues, and saved presets', async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /value="error-detection"/);
  assert.match(html, /id="error-detection-setup-options"/);
  assert.match(html, /id="error-detection-question-count"/);
  assert.match(html, /id="preset-error-detection-fields"/);
  assert.match(html, /id="preset-error-detection-details"/);
  assert.match(html, /id="preset-error-detection-errors"/);
  assert.match(html, /id="preset-error-detection-time"/);
  assert.match(html, /id="error-detection-briefing-screen"/);
  assert.match(html, /id="error-detection-rule-steps"/);
  assert.match(html, /id="error-detection-example"/);
  assert.match(html, /id="error-detection-start-puzzle"/);
  assert.match(html, /id="error-detection-screen"/);
  assert.match(html, /id="error-detection-puzzle-legend"/);
  assert.match(html, /id="error-detection-detail-list"/);
  assert.match(html, /id="error-detection-no-errors"/);
  assert.match(html, /id="error-detection-form"/);
  assert.doesNotMatch(html, /Terminal audit/);
  assert.match(app, /showErrorDetectionBriefing\(\)/);
  assert.match(app, /startErrorDetectionPuzzle\(\)/);
  assert.match(app, /renderErrorDetectionVisual\(/);
  assert.match(app, /scoreErrorDetectionAttempt\(state\.errorDetectionChallenge, selectedErrorDetailIds\(\), timedOut\)/);
  assert.match(app, /showNextErrorDetectionQuestion\(\)/);
  assert.match(app, /setAttribute\('aria-pressed', String\(selected\)\)/);
  assert.match(css, /\.error-detection-briefing-screen\s*\{/);
  assert.match(css, /\.puzzle-visual-symbol\s*\{/);
  assert.match(css, /\.puzzle-visual-route\s*\{/);
  assert.match(css, /\.error-detection-detail\[aria-pressed="true"\]\s*\{/);
});

test('provides a browser-only task simulation workflow without leaking instructions during recall', async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /value="task"/);
  assert.match(html, /id="preset-task-fields"/);
  assert.match(html, /id="task-setup-options"/);
  assert.match(html, /id="task-briefing-screen"/);
  assert.match(html, /id="task-workspace-screen"/);
  assert.match(html, /id="task-workspace-content"/);
  assert.match(html, /id="task-workspace-dialog"/);
  assert.match(html, /id="task-row-template"/);
  assert.match(html, /id="task-tablist"[^>]*role="tablist"/);
  assert.match(html, /id="task-phase-status"[^>]*role="status"/);
  assert.match(app, /createTaskChallenge\(state\.difficulty, state\.taskPresets\[state\.difficulty\]\)/);
  assert.match(app, /state\.taskPhase = 'briefing'/);
  assert.match(app, /state\.taskPhase = 'demo'/);
  assert.match(app, /state\.taskPhase = 'recall'/);
  assert.match(app, /scoreTaskAttempt\(state\.taskChallenge, state\.taskActionLog, timedOut\)/);
  assert.match(app, /Instructions are hidden\. Repeat the workflow/);
  assert.match(app, /taskTitle: challenge\.title/);
  assert.match(css, /\.task-table\s*\{[^}]*min-width:/s);
  assert.match(css, /\.task-casework-layout\s*\{/);
  assert.match(css, /\.task-invoice-layout\s*\{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('lets learners begin number-memory recall before the study timer expires', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="memory-answer-now"[^>]*type="button"/);
  assert.match(html, /Answer now when you are ready\./);
  assert.match(app, /'memory-answer-now'/);
  assert.match(app, /refs\['memory-answer-now'\]\.addEventListener\('click', showMemoryAnswer\)/);
});

test('keeps every compact task simulation phase visible and its controls usable', async () => {
  const [app, css] = await Promise.all([
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /function isCompactViewport\(\)/);
  assert.match(app, /scrollIntoView\(\{ block: 'start', inline: 'nearest' \}\)/);
  assert.match(app, /target\.scrollIntoView\(\{ behavior: taskReducedMotion\(\) \? 'auto' : 'smooth', block: 'center', inline: 'nearest' \}\)/);
  assert.match(css, /@media \(max-width: 63\.9375rem\)\s*\{[\s\S]*\.task-workspace-screen[\s\S]*min-width:\s*0/s);
  assert.match(css, /@media \(max-width: 63\.9375rem\)\s*\{[\s\S]*\.task-table\s*\{[\s\S]*display:\s*block/s);
  assert.match(css, /@media \(max-width: 63\.9375rem\)\s*\{[\s\S]*\.task-table-wrap\s*\{[\s\S]*overflow:\s*visible/s);
  assert.match(css, /@media \(max-width: 36rem\)\s*\{[\s\S]*\.task-table tr\s*\{[\s\S]*grid-template-columns:\s*1fr/s);
});

test('guides compact task-demo scrolling before moving the animation marker', async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="task-demo-guide"[^>]*role="status"/);
  assert.match(app, /function taskDemoGuideDirection\(target\)/);
  assert.match(app, /function updateTaskDemoGuide\(transition, direction, state\)/);
  assert.match(app, /behavior: taskReducedMotion\(\) \? 'auto' : 'smooth'/);
  assert.match(app, /await waitForTaskDemoScroll\(token\)/);
  assert.match(app, /updateTaskDemoGuide\(transition, direction, 'moving'\)/);
  assert.match(app, /updateTaskDemoGuide\(transition, 'arrived', 'arrived'\)/);
  assert.match(css, /@media \(max-width: 63\.9375rem\)\s*\{[\s\S]*\.task-demo-guide\s*\{/s);
});

test('creates ordered decimal memory challenges from configurable value and digit ranges', () => {
  assert.deepEqual(MEMORY_MODE_CONFIG.Easy, {
    minimumDigits: 4,
    maximumDigits: 6,
    minimumValues: 1,
    maximumValues: 2,
    decimals: true,
    readSeconds: 5,
    writeSeconds: 10,
  });

  const challenge = createMemoryChallenge('Easy', {
    minimumDigits: 4,
    maximumDigits: 4,
    minimumValues: 3,
    maximumValues: 3,
    decimals: true,
    readSeconds: 4,
    writeSeconds: 8,
  }, () => 0.25);

  assert.deepEqual(challenge.values, ['3.222', '3.222', '3.222']);
  assert.deepEqual(challenge.digitsByValue, [4, 4, 4]);
  assert.equal(challenge.valueCount, 3);
  assert.equal(challenge.readSeconds, 4);
  assert.equal(challenge.writeSeconds, 8);
  assert.equal(scoreMemoryAnswer(challenge, ['3.222', '3.222', '3.222']).correct, true);
  assert.equal(scoreMemoryAnswer(challenge, ['3.222', '322.2', '3.222']).correct, false);
  assert.equal(scoreMemoryAnswer(challenge, ['3.222', '3.222']).correct, false);

  const upperRangeChallenge = createMemoryChallenge('Easy', {
    minimumDigits: 4,
    maximumDigits: 6,
    minimumValues: 1,
    maximumValues: 5,
    decimals: true,
  }, () => 0.999999);
  assert.equal(upperRangeChallenge.valueCount, 5);
  assert.deepEqual(upperRangeChallenge.digitsByValue, [6, 6, 6, 6, 6]);
  assert.ok(upperRangeChallenge.values.every((value) => /^\d+\.\d+$/.test(value)));
});

test('supports up to 100 values with up to 100 digits each for memory rounds', () => {
  const largestChallenge = createMemoryChallenge('Hard', {
    minimumDigits: 100,
    maximumDigits: 100,
    minimumValues: 100,
    maximumValues: 100,
    decimals: false,
  }, () => 0.5);

  assert.equal(largestChallenge.valueCount, 100);
  assert.equal(largestChallenge.values.length, 100);
  assert.ok(largestChallenge.values.every((value) => /^\d{100}$/.test(value)));
  assert.throws(() => createMemoryChallenge('Easy', { maximumDigits: 101 }), RangeError);
  assert.throws(() => createMemoryChallenge('Easy', { maximumValues: 101 }), RangeError);
});

test('keeps one-value non-decimal memory challenges compatible with spaced answers', () => {
  const challenge = createMemoryChallenge('Medium', {
    minimumDigits: 6,
    maximumDigits: 6,
    minimumValues: 1,
    maximumValues: 1,
    decimals: false,
    readSeconds: 4,
    writeSeconds: 8,
  }, () => 0.25);

  assert.deepEqual(challenge.values, ['322222']);
  assert.equal(scoreMemoryAnswer(challenge, '322 222').correct, true);
  assert.equal(scoreMemoryAnswer(challenge, '322223').correct, false);
});

test('scores Exact, Change, and Short answers in normal mode', () => {
  const cases = [
    { expectedType: 'Exact', expectedAmountCents: 0, answer: { type: 'Exact', amountCents: 0 } },
    { expectedType: 'Change', expectedAmountCents: 725, answer: { type: 'Change', amountCents: 725 } },
    { expectedType: 'Short', expectedAmountCents: 340, answer: { type: 'Short', amountCents: 340 } },
  ];

  for (const { expectedType, expectedAmountCents, answer } of cases) {
    const score = scoreAnswer({ expectedType, expectedAmountCents }, answer, false);
    assert.equal(score.correct, true, `${expectedType} should be accepted without the cash builder`);
  }
});

test('summarizes saved answers for outcome diagrams and the accuracy chart', () => {
  const summary = summarizeHistory([
    { difficulty: 'Easy', outcome: 'Correct' },
    { difficulty: 'Easy', outcome: 'Incorrect' },
    { difficulty: 'Medium', outcome: 'Timed Out' },
    { difficulty: 'Hard', outcome: 'Correct' },
  ]);

  assert.deepEqual(summary.outcomes, [
    { key: 'correct', label: 'Correct', count: 2, percent: 50 },
    { key: 'incorrect', label: 'Incorrect', count: 1, percent: 25 },
    { key: 'timedOut', label: 'Timed out', count: 1, percent: 25 },
    { key: 'notAnswered', label: 'Not answered', count: 0, percent: 0 },
  ]);
  assert.deepEqual(summary.byDifficulty, [
    { level: 'Easy', answered: 2, correct: 1, accuracyPercent: 50 },
    { level: 'Medium', answered: 1, correct: 0, accuracyPercent: 0 },
    { level: 'Hard', answered: 1, correct: 1, accuracyPercent: 100 },
  ]);
});

test('unanswered reached rounds have their own category and count against accuracy', () => {
  const summary = summarizeHistory([
    { difficulty: 'Easy', outcome: 'Correct' },
    { difficulty: 'Easy', outcome: 'Not answered' },
  ]);
  assert.equal(summary.answered, 2);
  assert.equal(summary.correct, 1);
  assert.equal(summary.notAnswered, 1);
  assert.equal(summary.incorrect, 0);
  assert.equal(summary.accuracyPercent, 50);
  assert.equal(summary.byDifficulty[0].accuracyPercent, 50);
  assert.deepEqual(summary.outcomes.at(-1), { key: 'notAnswered', label: 'Not answered', count: 1, percent: 50 });
  assert.match(toCsv([{ outcome: 'Not answered' }]), /Not answered/);
});

test('cash-builder styling honors the hidden attribute when the mode is off', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.cash-builder\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
});

test('cash-builder controls meet the 44px mobile touch-target minimum', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.quantity-button\s*\{[^}]*width:\s*2\.75rem;[^}]*height:\s*2\.75rem;/s);
});

test('makes learners total the tendered cash and explains which cash to build', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(html, /id="amount-tendered"/);
  assert.match(html, /Add these bills and coins yourself/);
  assert.match(html, /id="cash-builder-purpose"/);
  assert.doesNotMatch(app, /amount-tendered/);
  assert.match(app, /Build the change you would give the customer in bills and coins\./);
  assert.match(app, /Build the additional bills and coins the customer still needs to give\./);
});

test('offers an opt-in customer bill-request flow with an invalid-request flag', async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="customer-bill-request-toggle"/);
  assert.match(html, /Automatically turns on cash builder/i);
  assert.match(html, /id="customer-bill-request"/);
  assert.match(html, /id="flag-bill-request"/);
  assert.match(app, /customerBillRequestsEnabled: false/);
  assert.match(app, /customerBillRequests: state\.customerBillRequestsEnabled/);
  assert.match(app, /scoreAnswer\(state\.question, answer, state\.cashBuilderEnabled, state\.question\.customerBillRequest\)/);
  assert.match(app, /requestFlagged: state\.customerRequestFlagged/);
  assert.match(app, /flag-bill-request/);
  assert.match(css, /\.customer-bill-request\s*\{/);
});

test('uses the saved memory preset as the only range and timing configuration', async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="preset-memory-value-min"[^>]*max="100"/);
  assert.match(html, /id="preset-memory-value-max"[^>]*max="100"/);
  assert.match(html, /id="preset-memory-digit-min"[^>]*max="100"/);
  assert.match(html, /id="preset-memory-digit-max"[^>]*max="100"/);
  assert.match(html, /id="preset-memory-decimals"/);
  assert.match(html, /id="memory-question-count"/);
  assert.doesNotMatch(html, /id="memory-value-min"/);
  assert.doesNotMatch(html, /id="memory-value-max"/);
  assert.doesNotMatch(html, /id="memory-digit-min"/);
  assert.doesNotMatch(html, /id="memory-digit-max"/);
  assert.doesNotMatch(html, /id="memory-decimals"/);
  assert.match(html, /id="memory-answer-list"/);
  assert.doesNotMatch(html, /id="memory-digits"/);
  assert.match(app, /maximumDigits \+ \(state\.memoryChallenge\.decimals \? 1 : 0\)/);
  assert.match(app, /createMemoryChallenge\(state\.difficulty, state\.memoryPresets\[state\.difficulty\]\)/);
  assert.doesNotMatch(app, /applyMemoryModeDefaults/);
  assert.doesNotMatch(app, /memoryMinimumDigits/);
  assert.doesNotMatch(app, /state\.memory(?:Read|Write)Seconds/);
  assert.match(css, /\.memory-answer-list\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.memory-values li > span:last-child\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(css, /\.currency-input:focus-within\s*\{[^}]*outline:/s);
  assert.match(css, /\.currency-input input:focus-visible\s*\{[^}]*outline:\s*none;/s);
});

test('offers saved, resettable presets for the selected game and difficulty', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="preset-editor"/);
  assert.match(html, /id="save-preset"/);
  assert.match(html, /id="reset-selected-preset"/);
  assert.match(html, /id="reset-all-presets"/);
  assert.match(html, /id="preset-cash-max-due"/);
  assert.match(html, /id="preset-memory-digit-max"/);
  assert.match(app, /PRESET_KEY/);
  assert.match(app, /resolveCashDifficultyPreset/);
  assert.match(app, /resolveMemoryDifficultyPreset/);
  assert.match(app, /saveSelectedPreset/);
  assert.match(app, /resetAllPresets/);
});

test('cache-busts updated static assets so returning visitors receive new behavior', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /href="style\.css\?v=[^"]+"/);
  assert.match(html, /src="app\.js\?v=[^"]+"/);
});

test('exports history as escaped CSV with a header row', () => {
  const csv = toCsv([{ timestamp: '2026-08-27T12:00:00.000Z', outcome: 'Correct', note: 'Quarter, then "dime"' }]);
  assert.match(csv, /^timestamp,outcome,note\r?\n/);
  assert.match(csv, /"Quarter, then ""dime"""/);
});

test('offers one off-by-default continuous distraction-noise toggle for every browser practice mode', async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="distraction-noise-toggle"[^>]*type="checkbox"/);
  assert.doesNotMatch(html, /id="distraction-audio-safety-check"/);
  assert.match(html, /cannot verify (?:whether )?Windows (?:11 )?system mute/i);
  assert.match(app, /distractionNoisesEnabled: false/);
  assert.match(app, /function prepareDistractionAudio\(\)/);
  assert.match(app, /function startContinuousDistractionNoise\(\)/);
  assert.match(app, /function stopContinuousDistractionNoise\(\)/);
  assert.match(app, /function varyContinuousDistractionNoise\(\)/);
  assert.match(app, /window\.AudioContext \|\| window\.webkitAudioContext/);
  assert.match(app, /createBufferSource\(\)/);
  assert.match(app, /createGain\(\)/);
  assert.match(app, /source\.loop = true/);
  assert.match(app, /showNextQuestion\(\)[\s\S]*startContinuousDistractionNoise\(\)/);
  assert.match(app, /showNextMemoryQuestion\(\)[\s\S]*startContinuousDistractionNoise\(\)/);
  assert.match(app, /startTaskRecall\(\)[\s\S]*startContinuousDistractionNoise\(\)/);
  assert.match(app, /startErrorDetectionPuzzle\(\)[\s\S]*startContinuousDistractionNoise\(\)/);
  assert.match(app, /function renderSummary\(\)[\s\S]*stopContinuousDistractionNoise\(\)/);
  assert.match(css, /\.distraction-audio-settings\s*\{/);
});
