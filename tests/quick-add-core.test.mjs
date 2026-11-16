import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUICK_ADD_PRESETS, createQuickAddQuestion, resolveQuickAddSettings, scoreQuickAddAnswer,
  summarizeQuickAddRound, quickAddRecordFields, summarizeQuickAddHistory, passRuleText, goalText,
  quickAddAmountBand, quickAddTotalBand,
} from '../quick-add-core.mjs';

const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

test('every question adds one amount inside the chosen smallest and largest to the previous total', () => {
  const random = seeded(5);
  for (const [minAdd, maxAdd, includeCents] of [[1, 9, false], [5, 49, false], [10, 99, true], [7, 7, false], [3, 4, true]]) {
    const settings = { minAdd, maxAdd, includeCents };
    let previous = 0;
    const seen = new Set();
    for (let i = 0; i < 400; i += 1) {
      const question = createQuickAddQuestion({ settings, previousCents: previous, random });
      assert.equal(question.previousCents, previous, 'adds to the previous total');
      assert.ok(question.addendCents >= minAdd * 100 && question.addendCents <= maxAdd * 100, `${minAdd}-${maxAdd}: ${question.addendCents}`);
      assert.equal(question.addendCents % (includeCents ? 5 : 100), 0);
      assert.equal(question.answerCents, previous + question.addendCents);
      if (!includeCents) assert.equal(question.addendCents % 100, 0, 'whole dollars only');
      seen.add(question.addendCents);
      previous = question.answerCents;
    }
    assert.ok(seen.has(minAdd * 100) || maxAdd - minAdd > 5, 'the smallest amount can appear');
  }
  const exact = createQuickAddQuestion({ settings: { minAdd: 7, maxAdd: 7 }, previousCents: 1200, random });
  assert.equal(exact.expression, '$12 + $7');
  assert.equal(exact.answerCents, 1900);
  assert.equal(createQuickAddQuestion({ settings: { minAdd: 2, maxAdd: 2, includeCents: true }, previousCents: 1250, random }).expression, '$12.50 + $2');
});

test('a chain of questions keeps adding to the last total', () => {
  const settings = resolveQuickAddSettings({ difficulty: 'Medium' });
  const random = seeded(9);
  let total = 0;
  const first = createQuickAddQuestion({ settings, previousCents: total, random });
  assert.equal(first.previousCents, 0, 'a round starts at $0');
  total = first.answerCents;
  for (let i = 0; i < 20; i += 1) {
    const next = createQuickAddQuestion({ settings, previousCents: total, random });
    assert.equal(next.previousCents, total);
    total = next.answerCents;
  }
  assert.ok(total > 21 * settings.minAdd * 100 - 1);
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

test('settings keep every number inside safe limits', () => {
  const settings = resolveQuickAddSettings({ difficulty: 'Medium', secondsPerQuestion: '4', additions: '12', passRule: 'min-correct', passValue: '50', goalType: 'score', goalTarget: '99', minAdd: '8', maxAdd: '30', includeCents: true });
  assert.deepEqual(settings, { difficulty: 'Medium', minAdd: 8, maxAdd: 30, includeCents: true, secondsPerQuestion: 4, additions: 12, passRule: 'min-correct', passValue: 12, goalType: 'score', goalTarget: 12 });
  assert.equal(resolveQuickAddSettings({ secondsPerQuestion: 0 }).secondsPerQuestion, 2);
  assert.equal(resolveQuickAddSettings({ passRule: 'max-mistakes', passValue: 0 }).passValue, 0, 'zero mistakes allowed is a valid rule');
  assert.equal(resolveQuickAddSettings({ difficulty: 'Nope' }).difficulty, 'Easy');
  const crossed = resolveQuickAddSettings({ minAdd: 20, maxAdd: 5 });
  assert.ok(crossed.maxAdd >= crossed.minAdd, 'the largest amount is never below the smallest');
  assert.equal(resolveQuickAddSettings({ minAdd: 0 }).minAdd, 1);
  assert.equal(resolveQuickAddSettings({ minAdd: 5000 }).minAdd, 1000);
  for (const level of Object.values(QUICK_ADD_PRESETS)) assert.ok(level.minAdd <= level.maxAdd);
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

test('size groups for charts', () => {
  assert.equal(quickAddAmountBand(700), '$1–$9');
  assert.equal(quickAddAmountBand(1000), '$10–$24');
  assert.equal(quickAddAmountBand(4999), '$25–$49');
  assert.equal(quickAddAmountBand(9999), '$50–$99');
  assert.equal(quickAddAmountBand(10000), '$100+');
  assert.equal(quickAddTotalBand(0), '$0–$49');
  assert.equal(quickAddTotalBand(25000), '$250–$499');
  assert.equal(quickAddTotalBand(60000), '$500+');
});

test('the last record of a round saves the pass and goal result for History', () => {
  const settings = { additions: 2, passRule: 'max-mistakes', passValue: 0, goalType: 'score', goalTarget: 2, minAdd: 1, maxAdd: 9 };
  const question = createQuickAddQuestion({ settings, previousCents: 500, random: seeded(2) });
  const first = quickAddRecordFields(question, settings, summarizeQuickAddRound(['Correct'], settings));
  assert.equal(first.quickAddRoundComplete, undefined);
  assert.equal(first.quickAddPreviousCents, 500);
  assert.equal(first.quickAddAnswerCents, 500 + first.quickAddAddendCents);
  const last = quickAddRecordFields(question, settings, summarizeQuickAddRound(['Correct', 'Correct'], settings));
  assert.equal(last.quickAddRoundComplete, true);
  assert.equal(last.quickAddRoundPassed, true);
  assert.equal(last.quickAddRoundGoalMet, true);
  assert.equal(last.expectedAnswer, `$${(question.answerCents / 100).toFixed(2)}`);
  const summary = summarizeQuickAddHistory([{ ...last, outcome: 'Correct' }, { ...first, outcome: 'Timed Out' }]);
  assert.equal(summary.rounds, 1);
  assert.equal(summary.roundsPassed, 1);
});

test('the game uses the shared timer, continues automatically, and chains from the correct total', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /startTimer\(state\.timeLimitSeconds, document\.getElementById\('quick-add-timer'\), \(\) => submitQuickAddAnswer\(true\)\)/);
  assert.match(app, /function submitQuickAddAnswer[\s\S]*?showAnswerToast\(record[\s\S]*?showNextQuickAddQuestion\(\)/);
  assert.match(app, /state\.quickAddRunningCents = state\.quickAddQuestion\.answerCents/);
  assert.match(app, /previousCents: state\.quickAddRunningCents/);
});
