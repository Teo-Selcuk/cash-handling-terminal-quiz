import test from 'node:test';
import assert from 'node:assert/strict';
import { chartExplanation, summaryChartExplanation, tableExplanation } from '../history-explanations.mjs';
import { buildChartSpecs } from '../progress-analytics.mjs';
import { chessChartSpecs } from '../chess-analytics.mjs';
import { generateSampleHistory, generateSampleChessHistory } from '../sample-history.mjs';

const JARGON = /wilson|stratum|strata|variance|regression|confidence|heuristic|normaliz|eligible|ordinal/i;
const sentences = (text) => text.split(/(?<=[.!?])\s+/).filter(Boolean).length;

test('every chart on every game page has a short plain-language explanation', () => {
  const history = generateSampleHistory({ seed: 3 });
  const specs = ['all', 'cash', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing', 'overload'].flatMap((game) => buildChartSpecs(history, game));
  const chess = generateSampleChessHistory?.({ seed: 3 });
  if (chess) specs.push(...chessChartSpecs(chess.games ?? [], chess.lessons ?? []));
  assert.ok(specs.length > 40);
  for (const spec of specs) {
    const { what, terms } = chartExplanation(spec);
    assert.ok(what.length > 10, `${spec.id} has text`);
    assert.ok(sentences(what) <= 2, `${spec.id}: one to two sentences`);
    assert.ok(terms.length >= 1, `${spec.id}: explains its metric`);
    assert.doesNotMatch(`${what} ${terms.flat().join(' ')}`, JARGON, `${spec.id}: simple words`);
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
  assert.equal(terms.length, 8);
  assert.doesNotMatch(terms.flat().join(' '), JARGON);
});
