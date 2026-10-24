// "Example" notes for History charts: how a chart's number is worked out, shown with a small worked example,
// how that example appears in the chart, and what different results can mean. Simple words, one idea per bullet.

const round1 = (value) => Math.round(value * 10) / 10;
const sum = (values) => values.reduce((total, value) => total + value, 0);

// Each kind is one formula. `inputs` is the small worked example; `compute` is the formula itself, so the
// example's result is always worked out by the same rule the chart uses.
export const EXAMPLE_KINDS = Object.freeze({
  rate: {
    formula: 'Right answers ÷ tries × 100',
    inputs: { right: 8, tries: 10 },
    compute: ({ right, tries }) => (right / tries) * 100,
    steps: ({ right, tries }, result) => [`You tried ${tries} questions in one group, and ${right} were right.`, `${right} ÷ ${tries} = ${right / tries}.`, `${right / tries} × 100 = ${round1(result)}%.`],
    unit: '%',
  },
  'win-rate': {
    formula: 'Wins ÷ games × 100',
    inputs: { right: 3, tries: 5 },
    compute: ({ right, tries }) => (right / tries) * 100,
    steps: ({ right, tries }, result) => [`You played ${tries} games in one group and won ${right}.`, `${right} ÷ ${tries} = ${right / tries}.`, `${right / tries} × 100 = ${round1(result)}%.`],
    unit: '%',
  },
  'mean-percent': {
    formula: 'Add up each try\'s score (as a %) ÷ number of tries',
    inputs: { values: [100, 50, 75] },
    compute: ({ values }) => sum(values) / values.length,
    steps: ({ values }, result) => [`Three tries scored ${values.join('%, ')}%. Part credit counts, so a half-right try is 50%.`, `${values.join(' + ')} = ${sum(values)}.`, `${sum(values)} ÷ ${values.length} = ${round1(result)}%.`],
    unit: '%',
  },
  mean: {
    formula: 'Add up the amount from each try ÷ number of tries',
    inputs: { values: [2, 0, 4] },
    compute: ({ values }) => sum(values) / values.length,
    steps: ({ values }, result) => [`Three tries had ${values.join(', ')}.`, `${values.join(' + ')} = ${sum(values)}.`, `${sum(values)} ÷ ${values.length} = ${round1(result)}.`],
    unit: '',
  },
  time: {
    formula: 'Add up the seconds of each answer ÷ number of timed answers',
    inputs: { values: [6, 8, 10] },
    compute: ({ values }) => sum(values) / values.length,
    steps: ({ values }, result) => [`Three answers took ${values.join(' s, ')} s.`, `${values.join(' + ')} = ${sum(values)} s.`, `${sum(values)} ÷ ${values.length} = ${round1(result)} s.`],
    unit: ' s',
  },
  count: {
    formula: 'Count the tries in the group',
    inputs: { values: [1, 1, 1] },
    compute: ({ values }) => values.length,
    steps: ({ values }, result) => [`${values.length} tries belong to one group (for example, one day).`, `Count them: ${result}.`],
    unit: '',
  },
  'error-rate': {
    formula: 'Mistakes ÷ chances to make that mistake × 100',
    inputs: { mistakes: 3, chances: 20 },
    compute: ({ mistakes, chances }) => (mistakes / chances) * 100,
    steps: ({ mistakes, chances }, result) => [`A part of the answer came up ${chances} times (${chances} chances), and ${mistakes} of those were wrong.`, `${mistakes} ÷ ${chances} = ${mistakes / chances}.`, `${mistakes / chances} × 100 = ${round1(result)}%.`],
    unit: '%',
  },
  'false-flag': {
    formula: 'Times you marked a problem that was not there ÷ times it was not there × 100',
    inputs: { mistakes: 2, chances: 20 },
    compute: ({ mistakes, chances }) => (mistakes / chances) * 100,
    steps: ({ mistakes, chances }, result) => [`A problem type was missing from ${chances} cases.`, `You marked it anyway ${mistakes} times.`, `${mistakes} ÷ ${chances} × 100 = ${round1(result)}%.`],
    unit: '%',
  },
  'percentage-error': {
    formula: 'Distance from the right number ÷ the right number × 100',
    inputs: { right: 20, given: 18 },
    compute: ({ right, given }) => (Math.abs(given - right) / right) * 100,
    steps: ({ right, given }, result) => [`The right answer was ${right}. You answered ${given}.`, `The distance is ${Math.abs(given - right)}.`, `${Math.abs(given - right)} ÷ ${right} × 100 = ${round1(result)}%.`],
    unit: '%',
  },
  wpm: {
    formula: 'Correct characters ÷ 5 ÷ minutes',
    inputs: { characters: 250, minutes: 1 },
    compute: ({ characters, minutes }) => characters / 5 / minutes,
    steps: ({ characters, minutes }, result) => [`You typed ${characters} correct characters in ${minutes} minute.`, 'One "word" counts as 5 characters.', `${characters} ÷ 5 ÷ ${minutes} = ${round1(result)} WPM.`],
    unit: ' WPM',
  },
  'character-accuracy': {
    formula: 'Characters that match the prompt ÷ characters in the prompt × 100',
    inputs: { right: 95, tries: 100 },
    compute: ({ right, tries }) => (right / tries) * 100,
    steps: ({ right, tries }, result) => [`The prompt had ${tries} characters, and ${right} of yours matched.`, `${right} ÷ ${tries} × 100 = ${round1(result)}%.`],
    unit: '%',
  },
  'run-value': {
    formula: 'Each point is the number saved for one run',
    inputs: { values: [120] },
    compute: ({ values }) => values[0],
    steps: ({ values }) => [`One Multitasker run ended with ${values[0]}.`, 'Nothing is averaged: the point is that run\'s own number.'],
    unit: '',
  },
  scatter: {
    formula: 'Across = average answer seconds; up = right answers ÷ tries × 100',
    inputs: { right: 8, tries: 10, values: [5, 6, 7] },
    compute: ({ right, tries }) => (right / tries) * 100,
    steps: ({ right, tries, values }, result) => [`At one level you tried ${tries} questions and ${right} were right: ${right} ÷ ${tries} × 100 = ${round1(result)}%.`, `Your answers took ${values.join(' s, ')} s: (${values.join(' + ')}) ÷ ${values.length} = ${round1(sum(values) / values.length)} s.`],
    unit: '%',
  },
  share: {
    formula: 'Answers that ended this way ÷ all answers × 100',
    inputs: { right: 15, tries: 20 },
    compute: ({ right, tries }) => (right / tries) * 100,
    steps: ({ right, tries }, result) => [`You gave ${tries} answers, and ${right} were right.`, `${right} ÷ ${tries} × 100 = ${round1(result)}%.`],
    unit: '%',
  },
});

