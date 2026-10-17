import assert from 'node:assert/strict';

// Every game card on the setup screen has one width and one height at common widths.
export async function checkSetupLayout(browser, base) {
  for (const width of [280, 390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(base);
    await page.locator('#setup-form:not([inert])').waitFor();
    for (const game of ['cash', 'error-detection', 'chess']) {
      await page.locator(`input[name="game"][value="${game}"]`).check({ force: true });
      const cards = await page.locator('.game-choice-grid > .choice-card:not([hidden])').evaluateAll((items) => items.map((item) => {
        const box = item.getBoundingClientRect();
        const style = getComputedStyle(item);
        return { width: Math.round(box.width), height: Math.round(box.height), left: box.left, top: box.top, right: box.right, bottom: box.bottom,
          checked: item.querySelector('input').checked, border: style.borderColor, shadow: style.boxShadow, background: style.backgroundColor,
          clipped: [...item.querySelectorAll('strong, small')].some((text) => text.scrollWidth > text.clientWidth + 1 || text.getBoundingClientRect().bottom > box.bottom + 1) };
      }));
      assert.equal(cards.length, 8, `${width}px: eight game cards`);
      assert.equal(new Set(cards.map((card) => card.width)).size, 1, `${width}px: equal card widths ${cards.map((c) => c.width)}`);
      assert.equal(new Set(cards.map((card) => card.height)).size, 1, `${width}px: equal card heights ${cards.map((c) => c.height)}`);
      assert.ok(cards.every((card) => !card.clipped), `${width}px: no clipped card text`);
      for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
        const [a, b] = [cards[i], cards[j]];
        assert.ok(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1, `${width}px: cards ${i} and ${j} overlap`);
      }
      const selected = cards.filter((card) => card.checked);
      assert.equal(selected.length, 1);
      const unselected = cards.find((card) => !card.checked);
      assert.notEqual(selected[0].border, unselected.border, `${width}px: selected card border differs`);
      assert.notEqual(selected[0].shadow, 'none');
    }
    const selectedStyles = [];
    for (const game of ['cash', 'memory', 'task', 'error-detection', 'typing', 'overload', 'chess']) {
      await page.locator(`input[name="game"][value="${game}"]`).check({ force: true });
      selectedStyles.push(await page.locator(`input[name="game"][value="${game}"]`).evaluate((input) => {
        const style = getComputedStyle(input.closest('.choice-card'));
        return `${style.borderColor}|${style.boxShadow}|${style.backgroundColor}`;
      }));
    }
    assert.equal(new Set(selectedStyles).size, 1, `${width}px: same selected state on every card`);
    await page.close();
  }
  console.log('Setup layout: equal game cards, no overlap, consistent selected state at 280–1440px');
}
