import assert from 'node:assert/strict';

const historyKey = 'cash-handling-terminal-quiz-history-v1';
const sampleKey = 'cash-handling-terminal-quiz-sample-history-v1';
const challengeKey = 'cash-handling-terminal-quiz-current-challenge-v1';

export async function checkSampleHistory(browser, site) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const realRows = [{
    game: 'cash', gameType: 'Cash handling', sessionId: 'owned-real-session', questionNumber: 1,
    timestamp: new Date().toISOString(), difficulty: 'Easy', outcome: 'Correct', timeUsedSeconds: 5,
    amountDueCents: 1000, cashGivenCents: 1500, tenderBreakdown: [{ cents: 500, category: 'Bill', count: 1 }],
    tenderBillCount: 1, tenderCoinCount: 0, tenderPieceCount: 1, tenderDenominationTypes: 1,
    cashTransactionType: 'Change', changeOrShortfallCents: 500, expectedAnswer: 'Change 500¢', userAnswer: 'Change',
  }];
  await page.addInitScript(({ key, rows }) => {
    let randomState = 0x6d2b79f5;
    Math.random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 4294967296;
    };
    localStorage.setItem(key, JSON.stringify(rows));
  }, { key: historyKey, rows: realRows });
  try {
    await page.goto(site);
    await page.locator('#open-history').click();
    assert.equal(await page.locator('#history-data-source input[value="real"]').isChecked(), true, 'Real Data is the default');
    assert.equal(await page.locator('#history-metrics .metric strong').first().textContent(), '1');
    const original = await page.evaluate((key) => localStorage.getItem(key), historyKey);
    const originalChallenge = await page.evaluate((key) => localStorage.getItem(key), challengeKey);

    await page.locator('#history-data-source input[value="sample"]').check();
    await page.locator('#history-sample-banner').waitFor({ state: 'visible' });
    assert.match(await page.locator('#history-sample-banner').innerText(), /SAMPLE DATA MODE/);
    assert.equal(Number((await page.locator('#history-metrics .metric strong').first().textContent()).replaceAll(',', '')), 1200);
    assert.match(await page.locator('#history-error-data-label').textContent(), /Based on Sample Data/);
    assert.match(await page.locator('#history-error-metrics').innerText(), /Overall error rate/);
    assert.ok(await page.locator('#history-error-category-table tbody tr').count() > 1, 'sample mode has game-specific error categories');
    assert.ok(await page.locator('#history-error-raw-table tbody tr').count() > 1, 'sample mode has raw-input error rates');
    assert.ok(await page.locator('#history-error-combination-table tbody tr').count() > 1, 'sample mode has input-combination rates');
    assert.equal(await page.locator('#history-rows tr').first().locator('td').count(), 8, 'sample attempt rows include both error fields');
    assert.equal(await page.locator('#history-rows tr').count(), 100, 'attempt table remains bounded');
    assert.match(await page.locator('#history-attempt-summary').textContent(), /100 most recent.*1,200/);
    assert.equal(await page.locator('#clear-history').isDisabled(), true, 'real history clear is disabled in sample mode');
    assert.match(await page.locator('#history-insights').innerText(), /Based on Sample Data/);
    assert.equal(await page.locator('#history-recommendations button').filter({ hasText: 'Based on Sample Data' }).count(), 0);
    if (await page.locator('#history-recommendations .sample-recommendation-note').count()) {
      assert.equal(await page.locator('#history-recommendations button').filter({ hasText: 'Practice plan unavailable' }).isDisabled(), true);
    }
    const firstDataset = await page.evaluate((key) => sessionStorage.getItem(key), sampleKey);
    assert.ok(firstDataset?.includes('"isSample":true'), 'sample rows live in session storage');

    for (const [range, expectedMin] of [['today', 1], ['yesterday', 1], ['7d', 1], ['30d', 500], ['30a', 30], ['50a', 50], ['all', 1200]]) {
      await page.locator(`#history-quick-ranges button[data-history-range="${range}"]`).click();
      const value = Number((await page.locator('#history-metrics .metric strong').first().textContent()).replaceAll(',', ''));
      assert.ok(value >= expectedMin, `${range} includes expected sample attempts`);
      assert.ok(await page.locator('#history-rows tr').count() > 0, `${range} renders attempt rows`);
      assert.match(await page.locator('#history-error-data-label').textContent(), /Based on Sample Data/, `${range} keeps the sample label`);
      assert.ok((await page.locator('#history-error-metrics .metric strong').first().textContent()).match(/%$/), `${range} recalculates error rate`);
      assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), sampleKey), firstDataset, `${range} reuses the same sample history`);
    }
    const today = await page.evaluate(() => {
      const date = new Date();
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 10);
    });
    const dateInputs = page.locator('#history-common-filters input[type="date"]');
    await dateInputs.nth(0).fill(today);
    await dateInputs.nth(1).fill(today);
    assert.ok(Number((await page.locator('#history-metrics .metric strong').first().textContent()).replaceAll(',', '')) > 0, 'custom date range returns generated attempts');

    const gameFilters = {
      cash: 'Contains denominations', memory: 'Digits per value', task: 'Workflow',
      'error-detection': 'Puzzle family', 'fraud-inspection': 'Actual issue category',
    };
    for (const [game, field] of Object.entries(gameFilters)) {
      await page.locator(`#history-game-tabs button[data-history-game="${game}"]`).click();
      assert.match(await page.locator('#history-game-filters').innerText(), new RegExp(field));
      assert.ok(Number((await page.locator('#history-metrics .metric strong').first().textContent()).replaceAll(',', '')) > 0, `${game} has matching attempts`);
      assert.ok(await page.locator('#history-charts .interactive-chart').count() > 0, `${game} populates charts`);
    }
    await page.locator('#history-game-tabs button[data-history-game="all"]').click();
    const daily = page.locator('#history-charts .interactive-chart[data-chart-kind="line"]').filter({ has: page.getByRole('heading', { name: 'Accuracy over time' }) });
    const path = await daily.locator('.chart-series-line').getAttribute('d');
    assert.ok((path?.match(/M /g) ?? []).length >= 2, 'line charts stop at missing-day gaps instead of joining unrelated dates');
    const renderedColors = await page.locator('#history-charts .analytics-mark').evaluateAll((marks) => marks.map((mark) => getComputedStyle(mark).fill));
    assert.ok(renderedColors.length > 0 && renderedColors.every((color) => color && color !== 'none' && color !== 'transparent'), 'all plotted marks have a visible color');
    assert.ok(await page.locator('#history-charts .chart-category-legend').count() > 0, 'categorical bars show category swatches');
    const scatter = page.locator('#history-charts .interactive-chart[data-chart-kind="scatter"]').first();
    assert.ok(await scatter.locator('.analytics-mark').count() >= 3, 'scatter plot renders value-bearing points');
    if (await scatter.locator('.analytics-mark').count() < 4) assert.match(await scatter.locator('.analytics-mark[aria-label*="overlapping"]').first().getAttribute('aria-label'), /overlapping/, 'coincident data points remain visible as one drillable point');
    assert.ok(await scatter.locator('.chart-hue-legend').count() === 1, 'scatter plot has a right-side continuous color scale');
    assert.equal(await scatter.locator('.chart-hue-gradient span').count(), 101, 'hue scale uses the same continuous color mapping');
    assert.equal(await scatter.locator('.chart-hue-ticks span').count(), 5);
    assert.ok(await scatter.locator('.chart-axis-title').count() >= 2, 'scatter plot labels both axes');
    const colors = await scatter.evaluate((card) => {
      const marks = [...card.querySelectorAll('.analytics-mark')];
      const hue = card.querySelector('.chart-hue-legend');
      const values = marks.map((mark) => Number(mark.getAttribute('aria-label').match(/: ([\d.]+)% from/)?.[1]));
      const low = Math.min(...values); const high = Math.max(...values);
      const ratio = high === low ? 0.5 : (values[0] - low) / (high - low);
      const expectedHue = 7 + 128 * ratio;
      const actualHue = Number(marks[0].style.getPropertyValue('--chart-color').match(/hsl\(([\d.]+)/)?.[1]);
      const ticks = [...hue.querySelectorAll('.chart-hue-ticks span')].map((tick) => Number(tick.textContent.replace('%', '')));
      return { values, low, high, expectedHue, actualHue, ticks };
    });
    assert.ok(Math.abs(colors.actualHue - colors.expectedHue) < 0.02, 'scatter point hue matches its actual Y value');
    assert.equal(colors.ticks[0], colors.high, 'hue maximum matches the plotted maximum');
    assert.equal(colors.ticks.at(-1), colors.low, 'hue minimum matches the plotted minimum');
    assert.ok(await scatter.locator('.chart-hover').count(), 'scatter has a hover status area');
    await scatter.locator('.analytics-mark').first().hover();
    assert.match(await scatter.locator('.chart-hover').textContent(), /% from .* attempts/);
    await scatter.locator('.analytics-mark').first().click();
    const detailOpened = await page.locator('#attempt-detail-dialog').evaluate((dialog) => dialog.open);
    assert.equal(detailOpened, true, 'tapping a plotted point opens its attempt details');
    assert.match(await page.locator('#attempt-detail-summary').textContent(), /X .* seconds; Y .*%/);
    for (const field of ['When', 'Session', 'Attempt', 'Difficulty', 'Details']) assert.ok(await page.locator('#attempt-detail-dialog').getByText(field, { exact: true }).count() || await page.locator('#attempt-detail-dialog').locator(`th:has-text("${field}")`).count(), `${field} is available in scatter detail`);
    await page.locator('#close-attempt-detail').click();

    await page.locator('#history-data-source input[value="real"]').check();
    assert.equal(await page.locator('#history-metrics .metric strong').first().textContent(), '1', 'returning to Real Data restores the actual attempt view');
    assert.match(await page.locator('#history-rows').innerText(), /Change 500¢/);
    assert.equal(await page.locator('#history-sample-banner').isVisible(), false);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), historyKey), original);
    await page.locator('#history-data-source input[value="sample"]').check();

    await page.locator('#history-regenerate-sample').click();
    await page.waitForFunction((key) => sessionStorage.getItem(key)?.length > 0, sampleKey);
    const regenerated = await page.evaluate((key) => sessionStorage.getItem(key), sampleKey);
    assert.notEqual(regenerated, firstDataset, 'Regenerate Sample Data creates another dataset');
    assert.equal(Number((await page.locator('#history-metrics .metric strong').first().textContent()).replaceAll(',', '')), 1200);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), historyKey), original, 'switching, filtering, and regenerating never changes real history');
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), challengeKey), originalChallenge, 'sample recommendations do not change the saved real challenge');

    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, width: innerWidth,
        elements: [...document.querySelectorAll('*')].filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 8).map((element) => `${element.tagName}#${element.id}.${element.className?.baseVal ?? element.className}: ${Math.round(element.getBoundingClientRect().right)}`),
        layout: ['.app-shell', '#history-screen', '.history-charts', '#history-charts', '.interactive-chart[data-chart-kind="scatter"]'].map((selector) => {
          const element = document.querySelector(selector); const rect = element?.getBoundingClientRect();
          return { selector, left: rect?.left, width: rect?.width, right: rect?.right, grid: element ? getComputedStyle(element).gridTemplateColumns : null };
        }),
        tables: [...document.querySelectorAll('table')].filter((table) => table.getBoundingClientRect().right > innerWidth + 1)
          .map((table) => ({ text: table.innerText.slice(0, 50), parent: table.parentElement?.className, parentWidth: table.parentElement?.getBoundingClientRect().width, open: table.closest('dialog')?.open })) }));
      assert.ok(overflow.page <= overflow.width, `sample history fits ${width}px without horizontal overflow: ${JSON.stringify(overflow)}`);
      const hueLayout = await scatter.locator('.chart-plot-layout').evaluate((layout) => ({
        columns: getComputedStyle(layout).gridTemplateColumns,
        chart: layout.querySelector('svg').getBoundingClientRect().width,
        scale: layout.querySelector('.chart-hue-legend').getBoundingClientRect().width,
        width: layout.getBoundingClientRect().width,
      }));
      if (width === 320) assert.equal(hueLayout.columns.trim().split(/\s+/).length, 1, 'mobile places the hue scale below a full-width chart');
      if (width === 1440) assert.ok(hueLayout.chart > hueLayout.scale * 2, 'desktop keeps the chart readable beside the scale');
    }
    assert.deepEqual(errors, [], `sample-history browser errors: ${errors.join('\n')}`);
  } finally {
    await context.close();
  }

  const emptyContext = await browser.newContext();
  try {
    const emptyPage = await emptyContext.newPage();
    await emptyPage.addInitScript((key) => localStorage.setItem(key, '[]'), historyKey);
    await emptyPage.goto(site);
    await emptyPage.locator('#open-history').click();
    assert.match(await emptyPage.locator('#history-empty-real').innerText(), /No real history yet\./);
    await emptyPage.locator('#history-view-sample').click();
    assert.match(await emptyPage.locator('#history-sample-banner').innerText(), /SAMPLE DATA MODE/);
    assert.equal(Number((await emptyPage.locator('#history-metrics .metric strong').first().textContent()).replaceAll(',', '')), 1200);
    assert.equal(await emptyPage.evaluate((key) => localStorage.getItem(key), historyKey), '[]', 'sample mode leaves an empty real history empty');
    assert.equal(await emptyPage.evaluate((key) => localStorage.getItem(key), challengeKey), null, 'sample mode creates no persistent real recommendation');
  } finally {
    await emptyContext.close();
  }
  console.log('Sample History: source isolation, filters, five games, charts, hue scales, details, regeneration, empty state, and responsive stress checks passed');
}
