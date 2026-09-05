import assert from 'node:assert/strict';
import { resolve } from 'node:path';

// Each scenario uses its own browser context, never the user's saved history.
export async function checkHistory(browser, base) {
  for (const game of ['cash', 'memory', 'task', 'error-detection']) {
    for (const phase of ['initial', 'active', 'feedback', 'next']) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await start(page, base, game, false);
        let outcome;
        if (phase === 'active') await enterTimedPhase(page, game);
        if (phase === 'feedback' || phase === 'next') {
          await answer(page, game);
          await page.locator('#feedback-screen').waitFor({ state: 'visible' });
          outcome = await page.locator('#feedback-heading').textContent() === 'Correct' ? 'Correct' : 'Incorrect';
          if (game === 'memory') assert.equal(outcome, 'Correct');
          if (phase === 'next') await page.locator('#next-question').click();
        }
        for (let refresh = 0; refresh < 2; refresh += 1) {
          await page.reload();
          await page.locator('#open-history').click();
          const outcomes = await page.locator('#history-rows tr td:nth-child(4)').allTextContents();
          assert.deepEqual(outcomes, ['initial', 'active'].includes(phase) ? ['Not answered'] : phase === 'feedback' ? [outcome] : ['Not answered', outcome], `${game} ${phase} refresh ${refresh}`);
          assert.match(await page.locator('#history-outcome-legend').textContent(), /Not answered:/);
          if (game === 'memory' && phase === 'next') {
            assert.match(await page.locator('#history-outcomes-summary').textContent(), /1 of 2 correct/);
            assert.match(await page.locator('#history-accuracy-chart').textContent(), /50% \(1\/2\)/);
          }
        }
        if (game === 'memory' && phase === 'next') {
          for (const width of [320, 768, 1024, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `history fits ${width}px`);
          }
          await page.setViewportSize({ width: 320, height: 900 });
          await page.screenshot({ path: resolve(process.env.TEMP || '/tmp', 'quiz-history-mobile.png'), fullPage: true });
        }
        assert.deepEqual(errors, []);
      } finally { await page.context().close(); }
    }
    console.log(`${game}: initial/active/feedback/next refresh retains only reached rounds without duplicates`);
  }
}

export async function start(page, base, game, auto) {
  await page.goto(base);
  await page.locator(`input[name="game"][value="${game}"]`).check();
  await page.locator(game === 'cash' ? '#question-count' : `#${game}-question-count`).fill('3');
  if (auto) await page.locator('#auto-continue-toggle').check();
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
}

export async function checkAutoContinue(browser, base) {
  for (const game of ['cash', 'memory', 'task', 'error-detection']) {
    const page = await browser.newPage();
    try {
      await start(page, base, game, true);
      for (let round = 1; round <= 3; round += 1) {
        await answer(page, game);
        const screen = round === 3 ? 'summary' : ({ cash: 'quiz', memory: 'memory-read', task: 'task-briefing', 'error-detection': 'error-detection-briefing' })[game];
        await page.locator(`#${screen}-screen`).waitFor({ state: 'visible', timeout: 5000 });
        assert.equal(await page.locator('#feedback-screen').isVisible(), false);
      }
      await page.reload();
      await page.locator('#open-history').click();
      const outcomes = await page.locator('#history-rows tr td:nth-child(4)').allTextContents();
      assert.equal(outcomes.length, 3);
      assert.ok(outcomes.every((value) => value === 'Correct' || value === 'Incorrect'));
      if (game === 'memory') assert.deepEqual(outcomes, ['Correct', 'Correct', 'Correct']);
      console.log(`${game}: submitted answers auto-advance through 3 rounds to summary, no extra records`);
    } finally { await page.context().close(); }
  }
}

export async function checkTimeouts(browser, base) {
  for (const game of ['cash', 'memory', 'task', 'error-detection']) {
    const page = await browser.newPage();
    try {
      await page.clock.install();
      await start(page, base, game, true);
      for (let round = 1; round <= 3; round += 1) {
        await enterTimedPhase(page, game);
        const timer = ({ cash: 'timer', memory: 'memory-answer-timer', task: 'task-timer', 'error-detection': 'error-detection-timer' })[game];
        const text = await page.locator(`#${timer}`).textContent();
        assert.match(text, /^\d+:\d+$/);
        const [minutes, seconds] = text.split(':').map(Number);
        await page.clock.runFor((minutes * 60 + seconds) * 1000 + 100);
      }
      await page.locator('#summary-screen').waitFor({ state: 'visible' });
      await page.reload();
      await page.locator('#open-history').click();
      assert.deepEqual(await page.locator('#history-rows tr td:nth-child(4)').allTextContents(), ['Timed Out', 'Timed Out', 'Timed Out']);
      console.log(`${game}: timeout auto-advance and final summary keep exactly 3 timed-out records`);
    } finally { await page.context().close(); }
  }
}

async function enterTimedPhase(page, game) {
  if (game === 'memory') await page.locator('#memory-answer-now').click();
  if (game === 'task') {
    await page.locator('#task-start-demo').click();
    await page.locator('#task-skip-demo').click();
  }
  if (game === 'error-detection') await page.locator('#error-detection-start-puzzle').click();
}

export async function answer(page, game) {
  if (game === 'cash') {
    await page.locator('input[name="answerType"][value="Exact"]').check();
    await page.locator('#submit-answer').click();
  } else if (game === 'memory') {
    const values = await page.locator('#memory-number li span:not(.memory-value-index)').allTextContents();
    await page.locator('#memory-answer-now').click();
    const inputs = await page.locator('#memory-answer-list input').all();
    for (let index = 0; index < inputs.length; index += 1) await inputs[index].fill(values[index]);
    await page.locator('#memory-answer-form button[type="submit"]').click();
  } else if (game === 'task') {
    await page.locator('#task-start-demo').click();
    await page.locator('#task-skip-demo').click();
    await page.locator('#task-save-workspace').click();
  } else {
    await page.locator('#error-detection-start-puzzle').click();
    await page.locator('#error-detection-no-errors').check();
    await page.locator('#submit-error-detection').click();
  }
}
