'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {loadGame}=require('./harness');
const {random,fixture,economic}=require('./fixtures/vc-secondary-sale-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const clone=x=>JSON.parse(JSON.stringify(x));
async function setup(account,variant='mixed'){
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
 try{result=nested?s.e.runTransaction(()=>s.e.sellStartupSecondary(s.id,account)):s.e.sellStartupSecondary(s.id,account);}catch(ex){error=ex;}finally{fault.restore();}
 assert.ok(fault.hits()>0,'fault reaches installed sale');
 if(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)){assert.equal(result,false,'failed save must not report successful VC secondary sale');assert.equal(error,undefined);}else assert.match(error?.message||'',/threw/);
 assert.deepEqual(clone(s.e.g),before,'full live rollback: cash/stake/basis/DD ownership/finance/news/RNG');
 assert.equal(s.ctx.__localStorageData.get(s.key),bytes);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.durable.get(s.key),durable);
 s.control.release?.();await s.backend.flush();assert.equal(s.durable.get(s.key),bytes,'accepted predecessor survives');assert.equal(s.control.attempts.length,puts,'failed candidate never starts put');
 await loaded(s,before);assert.equal(s.e.save(),true);await s.backend.flush();await loaded(s,before);
 assert.ok(JSON.parse(s.durable.get(s.key)).saveSequence>JSON.parse(bytes).saveSequence);assert.equal(s.modules.finance.validate(clone(s.e.g)).ok,true);
 console.log(`VC secondary sale ${account} ${kind}${pending?' / in-flight predecessor':''}${nested?' / nested':''} PASS`);
}
const parity=[];
async function normal(account,variant){
 const a=await setup(account,variant),b=await setup(account,variant),before=clone(a.e.g),events=[],emit=a.e.emit,save=a.e.save;let saves=0;
 a.e.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};a.e.save=function(...args){if(!this.inTransaction())saves++;return save.apply(this,args);};
 const old=before.startups.find(x=>x.id===a.id),cashKey=account==='company'?'companyCash':'personalCash',other=account==='company'?'personalCash':'companyCash',cap=account==='company'?'Company':'Personal',otherCap=account==='company'?'Personal':'Company';
 const preview=a.e.previewStartupSecondarySale(a.id,account),dd=Math.max(0,Math.min(old['owned'+cap],old['ddNegotiatedOwned'+cap]||0)),discount=Math.max(0,Math.min(.15,old.dueDiligence?.discount||0));
 const proceeds=Math.round(((old['owned'+cap]-dd)*old.valuation+dd*old.valuation*(1-discount))*(1-preview.discount));
 assert.equal(preview.proceeds,proceeds);
 assert.equal(a.e.sellStartupSecondary(a.id,account),true);assert.equal(b.e.sellStartupSecondary(b.id,account),true);
 const target=a.e.g.startups.find(x=>x.id===a.id);
 assert.equal(a.e.g[cashKey],before[cashKey]+proceeds);assert.equal(a.e.g[other],before[other]);
 for(const field of ['owned','totalInvested','ddNegotiatedOwned']){assert.equal(target[field+cap],0);assert.equal(target[field+otherCap],old[field+otherCap]);}
 assert.equal(target.valuation,old.valuation);assert.equal(target.runwayWeeks,old.runwayWeeks);assert.deepEqual(clone(a.e.g.simulationRng),before.simulationRng);
 assert.equal(a.e.g.finance.transactions.length-before.finance.transactions.length,account==='company'?1:0);
 if(account==='company'){const row=a.e.g.finance.transactions.at(-1);assert.equal(row.cashEffect,proceeds);assert.equal(row.assetEffect,-old.totalInvestedCompany);assert.equal(row.profitEffect,proceeds-old.totalInvestedCompany);assert.equal(row.idempotencyKey,`startup-secondary-${a.id}-company-${before.week}-${before.finance.nextTransactionSeq}`);}
 assert.deepEqual(events,['notify','saved','change']);assert.equal(saves,1);assert.deepEqual(economic(a.e.g),economic(b.e.g),'deterministic replay');
 const stored=x=>{const g=JSON.parse(x.backend.readSync(x.key));delete g.lastSaveDate;return g;};assert.deepEqual(stored(a),stored(b));
 parity.push({account,variant,first:{state:clone(a.e.g),stored:JSON.parse(a.backend.readSync(a.key)),events:[...events],saves}});
 const accepted=clone(a.e.g);assert.equal(a.e.sellStartupSecondary(a.id,account),false);assert.deepEqual(clone(a.e.g),accepted,'duplicate sale no change');assert.equal(saves,1);
 // The remaining holder is independent; a same-week reinvestment and sale use new ledger identity.
 const otherSide=account==='company'?'personal':'company';assert.equal(a.e.sellStartupSecondary(a.id,otherSide),true);
 assert.equal(a.e.investStartup(a.id,a.amount,account),true);assert.equal(a.e.sellStartupSecondary(a.id,account),true);
 const identities=a.e.g.finance.transactions.filter(t=>t.sourceType==='startupSecondarySale').map(t=>t.idempotencyKey);assert.equal(new Set(identities).size,identities.length);
 parity.at(-1).multiple={state:clone(a.e.g),stored:JSON.parse(a.backend.readSync(a.key)),events:[...events],saves};
 await a.backend.flush();await loaded(a,a.e.g);assert.equal(a.modules.finance.validate(clone(a.e.g)).ok,true);assert.equal(a.key,'capitalism_tycoon_web_v1');assert.equal(a.e.g.saveVersion,9);
 console.log(`VC secondary sale ${account} ${variant} / DD pricing / cash separation / duplicate / reinvest / replay / reload PASS`);
}
async function refusal(account){
 const s=await setup(account),before=clone(s.e.g),bytes=s.backend.readSync(s.key),event=s.modules.finance.event;
 if(account==='company'){s.modules.finance.event=()=>false;try{assert.equal(s.e.sellStartupSecondary(s.id,account),false);}finally{s.modules.finance.event=event;}assert.deepEqual(clone(s.e.g),before);assert.equal(s.backend.readSync(s.key),bytes);}
 for(const flag of ['alive','subsidiary','ipoStockID','activeFundingRound']){
  const target=s.e.g.startups.find(x=>x.id===s.id),old=target[flag];target[flag]=flag==='alive'?false:true;const blocked=clone(s.e.g);
  assert.equal(s.e.sellStartupSecondary(s.id,account),false);assert.deepEqual(clone(s.e.g),blocked);target[flag]=old;
 }
 assert.equal(s.e.sellStartupSecondary('missing',account),false);assert.equal(s.backend.readSync(s.key),bytes);
}
(async()=>{for(const account of ['company','personal']){
 if(!process.env.VC_SECONDARY_PARITY_ONLY){for(const fault of ['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify'])await rejected(account,fault);
 for(const fault of ['save-false','save-throw','saved','change','notify'])await rejected(account,fault,true);await rejected(account,'change',false,true);await refusal(account);}
 for(const variant of ['plain','dd','mixed','legacy','profit'])await normal(account,variant);
}if(process.env.VC_SECONDARY_PARITY_OUTPUT)fs.writeFileSync(process.env.VC_SECONDARY_PARITY_OUTPUT,JSON.stringify(parity));console.log('VC secondary sale save atomicity PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
