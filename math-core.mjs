// Math practice: problem generator, safe evaluator and scoring. Pure module: no DOM.
// Every answer is a whole number, so the answer box takes digits and an optional leading minus sign.

export const MATH_GAME = 'math';
export const MATH_GAME_NAME = 'Math practice';

export const MATH_OPERATIONS = Object.freeze({
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
  brackets: 'Brackets',
  mixed: 'Mixed problems',
});
export const MATH_OPERATION_IDS = Object.freeze(Object.keys(MATH_OPERATIONS));

// Number sizes per difficulty. `addMax` bounds + and − operands, `factorMax` bounds × factors and ÷ divisors/quotients.
export const MATH_PRESETS = Object.freeze({
  Easy: Object.freeze({ questionCount: 10, timeLimitSeconds: 20, addMax: 20, factorMax: 10, mixedTerms: 3, allowNegative: false }),
  Medium: Object.freeze({ questionCount: 15, timeLimitSeconds: 15, addMax: 100, factorMax: 12, mixedTerms: 3, allowNegative: false }),
  Hard: Object.freeze({ questionCount: 20, timeLimitSeconds: 12, addMax: 1000, factorMax: 25, mixedTerms: 4, allowNegative: true }),
});

const SYMBOL = Object.freeze({ '+': '+', '-': '−', '*': '×', '/': '÷' });

/** Clean saved or typed settings. At least one operation always stays on. */
export function resolveMathSettings(input = {}) {
  const difficulty = Object.hasOwn(MATH_PRESETS, input.difficulty) ? input.difficulty : 'Easy';
  const preset = MATH_PRESETS[difficulty];
  const whole = (value, min, max, fallback) => (value !== '' && value !== null && Number.isFinite(Number(value))
    ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback);
  const picked = Array.isArray(input.operations) ? input.operations.filter((id) => MATH_OPERATION_IDS.includes(id)) : [];
  return {
    difficulty,
    operations: picked.length ? [...new Set(picked)] : [...MATH_OPERATION_IDS],
    questionCount: whole(input.questionCount, 1, 100, preset.questionCount),
    timeLimitSeconds: whole(input.timeLimitSeconds, 0, 300, preset.timeLimitSeconds),
  };
}

const int = (random, min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (random, list) => list[Math.floor(random() * list.length)];

/** Tokenize and evaluate + − × ÷ and brackets with normal precedence. Throws on bad input or a non-whole division. */
export function evaluateExpression(text) {
  const tokens = String(text).replaceAll('−', '-').replaceAll('×', '*').replaceAll('÷', '/').match(/\d+|[-+*/()]|\S/g) ?? [];
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];
  function factor() {
    const token = next();
    if (token === '-') return -factor();
    if (token === '(') { const value = sum(); if (next() !== ')') throw new SyntaxError('Missing )'); return value; }
    if (/^\d+$/.test(token ?? '')) return Number(token);
    throw new SyntaxError(`Unexpected ${token ?? 'end'}`);
  }
  function product() {
    let value = factor();
    while (peek() === '*' || peek() === '/') {
      const op = next(); const right = factor();
      if (op === '*') value *= right;
      else { if (right === 0 || value % right !== 0) throw new RangeError('Division is not whole'); value /= right; }
    }
    return value;
  }
  function sum() {
    let value = product();
    while (peek() === '+' || peek() === '-') { const op = next(); const right = product(); value = op === '+' ? value + right : value - right; }
    return value;
  }
  const value = sum();
  if (position !== tokens.length) throw new SyntaxError(`Unexpected ${peek()}`);
  return value;
}

const show = (parts) => parts.map((part) => SYMBOL[part] ?? String(part)).join(' ');

function simple(operation, preset, random) {
  const { addMax, factorMax, allowNegative } = preset;
  if (operation === 'addition') return [int(random, 1, addMax), '+', int(random, 1, addMax)];
  if (operation === 'subtraction') {
    let a = int(random, 1, addMax), b = int(random, 1, addMax);
    if (!allowNegative && b > a) [a, b] = [b, a];
    return [a, '-', b];
  }
  if (operation === 'multiplication') return [int(random, 2, factorMax), '*', int(random, 2, factorMax)];
  // Division: build it from divisor × quotient so the answer is always whole.
  const divisor = int(random, 2, factorMax), quotient = int(random, 1, factorMax);
  return [divisor * quotient, '/', divisor];
}

function bracketParts(preset, random) {
  const inner = pick(random, ['+', '-']);
  const outer = pick(random, ['*', '/', '+', '-']);
  const small = Math.max(10, Math.round(preset.addMax / 4));
  let a = int(random, 1, small), b = int(random, 1, small);
  if (inner === '-' && (!preset.allowNegative || b === a) && b >= a) [a, b] = [b + 1, a];
  const inside = inner === '+' ? a + b : a - b;
  if (outer === '/') {
    // Pick a divisor of the bracket value so the problem stays whole.
    const divisors = []; for (let d = 2; d <= Math.min(Math.abs(inside), preset.factorMax); d += 1) if (inside % d === 0) divisors.push(d);
    if (divisors.length) return ['(', a, inner, b, ')', '/', pick(random, divisors)];
    return ['(', a, inner, b, ')', '*', int(random, 2, preset.factorMax)];
  }
  const c = outer === '*' ? int(random, 2, preset.factorMax) : int(random, 1, preset.addMax);
  return random() < 0.5 || outer === '+' || outer === '-'
    ? ['(', a, inner, b, ')', outer, c]
    : [c, outer, '(', a, inner, b, ')'];
}

