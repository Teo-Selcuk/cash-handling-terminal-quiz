import assert from 'node:assert/strict';

const historyKey = 'cash-handling-terminal-quiz-history-v1';
const timestamp = (minute) => new Date(Date.UTC(2026, 8, 1, 9, minute)).toISOString();
const dayTimestamp = (day) => new Date(Date.UTC(2026, 8, 1 + day, 9)).toISOString();
const base = (game, index, extra) => ({
  game, gameType: ({ cash: 'Cash handling', memory: 'Number memory', task: 'Task simulation', 'error-detection': 'Error detection' })[game],
  sessionId: `${game}-${index}`, questionNumber: 1, timestamp: timestamp(index), difficulty: 'Easy',
  outcome: index % 3 === 0 ? 'Incorrect' : 'Correct', timeUsedSeconds: index % 3 === 0 ? 18 : 6, ...extra,
});

const fixtures = [
  ...Array.from({ length: 6 }, (_, index) => base('cash', index, {
    amountDueCents: 12500, cashGivenCents: 22500, tenderBreakdown: [{ cents: 10000, category: 'Bill', count: 2 }, { cents: 2500, category: 'Bill', count: 1 }],
    tenderBillCount: 3, tenderCoinCount: 0, tenderPieceCount: 3, tenderDenominationTypes: 2, cashTransactionType: 'Change', changeOrShortfallCents: 10000,
    customerBillRequestKind: 'specific', customerRequestResult: 'Handled', answerMode: 'Cash builder', cashBuilder: true, customerRequests: true,
  })),
  ...Array.from({ length: 6 }, (_, index) => base('memory', index + 10, {
    expectedValues: ['12345678'], answeredValues: ['12345670'], digitsByValue: [8], totalDigits: 8, decimalMode: false, valueCount: 1,
    readTimeSeconds: 4, writeTimeSeconds: 8, correctValueCount: 0, mismatchPositions: [8],
  })),
  ...Array.from({ length: 6 }, (_, index) => base('task', index + 20, {
    workspaceKind: 'invoice', workspaceRows: 6, workspaceTabs: 3, briefingSeconds: 15, recallSeconds: 60, demoStepMilliseconds: 1200,
    stepsExpected: 5, stepsCompleted: 3, mistakes: 2, sequenceAccuracyPercent: 60, taskMistakeCategories: ['missing', 'out-of-order'],
  })),
  ...Array.from({ length: 6 }, (_, index) => base('error-detection', index + 30, {
    puzzleFamilyId: 'cipher-check', puzzleType: 'Analytical', ruleLayers: 2, detailCount: 5, expectedErrorCount: 2, selectedErrorCount: 1,
    missedAnomalyCount: 1, falseFlagCount: 0, cleanPuzzle: false, timeLimitSeconds: 28,
  })),
];

const manySessions = Array.from({ length: 300 }, (_, index) => base('cash', index + 100, {
  sessionId: `scrollable-session-${String(index + 1).padStart(3, '0')}`,
  difficulty: ['Easy', 'Medium', 'Hard'][index % 3],
  timestamp: dayTimestamp(index + 100),
  timeUsedSeconds: 4 + (index % 24),
}));

const labels = {
  cash: ['Contains denominations', 'Total pieces', 'Customer request'],
  memory: ['Digits per value', 'Total digit load', 'Mismatch position'],
  task: ['Workflow', 'Expected steps', 'Mistake category'],
  'error-detection': ['Puzzle family', 'Rule layers', 'Clean puzzle'],
};

