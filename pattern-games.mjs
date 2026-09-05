// Each clue includes its own inputs, so an anomalous clue cannot corrupt another.
export const PATTERN_GAME_NAMES = Object.freeze({
  'sequence-ladder': 'Sequence ladders',
  'interleaved-streams': 'Interleaved streams',
  'mirror-code': 'Mirror codes',
  'rotation-compass': 'Rotation compass',
  'binary-overlay': 'Binary overlays',
  'balance-scales': 'Balance scales',
  'coordinate-fold': 'Coordinate folds',
  'clock-jumps': 'Clock jumps',
  'letter-grid': 'Letter grids',
  'sorting-network': 'Sorting networks',
});

export function createPatternGame(family, level, rng = Math.random) {
  const depth = { Easy: 1, Medium: 2, Hard: 3 }[level];
  if (!depth || !Object.hasOwn(PATTERN_GAME_NAMES, family)) throw new RangeError('Unknown pattern game or difficulty.');
  const seed = 2 + Math.floor(rng() * 5);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter = (n) => alphabet[((n % 26) + 26) % 26];
  const rotate = (text) => text.slice(1) + text[0];
  const clock = (n) => {
    const minutes = ((n % 1440) + 1440) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  };
  let rules;
  let entry;
  switch (family) {
    case 'sequence-ladder':
      rules = [`Start = ${seed}; step = 3. Positions begin at 1.`,
        'At position n, start with start + 3 × (n − 1).',
        'At Medium and Hard, also add 1 + 2 + … + (n − 1); this is zero at n = 1.',
        'At Hard, subtract n at even positions; add n at odd positions.'];
      entry = (n) => ({ input: `Position ${n}`, output: String(seed + 3 * (n - 1) + (depth >= 2 ? n * (n - 1) / 2 : 0) + (depth === 3 ? (n % 2 ? n : -n) : 0)) });
      break;
    case 'interleaved-streams':
      rules = ['Read the six numbers as two interleaved streams: positions 1,3,5 and 2,4,6.',
        'Odd positions start at a and increase by 2. Even positions start at b and increase by 3.',
        'At Medium and Hard, even positions decrease by 3 instead.',
        'At Hard, the odd stream uses increments +2 then +4; the even stream uses −3 then −6.'];
      entry = (n) => {
        const a = seed + n, b = 30 + n;
        const down = depth >= 2 ? -1 : 1;
        return { input: `a=${a}, b=${b}`, output: [a, b, a + 2, b + down * 3, a + (depth === 3 ? 6 : 4), b + down * (depth === 3 ? 9 : 6)].join(' · ') };
      };
      break;
    case 'mirror-code':
      rules = ['Each source has four letters. Transform the source in the stated order.',
        'Reverse the letter order.',
        'At Medium and Hard, move the first reversed letter to the end.',
        'At Hard, advance every resulting letter by one in A–Z, wrapping Z to A.'];
      entry = (n) => {
        const input = [0, 3, 7, 12].map((offset) => letter(seed + n + offset)).join('');
        let output = [...input].reverse().join('');
        if (depth >= 2) output = rotate(output);
        if (depth === 3) output = [...output].map((x) => letter(alphabet.indexOf(x) + 1)).join('');
        return { input, output };
      };
      break;
    case 'rotation-compass':
      rules = ['Use the clockwise ring ↑ → ↓ ←. The input names a direction and a turn count t.',
        'Rotate clockwise by t quarter-turns.',
        'At Medium and Hard, rotate one additional quarter-turn clockwise.',
        'At Hard, then reflect across a vertical mirror: swap left/right, keep up/down.'];
      entry = (n) => {
        const arrows = ['↑', '→', '↓', '←'], start = (seed + n) % 4, turns = n % 3 + 1;
        let end = (start + turns + (depth >= 2 ? 1 : 0)) % 4;
        if (depth === 3) end = (4 - end) % 4;
        return { input: `${arrows[start]}, t=${turns}`, output: arrows[end] };
      };
      break;
    case 'binary-overlay':
      rules = ['Align the two four-bit strips from left to right.',
        'Write 1 where the bits differ and 0 where they match (XOR).',
        'At Medium and Hard, move the leftmost result bit to the right end.',
        'At Hard, then flip every result bit: 0 becomes 1 and 1 becomes 0.'];
      entry = (n) => {
        const a = ((seed * 3 + n) % 16).toString(2).padStart(4, '0');
        const b = ((n * 5 + seed) % 16).toString(2).padStart(4, '0');
        let output = [...a].map((bit, i) => bit === b[i] ? '0' : '1').join('');
        if (depth >= 2) output = rotate(output);
        if (depth === 3) output = [...output].map((bit) => bit === '0' ? '1' : '0').join('');
        return { input: `${a} XOR ${b}`, output };
      };
      break;
    case 'balance-scales':
      rules = [`A circle weighs ${seed}; a square weighs ${seed + 2}; a triangle weighs ${seed + 4}.`,
        'Add the weights of all shapes shown. The output is the total.',
        'At Medium and Hard, subtract 2 for every circle-square pair (use each shape once).',
        'At Hard, double the adjusted total when the triangle count is odd.'];
      entry = (n) => {
        const circles = n % 3 + 1, squares = (n + 1) % 3 + 1, triangles = n % 2 + 1;
        let total = circles * seed + squares * (seed + 2) + triangles * (seed + 4);
        if (depth >= 2) total -= Math.min(circles, squares) * 2;
        if (depth === 3 && triangles % 2) total *= 2;
        return { input: `${circles} circles + ${squares} squares + ${triangles} triangles`, output: String(total) };
      };
      break;
    case 'coordinate-fold':
      rules = [`Start from the supplied point (x,y). Apply each active transform in order.`,
        `Translate: add ${seed} to x and subtract 2 from y.`,
        'At Medium and Hard, rotate the translated point 90° counterclockwise: (x,y) → (−y,x).',
        'At Hard, reflect the rotated point across the horizontal axis: (x,y) → (x,−y).'];
      entry = (n) => {
        const x = n - 5, y = seed - n;
        let a = x + seed, b = y - 2;
        if (depth >= 2) [a, b] = [-b, a];
        if (depth === 3) b = -b;
        return { input: `(${x}, ${y})`, output: `(${a}, ${b})` };
      };
      break;
    case 'clock-jumps':
      rules = ['Use a 24-hour clock; wrap after 23:59. Only the clock time matters.',
        'Add the stated duration to the input time.',
        'At Medium and Hard, also add a 15-minute stop for each full hour in the original duration.',
        'At Hard, convert the result to a clock two hours behind by subtracting 120 minutes.'];
      entry = (n) => {
        const start = 1320 + n * 13, duration = seed * 10 + n * 17;
        const end = start + duration + (depth >= 2 ? Math.floor(duration / 60) * 15 : 0) - (depth === 3 ? 120 : 0);
        return { input: `${clock(start)} + ${duration} min`, output: clock(end) };
      };
      break;
    case 'letter-grid':
      rules = [`Rows r and columns c are numbered from 1. A=0, B=1, …, Z=25; wrap after Z. Base = ${seed}.`,
        'The cell letter has index base + (r − 1) + (c − 1).',
        'At Medium and Hard, count each row step twice: base + 2 × (r − 1) + (c − 1).',
        'At Hard, also add (r − 1) × (c − 1) to that index.'];
      entry = (n) => {
        const r = Math.floor((n - 1) / 3) + 1, c = (n - 1) % 3 + 1;
        return { input: `r=${r}, c=${c}`, output: letter(seed + (depth >= 2 ? 2 : 1) * (r - 1) + c - 1 + (depth === 3 ? (r - 1) * (c - 1) : 0)) };
      };
      break;
    case 'sorting-network':
      rules = ['Each input is an unordered list of five numbers.',
        'Sort all numbers in ascending order, keeping duplicates.',
        'At Medium and Hard, place odd numbers first, then even numbers; sort each group ascending.',
        'At Hard, also remove duplicates so each distinct number appears once.'];
      entry = (n) => {
        const input = [seed + n, n + 2, seed + n, n * 2, n + 1];
        const output = depth === 3 ? [...new Set(input)] : [...input];
        output.sort((a, b) => (depth >= 2 ? (b % 2) - (a % 2) : 0) || a - b);
        return { input: input.join(', '), output: output.join(', ') };
      };
      break;
  }
  const wrongOutput = (value) => {
    if (family === 'rotation-compass') return ({ '↑': '→', '→': '↓', '↓': '←', '←': '↑' })[value];
    if (family === 'mirror-code' || family === 'letter-grid') return letter(alphabet.indexOf(value[0]) + 1) + value.slice(1);
    if (family === 'binary-overlay') return (value[0] === '0' ? '1' : '0') + value.slice(1);
    if (family === 'clock-jumps') {
      const [hour, minute] = value.split(':').map(Number);
      return clock(hour * 60 + minute + 5);
    }
    return value.replace(/-?\d+/, (number) => String(Number(number) + 1));
  };
  const display = ({ input, output }) => `${input} ⇒ ${output}`;
  const details = Array.from({ length: 9 }, (_, index) => {
    const sample = entry(index + 1);
    const expectedValue = display(sample);
    return {
      id: `${family}-${index + 1}`, label: `Clue ${index + 1}`,
      expectedValue, incorrectValue: display({ ...sample, output: wrongOutput(sample.output) }),
      correction: `For ${sample.input}, the correct result is ${sample.output}.`,
    };
  });
  return {
    family, title: PATTERN_GAME_NAMES[family],
    puzzle: { type: family, visual: false, legend: 'Mark every result that breaks the learned rules. Inputs are always correct.' },
    overview: `Check each ${PATTERN_GAME_NAMES[family].toLowerCase()} clue independently. Apply the rules for ${level}.`,
    ruleSteps: rules,
    example: {
      valid: { label: 'Valid clue', value: details[0].expectedValue },
      anomaly: { label: 'Broken clue', value: details[0].incorrectValue },
      explanation: `${details[0].correction} The broken example changes that result.`,
    },
    details,
  };
}
