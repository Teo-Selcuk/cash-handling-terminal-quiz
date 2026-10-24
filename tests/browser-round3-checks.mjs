import assert from 'node:assert/strict';

const GAMES = ['cash', 'memory', 'task', 'error-detection', 'fraud-inspection', 'typing', 'overload', 'chess'];
const luminance = (rgb) => {
  const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map((part) => {
    const channel = Number(part) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

async function setTheme(page, theme) {
  if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) await page.locator('#theme-toggle').click();
}

// Round 3: label colors per theme, Example toggles, game tags, projections, numpad play, narrow layout.
export async function checkRound3(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(base);
    await page.locator('#open-history').click();
    await page.locator('#history-game-tabs button[data-history-game="cash"]').click();
    assert.equal(await page.locator('#history-projection .projection-empty').textContent(), 'No attempts yet.', 'no attempts: projection says so');
    await page.locator('#history-data-source input[value="sample"]').check({ force: true });
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      for (const game of GAMES) {
        const tab = page.locator(`#history-game-tabs button[data-history-game="${game}"]`);
        if (!(await tab.isVisible())) continue;
        await tab.click();
        const result = await page.evaluate((selected) => {
          const visible = (el) => el.getClientRects().length > 0;
          const scope = selected === 'chess' ? document.getElementById('chess-history') : document.getElementById('history-screen');
          const cards = [...scope.querySelectorAll('.interactive-chart, .history-visuals > .visual-card')].filter(visible);
          const labels = [...scope.querySelectorAll('.bar-chart-value, .analytics-svg .chart-value-label')].filter(visible).slice(0, 30)
            .map((label) => ({ color: getComputedStyle(label).color === 'rgba(0, 0, 0, 0)' ? getComputedStyle(label).fill : (label.tagName === 'text' ? getComputedStyle(label).fill : getComputedStyle(label).color),
              background: getComputedStyle(label.closest('.visual-card')).backgroundColor }));
          const projection = selected === 'chess' ? document.getElementById('chess-history-projection') : document.getElementById('history-projection');
          return { cards: cards.length, noTag: cards.filter((card) => !card.querySelector('.chart-game-tag')?.textContent).length,
            noExample: cards.filter((card) => !card.querySelector(':scope > .chart-example')).length,
            openExamples: cards.filter((card) => card.querySelector(':scope > .chart-example')?.open).length,
            paragraphLists: [...scope.querySelectorAll('#history-insights > p, #advanced-error-analytics > p.chart-note')].filter(visible).length,
            labels, projection: projection?.dataset.status };
        }, game);
        assert.ok(result.cards > 0, `${theme}/${game}: charts`);
        assert.equal(result.noTag, 0, `${theme}/${game}: every chart names its game`);
        assert.equal(result.noExample, 0, `${theme}/${game}: every chart has an Example`);
        assert.equal(result.openExamples, 0, `${theme}/${game}: Examples start hidden`);
        assert.equal(result.paragraphLists, 0, `${theme}/${game}: no paragraph lists`);
        assert.equal(result.projection, 'ok', `${theme}/${game}: projection from sample attempts`);
        for (const label of result.labels) assert.ok(contrast(label.color, label.background) >= 4.5, `${theme}/${game}: label ${label.color} on ${label.background}`);
      }
    }
    await page.locator('#history-game-tabs button[data-history-game="cash"]').click();
    const accuracy = page.locator('.history-visuals > .visual-card').nth(1);
    const example = accuracy.locator(':scope > .chart-example');
    await example.locator('summary').click();
    assert.equal(await example.evaluate((el) => el.open), true, 'Example opens');
    assert.match(await example.textContent(), /Right answers ÷ tries × 100/);
    await example.locator('summary').click();
    assert.equal(await example.evaluate((el) => el.open), false, 'Example closes');
    await setTheme(page, 'dark');
    assert.equal(await accuracy.locator('.bar-chart-value').first().evaluate((el) => getComputedStyle(el).color), 'rgb(237, 245, 242)', 'white numbers in dark theme');
    await setTheme(page, 'light');
    assert.equal(await accuracy.locator('.bar-chart-value').first().evaluate((el) => getComputedStyle(el).color), 'rgb(23, 39, 42)', 'dark numbers in light theme');
    await page.setViewportSize({ width: 360, height: 800 });
    await page.evaluate(() => document.querySelectorAll('.chart-example').forEach((el) => { el.open = true; }));
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.chart-example li, #advanced-error-analytics li, #history-projection li')]
      .filter((el) => el.getClientRects().length && el.getBoundingClientRect().right > (el.closest('.visual-card, #advanced-error-analytics')?.getBoundingClientRect().right ?? innerWidth) + 1).length);
    assert.equal(overflow, 0, 'narrow window: text wraps inside its card');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways page scroll');
  } finally {
    await context.close();
  }
  await checkNumpadPlay(browser, base);
}

// Plays a cash round with only the number keypad: / * - pick the answer, digits fill the amount, Enter submits.
async function checkNumpadPlay(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(base);
    await page.locator('#setup-form button[type="submit"]').click();
    await page.locator('#quiz-screen').waitFor();
    await page.keyboard.press('NumpadSubtract');
    assert.equal(await page.locator('input[name="answerType"]:checked').getAttribute('value'), 'Short');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'answer-amount', 'Short moves to the amount box');
    await page.keyboard.press('NumpadDivide');
    assert.equal(await page.locator('input[name="answerType"]:checked').getAttribute('value'), 'Short', 'keys do nothing inside the text box');
    await page.locator('input[name="answerType"][value="Exact"]').focus();
    await page.keyboard.press('Minus');
    assert.equal(await page.locator('input[name="answerType"]:checked').getAttribute('value'), 'Short', 'the main keyboard minus is not a shortcut');
    await page.keyboard.press('NumpadDivide');
    assert.equal(await page.locator('input[name="answerType"]:checked').getAttribute('value'), 'Exact');
    await page.keyboard.press('Enter');
    await page.locator('#feedback-screen').waitFor();
    await page.locator('#next-question').click();
    await page.locator('input[name="answerType"][value="Change"]').click();
    assert.equal(await page.locator('input[name="answerType"]:checked').getAttribute('value'), 'Change', 'clicking still works');
  } finally {
    await context.close();
  }
}