function mixedParts(preset, random) {
  // A product or whole quotient joined to more terms by + and −, so precedence matters.
  for (let tries = 0; tries < 50; tries += 1) {
    const parts = [...simple(pick(random, ['multiplication', 'division']), preset, random)];
    for (let term = 2; term < preset.mixedTerms; term += 1) {
      const op = pick(random, ['+', '-', '*']);
      parts.push(op, op === '*' ? int(random, 2, Math.min(9, preset.factorMax)) : int(random, 1, preset.addMax));
    }
    if (random() < 0.5) parts.unshift(int(random, 1, preset.addMax), pick(random, ['+', '-']));
    if (preset.mixedTerms >= 4 && random() < 0.5) { parts.unshift('('); parts.splice(4, 0, ')'); }
    try { const value = evaluateExpression(show(parts)); if (preset.allowNegative || value >= 0) return parts; } catch { /* try again */ }
  }
  return [2, '+', 3, '*', 4];
}

/** One problem. `operations` limits which kinds can appear; the answer is computed from the shown expression. */
export function createMathQuestion({ difficulty = 'Easy', operations = MATH_OPERATION_IDS, random = Math.random } = {}) {
  const preset = MATH_PRESETS[difficulty] ?? MATH_PRESETS.Easy;
  const allowed = operations.filter((id) => MATH_OPERATION_IDS.includes(id));
  const operation = pick(random, allowed.length ? allowed : MATH_OPERATION_IDS);
  const parts = operation === 'brackets' ? bracketParts(preset, random) : operation === 'mixed' ? mixedParts(preset, random) : simple(operation, preset, random);
  const expression = show(parts).replaceAll('( ', '(').replaceAll(' )', ')');
  const terms = parts.filter((part) => typeof part === 'number').length;
  return { operation, operationLabel: MATH_OPERATIONS[operation], difficulty, expression, terms, answer: evaluateExpression(expression) };
}

/** The Math fields one history record keeps, so History can group by operation and problem size. */
export function mathRecordFields(question, operations = MATH_OPERATION_IDS) {
  return {
    game: MATH_GAME, gameType: MATH_GAME_NAME, sessionMode: 'Math practice',
    mathOperation: question.operation, mathOperationLabel: question.operationLabel, mathExpression: question.expression,
    mathAnswer: question.answer, mathTermCount: question.terms, mathOperationsSetting: [...operations],
    expectedAnswer: String(question.answer),
  };
}

export function createMathRound(settings, random = Math.random) {
  const resolved = resolveMathSettings(settings);
  return Array.from({ length: resolved.questionCount }, () => createMathQuestion({ ...resolved, random }));
}

/** Score a typed answer. Blank or a lone minus is no answer. */
export function scoreMathAnswer(question, typed, timedOut = false) {
  const text = String(typed ?? '').trim().replaceAll('−', '-');
  if (timedOut) return { outcome: 'Timed Out', correct: false, value: null };
  if (!/^-?\d+$/.test(text)) return { outcome: 'Incorrect', correct: false, value: null };
  const value = Number(text);
  const correct = value === question.answer;
  return { outcome: correct ? 'Correct' : 'Incorrect', correct, value };
}

/** Accuracy per operation from saved rows, with a plain next step that names the weakest operation. */
export function summarizeMathHistory(history = []) {
  const rows = history.filter((row) => row?.game === MATH_GAME && ['Correct', 'Incorrect', 'Timed Out'].includes(row.outcome));
  const groups = new Map();
  for (const row of rows) {
    const label = row.mathOperationLabel ?? 'Not recorded';
    const group = groups.get(label) ?? { label, answered: 0, correct: 0 };
    group.answered += 1; group.correct += Number(row.outcome === 'Correct');
    groups.set(label, group);
  }
  const operations = [...groups.values()].map((group) => ({ ...group, accuracyPercent: Math.round(group.correct / group.answered * 100) }))
    .sort((left, right) => left.accuracyPercent - right.accuracyPercent || right.answered - left.answered);
  const weakest = operations.find((group) => group.answered >= 5 && group.accuracyPercent < 90);
  const recommendation = !rows.length
    ? 'No Math practice answers saved yet. Start with Easy and every operation on.'
    : weakest
      ? `${weakest.label} is your weakest operation (${weakest.accuracyPercent}% over ${weakest.answered} answers). Turn the other operations off for a round to practice it alone.`
      : 'Every operation is at 90% or better over its recent answers. Try the next difficulty or a shorter timer.';
  return { answered: rows.length, operations, recommendation };
}
