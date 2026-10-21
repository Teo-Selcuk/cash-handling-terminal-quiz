import assert from 'node:assert/strict';

const HISTORY_KEY = 'cash-handling-terminal-quiz-history-v1';

// Play one cash round in the real UI. `wrong` answers are submitted with a bad amount.
async function playCashRound(page, { questions = 5, wrong = 0, progressive = '' } = {}) {
  await page.locator('input[name="game"][value="cash"]').check({ force: true });
  await page.locator('input[name="difficulty"][value="Easy"]').check({ force: true });
  await page.locator('input[name="cashSessionMode"][value="testing"]').check({ force: true }).catch(() => {});
  await page.locator('#progressive-level').selectOption(progressive);
  await page.locator('#question-count').fill(String(questions));
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  for (let index = 0; index < questions; index++) {
    await page.locator('#amount-due').waitFor({ state: 'visible' });
    const record = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).at(-1), HISTORY_KEY);
    const difference = record.cashGivenCents - record.amountDueCents;
    const type = difference > 0 ? 'Change' : difference < 0 ? 'Short' : 'Exact';
    const bad = index < wrong;
    await page.locator(`input[name="answerType"][value="${bad ? (type === 'Exact' ? 'Change' : 'Exact') : type}"]`).check();
    if (!bad && type !== 'Exact') await page.locator('#answer-amount').fill((Math.abs(difference) / 100).toFixed(2));
    if (bad && type === 'Exact') await page.locator('#answer-amount').fill('1.00');
    await page.locator('#answer-form button[type="submit"]').click();
    assert.equal(await page.locator('#feedback-heading').textContent(), bad ? 'Not quite' : 'Correct');
    await page.locator('#next-question').click();
  }
  await page.locator('#summary-screen').waitFor({ state: 'visible' });
  await page.locator('#start-another').click();
  await page.locator('#setup-screen').waitFor({ state: 'visible' });
}

const status = (page, id) => page.locator(`#speed-goals-setup [data-goal="${id}"]`).getAttribute('data-status');

export async function checkGoals(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(base);
    await page.locator('#setup-form:not([inert])').waitFor();
    await page.locator('input[name="game"][value="cash"]').check({ force: true });
    assert.ok(await page.locator('#speed-goals-setup').isVisible(), 'goals visible on setup');
    assert.match(await page.locator('#speed-goals-setup').textContent(), /any 150 attempts in a row/, 'cash defaults to 150 attempts');
    // The test rounds are 5 questions, so use a 5-attempt run through the visible setting.
    await page.locator('#speed-goals-setup summary').click();
    await page.locator('#goal-window-cash').fill('5');
    await page.locator('#goal-window-cash').dispatchEvent('change');
    assert.match(await page.locator('#speed-goals-setup').textContent(), /any 5 attempts in a row/, 'attempt count can be changed');
    assert.match(await page.locator('#speed-goals-setup').textContent(), /Easy: 15s or faster at 90%\+.*No attempts yet.*0 of 16/s);
    const levelOptions = await page.locator('#progressive-level option').evaluateAll((options) => options.map((o) => [o.value, o.disabled]));
    assert.deepEqual(levelOptions.map(([, disabled]) => disabled), [false, false, false, true, true, true, true], 'Medium and Hard levels start locked');

    await playCashRound(page, { questions: 5, wrong: 1 });
    assert.equal(await status(page, 'cash:Easy:15'), 'current', '80% round does not pass');

    await playCashRound(page, { questions: 5, progressive: '2' });
    // Automated answers take about a second, so this round meets every Easy time at once.
    for (const seconds of [15, 12, 10, 7.5, 5]) assert.equal(await status(page, `cash:Easy:${seconds}`), 'passed', `fast 100% round passes Easy ${seconds}s`);
    assert.equal(await status(page, 'cash:Medium:15'), 'current', 'Medium opens only once every Easy goal passed');
    assert.equal(await status(page, 'cash:Medium:12'), 'locked');
    assert.equal(await status(page, 'cash:Hard:20'), 'locked', 'Hard stays locked until Medium goals pass');
    const opened = await page.locator('#progressive-level option').evaluateAll((options) => options.map((o) => o.disabled));
    assert.deepEqual(opened, [false, false, false, false, false, true, true], 'Medium progressive levels open with the Medium goals');
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).filter((r) => r.progressiveLevel === 2), HISTORY_KEY);
    assert.ok(saved.length >= 5 && saved.every((r) => r.difficulty === 'Easy'), 'progressive round saved under its base level');

    await page.reload();
    await page.locator('#setup-form:not([inert])').waitFor();
    await page.locator('input[name="game"][value="cash"]').check({ force: true });
    assert.equal(await status(page, 'cash:Easy:10'), 'passed', 'goal progress persists after restart');
    await page.locator('#open-history').click();
    await page.locator('#history-game-tabs button[data-history-game="cash"]').click();
    assert.ok(await page.locator('#speed-goals-history').isVisible(), 'goals visible on History');
    assert.equal(await page.locator('#speed-goals-history [data-goal="cash:Easy:10"]').getAttribute('data-status'), 'passed');
    await page.locator('#history-game-tabs button[data-history-game="typing"]').click();
    assert.equal(await page.locator('#speed-goals-history').isVisible(), false, 'no speed ladder for typing');
    await page.locator('#speed-goals-history').evaluate(() => {});
    console.log('Speed goals: failing round stays locked, passing round unlocks next, Medium gated, persists after reload, progressive level saved');
  } finally { await context.close(); }
}
