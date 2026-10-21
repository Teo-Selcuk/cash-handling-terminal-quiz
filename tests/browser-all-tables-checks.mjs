import assert from 'node:assert/strict';
import { generateSampleHistory } from '../sample-history.mjs';

const SECTION = '#history-all-tables';
const HISTORY_KEY = 'cash-handling-terminal-quiz-history-v1';

/** Opens the "All tables" section on the History page (it starts collapsed). */
export async function openAllTables(page) {
  await page.evaluate((selector) => { const section = document.querySelector(selector); if (section) section.open = true; }, SECTION);
}

const shells = (page) => page.locator(`${SECTION} .history-table-container:not([hidden])`);
const sizes = (page) => shells(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.tableSize));
const heights = (page) => page.evaluate(() => ({
  section: Math.round(document.querySelector('#history-all-tables').getBoundingClientRect().height),
  screen: Math.round(document.getElementById('history-screen').getBoundingClientRect().height),
  page: document.documentElement.scrollHeight,
}));
const pressed = (page, name) => page.getByRole('button', { name, exact: true }).first().getAttribute('aria-pressed');
const summary = (page) => page.locator(`${SECTION} > summary`);

export async function checkAllTables(browser, base) {
  const rows = generateSampleHistory({ seed: 47 }).map(({ isSample, ...row }) => row);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(([key, data]) => localStorage.setItem(key, JSON.stringify(data)), [HISTORY_KEY, rows]);
  try {
    await page.goto(base);
    await page.locator('#open-history').click();

    // Collapsed by default: only the header line takes space and no table is drawn.
    const section = page.locator(SECTION);
    assert.equal(await section.evaluate((node) => node.open), false, 'All tables starts collapsed');
    assert.match(await summary(page).innerText(), /All tables\s+\d+ tables?/);
    assert.equal(await page.locator(`${SECTION} .history-table-container`).evaluateAll((nodes) => nodes.filter((node) => node.checkVisibility()).length), 0, 'no table is drawn while collapsed');
    const collapsedHeights = await heights(page);
    assert.ok(collapsedHeights.section < 80, `collapsed section is one header line (${collapsedHeights.section}px)`);
    const count = Number((await summary(page).innerText()).match(/(\d+) tables?/)[1]);
    assert.ok(count > 1);

    // The header expands and collapses the whole section; the count matches the tables inside.
    await summary(page).click();
    assert.equal(await section.evaluate((node) => node.open), true);
    assert.equal(await shells(page).count(), count, 'header count equals the tables shown');
    assert.deepEqual([...new Set(await sizes(page))], ['minimized'], 'tables start minimized');
    const openMinimized = await heights(page);
    await summary(page).click();
    assert.equal(await section.evaluate((node) => node.open), false);
    await summary(page).click();

    // Per-table toggle works on its own and the global buttons follow it.
    await page.getByRole('button', { name: 'Minimize All Tables', exact: true }).click();
    assert.equal(await pressed(page, 'Minimize All Tables'), 'true');
    assert.equal(await pressed(page, 'Expand All Tables'), 'false');
    const first = shells(page).first();
    await first.getByRole('button', { name: 'Expand Table', exact: true }).click();
    assert.equal(await first.getAttribute('data-table-size'), 'expanded');
    assert.equal(await first.locator('.history-table-viewport').isVisible(), true);
    assert.equal(await shells(page).nth(1).getAttribute('data-table-size'), 'minimized', 'other tables are untouched');
    assert.equal(await pressed(page, 'Minimize All Tables'), 'false', 'global buttons show the mixed state');
    assert.equal(await pressed(page, 'Expand All Tables'), 'false');
    await first.getByRole('button', { name: 'Normal Table', exact: true }).click();
    assert.equal(await first.getAttribute('data-table-size'), 'normal');
    await first.getByRole('button', { name: 'Minimize Table', exact: true }).click();
    assert.equal(await pressed(page, 'Minimize All Tables'), 'true', 'back to all minimized');

    // Expand all / Minimize all act on every table and every per-table toggle agrees.
    await page.getByRole('button', { name: 'Expand All Tables', exact: true }).click();
    assert.deepEqual([...new Set(await sizes(page))], ['expanded']);
    assert.equal(await pressed(page, 'Expand All Tables'), 'true');
    assert.equal(await shells(page).locator('button[aria-pressed="true"]', { hasText: 'Expand Table' }).count(), count);
    assert.equal(await shells(page).locator('.history-table-viewport:visible').count(), count);
    const openExpanded = await heights(page);

    // Explanations toggle correctly in expanded and minimized states.
    for (const size of ['Expand All Tables', 'Minimize All Tables']) {
      await page.getByRole('button', { name: size, exact: true }).click();
      const note = shells(page).first().locator(':scope > .explanation');
      const wasOpen = await note.evaluate((node) => node.open);
      await note.locator('summary').click();
      assert.equal(await note.evaluate((node) => node.open), !wasOpen);
      assert.equal(await note.locator('p').first().isVisible(), !wasOpen);
      await note.locator('summary').click();
      assert.equal(await note.evaluate((node) => node.open), wasOpen);
    }

    // Collapse while tables are in a chosen state, reopen: the state is kept.
    await shells(page).first().getByRole('button', { name: 'Expand Table', exact: true }).click();
    const before = await sizes(page);
    await summary(page).click();
    await summary(page).click();
    assert.deepEqual(await sizes(page), before);

    // The numbers did not change: the attempts table still lists every saved attempt.
    await page.locator('#history-game-tabs button[data-history-game="all"]').click();
    assert.equal(await page.locator('#history-rows tr').count(), rows.length, 'attempt table row count equals saved attempts');

    // Tables of a game tab that is not showing are not listed.
    await page.locator('#history-game-tabs button[data-history-game="cash"]').click();
    await page.waitForFunction(() => /^\d+ tables?$/.test(document.querySelector('#history-all-tables .all-tables-count').textContent));
    const cashCount = Number((await page.locator(`${SECTION} .all-tables-count`).innerText()).match(/\d+/)[0]);
    assert.ok(cashCount > 0 && cashCount < count, `cash tab lists its own tables (${cashCount} of ${count})`);

    // Narrow window: header and buttons fit without overlapping.
    await page.setViewportSize({ width: 320, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const boxes = await page.locator(`${SECTION} > .all-tables-body > .global-table-controls button`).evaluateAll((nodes) => nodes.map((node) => { const { left, right, top, bottom } = node.getBoundingClientRect(); return { left, right, top, bottom }; }));
    for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j];
      assert.ok(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5, 'buttons do not overlap');
    }

    console.log(`All tables heights (px of page): collapsed ${collapsedHeights.page}, open + minimized ${openMinimized.page}, open + expanded ${openExpanded.page} (${count} tables).`);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }

  // No attempts yet: the section says so and draws no empty tables.
  const empty = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const emptyPage = await empty.newPage();
  try {
    await emptyPage.goto(base);
    await emptyPage.locator('#open-history').click();
    await openAllTables(emptyPage);
    assert.equal(await emptyPage.locator(`${SECTION} .all-tables-empty`).isVisible(), true);
    assert.match(await emptyPage.locator(`${SECTION} .all-tables-empty`).innerText(), /No attempts yet/);
    assert.equal(await emptyPage.locator(`${SECTION} .history-table-container:not([hidden])`).count(), 0);
    assert.match(await summary(emptyPage).innerText(), /0 tables/);
  } finally { await empty.close(); }

  // A single attempt gives the shortest list; the three controls still work.
  const single = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const singlePage = await single.newPage();
  const typing = rows.find((row) => row.game === 'typing');
  await singlePage.addInitScript(([key, data]) => localStorage.setItem(key, JSON.stringify(data)), [HISTORY_KEY, [typing]]);
  try {
    await singlePage.goto(base);
    await singlePage.locator('#open-history').click();
    await singlePage.locator('#history-game-tabs button[data-history-game="typing"]').click();
    await openAllTables(singlePage);
    const total = await shells(singlePage).count();
    assert.ok(total >= 1);
    await singlePage.getByRole('button', { name: 'Expand All Tables', exact: true }).click();
    assert.deepEqual([...new Set(await sizes(singlePage))], ['expanded']);
    await singlePage.getByRole('button', { name: 'Minimize All Tables', exact: true }).click();
    assert.deepEqual([...new Set(await sizes(singlePage))], ['minimized']);
    await shells(singlePage).first().getByRole('button', { name: 'Expand Table', exact: true }).click();
    assert.equal(await shells(singlePage).first().getAttribute('data-table-size'), 'expanded');
  } finally { await single.close(); }
  console.log('All tables: collapsed default, header count, per-table and global toggles in sync, explanations, state kept, empty and single-attempt cases, narrow layout.');
}
