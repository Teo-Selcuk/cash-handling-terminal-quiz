import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastRatio, relativeLuminance, resolveLabelColor, readableColor, THEME_COLORS, MIN_LABEL_CONTRAST } from '../chart-contrast.mjs';
import { chartExample, summaryChartExample, exampleKind, EXAMPLE_KINDS } from '../chart-examples.mjs';
import { chartFitsGame, chartGameTag, GAME_LABELS } from '../chart-games.mjs';
import { numpadChoice, isTextEntry, CASH_NUMPAD_KEYS } from '../numpad-shortcuts.mjs';
import {
  buildProjection, projectionRows, chessProjectionRows, linearFit, effectiveAttempts, measureTrend, projectMeasure, attemptsToReach,
  PROJECTION_HORIZONS, PROJECTION_LIMITS,
} from '../progress-projection.mjs';
import { buildChartSpecs, buildAdvancedErrorAnalytics, buildErrorAnalytics } from '../progress-analytics.mjs';
import { chessChartSpecs } from '../chess-analytics.mjs';
import { generateSampleHistory, generateSampleChessHistory } from '../sample-history.mjs';

const root = new URL('../', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
const GAMES = ['cash', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing', 'overload'];
const DAY = 86400000;

// ---- Chart labels and Appearance ----

test('Accuracy by difficulty numbers are white in the dark theme and dark in the light theme, with readable contrast', () => {
  const dark = resolveLabelColor({ labelColor: 'auto' }, 'dark');
  const light = resolveLabelColor({ labelColor: 'auto' }, 'light');
  assert.ok(relativeLuminance(dark) > 0.85, `dark theme label ${dark} is white`);
  assert.ok(relativeLuminance(light) < 0.05, `light theme label ${light} is dark`);
  for (const background of THEME_COLORS.dark.backgrounds) assert.ok(contrastRatio(dark, background) >= MIN_LABEL_CONTRAST);
  for (const background of THEME_COLORS.light.backgrounds) assert.ok(contrastRatio(light, background) >= MIN_LABEL_CONTRAST);
  // The labels match the other chart text: the theme's own ink color.
  const css = read('style.css');
  assert.match(css, /:root\[data-theme="dark"\] \{[^}]*--ink: #edf5f2/);
  assert.equal(dark, '#edf5f2');
});

test('every Appearance label color stays readable in both themes, even a dark custom color or a label background', () => {
  const choices = [{ labelColor: 'auto' }, { labelColor: 'ink' }, { labelColor: 'blue' }, { labelColor: 'purple' }, { labelColor: 'red' },
    { labelColor: 'custom', customColor: '#176b83' }, { labelColor: 'custom', customColor: '#000000' }, { labelColor: 'custom', customColor: '#ffffff' },
    { labelColor: 'auto', labelBackground: true, backgroundColor: '#17383a' }, { labelColor: 'custom', customColor: '#203040', labelBackground: true, backgroundColor: '#101820' }];
  for (const theme of ['light', 'dark']) {
    for (const settings of choices) {
      const color = resolveLabelColor(settings, theme);
      const backgrounds = settings.labelBackground ? [settings.backgroundColor] : THEME_COLORS[theme].backgrounds;
      for (const background of backgrounds) assert.ok(contrastRatio(color, background) >= MIN_LABEL_CONTRAST, `${theme} ${JSON.stringify(settings)} -> ${color} on ${background}`);
    }
  }
  // A readable choice is kept as it is; nothing is hard-coded to one color.
  assert.equal(readableColor('#0754a8', THEME_COLORS.light.backgrounds), '#0754a8');
  assert.notEqual(resolveLabelColor({ labelColor: 'red' }, 'dark'), resolveLabelColor({ labelColor: 'blue' }, 'dark'));
});

test('changing the label color in Appearance updates the Accuracy by difficulty chart', () => {
  const app = read('app.js');
  const css = read('style.css');
  assert.match(app, /applyChartAppearance\(accuracyCard, 'accuracy-by-difficulty'\)/);
  assert.match(app, /setProperty\('--chart-label-color', resolveLabelColor\(settings, document\.documentElement\.dataset\.theme\)\)/);
  assert.match(css, /\.visual-card \.bar-chart-value \{ color: var\(--chart-label-color/);
  assert.match(css, /\.analytics-svg \.chart-value-label \{ fill: var\(--chart-label-color/);
  // Switching theme works the label colors out again for every chart on the page.
  assert.match(app, /querySelectorAll\('\[data-appearance-id\]'\)\.forEach\(\(element\) => applyChartAppearance/);
  const red = resolveLabelColor({ labelColor: 'red' }, 'light');
  assert.notEqual(red, resolveLabelColor({ labelColor: 'auto' }, 'light'));
  assert.equal(red, THEME_COLORS.light.red);
  assert.match(app, /value\.textContent = accuracyLevelText\(level\)/);
  assert.match(app, /`\$\{level\.accuracyPercent\}% \(\$\{level\.correct\} of \$\{level\.answered\} correct\)`/);
});

test('no chart label is hard-coded to a dark text color', () => {
  const css = read('style.css');
  const rules = css.match(/[^{}]*(?:chart|bar-chart)[^{}]*\{[^}]*\}/g) ?? [];
  for (const rule of rules) assert.doesNotMatch(rule, /(?:^|[;{\s])color:\s*#(?:0|1|2)[0-9a-f]{5}/i, rule.slice(0, 120));
});

// ---- Digit and arithmetic analysis ----

test('the digit and arithmetic section uses short bullets, hides empty table headings, and wraps inside its card', () => {
  const app = read('app.js');
  const css = read('style.css');
  const start = app.indexOf('function renderAdvancedErrorAnalysis');
  const body = app.slice(start, app.indexOf('function renderHistoryInsights', start));
  assert.doesNotMatch(body, /Digit offsets are compared/, 'the long right-aligned paragraph is gone');
  assert.doesNotMatch(body, /className = 'chart-note'/, 'no right-aligned paragraph notes');
  assert.ok((body.match(/bulletList\(/g) ?? []).length >= 4, 'notes are bullet lists');
  assert.match(body, /section\.className = 'table-slot-section'/);
  assert.match(css, /\.table-slot-section:not\(:has\(\.history-table-container\)\) \{ display: none; \}/);
  assert.match(css, /\.plain-bullets li \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /#advanced-error-analytics \{ min-width: 0; text-align: left; \}/);
  assert.match(css, /\.plain-bullets \{[^}]*text-align: left/);
});

// ---- Lists ----

test('lists on History pages are real bullets with one idea each', () => {
  const app = read('app.js');
  const explanations = read('history-explanations.mjs');
  assert.doesNotMatch(explanations, /createElement\('dl'\)/, 'term lists are bullets, not definition lists');
  assert.match(explanations, /list\.className = 'explanation-terms'/);
  const insights = app.slice(app.indexOf('function renderHistoryInsights'), app.indexOf('function currentComparison'));
  assert.doesNotMatch(insights, /createElement\('p'\)/, 'insight results are bullets, not paragraphs');
  assert.match(insights, /bulletList\(/);
  const bullets = [...app.matchAll(/bulletList\(\[([\s\S]*?)\]/g)].map((match) => match[1]);
  assert.ok(bullets.length >= 8);
  const css = read('style.css');
  assert.match(css, /\.plain-bullets \{[^}]*list-style: disc outside/);
});

// ---- Example button ----

const sampleSpecs = (() => {
  const history = generateSampleHistory({ seed: 11, now: new Date('2026-10-23T12:00:00Z') });
  const specs = ['all', ...GAMES].flatMap((game) => buildChartSpecs(history, game).map((spec) => ({ spec, game })));
  const advanced = buildAdvancedErrorAnalytics(history.filter((row) => ['memory', 'cash'].includes(row.game ?? (row.gameType === 'Number memory' ? 'memory' : 'cash'))));
  specs.push(...(advanced.charts ?? []).map((spec) => ({ spec, game: 'cash' })));
  const errors = buildErrorAnalytics(history, { comparisonDisabled: true });
  specs.push(...Object.values(errors.charts ?? {}).filter((spec) => spec?.series).map((spec) => ({ spec, game: 'all' })));
  const chess = generateSampleChessHistory({ seed: 11, now: new Date('2026-10-23T12:00:00Z') });
  specs.push(...chessChartSpecs(chess.games, chess.lessons).map((spec) => ({ spec, game: 'chess' })));
  return specs;
})();

test('every chart has an Example whose worked example uses the chart formula', () => {
  assert.ok(sampleSpecs.length > 60);
  for (const { spec } of sampleSpecs) {
    const example = chartExample(spec);
    const definition = EXAMPLE_KINDS[example.kind];
    assert.ok(definition, `${spec.id}: has a formula`);
    assert.equal(example.result, definition.compute(definition.inputs), `${spec.id}: example result comes from the formula`);
    assert.ok(example.steps.length >= 2 && example.inChart.length >= 1 && example.readings.length >= 3, `${spec.id}: shows calculation, chart link, and readings`);
    assert.doesNotMatch([...example.steps, ...example.inChart, ...example.readings].join(' '), /wilson|regression|variance|heuristic/i, `${spec.id}: simple words`);
  }
});

test('worked examples match the numbers each chart draws', () => {
  let checked = 0;
  for (const { spec } of sampleSpecs) {
    const example = chartExample(spec);
    if (!example.yours?.point) continue;
    const { point, value } = example.yours;
    if (['rate', 'win-rate', 'scatter'].includes(example.kind) && Number.isFinite(point.correct)) {
      assert.ok(Math.abs(value - point.value) <= 0.51, `${spec.id}: ${point.correct}/${point.count} gives ${value}, chart shows ${point.value}`);
      checked += 1;
    } else if (example.kind === 'error-rate' && point.detail?.opportunities) {
      assert.ok(Math.abs(value - point.value) <= 0.51, `${spec.id}: error rate ${value} vs ${point.value}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 12, `checked ${checked} charts against their own data`);
  // The fixed worked examples, by hand.
  assert.equal(EXAMPLE_KINDS.rate.compute({ right: 8, tries: 10 }), 80);
  assert.equal(EXAMPLE_KINDS.time.compute({ values: [6, 8, 10] }), 8);
  assert.equal(EXAMPLE_KINDS['error-rate'].compute({ mistakes: 3, chances: 20 }), 15);
  assert.equal(EXAMPLE_KINDS.wpm.compute({ characters: 250, minutes: 1 }), 50);
  assert.equal(EXAMPLE_KINDS['percentage-error'].compute({ right: 20, given: 18 }), 10);
});

test('formula kinds follow the chart metric', () => {
  const spec = (id, metric, extra = {}, points = []) => ({ id, series: [{ metric, points }], ...extra });
  assert.equal(exampleKind(spec('accuracy-by-difficulty', 'accuracy')), 'rate');
  assert.equal(exampleKind(spec('memory-digit-length', 'accuracy', {}, [{ measure: 'mean', value: 50 }])), 'mean-percent');
  assert.equal(exampleKind(spec('response-time-over-time', 'time', { kind: 'line' })), 'time');
  assert.equal(exampleKind(spec('attempts-per-day', 'attempts')), 'count');
  assert.equal(exampleKind(spec('speed-vs-accuracy', 'accuracy', { kind: 'scatter' })), 'scatter');
  assert.equal(exampleKind(spec('chess-difficulty', 'accuracy')), 'win-rate');
  assert.equal(exampleKind(spec('typing-speed', 'WPM', { kind: 'line' })), 'wpm');
  assert.equal(exampleKind(spec('fraud-false-flags', 'accuracy')), 'false-flag');
  const outcomes = summaryChartExample('outcomes', { answered: 20, correct: 15 });
  assert.equal(outcomes.kind, 'share');
  assert.match(outcomes.yours.text, /15 ÷ 20 × 100 = 75%/);
  const levels = summaryChartExample('accuracy-by-difficulty', { byDifficulty: [{ level: 'Easy', answered: 940, correct: 527, accuracyPercent: 56 }] });
  assert.match(levels.yours.text, /527 ÷ 940 × 100 = 56.1%/);
});

test('Example toggles start closed and sit beside "What this shows" on every chart', () => {
  const app = read('app.js');
  const examples = read('chart-examples.mjs');
  assert.match(examples, /details\.className = 'chart-example'/);
  assert.doesNotMatch(examples, /details\.open = true/);
  assert.match(app, /card\.append\(heading, chartExplanationToggle\(spec\.id, chartExplanation\(spec\)\), chartExampleToggle\(spec\.id, chartExample\(spec\)\)\)/);
  assert.match(app, /chartExplanationToggle\(id, summaryChartExplanation\(id, summary\)\), chartExampleToggle\(id, summaryChartExample\(id, summary\)\)/);
  assert.match(read('style.css'), /\.visual-card > \.explanation:not\(\[open\]\), \.visual-card > \.chart-example:not\(\[open\]\) \{ display: inline-block/);
});

// ---- Numpad ----

test('numpad / * - pick Exact, Change, and Short only during an active game and never inside a text box', () => {
  const key = (code, target = { tagName: 'BODY' }, extra = {}) => ({ code, target, ...extra });
  assert.equal(numpadChoice(key('NumpadDivide'), { active: true }), 'Exact');
  assert.equal(numpadChoice(key('NumpadMultiply'), { active: true }), 'Change');
  assert.equal(numpadChoice(key('NumpadSubtract'), { active: true }), 'Short');
  assert.equal(numpadChoice(key('NumpadSubtract'), { active: false }), null, 'nothing outside an active game');
  assert.equal(numpadChoice(key('Minus'), { active: true }), null, 'the main keyboard minus is not a shortcut');
  assert.equal(numpadChoice(key('Slash'), { active: true }), null);
  assert.equal(numpadChoice(key('NumpadDivide', { tagName: 'INPUT', type: 'text' }), { active: true }), null, 'nothing inside a text box');
  assert.equal(numpadChoice(key('NumpadDivide', { tagName: 'TEXTAREA' }), { active: true }), null);
  assert.equal(numpadChoice(key('NumpadDivide', { tagName: 'DIV', isContentEditable: true }), { active: true }), null);
  assert.equal(numpadChoice(key('NumpadDivide', { tagName: 'INPUT', type: 'radio' }), { active: true }), 'Exact', 'a focused answer choice still allows shortcuts');
  assert.equal(numpadChoice(key('NumpadDivide', undefined, { ctrlKey: true }), { active: true }), null);
  assert.equal(numpadChoice({ code: '', key: '-', location: 3, target: { tagName: 'BODY' } }, { active: true }), 'Short', 'keypad location works without a code');
  assert.equal(numpadChoice({ code: '', key: '-', location: 0, target: { tagName: 'BODY' } }, { active: true }), null);
  assert.equal(isTextEntry({ tagName: 'INPUT', type: 'number' }), true);
  assert.deepEqual(CASH_NUMPAD_KEYS, { NumpadDivide: 'Exact', NumpadMultiply: 'Change', NumpadSubtract: 'Short' });
});

test('cash answer buttons show their key hint and a help line; clicking still works', () => {
  const html = read('index.html');
  const app = read('app.js');
  for (const [value, hint] of [['Exact', 'Num /'], ['Change', 'Num \\*'], ['Short', 'Num -']]) {
    assert.match(html, new RegExp(`value="${value}"[^>]*><span>${value} <kbd class="key-hint" aria-hidden="true">${hint}</kbd></span>`));
  }
  assert.match(html, /id="cash-shortcut-help">Number keypad:/);
  assert.match(html, /No keypad\? Click a choice\./);
  assert.match(app, /state\.activeScreen === 'quiz' && state\.game === 'cash' && !state\.answerSubmitted/);
  // The radio inputs and their change listener are untouched, so clicks work as before.
  assert.match(app, /document\.querySelectorAll\('input\[name="answerType"\]'\)\.forEach\(\(input\) => input\.addEventListener\('change'/);
});

// ---- Game labels ----

test('every chart carries its game name and unfit charts are left off that game', () => {
  const app = read('app.js');
  assert.match(app, /heading\.append\(chartGameTagElement\(historyView\.filters\.game\), title, controls\)/);
  assert.match(app, /card\.querySelector\('\.chart-game-tag'\)\.textContent = chartGameTag\(historyView\.filters\.game\)/);
  assert.equal((read('index.html').match(/class="eyebrow chart-game-tag"/g) ?? []).length, 2);
  for (const game of Object.keys(GAME_LABELS)) assert.ok(chartGameTag(game).length > 2);
  assert.equal(chartGameTag('cash'), 'Cash handling');
  const history = generateSampleHistory({ seed: 5, now: new Date('2026-10-23T12:00:00Z') });
  for (const game of GAMES) {
    const ids = buildChartSpecs(history, game).filter((spec) => chartFitsGame(spec.id, game)).map((spec) => spec.id);
    assert.ok(!ids.includes('strongest-variables'), `${game}: no duplicate of Accuracy by difficulty`);
    if (game === 'typing') for (const id of ['response-time-over-time', 'speed-vs-accuracy', 'accuracy-by-response-band', 'performance-distribution']) assert.ok(!ids.includes(id), `typing: ${id} does not fit`);
    assert.ok(ids.length > 3, `${game}: keeps its fitting charts`);
  }
  assert.equal(chartFitsGame('strongest-variables', 'all'), true, 'the all-games page still compares games');
  assert.match(app, /buildChartSpecs\(records, historyView\.filters\.game\)\.filter\(\(spec\) => chartFitsGame\(spec\.id, historyView\.filters\.game\)\)/);
});

// ---- Projection ----

const startMs = Date.parse('2026-08-01T12:00:00Z');
const rowsFrom = (count, daysSpan, success, speed) => Array.from({ length: count }, (_, index) => ({
  timestampMs: startMs + (index / (count - 1)) * daysSpan * DAY, session: `s${Math.floor(index / 4)}`, level: 'Easy',
  success: success(index), speed: speed(index),
}));

test('a known trend gives the expected range', () => {
  // Answer time falls 0.1 s per attempt with no noise: 40 attempts over 28 days, 10 sessions.
  const rows = rowsFrom(40, 28, () => 100, (index) => 20 - 0.1 * index);
  const projection = buildProjection(rows, { now: startMs + 28 * DAY, unit: 's', better: 'lower' });
  assert.equal(projection.status, 'ok');
  assert.equal(projection.speedTrend.direction, 'improving');
  assert.ok(Math.abs(projection.speedTrend.level - 16.1) < 1e-9);
  const week = projection.horizons.find((horizon) => horizon.key === 'week');
  const future = 40 / 4 * (7 / 7); // 10 attempts per week
  assert.ok(Math.abs(week.future - future) < 1e-9);
  const expected = 16.1 - 0.1 * 40 * Math.log(1 + 10 / 40);
  assert.ok(Math.abs(week.speed.likely - expected) < 1e-9, `${week.speed.likely} vs ${expected}`);
  assert.ok(Math.abs(week.speed.low - expected) < 1e-9 && Math.abs(week.speed.high - expected) < 1e-9, 'a perfect line has no spread');
  assert.equal(projection.successTrend.direction, 'flat');
  assert.equal(week.success.likely, 100);
  assert.deepEqual(projection.horizons.map((horizon) => horizon.key), PROJECTION_HORIZONS.map((horizon) => horizon.key));
  assert.deepEqual(projection.horizons.map((horizon) => horizon.days), [1, 3, 7, 30, 182, 365]);
  // Progress slows: each extra week adds less than the one before.
  const gain = (days) => effectiveAttempts(10 * days / 7, 40);
  assert.ok(gain(14) - gain(7) < gain(7));
});

test('a noisy trend gives a low / likely / high range that widens with the horizon', () => {
  const rows = rowsFrom(60, 42, (index) => ((index * 7) % 10 < 6 + index / 30 ? 100 : 0), (index) => 12 + ((index * 13) % 5) - index * 0.02);
  const projection = buildProjection(rows, { now: startMs + 42 * DAY });
  for (const horizon of projection.horizons) {
    assert.ok(horizon.success.low <= horizon.success.likely && horizon.success.likely <= horizon.success.high);
    assert.ok(horizon.success.low >= 0 && horizon.success.high <= 100);
  }
  const width = (horizon) => horizon.speed.high - horizon.speed.low;
  assert.ok(width(projection.horizons.at(-1)) >= width(projection.horizons[0]));
  assert.match(projection.rangeMeaning, /8 in 10/);
  assert.deepEqual(projection.limits, PROJECTION_LIMITS);
  assert.ok(projection.limits.some((line) => /not a promise/.test(line)) && projection.limits.some((line) => /slows down/.test(line)));
});

test('too few attempts or too short a history says "Not enough data yet"; no attempts says "No attempts yet."', () => {
  assert.equal(buildProjection([]).status, 'empty');
  assert.equal(buildProjection([]).message, 'No attempts yet.');
  const few = buildProjection(rowsFrom(9, 30, () => 100, () => 5));
  assert.equal(few.status, 'insufficient');
  assert.equal(few.message, 'Not enough data yet');
  const short = buildProjection(rowsFrom(50, 10, () => 100, () => 5));
  assert.equal(short.status, 'insufficient');
  assert.match(short.detail, /50 attempts over 10 days/);
});

test('the stated pace matches the data', () => {
  const rows = rowsFrom(40, 28, () => 100, () => 8);
  const projection = buildProjection(rows, { now: startMs + 28 * DAY });
  assert.equal(projection.pace.sessionsPerWeek, 10 / 4);
  assert.equal(projection.pace.attemptsPerWeek, 40 / 4);
  assert.equal(projection.paceText, 'About 2.5 sessions per week (10 attempts per week).');
});

test('a flat or falling trend is shown honestly, not as a rising line', () => {
  const flat = buildProjection(rowsFrom(40, 28, (index) => (index % 2 ? 100 : 0), () => 8), { now: startMs + 28 * DAY });
  assert.equal(flat.successTrend.direction, 'flat');
  for (const horizon of flat.horizons) assert.ok(Math.abs(horizon.success.likely - 50) < 1e-9, 'flat stays level');
  assert.match(flat.trendText[0], /flat/);
  const falling = buildProjection(rowsFrom(40, 28, (index) => 100 - index * 2, (index) => 5 + index * 0.2), { now: startMs + 28 * DAY });
  assert.equal(falling.successTrend.direction, 'falling');
  assert.equal(falling.speedTrend.direction, 'falling');
  assert.ok(falling.horizons.at(-1).success.likely < falling.successTrend.level, 'falling success keeps falling');
  assert.ok(falling.horizons.at(-1).speed.likely > falling.speedTrend.level, 'slower answers keep slowing');
  assert.match(falling.trendText[0], /falling/);
  assert.match(falling.advice, /slipping/);
});

test('long gaps in practice are noted', () => {
  const rows = [...rowsFrom(20, 10, () => 100, () => 6), ...rowsFrom(20, 10, () => 100, () => 6).map((row) => ({ ...row, timestampMs: row.timestampMs + 40 * DAY }))];
  const projection = buildProjection(rows, { now: startMs + 80 * DAY });
  assert.ok(projection.gaps.longestDays >= 29);
  assert.ok(projection.gaps.notes.some((note) => /break of \d+ days/.test(note)));
  assert.ok(projection.gaps.notes.some((note) => /last try was \d+ days ago/.test(note)));
});

test('the goal pace and time to reach it follow the trend, and advice names the weak part', () => {
  const rows = rowsFrom(60, 42, () => 100, (index) => 20 - 0.05 * index);
  const goal = { level: 'Easy', target: 15, better: 'lower', successPercent: 90, window: 10 };
  const projection = buildProjection(rows, { now: startMs + 42 * DAY, goal });
  const trend = measureTrend(rows.map((row, index) => ({ x: index, y: row.speed })), { better: 'lower', smallChange: 0.1 });
  const needed = attemptsToReach(trend, 15, 'lower');
  assert.equal(projection.goal.attemptsForSpeed, needed);
  assert.equal(projection.goal.attemptsForSuccess, 0);
  assert.equal(projection.goal.totalAttempts, needed + 10);
  assert.ok(Math.abs(projection.goal.weeksAtCurrentPace - (needed + 10) / (60 / 6)) < 1e-9);
  assert.equal(projection.goal.attemptsPerWeekFor4Weeks, Math.ceil((needed + 10) / 4));
  assert.match(projection.advice, /^Focus on speed: accuracy is steady, but answers are slow/);
  const stuck = buildProjection(rowsFrom(40, 28, (index) => (index % 2 ? 100 : 0), () => 20), { now: startMs + 28 * DAY, goal });
  assert.equal(stuck.goal.totalAttempts, null, 'a flat trend never reaches the goal');
  assert.match(stuck.advice, /^Focus on accuracy first/);
  assert.equal(projectMeasure({ level: 10, slope: 0, slopeError: 0, residualSd: 0, used: 10, levelWindow: 10 }, 50).likely, 10);
  assert.deepEqual(linearFit([0, 1, 2], [1, 3, 5]).slope, 2);
});

test('every game builds projection rows from its own history', () => {
  const history = generateSampleHistory({ seed: 9, now: new Date('2026-10-23T12:00:00Z') });
  for (const game of GAMES) {
    const rows = projectionRows(history, game);
    assert.ok(rows.length >= 10, `${game}: has rows`);
    assert.ok(rows.every((row) => row.success >= 0 && row.success <= 100), `${game}: success is a percent`);
    assert.equal(buildProjection(rows, { now: Date.parse('2026-10-23T12:00:00Z') }).status, 'ok', `${game}: enough data in the sample`);
  }
  const chess = generateSampleChessHistory({ seed: 9, now: new Date('2026-10-23T12:00:00Z') });
  const chessRows = chessProjectionRows(chess.games);
  assert.equal(chessRows.length, chess.games.filter((game) => game.result).length);
  assert.ok(chessRows.every((row) => row.success === 0 || row.success === 100));
  const app = read('app.js');
  assert.match(app, /renderGameProjection\(history, historyView\.filters\.game\)/);
  assert.match(read('chess-ui.mjs'), /renderProjection\?\.\(el\('history-projection'\), games\)/);
});

// ---- Keypad shortcuts for the list games ----

test('list games: keypad 1–9 pick choices, "+" reaches 10–18, 0 is "nothing wrong", Enter submits', async () => {
  const { numpadListAction, listKeyHint } = await import('../numpad-shortcuts.mjs');
  const key = (code, extra = {}) => ({ code, target: { tagName: 'BUTTON' }, ...extra });
  assert.deepEqual(numpadListAction(key('Numpad3'), { active: true }), { type: 'pick', number: 3 });
  assert.deepEqual(numpadListAction(key('Numpad3'), { active: true, prefix: true }), { type: 'pick', number: 12 });
  assert.deepEqual(numpadListAction(key('NumpadAdd'), { active: true }), { type: 'prefix' });
  assert.deepEqual(numpadListAction(key('Numpad0'), { active: true }), { type: 'none' });
  assert.equal(numpadListAction(key('Numpad0'), { active: true, prefix: true }), null);
  assert.deepEqual(numpadListAction(key('NumpadEnter'), { active: true }), { type: 'submit' });
  assert.equal(numpadListAction(key('Digit3'), { active: true }), null, 'the number row is not a shortcut');
  assert.equal(numpadListAction(key('Enter'), { active: true }), null, 'the main Enter keeps its normal job');
  assert.equal(numpadListAction(key('Numpad3'), { active: false }), null, 'nothing outside an active round');
  assert.equal(numpadListAction(key('Numpad3', { target: { tagName: 'SELECT' } }), { active: true }), null, 'nothing inside a list box');
  assert.equal(numpadListAction(key('Numpad3', { target: { tagName: 'INPUT', type: 'text' } }), { active: true }), null);
  assert.deepEqual(numpadListAction({ code: '', key: '7', location: 3, target: { tagName: 'BODY' } }, { active: true }), { type: 'pick', number: 7 });
  assert.equal(listKeyHint(4), 'Num 4');
  assert.equal(listKeyHint(15), 'Num + 6');
  assert.equal(listKeyHint(19), '');
});

test('Error detection and fraud choices show keypad hints and a help line; clicks still work', () => {
  const html = read('index.html');
  const app = read('app.js');
  assert.match(html, /id="error-detection-shortcut-help">Number keypad:/);
  assert.match(html, /id="fraud-shortcut-help">Number keypad:/);
  assert.match(html, /No anomalies in this puzzle <kbd class="key-hint" aria-hidden="true">Num 0<\/kbd>/);
  assert.match(app, /if \(listKeyHint\(index \+ 1\)\) label\.append\(keyHintElement\(listKeyHint\(index \+ 1\)\)\)/);
  assert.match(app, /const hint = id === 'no-issues' \? 'Num 0' : listKeyHint\(index \+ 1\)/);
  assert.match(app, /button\.addEventListener\('click', \(\) => toggleErrorDetail\(detail\.id\)\)/);
  assert.match(app, /button\.addEventListener\('click', \(\) => toggleFraudIssue\(id\)\)/);
  assert.match(app, /!state\.answerSubmitted && !event\.target\.closest\?\.\('dialog\[open\]'\) && !document\.querySelector\('dialog\[open\]'\)/);
});
