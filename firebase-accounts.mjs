import { AccountStorage, shouldReplace, SYNC_KEYS } from './account-data.mjs?v=20261020-fast';
import { firebaseConfig } from './firebase-config.mjs';
import { isApprovedUid } from './account-access.mjs';

const remoteIds=new Set();
let markConnected;const connected=new Promise(resolve=>{markConnected=resolve;});
let sdk,auth,db,initialized=false,connecting=false,reconnectTimer,saving=false,retryTimer,slowTimer,loaded=false,unsubscribers=[];
const $=id=>document.getElementById('account-'+id);
const changedKeys=new Set();let changeTimer;
const changed=key=>{changedKeys.add(key);clearTimeout(changeTimer);changeTimer=setTimeout(()=>{const keys=[...changedKeys];changedKeys.clear();for(const key of keys)window.dispatchEvent(new StorageEvent('storage',{key}));},80);};
// Storage may be blocked (private mode) or full; the app then keeps working from memory.
const deviceStorage=(()=>{try{return window.localStorage;}catch{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}})();
export const accountStorage=new AccountStorage(deviceStorage,{onWrite:()=>scheduleSave(),onChange:changed,onStorageError:storageFull});
function storageFull(){
  const text=accountStorage.uid?'This device’s browser storage is full. New progress is kept for this visit and synced to your account when the cloud connects.':'This device’s browser storage is full. New progress is kept for this visit only; sign in to keep it in your account.';
  queueMicrotask(()=>{const node=$('error');if(node)node.textContent=text;});
}
function status(text){const node=$('status');if(node)node.textContent=text;}
function humanError(error){
  const messages={
    'auth/invalid-credential':'Email or password is incorrect.', 'auth/invalid-email':'Enter a valid email address.',
    'auth/account-not-approved':'This account does not have permission to sign in. Use the account approved by the site owner.',
    'auth/admin-restricted-operation':'Public sign-up is closed. Accounts must be provided by the site owner.',
    'auth/user-disabled':'This account does not have permission to sign in. Contact the site owner.',
    'auth/email-already-in-use':'An account already uses that email. Sign in instead.',
    'auth/weak-password':'Choose a stronger password with at least six characters.',
    'auth/too-many-requests':'Too many attempts. Wait a little before trying again.',
    'auth/network-request-failed':'Unable to connect. Check your internet connection and retry.',
    'auth/operation-not-allowed':'This sign-in provider is disabled in the Firebase project.',
    'auth/unauthorized-domain':'This website origin is not authorized for Firebase sign-in.',
    'auth/popup-closed-by-user':'Sign-in window closed. Try again when ready.',
    'auth/popup-blocked':'Allow the sign-in popup in your browser and try again.',
    'permission-denied':'Cloud access was denied. Check this project’s account security rules.',
    unavailable:'Cloud is temporarily unavailable. Your changes remain saved on this device.',
  };
  return messages[error.code]??`Unable to complete this request (${error.code??'connection error'}). Your device data is preserved.`;
}
function decode(data){return {key:data.key,value:JSON.parse(data.payload),deleted:data.deleted,modifiedAt:data.modifiedAt,deviceId:data.deviceId};}
function encode(entry){return {schema:1,key:entry.key,payload:JSON.stringify(entry.value),deleted:entry.deleted,modifiedAt:entry.modifiedAt,deviceId:entry.deviceId};}
function collectionName(key){return [SYNC_KEYS[0],'cash-handling-chess-games-v1','cash-handling-chess-lessons-v1'].includes(key)?'gameHistory':'settings';}
function scheduleSave(){clearTimeout(retryTimer);retryTimer=setTimeout(()=>void flush(),300);if(accountStorage.uid)status(navigator.onLine?'Syncing':'Offline · saved on this device');}
const withTimeout=(promise,ms)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject({code:'unavailable'}),ms))]);
async function syncEntry(uid,id,entry){
  const ref=sdk.doc(db,'users',uid,collectionName(entry.key),id);
  const result=await withTimeout(sdk.runTransaction(db,async transaction=>{
    const existing=await transaction.get(ref);
    const remote=existing.exists()?decode(existing.data()):null;
    if(remote&&!shouldReplace(remote,entry))return remote;
    transaction.set(ref,encode(entry));return null;
  }),12000);
  if(auth.currentUser?.uid!==uid)return;
  if(result)accountStorage.merge(id,result);
  else accountStorage.acknowledge(id,entry);
}
// Records the cloud has never seen cannot conflict, so they upload in large batches; edits to known records still use a transaction.
async function uploadNew(uid,items){
  for(let i=0;i<items.length;i+=400){
    if(auth.currentUser?.uid!==uid)return;
    const chunk=items.slice(i,i+400),batch=sdk.writeBatch(db);
    for(const [id,entry] of chunk)batch.set(sdk.doc(db,'users',uid,collectionName(entry.key),id),encode(entry));
    await withTimeout(batch.commit(),20000);
    if(auth.currentUser?.uid!==uid)return;
    for(const [id,entry] of chunk){remoteIds.add(id);accountStorage.acknowledge(id,entry);}
  }
}
async function flush(){
  if(saving||!db||!accountStorage.uid)return;
  if(!navigator.onLine){status('Offline · saved on this device');return;}
  saving=true;const uid=accountStorage.uid;let failed=false;
  try{
    accountStorage.refresh();
    const all=accountStorage.pending();
    // Wait for the first full cloud read so the app knows which records already exist there.
    if(!loaded&&all.length){status(navigator.onLine?'Syncing in the background…':'Offline · saved on this device');return;}
    const fresh=all.filter(([id])=>!remoteIds.has(id)),queue=all.filter(([id])=>remoteIds.has(id));
    if(all.length)status('Syncing');
    await uploadNew(uid,fresh);
    for(let i=0;i<queue.length;i+=8){
      if(auth.currentUser?.uid!==uid)break;
      await Promise.all(queue.slice(i,i+8).map(([id,entry])=>syncEntry(uid,id,entry)));
    }
    $('error').textContent='';
    status(accountStorage.pending().length?'Syncing':loaded?'Saved':'Loading account…');
  }catch(error){failed=true;status(navigator.onLine?'Sync problem · saved on this device, retrying':'Offline · saved on this device');$('error').textContent=humanError(error);}
  finally{saving=false;if(loaded&&accountStorage.uid===uid&&accountStorage.pending().length){clearTimeout(retryTimer);retryTimer=setTimeout(()=>void flush(),failed?15000:300);}}
}
function subscribe(uid){
  let ready=new Set();loaded=false;
  clearTimeout(slowTimer);slowTimer=setTimeout(()=>{if(!loaded&&accountStorage.uid===uid&&navigator.onLine)status('Sync problem · saved on this device, still trying');},8000);
  for(const kind of ['gameHistory','settings']){
    unsubscribers.push(sdk.onSnapshot(sdk.collection(db,'users',uid,kind),{includeMetadataChanges:true},snapshot=>{
      if(auth.currentUser?.uid!==uid)return;
      try{for(const change of snapshot.docChanges())if(change.type!=='removed'&&!change.doc.metadata.hasPendingWrites){remoteIds.add(change.doc.id);accountStorage.merge(change.doc.id,decode(change.doc.data()));}}
      catch{status('Sync error · unreadable cloud record');return;}
      if(!snapshot.metadata.fromCache){ready.add(kind);loaded=ready.size===2;}
      $('import').disabled=!loaded;
      if(loaded){clearTimeout(slowTimer);$('error').textContent='';void flush();}
      else status(navigator.onLine?'Loading account…':'Offline · saved on this device');
    },error=>{status('Sync problem · saved on this device');$('error').textContent=humanError(error);}));
  }
}
async function action(operation){
  $('error').textContent='';$('form').inert=true;$('form').setAttribute('aria-busy','true');$('submit').textContent='Signing in…';status('Signing in…');
  try{await operation();}catch(error){$('error').textContent=humanError(error);status('Sign-in failed');}
  finally{$('form').inert=false;$('form').removeAttribute('aria-busy');$('submit').textContent='Sign in';$('password').value='';}
}
export async function initializeAccounts(){
  $('form').addEventListener('submit',event=>{event.preventDefault();void action(async()=>{
    // Tapping Sign in early starts the connection now and waits for it instead of ignoring the tap.
    if(!initialized){status('Connecting…');void connectAccounts();await Promise.race([connected,new Promise((_,reject)=>setTimeout(()=>reject({code:'unavailable'}),20000))]);}
    await sdk.setPersistence(auth,$('remember').checked?sdk.browserLocalPersistence:sdk.browserSessionPersistence);
    const credential=await sdk.signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);
    if(!isApprovedUid(credential.user.uid)){await sdk.signOut(auth);throw {code:'auth/account-not-approved'};}
  });});
  $('show-password').addEventListener('click',()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('show-password').textContent=show?'Hide':'Show';$('show-password').setAttribute('aria-pressed',String(show));$('show-password').setAttribute('aria-label',show?'Hide password':'Show password');});
  $('signout').addEventListener('click',()=>void action(()=>sdk.signOut(auth)));
  $('import').addEventListener('click',()=>{try{accountStorage.migrateGuest();$('import').hidden=true;status('Syncing imported device history…');}catch(error){$('error').textContent=error.message;}});
  $('retry').addEventListener('click',()=>{$('error').textContent='';if(initialized)void flush();else if(!connecting)void connectAccounts();});
  window.addEventListener('online',()=>{if(db)void flush();});
  window.addEventListener('offline',()=>{if(accountStorage.uid)status('Offline · saved on this device');});
  window.addEventListener('storage',event=>{if(event.key?.startsWith('cash-trainer-account-cache-v1:')&&event.key.endsWith(':'+accountStorage.uid)){accountStorage.refresh();for(const key of SYNC_KEYS)changed(key);scheduleSave();}});
  // The app starts from the account remembered on this device; the network check below runs in the background so a
  // slow Firebase connection never delays the first screen. A different real account triggers one reload.
  accountStorage.activate(rememberedUid());
  $('form').inert=false;
  status(accountStorage.uid?'Saved on this device · connecting…':'Saved on this device');
  // Start Firebase after the first screen is drawn and idle, so its download and setup never block taps.
  const start=()=>void connectAccounts();
  const later=()=>('requestIdleCallback' in window?requestIdleCallback(start,{timeout:1500}):setTimeout(start,200));
  if(document.readyState==='complete')later();else window.addEventListener('load',later,{once:true});
}
const LAST_UID_KEY='cash-trainer-last-uid-v1';
function rememberedUid(){
  try{const uid=window.localStorage.getItem(LAST_UID_KEY);return uid&&isApprovedUid(uid)?uid:null;}catch{return null;}
}
function rememberUid(uid){
  try{if(uid)window.localStorage.setItem(LAST_UID_KEY,uid);else window.localStorage.removeItem(LAST_UID_KEY);}catch{}
}
// Sign in, sign out and account switches happen in place: no page reload, the app keeps working.
function applyUser(user){
  const uid=user?.uid??null;
  unsubscribers.forEach(stop=>stop());unsubscribers=[];clearTimeout(retryTimer);clearTimeout(slowTimer);
  rememberUid(uid);loaded=false;remoteIds.clear();
  if(uid!==accountStorage.uid){accountStorage.activate(uid);for(const key of SYNC_KEYS)changed(key);window.dispatchEvent(new CustomEvent('account-change',{detail:{uid}}));}
  $('form').hidden=Boolean(user);$('signout').hidden=!user;$('user').textContent=user?.email??'Guest · saved on this device';
  $('form').inert=false;$('error').textContent='';
  if(user){status('Syncing in the background…');$('import').hidden=!accountStorage.guestDataAvailable();$('import').disabled=true;subscribe(uid);void flush();}
  else{$('import').hidden=true;status('Sign in to sync across devices');}
}
async function connectAccounts(){
  if(initialized||connecting)return;
  connecting=true;
  try{
    const imports=Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'),
    ]);
    const modules=await Promise.race([imports,new Promise((_,reject)=>setTimeout(()=>reject({code:'unavailable'}),10000))]);
    sdk=Object.assign({},...modules);const app=sdk.getApps().length?sdk.getApp():sdk.initializeApp(firebaseConfig);auth=sdk.getAuth(app);
    try{db=sdk.initializeFirestore(app,{localCache:sdk.persistentLocalCache({tabManager:sdk.persistentMultipleTabManager()})});}
    catch{db=sdk.getFirestore(app);}
    await Promise.race([auth.authStateReady(),new Promise((_,reject)=>setTimeout(()=>reject({code:'unavailable'}),10000))]);
    if(auth.currentUser&&!isApprovedUid(auth.currentUser.uid))await sdk.signOut(auth);
    applyUser(auth.currentUser);
    sdk.onAuthStateChanged(auth,user=>{
      if(user&&!isApprovedUid(user.uid)){void sdk.signOut(auth);return;}
      if(initialized&&(user?.uid??null)!==accountStorage.uid)applyUser(user);
    });
    initialized=true;markConnected();
  }catch(error){status('Sync problem · you can keep playing, saved on this device');$('error').textContent=humanError(error);clearTimeout(reconnectTimer);reconnectTimer=setTimeout(()=>void connectAccounts(),20000);}
  finally{connecting=false;}
}
