'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('js/save-import-atomic-guard.js','utf8');
const SAVE_KEY='capitalism_tycoon_web_v1';
function makeContext({failureMode='none'}={}){
  const original={saveVersion:9,week:4,companyCash:900,personalCash:100,companyAssets:{cash:900},personalAssets:{cash:100},cumulativeAccounting:{revenue:1200}};
  const store=new Map([[SAVE_KEY,JSON.stringify(original)]]);
  class TycoonEngine{
    constructor(){this.g=structuredClone(original);this._saveBlockedDueToLoadFailure=false;this._loadFailureReason='';this._lastSaveStorageInfo={ok:true,mode:'raw'};this.emits=0;}
    emit(){this.emits++;}
    importSave(text){
      const next=JSON.parse(text);
      this.g=next;
      if(failureMode==='no-write')return;
      store.set(SAVE_KEY,JSON.stringify(next));
      if(failureMode==='save-false'){this._lastSaveStorageInfo={ok:false,mode:'failed'};return;}
      if(failureMode==='throw')throw new Error('synthetic import failure');
      if(failureMode==='wrong-write')store.set(SAVE_KEY,JSON.stringify(original));
      this._lastSaveStorageInfo={ok:true,mode:'raw'};
    }
  }
  const context={console,JSON,structuredClone,globalThis:null,localStorage:{getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value))},__capitalismTycoonModules:{engine:{TycoonEngine,SAVE_KEY,migrateSave:value=>({ok:value?.saveVersion===9,state:value})},saveStorage:{SAVE_KEY,__installed:true}}};
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:'save-import-atomic-guard.js'});
  return {context,store,TycoonEngine};
}
const imported={saveVersion:9,week:8,companyCash:700,personalCash:300,companyAssets:{cash:700},personalAssets:{cash:300},cumulativeAccounting:{revenue:2200}};
{
  const {store,TycoonEngine}=makeContext();const engine=new TycoonEngine();engine.importSave(JSON.stringify(imported));assert.equal(engine.g.week,8);assert.equal(JSON.parse(store.get(SAVE_KEY)).week,8);
}
for(const failureMode of ['save-false','throw','no-write','wrong-write']){
  const {store,TycoonEngine}=makeContext({failureMode});const engine=new TycoonEngine();const previous=engine.g;const previousRaw=store.get(SAVE_KEY);const previousSaveInfo=engine._lastSaveStorageInfo;assert.throws(()=>engine.importSave(JSON.stringify(imported)));assert.strictEqual(engine.g,previous);assert.equal(store.get(SAVE_KEY),previousRaw);assert.strictEqual(engine._lastSaveStorageInfo,previousSaveInfo);assert.equal(engine.g.companyCash,900);assert.equal(engine.g.personalCash,100);assert.equal(engine.emits,1);
}
console.log('save import atomic guard tests passed');
