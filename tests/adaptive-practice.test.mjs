import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendPractice } from '../adaptive-practice.mjs';
import { createQuestion, createTaskChallenge, resolveMemoryDifficultyPreset } from '../quiz-core.mjs';

const history = (game, count, extra = {}) => Array.from({ length: count }, (_, i) => ({
  game, difficulty: 'Easy', sessionId: `session-${Math.floor(i / 5)}`,
  questionNumber: i % 5 + 1, timestamp: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
  outcome: i % 2 ? 'Correct' : 'Incorrect', ...extra,
}));
const memory = (count = 6) => history('memory', count, {
  expectedValues: ['1234567'], answeredValues: ['1234560'], valueCount: 1,
  readTimeSeconds: 5, writeTimeSeconds: 10,
});

test('requires repeated evidence, ignores unfinished, malformed and other-module rounds', () => {
  const rows = [...memory(4), ...history('memory', 20, { outcome: 'Not answered' }).map((r) => ({ ...r, sessionId: `unfinished-${r.sessionId}` })),
    ...history('cash', 20), null, {}, { game: 'memory', outcome: 'alien' }];
  const result = recommendPractice(rows, 'memory', 'Easy');
  assert.equal(result.plans.length, 0);
  assert.equal(result.attempts, 4);
  assert.equal(result.unanswered, 20);
});

test('memory targets one digit below observed failures, with an exact explanation', () => {
  const result = recommendPractice(memory(), 'memory', 'Easy');
  const plan = result.plans[0];
  assert.equal(plan.preset.minimumDigits, 6);
  assert.equal(plan.preset.maximumDigits, 6);
  assert.equal(plan.preset.maximumValues, 1);
  assert.equal(plan.preset.decimals, false);
  assert.match(plan.reason, /6 of 6/);
  assert.match(plan.reason, /7 digits/);
  assert.equal(plan.evidence.length, 6);
});

test('legacy memory uses actual displayed numbers, never the configured digit range', () => {
  const rows = history('memory', 6, {
    expectedAnswer: 'Values: 1234.56', userAnswer: '1234.57', digitsPerValue: '4-10',
    readTimeSeconds: 5, writeTimeSeconds: 10,
  });
  const plan = recommendPractice(rows, 'memory', 'Easy').plans[0];
  assert.equal(plan.preset.maximumDigits, 5);
  assert.equal(plan.preset.decimals, true);
  assert.match(plan.reason, /6 digits/);
});

test('does not combine different memory loads or learning conditions into a threshold', () => {
  const rows = [...memory(3), ...memory(3).map((r, i) => ({ ...r, sessionId: `other-${i}`, expectedValues: ['1234567', '2345678'] }))];
  assert.equal(recommendPractice(rows, 'memory', 'Easy').plans.length, 0);
  const cash = history('cash', 3, { amountDueCents: 7500, cashGivenCents: 8500, sessionMode: 'Testing' });
  assert.equal(recommendPractice([...cash, ...cash.map((r) => ({ ...r, sessionId: `${r.sessionId}-guided`, sessionMode: 'Guided practice' }))], 'cash', 'Easy').plans.length, 0);
});

test('cash identifies a value band and transaction, then actually generates that transaction', () => {
  const rows = history('cash', 6, { amountDueCents: 7525, cashGivenCents: 8525, outcome: 'Incorrect' });
  const plan = recommendPractice(rows, 'cash', 'Easy').plans[0];
  assert.equal(plan.focus.expectedType, 'Change');
  assert.ok(plan.preset.minDue >= 5000);
  assert.ok(plan.preset.maxDue <= 10000);
  for (let i = 0; i < 50; i += 1) {
    const q = createQuestion('Easy', Math.random, plan.preset, plan.focus);
    assert.equal(q.expectedType, 'Change');
    assert.ok(q.dueCents >= plan.preset.minDue && q.dueCents <= plan.preset.maxDue);
  }
});

test('task practice targets the observed workflow and reduces one step', () => {
  const rows = history('task', 6, { workspaceKind: 'invoice', stepsExpected: 5 });
  const plan = recommendPractice(rows, 'task', 'Easy').plans[0];
  assert.equal(plan.preset.maximumSteps, 4);
  for (let i = 0; i < 10; i += 1) {
    const challenge = createTaskChallenge('Easy', { ...plan.preset, ...plan.focus });
    assert.equal(challenge.workspace.kind, 'invoice');
    assert.equal(challenge.steps.length, 4);
  }
});

test('error detection targets its family and explains missed versus false marks', () => {
  const rows = history('error-detection', 6, {
    puzzleFamilyId: 'cipher-check', detailCount: 5, expectedErrorCount: 2,
    correctlyFlagged: 1, falseFlagCount: 1, timeLimitSeconds: 35,
  });
  const plan = recommendPractice(rows, 'error-detection', 'Easy').plans[0];
  assert.equal(plan.focus.puzzleFamily, 'cipher-check');
  assert.equal(plan.preset.details, 4);
  assert.match(plan.reason, /missed anomalies/);
  assert.match(plan.reason, /false marks/);
});

