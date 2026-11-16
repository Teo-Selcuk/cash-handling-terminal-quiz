import assert from 'node:assert/strict';

const HISTORY_KEY = 'cash-handling-terminal-quiz-history-v1';
const CENTS = { '$100': 10000, '$50': 5000, '$20': 2000, '$10': 1000, '$5': 500, '$1': 100, '25¢': 25, '10¢': 10, '5¢': 5 };

/** Quick addition: settings, timer and timeout, exactly Y additions, both pass rules, goal progress, History. */
export async function checkQuickAdd(browser, base) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const history = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), HISTORY_KEY);
  const total = async () => (await page.locator('#quick-add-values li').allTextContents()).reduce((sum, label) => sum + CENTS[label.trim()], 0);
  const setup = async ({ level = 'Easy', seconds = '8', additions = '3', passRule = 'max-mistakes', passValue = '1', goalType = 'streak', goalTarget = '2' } = {}) => {
    await page.goto(base);
    await page.locator('input[name="game"][value="quick-add"]').check();
    await page.locator(`input[name="difficulty"][value="${level}"]`).check();
    assert.equal(await page.locator('#quick-add-setup-options').isVisible(), true);
    assert.equal(await page.locator('#cash-setup-options').isVisible(), false);
    await page.locator('#quick-add-seconds').fill(seconds);
    await page.locator('#quick-add-additions').fill(additions);
    await page.locator('#quick-add-pass-rule').selectOption(passRule);
    await page.locator('#quick-add-pass-value').fill(passValue);
    await page.locator('#quick-add-goal-type').selectOption(goalType);
    await page.locator('#quick-add-goal-target').fill(goalTarget);
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    await page.locator('#quick-add-screen').waitFor();
  };
  const answer = async (right) => {
    const cents = await total();
    await page.locator('#quick-add-answer').fill(((right ? cents : cents + 100) / 100).toFixed(2));
    await page.locator('#quick-add-answer').press('Enter');
  };
  const metrics = () => page.locator('#session-metrics').textContent();
  try {
    // Each difficulty fills its own seconds and additions; Hard adds coins.
    await page.goto(base);
    await page.locator('input[name="game"][value="quick-add"]').check();
    for (const [level, seconds, additions] of [['Easy', '8', '10'], ['Medium', '6', '20'], ['Hard', '5', '25']]) {
      await page.locator(`input[name="difficulty"][value="${level}"]`).check();
      assert.equal(await page.locator('#quick-add-seconds').inputValue(), seconds, `${level} seconds`);
      assert.equal(await page.locator('#quick-add-additions').inputValue(), additions, `${level} additions`);
    }
    await page.locator('#quick-add-pass-rule').selectOption('min-correct');
    assert.match(await page.locator('#quick-add-pass-value-label').textContent(), /Correct answers needed/);

    // Mistake rule: right, wrong, right with 1 mistake allowed passes; the streak goal of 2 is not met.
    await setup({ additions: '3', passRule: 'max-mistakes', passValue: '1', goalType: 'streak', goalTarget: '2' });
    assert.match(await page.locator('#quick-add-progress').textContent(), /Addition 1 of 3 · EASY/);
    assert.equal((await history()).at(-1).outcome, 'Not answered');
    await page.locator('#quick-add-answer').pressSequentially('1a2', { delay: 10 });
    assert.equal(await page.locator('#quick-add-answer').inputValue(), '12', 'letters are blocked');
    await answer(true);
    await page.locator('#answer-toast[data-result="correct"]').waitFor();
    assert.match(await page.locator('#quick-add-progress').textContent(), /Addition 2 of 3/, 'continues automatically');
    assert.match(await page.locator('#quick-add-goal-text').textContent(), /1 of 2/);
    await answer(false);
    await page.locator('#answer-toast[data-result="incorrect"]').waitFor();
    assert.match(await page.locator('#quick-add-score').textContent(), /Correct 1 · Mistakes 1 · Streak 0/);
    await answer(true);
    await page.locator('#summary-screen').waitFor();
    assert.equal(await page.locator('#summary-heading').textContent(), 'Your quick addition results');
    let text = await metrics();
    assert.match(text, /2\/3Correct answers/);
    assert.match(text, /1Mistakes/);
    assert.match(text, /Passed/);
    assert.match(text, /Goal not met/);
    let rows = (await history()).filter((row) => row.game === 'quick-add');
    assert.equal(rows.length, 3, 'exactly Y additions saved');
    assert.equal(rows.at(-1).quickAddRoundComplete, true);
    assert.equal(rows.at(-1).quickAddRoundPassed, true);
    assert.equal(rows.at(-1).quickAddRoundGoalMet, false);

    // Mistake rule fails one past the limit; a score goal of 1 is met.
    await setup({ additions: '3', passRule: 'max-mistakes', passValue: '1', goalType: 'score', goalTarget: '1' });
    await answer(false);
    await page.locator('#answer-toast[data-result="incorrect"]').waitFor();
    await answer(false);
    await page.locator('#quick-add-pass-status[data-status="failed"]').waitFor();
    await answer(true);
    await page.locator('#summary-screen').waitFor();
    text = await metrics();
    assert.match(text, /Not passed/);
    assert.match(text, /Goal met/);

    // Correct-target rule: 2 correct needed in 2 passes; then the timer runs out on a 2-second question.
    await setup({ additions: '2', passRule: 'min-correct', passValue: '2', goalType: 'streak', goalTarget: '2' });
    await answer(true);
    await page.locator('#answer-toast[data-result="correct"]').waitFor();
    await answer(true);
    await page.locator('#summary-screen').waitFor();
    text = await metrics();
    assert.match(text, /Passed/);
    assert.match(text, /Goal met/);

    await setup({ seconds: '2', additions: '2', passRule: 'min-correct', passValue: '2', goalType: 'score', goalTarget: '2' });
    assert.match(await page.locator('#quick-add-timer').textContent(), /0:0[12]/, 'timer counts down from 2 seconds');
    await answer(true);
    await page.locator('#answer-toast[data-result="correct"]').waitFor();
    await page.locator('#summary-screen').waitFor({ timeout: 5000 });
    rows = (await history()).filter((row) => row.game === 'quick-add');
    assert.equal(rows.at(-1).outcome, 'Timed Out', 'a timeout counts as a mistake');
    text = await metrics();
    assert.match(text, /1Mistakes \(1 timed out\)/);
    assert.match(text, /Not passed/);

    // History and Data Analysis show Quick addition charts with explanations.
    await page.goto(base);
    await page.locator('#open-history').click();
    await page.locator('#history-screen').waitFor();
    await page.locator('[data-history-game="quick-add"]').click();
    await page.waitForFunction(() => document.querySelector('.interactive-chart[data-chart-id="quick-add-round-results"]'));
    const charts = await page.locator('.interactive-chart').evaluateAll((cards) => cards.map((card) => card.dataset.chartId));
    for (const id of ['quick-add-round-results', 'quick-add-terms-accuracy', 'quick-add-terms-time', 'quick-add-largest-accuracy', 'quick-add-coins-accuracy']) assert.ok(charts.includes(id), `${id} chart`);
    const chartText = await page.locator('.interactive-chart[data-chart-id="quick-add-round-results"]').textContent();
    assert.match(chartText, /Passed the round/);
    assert.match(chartText, /What this shows/i);
    assert.deepEqual(errors, []);
    console.log('Quick addition browser checks passed.');
  } finally {
    await context.close();
  }
}
