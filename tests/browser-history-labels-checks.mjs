import assert from 'node:assert/strict';

// Chart labels sit on their own bar row, totals agree, and Appearance reaches every label.
export async function checkHistoryLabels(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => localStorage.setItem('cash-handling-terminal-quiz-theme-v1', 'dark'));
    await page.goto(base);
    await page.locator('#open-history').click();
    await page.locator('#history-data-source input[value="sample"]').check({ force: true });
    for (const game of ['cash', 'memory', 'fraud-inspection', 'typing']) {
      const tab = page.locator(`#history-game-tabs button[data-history-game="${game}"]`);
      if (!(await tab.isVisible())) continue;
      await tab.click();
      const rows = await page.locator('#history-accuracy-chart .bar-chart-row').evaluateAll((items) => items.map((row) => {
        const [label, track, value] = ['.bar-chart-label', '.bar-chart-track', '.bar-chart-value'].map((s) => row.querySelector(s).getBoundingClientRect());
        return { level: row.dataset.level, text: row.querySelector('.bar-chart-value').textContent,
          sameLine: Math.abs((label.top + label.bottom) / 2 - (value.top + value.bottom) / 2) < 4 && Math.abs((track.top + track.bottom) / 2 - (value.top + value.bottom) / 2) < 6,
          rowTop: row.getBoundingClientRect().top, rowBottom: row.getBoundingClientRect().bottom, valueTop: value.top, valueBottom: value.bottom };
      }));
      assert.ok(rows.length >= 3, `${game}: difficulty rows`);
      for (const row of rows) {
        assert.ok(row.sameLine, `${game} ${row.level}: value label on the same line as its bar`);
        assert.ok(row.valueTop >= row.rowTop - 1 && row.valueBottom <= row.rowBottom + 1, `${game} ${row.level}: label inside its own row`);
      }
      if (game !== 'memory') {
        const header = await page.locator('#history-outcomes-summary').textContent();
        const [, correct, total] = header.match(/(\d+) of (\d+) correct/);
        const sums = rows.map((row) => row.text.match(/(\d+) of (\d+) correct/)).filter(Boolean)
          .reduce((sum, match) => [sum[0] + Number(match[1]), sum[1] + Number(match[2])], [0, 0]);
        assert.deepEqual(sums, [Number(correct), Number(total)], `${game}: difficulty rows add up to the outcome header`);
        assert.match(await page.locator('#history-accuracy-summary').textContent(), new RegExp(`^${correct} of ${total} correct`));
      }
      assert.equal(await page.locator('#history-accuracy-chart .chart-hue-legend').count(), 0, 'no repeated accuracy scale bar');
      const ids = await page.locator('#history-charts .interactive-chart').evaluateAll((cards) => cards.map((card) => card.dataset.chartId));
      assert.equal(new Set(ids).size, ids.length, `${game}: no duplicate charts`);
      assert.ok(!ids.includes('outcomes') && !ids.includes('correct-by-threshold'), `${game}: removed charts stay removed`);
    }
    await page.locator('#history-game-tabs button[data-history-game="cash"]').click();
    await page.locator('[data-chart-settings="accuracy-by-difficulty"]').click();
    assert.equal(await page.locator('#chart-settings-scope').inputValue(), 'all', 'Appearance applies to all charts by default');
    await page.locator('#chart-settings-label-color').selectOption('custom');
    await page.locator('#chart-settings-color-picker').fill('#ffffff');
    await page.locator('#chart-settings-label-size').selectOption('large');
    await page.locator('#chart-settings-label-font').selectOption('mono');
    await page.locator('#chart-settings-form [type="submit"]').click();
    const labels = await page.evaluate(() => {
      const html = [...document.querySelectorAll('.visual-card .bar-chart-label, .visual-card .bar-chart-value, .visual-card .bar-chart-axis span, .visual-card .bar-chart-axis-title, .visual-card .chart-legend li span:last-child')];
      const svg = [...document.querySelectorAll('#history-charts .analytics-svg text')];
      return [...html.map((el) => ({ kind: 'html', color: getComputedStyle(el).color, font: getComputedStyle(el).fontFamily, text: el.textContent })),
        ...svg.map((el) => ({ kind: 'svg', color: getComputedStyle(el).fill, font: getComputedStyle(el).fontFamily, text: el.textContent }))].filter((l) => l.text.trim());
    });
    assert.ok(labels.length > 20);
    const notWhite = labels.filter((l) => l.color !== 'rgb(255, 255, 255)');
    assert.deepEqual(notWhite.slice(0, 5), [], 'every chart label follows the chosen white label color');
    assert.ok(labels.every((l) => /monospace|Consolas|Cascadia/i.test(l.font)), 'every chart label follows the chosen font');
    const size = await page.locator('#history-accuracy-chart .bar-chart-label').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(size > 17, 'label size setting enlarges labels');
    await page.locator('#history-accuracy-chart').screenshot({ path: (process.env.TEMP || '/tmp') + '/accuracy-by-difficulty.png' });
    console.log('History labels: bars and labels aligned, totals agree, appearance updates every chart label');
  } finally { await context.close(); }
}
