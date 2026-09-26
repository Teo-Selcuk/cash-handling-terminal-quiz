import assert from 'node:assert/strict';

export async function checkFraudInspection(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
  });
  try {
    await page.goto(base);
    await page.locator('input[name="game"][value="fraud-inspection"]').check();
    await page.locator('input[name="difficulty"][value="Custom"]').check();
    await page.locator('#fraud-custom-options summary').click();
    await page.locator('#fraud-question-count').fill('1');
    await page.locator('#fraud-time-limit').fill('120');
    await page.locator('#fraud-minimum-errors').fill('1');
    await page.locator('#fraud-maximum-errors').fill('1');
    await page.locator('#fraud-allow-clean').uncheck();
    for (const input of await page.locator('#fraud-enabled-categories input').all()) {
      if (await input.getAttribute('value') === 'payee-mismatch') await input.check();
      else await input.uncheck();
    }
    await page.getByRole('button', { name: 'Start quiz' }).click();
    await page.locator('#fraud-inspection-screen').waitFor({ state: 'visible' });
    assert.match(await page.locator('#fraud-inspection-progress').textContent(), /Case 1 of 1 · CUSTOM/);
    assert.equal(await page.locator('#fraud-document-grid .fraud-document-card').count(), 3);
    assert.match(await page.locator('#fraud-document-grid').textContent(), /TRAINING SAMPLE/);
    assert.match(await page.locator('#fraud-document-grid').textContent(), /FICTIONAL TRAINING CARD/);
    assert.match(await page.locator('#fraud-document-grid').textContent(), /PAYEE SIGNATURE · ENDORSE HERE/);
    assert.match(await page.locator('#fraud-document-grid').textContent(), /PAYEE ID · ENDORSEMENT SIGNATURE/);
    assert.match(await page.locator('#fraud-document-grid').textContent(), /MAKER ID · AUTHORIZED SIGNATURE/);
    assert.equal(await page.locator('#fraud-document-grid [data-region="maker-id-signature"]').count(), 1);
    assert.equal(await page.locator('#fraud-document-grid [data-region="id-signature"]').count(), 1);
    assert.match(await page.locator('#fraud-transaction-strip').textContent(), /Teller file routing/);
    assert.match(await page.locator('#fraud-transaction-strip').textContent(), /Teller file account/);
    assert.doesNotMatch(await page.locator('#fraud-inspection-screen').textContent(), /account control/i);
    assert.equal(await page.locator('#fraud-inspection-timer').textContent(), '2:00');
    assert.equal(await page.locator('#fraud-document-grid .fraud-marked').count(), 0, 'inspection documents do not reveal actual issue locations');

    await page.locator('[data-fraud-document-action="enlarge"][data-fraud-document="check"]').click();
    await page.locator('#fraud-document-dialog').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#fraud-document-dialog-view .fraud-marked').count(), 0, 'enlarged document does not reveal actual issue locations');
    await page.locator('[data-fraud-dialog-zoom="0.15"]').click();
    assert.match(await page.locator('#fraud-document-dialog-view svg').getAttribute('style'), /115%/);
    await page.locator('#close-fraud-document-dialog').click();
    await page.locator('[data-fraud-document-action="enlarge"][data-fraud-document="maker-id"]').click();
    assert.equal(await page.locator('#fraud-document-dialog-heading').textContent(), 'Maker identification');
    assert.equal(await page.locator('#fraud-document-dialog-view [data-region="maker-id-signature"]').count(), 1);
    await page.locator('#close-fraud-document-dialog').click();

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'inspection screen fits ' + width + 'px');
      assert.equal(await page.locator('#fraud-document-grid .fraud-document-card').count(), 3);
      const documents = await page.locator('#fraud-document-grid').evaluate((grid) => ({ bottom: grid.getBoundingClientRect().bottom,
        internalScroll: [...grid.querySelectorAll('.fraud-doc-viewport')].some((viewport) => viewport.scrollWidth > viewport.clientWidth + 1 || viewport.scrollHeight > viewport.clientHeight + 1) }));
      assert.equal(documents.internalScroll, false, `all documents fit their cards at ${width}px`);
      if (width >= 1024) assert.ok(documents.bottom <= 900, `all documents are visible in a 900px-high desktop inspection viewport at ${width}px: ${JSON.stringify(documents)}`);
      if (width === 320) await page.screenshot({ path: (process.env.TEMP || '/tmp') + '/fraud-inspection-phone.png' });
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
    assert.ok(await page.locator('#fraud-document-grid [data-fraud-card="check"] .fraud-doc-viewport').evaluate((viewport) => viewport.scrollHeight <= viewport.clientHeight + 1), 'full check and payee endorsement are visible without vertical scrolling inside the card');
    await page.screenshot({ path: (process.env.TEMP || '/tmp') + '/fraud-inspection-desktop.png', fullPage: true });

    await page.locator('[data-issue-id="payee-mismatch"]').click();
    assert.equal(await page.locator('[data-issue-id="payee-mismatch"]').getAttribute('aria-pressed'), 'true', 'learner can label a suspected issue');
    assert.equal(await page.locator('#fraud-document-grid .fraud-marked').count(), 0, 'selecting an issue does not expose the answer before submission');
    await page.locator('#submit-fraud-inspection').click();
    await page.locator('#feedback-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#feedback-heading').textContent(), 'Correct review');
    assert.match(await page.locator('#fraud-feedback-issues').textContent(), /Correct selection/);
    assert.ok(await page.locator('#fraud-feedback-documents .fraud-marked').count() >= 1, 'review feedback marks the actual issue after submission');
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-handling-terminal-quiz-history-v1') || '[]')
      .some((record) => record.game === 'fraud-inspection' && record.fraudExpectedCategories?.includes('payee-mismatch'))));

    await page.locator('#next-question').click();
    await page.locator('#summary-screen').waitFor({ state: 'visible' });
    assert.match(await page.locator('#session-metrics').textContent(), /Cases reviewed/);
    await page.locator('#summary-history').click();
    await page.locator('#history-screen').waitFor({ state: 'visible' });
    await page.locator('#history-game-tabs [data-history-game="fraud-inspection"]').click();
    await page.locator('#fraud-history-panel').waitFor({ state: 'visible' });
    assert.match(await page.locator('#fraud-history-metrics').textContent(), /Median inspection time/);
    assert.match(await page.locator('#fraud-history-categories').textContent(), /Payee name does not match ID/);
    assert.match(await page.locator('#history-game-filters').textContent(), /Actual issue category/);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
  console.log('Fraud Inspection: custom timer, isolated category, document zoom, 320–1440px layout, scoring, feedback highlights, local history and progress passed.');
}
