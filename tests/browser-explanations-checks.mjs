import assert from 'node:assert/strict';
import { openAllTables } from './browser-all-tables-checks.mjs';

// Every chart and table on History shows a toggleable explanation; all tables collapse and expand together.
export async function checkExplanations(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(base);
    await page.locator('#open-history').click();
    for (const game of ['cash', 'memory']) {
      await page.locator(`#history-game-tabs button[data-history-game="${game}"]`).click();
      assert.equal(await page.locator('#history-outcome-diagram').textContent(), 'No attempts yet.', `${game}: empty outcome diagram`);
      assert.equal(await page.locator('#history-accuracy-chart').textContent(), 'No attempts yet.', `${game}: no empty bars`);
      assert.equal(await page.locator('#history-accuracy-chart .bar-chart-row').count(), 0);
    }
    await page.locator('#history-data-source input[value="sample"]').check({ force: true });
    for (const game of ['cash', 'memory', 'task', 'error-detection', 'typing', 'overload', 'chess']) {
      const tab = page.locator(`#history-game-tabs button[data-history-game="${game}"]`);
      if (!(await tab.isVisible())) continue;
      await tab.click();
      await openAllTables(page);
      const missing = await page.evaluate(() => {
        const visible = (el) => el.getClientRects().length > 0;
        const charts = [...document.querySelectorAll('.interactive-chart, .history-visuals > .visual-card')].filter(visible);
        const tables = [...document.querySelectorAll('.history-table-container')].filter(visible);
        return { charts: charts.length, tables: tables.length,
          chartsWithout: charts.filter((card) => !card.querySelector(':scope > .explanation')).map((card) => card.dataset.chartId ?? card.querySelector('h3')?.textContent),
          tablesWithout: tables.filter((shell) => !shell.querySelector(':scope > .explanation')).map((shell) => shell.querySelector('strong')?.textContent) };
      });
      assert.ok(missing.charts > 0, `${game}: charts rendered`);
      assert.deepEqual(missing.chartsWithout, [], `${game}: every chart has an explanation`);
      assert.deepEqual(missing.tablesWithout, [], `${game}: every table has an explanation`);
    }
    await page.locator('#history-game-tabs button[data-history-game="cash"]').click();
    const note = page.locator('#history-charts .interactive-chart > .explanation').first();
    assert.equal(await note.evaluate((el) => el.open), false, 'explanations start hidden');
    await note.locator('summary').click();
    assert.equal(await note.evaluate((el) => el.open), true);
    assert.ok(await note.locator('p').first().isVisible(), 'toggle shows the explanation');
    await note.locator('summary').click();
    assert.equal(await note.locator('p').first().isVisible(), false, 'toggle hides the explanation');
    const outcomeNote = page.locator('.history-visuals .visual-card > .explanation').first();
    await outcomeNote.locator('summary').click();
    assert.match(await outcomeNote.textContent(), /Timed out.*timer ran out/s);
    await openAllTables(page);
    const tableCount = await page.locator('#history-all-tables .history-table-container:not([hidden])').count();
    assert.ok(tableCount > 1);
    await page.getByRole('button', { name: 'Minimize All Tables', exact: true }).first().click();
    assert.equal(await page.locator('#history-all-tables .history-table-container[data-table-size="minimized"]:not([hidden])').count(), tableCount, 'one control minimizes every table');
    await page.getByRole('button', { name: 'Expand All Tables', exact: true }).first().click();
    assert.equal(await page.locator('#history-all-tables .history-table-container[data-table-size="expanded"]:not([hidden])').count(), tableCount, 'one control expands every table');
    assert.equal(await page.locator('.history-table-viewport[hidden]').count(), 0);
    console.log('Explanations: every chart and table explained, toggles work, minimize/expand all, empty state');
  } finally { await context.close(); }
}
