import assert from 'node:assert/strict';
import { evaluateExpression } from '../math-core.mjs';

const HISTORY_KEY = 'cash-handling-terminal-quiz-history-v1';

/** Math practice: operation toggles, mode timers, right/wrong/timeout answers, Auto-continue, History and analysis. */
export async function checkMath(browser, base) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const history = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), HISTORY_KEY);
  const setup = async ({ level = 'Easy', count = '3', seconds = null, operations = null, autoContinue = false } = {}) => {
    await page.goto(base);
    await page.locator('input[name="game"][value="math"]').check();
    await page.locator(`input[name="difficulty"][value="${level}"]`).check();
    assert.equal(await page.locator('#math-setup-options').isVisible(), true);
    assert.equal(await page.locator('#cash-setup-options').isVisible(), false);
    await page.locator('#math-question-count').fill(count);
    if (seconds) await page.locator('#math-time-limit').fill(seconds);
    if (operations) for (const input of await page.locator('#math-operations input').all()) {
      const value = await input.getAttribute('value');
      if (operations.includes(value)) await input.check(); else await input.uncheck();
    }
    await page.locator('#auto-continue-toggle').setChecked(autoContinue);
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    await page.locator('#math-screen').waitFor();
  };
  const expression = async () => (await page.locator('#math-expression').textContent()).trim();
  try {
    // Each mode fills its own time limit.
    await page.goto(base);
    await page.locator('input[name="game"][value="math"]').check();
    for (const [level, seconds] of [['Easy', '20'], ['Medium', '15'], ['Hard', '12']]) {
      await page.locator(`input[name="difficulty"][value="${level}"]`).check();
      assert.equal(await page.locator('#math-time-limit').inputValue(), seconds, `${level} time limit`);
    }

    // Only division on: every problem is a whole division, the answer matches the calculator, letters are blocked.
    await setup({ operations: ['division'], count: '2' });
    assert.equal(await page.locator('#math-operation-label').textContent(), 'Division');
    assert.match(await expression(), /^\d+ ÷ \d+$/);
    assert.equal((await history()).at(-1).outcome, 'Not answered');
    await page.locator('#math-answer').pressSequentially('ab', { delay: 10 });
    assert.equal(await page.locator('#math-answer').inputValue(), '');
    const answer = evaluateExpression(await expression());
    await page.locator('#math-answer').fill(String(answer));
    await page.locator('#math-answer').press('Enter');
    await page.locator('#feedback-screen').waitFor();
    assert.equal(await page.locator('#feedback-heading').textContent(), 'Correct');
    let row = (await history()).at(-1);
    assert.equal(row.game, 'math');
    assert.equal(row.mathOperation, 'division');
    assert.equal(row.mathAnswer, answer);
    assert.equal(row.outcome, 'Correct');
    await page.locator('#next-question').click();
    await page.locator('#math-screen').waitFor();
    // A wrong answer shows the right one.
    const second = evaluateExpression(await expression());
    await page.locator('#math-answer').fill(String(second + 1));
    await page.locator('#math-submit').click();
    await page.locator('#feedback-screen').waitFor();
    assert.match(await page.locator('#feedback-lead').textContent(), new RegExp(`= ${second}\\.`));
    await page.locator('#next-question').click();
    await page.locator('#summary-screen').waitFor();
    assert.equal(await page.locator('#summary-heading').textContent(), 'Your math results');
    assert.match(await page.locator('#session-metrics').textContent(), /Division correct/);

    // The operation choice is remembered, and the last operation cannot be turned off.
    await page.goto(base);
    await page.locator('input[name="game"][value="math"]').check();
    assert.deepEqual(await page.locator('#math-operations input:checked').evaluateAll((inputs) => inputs.map((input) => input.value)), ['division']);
    // click(), not uncheck(): the app keeps the box ticked, so uncheck() would throw before the assertion.
    await page.locator('#math-op-division').click();
    assert.equal(await page.locator('#math-op-division').isChecked(), true);

    // Auto-continue goes straight on and shows the right/wrong note; the timer times a question out.
    await setup({ operations: ['addition', 'brackets'], count: '2', seconds: '3', autoContinue: true });
    const first = evaluateExpression(await expression());
    await page.locator('#math-answer').fill(String(first));
    await page.locator('#math-answer').press('Enter');
    await page.locator('#answer-toast[data-result="correct"]').waitFor();
    assert.equal(await page.locator('#math-progress').textContent(), 'Question 2 of 2 · EASY');
    await page.locator('#summary-screen').waitFor({ timeout: 6000 });
    row = (await history()).at(-1);
    assert.equal(row.outcome, 'Timed Out');
    assert.ok(['addition', 'brackets'].includes(row.mathOperation));
    assert.ok((await history()).filter((saved) => saved.game === 'math').every((saved) => saved.mathOperation !== 'multiplication'));

    // History and Data Analysis show the Math results.
    await page.goto(base);
    await page.locator('#open-history').click();
    await page.locator('#history-screen').waitFor();
    await page.locator('[data-history-game="math"]').click();
    await page.waitForFunction(() => document.querySelector('.interactive-chart[data-chart-id="math-operation-accuracy"]'));
    const charts = await page.locator('.interactive-chart').evaluateAll((cards) => cards.map((card) => card.dataset.chartId));
    for (const id of ['math-operation-accuracy', 'math-operation-time', 'math-terms-accuracy']) assert.ok(charts.includes(id), `${id} chart`);
    const chartText = await page.locator('.interactive-chart[data-chart-id="math-operation-accuracy"]').textContent();
    assert.match(chartText, /Division/);
    assert.match(chartText, /What this shows/i);
    assert.deepEqual(errors, []);
    console.log('Math practice browser checks passed.');
  } finally {
    await context.close();
  }
}
