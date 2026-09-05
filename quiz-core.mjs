import { createPatternGame, PATTERN_GAME_NAMES } from './pattern-games.mjs';

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

export const TASK_MODE_CONFIG = Object.freeze({
  Easy: Object.freeze({ minimumSteps: 2, maximumSteps: 3, rows: 4, tabs: 2, briefingSeconds: 20, recallSeconds: 75, demoStepMilliseconds: 1400 }),
  Medium: Object.freeze({ minimumSteps: 4, maximumSteps: 5, rows: 6, tabs: 3, briefingSeconds: 15, recallSeconds: 60, demoStepMilliseconds: 1100 }),
  Hard: Object.freeze({ minimumSteps: 6, maximumSteps: 8, rows: 8, tabs: 4, briefingSeconds: 10, recallSeconds: 45, demoStepMilliseconds: 850 }),
});

export const ERROR_DETECTION_MODE_CONFIG = Object.freeze({
  Easy: Object.freeze({ details: 4, maximumErrors: 1, timeLimitSeconds: 35 }),
  Medium: Object.freeze({ details: 5, maximumErrors: 2, timeLimitSeconds: 28 }),
  Hard: Object.freeze({ details: 6, maximumErrors: 3, timeLimitSeconds: 20 }),
});

const TASK_TAB_LABELS = Object.freeze(['Orders', 'Clients', 'Projects', 'Reviews', 'Archive']);
const TASK_PEOPLE = Object.freeze([
  'Morgan Dawson', 'Avery Brooks', 'Riley Chen', 'Jordan Patel', 'Casey Rivera', 'Taylor Nguyen',
  'Cameron Ellis', 'Sydney Moore', 'Parker James', 'Quinn Harper', 'Emerson Wells', 'Rowan Price',
]);
const TASK_STATUS_OPTIONS = Object.freeze(['New', 'Review', 'Approved', 'On hold']);
const TASK_PRIORITY_OPTIONS = Object.freeze(['Low', 'Normal', 'High', 'Urgent']);
const TASK_WORKSPACE_KINDS = Object.freeze(['records', 'casework', 'invoice']);
const TASK_CASE_TAB_LABELS = Object.freeze(['Intake', 'Case details', 'Notes', 'History', 'Archive']);
const TASK_CASE_STATUS_OPTIONS = Object.freeze(['Open', 'Needs review', 'Escalated', 'Resolved']);
const TASK_CASE_QUEUE_OPTIONS = Object.freeze(['General', 'Billing', 'Compliance', 'Priority']);
const TASK_INVOICE_TAB_LABELS = Object.freeze(['Invoices', 'Calculations', 'Approvals', 'Suppliers', 'Archive']);
const TASK_INVOICE_STATUS_OPTIONS = Object.freeze(['Draft', 'Ready for review', 'Approved', 'On hold']);
const TASK_INVOICE_CATEGORY_OPTIONS = Object.freeze(['Services', 'Materials', 'Travel', 'Operations']);

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

function requireBoundedInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
}

function requirePresetOverrides(overrides) {
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('Preset overrides must be an object.');
  }
}

function hasNonWholeDollarAmount(minimum, maximum, step) {
  const firstIndex = Math.ceil(minimum / step);
  const lastIndex = Math.floor(maximum / step);
  const possibleValues = Math.min(lastIndex - firstIndex + 1, 100);
  return Array.from({ length: Math.max(0, possibleValues) }, (_, index) => (firstIndex + index) * step)
    .some((value) => value % 100 !== 0);
}

export function resolveCashDifficultyPreset(level, overrides = {}) {
  const defaults = DIFFICULTY_CONFIG[level];
  if (!defaults) throw new RangeError(`Unknown difficulty: ${level}`);
  requirePresetOverrides(overrides);

  const preset = {
    ...defaults,
    ...overrides,
    allowed: [],
  };
  requireBoundedInteger(preset.minDue, 'Minimum due amount', 100, 10000000);
  requireBoundedInteger(preset.maxDue, 'Maximum due amount', 100, 10000000);
  requireBoundedInteger(preset.step, 'Increment', 1, 99);
  requireBoundedInteger(preset.maxDifference, 'Maximum difference', preset.step, 10000000);
  preset.allowed = preset.step % 25 === 0
    ? [...defaults.allowed]
    : DENOMINATIONS.map((denomination) => denomination.cents);
  requireBoundedInteger(preset.splitCount, 'Cash item count', 1, preset.allowed.length);
  if (preset.minDue > preset.maxDue) {
    throw new RangeError('Minimum due amount cannot be greater than the maximum due amount.');
  }
  if (!hasNonWholeDollarAmount(preset.minDue, preset.maxDue, preset.step)) {
    throw new RangeError('The amount range and increment must allow at least one amount with cents.');
  }
  return preset;
}

export function resolveMemoryDifficultyPreset(level, overrides = {}) {
  const defaults = MEMORY_MODE_CONFIG[level];
  if (!defaults) throw new RangeError(`Unknown memory difficulty: ${level}`);
  requirePresetOverrides(overrides);

  const preset = {
    ...defaults,
    ...overrides,
  };
  if (overrides.digits !== undefined) {
    preset.minimumDigits = overrides.digits;
    preset.maximumDigits = overrides.digits;
  }
  requireMemoryRange(preset.minimumDigits, preset.maximumDigits, 'Digits', 1, 100);
  requireMemoryRange(preset.minimumValues, preset.maximumValues, 'Values', 1, 100);
  if (typeof preset.decimals !== 'boolean') throw new TypeError('Decimals must be true or false.');
  requireMemoryInteger(preset.readSeconds, 'Read seconds', 1, 60);
  requireMemoryInteger(preset.writeSeconds, 'Write seconds', 1, 300);
  return preset;
}

export function resolveTaskDifficultyPreset(level, overrides = {}) {
  const defaults = TASK_MODE_CONFIG[level];
  if (!defaults) throw new RangeError(`Unknown task difficulty: ${level}`);
  requirePresetOverrides(overrides);

  const preset = {
    ...defaults,
    ...overrides,
  };
  requireMemoryRange(preset.minimumSteps, preset.maximumSteps, 'Steps', 2, 10);
  requireMemoryInteger(preset.rows, 'Rows', 3, 12);
  requireMemoryInteger(preset.tabs, 'Tabs', 2, 5);
  requireMemoryInteger(preset.briefingSeconds, 'Briefing seconds', 0, 300);
  requireMemoryInteger(preset.recallSeconds, 'Recall seconds', 0, 900);
  requireMemoryInteger(preset.demoStepMilliseconds, 'Demo step milliseconds', 250, 3000);
  return preset;
}

