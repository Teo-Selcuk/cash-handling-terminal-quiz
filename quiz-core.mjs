export const DENOMINATIONS = Object.freeze([
  { cents: 10000, singular: '$100 bill', plural: '$100 bills', category: 'Bill' },
  { cents: 5000, singular: '$50 bill', plural: '$50 bills', category: 'Bill' },
  { cents: 2000, singular: '$20 bill', plural: '$20 bills', category: 'Bill' },
  { cents: 1000, singular: '$10 bill', plural: '$10 bills', category: 'Bill' },
  { cents: 500, singular: '$5 bill', plural: '$5 bills', category: 'Bill' },
  { cents: 100, singular: '$1 bill', plural: '$1 bills', category: 'Bill' },
  { cents: 25, singular: 'quarter', plural: 'quarters', category: 'Coin' },
  { cents: 10, singular: 'dime', plural: 'dimes', category: 'Coin' },
  { cents: 5, singular: 'nickel', plural: 'nickels', category: 'Coin' },
  { cents: 1, singular: 'penny', plural: 'pennies', category: 'Coin' },
]);

export const DIFFICULTY_CONFIG = Object.freeze({
  Easy: { minDue: 500, maxDue: 20000, step: 25, maxDifference: 3000, splitCount: 1, allowed: [2000, 1000, 500, 100, 25] },
  Medium: { minDue: 100, maxDue: 100000, step: 1, maxDifference: 15000, splitCount: 4, allowed: DENOMINATIONS.map((item) => item.cents) },
  Hard: { minDue: 100, maxDue: 500000, step: 1, maxDifference: 75000, splitCount: 8, allowed: DENOMINATIONS.map((item) => item.cents) },
});

function randomIndex(length, rng) {
  const value = Number(rng());
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(value, 0.9999999999999999)) : 0;
  return Math.floor(normalized * length);
}

function randomSteppedNumber(minimum, maximum, step, rng) {
  const firstIndex = Math.ceil(minimum / step);
  const lastIndex = Math.floor(maximum / step);
  if (lastIndex < firstIndex) return minimum;
  return (firstIndex + randomIndex(lastIndex - firstIndex + 1, rng)) * step;
}

