import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUICK_ADD_PRESETS, QUICK_ADD_DENOMINATIONS, createQuickAddQuestion, resolveQuickAddSettings, scoreQuickAddAnswer,
  summarizeQuickAddRound, quickAddRecordFields, summarizeQuickAddHistory, passRuleText, goalText,
} from '../quick-add-core.mjs';

const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const cents = new Map(QUICK_ADD_DENOMINATIONS.map((item) => [item.label, item.cents]));

test('every question adds small cash values and its answer is their total', () => {
  const random = seeded(5);
  for (const difficulty of ['Easy', 'Medium', 'Hard']) for (let i = 0; i < 500; i += 1) {
    const question = createQuickAddQuestion({ difficulty, random });
    const preset = QUICK_ADD_PRESETS[difficulty];
    assert.ok(question.terms >= preset.terms[0] && question.terms <= preset.terms[1]);
    assert.equal(question.values.length, question.terms);
    assert.ok(question.values.every((value) => preset.values.includes(value)), question.expression);
    const fromText = question.expression.split(' + ').reduce((sum, label) => sum + cents.get(label), 0);
    assert.equal(question.answerCents, fromText, question.expression);
    if (difficulty === 'Hard') assert.ok(question.hasCoins, 'Hard always has a coin');
    else assert.equal(question.answerCents % 100, 0, 'Easy and Medium are whole dollars');
  }
  const easy = Array.from({ length: 200 }, () => createQuickAddQuestion({ difficulty: 'Easy', random }));
  for (const label of ['$10', '$1']) assert.ok(easy.some((q) => q.labels.includes(label)), `Easy uses ${label}`);
});

test('answers: exact cents are correct, wrong or blank is a mistake, a timeout is a mistake', () => {
  const question = { answerCents: 1625 };
  assert.equal(scoreQuickAddAnswer(question, 1625).outcome, 'Correct');
  assert.equal(scoreQuickAddAnswer(question, 1600).outcome, 'Incorrect');
  assert.equal(scoreQuickAddAnswer(question, null).outcome, 'Incorrect');
  assert.equal(scoreQuickAddAnswer(question, 1625, true).outcome, 'Timed Out');
  const round = summarizeQuickAddRound(['Timed Out'], { additions: 3 });
  assert.equal(round.mistakes, 1);
  assert.equal(round.timedOut, 1);
});

test('settings keep the chosen seconds, additions, rule and goal inside safe limits', () => {
  const settings = resolveQuickAddSettings({ difficulty: 'Medium', secondsPerQuestion: '4', additions: '12', passRule: 'min-correct', passValue: '50', goalType: 'score', goalTarget: '99' });
  assert.deepEqual(settings, { difficulty: 'Medium', secondsPerQuestion: 4, additions: 12, passRule: 'min-correct', passValue: 12, goalType: 'score', goalTarget: 12 });
  assert.equal(resolveQuickAddSettings({ secondsPerQuestion: 0 }).secondsPerQuestion, 2);
  assert.equal(resolveQuickAddSettings({ passRule: 'max-mistakes', passValue: 0 }).passValue, 0, 'zero mistakes allowed is a valid rule');
  assert.equal(resolveQuickAddSettings({ difficulty: 'Nope' }).difficulty, 'Easy');
});

test('a round counts exactly Y additions and ignores anything after', () => {
  const round = summarizeQuickAddRound(['Correct', 'Correct', 'Incorrect', 'Correct', 'Correct'], { additions: 4, passRule: 'max-mistakes', passValue: 1 });
  assert.equal(round.answered, 4);
  assert.equal(round.finished, true);
  assert.equal(round.correct, 3);
  assert.equal(round.mistakes, 1);
  assert.equal(summarizeQuickAddRound(['Correct'], { additions: 4 }).remaining, 3);
});

