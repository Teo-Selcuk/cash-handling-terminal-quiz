import assert from 'node:assert/strict';

export async function checkHoldTraining(browser,base) {
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  const page=await context.newPage(),errors=[];
  await page.addInitScript(()=> {let seed=211;Math.random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);});
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(base);
    await page.locator('input[name="game"][value="fraud-inspection"]').check();
    assert.equal(await page.locator('#fraud-use-holds').isChecked(),false);
    await page.locator('#fraud-use-holds').check();
    await page.locator('input[name="difficulty"][value="Custom"]').check();
    await page.locator('#fraud-custom-options summary').click();
    await page.locator('#fraud-question-count').fill('10');
    await page.locator('#fraud-time-limit').fill('300');
    await page.locator('#fraud-minimum-errors').fill('0');
    await page.locator('#fraud-maximum-errors').fill('0');
    await page.locator('#fraud-allow-clean').check();
    await page.getByRole('button',{name:'Start quiz',exact:true}).click();
    for(let i=0;i<10;i++) {
      await page.locator('#hold-decision-area').waitFor({state:'visible'});
      const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('cash-handling-terminal-quiz-history-v1')).at(-1));
      assert.ok(record.holdScenario);const expected=record.holdExpected;
      for(const id of record.fraudExpectedCategories) await page.locator(`[data-issue-id="${id}"]`).click();
      if(!record.fraudExpectedCategories.length) await page.locator('[data-issue-id="no-issues"]').click();
      await page.locator('#hold-itemType').selectOption(expected.itemType);
      await page.locator('#hold-action').selectOption(expected.action);
      await page.locator('#hold-classification').selectOption(expected.classification);
      if(expected.action==='hold') {
        assert.equal(await page.locator('#hold-holdType').isVisible(),true);
        await page.locator('#hold-holdType').selectOption(expected.holdType);
        await page.locator('#hold-notice').selectOption('given');
      } else { await page.locator('#hold-holdType').selectOption('none'); await page.locator('#hold-notice').selectOption('not-required'); }
      await page.locator('#hold-availability').selectOption(expected.availability.length ? expected.availability.map(t=>t.day).join('/') : 'na');
      assert.doesNotMatch(await page.locator('#hold-decision-area').textContent(),/Burke\s*&\s*Herbert|B&H|BNH/i);
      await page.locator('#hold-decision-area .hold-step-details > summary').click();
      await page.getByText('Teller file / prior checks / Alert Center Details',{exact:true}).click();
      assert.match(await page.locator('#hold-decision-area').textContent(),/Recorded payer signature/);
      for(const step of expected.workflow) await page.locator(`#hold-decision-area input[value="${step}"]`).check();
      if(expected.workflow.includes('verification-note')) await page.locator('#hold-note').fill('Customer verified + 2026-10-03 + 14:35');
      for(const width of i===0?[320,768,1440]:[1440]) {
        await page.setViewportSize({width,height:1100});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`hold training fits ${width}px`);
      }
      if(i===0) await page.screenshot({path:(process.env.TEMP||'/tmp')+'/hold-training-desktop.png',fullPage:true});
      await page.locator('#submit-fraud-inspection').click();
      await page.locator('#feedback-screen').waitFor({state:'visible'});
      assert.equal(await page.locator('#feedback-heading').textContent(),'Correct review');
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cash-handling-terminal-quiz-history-v1')).at(-1));
      assert.equal(saved.outcome,'Correct');assert.deepEqual(saved.holdDecisionErrors,[]);assert.ok(saved.holdAnswer);
      await page.locator('#next-question').click();
    }
    assert.deepEqual(errors,[]);
    console.log('Hold training browser checks passed: toggle, decisions, processing branches, notices, workflow, saved raw inputs and responsive layout.');
  } finally {await context.close();}
}
