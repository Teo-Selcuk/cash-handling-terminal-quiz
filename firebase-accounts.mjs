import { AccountStorage, shouldReplace, SYNC_KEYS } from './account-data.mjs';
import { firebaseConfig } from './firebase-config.mjs';
import { isApprovedUid } from './account-access.mjs';

let sdk,auth,db,initialized=false,saving=false,retryTimer,loaded=false,unsubscribers=[];
const $=id=>document.getElementById('account-'+id);
const changedKeys=new Set();let changeTimer;
const changed=key=>{changedKeys.add(key);clearTimeout(changeTimer);changeTimer=setTimeout(()=>{const keys=[...changedKeys];changedKeys.clear();for(const key of keys)window.dispatchEvent(new StorageEvent('storage',{key}));},80);};
export const accountStorage=new AccountStorage(window.localStorage,{onWrite:()=>scheduleSave(),onChange:changed});
function status(text){$('status').textContent=text;}
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
async function flush(){
  if(saving||!db||!accountStorage.uid)return;
  if(!navigator.onLine){status('Offline · saved on this device');return;}
  saving=true;const uid=accountStorage.uid;let failed=false;
  try{
    accountStorage.refresh();
    for(const [id,entry] of accountStorage.pending()){
      if(auth.currentUser?.uid!==uid)break;
      status('Syncing');
      const ref=sdk.doc(db,'users',uid,collectionName(entry.key),id);
      const result=await sdk.runTransaction(db,async transaction=>{
        const existing=await transaction.get(ref);
        const remote=existing.exists()?decode(existing.data()):null;
        if(remote&&!shouldReplace(remote,entry))return remote;
        transaction.set(ref,encode(entry));return null;
      });
      if(auth.currentUser?.uid!==uid)break;
      if(result)accountStorage.merge(id,result);
      else accountStorage.acknowledge(id,entry);
    }
    status(accountStorage.pending().length?'Syncing':loaded?'Saved':'Loading account…');
  }catch(error){failed=true;status(navigator.onLine?'Sync error · saved on this device':'Offline · saved on this device');$('error').textContent=humanError(error);}
  finally{saving=false;if(accountStorage.pending().length){clearTimeout(retryTimer);retryTimer=setTimeout(()=>void flush(),failed?15000:300);}}
}
function subscribe(uid){
  let ready=new Set();
  for(const kind of ['gameHistory','settings']){
    unsubscribers.push(sdk.onSnapshot(sdk.collection(db,'users',uid,kind),{includeMetadataChanges:true},snapshot=>{
      if(auth.currentUser?.uid!==uid)return;
      try{for(const change of snapshot.docChanges())if(change.type!=='removed'&&!change.doc.metadata.hasPendingWrites)accountStorage.merge(change.doc.id,decode(change.doc.data()));}
      catch{status('Sync error · unreadable cloud record');return;}
      if(!snapshot.metadata.fromCache){ready.add(kind);loaded=ready.size===2;}
      $('import').disabled=!loaded;
      if(loaded){$('error').textContent='';void flush();}
      else status(navigator.onLine?'Loading account…':'Offline · saved on this device');
    },error=>{status('Sync error');$('error').textContent=humanError(error);}));
  }
}
async function action(operation){
  $('error').textContent='';$('form').inert=true;$('form').setAttribute('aria-busy','true');$('submit').textContent='Signing in…';status('Signing in…');
  try{await operation();}catch(error){$('error').textContent=humanError(error);status('Sign-in failed');}
  finally{$('form').inert=false;$('form').removeAttribute('aria-busy');$('submit').textContent='Sign in';$('password').value='';}
}
export async function initializeAccounts(){
  $('form').addEventListener('submit',event=>{event.preventDefault();if(!auth)return;void action(async()=>{
    await sdk.setPersistence(auth,$('remember').checked?sdk.browserLocalPersistence:sdk.browserSessionPersistence);
    const credential=await sdk.signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);
    if(!isApprovedUid(credential.user.uid)){await sdk.signOut(auth);throw {code:'auth/account-not-approved'};}
  });});
  $('show-password').addEventListener('click',()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('show-password').textContent=show?'Hide':'Show';$('show-password').setAttribute('aria-pressed',String(show));$('show-password').setAttribute('aria-label',show?'Hide password':'Show password');});
  $('signout').addEventListener('click',()=>void action(()=>sdk.signOut(auth)));
  $('import').addEventListener('click',()=>{try{accountStorage.migrateGuest();$('import').hidden=true;status('Syncing imported device history…');}catch(error){$('error').textContent=error.message;}});
  $('retry').addEventListener('click',()=>{if(db){$('error').textContent='';void flush();}else location.reload();});
  window.addEventListener('online',()=>{if(db)void flush();});
  window.addEventListener('offline',()=>{if(accountStorage.uid)status('Offline · saved on this device');});
  window.addEventListener('storage',event=>{if(event.key?.startsWith('cash-trainer-account-cache-v1:')&&event.key.endsWith(':'+accountStorage.uid)){accountStorage.refresh();for(const key of SYNC_KEYS)changed(key);scheduleSave();}});
  try{
    const imports=Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'),
    ]);
    const modules=await Promise.race([imports,new Promise((_,reject)=>setTimeout(()=>reject(new Error('SDK unavailable')),10000))]);
    sdk=Object.assign({},...modules);const app=sdk.initializeApp(firebaseConfig);auth=sdk.getAuth(app);
    db=sdk.initializeFirestore(app,{localCache:sdk.persistentLocalCache({tabManager:sdk.persistentMultipleTabManager()})});
    await auth.authStateReady();
    if(auth.currentUser&&!isApprovedUid(auth.currentUser.uid))await sdk.signOut(auth);
    accountStorage.activate(auth.currentUser?.uid??null);
    $('form').hidden=Boolean(auth.currentUser);$('signout').hidden=!auth.currentUser;
    $('user').textContent=auth.currentUser?.email??'Guest · saved on this device';
    $('form').inert=false;
    if(auth.currentUser){status('Loading account…');$('import').hidden=!accountStorage.guestDataAvailable();$('import').disabled=true;subscribe(auth.currentUser.uid);void flush();}
    else status('Sign in to sync across devices');
    sdk.onAuthStateChanged(auth,user=>{
      if(user&&!isApprovedUid(user.uid)){void sdk.signOut(auth);return;}
      if(initialized&&(user?.uid??null)!==accountStorage.uid){unsubscribers.forEach(stop=>stop());clearTimeout(retryTimer);location.reload();}
    });
    initialized=true;
  }catch(error){status('Accounts unavailable · device saves active');$('error').textContent=humanError(error);$('form').inert=true;}
}
