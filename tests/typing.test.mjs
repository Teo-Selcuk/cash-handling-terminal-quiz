import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTypingSettings, createTypingPrompt, scoreTyping, summarizeTyping } from '../typing-core.mjs';
import { normalizeHistoryRecord, filterHistory, buildChartSpecs } from '../progress-analytics.mjs';
import { toCsv } from '../quiz-core.mjs';

test('typing overrides validate limits and presets increase the challenge', () => {
  assert.ok(resolveTypingSettings('Hard').characters > resolveTypingSettings('Easy').characters);
  assert.equal(resolveTypingSettings('Easy', { characters: 17, seconds: 5 }).characters, 17);
  for (const overrides of [{ characters: 0 }, { characters: 501 }, { seconds: 2 }, { seconds: NaN }, { mode: 'other' }]) {
    assert.throws(() => resolveTypingSettings('Easy', overrides));
  }
});
test('prompts have exact character counts across difficulty and content modes', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard']) for (const mode of ['words', 'phrases', 'random']) {
    for (const characters of [1, 7, 40, 500]) {
      const settings = resolveTypingSettings(difficulty, { mode, characters });
      const prompt = createTypingPrompt(settings, () => 0.95);
      assert.equal(prompt.length, characters);
      assert.ok(!prompt.endsWith(' '));
      if (mode === 'random' && difficulty === 'Hard') assert.match(prompt, /[^a-z]/);
    }
  }
});
test('case, spaces, punctuation, omissions and extra characters count', () => {
  assert.equal(scoreTyping('Hi !', 'Hi !', 2).correct, true);
  assert.equal(scoreTyping('Hi !', 'hi !', 2).correct, false);
  assert.equal(scoreTyping('abcd', 'abXd', 4).accuracyPercent, 75);
  assert.equal(scoreTyping('abcd', 'ab', 4).missingCharacters, 2);
  assert.equal(scoreTyping('abcd', 'abcde', 4).extraCharacters, 1);
  assert.equal(scoreTyping('abcd', '', 4).accuracyPercent, 0);
  const score = scoreTyping('hello', 'hello', 30);
  assert.equal(score.cpm, 10); assert.equal(score.wpm, 2);
});
test('typing history survives normalization, filtering and chart generation', () => {
  const row = { game: 'typing', gameType: 'Typing speed', timestamp: '2026-10-01T12:00:00Z', outcome: 'Correct', difficulty: 'Easy', timeUsedSeconds: 30, typingMode: 'words', typingCharacters: 5, ...scoreTyping('hello', 'hello', 30) };
  assert.equal(normalizeHistoryRecord(row).gameName, 'Typing speed');
  assert.equal(filterHistory([row, { ...row, game: 'cash' }], { game: 'typing' }).length, 1);
  assert.ok(buildChartSpecs([row], 'typing').some(chart => chart.id === 'typing-speed'));
  const summary = summarizeTyping([row, { ...row, outcome: 'Not answered', wpm: 999 }]);
  assert.equal(summary.rounds, 1); assert.equal(summary.wpm, 2);
  assert.match(toCsv([row]), /typingMode/);
  assert.equal(filterHistory([row], { game: 'typing', typing: { modes: ['random'] } }).length, 0);
  assert.equal(filterHistory([row], { game: 'typing', typing: { characters: { min: 6 } } }).length, 0);
});
