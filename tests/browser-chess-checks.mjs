import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const move = async (page, from, to) => { await page.locator(`[data-square="${from}"]`).click(); await page.locator(`[data-square="${to}"]`).click(); };
const setup = async (page, base) => { await page.goto(base); await page.locator('input[name="game"][value="chess"]').check(); await page.locator('#chess-setup-status').filter({ hasText: 'Computer ready' }).waitFor(); };
const start = async page => { await page.getByRole('button', { name: 'Start chess game', exact: true }).click(); await page.locator('#chess-status').filter({ hasText: 'Your turn' }).waitFor(); };
const games = page => page.evaluate(() => JSON.parse(localStorage.getItem('cash-handling-chess-games-v1') ?? '{"value":[]}').value);
export async function checkChess(browser, base) {
  await mkdir('.artifacts/chess', { recursive: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  try {
    for (const difficulty of ['Beginner', 'Easy', 'Medium', 'Hard']) {
      await setup(page, base); await page.locator('#chess-difficulty').selectOption(difficulty); await start(page);
      await move(page, 'e2', 'e4'); await page.locator('#chess-moves li').nth(1).waitFor();
      assert.match(await page.locator('#chess-status').textContent(), /Your turn/);
      await page.locator('#chess-resign').click();
      const saved = await games(page); assert.equal(saved.at(-1).settings.difficulty, difficulty); assert.equal(saved.at(-1).moves.length, 2);
      assert.equal(saved.at(-1).result.reason, 'Resignation');
    }
    // Real worker evaluation, replay, accessible charts and exports.
    await page.locator('#chess-analyze').click();
    await page.locator('#chess-review-status').filter({ hasText: 'Review complete' }).waitFor({ timeout: 60000 });
    await page.locator('#chess-review-next').click();
    assert.match(await page.locator('#chess-review-eval').textContent(), /Evaluation|Forced mate/);
    const pgn = page.waitForEvent('download'); await page.locator('#chess-pgn').click(); assert.match((await pgn).suggestedFilename(), /\.pgn$/);
    await page.locator('#open-history').click(); await page.locator('#chess-history').waitFor();
    assert.equal(await page.locator('#history-metrics').isVisible(), false);
    assert.ok(await page.locator('#chess-history .interactive-chart').count() >= 6);
    await page.locator('#chess-history .interactive-chart').first().getByRole('button', { name: 'Data table', exact: true }).click();
    await page.locator('#chart-data-dialog').waitFor(); await page.locator('#close-chart-data').click();
    await page.locator('#chess-history .interactive-chart').first().getByRole('button', { name: 'Maximize', exact: true }).click();
    await page.locator('#chess-history .interactive-chart').first().getByRole('button', { name: 'Restore size', exact: true }).click();
    const csv = page.waitForEvent('download'); await page.locator('#chess-download-csv').click(); assert.equal((await csv).suggestedFilename(), 'chess-analytics.csv');
    // Guided lesson plays both sides; hints and completions are separate records.
    await setup(page, base); await page.locator('#chess-open-lessons').click(); assert.equal(await page.locator('[data-lesson]').count(), 24);
    await page.locator('[data-lesson="pawn"]').click(); await page.locator('#chess-lesson-hint').click();
    await move(page, 'e2', 'e4'); await move(page, 'd7', 'd5'); await move(page, 'e4', 'd5');
    assert.match(await page.locator('#chess-lesson-step').textContent(), /Exercise complete/);
    assert.equal((await games(page)).length, 4);
    const attempt = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-handling-chess-lessons-v1')).value[0]);
    assert.equal(attempt.completed, true); assert.equal(attempt.hints, 1);
    await page.locator('#chess-lesson-play').click(); await page.locator('#chess-status').filter({ hasText: 'Your turn' }).waitFor();
    await page.locator('#chess-resign').click(); assert.equal((await games(page)).at(-1).lessonId, 'pawn');
    // Promotion choice and keyboard selection.
    await page.locator('#chess-lessons-toggle').click(); await page.locator('[data-lesson="promotion"]').click();
    await page.locator('[data-square="a7"]').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-square="a7"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.square), 'a7', await page.evaluate(() => document.activeElement.outerHTML));
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.square), 'a8', await page.evaluate(() => document.activeElement.outerHTML));
    await page.keyboard.press('Enter');
    await page.locator('#chess-promotion').waitFor(); await page.locator('[data-promotion="q"]').click();
    assert.match(await page.locator('[data-square="a8"]').getAttribute('aria-label'), /White queen/);
    // Per-move late deadline records once and survives reload; hidden-tab elapsed clock uses Date.now.
    await setup(page, base); await page.locator('#chess-time-control').selectOption('move'); await page.locator('#chess-seconds').fill('1'); await start(page);
    await page.waitForTimeout(1400); assert.match(await page.locator('#chess-clock-w').textContent(), /LATE/);
    await move(page, 'e2', 'e4'); await page.locator('#chess-moves li').nth(1).waitFor();
    await page.reload(); await page.locator('input[name="game"][value="chess"]').check(); await page.locator('#chess-resume').click();
    await page.locator('#chess-status').filter({ hasText: 'Your turn' }).waitFor();
    assert.match(await page.locator('#chess-game-details').textContent(), /resumed practice/);
    assert.equal(await page.locator('#chess-moves li').count(), 2);
    await page.locator('#chess-resign').click(); const restored = (await games(page)).at(-1);
    assert.equal(restored.resumed, true); assert.equal(restored.moves[0].late, true);
    assert.equal(restored.lateCount.w >= 1, true);
    // Coaching searches produce real hints and retain assistance provenance.
    await setup(page, base); await page.locator('#chess-coaching').check(); await start(page); await page.locator('#chess-hint').click();
    await page.locator('#chess-feedback').filter({ hasText: 'Hint:' }).waitFor();
    await move(page, 'e2', 'e4'); await page.locator('#chess-moves li').nth(1).waitFor();
    await page.locator('#chess-feedback').filter({ hasText: 'Alternative:' }).waitFor();
    await page.locator('#chess-resign').click(); assert.equal((await games(page)).at(-1).hints, 1);
    // A real game clock keeps wall-clock time while the page is frozen.
    await setup(page, base); await page.locator('#chess-time-control').selectOption('clock'); await page.locator('#chess-minutes').fill('1'); await page.locator('#chess-increment').fill('2'); await start(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await page.waitForTimeout(1400); await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await page.locator('#chess-clock-w').filter({ hasText: '0:58' }).waitFor({ timeout: 3000 });
    await page.locator('#chess-resign').click();
    // Black receives an opening computer move before the player can act.
    await setup(page, base); await page.locator('#chess-color').selectOption('b'); await start(page);
    assert.equal(await page.locator('#chess-moves li').count(), 1); assert.match(await page.locator('#chess-game-label').textContent(), /Black/);
    await page.locator('#chess-resign').click();
    // Responsive board and history, both themes, including narrow touch layout.
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Chess fits ${width}px ${theme}`);
        if ([320, 1440].includes(width)) await page.screenshot({ path: `.artifacts/chess/board-${width}-${theme}.png`, fullPage: true });
      }
    }
    await page.locator('#open-history').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 320, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Chess history fits 320px');
    await page.screenshot({ path: '.artifacts/chess/history-320-dark.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  // Missing worker assets produce a recoverable state without running clocks.
  const failureContext = await browser.newContext();
  try {
    const failurePage = await failureContext.newPage();
    await failurePage.route('**/stockfish-19-lite-single.js', route => route.abort());
    await failurePage.goto(base); await failurePage.locator('input[name="game"][value="chess"]').check();
    await failurePage.locator('#chess-setup-retry').waitFor();
    await failurePage.locator('#chess-time-control').selectOption('clock');
    await failurePage.getByRole('button', { name: 'Start chess game', exact: true }).click();
    await failurePage.locator('#chess-retry').waitFor();
    const clock = await failurePage.locator('#chess-clock-w').textContent(); await failurePage.waitForTimeout(1200);
    assert.equal(await failurePage.locator('#chess-clock-w').textContent(), clock);
    await failurePage.unroute('**/stockfish-19-lite-single.js'); await failurePage.locator('#chess-retry').click();
    await failurePage.locator('#chess-status').filter({ hasText: 'Your turn' }).waitFor();
    await move(failurePage, 'e2', 'e4'); await failurePage.locator('#chess-moves li').nth(1).waitFor();
  } finally { await failureContext.close(); }
  const touchContext = await browser.newContext({ hasTouch: true, viewport: { width: 320, height: 900 } });
  try {
    const touch = await touchContext.newPage(); await setup(touch, base);
    await touch.locator('#chess-open-lessons').tap(); await touch.locator('[data-lesson="pawn"]').tap();
    await touch.locator('[data-square="e2"]').tap(); await touch.locator('[data-square="e4"]').tap();
    assert.match(await touch.locator('[data-square="e4"]').getAttribute('aria-label'), /White pawn/);
  } finally { await touchContext.close(); }
  console.log('Chess browser checks passed: real engine, four difficulties, lessons, clocks, review, exports and responsive board.');
}
