import test from 'node:test';
import assert from 'node:assert/strict';
import { chartExplanation, summaryChartExplanation, tableExplanation } from '../history-explanations.mjs';
import { buildChartSpecs, buildErrorAnalytics, buildAdvancedErrorAnalytics } from '../progress-analytics.mjs';
import { chessChartSpecs } from '../chess-analytics.mjs';
import { generateSampleHistory, generateSampleChessHistory } from '../sample-history.mjs';

const JARGON = /wilson|stratum|strata|variance|regression|confidence|heuristic|normaliz|eligible|ordinal/i;
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean).length;

test('every chart on every game page has a full plain-language explanation and reads its numbers', () => {
  const history = generateSampleHistory({ seed: 3 });
  const specs = ['all', 'cash', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing', 'overload'].flatMap((game) => buildChartSpecs(history, game));
  const chess = generateSampleChessHistory?.({ seed: 3 });
  if (chess) specs.push(...chessChartSpecs(chess.games ?? [], chess.lessons ?? []));
  assert.ok(specs.length > 40);
  for (const spec of specs) {
    const { what, how, terms, reading } = chartExplanation(spec);
    assert.ok(sentences(what) >= 3, `${spec.id}: explains what, why, and what to look for`);
    assert.ok(how.length > 20, `${spec.id}: says how to read it`);
    assert.ok(terms.length >= 1, `${spec.id}: explains its metric`);
    assert.ok(reading.length >= 1, `${spec.id}: reads the numbers`);
    for (const line of reading) assert.doesNotMatch(line, /NaN|undefined|Infinity/, `${spec.id}: ${line}`);
    assert.doesNotMatch(`${what} ${how} ${terms.flat().join(' ')} ${reading.join(' ')}`, JARGON, `${spec.id}: simple words`);
  }
});

test('summary charts explain each outcome and the accuracy label', () => {
  const outcomes = summaryChartExplanation('outcomes');
  assert.deepEqual(outcomes.terms.map(([term]) => term), ['Correct', 'Incorrect', 'Timed out', 'Not answered']);
  assert.match(outcomes.terms.find(([term]) => term === 'Timed out')[1], /timer ran out/);
  assert.match(outcomes.terms.find(([term]) => term === 'Not answered')[1], /left before answering/);
  assert.ok(summaryChartExplanation('accuracy-by-difficulty').terms.some(([term, meaning]) => term === 'Accuracy (%)' && /how many were right/.test(meaning)));
});

test('tables explain the columns they show', () => {
  const { what, terms } = tableExplanation('Attempts', ['When', 'Game', 'Level', 'Result', 'Time', 'Expected', 'Raw-input mistakes', 'Numeric error']);
  assert.match(what, /each row is one record/);
  assert.match(what, /start minimized/);
  assert.equal(terms.length, 8);
  assert.doesNotMatch(terms.flat().join(' '), JARGON);
});

test('readings judge trends and groups in the right direction', () => {
  const line = (metric, values) => ({ id: 'x', kind: 'line', series: [{ metric, points: values.map((value, i) => ({ label: `d${i}`, value, count: 1 })) }] });
  assert.match(chartExplanation(line('accuracy', [50, 55, 60, 80, 85, 90])).reading.join(' '), /real improvement/);
  assert.match(chartExplanation(line('time', [5, 5, 5, 9, 9, 9])).reading.join(' '), /worse than when you started/);
  assert.match(chartExplanation(line('time', [9, 9, 9, 5, 5, 5])).reading.join(' '), /real improvement/);
  const bars = { id: 'cash-due-band', kind: 'bar', series: [{ metric: 'accuracy', points: [{ label: 'Small', value: 95, count: 40 }, { label: 'Large', value: 60, count: 3 }] }] };
  const reading = chartExplanation(bars).reading.join(' ');
  assert.match(reading, /Best: "Small"/);
  assert.match(reading, /Practice "Large"/);
  assert.match(reading, /fewer than 5 tries/);
  assert.match(chartExplanation({ id: 'fraud-false-flags', kind: 'bar', series: [{ metric: 'accuracy', points: [{ label: 'a', value: 2, count: 50 }, { label: 'b', value: 30, count: 50 }] }] }).reading.join(' '), /Best: "a"/);
});

test('summary readings use the current totals', () => {
  const summary = { answered: 10, correct: 6, outcomes: [{ key: 'correct', label: 'Correct', count: 6 }, { key: 'timedOut', label: 'Timed out', count: 3 }, { key: 'incorrect', label: 'Incorrect', count: 1 }],
    byDifficulty: [{ level: 'Easy', answered: 8, accuracyPercent: 92 }, { level: 'Hard', answered: 2, accuracyPercent: 0 }] };
  assert.match(summaryChartExplanation('outcomes', summary).reading.join(' '), /6 of 10.*Timed out.*speed/);
  assert.match(summaryChartExplanation('accuracy-by-difficulty', summary).reading.join(' '), /90% on: Easy.*Hard has fewer than 5/);
});

test('error analysis charts each have their own explanation, not the generic one', () => {
  const history = generateSampleHistory({ seed: 3 });
  const specs = [...Object.values(buildErrorAnalytics(history).charts), ...buildAdvancedErrorAnalytics(history).charts];
  assert.ok(specs.length > 20);
  for (const spec of specs) {
    const { what, reading } = chartExplanation(spec);
    assert.ok(!what.startsWith(spec.title), `${spec.id}: has a specific explanation`);
    assert.ok(sentences(what) >= 3, `${spec.id}: full explanation`);
    assert.ok(reading.length >= 1, `${spec.id}: reads the numbers`);
    for (const line of reading) assert.doesNotMatch(line, /NaN|undefined|Infinity/, `${spec.id}: ${line}`);
    assert.doesNotMatch(what, JARGON, `${spec.id}: simple words`);
  }
});
