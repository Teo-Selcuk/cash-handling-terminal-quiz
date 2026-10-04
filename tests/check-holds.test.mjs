import test from 'node:test';
import assert from 'node:assert/strict';
import { decideCheck, createHoldScenario, scoreHoldDecision, qualifyingPriorAccount } from '../check-holds.mjs';
import { createFraudInspectionCase } from '../fraud-inspection.mjs';

const base = { itemType: 'personal', amountCents: 900000, dailyCheckDepositsCents: 900000, accountAgeDays: 60, transaction: 'deposit' };
test('large deposit tiers and new account On-Us exclusion', () => {
  for (const [itemType, days] of [['personal',[0,2,7]], ['treasury',[0,1,7]], ['on-us',[0,1,2]]]) {
    const result = decideCheck({...base,itemType});
    assert.equal(result.holdType,'large');
    assert.deepEqual(result.availability.map(t=>t.day),days);
    assert.deepEqual(result.availability.map(t=>t.amountCents),[30000,650000,220000]);
    assert.equal(result.notice,true);
  }
  assert.deepEqual(decideCheck({...base,accountAgeDays:12,itemType:'on-us'}).availability,[{amountCents:900000,day:9}]);
  assert.deepEqual(decideCheck({...base,accountAgeDays:12,itemType:'treasury'}).availability.map(t=>t.day),[0,1,9]);
  assert.equal(decideCheck({...base,accountAgeDays:12,qualifyingPriorAccount:true}).holdType,'large');
});
test('cash ACH wire and foreign never receive Reg CC holds', () => {
  for(const itemType of ['cash','ach','wire','foreign']) {
    const result=decideCheck({...base,itemType,accountAgeDays:1,reasonableCause:true,emergency:true,returnedUnpaid:true,repeatedOverdraft:true});
    assert.equal(result.holdType,'none'); assert.equal(result.notice,false);
  }
  assert.equal(decideCheck({...base,itemType:'foreign'}).receipt,false);
});
test('exception categories and no hold cases', () => {
  for(const [flag,reason] of [['reasonableCause','reasonable'],['returnedUnpaid','redeposited'],['emergency','emergency']]) {
    for(const [itemType,day] of [['on-us',2],['treasury',7],['personal',7]]) {
      const result=decideCheck({...base,itemType,[flag]:true});
      assert.equal(result.holdType,reason); assert.deepEqual(result.availability,[{amountCents:900000,day}]);
    }
  }
  for(const [itemType,day] of [['treasury',1],['personal',2]]) {
    const result=decideCheck({...base,itemType,repeatedOverdraft:true});
    assert.equal(result.holdType,'overdraft'); assert.equal(result.availability.at(-1).day,day);
  }
  const clean={...base,amountCents:45000,dailyCheckDepositsCents:45000};
  assert.equal(decideCheck({...clean,correctedEndorsement:true,trueChecks:'review'}).holdType,'none');
  assert.equal(decideCheck({...clean,correctedPostdate:true}).holdType,'none');
  assert.equal(decideCheck({...clean,trueChecks:'confidential-risk',reasonableCause:true}).holdType,'reasonable');
});
test('acceptance workflow precedes holds', () => {
  for(const [patch,action] of [[{endorsement:'missing'},'correction'],[{incorrectInformation:true},'correction'],[{endorsement:'conditional'},'manager'],[{endorsement:'third-party'},'manager'],[{endorsement:'mark'},'manager'],[{llc:true,transaction:'cash'},'deposit-only'],[{endorsement:'deposit-only',transaction:'cash'},'deposit-only'],[{governmentJoin:'AND',allPayeesPresent:false},'manager'],[{unusedCashier:true},'correction'],[{physicalSplit:true},'reject'],[{nonCustomer:true,twoValidIds:false},'reject']]) {
    assert.equal(decideCheck({...base,...patch}).action,action);
  }
  assert.equal(decideCheck({...base,governmentJoin:'OR',allPayeesPresent:false}).action,'hold');
  assert.equal(decideCheck({...base,unusedCashier:true,endorsement:'NOT USED FOR INTENDED PURPOSE'}).action,'hold');
  assert.equal(decideCheck({...base,frontSignatureMark:true}).action,'manager');
  assert.equal(decideCheck({...base,itemType:'cashier',onUs:true}).availability.at(-1).day,2);
  assert.equal(decideCheck({...base,itemType:'cashier',onUs:true,accountAgeDays:3}).availability[0].day,9);
  assert.equal(decideCheck({...base,transaction:'cash-back'}).transaction,'deposit-with-cash-back');
});
test('generated scenarios include all types, holds and clean decisions; scoring notices and timing', () => {
  const reasons=new Set(),types=new Set(),actions=new Set();
  let seed=17; const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  for(let i=0;i<500;i++) { const c=createHoldScenario(random,i); const d=decideCheck(c); reasons.add(d.holdType);types.add(c.itemType);actions.add(d.action); }
  for(const r of ['none','large','new','reasonable','redeposited','overdraft','emergency']) assert.ok(reasons.has(r),r);
  assert.ok(types.has('wire'));assert.ok(actions.has('manager'));
  const expected=decideCheck(base);
  const answer={itemType:'personal',classification:'non-next-day',action:'hold',holdType:'large',availability:'0/2/7',notice:'given',workflow:expected.workflow,note:''};
  assert.equal(scoreHoldDecision(base,answer).correct,true);
  assert.ok(scoreHoldDecision(base,{...answer,notice:'not-required',availability:'2'}).errors.includes('Wrong Availability Period'));
  assert.ok(scoreHoldDecision(base,{...answer,notice:'not-required'}).errors.includes('Missing Hold Notice'));
});
test('prior-account exception requires every customer and both 30-calendar-day boundaries',()=> {
  const prior={transactional:true,atBurkeHerbert:true,ageDays:30,daysBeforeOpening:30};
  assert.equal(qualifyingPriorAccount([prior]),true);
  for(const bad of [{ageDays:29},{daysBeforeOpening:31},{atBurkeHerbert:false},{transactional:false}]) assert.equal(qualifyingPriorAccount([prior,{...prior,...bad}]),false);
});
test('daily allowances are aggregate and are not repeated for each deposited check',()=> {
  const result=decideCheck({...base,amountCents:250000,dailyCheckDepositsCents:950000});
  assert.deepEqual(result.availability,[{amountCents:250000,day:7}]);
});
test('combined document generation preserves evidence and makes every expected issue selectable',()=> {
  let seed=829; const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  let sawMissing=false,sawJoint=false,sawCash=false,sawFrontMark=false;
  for(let i=0;i<1200;i++) {
    const challenge=createFraudInspectionCase('Hard',{useHoldTypes:true,enabledCategories:['maker-signature-suspicious','payee-mismatch']},random);
    const c=challenge.holdScenario;
    for(const issue of challenge.expectedIssues) assert.ok(challenge.availableIssueOptions.some(option=>option.id===issue.id));
    if(c.endorsement==='missing') {sawMissing=true;assert.equal(challenge.check.endorsementSignature,'');}
    if(c.governmentJoin) {sawJoint=true;assert.ok(challenge.check.payeeName.includes(` ${c.governmentJoin} `));}
    if(c.frontSignatureMark) {sawFrontMark=true;assert.equal(challenge.check.makerSignature,'X');}
    if(['cash','ach','wire'].includes(c.itemType)) {sawCash=true;assert.deepEqual(challenge.expectedIssues,[]);assert.equal(decideCheck(c).holdType,'none');}
  }
  assert.ok(sawMissing&&sawJoint&&sawCash&&sawFrontMark);
  assert.equal(createFraudInspectionCase('Easy',{useHoldTypes:false},random).holdScenario,undefined);
});
