import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountStorage, SYNC_KEYS, documentId } from '../account-data.mjs';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const history=SYNC_KEYS[0];
const record={sessionId:'original',questionNumber:1,timestamp:'2026-01-01',game:'fraud-inspection',outcome:'Correct',holdAnswer:{notice:'given'}};
test('first login isolates accounts and preserves guest data until an explicit duplicate-safe import',()=>{
  const device=storage();device.setItem(history,JSON.stringify([record,{...record,sessionId:'sample',isSample:true}]));
  const cache=new AccountStorage(device);cache.activate('A');assert.deepEqual(JSON.parse(cache.getItem(history)),[]);
  cache.migrateGuest();cache.migrateGuest();assert.deepEqual(JSON.parse(cache.getItem(history)),[record]);assert.equal(cache.pending().length,1);
  cache.activate('B');assert.deepEqual(JSON.parse(cache.getItem(history)),[]);
  cache.activate(null);assert.equal(JSON.parse(cache.getItem(history)).length,2);
  cache.activate('A');assert.deepEqual(JSON.parse(cache.getItem(history)),[record]);
});
test('new remote attempts merge with offline attempts and older checkpoints cannot replace completion',()=>{
  const cache=new AccountStorage(storage());cache.activate('A');cache.setItem(history,JSON.stringify([record]));
  const id=documentId(history,'original:1'),existing=cache.entries[id];
  cache.merge(id,{...existing,modifiedAt:existing.modifiedAt+1,value:{...record,outcome:'Not answered'}});
  assert.equal(JSON.parse(cache.getItem(history))[0].outcome,'Correct');
  cache.merge(documentId(history,'other:1'),{...existing,modifiedAt:1,value:{...record,sessionId:'other'},pending:false});
  assert.equal(JSON.parse(cache.getItem(history)).length,2);
  cache.merge(id,{...existing,modifiedAt:1,value:{...record,holdAnswer:{notice:'not-required'}}});
  assert.deepEqual(JSON.parse(cache.getItem(history)).find(r=>r.sessionId==='original').holdAnswer,record.holdAnswer);
});
test('acknowledging an old upload does not lose a newer local update; clearing history uses tombstones',()=>{
  const cache=new AccountStorage(storage());cache.activate('A');cache.setItem(history,JSON.stringify([record]));
  const [id,old]=cache.pending()[0];cache.setItem(history,JSON.stringify([{...record,userAnswer:'changed'}]));cache.acknowledge(id,old);
  assert.equal(cache.pending().length,1);cache.removeItem(history);assert.deepEqual(JSON.parse(cache.getItem(history)),[]);assert.equal(cache.entries[id].deleted,true);
});
test('multiple tabs preserve each other\'s independently added attempts',()=>{
  const device=storage(),a=new AccountStorage(device),b=new AccountStorage(device);a.activate('A');b.activate('A');
  a.setItem(history,JSON.stringify([record]));b.setItem(history,JSON.stringify([{...record,sessionId:'second'}]));
  a.activate('A');assert.equal(JSON.parse(a.getItem(history)).length,2);
});
test('completed cloud attempt wins over a newer in-progress checkpoint',()=>{
  const cache=new AccountStorage(storage());cache.activate('A');
  cache.setItem(history,JSON.stringify([{...record,outcome:'Not answered'}]));
  const [id,entry]=cache.pending()[0];
  cache.merge(id,{...entry,modifiedAt:entry.modifiedAt-100,value:record,pending:false});
  assert.equal(JSON.parse(cache.getItem(history))[0].outcome,'Correct');assert.equal(cache.pending().length,0);
});
