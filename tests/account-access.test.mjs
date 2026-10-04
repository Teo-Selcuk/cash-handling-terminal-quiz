import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_UID, isApprovedUid, canPlayGame } from '../account-access.mjs';
test('only the administrator-approved identity unlocks Fraud Inspection',()=>{
  for(const uid of [null,undefined,'',APPROVED_UID+'-other','masterselcuk619@gmail.com']){
    assert.equal(isApprovedUid(uid),false);
    assert.equal(canPlayGame('fraud-inspection',uid),false);
  }
  assert.equal(canPlayGame('fraud-inspection',APPROVED_UID),true);
});
test('all other games remain playable without an account',()=>{
  for(const game of ['cash','memory','task','error-detection','typing','overload','chess'])assert.equal(canPlayGame(game,null),true);
});