export async function checkProgress(browser, site) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(({ key, rows }) => localStorage.setItem(key, JSON.stringify(rows)), { key: historyKey, rows: [...fixtures, ...manySessions] });
  try {
    await page.goto(site);
    await page.locator('#open-history').click();
    assert.match(await page.locator('#history-heading').textContent(), /History \| Progress \| Charts \| Attempts/);
    assert.equal(await page.locator('#history-error-analysis').isVisible(), true, 'filtered Error Analysis is available in History');
    assert.match(await page.locator('#history-error-data-label').textContent(), /saved real gameplay/);
    assert.match(await page.locator('#history-error-metrics').innerText(), /Overall error rate.*108\/324/s);
    assert.ok(await page.locator('#history-error-category-table tbody tr').count() > 0, 'game-specific error categories render');
    assert.ok(await page.locator('#history-error-combination-table tbody tr').count() > 0, 'supported raw-input combinations render');
    assert.ok(await page.locator('#history-error-charts h4').allTextContents().then((titles) => titles.includes('Error Rate by Category') && titles.includes('Error Rate by Raw Input') && titles.includes('Error Rate Over Time')),
      'category, raw-input, and trend charts render when their saved fields exist');
    assert.equal(await page.locator('#history-rows tr').first().locator('td').count(), 8, 'attempt table includes raw-input and numeric-error columns');
    assert.equal(await page.locator('#qralarm-connection').evaluate((details) => details.open), false);
    await page.locator('#qralarm-connection summary').click();
    assert.equal(await page.locator('#qralarm-connection').evaluate((details) => details.open), true);
    const sessions = page.locator('.history-session-picker');
    assert.equal(await sessions.count(), 1);
    assert.equal(await sessions.locator('input[type="checkbox"]').count(), 324);
    assert.equal(await sessions.evaluate((picker) => picker.open), false);
    await sessions.locator('summary').click();
    assert.equal(await sessions.evaluate((picker) => picker.open), true);
    assert.ok(await sessions.locator('.history-session-options').evaluate((panel) => panel.scrollHeight > panel.clientHeight), 'large session list scrolls inside its bounded picker');
    assert.ok(await sessions.evaluate((picker) => picker.getBoundingClientRect().height < 100), 'opening session picker does not stretch the page');
    await sessions.locator('label').filter({ hasText: 'scrollable-session-300' }).click();
    assert.equal(await sessions.locator('input[type="checkbox"]:checked').count(), 1);
    for (const game of Object.keys(labels)) {
      await page.locator(`#history-game-tabs button[data-history-game="${game}"]`).click();
      const text = await page.locator('#history-game-filters').textContent();
      labels[game].forEach((label) => assert.match(text, new RegExp(label)));
    }
    await page.locator('#history-game-tabs button[data-history-game="cash"]').click();
    await page.locator('#history-game-filters label').filter({ hasText: '$100.00' }).first().click();
    await page.locator('#history-common-filters label').filter({ hasText: 'Incorrect' }).first().click();
    assert.ok(await page.locator('#history-rows tr').count(), 'compound filters keep their intersection visible');
    await page.locator('#clear-history-filters').click();
    const conditions = page.locator('#history-insights select');
    await conditions.nth(0).selectOption('cash|Transaction|Change');
    await conditions.nth(1).selectOption('cash|Hundred-dollar bills|Two or more');
    assert.match(await page.locator('#history-insights').innerText(), /4\/6; 95% Wilson interval/);
    await page.locator('#clear-history-filters').click();
    await page.locator('#history-quick-ranges button[data-history-range="50a"]').click();
    assert.equal(await page.locator('#history-quick-ranges button[data-history-range="50a"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('#history-insights').innerText(), /Correct by:.*5s.*10s.*15s/s);
    assert.ok(await page.locator('#history-error-charts .interactive-chart').filter({ has: page.getByRole('heading', { name: 'Error Rate Over Time' }) }).count() === 1,
      'the 50-attempt legacy selection recalculates its supported error trend');
    assert.match(await page.locator('#history-error-metrics').innerText(), /Overall error rate/);
    await page.locator('#error-analysis-sort').selectOption('alphabetical');
    assert.equal(await page.locator('#error-analysis-sort').inputValue(), 'alphabetical', 'error breakdowns can be sorted');
    await page.locator('#error-analysis-sort').selectOption('error-rate');
    const chart = page.locator('#history-charts .interactive-chart').first();
    assert.ok(await chart.locator('.chart-axis').count() >= 2, 'charts render visible X and Y axes');
    assert.ok(await chart.locator('.chart-axis-title').count() >= 2, 'charts label both axes');
    assert.ok(await chart.locator('.chart-y-tick').count() >= 3, 'charts show numeric Y-axis ticks');
    assert.equal(await chart.locator('.chart-series-line').count(), 1, 'time-series points are connected');
    assert.ok(await page.locator('#history-charts .interactive-chart').locator('.chart-value-label').count(), 'bar chart values are visible');
    assert.match(await page.locator('#history-accuracy-chart .bar-chart-axis').innerText(), /Difficulty.*Accuracy.*0%.*100%/s, 'summary bar chart labels its category and numeric axis');
    await chart.getByRole('button', { name: 'Hide data' }).click();
    await chart.getByRole('button', { name: 'Show data' }).click();
    await chart.getByRole('button', { name: 'Zoom in' }).click();
    assert.match(await chart.locator('.analytics-svg').getAttribute('data-chart-window'), /:\d+$/);
    await chart.getByRole('button', { name: 'Later' }).click();
    await chart.getByRole('button', { name: 'Earlier' }).click();
    await chart.getByRole('button', { name: 'Reset' }).click();
    const scatter = page.locator('#history-charts .interactive-chart').filter({ has: page.getByRole('heading', { name: 'Speed versus accuracy' }) });
    assert.equal(await scatter.locator('.analytics-mark').count(), 3, 'scatter has one point for each difficulty');
    const scatterFull = await scatter.locator('.analytics-svg').getAttribute('data-chart-window');
    await scatter.getByRole('button', { name: 'Zoom in' }).click();
    const scatterZoomed = await scatter.locator('.analytics-svg').getAttribute('data-chart-window');
    assert.notEqual(scatterZoomed, scatterFull, 'first scatter zoom changes its numeric time domain');
    await scatter.getByRole('button', { name: 'Zoom out' }).click();
    assert.equal(await scatter.locator('.analytics-svg').getAttribute('data-chart-window'), scatterFull, 'scatter zoom out restores the full domain');
    assert.equal(await scatter.locator('.chart-series-segment').count(), 0, 'scatter dots have no implied connecting line');
    const scatterBox = await scatter.locator('.analytics-svg').boundingBox();
    await page.mouse.move(scatterBox.x + scatterBox.width * .2, scatterBox.y + scatterBox.height * .45);
    await page.mouse.down();
    await page.mouse.move(scatterBox.x + scatterBox.width * .9, scatterBox.y + scatterBox.height * .45);
    await page.mouse.up();
    assert.notEqual(await scatter.locator('.analytics-svg').getAttribute('data-chart-window'), scatterFull, 'scatter drag selection changes its time domain');
    await scatter.getByRole('button', { name: 'Reset' }).click();
    assert.equal(await scatter.locator('.analytics-svg').getAttribute('data-chart-window'), scatterFull);
    const svg = chart.locator('.analytics-svg');
    const initialWindow = await svg.getAttribute('data-chart-window');
    await chart.scrollIntoViewIfNeeded();
    const bounds = await svg.boundingBox();
    assert.ok(bounds, 'chart has a visible plot area for selection zoom');
    await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.45);
    await page.mouse.up();
    assert.notEqual(await chart.locator('.analytics-svg').getAttribute('data-chart-window'), initialWindow, 'dragging a chart range zooms to the selected marks');
    assert.ok(await chart.locator('.chart-selection-hint').count(), 'charts explain drag-to-zoom interaction');
    assert.ok(await page.locator('#history-charts .chart-value-danger').count(), 'low accuracy and incorrect outcomes use a distinct warning color');
    assert.ok(await page.locator('#history-charts .chart-value-series-1').count(), 'category bars use more than one series color');
    const lightMarkColor = await chart.locator('.analytics-mark circle').first().evaluate((mark) => getComputedStyle(mark).fill);
    await page.locator('#theme-toggle').click();
    assert.notEqual(await chart.locator('.analytics-mark circle').first().evaluate((mark) => getComputedStyle(mark).fill), lightMarkColor, 'chart colors adapt to dark mode');
    await page.locator('#theme-toggle').click();
    await chart.locator('.analytics-mark').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#attempt-detail-dialog').evaluate((dialog) => dialog.open), true);
    assert.match(await page.locator('#attempt-detail-summary').textContent(), /contributing attempt/);
    await page.locator('#close-attempt-detail').click();
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, width: innerWidth,
        elements: [...document.querySelectorAll('*')].filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 8).map((element) => `${element.tagName}#${element.id}.${element.className?.baseVal ?? element.className}: ${Math.round(element.getBoundingClientRect().right)}`) }));
      assert.ok(overflow.page <= overflow.width, `progress history fits ${width}px: ${JSON.stringify(overflow)}`);
      if (width === 1440) {
        assert.ok(await page.locator('.app-shell').evaluate((shell) => shell.getBoundingClientRect().width >= 1400), 'desktop layout uses the available width');
        assert.ok(await chart.locator('.analytics-svg').evaluate((svg) => svg.getBoundingClientRect().height >= 320), 'desktop charts have a readable height');
      }
    }
    assert.deepEqual(errors, []);
    console.log('Progress history: game-specific filters, chart controls, keyboard drill-down, QR Alarm collapse, and responsive layouts passed');
  } finally {
    await context.close();
  }
}
