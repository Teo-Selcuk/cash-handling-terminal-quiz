import assert from 'node:assert/strict';

export async function checkGuidance(browser, base) {
  const page = await browser.newPage();
  try {
    for (const mode of ['guided', 'testing']) {
      await page.goto(base);
      await page.locator(`input[name="cashSessionMode"][value="${mode}"]`).check();
      await page.locator('#question-count').fill('1');
      await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
      assert.equal(await page.locator('#cash-guidance').isVisible(), mode === 'guided');
      assert.equal((await page.locator('#timer').textContent()) === 'Untimed', mode === 'guided');
      if (mode === 'guided') {
        assert.match(await page.locator('#cash-guidance').textContent(), /Say to the customer/);
        for (const width of [320, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
      } else assert.equal(await page.locator('#cash-guidance').textContent(), '');
      const record = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-handling-terminal-quiz-history-v1')).at(-1));
      const type = record.expectedAnswer.includes('change') ? 'Change' : record.expectedAnswer.includes('short') ? 'Short' : 'Exact';
      await page.locator(`input[name="answerType"][value="${type}"]`).check();
      if (type !== 'Exact') await page.locator('#answer-amount').fill((Math.abs(record.cashGivenCents - record.amountDueCents) / 100).toFixed(2));
      await page.locator('#answer-form button[type="submit"]').click();
      assert.equal(await page.locator('#feedback-heading').textContent(), 'Correct');
      await page.locator('#next-question').click();
      await page.locator('#summary-screen').waitFor({ state: 'visible' });
      await page.reload();
      await page.locator('#open-history').click();
      assert.match(await page.locator('#history-rows').textContent(), mode === 'guided' ? /Guided practice/ : /Testing/);
    }
    console.log('Guided/testing: guidance visibility, timing, responsive layout, correct scoring, summary, and saved history passed');
  } finally { await page.context().close(); }
}
