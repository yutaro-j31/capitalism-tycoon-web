'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {loadGame}=require('./harness');
const {scenario,economic,snapshot,assertSplit}=require('./fixtures/stock-split-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const parity=[];
async function loaded(s,expected){
 const wanted=economic(new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected))).g);
 assert.deepEqual(economic(s.engineModule.TycoonEngine.load().g),wanted,'production reload');
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g),wanted,'fresh durable-only hydration');await fresh.modules.saveStorageIDB.flush();
}
function fault(s,kind){
 if(kind!=='save-before-throw')return inject(s.game,s.modules,s.ctx.localStorage,s.key,kind);
 const save=s.game.save;let hits=0;s.game.save=()=>{hits++;throw new Error('save before admission threw');};
 return {hits:()=>hits,restore(){s.game.save=save;}};
}
async function rejected(family,kind,pending=false,nested=false){
 const s=await scenario(family);
 if(pending){s.control.holdPut=true;assert.equal(s.game.save(),true);for(let i=0;i<100&&!s.control.release;i++)await new Promise(r=>setImmediate(r));assert.equal(typeof s.control.release,'function');}
 const before=snapshot(s.game),bytes=s.backend.readSync(s.key),durable=s.durable.get(s.key),puts=s.control.attempts.length,draws=s.host.draws;
 const injection=fault(s,kind);let result,error;
 try{result=nested?s.game.runTransaction(()=>s.game.stockSplit(s.stockID,2)):s.game.stockSplit(s.stockID,2);}catch(ex){error=ex;}finally{injection.restore();}
 assert.ok(injection.hits()>0,'fault reaches installed writer');
 if(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)){assert.equal(result,false,'failed split must return false');assert.equal(error,undefined);}else assert.match(error?.message||'',/threw/);
 assert.deepEqual(snapshot(s.game),before,'full live rollback including quantities/history/finance/news/RNG');assert.equal(s.host.draws,draws);
 assert.equal(s.ctx.__localStorageData.get(s.key),bytes);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.durable.get(s.key),durable);
 s.control.release?.();await s.backend.flush();assert.equal(s.durable.get(s.key),bytes,'predecessor preserved, failed split never durable');assert.equal(s.control.attempts.length,puts,'cancel failed pending put');
 await loaded(s,before);assert.equal(s.game.save(),true);await s.backend.flush();await loaded(s,before);
 assert.equal(s.game.stockSplit(s.stockID,2),true,'failed split can retry');assertSplit(before,snapshot(s.game),s.stockID,2);await s.backend.flush();await loaded(s,s.game.g);
 console.log(`stockSplit ${family}/${kind}/pending=${pending}/nested=${nested} PASS`);
}
async function normal(family,legacy){
 const s=await scenario(family,legacy),events=[],emit=s.game.emit,save=s.game.save;let saves=0;
 s.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};s.game.save=function(...args){if(!this.inTransaction())saves++;return save.apply(this,args);};
 for(const ratio of [2,2,3]){const before=snapshot(s.game),draws=s.host.draws;assert.equal(s.game.stockSplit(s.stockID,ratio),true);assertSplit(before,snapshot(s.game),s.stockID,ratio);assert.equal(s.host.draws,draws);}
 assert.equal(saves,3);assert.deepEqual(events,['notify','saved','change','notify','saved','change','notify','saved','change']);
 const before=snapshot(s.game),bytes=s.backend.readSync(s.key);
 for(const [id,ratio] of [[s.stockID,1],[s.stockID,0],['MISSING',2]])assert.equal(s.game.stockSplit(id,ratio),false);
 assert.deepEqual(snapshot(s.game),before);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(saves,3);
 for(const account of ['company','personal']){assert.equal(s.game.buyStock(s.stockID,1000,account),true);assert.equal(s.game.sellStock(s.stockID,1000,account),true);}
 assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true);await s.backend.flush();await loaded(s,s.game.g);
 const stored=JSON.parse(s.backend.readSync(s.key));delete stored.lastSaveDate;
 parity.push({family,legacy,state:economic(s.game.g),stored,events,saves,draws:s.host.draws});
 console.log(`stockSplit ${family}/legacy=${legacy} repeat/trades/history/cash/ledger/RNG/reload PASS`);
}
(async()=>{
 for(const family of ['own','external']){
  if(!process.env.STOCK_SPLIT_PARITY_ONLY){
   for(const nested of [false,true])for(const kind of ['save-false','save-before-throw','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify'])await rejected(family,kind,false,nested);
   for(const kind of ['save-false','save-throw','saved','change'])await rejected(family,kind,true);
   const s=await scenario(family);s.game.g.publicCompany=false;const before=snapshot(s.game);assert.equal(s.game.stockSplit('CPTY',2),false);assert.deepEqual(snapshot(s.game),before);
  }
  for(const legacy of [false,true])await normal(family,legacy);
 }
 if(process.env.STOCK_SPLIT_PARITY_OUTPUT)fs.writeFileSync(process.env.STOCK_SPLIT_PARITY_OUTPUT,JSON.stringify(parity));
 console.log('Stock split save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
