// Synchronous account caches keep gameplay independent of network latency.
export const SYNC_KEYS = [
  'cash-handling-terminal-quiz-history-v1', 'cash-handling-terminal-quiz-presets-v1',
  'cash-handling-terminal-quiz-theme-v1', 'cash-handling-terminal-quiz-current-challenge-v1',
  'cash-handling-terminal-quiz-chart-appearance-v1', 'cash-handling-terminal-quiz-typing-presets-v1',
  'cash-handling-chess-games-v1', 'cash-handling-chess-lessons-v1',
  'cash-handling-chess-current-v1', 'cash-handling-chess-settings-v1',
  'cash-handling-multitasker-settings-v1', 'cash-handling-terminal-quiz-goal-settings-v1',
];
const lists = new Set([SYNC_KEYS[0], 'cash-handling-chess-games-v1', 'cash-handling-chess-lessons-v1']);
const cacheKey = uid => `cash-trainer-account-cache-v1:${uid}`;
// A small revision marker lets each read skip re-parsing the whole cache unless another tab wrote it.
const revKey = uid => `cash-trainer-account-rev-v1:${uid}`;
function hash(text) {
  let a=2166136261,b=5381;
  for(const char of text){a=Math.imul(a^char.charCodeAt(0),16777619);b=Math.imul(b,33)^char.charCodeAt(0);}
  return `${(a>>>0).toString(16)}${(b>>>0).toString(16)}`;
}
export function recordId(record) {
  return String(record.id ?? (record.sessionId != null && record.questionNumber != null
    ? `${record.sessionId}:${record.questionNumber}`
    : `legacy:${hash(JSON.stringify([record.timestamp,record.game,record.sessionId,record.questionNumber,record.startedAt,record]))}`));
}
function unpack(key,text) {
  if(text===null)return [];
  const parsed=JSON.parse(text),records=key===SYNC_KEYS[0]?parsed:parsed.value;
  if(!Array.isArray(records))throw new Error('History format is unreadable. Original data has been preserved.');
  return records.filter(record=>record && record.isSample!==true);
}
export function documentId(key,id='setting') {return `${encodeURIComponent(key)}~${encodeURIComponent(id)}`;}
export function shouldReplace(local,remote) {
  if(!local)return true;
  const rank=entry=>entry?.value?.outcome==='Not answered'?0:1;
  if(!local.deleted&&!remote.deleted&&rank(remote)!==rank(local))return rank(remote)>rank(local);
  return remote.modifiedAt>local.modifiedAt || (remote.modifiedAt===local.modifiedAt && remote.deviceId>=local.deviceId);
}
export class AccountStorage {
  constructor(storage,{onWrite=()=>{},onChange=()=>{},onStorageError=()=>{}}={}) {
    this.storage=storage;this.onWrite=onWrite;this.onChange=onChange;this.onStorageError=onStorageError;this.uid=null;this.entries={};
    this.rev=null;this.version=0;this.reads=new Map();this.overlay=new Map();this.persistTimer=null;this.storageFull=false;
    this.deviceId=this.safeGet('cash-trainer-device-id')??globalThis.crypto.randomUUID();
    this.safeSet('cash-trainer-device-id',this.deviceId);
  }
  safeGet(key){try{return this.overlay.has(key)?this.overlay.get(key):this.storage.getItem(key);}catch{return null;}}
  // A full or blocked browser storage never stops play: the value stays in memory (and in the cloud when signed in).
  safeSet(key,text){
    try{this.storage.setItem(key,text);this.overlay.delete(key);return true;}
    catch(error){this.overlay.set(key,text);if(!this.storageFull){this.storageFull=true;this.onStorageError(error);}return false;}
  }
  safeRemove(key){this.overlay.delete(key);try{this.storage.removeItem(key);}catch{}}
  readSaved(){try{return JSON.parse(this.safeGet(cacheKey(this.uid))??'{}')??{};}catch{return {};}}
  activate(uid) {
    clearTimeout(this.persistTimer);this.persistTimer=null;
    this.uid=uid;this.rev=uid?this.safeGet(revKey(uid)):null;this.entries=uid?this.readSaved():{};this.version++;this.reads.clear();
  }
  persist(){
    clearTimeout(this.persistTimer);this.persistTimer=null;
    if(!this.uid)return;
    const rev=`${this.deviceId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    if(this.safeSet(cacheKey(this.uid),JSON.stringify(this.entries))){this.rev=rev;this.safeSet(revKey(this.uid),rev);}
  }
  // Cloud merges and upload acknowledgements arrive in bursts; one write covers the whole burst.
  persistSoon(){if(this.uid&&!this.persistTimer)this.persistTimer=setTimeout(()=>this.persist(),250);}
  refresh(){
    if(!this.uid)return;
    const rev=this.safeGet(revKey(this.uid));
    if(rev===this.rev)return;
    this.rev=rev;let changed=false;
    for(const [id,entry] of Object.entries(this.readSaved()))if(shouldReplace(this.entries[id],entry)){this.entries[id]=entry;changed=true;}
    if(changed){this.version++;this.reads.clear();}
  }
  getItem(key) {
    if(!this.uid||!SYNC_KEYS.includes(key))return this.safeGet(key);
    this.refresh();
    const cached=this.reads.get(key);
    if(cached&&cached[0]===this.version)return cached[1];
    const entries=Object.values(this.entries).filter(e=>e.key===key&&!e.deleted);
    let text;
    if(lists.has(key)) {
      const records=entries.map(e=>e.value).sort((a,b)=>String(a.timestamp??a.startedAt??'').localeCompare(String(b.timestamp??b.startedAt??'')));
      text=JSON.stringify(key===SYNC_KEYS[0]?records:{version:1,value:records});
    }else text=entries[0]?.value??null;
    this.reads.set(key,[this.version,text]);
    return text;
  }
  setItem(key,text) {
    if(!this.uid||!SYNC_KEYS.includes(key)){this.safeSet(key,text);return;}
    const knownIds=new Set(Object.keys(this.entries));this.refresh();
    const values=lists.has(key)?unpack(key,text).map(record=>[recordId(record),record]):[['setting',text]];
    const ids=new Set();
    for(const [id,value] of values){const docId=documentId(key,id);ids.add(docId);this.edit(docId,key,value,false);}
    if(lists.has(key))for(const [id,entry] of Object.entries(this.entries))if(knownIds.has(id)&&entry.key===key&&!ids.has(id)&&!entry.deleted)this.edit(id,key,null,true);
    this.persist();this.onWrite();
  }
  edit(id,key,value,deleted) {
    const prior=this.entries[id];
    if(prior?.deleted===deleted&&JSON.stringify(prior.value)===JSON.stringify(value))return;
    // In-progress checkpoints cannot undo a completed attempt from another device.
    if(prior?.value && prior.value.outcome!=='Not answered'&&value?.outcome==='Not answered')return;
    this.entries[id]={key,value,deleted,modifiedAt:Math.max(Date.now(),(prior?.modifiedAt??0)+1),deviceId:this.deviceId,pending:true};
    this.version++;this.reads.clear();
  }
  removeItem(key) {
    if(!this.uid||!SYNC_KEYS.includes(key)){this.safeRemove(key);return;}
    if(lists.has(key))this.setItem(key,JSON.stringify(key===SYNC_KEYS[0]?[]:{version:1,value:[]}));
    else{this.edit(documentId(key),key,null,true);this.persist();this.onWrite();}
  }
  merge(id,remote) {
    this.refresh();
    const prior=this.entries[id];
    if(!SYNC_KEYS.includes(remote.key)||remote.value?.isSample)return;
    if(prior&&prior.modifiedAt===remote.modifiedAt&&prior.deviceId===remote.deviceId&&prior.deleted===remote.deleted){
      if(prior.pending){prior.pending=false;this.persistSoon();}
      return;
    }
    if(!shouldReplace(prior,remote))return;
    this.entries[id]={...remote,pending:false};this.version++;this.reads.clear();
    this.persistSoon();this.onChange(remote.key);
  }
  acknowledge(id,entry) {
    this.refresh();
    if(this.entries[id]?.modifiedAt===entry.modifiedAt && this.entries[id]?.deviceId===entry.deviceId){this.entries[id].pending=false;this.persistSoon();}
  }
  pending(){return Object.entries(this.entries).filter(([,entry])=>entry.pending);}
  guestFingerprint(){return hash(JSON.stringify(SYNC_KEYS.map(key=>[key,this.safeGet(key)])));}
  guestDataAvailable(){try{return this.safeGet(`cash-trainer-import-v1:${this.uid}`)!==this.guestFingerprint()&&SYNC_KEYS.some(key=>{const text=this.safeGet(key);return text!==null&&(!lists.has(key)||unpack(key,text).length>0);});}catch{return false;}}
  migrateGuest() {
    if(!this.uid)throw new Error('Sign in before importing device data.');
    this.refresh();
    for(const key of SYNC_KEYS){const text=this.safeGet(key);if(text===null)continue;
      if(lists.has(key)){
        for(const record of unpack(key,text)){const id=documentId(key,recordId(record));if(!this.entries[id])this.edit(id,key,record,false);}
      }else if(!this.entries[documentId(key)])this.edit(documentId(key),key,text,false);
    }
    this.persist();this.onWrite();
    this.safeSet(`cash-trainer-import-v1:${this.uid}`,this.guestFingerprint());
  }
}
