import test from 'node:test';
import assert from 'node:assert/strict';
import { MATH_OPERATION_IDS, MATH_PRESETS, createMathQuestion, createMathRound, evaluateExpression, resolveMathSettings, scoreMathAnswer } from '../math-core.mjs';

const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
// Independent "calculator": plain JavaScript arithmetic on the shown expression.
const calculator = (expression) => Function(`"use strict"; return (${expression.replaceAll('−', '-').replaceAll('×', '*').replaceAll('÷', '/')});`)();

test('every operation computes the same answer as a calculator, with whole results', () => {
  const random = seeded(7);
  for (const difficulty of ['Easy', 'Medium', 'Hard']) for (const operation of MATH_OPERATION_IDS) for (let i = 0; i < 300; i += 1) {
    const question = createMathQuestion({ difficulty, operations: [operation], random });
    assert.equal(question.operation, operation);
    assert.equal(question.answer, calculator(question.expression), question.expression);
    assert.ok(Number.isInteger(question.answer), question.expression);
  }
});

test('turning an operation off removes it from a round', () => {
  const random = seeded(3);
  const kept = ['addition', 'division'];
  const round = createMathRound({ difficulty: 'Medium', operations: kept, questionCount: 200 }, random);
  assert.ok(round.every((q) => kept.includes(q.operation)));
  assert.ok(!round.some((q) => q.expression.includes('×') && q.operation !== 'division'));
  assert.deepEqual(resolveMathSettings({ operations: [] }).operations, MATH_OPERATION_IDS, 'all off falls back to all on');
});

test('each mode uses its own number sizes', () => {
  const random = seeded(11);
  for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    const { addMax, factorMax, allowNegative } = MATH_PRESETS[difficulty];
    for (let i = 0; i < 300; i += 1) {
      const add = createMathQuestion({ difficulty, operations: ['addition'], random });
      assert.ok(add.expression.split(' + ').every((n) => Number(n) <= addMax));
      const mul = createMathQuestion({ difficulty, operations: ['multiplication'], random });
      assert.ok(mul.expression.split(' × ').every((n) => Number(n) <= factorMax));
      const sub = createMathQuestion({ difficulty, operations: ['subtraction'], random });
      if (!allowNegative) assert.ok(sub.answer >= 0);
    }
  }
  assert.ok(MATH_PRESETS.Easy.timeLimitSeconds > MATH_PRESETS.Hard.timeLimitSeconds);
});

test('evaluator follows precedence and brackets; scoring reads typed answers', () => {
  assert.equal(evaluateExpression('2 + 3 × 4'), 14);
  assert.equal(evaluateExpression('(2 + 3) × 4'), 20);
  assert.equal(evaluateExpression('20 ÷ 4 − 1'), 4);
  assert.throws(() => evaluateExpression('7 ÷ 2'));
  const q = { answer: -3 };
  assert.equal(scoreMathAnswer(q, '-3').outcome, 'Correct');
  assert.equal(scoreMathAnswer(q, '3').outcome, 'Incorrect');
  assert.equal(scoreMathAnswer(q, '').outcome, 'Incorrect');
  assert.equal(scoreMathAnswer(q, '-3', true).outcome, 'Timed Out');
});