const DIRECTION_LOWER = new Set(['time', 'error-rate', 'false-flag', 'percentage-error']);
const LOWER_IS_BETTER_IDS = new Set(['chess-mistakes', 'chess-late', 'fraud-false-flags']);

/** Which formula a chart uses. */
export function exampleKind(spec) {
  const id = String(spec?.id ?? '');
  const metric = spec?.series?.[0]?.metric ?? 'accuracy';
  const points = spec?.series?.[0]?.points ?? [];
  const mean = points.some((point) => point?.measure === 'mean');
  if (id === 'outcomes') return 'share';
  if (id === 'speed-vs-accuracy' || spec?.kind === 'scatter') return 'scatter';
  if (id === 'fraud-false-flags') return 'false-flag';
  if (id.startsWith('chess-') && metric === 'accuracy') return 'win-rate';
  if (id.startsWith('overload-') && spec?.kind === 'line' && ['score', 'duration', 'tasks'].includes(metric)) return 'run-value';
  if (metric === 'time') return 'time';
  if (metric === 'error-rate') return 'error-rate';
  if (metric === 'percentage-error') return 'percentage-error';
  if (metric === 'WPM') return 'wpm';
  if (metric === '%') return 'character-accuracy';
  if (['score', 'duration', 'tasks'].includes(metric)) return 'run-value';
  if (['attempts', 'count'].includes(metric)) return mean ? 'mean' : 'count';
  if (['cents', 'digits', 'actions', 'selections'].includes(metric)) return 'mean';
  return mean ? 'mean-percent' : 'rate';
}

const lowerIsBetter = (spec, kind) => DIRECTION_LOWER.has(kind) || LOWER_IS_BETTER_IDS.has(spec?.id)
  || ['cents', 'digits', 'selections'].includes(spec?.series?.[0]?.metric);

function inChartLines(spec, kind, result, unit) {
  const value = `${round1(result)}${unit}`;
  if (kind === 'scatter') return [`That level is one dot: ${round1(EXAMPLE_KINDS.scatter.inputs.values.reduce((a, b) => a + b, 0) / 3)} s across and ${value} up.`, 'Each other level gets its own dot.'];
  if (kind === 'share') return [`The "Correct" piece of the bar would fill ${value} of its width.`, 'All the pieces together fill the whole bar (100%).'];
  if (spec?.kind === 'line') return [`One point would sit at ${value}.`, spec?.id?.startsWith('overload-') || spec?.id?.startsWith('typing-') || spec?.id?.startsWith('chess-') || spec?.id?.startsWith('hold-')
    ? 'Each point is one run, test, or game, oldest on the left.' : 'Each point is one day of practice, oldest on the left.'];
  return [`That group's bar would reach ${value}.`, 'The number at the end of the bar is this value, with the tries it is based on.'];
}

