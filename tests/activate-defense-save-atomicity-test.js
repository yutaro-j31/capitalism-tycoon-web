'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {prepareIPO,economic}=require('./fixtures/parent-ipo-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const clone=v=>JSON.parse(JSON.stringify(v));
function randomFor(){let seed=0x19be5702;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
async function setup(){
 const durable=new Map(),control={attempts:[]};
 const s=loadGame({headless:true,random:randomFor(),indexedDB:indexedDBFor(durable,control)});
 const game=prepareIPO(s.modules),backend=s.modules.saveStorageIDB,key=s.engineModule.SAVE_KEY;
 await backend.hydrate();assert.equal(game.executeIPO('東証グロース'),true,'fixture IPO');await backend.flush();
 game.g.companyCash=Math.max(game.g.companyCash,100_000_000);assert.equal(game.save(),true);await backend.flush();
 return {...s,game,backend,key,durable,control};
}
async function rejected(kind){
 const s=await setup(),before=clone(s.game.g),bytes=s.backend.readSync(s.key),durable=s.durable.get(s.key);
 const fault=inject(s.game,s.modules,s.ctx.localStorage,s.key,kind);let result,error;
 try{result=s.game.activateDefense('poisonPill');}catch(e){error=e;}finally{fault.restore();}
 assert.ok(fault.hits()>0,`${kind}: injection reached the writer`);
 if(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)){assert.equal(result,false,`${kind}: failed defense returns false`);assert.equal(error,undefined);}
 else assert.match(error?.message||'',/threw/);
 assert.deepEqual(clone(s.game.g),before,`${kind}: live state rolled back`);
 assert.equal(s.ctx.__localStorageData.get(s.key),bytes,`${kind}: mirror unchanged`);
 await s.backend.flush();assert.equal(s.durable.get(s.key),durable,`${kind}: durable unchanged`);
 const fresh=loadGame({headless:true,random:randomFor(),indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g),economic(new s.engineModule.TycoonEngine(clone(before)).g),`${kind}: fresh hydration`);
 assert.equal(s.game.activateDefense('poisonPill'),true,`${kind}: retry succeeds`);
 console.log(`activateDefense ${kind} PASS`);
}
async function normal(){
 const s=await setup(),cash=s.game.g.companyCash,personal=s.game.g.personalCash,ratio=s.game.g.competitorOwnedRatio;
 let saves=0;const save=s.game.save;s.game.save=function(...a){if(!this.inTransaction())saves++;return save.apply(this,a);};
 assert.equal(s.game.activateDefense('whiteKnight'),true);assert.equal(saves,1);
 assert.equal(s.game.g.companyCash,cash-25_000_000);assert.equal(s.game.g.personalCash,personal);
 assert.ok(s.game.g.competitorOwnedRatio<=ratio);assert.equal(s.modules.finance.validate(s.game.g).ok,true);
 s.game.g.companyCash=0;const b=clone(s.game.g);assert.equal(s.game.activateDefense('poisonPill'),false);assert.deepEqual(clone(s.game.g),b);
 s.game.g.publicCompany=false;assert.equal(s.game.activateDefense('irCampaign'),false);
 console.log('activateDefense normal/insufficient/unlisted PASS');
}
(async()=>{
 await normal();
 for(const kind of ['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify'])await rejected(kind);
 console.log('activateDefense save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
