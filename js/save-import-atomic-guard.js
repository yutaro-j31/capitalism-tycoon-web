// Atomic guard for JSON save imports on the public iPhone runtime.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
const engineModule=modules?.engine;
const storage=modules?.saveStorage;
if(!engineModule?.TycoonEngine||!storage?.__installed)throw new Error('engine.js and save-storage.js must load before save-import-atomic-guard.js.');
if(modules.saveImportAtomicGuard)return;
const proto=engineModule.TycoonEngine.prototype;
const originalImport=proto.importSave;
if(typeof originalImport!=='function')throw new Error('TycoonEngine.importSave is unavailable.');
const SAVE_KEY=storage.SAVE_KEY||engineModule.SAVE_KEY||'capitalism_tycoon_web_v1';
function verifyPersistedSave(raw){if(typeof raw!=='string'||!raw)return false;try{return engineModule.migrateSave?.(JSON.parse(raw))?.ok===true;}catch(error){return false;}}
proto.importSave=function atomicImportSave(text){
  const previousState=this.g;
  const previousBlocked=this._saveBlockedDueToLoadFailure;
  const previousReason=this._loadFailureReason;
  let previousRaw=null;
  try{previousRaw=globalThis.localStorage?.getItem?.(SAVE_KEY)??null;}catch(error){}
  try{
    const result=originalImport.call(this,text);
    if(this._lastSaveStorageInfo?.ok===false)throw new Error('復元後のセーブを保存できませんでした。以前のセーブを維持しました。');
    let persistedRaw=null;
    try{persistedRaw=globalThis.localStorage?.getItem?.(SAVE_KEY)??null;}catch(error){throw new Error('復元後のセーブを確認できませんでした。以前のセーブを維持しました。');}
    if(!verifyPersistedSave(persistedRaw))throw new Error('復元後のセーブ検証に失敗しました。以前のセーブを維持しました。');
    return result;
  }catch(error){
    this.g=previousState;
    this._saveBlockedDueToLoadFailure=previousBlocked;
    this._loadFailureReason=previousReason;
    if(previousRaw!==null){
      try{globalThis.localStorage?.setItem?.(SAVE_KEY,previousRaw);}catch(restoreError){console.error('Persistent save rollback failed',restoreError);}
    }
    try{this.emit?.();}catch(ignore){}
    throw error;
  }
};
modules.saveImportAtomicGuard=Object.freeze({SAVE_KEY,verifyPersistedSave,__installed:true});
})();