function practiceRows(plan, count = 10, outcome = 'Correct') {
  return history(plan.game, count, { outcome, practicePlanJson: JSON.stringify(plan), sessionCompletedAt: '2026-09-02T00:00:00Z' })
    .map((r, i) => ({ ...r, sessionId: `practice-${Math.floor(i / 5)}`, timestamp: new Date(Date.UTC(2026, 8, 2, 0, i)).toISOString() }));
}

test('progresses only once from two completed successful sessions and survives recomputation', () => {
  const plan = recommendPractice(memory(), 'memory', 'Easy').plans[0];
  const rows = [...memory(), ...practiceRows(plan)];
  const next = recommendPractice(rows, 'memory', 'Easy').plans[0];
  assert.equal(next.preset.maximumDigits, 7);
  assert.equal(next.stage, 1);
  assert.match(next.reason, /10 of 10/);
  assert.doesNotMatch(next.reason, /Practice 6 digits/);
  assert.deepEqual(recommendPractice(rows, 'memory', 'Easy').plans[0], next);
  assert.equal(recommendPractice([...memory(), ...practiceRows(plan, 5)], 'memory', 'Easy').plans[0].stage, 0);
});

test('unfinished sessions and repeated copies cannot earn progression', () => {
  const plan = recommendPractice(memory(), 'memory', 'Easy').plans[0];
  const unfinished = practiceRows(plan).map((r) => ({ ...r, sessionCompletedAt: null }));
  assert.equal(recommendPractice([...memory(), ...unfinished], 'memory', 'Easy').plans[0].stage, 0);
  const one = practiceRows(plan, 1);
  assert.equal(recommendPractice([...memory(), ...Array(15).fill(one[0])], 'memory', 'Easy').plans[0].stage, 0);
});

test('two normal ten-round sessions earn progression without losing the earlier session', () => {
  const plan = recommendPractice(memory(), 'memory', 'Easy').plans[0];
  const rounds = practiceRows(plan, 20).map((r, i) => ({ ...r, sessionId: `default-session-${Math.floor(i / 10)}`, questionNumber: i % 10 + 1 }));
  const next = recommendPractice([...memory(), ...rounds], 'memory', 'Easy').plans[0];
  assert.equal(next.stage, 1);
  assert.equal(next.preset.maximumDigits, 7);
  assert.equal(next.progress.sessions, 2);
  assert.equal(next.progress.rounds, 20);
});

test('malformed saved plans cannot break recommendations', () => {
  const plan = recommendPractice(memory(), 'memory', 'Easy').plans[0];
  const invalid = { ...plan, options: null, evidence: null };
  const next = recommendPractice([...memory(), ...practiceRows(invalid)], 'memory', 'Easy');
  assert.equal(next.plans[0].stage, 0);
});

test('a struggling practice stage steps down and stays within valid bounds', () => {
  const plan = recommendPractice(memory(), 'memory', 'Easy').plans[0];
  const next = recommendPractice([...memory(), ...practiceRows(plan, 5, 'Incorrect')], 'memory', 'Easy').plans[0];
  assert.equal(next.preset.maximumDigits, 5);
  assert.equal(next.stage, 1);
  assert.doesNotThrow(() => resolveMemoryDifficultyPreset('Easy', next.preset));
});

test('cash, task, and puzzle plans each advance only their intended workload setting', () => {
  for (const [game, sample, field] of [
    ['cash', { amountDueCents: 7525, cashGivenCents: 8525 }, 'maxDifference'],
    ['task', { workspaceKind: 'records', stepsExpected: 5 }, 'maximumSteps'],
    ['error-detection', { puzzleFamilyId: 'cipher-check', detailCount: 5 }, 'details'],
  ]) {
    const rows = history(game, 6, sample);
    const plan = recommendPractice(rows, game, 'Easy').plans[0];
    const next = recommendPractice([...rows, ...practiceRows(plan)], game, 'Easy').plans[0];
    assert.equal(next.stage, 1, game);
    assert.ok(next.preset[field] > plan.preset[field], game);
    assert.deepEqual(next.focus, plan.focus);
    assert.deepEqual(next.options, plan.options);
  }
});

test('minimum memory and task workloads never decrease below supported bounds', () => {
  for (const [game, sample, field, minimum] of [
    ['memory', { expectedValues: ['1'], answeredValues: ['2'] }, 'maximumDigits', 1],
    ['task', { workspaceKind: 'records', stepsExpected: 2 }, 'maximumSteps', 2],
  ]) {
    const rows = history(game, 6, sample);
    const plan = recommendPractice(rows, game, 'Easy').plans[0];
    const next = recommendPractice([...rows, ...practiceRows(plan, 5, 'Incorrect')], game, 'Easy').plans[0];
    assert.equal(next.preset[field], minimum);
    assert.equal(next.stage, 0);
  }
});

test('unrelated old failures do not overwhelm the latest 120 reached rounds', () => {
  const old = memory(6);
  const recent = history('memory', 120, { outcome: 'Correct', expectedValues: ['1234567'], answeredValues: ['1234567'] })
    .map((r, i) => ({ ...r, sessionId: `new-${i}`, timestamp: new Date(Date.UTC(2026, 8, 3, 0, i)).toISOString() }));
  assert.equal(recommendPractice([...old, ...recent], 'memory', 'Easy').plans.length, 0);
});
