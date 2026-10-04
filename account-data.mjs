// Synchronous account caches keep gameplay independent of network latency.
export const SYNC_KEYS = [
  'cash-handling-terminal-quiz-history-v1', 'cash-handling-terminal-quiz-presets-v1',
  'cash-handling-terminal-quiz-theme-v1', 'cash-handling-terminal-quiz-current-challenge-v1',
  'cash-handling-terminal-quiz-chart-appearance-v1', 'cash-handling-terminal-quiz-typing-presets-v1',
  'cash-handling-chess-games-v1', 'cash-handling-chess-lessons-v1',
  'cash-handling-chess-current-v1', 'cash-handling-chess-settings-v1',
  'cash-handling-multitasker-settings-v1',
];
const lists = new Set([SYNC_KEYS[0], 'cash-handling-chess-games-v1', 'cash-handling-chess-lessons-v1']);
const cacheKey = uid => `cash-trainer-account-cache-v1:${uid}`;
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
  constructor(storage,{onWrite=()=>{},onChange=()=>{}}={}) {
    this.storage=storage;this.onWrite=onWrite;this.onChange=onChange;this.uid=null;this.entries={};
    this.deviceId=storage.getItem('cash-trainer-device-id')??globalThis.crypto.randomUUID();
    storage.setItem('cash-trainer-device-id',this.deviceId);
  }
  activate(uid) {
    this.uid=uid;this.entries=uid?JSON.parse(this.storage.getItem(cacheKey(uid))??'{}'):{};
  }
  persist(){if(this.uid)this.storage.setItem(cacheKey(this.uid),JSON.stringify(this.entries));}
  refresh(){if(this.uid){const saved=JSON.parse(this.storage.getItem(cacheKey(this.uid))??'{}');for(const [id,entry] of Object.entries(saved))if(shouldReplace(this.entries[id],entry))this.entries[id]=entry;}}
  getItem(key) {
    if(!this.uid||!SYNC_KEYS.includes(key))return this.storage.getItem(key);
    this.refresh();
    const entries=Object.values(this.entries).filter(e=>e.key===key&&!e.deleted);
    if(lists.has(key)) {
      const records=entries.map(e=>e.value).sort((a,b)=>String(a.timestamp??a.startedAt??'').localeCompare(String(b.timestamp??b.startedAt??'')));
      return JSON.stringify(key===SYNC_KEYS[0]?records:{version:1,value:records});
    }
    return entries[0]?.value??null;
  }
  setItem(key,text) {
    if(!this.uid||!SYNC_KEYS.includes(key)){this.storage.setItem(key,text);return;}
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
  }
  removeItem(key) {
    if(!this.uid||!SYNC_KEYS.includes(key)){this.storage.removeItem(key);return;}
    if(lists.has(key))this.setItem(key,JSON.stringify(key===SYNC_KEYS[0]?[]:{version:1,value:[]}));
    else{this.edit(documentId(key),key,null,true);this.persist();this.onWrite();}
  }
  merge(id,remote) {
    this.refresh();
    const prior=this.entries[id];
    if(!SYNC_KEYS.includes(remote.key)||remote.value?.isSample)return;
    if(shouldReplace(prior,remote))this.entries[id]={...remote,pending:false};
    else if(prior&&prior.modifiedAt===remote.modifiedAt&&prior.deviceId===remote.deviceId)prior.pending=false;
    this.persist();this.onChange(remote.key);
  }
  acknowledge(id,entry) {
    this.refresh();
    if(this.entries[id]?.modifiedAt===entry.modifiedAt && this.entries[id]?.deviceId===entry.deviceId){this.entries[id].pending=false;this.persist();}
  }
  pending(){return Object.entries(this.entries).filter(([,entry])=>entry.pending);}
  guestFingerprint(){return hash(JSON.stringify(SYNC_KEYS.map(key=>[key,this.storage.getItem(key)])));}
  guestDataAvailable(){return this.storage.getItem(`cash-trainer-import-v1:${this.uid}`)!==this.guestFingerprint()&&SYNC_KEYS.some(key=>{const text=this.storage.getItem(key);return text!==null&&(!lists.has(key)||unpack(key,text).length>0);});}
  migrateGuest() {
    if(!this.uid)throw new Error('Sign in before importing device data.');
    this.refresh();
    for(const key of SYNC_KEYS){const text=this.storage.getItem(key);if(text===null)continue;
      if(lists.has(key)){
        for(const record of unpack(key,text)){const id=documentId(key,recordId(record));if(!this.entries[id])this.edit(id,key,record,false);}
      }else if(!this.entries[documentId(key)])this.edit(documentId(key),key,text,false);
    }
    this.persist();this.onWrite();
    this.storage.setItem(`cash-trainer-import-v1:${this.uid}`,this.guestFingerprint());
  }
}
