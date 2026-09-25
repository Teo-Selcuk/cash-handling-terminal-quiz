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
    assert.equal(await page.locator('#history-error-charts .interactive-chart button:text-is("Maximize")').count(), await page.locator('#history-error-charts .interactive-chart').count(), 'every error chart has a maximize control');
    await page.setViewportSize({ width: 1440, height: 900 });
    const chartRows = await page.locator('#history-error-charts .interactive-chart').evaluateAll((cards) => cards.slice(0, 3).map((card) => Math.round(card.getBoundingClientRect().top)));
    assert.equal(chartRows[0], chartRows[1], 'two error charts share the first desktop row');
    assert.ok(chartRows[2] > chartRows[1], 'a third error chart starts a new row');
    const summaryCards = page.locator('.history-visuals .visual-card');
    assert.equal(await summaryCards.count(), 2);
    assert.ok(await summaryCards.nth(1).evaluate((card) => card.getBoundingClientRect().height < 500), 'accuracy summary keeps its color scale compact');
    for (const id of ['outcomes', 'accuracy-by-difficulty']) {
      await page.locator(`[data-chart-data="${id}"]`).click();
      assert.equal(await page.locator('#chart-data-dialog').evaluate((dialog) => dialog.open), true, `${id} opens a data table`);
      assert.ok(await page.locator('#chart-data-content tbody tr').count() > 0);
      await page.locator('#close-chart-data').click();
    }
    assert.equal(await page.locator('.interactive-chart .chart-controls button:text-is("Data table")').count(), await page.locator('.interactive-chart').count(), 'every interactive chart offers a table');
    assert.equal(await page.locator('.interactive-chart .chart-controls button:text-is("Appearance")').count(), await page.locator('.interactive-chart').count(), 'every interactive chart offers appearance settings');
    await page.locator('#history-error-charts .interactive-chart').first().getByRole('button', { name: 'Data table' }).click();
    assert.ok(await page.locator('#chart-data-content tbody tr').count() > 0, 'error chart table contains values');
    await page.locator('#chart-data-dialog').press('Escape');
    assert.equal(await page.locator('#chart-data-dialog').evaluate((dialog) => dialog.open), false, 'Escape closes the table');
    await page.locator('[data-chart-settings="outcomes"]').click();
    await page.locator('#chart-settings-scope').selectOption('all');
    await page.locator('#chart-settings-palette').selectOption('ocean');
    await page.locator('#chart-settings-label-color').selectOption('blue');
    await page.locator('#chart-settings-bold').uncheck();
    await page.locator('#chart-settings-form button[type="submit"]').click();
    assert.equal(await page.locator('#history-error-charts .chart-value-label').first().evaluate((label) => getComputedStyle(label).fontWeight), '400', 'all-chart label weight applies');
    const lightLabelColor = await page.locator('#history-error-charts .chart-value-label').first().evaluate((label) => getComputedStyle(label).fill);
    await page.locator('#theme-toggle').click();
    assert.notEqual(await page.locator('#history-error-charts .chart-value-label').first().evaluate((label) => getComputedStyle(label).fill), lightLabelColor, 'selected label color adapts to dark mode');
    await page.locator('#theme-toggle').click();
    const oceanFill = await page.locator('#history-accuracy-chart .bar-chart-fill').first().evaluate((fill) => getComputedStyle(fill).backgroundColor);
    const oceanError = await page.locator('#history-error-charts .analytics-mark').first().evaluate((mark) => getComputedStyle(mark).fill);
    await page.locator('#history-error-charts .interactive-chart').first().getByRole('button', { name: 'Appearance' }).click();
    await page.locator('#chart-settings-palette').selectOption('sunset');
    await page.locator('#chart-settings-form button[type="submit"]').click();
    assert.equal(await page.locator('#history-accuracy-chart .bar-chart-fill').first().evaluate((fill) => getComputedStyle(fill).backgroundColor), oceanFill, 'per-chart palette does not change summary chart');
    assert.notEqual(await page.locator('#history-error-charts .analytics-mark').first().evaluate((mark) => getComputedStyle(mark).fill), oceanError, 'per-chart palette changes only its marks');
    await page.reload();
    await page.locator('#open-history').click();
    assert.equal(await page.locator('#history-error-charts .chart-value-label').first().evaluate((label) => getComputedStyle(label).fontWeight), '400', 'label style survives reload');
    await page.locator('[data-chart-settings="outcomes"]').click();
    await page.locator('#reset-chart-settings').click();
    assert.equal(await page.locator('#history-error-charts .chart-value-label').first().evaluate((label) => getComputedStyle(label).fontWeight), '750', 'reset restores default label style');
    await page.locator('[data-chart-settings="outcomes"]').click();
    await page.locator('#chart-settings-scope').selectOption('all');
    await page.locator('#chart-settings-label-color').selectOption('custom');
    await page.locator('#chart-settings-color-picker').fill('#235a36');
    await page.locator('#chart-settings-form button[type="submit"]').click();
    assert.equal(await page.locator('#history-error-charts .chart-value-label').first().evaluate((label) => getComputedStyle(label).fill), 'rgb(35, 90, 54)', 'custom label color reaches charts');
    await page.reload();
    await page.locator('#open-history').click();
    assert.equal(await page.locator('#history-error-charts .chart-value-label').first().evaluate((label) => getComputedStyle(label).fill), 'rgb(35, 90, 54)', 'custom label color survives reload');
    await page.locator('[data-chart-settings="outcomes"]').click();
    await page.locator('#chart-settings-scope').selectOption('all');
    await page.locator('#chart-settings-random-color').click();
    assert.equal(await page.locator('#chart-settings-label-color').inputValue(), 'custom');
    const randomColor = await page.locator('#chart-settings-color-picker').inputValue();
    assert.match(randomColor, /^#[0-9a-f]{6}$/i);
    assert.notEqual(randomColor, '#235a36');
    await page.locator('#chart-settings-form button[type="submit"]').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cash-handling-terminal-quiz-chart-appearance-v1')).all.customColor), randomColor, 'random color is saved');
    await page.locator('[data-chart-settings="outcomes"]').click();
    await page.locator('#reset-chart-settings').click();
    const errorCard = page.locator('#history-error-charts .interactive-chart').first();
    const errorWindow = await errorCard.locator('.analytics-svg').getAttribute('data-chart-window');
    await errorCard.getByRole('button', { name: 'Maximize' }).click();
    assert.ok(await errorCard.evaluate((card) => card.classList.contains('is-maximized') && card.getBoundingClientRect().width >= innerWidth - 40 && card.getBoundingClientRect().height >= innerHeight - 40), 'error chart fills the viewport');
    assert.equal(await errorCard.locator('.analytics-svg').getAttribute('data-chart-window'), errorWindow, 'maximizing preserves the visible chart range');
    await errorCard.getByRole('button', { name: 'Zoom in' }).click();
    assert.notEqual(await errorCard.locator('.analytics-svg').getAttribute('data-chart-window'), errorWindow, 'zoom works while maximized');
    await errorCard.getByRole('button', { name: 'Zoom out' }).click();
    await errorCard.getByRole('button', { name: 'Reset' }).click();
    assert.equal(await errorCard.locator('.analytics-svg').getAttribute('data-chart-window'), errorWindow, 'reset restores the full range while maximized');
    await errorCard.getByRole('button', { name: 'Restore size' }).click();
    assert.equal(await errorCard.evaluate((card) => card.classList.contains('is-maximized')), false, 'restore returns the error chart to its grid');
    const labelReadability = async () => page.locator('#history-error-charts .chart-value-label').first().evaluate((label) => {
      const card = label.closest('.interactive-chart');
      const foreground = getComputedStyle(label).fill.match(/[\d.]+/g).slice(0, 3).map(Number);
      const background = getComputedStyle(card).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = (rgb) => rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const a = luminance(foreground); const b = luminance(background);
      return { height: label.getBoundingClientRect().height, contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
    for (const theme of ['light', 'dark']) {
      const readability = await labelReadability();
      assert.ok(readability.height >= 12, `${theme} chart labels remain at least 12px high: ${JSON.stringify(readability)}`);
      assert.ok(readability.contrast >= 4.5, `${theme} chart labels have readable contrast: ${JSON.stringify(readability)}`);
      if (theme === 'light') await page.locator('#theme-toggle').click();
    }
    await page.locator('#theme-toggle').click();
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
    assert.equal(await page.locator('#history-charts .interactive-chart button:text-is("Maximize")').count(), await page.locator('#history-charts .interactive-chart').count(), 'every progress chart has a maximize control');
    assert.ok(await chart.locator('.chart-axis').count() >= 2, 'charts render visible X and Y axes');
    assert.ok(await chart.locator('.chart-axis-title').count() >= 2, 'charts label both axes');
    assert.ok(await chart.locator('.chart-y-tick').count() >= 3, 'charts show numeric Y-axis ticks');
    assert.equal(await chart.locator('.chart-series-line').count(), 1, 'time-series points are connected');
    assert.ok(await page.locator('#history-charts .interactive-chart').locator('.chart-value-label').count(), 'bar chart values are visible');
    assert.match(await page.locator('#history-accuracy-chart').innerText(), /Accuracy.*Difficulty.*0%.*100%/s, 'summary bar chart labels its category and aligned numeric axis');
    await chart.getByRole('button', { name: 'Hide data' }).click();
    await chart.getByRole('button', { name: 'Show data' }).click();
    await chart.getByRole('button', { name: 'Zoom in' }).click();
    assert.match(await chart.locator('.analytics-svg').getAttribute('data-chart-window'), /:\d+$/);
    await chart.getByRole('button', { name: 'Later' }).click();
    await chart.getByRole('button', { name: 'Earlier' }).click();
    await chart.getByRole('button', { name: 'Reset' }).click();
    await chart.getByRole('button', { name: 'Zoom in' }).click();
    const windowBeforeMaximize = await chart.locator('.analytics-svg').getAttribute('data-chart-window');
    await chart.getByRole('button', { name: 'Maximize' }).click();
    assert.equal(await chart.locator('.analytics-svg').getAttribute('data-chart-window'), windowBeforeMaximize, 'maximizing a progress chart keeps its zoom');
    await page.keyboard.press('Escape');
    assert.equal(await chart.evaluate((card) => card.classList.contains('is-maximized')), false, 'Escape restores the chart size');
    assert.equal(await chart.locator('.analytics-svg').getAttribute('data-chart-window'), windowBeforeMaximize, 'restoring keeps the zoom');
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
      if (width === 320) {
        await chart.getByRole('button', { name: 'Maximize' }).click();
        assert.ok(await chart.evaluate((card) => {
          const bounds = card.getBoundingClientRect();
          const plot = card.querySelector('.chart-plot-scroll');
          return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight
            && plot.scrollWidth > plot.clientWidth;
        }), 'mobile maximized chart fits the viewport and scrolls its full-sized plot internally');
        await chart.getByRole('button', { name: 'Restore size' }).click();
      }
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
