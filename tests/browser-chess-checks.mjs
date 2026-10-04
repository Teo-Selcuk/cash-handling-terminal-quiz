import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const move = async (page, from, to) => { await page.locator(`[data-square="${from}"]`).click(); await page.locator(`[data-square="${to}"]`).click(); };
const setup = async (page, base) => { await page.goto(base); await page.locator('input[name="game"][value="chess"]').check(); await page.locator('#chess-setup-status').filter({ hasText: 'Computer ready' }).waitFor(); await page.locator('#chess-color').selectOption('w'); await page.locator('#chess-time-control').selectOption('untimed'); };
const practice = async page => { while (!(await page.locator('#chess-demo-next').isDisabled())) await page.locator('#chess-demo-next').click(); await page.locator('#chess-practice').click(); };
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
      assert.equal(await page.evaluate(() => document.fullscreenElement), null);
      assert.equal(await page.locator('.site-header').evaluate(node => node.inert), false);
      assert.equal(await page.locator('#chess-progress').isVisible(), false);
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
    await page.locator('#chess-progress').click(); await page.locator('#chess-history').waitFor();
    assert.equal(await page.locator('#history-metrics').isVisible(), false);
    assert.ok(await page.locator('#chess-history .interactive-chart').count() >= 6);
    await page.locator('#chess-history .interactive-chart').first().getByRole('button', { name: 'Data table', exact: true }).click();
    await page.locator('#chart-data-dialog').waitFor(); await page.locator('#close-chart-data').click();
    await page.locator('#chess-history .interactive-chart').first().getByRole('button', { name: 'Maximize', exact: true }).click();
    await page.locator('#chess-history .interactive-chart').first().getByRole('button', { name: 'Restore size', exact: true }).click();
    const csv = page.waitForEvent('download'); await page.locator('#chess-download-csv').click(); assert.equal((await csv).suggestedFilename(), 'chess-analytics.csv');
    // Guided lesson plays both sides; hints and completions are separate records.
    await setup(page, base); await page.locator('#chess-open-lessons').click(); assert.equal(await page.locator('[data-lesson]').count(), 44);
    await page.locator('[data-lesson="pawn"]').click(); await practice(page); await page.locator('#chess-lesson-hint').click();
    await move(page, 'e2', 'e4'); await move(page, 'd7', 'd5'); await move(page, 'e4', 'd5');
    assert.match(await page.locator('#chess-lesson-step').textContent(), /Exercise complete/);
    assert.equal((await games(page)).length, 4);
    const attempt = await page.evaluate(() => JSON.parse(localStorage.getItem('cash-handling-chess-lessons-v1')).value[0]);
    assert.equal(attempt.completed, true); assert.equal(attempt.hints, 1);
    await page.locator('#chess-lesson-play').click(); await page.locator('#chess-status').filter({ hasText: 'Your turn' }).waitFor();
    await page.locator('#chess-resign').click(); assert.equal((await games(page)).at(-1).lessonId, 'pawn');
    // Promotion choice and keyboard selection.
    await page.locator('#chess-lessons-toggle').click(); await page.locator('[data-lesson="promotion"]').click(); await practice(page);
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
    await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
    assert.equal(await page.locator('#chess-screen').isVisible(), true);
    assert.equal(await page.locator('.site-header').evaluate(node => node.inert), false);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Chess fits ${width}px ${theme}`);
        const boardBounds = await page.locator('#chess-board').boundingBox();
        for (const id of width >= 768 ? ['chess-back', 'chess-lessons-toggle', 'chess-flip'] : []) {
          const bounds = await page.locator('#' + id).boundingBox();
          assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 900, `${id} stays on screen at ${width}px`);
        }
        assert.ok(boardBounds.width >= 250, `Board remains playable at ${width}px`);
        assert.ok(Math.abs(boardBounds.width-boardBounds.height)<2, `Board stays square at ${width}px`);
        if(width>=1024)assert.ok(boardBounds.width>=600&&boardBounds.width<=750, `Desktop board uses the available viewport height at ${width}px`);
        if ([320, 1440].includes(width)) await page.screenshot({ path: `.artifacts/chess/board-${width}-${theme}.png`, fullPage: true });
      }
    }
    await page.locator('#chess-progress').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 320, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Chess history fits 320px');
    await page.screenshot({ path: '.artifacts/chess/history-320-dark.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  const arenaContext = await browser.newContext();
  try {
    const arena = await arenaContext.newPage(); await setup(arena, base);
    const arenaErrors = []; arena.on('pageerror', error => arenaErrors.push(error.message));
    for (const preset of await arena.locator('#chess-clock-presets button').all()) {
      assert.equal(await preset.isEnabled(), true);
      await preset.click();
      assert.equal(await arena.locator('#chess-time-control').inputValue(), 'clock');
      assert.equal(await arena.locator('#chess-minutes').inputValue(), await preset.getAttribute('data-chess-minutes'));
      assert.equal(await arena.locator('#chess-increment').inputValue(), await preset.getAttribute('data-chess-increment') ?? '0');
    }
    await arena.locator('#chess-difficulty').selectOption('Medium');
    assert.equal(await arena.locator('#chess-level').inputValue(), '10');
    await arena.locator('#chess-level').focus(); await arena.keyboard.press('Home');
    for (let i = 0; i < 7; i++) await arena.keyboard.press('ArrowRight');
    assert.equal(await arena.locator('#chess-level-value').textContent(), '7 / 20');
    await arena.getByRole('button', { name: 'Blitz 3+2', exact: true }).click();
    assert.equal(await arena.locator('#chess-time-control').inputValue(), 'clock');
    assert.equal(await arena.locator('#chess-increment').inputValue(), '2');
    await start(arena); assert.equal(await arena.evaluate(() => document.fullscreenElement),null);
    await move(arena, 'e2', 'e4'); await arena.locator('#chess-moves li').nth(1).waitFor();
    assert.match(await arena.locator('#chess-game-label').textContent(), /level 7\/20/);
    assert.equal(await arena.locator('.site-header').evaluate(node => node.inert), false);
    await arena.locator('#chess-fullscreen').click(); await arena.waitForFunction(() => document.fullscreenElement?.id === 'chess-screen');
    await arena.locator('#chess-back').click();
    await arena.waitForFunction(() => !document.fullscreenElement);
    assert.equal(await arena.locator('.site-header').evaluate(node => node.inert), false);
    await arena.locator('#chess-resume').click(); await arena.locator('#chess-status').filter({ hasText: 'Your turn' }).waitFor();
    assert.match(await arena.locator('#chess-game-label').textContent(), /level 7\/20/);
    await arena.locator('#chess-resign').click();
    const record = (await games(arena))[0];
    assert.equal(record.settings.skillLevel, 7); assert.equal(record.settings.minutes, 3); assert.equal(record.settings.increment, 2);
    await arena.locator('#chess-lessons-toggle').click(); await arena.locator('[data-lesson="pawn-fork"]').click();
    assert.equal(await arena.locator('#chess-practice').isDisabled(), true);
    await move(arena, 'e4', 'e5'); assert.match(await arena.locator('[data-square="e4"]').getAttribute('aria-label'), /White pawn/);
    await arena.locator('#chess-demo-next').click();
    assert.match(await arena.locator('[data-square="e5"]').getAttribute('aria-label'), /White pawn/);
    assert.match(await arena.locator('#chess-lesson-feedback').textContent(), /e4 → e5/);
    await practice(arena);
    assert.match(await arena.locator('[data-square="e4"]').getAttribute('aria-label'), /White pawn/);
    await move(arena, 'h1', 'g1'); assert.match(await arena.locator('#chess-lesson-feedback').textContent(), /different idea/);
    await move(arena, 'e4', 'e5'); await move(arena, 'd6', 'd7'); await move(arena, 'e5', 'f6');
    assert.match(await arena.locator('#chess-lesson-step').textContent(), /Exercise complete/);
    const attempt = await arena.evaluate(() => JSON.parse(localStorage.getItem('cash-handling-chess-lessons-v1')).value.at(-1));
    assert.equal(attempt.completed, true); assert.equal(attempt.moves, 4); assert.equal(attempt.retries, 1);
    assert.deepEqual(arenaErrors, []);
    // Fullscreen denial still leaves usable gameplay and a deliberate exit.
    await arena.locator('#chess-back').click(); await arena.waitForFunction(() => !document.fullscreenElement);
    await arena.evaluate(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen unavailable')); });
    await start(arena);
    await arena.locator('#chess-fullscreen').click();
    await arena.locator('#chess-fullscreen-note').filter({ hasText: 'unavailable' }).waitFor();
    assert.equal(await arena.locator('#chess-screen').isVisible(), true);
    await move(arena, 'e2', 'e4'); await arena.locator('#chess-moves li').nth(1).waitFor();
    await arena.locator('#chess-back').click(); assert.equal(await arena.locator('#setup-screen').isVisible(), true);
  } finally { await arenaContext.close(); }
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
    await touch.locator('#chess-open-lessons').tap(); await touch.locator('[data-lesson="pawn"]').tap(); await practice(touch);
    await touch.locator('[data-square="e2"]').tap(); await touch.locator('[data-square="e4"]').tap();
    assert.match(await touch.locator('[data-square="e4"]').getAttribute('aria-label'), /White pawn/);
  } finally { await touchContext.close(); }
  console.log('Chess browser checks passed: real engine, four difficulties, lessons, clocks, review, exports and responsive board.');
}
