import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { answer } from './browser-history-checks.mjs';

// Live only, explicitly selected with QUIZ_FOCUSED=firebase. Fresh test profiles.
export async function checkFirebase(browser,base){
  const contexts=[];const pages=[];const testUsers=[];const errors=[];
  const password='T-'+crypto.randomUUID();
  const historyKey='cash-handling-terminal-quiz-history-v1';
  const rows=page=>page.evaluate(async key=>JSON.parse((await import('./firebase-accounts.mjs')).accountStorage.getItem(key)),historyKey);
  const ready=page=>page.locator('#account-status').filter({hasText:/Sign in to sync|Saved/}).waitFor({timeout:60000});
  const saved=page=>page.locator('#account-status').filter({hasText:/^Saved$/}).waitFor({timeout:60000});
  async function profile(){const context=await browser.newContext();contexts.push(context);const page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.message));await page.goto(base);await ready(page);return page;}
  async function login(page,email,signup=false){await page.locator('#account-area').evaluate(el=>el.open=true);await page.locator('#account-email').fill(email);await page.locator('#account-password').fill(password);await page.getByRole('button',{name:signup?'Sign up':'Sign in',exact:true}).click();await page.locator('#account-user').filter({hasText:email}).waitFor({timeout:60000});await saved(page);}
  async function uid(page){return page.evaluate(async()=>(await import('./firebase-accounts.mjs')).accountStorage.uid);}
  async function memory(page){if(await page.locator('#feedback-screen').isVisible())await page.locator('#next-question').click();if(await page.locator('#summary-screen').isVisible())await page.locator('#start-another').click();await page.locator('input[name="game"][value="memory"]').check();await page.locator('#memory-question-count').fill('1');await page.getByRole('button',{name:'Start quiz',exact:true}).click();await page.locator('#memory-read-screen').waitFor({state:'visible'});await answer(page,'memory');await page.locator('#feedback-screen').waitFor({state:'visible'});}
  try{
    const a=await profile();const emailA=`codex-sync-${crypto.randomUUID()}@example.com`;
    const legacy={game:'memory',gameType:'Number memory',sessionId:'legacy-migration',questionNumber:1,timestamp:'2026-01-01T12:00:00Z',difficulty:'Easy',outcome:'Correct',timeUsedSeconds:2,expectedAnswer:'1234',userAnswer:'1234'};
    await a.evaluate(({key,legacy})=>localStorage.setItem(key,JSON.stringify([legacy,{...legacy,isSample:true,sessionId:'sample-excluded'}])),{key:historyKey,legacy});
    await login(a,emailA,true);testUsers.push({uid:await uid(a),email:emailA});
    assert.deepEqual(await rows(a),[],'guest history is not silently assigned to an account');
    await a.locator('#account-area').evaluate(el=>el.open=true);await a.locator('#account-import').click();await saved(a);
    assert.deepEqual(await rows(a),[legacy]);
    await memory(a);await saved(a);assert.equal((await rows(a)).length,2);
    const b=await profile();await login(b,emailA);assert.equal((await rows(b)).length,2,'second device receives history');
    await a.locator('#account-area').evaluate(el=>el.open=true);await a.locator('#account-signout').click();await ready(a);
    assert.equal((await rows(a)).length,2,'guest original remains intact');await login(a,emailA);assert.equal((await rows(a)).length,2);
    await b.locator('#open-history').click();const actual=await rows(b);
    await b.locator('input[name="historyDataSource"][value="sample"]').check();assert.equal((await rows(b)).length,2);
    await b.locator('input[name="historyDataSource"][value="real"]').check();assert.deepEqual(await rows(b),actual);
    assert.ok(await b.locator('#history-rows tr').count()>=2);
    // Begin while online, finish with networking disabled, then reconnect.
    await a.context().setOffline(true);await memory(a);assert.equal((await rows(a)).length,3);assert.match(await a.locator('#account-status').textContent(),/Offline/);
    await a.context().setOffline(false);await saved(a);await b.waitForFunction(async key=>JSON.parse((await import('./firebase-accounts.mjs')).accountStorage.getItem(key)).length===3,historyKey,{timeout:60000});
    // Independent attempts made concurrently by two signed-in devices merge.
    await b.goto(base);await saved(b);await Promise.all([memory(a),memory(b)]);await saved(a);await saved(b);
    await a.waitForFunction(async key=>JSON.parse((await import('./firebase-accounts.mjs')).accountStorage.getItem(key)).length===5,historyKey,{timeout:60000});
    await b.waitForFunction(async key=>JSON.parse((await import('./firebase-accounts.mjs')).accountStorage.getItem(key)).length===5,historyKey,{timeout:60000});
    assert.equal(new Set((await rows(a)).map(r=>r.sessionId+':'+r.questionNumber)).size,5);
    // Detailed Hold responses are real gameplay and retain every raw decision.
    await a.goto(base);await saved(a);await a.locator('input[name="game"][value="fraud-inspection"]').check();await a.locator('#fraud-use-holds').check();await a.getByRole('button',{name:'Start quiz',exact:true}).click();await a.locator('#hold-decision-area').waitFor({state:'visible'});
    const checkpoint=(await rows(a)).findLast(r=>r.game==='fraud-inspection'),expected=checkpoint.holdExpected;
    for(const id of checkpoint.fraudExpectedCategories)await a.locator(`[data-issue-id="${id}"]`).click();if(!checkpoint.fraudExpectedCategories.length)await a.locator('[data-issue-id="no-issues"]').click();
    for(const [key,value] of Object.entries({itemType:expected.itemType,classification:expected.classification,action:expected.action,holdType:expected.holdType,availability:expected.availability.length?expected.availability.map(t=>t.day).join('/'):'na',notice:expected.notice?'given':'not-required'}))await a.locator('#hold-'+key).selectOption(value);
    await a.locator('.hold-step-details summary').click();for(const step of expected.workflow)await a.locator(`#hold-decision-area input[value="${step}"]`).check();if(expected.workflow.includes('verification-note'))await a.locator('#hold-note').fill('Customer verified + 2026-10-03 + 14:35');await a.locator('#submit-fraud-inspection').click();await saved(a);
    await b.waitForFunction(async key=>JSON.parse((await import('./firebase-accounts.mjs')).accountStorage.getItem(key)).some(r=>r.game==='fraud-inspection'&&r.outcome==='Correct'),historyKey,{timeout:60000});
    // Multitasker settings and results.
    await a.goto(base);await saved(a);await a.locator('input[name="game"][value="overload"]').check();await a.locator('#overload-mode').selectOption('practice');await a.locator('#overload-startingTasks').fill('1');await a.locator('#overload-startingTasks').dispatchEvent('change');await a.getByRole('button',{name:'Start quiz',exact:true}).click();await a.locator('#overload-screen').waitFor({state:'visible'});await a.getByRole('button',{name:'End run',exact:true}).click();await saved(a);
    await b.waitForFunction(async key=>JSON.parse((await import('./firebase-accounts.mjs')).accountStorage.getItem(key)).some(r=>r.game==='overload'&&r.outcome!=='Not answered'),historyKey,{timeout:60000});
    // Chess settings and an actual game record use the same isolated cache.
    await a.goto(base);await saved(a);await a.locator('input[name="game"][value="chess"]').check();await a.locator('#chess-setup-status').filter({hasText:'Computer ready'}).waitFor();await a.locator('#chess-difficulty').selectOption('Beginner');await a.getByRole('button',{name:'Start chess game',exact:true}).click();await a.locator('#chess-status').filter({hasText:'Your turn'}).waitFor();await a.locator('#chess-resign').click();await saved(a);
    await b.waitForFunction(async()=>JSON.parse((await import('./firebase-accounts.mjs')).accountStorage.getItem('cash-handling-chess-games-v1')).value.length===1,null,{timeout:60000});
    await b.goto(base);await saved(b);assert.equal(await b.locator('#chess-difficulty').inputValue(),'Beginner');
    const c=await profile(),emailC=`codex-isolation-${crypto.randomUUID()}@example.com`;await login(c,emailC,true);testUsers.push({uid:await uid(c),email:emailC});assert.deepEqual(await rows(c),[]);
    const denied=await c.evaluate(async target=>{const f=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');const app=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');const db=f.getFirestore(app.getApp());const ref=f.doc(db,'users',target,'settings','cross-account-probe');const result=[];for(const action of [()=>f.getDoc(ref),()=>f.setDoc(ref,{schema:1,key:'cash-handling-chess-settings-v1',payload:'null',deleted:false,modifiedAt:Date.now(),deviceId:'probe'})]){try{await action();result.push('allowed');}catch(error){result.push(error.code);}}return result;},testUsers[0].uid);
    assert.deepEqual(denied,['permission-denied','permission-denied']);
    const ownerRules=await c.evaluate(async()=>{
      const f=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
      const app=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
      const auth=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
      const db=f.getFirestore(app.getApp()),uid=auth.getAuth().currentUser.uid;
      const ref=f.doc(db,'users',uid,'settings','owner-rules-probe');
      const valid={schema:1,key:'cash-handling-chess-settings-v1',payload:'null',deleted:false,modifiedAt:Date.now(),deviceId:'probe'};
      await f.setDoc(ref,valid);
      const results=[];
      for(const operation of [
        ()=>f.setDoc(ref,{...valid,role:'admin'}),
        ()=>f.setDoc(ref,{...valid,schema:2}),
        ()=>f.setDoc(ref,{...valid,payload:[]}),
        ()=>f.setDoc(ref,{...valid,payload:'x'.repeat(900001)}),
        ()=>f.setDoc(ref,{...valid,key:'cash-handling-terminal-quiz-theme-v1'}),
        ()=>f.setDoc(ref,{...valid,modifiedAt:valid.modifiedAt-1}),
        ()=>f.setDoc(f.doc(db,'users',uid,'profile','unauthorized-path'),valid),
        ()=>f.deleteDoc(ref),
      ]){try{await operation();results.push('allowed');}catch(error){results.push(error.code);}}
      return results;
    });
    assert.deepEqual(ownerRules,Array(8).fill('permission-denied'),'owner writes obey schema, size, revision and path constraints');
    await c.locator('#account-area').evaluate(el=>el.open=true);await c.locator('#account-signout').click();await ready(c);await c.locator('#account-area').evaluate(el=>el.open=true);await c.locator('#account-email').fill(emailC);await c.locator('#account-password').fill('incorrect-password');await c.getByRole('button',{name:'Sign in',exact:true}).click();await c.locator('#account-error').filter({hasText:'Email or password is incorrect'}).waitFor();
    assert.deepEqual(errors,[]);console.log('LIVE Firebase passed: account creation, gameplay, migration, duplicate prevention, two devices, sign out/in, offline/reconnect, concurrent attempts, Sample isolation, Hold, Multitasker, Chess and owner-only rules.');
  }finally{
    let prior=[];try{prior=JSON.parse(await readFile('.artifacts/firebase-test-users.json','utf8'));}catch{}await writeFile('.artifacts/firebase-test-users.json',JSON.stringify([...prior,...testUsers]));
    for(const context of contexts)await context.close();
  }
}
