import assert from 'node:assert/strict';

const move = async (page, from, to) => { await page.locator(`[data-square="${from}"]`).click(); await page.locator(`[data-square="${to}"]`).click(); };

// WCAG relative luminance contrast between two CSS rgb() colors.
function contrast(a, b) {
  const lum = (color) => {
    const [r, g, bl] = color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export async function checkChessLayout(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => localStorage.setItem('cash-handling-terminal-quiz-theme-v1', 'dark'));
    await page.goto(base);
    await page.locator('#setup-form:not([inert])').waitFor();
    await page.locator('input[name="game"][value="chess"]').check({ force: true });
    await page.locator('#chess-setup-status').filter({ hasText: 'Computer ready' }).waitFor();
    await page.locator('#chess-color').selectOption('w');
    await page.locator('#chess-time-control').selectOption('untimed');
    await page.getByRole('button', { name: 'Start chess game', exact: true }).click();
    await page.locator('#chess-status').filter({ hasText: 'Your turn' }).waitFor();

    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [768, 1024], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      const layout = await page.evaluate(() => {
        document.getElementById('chess-screen').scrollIntoView({ block: 'start' });
        const box = (s) => document.querySelector(s).getBoundingClientRect();
        const board = box('#chess-board'), moves = box('#chess-moves-card'), actions = box('#chess-game-actions');
        return { board: { w: board.width, h: board.height, top: board.top, bottom: board.bottom, right: board.right, left: board.left },
          moves: { left: moves.left, top: moves.top }, actions: { left: actions.left }, inner: innerHeight, scrollWidth: document.documentElement.scrollWidth, innerWidth };
      });
      assert.ok(Math.abs(layout.board.w - layout.board.h) <= 1, `${width}x${height}: board stays square (${layout.board.w}x${layout.board.h})`);
      assert.ok(layout.board.w >= Math.min(288, width - 40), `${width}px: board large enough to read`);
      assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `${width}px: no horizontal scroll`);
      if (width >= 1024) {
        assert.ok(layout.board.bottom <= layout.inner + 1, `${width}x${height}: whole board visible without scrolling ${JSON.stringify(layout)}`);
        assert.ok(layout.moves.left >= layout.board.right, `${width}px: move list sits beside the board`);
        assert.ok(layout.moves.top < layout.inner, `${width}px: move list visible`);
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });

    // Piece colors are readable on both square colors.
    const colors = await page.evaluate(() => {
      const fill = (square) => getComputedStyle(document.querySelector(`[data-square="${square}"] .piece-body`)).fill;
      const bg = (square) => getComputedStyle(document.querySelector(`[data-square="${square}"]`)).backgroundColor;
      return { white: fill('e1'), black: fill('e8'), light: bg('h1'), dark: bg('a1') };
    });
    for (const piece of ['white', 'black']) for (const square of ['light', 'dark']) {
      if (piece === 'white' && square === 'light') continue; // white pieces carry a dark outline on light squares
      assert.ok(contrast(colors[piece], colors[square]) >= 3, `${piece} pieces on ${square} squares: ${contrast(colors[piece], colors[square]).toFixed(2)}:1`);
    }
    assert.ok(contrast(colors.white, colors.black) >= 7, 'white and black pieces are clearly different');
    const outline = await page.evaluate(() => getComputedStyle(document.querySelector('[data-square="e1"] .piece-body')).stroke);
    assert.ok(contrast(outline, colors.light) >= 3, 'white piece outline readable on light squares');

    // Moves show in numbered order; review steps forward and back with visible controls.
    await move(page, 'e2', 'e4'); await page.locator('#chess-moves li').nth(1).waitFor();
    await move(page, 'g1', 'f3'); await page.locator('#chess-moves li').nth(3).waitFor();
    assert.match(await page.locator('#chess-moves li').first().textContent(), /^1\. e4$/);
    assert.equal(await page.locator('#chess-moves li[aria-current="step"]').count(), 1, 'latest move highlighted');
    await page.locator('#chess-resign').click();
    await page.locator('#chess-analyze').waitFor({ state: 'visible' });
    await page.locator('#chess-analyze').click();
    await page.locator('#chess-review').waitFor({ state: 'visible' });
    for (const id of ['first', 'prev', 'next', 'last']) assert.ok(await page.locator(`#chess-review-${id}`).isVisible(), `${id} control visible`);
    const position = () => page.locator('#chess-review-position').textContent();
    await page.locator('#chess-review-last').click();
    assert.equal(await position(), 'Move 4 of 4');
    assert.equal(await page.locator('#chess-review-next').isDisabled(), true);
    await page.locator('#chess-review-prev').click();
    assert.equal(await position(), 'Move 3 of 4');
    assert.equal(await page.locator('#chess-moves li[aria-current="step"]').getAttribute('data-ply'), '3', 'list highlights the reviewed move');
    await page.locator('#chess-review-first').click();
    assert.equal(await position(), 'Move 0 of 4');
    assert.equal(await page.locator('[data-square="e2"] .chess-piece svg').count(), 1, 'first position restores the board');
    await page.locator('#chess-moves li[data-ply="2"]').click();
    assert.equal(await position(), 'Move 2 of 4', 'selecting a move jumps to it');
    await page.locator('#chess-review-position').click();
    await page.keyboard.press('ArrowRight');
    assert.equal(await position(), 'Move 3 of 4', 'arrow keys step through moves');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await position(), 'Move 2 of 4');
    await page.locator('#chess-screen').screenshot({ path: (process.env.TEMP || '/tmp') + '/chess-review-layout.png' });
    console.log('Chess layout: square board fits the window, move list beside it, readable piece contrast, review controls step both ways');
  } finally { await context.close(); }
}
