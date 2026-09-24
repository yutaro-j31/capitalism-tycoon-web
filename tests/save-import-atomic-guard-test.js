'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('js/save-import-atomic-guard.js','utf8');
const SAVE_KEY='capitalism_tycoon_web_v1';
function makeContext({failureMode='none'}={}){
  const original={saveVersion:9,week:4,companyCash:900,personalCash:100,companyAssets:{cash:900},personalAssets:{cash:100},cumulativeAccounting:{revenue:1200}};
  const store=new Map([[SAVE_KEY,JSON.stringify(original)]]);
  const durable=new Map([[SAVE_KEY,JSON.stringify(original)]]);
  const saveStorageIDB={
    status:()=>({available:true,hydrated:true}),
    readSync:key=>durable.has(key)?durable.get(key):(store.has(key)?store.get(key):null),
    writeSync:(key,value)=>{durable.set(key,String(value));return true;},
    removeSync:key=>{durable.delete(key);return true;}
  };
  class TycoonEngine{
    constructor(){this.g=structuredClone(original);this._saveBlockedDueToLoadFailure=false;this._loadFailureReason='';this._lastSaveStorageInfo={ok:true,mode:'raw'};this.emits=0;}
    emit(){this.emits++;}
    importSave(text){
      const next=JSON.parse(text);
      this.g=next;
      if(failureMode==='no-write')return;
      if(failureMode==='idb-only'){
        durable.set(SAVE_KEY,JSON.stringify(next));
        this._lastSaveStorageInfo={ok:true,mode:'normal'};
        return true;
      }
      store.set(SAVE_KEY,JSON.stringify(next));
      durable.set(SAVE_KEY,JSON.stringify(next));
      if(failureMode==='save-false'){this._lastSaveStorageInfo={ok:false,mode:'failed'};return;}
      if(failureMode==='throw')throw new Error('synthetic import failure');
      if(failureMode==='wrong-write'){store.set(SAVE_KEY,JSON.stringify(original));durable.set(SAVE_KEY,JSON.stringify(original));}
      if(failureMode==='wrong-idb')durable.set(SAVE_KEY,JSON.stringify(original));
      this._lastSaveStorageInfo={ok:true,mode:'raw'};
      return true;
    }
  }
  const localStorage={
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(key,value)=>store.set(key,String(value)),
    removeItem:key=>store.delete(key)
  };
  const context={console,JSON,structuredClone,globalThis:null,localStorage,__capitalismTycoonModules:{engine:{TycoonEngine,SAVE_KEY,migrateSave:value=>({ok:value?.saveVersion===9,state:value})},saveStorage:{SAVE_KEY,__installed:true},saveStorageIDB}};
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:'save-import-atomic-guard.js'});
  return {context,store,durable,TycoonEngine};
}
const imported={saveVersion:9,week:8,companyCash:700,personalCash:300,companyAssets:{cash:700},personalAssets:{cash:300},cumulativeAccounting:{revenue:2200}};
{
  const {store,durable,TycoonEngine}=makeContext();const engine=new TycoonEngine();engine.importSave(JSON.stringify(imported));assert.equal(engine.g.week,8);assert.equal(JSON.parse(store.get(SAVE_KEY)).week,8);assert.equal(JSON.parse(durable.get(SAVE_KEY)).week,8);
}
{
  const {store,durable,TycoonEngine}=makeContext({failureMode:'idb-only'});const engine=new TycoonEngine();const localBefore=store.get(SAVE_KEY);engine.importSave(JSON.stringify(imported));assert.equal(engine.g.week,8,'IDB-only import must succeed');assert.equal(store.get(SAVE_KEY),localBefore,'quota-style IDB-only success may leave localStorage stale');assert.equal(JSON.parse(durable.get(SAVE_KEY)).week,8,'authoritative IDB payload must be accepted by verification');
}
for(const failureMode of ['save-false','throw','no-write','wrong-write','wrong-idb']){
  const {store,durable,TycoonEngine}=makeContext({failureMode});const engine=new TycoonEngine();const previous=engine.g;const previousRaw=store.get(SAVE_KEY);const previousDurable=durable.get(SAVE_KEY);const previousSaveInfo=engine._lastSaveStorageInfo;assert.throws(()=>engine.importSave(JSON.stringify(imported)));assert.strictEqual(engine.g,previous);assert.equal(store.get(SAVE_KEY),previousRaw);assert.equal(durable.get(SAVE_KEY),previousDurable,'failed import must roll authoritative IDB save back');assert.strictEqual(engine._lastSaveStorageInfo,previousSaveInfo);assert.equal(engine.g.companyCash,900);assert.equal(engine.g.personalCash,100);assert.equal(engine.emits,1);assert.equal(engine._saveStorageRecoveryBypass,undefined,'recovery bypass must be restored after failure');
}
console.log('save import atomic guard tests passed');