function readingLines(spec, kind) {
  if (kind === 'count') return ['A tall bar: this happened often.', 'A short bar: this happened rarely.', 'Few tries in total: patterns can still change a lot.'];
  if (kind === 'share') return ['A wide "Correct" piece: most answers were right.', 'A wide "Timed out" piece: speed is the problem, not knowledge.', 'A wide "Incorrect" piece: slow down and check your work.'];
  if (kind === 'scatter') return ['A dot up and to the left: fast and right. This is the best spot.', 'A dot low and to the right: slow and often wrong. That level is too hard for now.', 'A dot high but far right: right, but slow. Work on speed.'];
  const lower = lowerIsBetter(spec, kind);
  const good = lower ? 'low' : 'high';
  const bad = lower ? 'high' : 'low';
  if (spec?.kind === 'line') return [
    `A line moving toward the ${lower ? 'bottom' : 'top'}: you are getting better.`,
    'A flat line: you are holding steady. Try a harder setting to grow.',
    `A line moving toward the ${lower ? 'top' : 'bottom'}: results are slipping. You may be tired or rushing.`,
    'One odd point means little; look at many points together.',
  ];
  return [
    `A ${good} bar: you do well in that group.`,
    `A ${bad} bar: that group needs practice.`,
    'Bars about the same height: this condition does not change your result much.',
    'A bar from fewer than 5 tries can jump a lot with the next try.',
  ];
}

/** The chart's own data, worked through the same formula, for the group with the most tries. */
function fromYourData(spec, kind) {
  const points = (spec?.series?.[0]?.points ?? []).filter((point) => Number.isFinite(point?.value));
  if (!points.length) return null;
  const point = points.reduce((best, item) => ((item.count ?? 0) > (best.count ?? 0) ? item : best));
  if (['rate', 'win-rate', 'scatter'].includes(kind) && Number.isFinite(point.correct) && point.count > 0) {
    const value = EXAMPLE_KINDS.rate.compute({ right: point.correct, tries: point.count });
    const rounded = Math.abs(round1(value) - point.value) >= 0.05 ? ` The chart rounds this to ${point.value}%.` : '';
    return { point, value, text: `From your chart: "${point.label}" has ${Number(point.correct.toFixed(2))} right of ${point.count}, so ${Number(point.correct.toFixed(2))} ÷ ${point.count} × 100 = ${round1(value)}%.${rounded}` };
  }
  if (kind === 'error-rate' && Number.isFinite(point.detail?.errors) && point.detail?.opportunities > 0) {
    const value = EXAMPLE_KINDS['error-rate'].compute({ mistakes: point.detail.errors, chances: point.detail.opportunities });
    return { point, value, text: `From your chart: "${point.label}" had ${point.detail.errors} mistakes in ${point.detail.opportunities} chances, so ${point.detail.errors} ÷ ${point.detail.opportunities} × 100 = ${round1(value)}%.` };
  }
  const unit = EXAMPLE_KINDS[kind]?.unit ?? '';
  return { point, value: point.value, text: `From your chart: "${point.label}" shows ${round1(point.value)}${unit}${point.count ? ` from ${point.count} ${point.count === 1 ? 'try' : 'tries'}` : ''}.` };
}

/** Example for one chart spec: { kind, formula, result, steps, inChart, readings, yours }. */
export function chartExample(spec) {
  const kind = exampleKind(spec);
  const definition = EXAMPLE_KINDS[kind];
  const result = definition.compute(definition.inputs);
  const yours = fromYourData(spec, kind);
  return {
    kind, formula: definition.formula, result,
    steps: definition.steps(definition.inputs, result),
    inChart: inChartLines(spec, kind, result, definition.unit),
    readings: readingLines(spec, kind),
    yours,
  };
}

/** Example for the two summary charts at the top of History. */
export function summaryChartExample(id, summary) {
  const spec = id === 'outcomes' ? { id, series: [{ metric: 'accuracy', points: [] }] }
    : { id, kind: 'bar', series: [{ metric: 'accuracy', points: (summary?.byDifficulty ?? []).filter((level) => level.answered > 0).map((level) => ({
      key: level.level, label: level.level, value: level.accuracyPercent,
      ...(level.totalPoints !== undefined ? { measure: 'mean', count: level.scoredAttempts } : { correct: level.correct, count: level.answered }),
    })) }] };
  const example = chartExample(spec);
  if (id === 'outcomes' && summary?.answered) {
    const value = EXAMPLE_KINDS.share.compute({ right: summary.correct, tries: summary.answered });
    example.yours = { value, text: `From your chart: ${summary.correct} right of ${summary.answered}, so ${summary.correct} ÷ ${summary.answered} × 100 = ${round1(value)}%.` };
  }
  return example;
}

function section(title, lines) {
  const heading = document.createElement('p');
  heading.className = 'chart-example-title';
  heading.textContent = title;
  const list = document.createElement('ul');
  list.className = 'plain-bullets';
  for (const line of lines) {
    const item = document.createElement('li');
    item.textContent = line;
    list.append(item);
  }
  return [heading, list];
}

/** An "Example" toggle, closed by default. */
export function createExample(example) {
  const details = document.createElement('details');
  details.className = 'chart-example';
  const summary = document.createElement('summary');
  summary.innerHTML = '<span class="explanation-icon" aria-hidden="true">e</span>';
  summary.append(document.createTextNode('Example'));
  details.append(summary,
    ...section('How the number is worked out', [`Rule: ${example.formula}.`, ...example.steps]),
    ...section('How this example shows in the chart', [...example.inChart, ...(example.yours ? [example.yours.text] : [])]),
    ...section('What different results can mean', example.readings));
  return details;
}