test('mistake-limit rule passes at the limit and fails one past it', () => {
  const rule = { additions: 5, passRule: 'max-mistakes', passValue: 2 };
  assert.equal(summarizeQuickAddRound(['Correct', 'Incorrect', 'Correct', 'Timed Out', 'Correct'], rule).passed, true);
  const failed = summarizeQuickAddRound(['Incorrect', 'Incorrect', 'Timed Out'], rule);
  assert.equal(failed.passStatus, 'failed', 'settled early once the limit is passed');
  assert.equal(failed.passed, null, 'the round is not over yet');
  assert.equal(summarizeQuickAddRound(['Incorrect', 'Incorrect', 'Timed Out', 'Correct', 'Correct'], rule).passed, false);
  assert.equal(summarizeQuickAddRound(['Correct', 'Correct'], rule).passStatus, 'on-track');
});

test('correct-target rule passes at the target and fails one short', () => {
  const rule = { additions: 5, passRule: 'min-correct', passValue: 4 };
  assert.equal(summarizeQuickAddRound(['Correct', 'Correct', 'Incorrect', 'Correct', 'Correct'], rule).passed, true);
  assert.equal(summarizeQuickAddRound(['Correct', 'Correct', 'Incorrect', 'Correct', 'Timed Out'], rule).passed, false);
  assert.equal(summarizeQuickAddRound(['Incorrect', 'Incorrect'], rule).passStatus, 'failed', 'cannot reach 4 with 3 left');
  assert.equal(summarizeQuickAddRound(['Correct', 'Correct', 'Correct', 'Correct'], rule).passStatus, 'passed');
});

test('goal progress follows the score or the best streak', () => {
  const outcomes = ['Correct', 'Correct', 'Correct', 'Incorrect', 'Correct', 'Correct'];
  const streak = summarizeQuickAddRound(outcomes, { additions: 6, goalType: 'streak', goalTarget: 4 });
  assert.equal(streak.bestStreak, 3);
  assert.equal(streak.currentStreak, 2);
  assert.equal(streak.goalValue, 3);
  assert.equal(streak.goalPercent, 75);
  assert.equal(streak.goalMet, false);
  const score = summarizeQuickAddRound(outcomes, { additions: 6, goalType: 'score', goalTarget: 5 });
  assert.equal(score.goalValue, 5);
  assert.equal(score.goalMet, true);
  assert.equal(score.goalPercent, 100);
  assert.match(goalText(score), /5 correct in the round/);
  assert.match(passRuleText({ passRule: 'max-mistakes', passValue: 1, additions: 6 }), /1 or fewer mistake in 6/);
});

test('the last record of a round saves the pass and goal result for History', () => {
  const question = createQuickAddQuestion({ difficulty: 'Easy', random: seeded(2) });
  const settings = { additions: 2, passRule: 'max-mistakes', passValue: 0, goalType: 'score', goalTarget: 2 };
  const first = quickAddRecordFields(question, settings, summarizeQuickAddRound(['Correct'], settings));
  assert.equal(first.quickAddRoundComplete, undefined);
  const last = quickAddRecordFields(question, settings, summarizeQuickAddRound(['Correct', 'Correct'], settings));
  assert.equal(last.quickAddRoundComplete, true);
  assert.equal(last.quickAddRoundPassed, true);
  assert.equal(last.quickAddRoundGoalMet, true);
  assert.equal(last.expectedAnswer, `$${(question.answerCents / 100).toFixed(2)}`);
  const summary = summarizeQuickAddHistory([{ ...last, outcome: 'Correct' }, { ...first, outcome: 'Timed Out' }]);
  assert.equal(summary.rounds, 1);
  assert.equal(summary.roundsPassed, 1);
});

test('the game uses the shared timer and continues automatically with the answer note', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /startTimer\(state\.timeLimitSeconds, document\.getElementById\('quick-add-timer'\), \(\) => submitQuickAddAnswer\(true\)\)/);
  assert.match(app, /function submitQuickAddAnswer[\s\S]*?showAnswerToast\(record[\s\S]*?showNextQuickAddQuestion\(\)/);
});
