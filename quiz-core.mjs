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

export const MEMORY_MODE_CONFIG = Object.freeze({
  Easy: Object.freeze({ minimumDigits: 4, maximumDigits: 6, minimumValues: 1, maximumValues: 2, decimals: true, readSeconds: 5, writeSeconds: 10 }),
  Medium: Object.freeze({ minimumDigits: 6, maximumDigits: 8, minimumValues: 2, maximumValues: 3, decimals: true, readSeconds: 4, writeSeconds: 8 }),
  Hard: Object.freeze({ minimumDigits: 8, maximumDigits: 10, minimumValues: 3, maximumValues: 5, decimals: true, readSeconds: 3, writeSeconds: 6 }),
});

const NUMBER_WORD_COUNTS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
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

function cashTokenToCents(token) {
  const normalized = token.toLowerCase().replaceAll(' ', '');
  const coinAliases = {
    q: 25,
    quarter: 25,
    quarters: 25,
    d: 10,
    dime: 10,
    dimes: 10,
    n: 5,
    nickel: 5,
    nickels: 5,
    p: 1,
    penny: 1,
    pennies: 1,
  };
  if (Object.hasOwn(coinAliases, normalized)) return coinAliases[normalized];

  const bill = normalized.match(/^\$?(100|50|20|10|5|1)(?:b|bill|bills)?$/);
  return bill ? Number(bill[1]) * 100 : null;
}

function parsedCount(value) {
  const normalized = value.toLowerCase();
  if (Object.hasOwn(NUMBER_WORD_COUNTS, normalized)) return NUMBER_WORD_COUNTS[normalized];
  const count = Number(normalized);
  return Number.isSafeInteger(count) ? count : null;
}

export function parseCashShorthand(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { valid: false, breakdown: [], totalCents: 0, error: 'Enter at least one bill or coin.' };
  }

  const counts = new Map(DENOMINATIONS.map((item) => [item.cents, 0]));
  const parts = value.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { valid: false, breakdown: [], totalCents: 0, error: 'Enter at least one bill or coin.' };

  for (const part of parts) {
    let count = 1;
    let token = part;
    const compactCoin = part.match(/^(\d+)([qdnp])$/i);
    const explicitCount = part.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*[x*]\s*(.+)$/i);
    const spacedCount = part.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$/i);

    if (compactCoin) {
      count = Number(compactCoin[1]);
      token = compactCoin[2];
    } else if (explicitCount || spacedCount) {
      const match = explicitCount ?? spacedCount;
      count = parsedCount(match[1]);
      token = match[2];
    }

    const cents = cashTokenToCents(token);
    if (!Number.isSafeInteger(count) || count < 1 || count > 10000 || cents === null) {
      return { valid: false, breakdown: [], totalCents: 0, error: `Could not read "${part}".` };
    }
    counts.set(cents, counts.get(cents) + count);
  }

  const breakdown = DENOMINATIONS
    .filter((item) => counts.get(item.cents) > 0)
    .map((item) => ({ ...item, count: counts.get(item.cents) }));
  return { valid: true, breakdown, totalCents: countTotalCents(breakdown), error: '' };
}

function requireMemoryInteger(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
}

function requireMemoryRange(minimum, maximum, name, allowedMinimum, allowedMaximum) {
  requireMemoryInteger(minimum, `${name} minimum`, allowedMinimum, allowedMaximum);
  requireMemoryInteger(maximum, `${name} maximum`, allowedMinimum, allowedMaximum);
  if (minimum > maximum) throw new RangeError(`${name} minimum cannot be greater than its maximum.`);
}

function memoryRandomInteger(minimum, maximum, rng) {
  return minimum + randomIndex(maximum - minimum + 1, rng);
}

function createMemoryValue(digits, decimals, rng) {
  let value = String(randomIndex(9, rng) + 1);
  for (let index = 1; index < digits; index += 1) value += String(randomIndex(10, rng));
  if (!decimals || digits === 1) return value;

  const decimalIndex = memoryRandomInteger(1, digits - 1, rng);
  return `${value.slice(0, decimalIndex)}.${value.slice(decimalIndex)}`;
}

export function createMemoryChallenge(level, options = {}, rng = Math.random) {
  const defaults = MEMORY_MODE_CONFIG[level];
  if (!defaults) throw new RangeError(`Unknown memory difficulty: ${level}`);
  const minimumDigits = options.minimumDigits ?? options.digits ?? defaults.minimumDigits;
  const maximumDigits = options.maximumDigits ?? options.digits ?? defaults.maximumDigits;
  const minimumValues = options.minimumValues ?? defaults.minimumValues;
  const maximumValues = options.maximumValues ?? defaults.maximumValues;
  const decimals = options.decimals ?? defaults.decimals;
  const readSeconds = options.readSeconds ?? defaults.readSeconds;
  const writeSeconds = options.writeSeconds ?? defaults.writeSeconds;
  requireMemoryRange(minimumDigits, maximumDigits, 'Digits', 1, 24);
  requireMemoryRange(minimumValues, maximumValues, 'Values', 1, 5);
  if (typeof decimals !== 'boolean') throw new TypeError('Decimals must be true or false.');
  requireMemoryInteger(readSeconds, 'Read seconds', 1, 60);
  requireMemoryInteger(writeSeconds, 'Write seconds', 1, 300);

  const valueCount = memoryRandomInteger(minimumValues, maximumValues, rng);
  const digitsByValue = Array.from({ length: valueCount }, () => memoryRandomInteger(minimumDigits, maximumDigits, rng));
  const values = digitsByValue.map((digits) => createMemoryValue(digits, decimals, rng));
  return {
    level,
    minimumDigits,
    maximumDigits,
    minimumValues,
    maximumValues,
    decimals,
    valueCount,
    digitsByValue,
    digits: digitsByValue[0],
    readSeconds,
    writeSeconds,
    values,
    value: values.join(' • '),
  };
}

export function scoreMemoryAnswer(challenge, answer) {
  const expectedValues = Array.isArray(challenge.values) ? challenge.values : [challenge.value];
  const answerValues = Array.isArray(answer) ? answer : [answer];
  const normalizeValue = (value) => {
    const normalized = typeof value === 'string' ? value.replaceAll(/\s/g, '') : '';
    return /^\d+(?:\.\d+)?$/.test(normalized) ? normalized : '';
  };
  const normalizedValues = answerValues.map(normalizeValue);
  const normalizedAnswer = normalizedValues.join(' • ');
  const correct = expectedValues.length === normalizedValues.length
    && expectedValues.every((value, index) => value === normalizedValues[index]);
  return {
    correct,
    normalizedAnswer,
    normalizedValues,
  };
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
