import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { generateSampleHistory } from '../sample-history.mjs';

export async function checkHistoryLayout(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  const real = generateSampleHistory({ seed: 47 }).map(({ isSample, ...row }) => row);
  await page.addInitScript(rows => localStorage.setItem('cash-handling-terminal-quiz-history-v1', JSON.stringify(rows)), real);
  try {
    await page.goto(base);
    await page.locator('#open-history').click();
    for (const source of ['real', 'sample']) {
      await page.locator(`#history-data-source input[value="${source}"]`).check();
      for (const game of ['all', 'cash', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing', 'overload']) {
        await page.locator(`#history-game-tabs button[data-history-game="${game}"]`).click();
        const body = game === 'overload' ? '#overload-history-rows' : game === 'typing' ? '#typing-history-rows' : '#history-rows';
        const shell = page.locator(body).locator('xpath=ancestor::div[contains(@class,"history-table-container")]');
        const viewport = shell.locator('.history-table-viewport');
        await shell.getByRole('button', { name: 'Normal Table', exact: true }).click();
        await page.waitForFunction(selector => {
          const viewport = document.querySelector(selector).closest('.history-table-viewport');
          return viewport.style.getPropertyValue('--table-normal-height');
        }, body);
        assert.ok(await page.locator(`${body} tr`).count() >= 200);
        const geometry = await viewport.evaluate(node => {
          const rows = [...node.querySelectorAll('tbody tr')];
          return { height: node.clientHeight, total: node.scrollHeight,
            expected: rows.slice(0, 28).reduce((n, row) => n + row.getBoundingClientRect().height, 0) + node.querySelector('thead').getBoundingClientRect().height };
        });
        assert.ok(geometry.total > geometry.height, `${source}/${game} internally scrolls`);
        assert.ok(Math.abs(geometry.expected - geometry.height) < 24, `${source}/${game} shows about 28 rows`);
        assert.equal(await viewport.locator('thead').evaluate(node => getComputedStyle(node).position), 'sticky');
        assert.equal(await page.locator(body).evaluate(node => Boolean(document.querySelector('#history-charts').compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
        assert.deepEqual(await page.locator('#history-screen table').evaluateAll(tables => tables.filter(table => !table.closest('.history-table-viewport')).map(table => table.outerHTML.slice(0, 180))), [], 'every history table shares the container');
        await shell.getByRole('button', { name: 'Minimize Table', exact: true }).click();
        assert.equal(await viewport.isVisible(), false);
        await shell.getByRole('button', { name: 'Expand Table', exact: true }).click();
        assert.ok(await viewport.evaluate(node => node.clientHeight) > geometry.height * 1.8);
        await page.locator('#error-analysis-sort').selectOption('alphabetical');
        assert.equal(await shell.getAttribute('data-table-size'), 'expanded', 'rerender preserves table state');
        await shell.getByRole('button', { name: 'Normal Table', exact: true }).click();
        for (const id of game === 'overload' ? ['overload-accuracy', 'overload-response'] : ['accuracy-over-time', 'response-time-over-time']) {
          const chart = page.locator(`[data-chart-id="${id}"]`);
          assert.ok(await chart.locator('.chart-series-line').count(), `${id} draws a progression line`);
          assert.ok(await chart.locator('.analytics-mark circle').count() > 1);
        }
        assert.equal(await page.locator('[data-chart-kind="scatter"] .chart-series-line').count(), 0, 'response-time correlation scatter stays unconnected');
      }
      await page.locator('#history-game-tabs button[data-history-game="typing"]').click();
      if (source === 'sample') {
        const shell = page.locator('#typing-history-rows').locator('xpath=ancestor::div[contains(@class,"history-table-container")]');
        await shell.getByRole('button', { name: 'Minimize Table', exact: true }).click();
        await page.locator('#history-regenerate-sample').click();
        assert.equal(await shell.getAttribute('data-table-size'), 'minimized');
        await shell.getByRole('button', { name: 'Normal Table', exact: true }).click();
      }
    }
    await page.locator('#typing-history-details').screenshot({ path: resolve(process.env.TEMP || '/tmp', 'quiz-history-layout-desktop.png') });
    await page.locator('[data-chart-id="accuracy-over-time"]').screenshot({ path: resolve(process.env.TEMP || '/tmp', 'quiz-history-layout-chart-light.png') });
    await page.locator('#theme-toggle').click();
    await page.locator('[data-chart-id="response-time-over-time"]').screenshot({ path: resolve(process.env.TEMP || '/tmp', 'quiz-history-layout-chart-dark.png') });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `fits ${width}px`);
      assert.equal(await page.locator('#typing-history-rows').evaluate(node => getComputedStyle(node.closest('.history-table-viewport')).overflowY), 'auto');
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.locator('#typing-history-details').screenshot({ path: resolve(process.env.TEMP || '/tmp', 'quiz-history-layout-mobile.png') });
    await page.locator('#history-game-tabs button[data-history-game="chess"]').click();
    assert.equal(await page.locator('#chess-history-games').evaluate(node => Boolean(node.closest('.history-table-container'))), true);
    const chess = page.locator('#chess-history-games').locator('..');
    await chess.getByRole('button', { name: 'Minimize Table', exact: true }).click();
    assert.equal(await page.locator('#chess-history-games').isVisible(), false);
    await chess.getByRole('button', { name: 'Expand Table', exact: true }).click();
    assert.equal(await page.locator('#chess-history-games').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('History layout: every game, Real/Sample, 28-row scroll areas, minimize/expand, regeneration, sticky headers, progression lines, and 320–1440px passed');
  } finally { await context.close(); }
}
