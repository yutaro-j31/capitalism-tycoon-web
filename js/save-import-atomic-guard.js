// Atomic guard for JSON save imports on the public iPhone runtime.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
const engineModule=modules?.engine;
const storage=modules?.saveStorage;
const durableStorage=modules?.saveStorageIDB;
if(!engineModule?.TycoonEngine||!storage?.__installed)throw new Error('engine.js and save-storage.js must load before save-import-atomic-guard.js.');
if(modules.saveImportAtomicGuard)return;
const proto=engineModule.TycoonEngine.prototype;
const originalImport=proto.importSave;
if(typeof originalImport!=='function')throw new Error('TycoonEngine.importSave is unavailable.');
const SAVE_KEY=storage.SAVE_KEY||engineModule.SAVE_KEY||'capitalism_tycoon_web_v1';
function criticalSaveFingerprint(state){
  if(!state||typeof state!=='object')return null;
  return JSON.stringify({
    saveVersion:state.saveVersion,
    week:state.week,
    companyCash:state.companyCash,
    personalCash:state.personalCash,
    companyAssets:state.companyAssets,
    personalAssets:state.personalAssets,
    cumulativeAccounting:state.cumulativeAccounting
  });
}
function verifyPersistedSave(raw,currentState){
  if(typeof raw!=='string'||!raw)return false;
  try{
    const migrated=engineModule.migrateSave?.(JSON.parse(raw));
    return migrated?.ok===true&&criticalSaveFingerprint(migrated.state)===criticalSaveFingerprint(currentState);
  }catch(error){return false;}
}
function readAuthoritativeSave(){
  try{
    const raw=durableStorage?.readSync?.(SAVE_KEY);
    if(typeof raw==='string'&&raw)return raw;
  }catch(error){}
  try{return globalThis.localStorage?.getItem?.(SAVE_KEY)??null;}catch(error){return null;}
}
function restorePersistentSave(durableRaw,localRaw){
  try{
    if(durableStorage?.writeSync){
      if(durableRaw===null)durableStorage.removeSync?.(SAVE_KEY);
      else durableStorage.writeSync(SAVE_KEY,durableRaw);
    }
  }catch(error){console.error('IndexedDB save rollback failed',error);}
  try{
    if(localRaw===null)globalThis.localStorage?.removeItem?.(SAVE_KEY);
    else globalThis.localStorage?.setItem?.(SAVE_KEY,localRaw);
  }catch(error){console.error('localStorage save rollback failed',error);}
}
proto.importSave=function atomicImportSave(text){
  const previousState=this.g;
  const previousBlocked=this._saveBlockedDueToLoadFailure;
  const previousReason=this._loadFailureReason;
  const previousSaveInfo=this._lastSaveStorageInfo;
  const previousBypass=this._saveStorageRecoveryBypass;
  const previousDurableRaw=readAuthoritativeSave();
  let previousLocalRaw=null;
  try{previousLocalRaw=globalThis.localStorage?.getItem?.(SAVE_KEY)??null;}catch(error){}
  try{
    this._lastSaveStorageInfo=null;
    this._saveStorageRecoveryBypass=true;
    const result=originalImport.call(this,text);
    if(this._lastSaveStorageInfo?.ok!==true)throw new Error('復元後のセーブを保存できませんでした。以前のセーブを維持しました。');
    const persistedRaw=readAuthoritativeSave();
    if(!verifyPersistedSave(persistedRaw,this.g))throw new Error('復元後のセーブ検証に失敗しました。以前のセーブを維持しました。');
    this._saveStorageRecoveryBypass=previousBypass;
    return result;
  }catch(error){
    this.g=previousState;
    this._saveBlockedDueToLoadFailure=previousBlocked;
    this._loadFailureReason=previousReason;
    this._lastSaveStorageInfo=previousSaveInfo;
    this._saveStorageRecoveryBypass=previousBypass;
    restorePersistentSave(previousDurableRaw,previousLocalRaw);
    try{this.emit?.();}catch(ignore){}
    throw error;
  }
};
modules.saveImportAtomicGuard=Object.freeze({SAVE_KEY,criticalSaveFingerprint,verifyPersistedSave,readAuthoritativeSave,restorePersistentSave,__installed:true});
})();
