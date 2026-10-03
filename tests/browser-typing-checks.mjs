import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

export async function checkTyping(browser, base) {
  const context = await browser.newContext();
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  const history = () => page.evaluate(() => JSON.parse(localStorage.getItem('cash-handling-terminal-quiz-history-v1') ?? '[]'));
  const setup = async (level = 'Easy', mode = 'words') => {
    await page.goto(base); await page.locator('input[name="game"][value="typing"]').check();
    await page.locator(`input[name="difficulty"][value="${level}"]`).check();
    await page.locator('#typing-mode').selectOption(mode); await page.locator('#typing-characters').fill('12');
    await page.locator('#typing-rounds').fill('1');
  };
  const start = () => page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  try {
    // Preserve another game's existing history while appending typing results.
    await page.goto(base);
    await page.evaluate(() => localStorage.setItem('cash-handling-terminal-quiz-history-v1', JSON.stringify([{ game: 'cash', gameType: 'Cash handling', timestamp: new Date().toISOString(), outcome: 'Correct', difficulty: 'Easy', timeUsedSeconds: 5, expectedAnswer: 'Exact amount', userAnswer: 'Exact', sessionId: 'existing-cash', questionNumber: 1 }])));
    for (const [level, mode] of [['Easy', 'words'], ['Medium', 'phrases'], ['Hard', 'random']]) {
      await setup(level, mode); await start();
      assert.equal((await history()).at(-1).outcome, 'Not answered');
      assert.equal(await page.locator('#open-history').isDisabled(), true);
      const prompt = await page.locator('#typing-prompt').textContent(); assert.equal(prompt.length, 12);
      await page.locator('#typing-begin').click();
      await page.locator('#typing-answer').pressSequentially(prompt, { delay: 15 });
      await page.locator('#typing-answer').press('Enter');
      await page.locator('#feedback-screen').waitFor();
      assert.match(await page.locator('#feedback-lead').textContent(), /100%/);
      await page.locator('#next-question').click(); await page.locator('#summary-screen').waitFor();
      const row = (await history()).at(-1); assert.equal(row.outcome, 'Correct'); assert.equal(row.typingMode, mode); assert.ok(row.wpm > 0);
    }
    assert.equal((await history())[0].sessionId, 'existing-cash');
    // Incorrect, partial timeout, and hidden-prompt preview all persist actual text.
    await setup(); await start(); await page.locator('#typing-begin').click();
    await page.locator('#typing-answer').fill('wrong'); await page.locator('#typing-submit').click();
    assert.equal((await history()).at(-1).outcome, 'Incorrect');
    await setup('Hard', 'random'); await page.locator('#typing-seconds').fill('3'); await start(); await page.locator('#typing-begin').click();
    await page.locator('#typing-answer').fill('x'); await page.locator('#feedback-screen').waitFor({ timeout: 7000 });
    assert.equal((await history()).at(-1).outcome, 'Timed Out'); assert.equal((await history()).at(-1).userAnswer, 'x');
    await setup(); await page.locator('#typing-hide').check(); await page.locator('#typing-preview').fill('1'); await start();
    assert.equal(await page.locator('#typing-prompt').isVisible(), false);
    await page.locator('#typing-begin').click(); assert.equal(await page.locator('#typing-answer').isDisabled(), true);
    const hiddenPrompt = await page.locator('#typing-prompt').textContent();
    await page.locator('#typing-answer').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#typing-answer').disabled);
    assert.equal(await page.locator('#typing-prompt').isVisible(), false);
    await page.locator('#typing-answer').pressSequentially(hiddenPrompt, { delay: 15 }); await page.locator('#typing-answer').press('Enter');
    assert.equal((await history()).at(-1).typingHidePrompt, true);
    assert.ok((await history()).at(-1).timeUsedSeconds < 1, 'preview excluded');
    // Saved difficulty overrides survive reload, reset restores shipped preset.
    await setup('Medium', 'random'); await page.locator('#typing-characters').fill('77'); await page.locator('#typing-save').click();
    await page.reload(); await page.locator('input[name="game"][value="typing"]').check(); await page.locator('input[name="difficulty"][value="Medium"]').check();
    assert.equal(await page.locator('#typing-characters').inputValue(), '77');
    await page.locator('#typing-reset').click(); assert.equal(await page.locator('#typing-characters').inputValue(), '60');
    // Real history survives reload; typing tab shows metrics, attempts, and chart data.
    await page.locator('#open-history').click(); await page.locator('[data-history-game="typing"]').click();
    assert.equal(await page.locator('#typing-history-rows tr').count(), 6);
    assert.match(await page.locator('#typing-history-metrics').textContent(), /WPM/);
    const chart = page.locator('[data-chart-id="typing-speed"]');
    await chart.waitFor(); await chart.getByRole('button', { name: 'Data table', exact: true }).click();
    await page.locator('#chart-data-dialog').waitFor(); await page.locator('#close-chart-data').click();
    const download = page.waitForEvent('download'); await page.locator('#download-csv').click();
    assert.match((await download).suggestedFilename(), /History\.csv$/);
    await page.locator('[data-history-game="cash"]').click(); assert.equal(await page.locator('#typing-history-panel').isVisible(), false);
    // Both themes and every required width, including the long-symbol target.
    await mkdir('.artifacts/typing', { recursive: true });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await setup('Hard', 'random');
      await page.locator('#typing-characters').fill('500');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `setup width ${width} ${theme}`);
      }
      await start(); await page.locator('#typing-begin').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `round width ${width}`);
      if (width === 320 || width === 1440) await page.screenshot({ path: `.artifacts/typing/typing-${width}.png`, fullPage: true });
      await page.locator('#typing-submit').click();
    }
    await setup(); await page.locator('#auto-continue-toggle').check(); await page.locator('#typing-seconds').fill('3'); await start(); await page.locator('#typing-begin').click();
    await page.locator('#summary-screen').waitFor({ timeout: 7000 });
    assert.equal((await history()).at(-1).outcome, 'Timed Out');
    await setup(); await page.locator('#auto-continue-toggle').check(); await page.locator('#typing-rounds').fill('3'); await page.locator('#typing-seconds').fill('3'); await start(); await page.locator('#typing-begin').click();
    await page.locator('#typing-answer').fill(await page.locator('#typing-prompt').textContent()); await page.locator('#typing-submit').click();
    assert.match(await page.locator('#typing-progress').textContent(), /Round 2 of 3/);
    assert.equal(await page.locator('#typing-answer').isDisabled(), false, 'auto-continue starts the next clock and input');
    assert.equal(await page.locator('#typing-begin').isVisible(), false);
    await page.locator('#typing-answer').fill('wrong'); await page.locator('#typing-submit').click();
    assert.match(await page.locator('#typing-progress').textContent(), /Round 3 of 3/);
    await page.locator('#summary-screen').waitFor({ timeout: 7000 });
    assert.deepEqual((await history()).slice(-3).map(row => row.outcome), ['Correct', 'Incorrect', 'Timed Out']);
    assert.deepEqual(errors, []); console.log('Typing browser checks passed: modes, exact/incorrect/timeout, preview, presets, history, charts, responsive themes, auto-continue.');
  } finally { await context.close(); }
}
