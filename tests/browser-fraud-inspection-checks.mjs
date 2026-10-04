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
    await page.clock.install();
    await page.clock.pauseAt(new Date());
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
    assert.equal(await page.locator('#fraud-document-grid > *').count(), 2);
    assert.equal(await page.locator('#fraud-document-grid .fraud-document-card:visible').count(), 2);
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
    await page.locator('#fraud-reader-next').click();
    assert.equal(await page.locator('#fraud-document-dialog-view h3').textContent(), 'Printed check number');
    await page.locator('#close-fraud-document-dialog').click();
    await page.locator('#fraud-document-grid [data-fraud-id-switch="maker-id"]').click();
    assert.equal(await page.locator('#fraud-document-grid [data-fraud-card="payee-id"]').isVisible(), false);
    assert.equal(await page.locator('#fraud-document-grid [data-fraud-card="maker-id"]').isVisible(), true);
    await page.locator('#fraud-document-grid [data-fraud-id-switch="maker-id"]').press('ArrowLeft');
    assert.equal(await page.locator('#fraud-document-grid [data-fraud-card="payee-id"]').isVisible(), true);
    await page.locator('#fraud-document-grid [data-fraud-id-switch="maker-id"]').click();
    await page.locator('[data-fraud-document-action="enlarge"][data-fraud-document="maker-id"]').click();
    assert.equal(await page.locator('#fraud-document-dialog-heading').textContent(), 'Payer / maker identification');
    assert.equal(await page.locator('#fraud-document-dialog-view [data-region="maker-id-signature"]').count(), 1);
    await page.locator('#close-fraud-document-dialog').click();

    await checkReadableFraudDocuments(page);

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'inspection screen fits ' + width + 'px');
      assert.equal(await page.locator('#fraud-document-grid .fraud-document-card').count(), 3);
      const documents = await page.locator('#fraud-document-grid').evaluate((grid) => ({ bottom: grid.getBoundingClientRect().bottom,
        internalScroll: [...grid.querySelectorAll('.fraud-doc-viewport')].some((viewport) => viewport.scrollWidth > viewport.clientWidth + 1 || viewport.scrollHeight > viewport.clientHeight + 1) }));
      assert.equal(documents.internalScroll, false, `all documents fit their cards at ${width}px`);
      if (width >= 1440) await page.screenshot({ path: (process.env.TEMP || '/tmp') + '/fraud-layout-debug.png', fullPage: true });
      if (width === 320) await page.screenshot({ path: (process.env.TEMP || '/tmp') + '/fraud-inspection-phone.png' });
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
    for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
      await page.setViewportSize({ width, height });
      const geometry = await page.locator('#fraud-document-grid [data-fraud-card="check"] .fraud-doc-viewport').evaluate(viewport => {
        const svg = viewport.querySelector('svg');
        return {ratio:svg.getBoundingClientRect().width/viewport.clientWidth, aspect:svg.getBoundingClientRect().height/svg.getBoundingClientRect().width, fits:viewport.scrollHeight<=viewport.clientHeight+1};
      });
      assert.ok(geometry.ratio >= .98 && geometry.fits, `check fills panel without internal cropping at ${width}×${height}: ${JSON.stringify(geometry)}`);
      assert.ok(Math.abs(geometry.aspect - 690/860) < .01, 'full document aspect ratio preserved');
      assert.equal(await page.locator('.fraud-profile-icon').count(), 2);
      assert.ok(await page.locator('.fraud-readable-details dd').evaluateAll(fields => fields.every(field => parseFloat(getComputedStyle(field).fontSize) >= 16)));
      await page.screenshot({ path: (process.env.TEMP || '/tmp') + `/fraud-inspection-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
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
    assert.ok(await page.evaluate(async() => JSON.parse((await import('./firebase-accounts.mjs?v=20261004-private')).accountStorage.getItem('cash-handling-terminal-quiz-history-v1') || '[]')
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
  console.log('Fraud Inspection: distinct portraits, readable document pages across phone/tablet/desktop and landscape, scoring, feedback, local history and progress passed.');
}

async function checkReadableFraudDocuments(page) {
  const portraits = await page.locator('#fraud-document-grid image').evaluateAll((images) => images.map((image) => image.getAttribute('href')));
  assert.equal(new Set(portraits).size, 2, 'payer and payee show different portraits');
  for (const [width, height] of [[320, 568], [390, 844], [568, 320], [768, 1024], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.locator('#read-fraud-documents').click();
    for (const kind of ['check', 'maker-id', 'payee-id']) {
      await page.locator('[data-fraud-reader-kind="' + kind + '"]').click();
      const detailCount = await page.locator('#fraud-reader-field option').count();
      for (let index = 0; index < detailCount; index += 1) {
        await page.locator('#fraud-reader-field').selectOption(String(index));
        const geometry = await page.locator('#fraud-document-dialog').evaluate((dialog) => {
          const view = dialog.querySelector('.fraud-reader-content');
          const svg = view.querySelector('svg');
          const rect = dialog.getBoundingClientRect();
          const visible = [...dialog.querySelectorAll('button,select,h3,.fraud-reader-value,svg')].filter((element) => element.getClientRects().length && !element.hidden);
          return {
            fits: rect.top >= 0 && rect.bottom <= innerHeight + 1 && rect.left >= 0 && rect.right <= innerWidth + 1,
            noScroll: [dialog, view].every((element) => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1),
            contentFits: visible.every((element) => { const box = element.getBoundingClientRect(); return box.top >= rect.top && box.bottom <= rect.bottom + 1 && box.left >= rect.left && box.right <= rect.right + 1; }),
            textSizes: [...view.querySelectorAll('h3,.fraud-reader-value')].filter((element) => !element.hidden).map((element) => parseFloat(getComputedStyle(element).fontSize)),
            canvasHeight: svg.getBoundingClientRect().height,
            title: view.querySelector('h3').textContent,
          };
        });
        const message = `${width}×${height} ${kind} detail ${index}: ${JSON.stringify(geometry)}`;
        assert.ok(geometry.fits && geometry.noScroll && geometry.contentFits, message);
        assert.ok(geometry.textSizes.every((size) => size >= 16), message);
        assert.ok(geometry.canvasHeight >= 24, message);
        if (geometry.title.toLowerCase().includes('signature')) {
          const region = kind === 'maker-id' ? 'maker-id-signature' : kind === 'payee-id' ? 'id-signature' : geometry.title.startsWith('Payee') ? 'check-endorsement' : 'check-maker-signature';
          const renderedPaths = await page.locator('#fraud-document-dialog-view [data-region="' + region + '"] .fraud-signature path').evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
          const originalPaths = await page.locator('#fraud-document-grid [data-region="' + region + '"] .fraud-signature path').evaluateAll((paths) => paths.map((path) => path.getAttribute('d')));
          assert.deepEqual(renderedPaths, originalPaths, 'reader preserves the original handwriting');
          if (width === 320 && kind === 'maker-id') await page.screenshot({ path: (process.env.TEMP || '/tmp') + '/fraud-readable-phone-signature.png' });
          if (width === 568 && kind === 'check') await page.screenshot({ path: (process.env.TEMP || '/tmp') + '/fraud-readable-landscape-signature.png' });
        }
      }
    }
    await page.locator('#fraud-reader-field').selectOption('2');
    await page.locator('#fraud-reader-next').click();
    assert.equal(await page.locator('#fraud-reader-field').inputValue(), '3');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#fraud-reader-field').inputValue(), '2');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#fraud-document-dialog').isVisible(), false);
  }
}