function assertCents(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of cents.`);
  }
}

export function formatMoney(cents) {
  if (!Number.isSafeInteger(cents)) throw new RangeError('Money must be expressed as integer cents.');
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100).toLocaleString('en-US');
  return `${sign}$${dollars}.${String(absolute % 100).padStart(2, '0')}`;
}

export function denominationsForLevel(level) {
  const config = DIFFICULTY_CONFIG[level];
  if (!config) throw new RangeError(`Unknown difficulty: ${level}`);
  return DENOMINATIONS.filter((item) => config.allowed.includes(item.cents));
}

export function countTotalCents(breakdown = []) {
  return breakdown.reduce((total, item) => {
    assertCents(item.cents, 'Denomination');
    assertCents(item.count, 'Denomination count');
    return total + (item.cents * item.count);
  }, 0);
}

export function buildBreakdown(amountCents, denominations = DENOMINATIONS, splitCount = 0, rng = Math.random) {
  assertCents(amountCents, 'Amount');
  const sorted = [...denominations].sort((left, right) => right.cents - left.cents);
  const counts = new Map(sorted.map((item) => [item.cents, 0]));
  let remaining = amountCents;

  for (const denomination of sorted) {
    const count = Math.floor(remaining / denomination.cents);
    counts.set(denomination.cents, count);
    remaining -= count * denomination.cents;
  }
  if (remaining !== 0) throw new RangeError('Amount cannot be made with the selected denominations.');

  for (let split = 0; split < splitCount; split += 1) {
    const sources = sorted.filter((source) => counts.get(source.cents) > 0 && sorted.some((destination) => (
      destination.category === source.category
      && destination.cents < source.cents
      && source.cents % destination.cents === 0
    )));
    if (sources.length === 0) break;

    const source = sources[randomIndex(sources.length, rng)];
    const destinations = sorted.filter((destination) => (
      destination.category === source.category
      && destination.cents < source.cents
      && source.cents % destination.cents === 0
    )).slice(0, 3);
    const destination = destinations[randomIndex(destinations.length, rng)];
    counts.set(source.cents, counts.get(source.cents) - 1);
    counts.set(destination.cents, counts.get(destination.cents) + (source.cents / destination.cents));
  }

  return sorted
    .filter((denomination) => counts.get(denomination.cents) > 0)
    .map((denomination) => ({ ...denomination, count: counts.get(denomination.cents) }));
}

export function formatBreakdown(breakdown) {
  return breakdown.map((item) => `${item.count} x ${item.count === 1 ? item.singular : item.plural}`).join(', ') || 'No cash is needed.';
}

export function createQuestion(level, rng = Math.random) {
  const config = DIFFICULTY_CONFIG[level];
  if (!config) throw new RangeError(`Unknown difficulty: ${level}`);
  const denominations = denominationsForLevel(level);

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const dueCents = randomSteppedNumber(config.minDue, config.maxDue, config.step, rng);
    const roll = randomIndex(100, rng) + 1;
    let expectedType = roll <= 45 ? 'Change' : roll <= 90 ? 'Short' : 'Exact';
    let expectedAmountCents = 0;
    let tenderedCents = dueCents;

    if (expectedType === 'Change') {
      expectedAmountCents = randomSteppedNumber(config.step, config.maxDifference, config.step, rng);
      tenderedCents += expectedAmountCents;
    } else if (expectedType === 'Short') {
      const maximumShort = Math.min(config.maxDifference, dueCents - 100);
      if (maximumShort < config.step) {
        expectedType = 'Exact';
      } else {
        expectedAmountCents = randomSteppedNumber(config.step, maximumShort, config.step, rng);
        tenderedCents -= expectedAmountCents;
      }
    }

    if (tenderedCents >= 100 && tenderedCents % 100 !== 0) {
      const breakdown = buildBreakdown(tenderedCents, denominations, config.splitCount, rng);
      return {
        dueCents,
        tenderedCents,
        expectedType,
        expectedAmountCents,
        breakdown,
        breakdownText: formatBreakdown(breakdown),
      };
    }
  }
  throw new Error('Unable to generate a valid cash question.');
}

export function parseAmountToCents(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[,$]/g, '').trim();
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(normalized)) return null;
  const [whole = '0', fractional = ''] = normalized.split('.');
  const dollars = Number(whole || '0');
  const cents = Number(`${fractional}00`.slice(0, 2));
  if (!Number.isSafeInteger(dollars) || !Number.isSafeInteger(cents)) return null;
  const result = dollars * 100 + cents;
  return Number.isSafeInteger(result) ? result : null;
}

export function scoreAnswer(question, answer, cashBuilderEnabled) {
  const validTypes = new Set(['Exact', 'Change', 'Short']);
  const amountCents = answer.type === 'Exact' ? 0 : answer.amountCents;
  const validAnswer = validTypes.has(answer.type) && Number.isSafeInteger(amountCents) && amountCents >= 0;
  const cashTotalCents = countTotalCents(answer.breakdown ?? []);
  const typeMatches = validAnswer && answer.type === question.expectedType;
  const amountMatches = validAnswer && amountCents === question.expectedAmountCents;
  const breakdownMatches = !cashBuilderEnabled || cashTotalCents === question.expectedAmountCents;
  return {
    correct: Boolean(typeMatches && amountMatches && breakdownMatches),
    validAnswer,
    typeMatches,
    amountMatches,
    breakdownMatches,
    cashTotalCents,
  };
}

export function summarizeHistory(records) {
  const history = Array.isArray(records) ? records : [];
  const answered = history.length;
  const correct = history.filter((record) => record?.outcome === 'Correct').length;
  const timedOut = history.filter((record) => record?.outcome === 'Timed Out').length;
  const incorrect = Math.max(0, answered - correct - timedOut);
  const percent = (count) => answered ? Math.round((count / answered) * 100) : 0;

  return {
    answered,
    correct,
    timedOut,
    incorrect,
    accuracyPercent: percent(correct),
    outcomes: [
      { key: 'correct', label: 'Correct', count: correct, percent: percent(correct) },
      { key: 'incorrect', label: 'Incorrect', count: incorrect, percent: percent(incorrect) },
      { key: 'timedOut', label: 'Timed out', count: timedOut, percent: percent(timedOut) },
    ],
    byDifficulty: ['Easy', 'Medium', 'Hard'].map((level) => {
      const recordsForLevel = history.filter((record) => record?.difficulty === level);
      const correctForLevel = recordsForLevel.filter((record) => record?.outcome === 'Correct').length;
      return {
        level,
        answered: recordsForLevel.length,
        correct: correctForLevel,
        accuracyPercent: recordsForLevel.length ? Math.round((correctForLevel / recordsForLevel.length) * 100) : 0,
      };
    }),
  };
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows, columns = null) {
  const header = columns ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [header.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(header.map((column) => escapeCsv(row[column])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
