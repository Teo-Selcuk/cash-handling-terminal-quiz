import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  holdSchedule, holdDays, scheduleText, createHoldsQuestion, createHoldsRound, scoreHoldsAnswer, resolveHoldsSettings,
  summarizeHoldsHistory, HOLDS_PRESETS, TEMPLATES, CATEGORIES, XPERIENCE_REASONS, HOLDS_GAME,
} from '../holds-verification.mjs';
import { canPlayGame, APPROVED_UID } from '../account-access.mjs';
import { generateSampleHistory } from '../sample-history.mjs';
import { buildChartSpecs, buildGameFilters, filterHistory, buildErrorAnalytics, findWeaknesses } from '../progress-analytics.mjs';
import { goalsForGame } from '../speed-goals.mjs';

const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const days = (hold, kind, cents) => holdSchedule(hold, kind, cents).map((tier) => [tier.cents, tier.day]);

test('release schedules follow Table 2 for every hold and check type', () => {
  // Large Deposit: $300 same day, next $6,500 next day (Next-Day) or 2nd day (Non-Next-Day), the rest day 2 (On-Us) or 7.
  assert.deepEqual(days('large', 'treasury', 925000), [[30000, 0], [650000, 1], [245000, 7]]);
  assert.deepEqual(days('large', 'on-us', 925000), [[30000, 0], [650000, 1], [245000, 2]]);
  assert.deepEqual(days('large', 'personal', 925000), [[30000, 0], [650000, 2], [245000, 7]]);
  // New Account: Next-Day items get $300 / $6,500 next day / rest day 9; On-Us and Non-Next-Day wait for day 9.
  assert.deepEqual(days('new', 'cashier', 925000), [[30000, 0], [650000, 1], [245000, 9]]);
  assert.deepEqual(days('new', 'on-us', 925000), [[925000, 9]]);
  assert.deepEqual(days('new', 'business', 250000), [[250000, 9]]);
  for (const hold of ['reasonable', 'redeposited', 'emergency']) {
    assert.deepEqual(days(hold, 'on-us', 250000), [[250000, 2]], hold);
    assert.deepEqual(days(hold, 'treasury', 250000), [[250000, 7]], hold);
    assert.deepEqual(days(hold, 'personal', 250000), [[250000, 7]], hold);
  }
  assert.deepEqual(days('overdraft', 'postal', 250000), [[250000, 1]]);
  assert.deepEqual(days('overdraft', 'payroll', 250000), [[250000, 2]]);
  assert.deepEqual(holdSchedule('large', 'wire', 900000), [], 'wires are never held');
  assert.deepEqual(holdSchedule('large', 'foreign', 900000), [], 'foreign items have no Reg CC schedule');
  assert.equal(holdDays(holdSchedule('new', 'treasury', 900000)), 9);
  assert.equal(scheduleText(holdSchedule('large', 'personal', 925000)), '$300 same day · $6,500 on the 2nd business day · $2,450 on the 7th business day');
});

test('Xperience reasons match the guide and Emergency has none', () => {
  assert.equal(XPERIENCE_REASONS.large, 'The checks you deposited on this day exceed $6,800.');
  assert.equal(XPERIENCE_REASONS.overdraft, 'Your account has been overdrawn repeatedly in the last 6 months.');
  assert.equal(Object.keys(XPERIENCE_REASONS).length, 5);
  assert.equal(XPERIENCE_REASONS.emergency, undefined);
});

test('every template at every level builds a well-formed question with one correct choice', () => {
  const random = seeded(7);
  for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    const level = { Easy: 1, Medium: 2, Hard: 3 }[difficulty];
    for (const template of TEMPLATES.filter((item) => item.min <= level)) {
      for (let i = 0; i < 40; i += 1) {
        const question = createHoldsQuestion({ difficulty, templateId: template.id, random });
        const texts = question.options.map((option) => option.text);
        assert.equal(texts.length, HOLDS_PRESETS[difficulty].optionCount, `${template.id} ${difficulty}`);
        assert.equal(new Set(texts).size, texts.length, `${template.id}: no duplicate choices`);
        assert.ok(question.options.some((option) => option.id === question.correctOptionId));
        assert.doesNotMatch(`${question.prompt} ${question.facts.join(' ')} ${texts.join(' ')} ${question.explanation}`, /undefined|NaN|\[object/);
        assert.ok(CATEGORIES[question.category], question.category);
      }
    }
  }
});