export function resolveErrorDetectionDifficultyPreset(level, overrides = {}) {
  const defaults = ERROR_DETECTION_MODE_CONFIG[level];
  if (!defaults) throw new RangeError(`Unknown Error Detection difficulty: ${level}`);
  requirePresetOverrides(overrides);

  const preset = { ...defaults, ...overrides };
  requireMemoryInteger(preset.details, 'Selectable clues per puzzle', 3, 8);
  requireMemoryInteger(preset.maximumErrors, 'Maximum anomalies', 0, preset.details);
  requireMemoryInteger(preset.timeLimitSeconds, 'Seconds per round', 3, 300);
  return preset;
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
  const preset = resolveMemoryDifficultyPreset(level, options);
  const {
    minimumDigits,
    maximumDigits,
    minimumValues,
    maximumValues,
    decimals,
    readSeconds,
    writeSeconds,
  } = preset;

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

export const ERROR_DETECTION_PUZZLE_FAMILIES = Object.freeze([
  'symbol-matrix',
  'number-machine',
  'cipher-check',
  'logic-schedule',
  'route-network',
  ...Object.keys(PATTERN_GAME_NAMES),
]);

const ERROR_DETECTION_RULE_LAYERS = Object.freeze({ Easy: 1, Medium: 2, Hard: 3 });
const PUZZLE_SHAPES = Object.freeze(['Circle', 'Square', 'Triangle']);
const PUZZLE_COLORS = Object.freeze(['Teal', 'Gold', 'Coral']);
const PUZZLE_FILLS = Object.freeze(['Solid', 'Striped', 'Dotted']);
const CIPHER_RING = Object.freeze(['A', 'D', 'G', 'J', 'M', 'P', 'S', 'V']);
const WEEKDAYS = Object.freeze(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
const ROUTE_NODES = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);

function errorRuleLayers(level) {
  const layers = ERROR_DETECTION_RULE_LAYERS[level];
  if (!layers) throw new RangeError(`Unknown Error Detection difficulty: ${level}`);
  return layers;
}

function cycleValue(values, index) {
  return values[((index % values.length) + values.length) % values.length];
}

function digitSum(value) {
  return String(Math.abs(value)).split('').reduce((sum, digit) => sum + Number(digit), 0);
}

function createPuzzleDetail(id, label, expectedValue, incorrectValue, correction, expectedVisual = null, incorrectVisual = null) {
  return { id, label, expectedValue, incorrectValue, correction, expectedVisual, incorrectVisual };
}

function choosePuzzleEntries(entries, count, rng) {
  const remaining = [...entries];
  const selected = [];
  while (selected.length < count && remaining.length > 0) {
    selected.push(remaining.splice(randomIndex(remaining.length, rng), 1)[0]);
  }
  return selected;
}

function symbolValue(symbol, layers) {
  const parts = [symbol.shape];
  if (layers >= 2) parts.push(symbol.color);
  if (layers >= 3) parts.push(symbol.fill);
  return parts.join(' · ');
}

function symbolVisual(symbol, layers) {
  return {
    type: 'symbol',
    shape: symbol.shape.toLowerCase(),
    color: symbol.color.toLowerCase(),
    fill: symbol.fill.toLowerCase(),
    ariaLabel: symbolValue(symbol, layers),
  };
}

function createSymbolMatrixPuzzle(level, rng) {
  const layers = errorRuleLayers(level);
  const start = randomIndex(PUZZLE_SHAPES.length, rng);
  const expectedAt = (row, column) => ({
    shape: cycleValue(PUZZLE_SHAPES, start + row + column),
    color: cycleValue(PUZZLE_COLORS, layers >= 2 ? start + row + column : start),
    fill: cycleValue(PUZZLE_FILLS, layers >= 3 ? start + row + (column * 2) : start),
  });
  const mutate = (symbol) => {
    const properties = layers === 1 ? ['shape'] : layers === 2 ? ['shape', 'color'] : ['shape', 'color', 'fill'];
    const property = properties[randomIndex(properties.length, rng)];
    const next = { ...symbol };
    const values = property === 'shape' ? PUZZLE_SHAPES : property === 'color' ? PUZZLE_COLORS : PUZZLE_FILLS;
    next[property] = cycleValue(values, values.indexOf(symbol[property]) + 1);
    return next;
  };
  const details = Array.from({ length: 9 }, (_, position) => {
    const row = Math.floor(position / 3);
    const column = position % 3;
    const expected = expectedAt(row, column);
    const incorrect = mutate(expected);
    const coordinate = `${String.fromCharCode(65 + row)}${column + 1}`;
    return createPuzzleDetail(
      `matrix-${coordinate.toLowerCase()}`,
      `Matrix tile ${coordinate}`,
      symbolValue(expected, layers),
      symbolValue(incorrect, layers),
      `Tile ${coordinate} should be ${symbolValue(expected, layers)}.`,
      symbolVisual(expected, layers),
      symbolVisual(incorrect, layers),
    );
  });
  const exampleExpected = expectedAt(0, 0);
  const exampleIncorrect = mutate(exampleExpected);
  return {
    family: 'symbol-matrix',
    title: 'Signal matrix',
    puzzle: { type: 'symbol-matrix', visual: true, columnCount: 3, legend: 'Circle, square, and triangle tiles form a cyclic visual grid.' },
    overview: 'Inspect each tile against the active cycles in a three-by-three signal matrix.',
    ruleSteps: [
      `The upper-left tile is ${symbolValue(expectedAt(0, 0), layers)}; use it as the start of the matrix.`,
      'Moving right or down advances the shape through Circle → Square → Triangle → Circle.',
      'At Medium and Hard, the colour advances through Teal → Gold → Coral in the same cycle.',
      'At Hard, fill advances one step down and two steps right through Solid → Striped → Dotted.',
    ],
    example: {
      valid: { label: 'Valid A1', value: symbolValue(exampleExpected, layers), visual: symbolVisual(exampleExpected, layers) },
      anomaly: { label: 'Broken A1', value: symbolValue(exampleIncorrect, layers), visual: symbolVisual(exampleIncorrect, layers) },
      explanation: 'The valid tile starts every active cycle. Changing any active attribute makes it anomalous.',
    },
    details,
  };
}

function createNumberMachinePuzzle(level, rng) {
  const layers = errorRuleLayers(level);
  const offset = memoryRandomInteger(1, 6, rng);
  const outputFor = (input) => {
    let output = (input * 2) + offset;
    if (layers >= 2) output += digitSum(input);
    if (layers >= 3) output += input % 2 === 0 ? 4 : -3;
    return output;
  };
  const display = (input, output) => `${input} → ${output}`;
  const baseInput = memoryRandomInteger(11, 39, rng);
  const details = Array.from({ length: 8 }, (_, index) => {
    const input = 11 + ((baseInput + (index * 7)) % 78);
    const expected = outputFor(input);
    const delta = [1, 2, 3][randomIndex(3, rng)];
    const incorrect = expected + (randomIndex(2, rng) === 0 ? -delta : delta);
    return createPuzzleDetail(
      `machine-${index + 1}`,
      `Machine row ${index + 1}`,
      display(input, expected),
      display(input, incorrect),
      `For ${input}, the machine output is ${expected}.`,
    );
  });
  const exampleInput = 14;
  const exampleExpected = outputFor(exampleInput);
  return {
    family: 'number-machine',
    title: 'Number machine',
    puzzle: { type: 'number-machine', visual: false, legend: 'Every row sends one input through the same hidden machine.' },
    overview: 'Read the full machine rule, then locate outputs that do not follow it.',
    ruleSteps: [
      'Treat the left value in every row as input n.',
      `Double n, then add ${offset}.`,
      'At Medium and Hard, add the digit sum of the original n.',
      'At Hard, add 4 for even n or subtract 3 for odd n.',
    ],
    example: {
      valid: { label: 'Valid row', value: display(exampleInput, exampleExpected) },
      anomaly: { label: 'Broken row', value: display(exampleInput, exampleExpected + 1) },
      explanation: 'The broken row is one away from the computed output, so it is still an anomaly.',
    },
    details,
  };
}

function createCipherCheckPuzzle(level, rng) {
  const layers = errorRuleLayers(level);
  const cipherParts = (start) => {
    const firstIndex = start % CIPHER_RING.length;
    const secondIndex = (start + 1) % CIPHER_RING.length;
    const thirdIndex = (start + 2) % CIPHER_RING.length;
    const check = ((firstIndex + 1) + (secondIndex + 1) + (thirdIndex + 1)) % 10;
    return {
      first: CIPHER_RING[firstIndex],
      second: CIPHER_RING[secondIndex],
      third: CIPHER_RING[thirdIndex],
      check,
      lock: (9 - check + 10) % 10,
    };
  };
  const display = (parts) => {
    if (layers === 1) return `${parts.first} → ${parts.second}`;
    const core = `${parts.first} → ${parts.second} → ${parts.third} · check ${parts.check}`;
    return layers === 2 ? core : `${core} · lock ${parts.lock}`;
  };
  const mutate = (parts) => {
    const incorrect = { ...parts };
    if (layers === 1) incorrect.second = cycleValue(CIPHER_RING, CIPHER_RING.indexOf(parts.second) + 1);
    else if (layers === 2) incorrect.check = (parts.check + 1) % 10;
    else incorrect.lock = (parts.lock + 1) % 10;
    return incorrect;
  };
  const start = randomIndex(CIPHER_RING.length, rng);
  const details = Array.from({ length: 8 }, (_, index) => {
    const expected = cipherParts(start + index);
    const incorrect = mutate(expected);
    return createPuzzleDetail(
      `cipher-${index + 1}`,
      `Cipher seal ${index + 1}`,
      display(expected),
      display(incorrect),
      `Seal ${index + 1} should read ${display(expected)}.`,
    );
  });
  const exampleExpected = cipherParts(0);
  return {
    family: 'cipher-check',
    title: 'Cipher ring check',
    puzzle: { type: 'cipher-check', visual: false, legend: 'Each seal follows the same eight-glyph ring and optional check digits.' },
    overview: 'Decode the ring movement and, at higher levels, the check and lock digits.',
    ruleSteps: [
      `Use this ring: ${CIPHER_RING.join(' → ')} → A.`,
      'A valid seal lists its start glyph followed by the next glyph in the ring.',
      'At Medium and Hard, add the following glyph and use the final digit of the three ring positions as check.',
      'At Hard, the lock digit must bring the check digit up to 9.',
    ],
    example: {
      valid: { label: 'Valid seal', value: display(exampleExpected) },
      anomaly: { label: 'Broken seal', value: display(mutate(exampleExpected)) },
      explanation: 'The example changes one active part of the seal while leaving the rest plausible.',
    },
    details,
  };
}

function formatScheduleTime(minutes) {
  const hour = Math.floor(minutes / 60);
  return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function createLogicSchedulePuzzle(level, rng) {
  const layers = errorRuleLayers(level);
  const interval = 20;
  const laneNames = ['Aster', 'Comet', 'Kite', 'Nova', 'Orbit', 'Pulse', 'Vega', 'Zenith'];
  const startDay = randomIndex(WEEKDAYS.length, rng);
  const startMinutes = 540 + (randomIndex(4, rng) * interval);
  const tagMultiplier = 3;
  const entryAt = (index) => {
    const dayIndex = (startDay + index) % WEEKDAYS.length;
    const minutes = startMinutes + (index * interval);
    const tag = ((dayIndex + 1) + (tagMultiplier * (index + 1))) % 10;
    return { lane: laneNames[index], dayIndex, minutes, tag };
  };
  const display = (entry) => {
    const parts = [`${entry.lane} · ${WEEKDAYS[entry.dayIndex]}`];
    if (layers >= 2) parts.push(formatScheduleTime(entry.minutes));
    if (layers >= 3) parts.push(`tag ${entry.tag}`);
    return parts.join(' · ');
  };
  const mutate = (entry) => {
    const incorrect = { ...entry };
    if (layers === 1) incorrect.dayIndex = (entry.dayIndex + 1) % WEEKDAYS.length;
    else if (layers === 2) incorrect.minutes = entry.minutes + interval;
    else incorrect.tag = (entry.tag + 1) % 10;
    return incorrect;
  };
  const details = Array.from({ length: 8 }, (_, index) => {
    const expected = entryAt(index);
    return createPuzzleDetail(
      `schedule-${index + 1}`,
      `Schedule row ${index + 1}`,
      display(expected),
      display(mutate(expected)),
      `Row ${index + 1} should read ${display(expected)}.`,
    );
  });
  const exampleExpected = entryAt(0);
  return {
    family: 'logic-schedule',
    title: 'Logic schedule board',
    puzzle: { type: 'logic-schedule', visual: false, legend: 'Rows follow a weekday, time, and optional tag progression.' },
    overview: 'Trace the schedule in row order; higher difficulty activates more linked constraints.',
    ruleSteps: [
      `Row 1 begins ${WEEKDAYS[startDay]}${layers >= 2 ? ` at ${formatScheduleTime(startMinutes)}` : ''}.`,
      'Weekdays advance one working day at a time, with Friday followed by Monday.',
      `At Medium and Hard, time advances ${interval} minutes per row.`,
      `At Hard, tag = final digit of weekday number (Mon = 1 through Fri = 5) + ${tagMultiplier} × row number.`,
    ],
    example: {
      valid: { label: 'Valid row', value: display(exampleExpected) },
      anomaly: { label: 'Broken row', value: display(mutate(exampleExpected)) },
      explanation: 'Only the active rule layers matter at the selected difficulty.',
    },
    details,
  };
}

function createRouteNetworkPuzzle(level, rng) {
  const layers = errorRuleLayers(level);
  const start = randomIndex(ROUTE_NODES.length, rng);
  const pathAt = (index) => {
    const firstIndex = (start + index) % ROUTE_NODES.length;
    const path = [
      ROUTE_NODES[firstIndex],
      ROUTE_NODES[(firstIndex + 1) % ROUTE_NODES.length],
      ROUTE_NODES[(firstIndex + 2) % ROUTE_NODES.length],
    ];
    const crossesBoundary = path[0] === 'F' || path[1] === 'F';
    let signal = (ROUTE_NODES.indexOf(path[0]) + 1) + (ROUTE_NODES.indexOf(path[2]) + 1);
    if (layers >= 3 && crossesBoundary) signal += 5;
    return { path, signal, crossesBoundary };
  };
  const display = (route) => {
    const path = route.path.join(' → ');
    return layers === 1 ? path : `${path} · S${route.signal}`;
  };
  const visual = (route) => ({ type: 'route', path: route.path, signal: layers === 1 ? null : route.signal, ariaLabel: display(route) });
  const mutate = (route) => {
    const incorrect = { ...route, path: [...route.path] };
    if (layers === 1) incorrect.path[2] = cycleValue(ROUTE_NODES, ROUTE_NODES.indexOf(route.path[2]) + 1);
    else incorrect.signal = route.signal + 1;
    return incorrect;
  };
  const details = Array.from({ length: 8 }, (_, index) => {
    const expected = pathAt(index);
    const incorrect = mutate(expected);
    return createPuzzleDetail(
      `route-${index + 1}`,
      `Route trace ${index + 1}`,
      display(expected),
      display(incorrect),
      `Route ${index + 1} should follow ${display(expected)}.`,
      visual(expected),
      visual(incorrect),
    );
  });
  const exampleExpected = pathAt(0);
  return {
    family: 'route-network',
    title: 'Route network',
    puzzle: { type: 'route-network', visual: true, nodeLabels: ROUTE_NODES, legend: 'Trace paths clockwise across a six-node ring.' },
    overview: 'Follow each route around the visual node ring and verify its signal when required.',
    ruleSteps: [
      'Read each trace clockwise around the six-node ring.',
      'A valid route makes two one-node hops: start → next → next.',
      'At Medium and Hard, the signal equals the start node number plus the finish node number (A = 1 through F = 6).',
      'At Hard, add 5 to the signal whenever a hop crosses the F → A boundary.',
    ],
    example: {
      valid: { label: 'Valid route', value: display(exampleExpected), visual: visual(exampleExpected) },
      anomaly: { label: 'Broken route', value: display(mutate(exampleExpected)), visual: visual(mutate(exampleExpected)) },
      explanation: 'A route can look plausible while either a hop or its signal violates the active rule.',
    },
    details,
  };
}

export function createErrorDetectionChallenge(level, options = {}, rng = Math.random) {
  const { puzzleFamily, ...presetOptions } = options;
  const preset = resolveErrorDetectionDifficultyPreset(level, presetOptions);
  const puzzleFactories = [
    createSymbolMatrixPuzzle,
    createNumberMachinePuzzle,
    createCipherCheckPuzzle,
    createLogicSchedulePuzzle,
    createRouteNetworkPuzzle,
    ...Object.keys(PATTERN_GAME_NAMES).map((family) => (difficulty, random) => createPatternGame(family, difficulty, random)),
  ];
  const forcedFamilyIndex = puzzleFamily === undefined ? -1 : ERROR_DETECTION_PUZZLE_FAMILIES.indexOf(puzzleFamily);
  if (puzzleFamily !== undefined && forcedFamilyIndex < 0) {
    throw new RangeError(`Unknown Error Detection puzzle family: ${puzzleFamily}`);
  }
  const puzzleFactoryIndex = forcedFamilyIndex >= 0 ? forcedFamilyIndex : randomIndex(puzzleFactories.length, rng);
  const puzzle = puzzleFactories[puzzleFactoryIndex](level, rng);
  const selectedDetails = choosePuzzleEntries(puzzle.details, preset.details, rng);
  const errorCount = randomIndex(Math.min(preset.maximumErrors, selectedDetails.length) + 1, rng);
  const errorIds = new Set(choosePuzzleEntries(selectedDetails, errorCount, rng).map((detail) => detail.id));
  const details = selectedDetails.map((detail) => ({
    id: detail.id,
    label: detail.label,
    value: errorIds.has(detail.id) ? detail.incorrectValue : detail.expectedValue,
    expectedValue: detail.expectedValue,
    correction: detail.correction,
    visual: errorIds.has(detail.id) ? detail.incorrectVisual : detail.expectedVisual,
  }));
  const ruleLayers = errorRuleLayers(level);
  const briefing = {
    overview: puzzle.overview,
    ruleSteps: puzzle.ruleSteps.slice(0, ruleLayers + 1),
    example: puzzle.example,
  };

  return {
    id: `error-detection-${level.toLowerCase()}-${randomIndex(1000000, rng)}`,
    level,
    family: puzzle.family,
    title: puzzle.title,
    puzzle: puzzle.puzzle,
    briefing,
    ruleLayers,
    rule: briefing.ruleSteps.join(' '),
    details,
    detailsCount: details.length,
    errorIds: details.filter((detail) => errorIds.has(detail.id)).map((detail) => detail.id),
    timeLimitSeconds: preset.timeLimitSeconds,
  };
}

export function scoreErrorDetectionAttempt(challenge, selectedDetailIds = [], timedOut = false) {
  if (!Array.isArray(challenge?.details) || !Array.isArray(challenge?.errorIds)) {
    throw new TypeError('Error Detection challenge details and error IDs must be arrays.');
  }
  if (!Array.isArray(selectedDetailIds)) throw new TypeError('Selected detail IDs must be an array.');

  const detailIds = challenge.details.map((detail) => detail.id);
  const knownIds = new Set(detailIds);
  const expected = new Set(challenge.errorIds.filter((id) => knownIds.has(id)));
  const selected = new Set(selectedDetailIds.filter((id) => knownIds.has(id)));
  const expectedErrorIds = detailIds.filter((id) => expected.has(id));
  const normalizedSelectedIds = detailIds.filter((id) => selected.has(id));
  const missedErrorIds = expectedErrorIds.filter((id) => !selected.has(id));
  const falseFlagIds = normalizedSelectedIds.filter((id) => !expected.has(id));

  return {
    correct: !timedOut && missedErrorIds.length === 0 && falseFlagIds.length === 0,
    expectedErrorIds,
    selectedDetailIds: normalizedSelectedIds,
    missedErrorIds,
    falseFlagIds,
    correctlyFlagged: expectedErrorIds.length - missedErrorIds.length,
    errorCount: expectedErrorIds.length,
    timedOut: Boolean(timedOut),
  };
}

function chooseTaskEntries(entries, count, rng) {
  const remaining = [...entries];
  const selected = [];
  for (let index = 0; index < count; index += 1) {
    selected.push(remaining.splice(randomIndex(remaining.length, rng), 1)[0]);
  }
  return selected;
}

function taskReference(rng) {
  return String(memoryRandomInteger(1000, 9999, rng));
}

function taskActionCandidates(rows, rng) {
  return rows.flatMap((row) => {
    const reference = taskReference(rng);
    const statusOptions = TASK_STATUS_OPTIONS.filter((value) => value !== row.status);
    const priorityOptions = TASK_PRIORITY_OPTIONS.filter((value) => value !== row.priority);
    const status = statusOptions[randomIndex(statusOptions.length, rng)];
    const priority = priorityOptions[randomIndex(priorityOptions.length, rng)];
    return [
      {
        type: 'set-text',
        targetId: `task-row-${row.id}-reference`,
        value: reference,
        instruction: `Enter ${reference} in ${row.name}'s Reference field.`,
      },
      {
        type: 'select-option',
        targetId: `task-row-${row.id}-status`,
        value: status,
        instruction: `Set ${row.name}'s Status to ${status}.`,
      },
      {
        type: 'select-option',
        targetId: `task-row-${row.id}-priority`,
        value: priority,
        instruction: `Set ${row.name}'s Priority to ${priority}.`,
      },
      {
        type: 'toggle-checkbox',
        targetId: `task-row-${row.id}-complete`,
        value: true,
        instruction: `Mark ${row.name}'s record complete.`,
      },
    ];
  });
}

function createTaskTabs(labels, count) {
  return labels.slice(0, count).map((label) => ({
    id: `task-tab-${label.toLowerCase()}`,
    label,
  }));
}

function taskChallengeBase(level, preset, title, workspace, steps, rng) {
  return {
    id: `task-${level.toLowerCase()}-${randomIndex(1000000, rng)}`,
    level,
    title,
    briefingSeconds: preset.briefingSeconds,
    recallSeconds: preset.recallSeconds,
    demoStepMilliseconds: preset.demoStepMilliseconds,
    workspace,
    steps,
  };
}

function createRecordsTaskChallenge(level, preset, stepCount, rng) {
  const tabs = createTaskTabs(TASK_TAB_LABELS, preset.tabs);
  const names = chooseTaskEntries(TASK_PEOPLE, preset.rows, rng);
  const rows = names.map((name, index) => ({
    id: String(index + 1),
    name,
    reference: '',
    status: 'New',
    priority: 'Normal',
    complete: false,
  }));
  const needsTab = stepCount >= 3;
  const dataStepCount = stepCount - (needsTab ? 2 : 1);
  const dataSteps = chooseTaskEntries(taskActionCandidates(rows, rng), dataStepCount, rng);
  const tab = tabs[randomIndex(tabs.length, rng)];
  const steps = [
    ...(needsTab ? [{
      type: 'activate-tab',
      targetId: tab.id,
      value: tab.label,
      instruction: `Open the ${tab.label} tab.`,
    }] : []),
    ...dataSteps,
    {
      type: 'commit',
      targetId: 'task-save-workspace',
      instruction: 'Save the changes.',
    },
  ];
  const titleRow = rows[randomIndex(rows.length, rng)];

  return taskChallengeBase(level, preset, `Update the ${titleRow.name.split(' ').at(-1)} records`, {
      kind: 'records',
      tabs,
      rows,
      columns: ['Name', 'Reference', 'Status', 'Priority', 'Complete'],
      targetIds: [
        'task-save-workspace',
        ...tabs.map((tab) => tab.id),
        ...rows.flatMap((row) => [
          `task-row-${row.id}-reference`,
          `task-row-${row.id}-status`,
          `task-row-${row.id}-priority`,
          `task-row-${row.id}-complete`,
        ]),
      ],
    },
    steps, rng);
}

function createCaseworkTaskChallenge(level, preset, stepCount, rng) {
  const tabs = createTaskTabs(TASK_CASE_TAB_LABELS, preset.tabs);
  const person = TASK_PEOPLE[randomIndex(TASK_PEOPLE.length, rng)];
  const caseReference = `CS-${taskReference(rng)}`;
  const verificationSource = taskReference(rng);
  const queue = TASK_CASE_QUEUE_OPTIONS[(randomIndex(TASK_CASE_QUEUE_OPTIONS.length - 1, rng) + 1) % TASK_CASE_QUEUE_OPTIONS.length];
  const status = TASK_CASE_STATUS_OPTIONS[(randomIndex(TASK_CASE_STATUS_OPTIONS.length - 1, rng) + 1) % TASK_CASE_STATUS_OPTIONS.length];
  const note = `Verify ${person.split(' ').at(-1)} details`;
  const actionCount = stepCount - 1;
  const dialogSteps = [
    { type: 'open-dialog', targetId: 'task-open-case-dialog', value: 'Add case note', instruction: 'Open the Add case note window.' },
    { type: 'set-text', targetId: 'task-case-note', value: note, instruction: `Enter “${note}” in the case note.` },
    { type: 'confirm-dialog', targetId: 'task-confirm-case-note', instruction: 'Add the case note.' },
  ];
  const newTabSteps = [
    { type: 'open-workspace-tab', targetId: 'task-open-verification-tab', value: 'Verification', instruction: 'Open the Verification workspace tab.' },
    { type: 'activate-tab', targetId: 'task-tab-verification', value: 'Verification', instruction: 'Open the Verification tab.' },
    { type: 'set-text', targetId: 'task-case-verification', value: verificationSource, instruction: `Copy ${verificationSource} into the Verification code field.` },
  ];
  const baseCandidates = [
    { type: 'activate-tab', targetId: tabs[1].id, value: tabs[1].label, instruction: `Open the ${tabs[1].label} tab.` },
    { type: 'set-text', targetId: 'task-case-reference', value: caseReference, instruction: `Enter ${caseReference} in Case reference.` },
    { type: 'select-option', targetId: 'task-case-status', value: status, instruction: `Set Case status to ${status}.` },
    { type: 'select-option', targetId: 'task-case-queue', value: queue, instruction: `Set Queue to ${queue}.` },
    { type: 'toggle-checkbox', targetId: 'task-case-followup', value: true, instruction: 'Mark Follow-up required.' },
  ];
  const advancedSteps = actionCount >= 6
    ? [...newTabSteps, ...dialogSteps]
    : actionCount >= 3
      ? (randomIndex(2, rng) === 0 ? dialogSteps : newTabSteps)
      : [];
  const baseSteps = chooseTaskEntries(baseCandidates, actionCount - advancedSteps.length, rng);
  const steps = [
    ...baseSteps,
    ...advancedSteps,
    { type: 'commit', targetId: 'task-save-workspace', instruction: 'Save the case changes.' },
  ];

  return taskChallengeBase(level, preset, `Process the ${person.split(' ').at(-1)} case`, {
    kind: 'casework',
    tabs,
    rows: [],
    columns: [],
    case: {
      person,
      requestId: `REQ-${taskReference(rng)}`,
      verificationSource,
      status: 'Open',
      queue: 'General',
      dialog: { targetId: 'task-case-note', title: 'Add case note' },
      openableTab: { id: 'task-tab-verification', label: 'Verification', openerId: 'task-open-verification-tab' },
    },
    dialog: { targetId: 'task-case-note', title: 'Add case note' },
    targetIds: [
      'task-save-workspace',
      ...tabs.map((tab) => tab.id),
      'task-case-reference', 'task-case-status', 'task-case-queue', 'task-case-followup',
      'task-open-case-dialog', 'task-case-note', 'task-confirm-case-note',
      'task-open-verification-tab', 'task-tab-verification', 'task-case-verification',
    ],
  }, steps, rng);
}

function createTaskFormula(rng) {
  const type = randomIndex(3, rng);
  if (type === 0) {
    const left = memoryRandomInteger(12, 95, rng);
    const right = memoryRandomInteger(4, 48, rng);
    return { expression: `${left} + ${right}`, result: left + right };
  }
  if (type === 1) {
    const left = memoryRandomInteger(3, 14, rng);
    const right = memoryRandomInteger(4, 12, rng);
    return { expression: `${left} × ${right}`, result: left * right };
  }
  const divisor = memoryRandomInteger(2, 9, rng);
  const result = memoryRandomInteger(3, 18, rng);
  return { expression: `${divisor * result} ÷ ${divisor}`, result };
}

function createInvoiceTaskChallenge(level, preset, stepCount, rng) {
  const tabs = createTaskTabs(TASK_INVOICE_TAB_LABELS, preset.tabs);
  const person = TASK_PEOPLE[randomIndex(TASK_PEOPLE.length, rng)];
  const formula = createTaskFormula(rng);
  const verificationSource = taskReference(rng);
  const invoiceReference = `INV-${taskReference(rng)}`;
  const status = TASK_INVOICE_STATUS_OPTIONS[(randomIndex(TASK_INVOICE_STATUS_OPTIONS.length - 1, rng) + 1) % TASK_INVOICE_STATUS_OPTIONS.length];
  const category = TASK_INVOICE_CATEGORY_OPTIONS[(randomIndex(TASK_INVOICE_CATEGORY_OPTIONS.length - 1, rng) + 1) % TASK_INVOICE_CATEGORY_OPTIONS.length];
  const actionCount = stepCount - 1;
  const requiredSteps = [
    { type: 'set-text', targetId: 'task-invoice-calculation', value: String(formula.result), instruction: `Calculate ${formula.expression} and enter the result in Final total.` },
    { type: 'set-text', targetId: 'task-invoice-verification', value: verificationSource, instruction: `Copy source control number ${verificationSource} into Verification code.` },
  ].slice(0, actionCount);
  const extraCandidates = [
    { type: 'activate-tab', targetId: tabs[1].id, value: tabs[1].label, instruction: `Open the ${tabs[1].label} tab.` },
    { type: 'set-text', targetId: 'task-invoice-reference', value: invoiceReference, instruction: `Enter ${invoiceReference} in Invoice reference.` },
    { type: 'select-option', targetId: 'task-invoice-status', value: status, instruction: `Set Review status to ${status}.` },
    { type: 'select-option', targetId: 'task-invoice-category', value: category, instruction: `Set Cost category to ${category}.` },
    { type: 'toggle-checkbox', targetId: 'task-invoice-approved', value: true, instruction: 'Mark Approval received.' },
    { type: 'toggle-checkbox', targetId: 'task-invoice-verified', value: true, instruction: 'Mark the source number as verified.' },
    { type: 'set-text', targetId: 'task-invoice-note', value: 'Matched to source', instruction: 'Enter “Matched to source” in Review note.' },
  ];
  const steps = [
    ...requiredSteps,
    ...chooseTaskEntries(extraCandidates, actionCount - requiredSteps.length, rng),
    { type: 'commit', targetId: 'task-save-workspace', instruction: 'Save the invoice changes.' },
  ];

  return taskChallengeBase(level, preset, `Reconcile the ${person.split(' ').at(-1)} invoice`, {
    kind: 'invoice',
    tabs,
    rows: [],
    columns: [],
    invoice: {
      person,
      invoiceId: `INV-${taskReference(rng)}`,
      formula,
      verification: { source: verificationSource },
      status: 'Draft',
      category: 'Services',
    },
    formula,
    verification: { source: verificationSource },
    targetIds: [
      'task-save-workspace',
      ...tabs.map((tab) => tab.id),
      'task-invoice-reference', 'task-invoice-calculation', 'task-invoice-verification',
      'task-invoice-status', 'task-invoice-category', 'task-invoice-approved',
      'task-invoice-verified', 'task-invoice-note',
    ],
  }, steps, rng);
}

export function createTaskChallenge(level, options = {}, rng = Math.random) {
  const preset = resolveTaskDifficultyPreset(level, options);
  const stepCount = memoryRandomInteger(preset.minimumSteps, preset.maximumSteps, rng);
  const kind = TASK_WORKSPACE_KINDS[randomIndex(TASK_WORKSPACE_KINDS.length, rng)];
  if (kind === 'casework') return createCaseworkTaskChallenge(level, preset, stepCount, rng);
  if (kind === 'invoice') return createInvoiceTaskChallenge(level, preset, stepCount, rng);
  return createRecordsTaskChallenge(level, preset, stepCount, rng);
}

function taskActionsMatch(expected, action) {
  if (!action || expected.type !== action.type || expected.targetId !== action.targetId) return false;
  if (expected.value === undefined) return true;
  return typeof expected.value === 'boolean'
    ? expected.value === action.value
    : String(expected.value) === String(action.value ?? '');
}

export function scoreTaskAttempt(challenge, actionLog = [], timedOut = false) {
  if (!Array.isArray(challenge?.steps)) throw new TypeError('Task challenge steps must be an array.');
  if (!Array.isArray(actionLog)) throw new TypeError('Task action log must be an array.');

  let completedSteps = 0;
  let mistakes = 0;
  for (const action of actionLog) {
    const expected = challenge.steps[completedSteps];
    if (expected && taskActionsMatch(expected, action)) completedSteps += 1;
    else mistakes += 1;
  }
  const expectedSteps = challenge.steps.length;
  return {
    correct: !timedOut && completedSteps === expectedSteps && mistakes === 0,
    completedSteps,
    expectedSteps,
    mistakes,
    sequenceAccuracyPercent: expectedSteps ? Math.round((completedSteps / expectedSteps) * 100) : 0,
    timedOut: Boolean(timedOut),
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

const CUSTOMER_BILL_REQUEST_KINDS = Object.freeze(['specific', 'remainder', 'mixed', 'low', 'high', 'mismatch', 'unsupported']);

function billDenominations() {
  return DENOMINATIONS.filter((denomination) => denomination.category === 'Bill');
}

function cashCounts(breakdown = []) {
  const counts = new Map(DENOMINATIONS.map((denomination) => [denomination.cents, 0]));
  for (const item of breakdown) {
    if (!counts.has(item?.cents) || !Number.isSafeInteger(item.count) || item.count < 0) {
      throw new RangeError('Cash breakdown contains an unsupported denomination or count.');
    }
    counts.set(item.cents, counts.get(item.cents) + item.count);
  }
  return counts;
}

function breakdownFromCounts(counts) {
  return DENOMINATIONS
    .filter((denomination) => counts.get(denomination.cents) > 0)
    .map((denomination) => ({ ...denomination, count: counts.get(denomination.cents) }));
}

function billCountsMatch(leftBreakdown, rightBreakdown) {
  const leftCounts = cashCounts(leftBreakdown);
  const rightCounts = cashCounts(rightBreakdown);
  return billDenominations().every((denomination) => (
    leftCounts.get(denomination.cents) === rightCounts.get(denomination.cents)
  ));
}

function distinctBillCount(breakdown) {
  const counts = cashCounts(breakdown);
  return billDenominations().filter((denomination) => counts.get(denomination.cents) > 0).length;
}

function formatCustomerBillList(breakdown) {
  const parts = breakdown
    .filter((item) => item.category === 'Bill')
    .map((item) => `${item.count} x ${item.count === 1 ? item.singular : item.plural}`);
  if (parts.length < 2) return parts[0] ?? 'no bills';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}

function splitOneBill(counts, rng) {
  const bills = billDenominations();
  const sources = bills.filter((source) => (
    counts.get(source.cents) > 0
    && bills.some((destination) => destination.cents < source.cents && source.cents % destination.cents === 0)
  ));
  if (sources.length === 0) return false;

  const source = sources[randomIndex(sources.length, rng)];
  const destinations = bills.filter((destination) => (
    destination.cents < source.cents && source.cents % destination.cents === 0
  ));
  const destination = destinations[randomIndex(destinations.length, rng)];
  counts.set(source.cents, counts.get(source.cents) - 1);
  counts.set(destination.cents, counts.get(destination.cents) + (source.cents / destination.cents));
  return true;
}

function createSpecificBillBreakdown(amountCents, rng) {
  const counts = cashCounts(buildBreakdown(amountCents));
  splitOneBill(counts, rng);
  return breakdownFromCounts(counts);
}

function createMixedBillBreakdown(amountCents, rng) {
  const counts = cashCounts(buildBreakdown(amountCents));
  for (let attempt = 0; attempt < 3 && distinctBillCount(breakdownFromCounts(counts)) < 2; attempt += 1) {
    if (!splitOneBill(counts, rng)) break;
  }
  const breakdown = breakdownFromCounts(counts);
  return distinctBillCount(breakdown) >= 2 ? breakdown : null;
}

function createRemainderBillBreakdown(amountCents, rng) {
  const wholeDollarCents = amountCents - (amountCents % 100);
  const candidates = [];
  const bills = billDenominations();
  for (const fixedBill of bills) {
    const maximumFixedCount = Math.min(10, Math.floor(wholeDollarCents / fixedBill.cents));
    for (let fixedCount = 1; fixedCount <= maximumFixedCount; fixedCount += 1) {
      const remaining = wholeDollarCents - (fixedBill.cents * fixedCount);
      for (const restBill of bills) {
        if (restBill.cents === fixedBill.cents || remaining < restBill.cents || remaining % restBill.cents !== 0) continue;
        candidates.push({ fixedBill, fixedCount, restBill, restCount: remaining / restBill.cents });
      }
    }
  }
  if (candidates.length === 0) return null;

  const candidate = candidates[randomIndex(candidates.length, rng)];
  const counts = cashCounts(buildBreakdown(amountCents));
  for (const bill of bills) counts.set(bill.cents, 0);
  counts.set(candidate.fixedBill.cents, candidate.fixedCount);
  counts.set(candidate.restBill.cents, candidate.restCount);
  return { ...candidate, breakdown: breakdownFromCounts(counts) };
}

function createRequestRecord({ kind, targetCents, text, expectedBreakdown, isValid = true, canFlag = false, requestedCents = targetCents }) {
  return Object.freeze({
    kind,
    targetCents,
    requestedCents,
    text,
    expectedBreakdown: Object.freeze(expectedBreakdown.map((item) => Object.freeze({ ...item }))),
    isValid,
    canFlag,
  });
}

export function createCustomerBillRequest(amountCents, rng = Math.random, requestedKind = '') {
  assertCents(amountCents, 'Customer request amount');
  if (typeof rng !== 'function') throw new TypeError('Customer request randomizer must be a function.');
  if (requestedKind !== '' && !CUSTOMER_BILL_REQUEST_KINDS.includes(requestedKind)) {
    throw new RangeError(`Unknown customer bill request: ${requestedKind}`);
  }

  const kind = requestedKind || CUSTOMER_BILL_REQUEST_KINDS[randomIndex(CUSTOMER_BILL_REQUEST_KINDS.length, rng)];
  const exactBreakdown = buildBreakdown(amountCents);

  if (kind === 'specific') {
    const expectedBreakdown = createSpecificBillBreakdown(amountCents, rng);
    return createRequestRecord({
      kind,
      targetCents: amountCents,
      expectedBreakdown,
      text: `Customer asks for ${formatCustomerBillList(expectedBreakdown)}. Give the exact change in those bills, plus coins if needed.`,
    });
  }

  if (kind === 'remainder') {
    const request = createRemainderBillBreakdown(amountCents, rng);
    if (!request) return createCustomerBillRequest(amountCents, rng, 'specific');
    const coinNote = amountCents % 100 === 0 ? '' : ' Add the cents in coins.';
    return createRequestRecord({
      kind,
      targetCents: amountCents,
      expectedBreakdown: request.breakdown,
      text: `Customer asks for ${request.fixedCount} x ${request.fixedCount === 1 ? request.fixedBill.singular : request.fixedBill.plural} and the rest in ${request.restBill.plural}.${coinNote}`,
    });
  }

  if (kind === 'mixed') {
    const expectedBreakdown = createMixedBillBreakdown(amountCents, rng);
    if (!expectedBreakdown) return createCustomerBillRequest(amountCents, rng, 'low');
    return createRequestRecord({
      kind,
      targetCents: amountCents,
      expectedBreakdown,
      text: 'Customer asks for a mix of bills. Give the exact change using at least two bill denominations.',
    });
  }

  if (kind === 'low') {
    const lowDenominations = DENOMINATIONS.filter((denomination) => denomination.category !== 'Bill' || denomination.cents <= 2000);
    const expectedBreakdown = buildBreakdown(amountCents, lowDenominations);
    return createRequestRecord({
      kind,
      targetCents: amountCents,
      expectedBreakdown,
      text: 'Customer asks for low bills. Give the exact change without $50 or $100 bills.',
    });
  }

  if (kind === 'high') {
    return createRequestRecord({
      kind,
      targetCents: amountCents,
      expectedBreakdown: exactBreakdown,
      text: 'Customer asks for high bills. Use the largest practical bills, then coins if needed.',
    });
  }

  if (kind === 'mismatch') {
    const requestedCounts = cashCounts(exactBreakdown);
    if (amountCents === 32000) {
      for (const bill of billDenominations()) requestedCounts.set(bill.cents, 0);
      requestedCounts.set(2000, 10);
      requestedCounts.set(5000, 1);
      requestedCounts.set(10000, 1);
    } else {
      const bill = billDenominations().find((denomination) => denomination.cents <= Math.max(100, amountCents)) ?? billDenominations().at(-1);
      requestedCounts.set(bill.cents, requestedCounts.get(bill.cents) + 1);
    }
    const requestedBreakdown = breakdownFromCounts(requestedCounts);
    const requestedCents = countTotalCents(requestedBreakdown);
    return createRequestRecord({
      kind,
      targetCents: amountCents,
      requestedCents,
      expectedBreakdown: exactBreakdown,
      isValid: false,
      canFlag: true,
      text: `Customer asks for ${formatCustomerBillList([...requestedBreakdown].reverse())}. That totals ${formatMoney(requestedCents)}, which does not equal the ${formatMoney(amountCents)} change due. Flag the request or give exactly ${formatMoney(amountCents)}.`,
    });
  }

  return createRequestRecord({
    kind: 'unsupported',
    targetCents: amountCents,
    requestedCents: null,
    expectedBreakdown: exactBreakdown,
    isValid: false,
    canFlag: true,
    text: `Customer asks for a $30 bill. A $30 bill is not available, so flag the request or give exactly ${formatMoney(amountCents)} with available denominations.`,
  });
}

export function evaluateCustomerBillRequest(request, breakdown = []) {
  if (!request) return { applies: false, matches: true, canFlag: false };
  if (!Array.isArray(breakdown)) return { applies: true, matches: false, canFlag: Boolean(request.canFlag) };
  if (!request.isValid) return { applies: true, matches: false, canFlag: Boolean(request.canFlag) };

  let matches = false;
  if (request.kind === 'mixed') {
    matches = distinctBillCount(breakdown) >= 2;
  } else if (request.kind === 'low') {
    const counts = cashCounts(breakdown);
    matches = billDenominations().every((bill) => bill.cents <= 2000 || counts.get(bill.cents) === 0);
  } else {
    matches = billCountsMatch(request.expectedBreakdown, breakdown);
  }
  return { applies: true, matches, canFlag: false };
}

function resolveCashQuestionOptions(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Cash question options must be an object.');
  }
  const customerRequestKind = options.customerRequestKind ?? '';
  if (typeof customerRequestKind !== 'string' || (customerRequestKind !== '' && !CUSTOMER_BILL_REQUEST_KINDS.includes(customerRequestKind))) {
    throw new RangeError('Customer request kind is not supported.');
  }
  return {
    customerBillRequests: options.customerBillRequests === true,
    customerRequestKind,
  };
}

export function createQuestion(level, rng = Math.random, presetOverrides = {}, options = {}) {
  const config = resolveCashDifficultyPreset(level, presetOverrides);
  const questionOptions = resolveCashQuestionOptions(options);
  const denominations = DENOMINATIONS.filter((item) => config.allowed.includes(item.cents));

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
      const customerBillRequest = questionOptions.customerBillRequests && expectedType === 'Change'
        ? createCustomerBillRequest(expectedAmountCents, rng, questionOptions.customerRequestKind)
        : null;
      return {
        dueCents,
        tenderedCents,
        expectedType,
        expectedAmountCents,
        breakdown,
        breakdownText: formatBreakdown(breakdown),
        customerBillRequest,
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

export function scoreAnswer(question, answer, cashBuilderEnabled, customerBillRequest = null) {
  const validTypes = new Set(['Exact', 'Change', 'Short']);
  const amountCents = answer.type === 'Exact' ? 0 : answer.amountCents;
  const validAnswer = validTypes.has(answer.type) && Number.isSafeInteger(amountCents) && amountCents >= 0;
  const cashTotalCents = countTotalCents(answer.breakdown ?? []);
  const typeMatches = validAnswer && answer.type === question.expectedType;
  const amountMatches = validAnswer && amountCents === question.expectedAmountCents;
  const customerRequest = cashBuilderEnabled ? customerBillRequest : null;
  const customerRequestResult = evaluateCustomerBillRequest(customerRequest, answer.breakdown ?? []);
  const customerRequestFlagged = Boolean(customerRequest?.canFlag && answer.requestFlagged);
  const breakdownMatches = !cashBuilderEnabled || customerRequestFlagged || cashTotalCents === question.expectedAmountCents;
  const customerRequestMatches = !customerRequest
    || customerRequestFlagged
    || (customerRequest.isValid
      ? customerRequestResult.matches
      : cashTotalCents === question.expectedAmountCents);
  return {
    correct: Boolean(typeMatches && amountMatches && breakdownMatches && customerRequestMatches),
    validAnswer,
    typeMatches,
    amountMatches,
    breakdownMatches,
    cashTotalCents,
    customerRequestMatches,
    customerRequestFlagged,
    customerRequestCanFlag: customerRequestResult.canFlag,
  };
}

export function summarizeHistory(records) {
  const history = Array.isArray(records) ? records : [];
  const answered = history.length;
  const correct = history.filter((record) => record?.outcome === 'Correct').length;
  const timedOut = history.filter((record) => record?.outcome === 'Timed Out').length;
  const notAnswered = history.filter((record) => record?.outcome === 'Not answered').length;
  const incorrect = Math.max(0, answered - correct - timedOut - notAnswered);
  const percent = (count) => answered ? Math.round((count / answered) * 100) : 0;

  return {
    answered,
    correct,
    timedOut,
    notAnswered,
    incorrect,
    accuracyPercent: percent(correct),
    outcomes: [
      { key: 'correct', label: 'Correct', count: correct, percent: percent(correct) },
      { key: 'incorrect', label: 'Incorrect', count: incorrect, percent: percent(incorrect) },
      { key: 'timedOut', label: 'Timed out', count: timedOut, percent: percent(timedOut) },
      { key: 'notAnswered', label: 'Not answered', count: notAnswered, percent: percent(notAnswered) },
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
