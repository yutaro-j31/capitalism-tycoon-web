'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {loadGame}=require('./harness');
const {random,fixture,economic}=require('./fixtures/vc-initial-investment-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const clone=x=>JSON.parse(JSON.stringify(x));
async function setup(account,variant='plain'){
 const durable=new Map(),control={attempts:[]},s=loadGame({headless:true,random:random(),indexedDB:indexedDBFor(durable,control)});
 const f=fixture(s.modules,account,variant),e=f.e,key=s.engineModule.SAVE_KEY,backend=s.modules.saveStorageIDB;
 await backend.hydrate();assert.equal(e.save(),true);await backend.flush();
 assert.equal(s.modules.finance.validate(clone(e.g)).ok,true);
 return {...s,...f,key,backend,durable,control};
}
async function loaded(s,expected){
 const normalize=g=>economic(new s.engineModule.TycoonEngine(clone(g)).g),wanted=normalize(expected);
 assert.deepEqual(economic(s.engineModule.TycoonEngine.load().g),wanted,'production reload');
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g),wanted,'fresh durable-only hydration');await fresh.modules.saveStorageIDB.flush();
}
async function rejected(account,kind,pending=false,nested=false){
 const s=await setup(account);
 if(pending){s.control.holdPut=true;assert.equal(s.e.save(),true);await new Promise(r=>setTimeout(r,0));assert.equal(typeof s.control.release,'function');}
 const before=clone(s.e.g),bytes=s.backend.readSync(s.key),durable=s.durable.get(s.key),puts=s.control.attempts.length;
 const fault=inject(s.e,s.modules,s.ctx.localStorage,s.key,kind);let result,error;
 try{result=nested?s.e.runTransaction(()=>s.e.investStartup(s.id,s.amount,account)):s.e.investStartup(s.id,s.amount,account);}catch(ex){error=ex;}finally{fault.restore();}
 assert.ok(fault.hits()>0,'fault reaches installed investment');
 if(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)){assert.equal(result,false,'failed save must not report successful VC investment');assert.equal(error,undefined);}else assert.match(error?.message||'',/threw/);
 assert.deepEqual(clone(s.e.g),before,'full live rollback: cash/stake/basis/finance/valuation/runway/funding/news/RNG');
 assert.equal(s.ctx.__localStorageData.get(s.key),bytes);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.durable.get(s.key),durable);
 s.control.release?.();await s.backend.flush();assert.equal(s.durable.get(s.key),bytes,'accepted predecessor survives');assert.equal(s.control.attempts.length,puts,'failed candidate never starts put');
 await loaded(s,before);assert.equal(s.e.save(),true);await s.backend.flush();await loaded(s,before);
 assert.ok(JSON.parse(s.durable.get(s.key)).saveSequence>JSON.parse(bytes).saveSequence);assert.equal(s.modules.finance.validate(clone(s.e.g)).ok,true);
 console.log(`VC initial ${account} ${kind}${pending?' / in-flight predecessor':''}${nested?' / nested':''} PASS`);
}
const parity=[];
async function normal(account,variant){
 const a=await setup(account,variant),b=await setup(account,variant),before=clone(a.e.g),events=[],emit=a.e.emit,save=a.e.save;let saves=0;
 a.e.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};a.e.save=function(...args){if(!this.inTransaction())saves++;return save.apply(this,args);};
 const old=before.startups.find(x=>x.id===a.id),cashKey=account==='company'?'companyCash':'personalCash',other=account==='company'?'personalCash':'companyCash',own=account==='company'?'ownedCompany':'ownedPersonal',basis=account==='company'?'totalInvestedCompany':'totalInvestedPersonal';
 const discount=Math.max(0,Math.min(.15,old.dueDiligence?.discount||0)),equity=Math.min(.35,a.amount/(old.valuation*(1-discount)+a.amount));
 assert.equal(a.e.investStartup(a.id,a.amount,account),true);assert.equal(b.e.investStartup(b.id,b.amount,account),true);
 const target=a.e.g.startups.find(x=>x.id===a.id);assert.equal(a.e.g[cashKey],before[cashKey]-a.amount);assert.equal(a.e.g[other],before[other]);assert.equal(target[own],Math.min(account==='company'?.8:.49,old[own]+equity));assert.equal(target[basis],old[basis]+a.amount);assert.equal(target.valuation,old.valuation+a.amount*.75);assert.equal(target.runwayWeeks,old.runwayWeeks+Math.floor(a.amount/Math.max(1,target.valuation)*156));assert.equal(target.fundingOpen,false);
 assert.deepEqual(clone(a.e.g.simulationRng),before.simulationRng);assert.equal(a.e.g.finance.transactions.length-before.finance.transactions.length,account==='company'?1:0);
 assert.deepEqual(economic(a.e.g),economic(b.e.g),'deterministic replay');assert.deepEqual(events,['notify','saved','change']);assert.equal(saves,1);assert.deepEqual(economic(JSON.parse(a.backend.readSync(a.key))),economic(JSON.parse(b.backend.readSync(b.key))),'deterministic persisted economics (wall-clock save timestamp excluded)');
 const first=clone(a.e.g),firstSave=a.backend.readSync(a.key);parity.push({account,variant,state:first,stored:JSON.parse(firstSave),events:[...events],saves});
 // Another initial investment in the same week (same and distinct target).
 assert.equal(a.e.investStartup(a.id,a.amount,account),true);assert.equal(a.e.g.week,first.week);
 const next=a.e.g.startups.find(x=>x.alive&&!x.subsidiary&&x.id!==a.id&&x.activeFundingRound?.status!=='open');assert.ok(next);assert.equal(a.e.investStartup(next.id,next.minTicket,account),true);assert.equal(saves,3);
 parity.at(-1).multiple={state:clone(a.e.g),stored:JSON.parse(a.backend.readSync(a.key)),events:[...events],saves};
 if(process.env.VC_PARITY_ONLY){await a.backend.flush();await loaded(a,a.e.g);return;}
 const accepted=clone(a.e.g);assert.equal(a.e.investStartup(a.id,a.e.g[cashKey]+1,account),false);assert.deepEqual(clone(a.e.g),accepted,'insufficient cash refusal restores state including failure news');assert.equal(saves,3);
 await a.backend.flush();await loaded(a,a.e.g);assert.equal(a.modules.finance.validate(clone(a.e.g)).ok,true);assert.equal(a.key,'capitalism_tycoon_web_v1');assert.equal(a.e.g.saveVersion,9);
 console.log(`VC initial ${account} ${variant} normal / same-week multiple / insufficient cash / replay / reload PASS`);
}
(async()=>{for(const account of ['company','personal']){
 if(!process.env.VC_PARITY_ONLY){for(const fault of ['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify'])await rejected(account,fault);
 for(const fault of ['save-false','save-throw','saved','change'])await rejected(account,fault,true);await rejected(account,'change',false,true);}
 for(const variant of ['plain','dd','cap'])await normal(account,variant);
}if(process.env.VC_PARITY_OUTPUT)fs.writeFileSync(process.env.VC_PARITY_OUTPUT,JSON.stringify(parity));console.log('VC initial investment save atomicity PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