test('topics filter the question bank, and Hard adds tricky templates', () => {
  const random = seeded(11);
  for (let i = 0; i < 200; i += 1) {
    assert.notEqual(createHoldsQuestion({ difficulty: 'Medium', topic: 'holds', random }).topic, 'verification');
    assert.notEqual(createHoldsQuestion({ difficulty: 'Medium', topic: 'verification', random }).topic, 'holds');
  }
  const easy = new Set(TEMPLATES.filter((t) => t.min === 1).map((t) => t.id));
  assert.ok(!easy.has('availability') && !easy.has('statement'), 'full schedules and true/false rules start at Medium');
  const hardTrigger = createHoldsQuestion({ difficulty: 'Hard', templateId: 'which-hold', random: () => 0.99 });
  assert.equal(hardTrigger.options.length, 5);
});

test('a round has the requested count, no repeats, and scores correct, wrong and timed-out answers', () => {
  const round = createHoldsRound({ difficulty: 'Hard', questionCount: 15 }, seeded(3));
  assert.equal(round.length, 15);
  const answerOf = (q) => q.options.find((option) => option.id === q.correctOptionId).text;
  assert.equal(new Set(round.map((q) => `${q.prompt}|${q.facts.join()}|${answerOf(q)}`)).size, 15);
  const question = round[0];
  const wrong = question.options.find((option) => option.id !== question.correctOptionId).id;
  assert.equal(scoreHoldsAnswer(question, question.correctOptionId).outcome, 'Correct');
  assert.equal(scoreHoldsAnswer(question, wrong).outcome, 'Incorrect');
  assert.equal(scoreHoldsAnswer(question, question.correctOptionId, true).outcome, 'Timed Out');
  assert.deepEqual(resolveHoldsSettings({ difficulty: 'Nope', questionCount: 500, timeLimitSeconds: 1, topic: 'x' }),
    { difficulty: 'Easy', questionCount: 100, timeLimitSeconds: 10, topic: 'all', optionCount: 3 });
});

test('the game needs an approved signed-in account, like Check & ID Fraud Inspection', () => {
  assert.equal(canPlayGame(HOLDS_GAME, undefined), false);
  assert.equal(canPlayGame(HOLDS_GAME, 'someone-else'), false);
  assert.equal(canPlayGame(HOLDS_GAME, APPROVED_UID), true);
  assert.equal(canPlayGame('cash', undefined), true);
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /signedInChoices=\['fraud-inspection',HOLDS_GAME\]/);
  assert.match(app, /if \(!requireGameAccess\(selectedGame\(\)\)\) return;\n  if \(selectedGame\(\) === 'overload'\)[^\n]*\n  if \(selectedGame\(\) === HOLDS_GAME\)/, 'access is checked before the round starts');
});

test('History & Progress shows the game with charts, filters, error analysis and goals', () => {
  const history = generateSampleHistory({ seed: 5, now: new Date('2026-10-25T12:00:00Z') });
  const rows = history.filter((row) => row.game === HOLDS_GAME);
  assert.ok(rows.length > 50);
  const ids = buildChartSpecs(history, HOLDS_GAME).map((spec) => spec.id);
  for (const id of ['accuracy-over-time', 'holds-category-accuracy', 'holds-topic-accuracy', 'holds-category-time']) assert.ok(ids.includes(id), id);
  const filters = buildGameFilters(history, HOLDS_GAME).fields;
  assert.ok(filters.find((field) => field.id === 'holds.categories').options.includes('Funds availability'));
  const availability = filterHistory(history, { game: HOLDS_GAME, holds: { categories: ['Funds availability'] } });
  assert.ok(availability.length > 0 && availability.every((row) => row.holdsCategory === 'availability'));
  const errors = buildErrorAnalytics(filterHistory(history, { game: HOLDS_GAME }), { comparisonDisabled: true });
  assert.ok(errors.byCategory.some((group) => group.game === HOLDS_GAME));
  assert.ok(Array.isArray(findWeaknesses(history, HOLDS_GAME)));
  assert.equal(goalsForGame(HOLDS_GAME).length, 9);
  const summary = summarizeHoldsHistory(rows);
  assert.equal(summary.answered, rows.filter((row) => row.outcome !== 'Not answered').length);
});

test('the new modules ship with the site and are served by the browser checks', () => {
  const deploy = readFileSync(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
  const smoke = readFileSync(new URL('./browser-smoke.mjs', import.meta.url), 'utf8');
  for (const file of ['holds-verification.mjs', 'holds-verification-ui.mjs']) {
    assert.match(deploy, new RegExp(file.replace('.', '\\.')));
    assert.match(smoke, new RegExp(`'${file.replace('.', '\\.')}'`));
  }
});
