import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { APPROVED_UID } from '../account-access.mjs';
import { firebaseConfig } from '../firebase-config.mjs';
import { answer } from './browser-history-checks.mjs';
const email='approved@example.com';
const password='Test-'+crypto.randomUUID();
const historyKey='cash-handling-terminal-quiz-history-v1';
const accountModule='./firebase-accounts.mjs?v=20261004-private';
const sdkBase='https://www.gstatic.com/firebasejs/12.19.0/';
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
const saved=page=>page.locator('#account-status').filter({hasText:/^Saved$/}).waitFor({timeout:30000});
async function seed(uid,userEmail){
  const response=await fetch('http://127.0.0.1:9309/identitytoolkit.googleapis.com/v1/projects/cash-handling-quiz/accounts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify({localId:uid,email:userEmail,password})});
  assert.ok(response.ok,'emulator account created');
}
export async function routeEmulators(context){
  for(const kind of ['auth','firestore']){
    await context.route(sdkBase+`firebase-${kind}.js`,route=>{
      const original=sdkBase+`firebase-${kind}.js?original=1`;
      const override=kind==='auth'
        ? `export function getAuth(app){const value=real.getAuth(app);if(!connected.has(value)){real.connectAuthEmulator(value,'http://127.0.0.1:9309',{disableWarnings:true});connected.add(value);}return value;}`
        : `export function initializeFirestore(app,options){const value=real.initializeFirestore(app,options);real.connectFirestoreEmulator(value,'127.0.0.1',9088);return value;}`;
      return route.fulfill({contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:`import * as real from '${original}';export * from '${original}';const connected=new WeakSet();${override}`});
    });
  }
}
async function login(page,userEmail=email){
  await page.locator('#account-area').evaluate(node=>node.open=true);
  await page.locator('#account-email').fill(userEmail);
  await page.locator('#account-password').fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
}
export async function checkGuestAccess(browser,base){
  const context=await browser.newContext();const page=await context.newPage();
  try{
    await page.goto(base);await ready(page);
    assert.equal(await page.locator('#account-signup').count(),0);
    const fraud=page.locator('input[name="game"][value="fraud-inspection"]');assert.equal(await fraud.isDisabled(),true);
    for(const game of ['cash','memory','task','error-detection','typing','overload','chess'])assert.equal(await page.locator(`input[name="game"][value="${game}"]`).isEnabled(),true);
    await page.locator('#fraud-signin').click();assert.equal(await page.locator('#account-area').evaluate(node=>node.open),true);
    await page.locator('#account-password').fill('visibility-test');await page.locator('#account-show-password').click();assert.equal(await page.locator('#account-password').getAttribute('type'),'text');await page.locator('#account-show-password').click();assert.equal(await page.locator('#account-password').getAttribute('type'),'password');
    for(const width of [320,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    await mkdir('.artifacts/invite-only',{recursive:true});await page.screenshot({path:'.artifacts/invite-only/signin-desktop.png',fullPage:true});
    // A manipulated selection still cannot start the restricted game through the app.
    await fraud.evaluate(node=>{node.disabled=false;node.checked=true;});await page.getByRole('button',{name:'Start quiz',exact:true}).click();assert.equal(await page.locator('#fraud-inspection-screen').isVisible(),false);assert.equal(await page.locator('#setup-screen').isVisible(),true);
    await page.locator('input[name="game"][value="memory"]').check();await page.locator('#memory-question-count').fill('1');await page.getByRole('button',{name:'Start quiz',exact:true}).click();await answer(page,'memory');await page.locator('#feedback-screen').waitFor();
    console.log('Guest checks passed: no signup, seven available games, Fraud lock and start guard, sign-in controls and responsive layout.');
  }finally{await context.close();}
}
export async function withApprovedProfiles(browser,base,run){
  assert.equal(process.env.QUIZ_EMULATORS,'1');
  await fetch('http://127.0.0.1:9309/emulator/v1/projects/cash-handling-quiz/accounts',{method:'DELETE'});
  await seed(APPROVED_UID,email);
  const original=browser.newContext.bind(browser),initial=await original();await routeEmulators(initial);const page=await initial.newPage();await page.goto(base);await ready(page);await login(page);await saved(page);const storageState=await initial.storageState({indexedDB:true});await initial.close();
  browser.newContext=async options=>{const context=await original({...options,storageState});await routeEmulators(context);return context;};
  try{await run();}finally{browser.newContext=original;}
}
async function rulesChecks(){
  const tokenFor=async userEmail=>{const response=await fetch('http://127.0.0.1:9309/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:userEmail,password,returnSecureToken:true})});return (await response.json()).idToken;};
  const owner=await tokenFor(email),other=await tokenFor('unapproved@example.com');assert.ok(owner&&other);
  const endpoint=uid=>`http://127.0.0.1:9088/v1/projects/cash-handling-quiz/databases/(default)/documents/users/${uid}/settings/rules-probe`;
  const data={fields:{schema:{integerValue:'1'},key:{stringValue:'cash-handling-chess-settings-v1'},payload:{stringValue:'null'},deleted:{booleanValue:false},modifiedAt:{integerValue:'1'},deviceId:{stringValue:'probe'}}};
  const write=await fetch(endpoint(APPROVED_UID),{method:'PATCH',headers:{Authorization:'Bearer '+owner,'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(write.status,200,'approved owner write allowed');
  for(const [uid,token] of [[APPROVED_UID,other],['unapproved-test',other],[APPROVED_UID,null]]){const read=await fetch(endpoint(uid),{headers:token?{Authorization:'Bearer '+token}:{}});assert.ok([401,403].includes(read.status),'non-approved/guest reads denied');}
  const invalid={fields:{...data.fields,role:{stringValue:'admin'}}};const bad=await fetch(endpoint(APPROVED_UID),{method:'PATCH',headers:{Authorization:'Bearer '+owner,'Content-Type':'application/json'},body:JSON.stringify(invalid)});assert.equal(bad.status,403);
}
export async function checkFirebase(browser,base){
  await checkGuestAccess(browser,base);
  if(process.env.QUIZ_EMULATORS!=='1'){
    const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`codex-denied-${crypto.randomUUID()}@example.com`,password,returnSecureToken:true})});
    const result=await response.json();
    if(response.ok){await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${firebaseConfig.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:result.idToken})});}
    assert.equal(response.ok,false,'backend public signup denied');assert.match(result.error?.message??'',/ADMIN_ONLY_OPERATION|OPERATION_NOT_ALLOWED/);
    console.log('LIVE Firebase signup API rejects account creation; guest site restrictions passed.');return;
  }
  await fetch('http://127.0.0.1:9309/emulator/v1/projects/cash-handling-quiz/accounts',{method:'DELETE'});
  await seed(APPROVED_UID,email);await seed('unapproved-test','unapproved@example.com');await rulesChecks();
  const contexts=[];const newProfile=async()=>{const context=await browser.newContext();contexts.push(context);await routeEmulators(context);const page=await context.newPage();await page.goto(base);await ready(page);return page;};
  const rows=page=>page.evaluate(async({module,key})=>JSON.parse((await import(module)).accountStorage.getItem(key)),{module:accountModule,key:historyKey});
  try{
    const a=await newProfile();await login(a);await saved(a);assert.equal(await a.locator('input[name="game"][value="fraud-inspection"]').isEnabled(),true);
    await a.locator('input[name="game"][value="fraud-inspection"]').check();await a.getByRole('button',{name:'Start quiz',exact:true}).click();await a.locator('#fraud-inspection-screen').waitFor();await a.locator('[data-issue-id="no-issues"]').click();await a.locator('#submit-fraud-inspection').click();await saved(a);
    const b=await newProfile();await login(b);await saved(b);assert.deepEqual(await rows(b),await rows(a));
    await a.goto(base);await ready(a);await saved(a);await a.context().setOffline(true);await a.locator('input[name="game"][value="memory"]').check();await a.locator('#memory-question-count').fill('1');await a.getByRole('button',{name:'Start quiz',exact:true}).click();await answer(a,'memory');await a.locator('#feedback-screen').waitFor();assert.match(await a.locator('#account-status').textContent(),/Offline/);await a.context().setOffline(false);await saved(a);await b.waitForFunction(async({module,key})=>JSON.parse((await import(module)).accountStorage.getItem(key)).length===2,{module:accountModule,key:historyKey});
    await a.locator('#account-area').evaluate(node=>node.open=true);await a.locator('#account-signout').click();await ready(a);assert.equal(await a.locator('input[name="game"][value="fraud-inspection"]').isDisabled(),true);await login(a);await saved(a);assert.equal((await rows(a)).length,2);
    const c=await newProfile();await login(c,'unapproved@example.com');await c.locator('#account-error').filter({hasText:'does not have permission'}).waitFor();assert.equal(await c.locator('input[name="game"][value="fraud-inspection"]').isDisabled(),true);assert.equal(await c.locator('#account-user').textContent(),'Guest · saved on this device');
    console.log('Emulator Firebase passed: approved login, Fraud gameplay, two profiles, offline sync, sign out/in, rejected unapproved account and strict UID rules. No real owner data was changed.');
  }finally{for(const context of contexts)await context.close();}
}
