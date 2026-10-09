'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {loadGame}=require('./harness');
const {random,fixture,economic}=require('./fixtures/vc-follow-on-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const clone=x=>JSON.parse(JSON.stringify(x));
async function setup(account,variant='split'){
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
 try{result=nested?s.e.runTransaction(()=>s.e.participateStartupFundingRound(s.id,s.amount,account)):s.e.participateStartupFundingRound(s.id,s.amount,account);}catch(ex){error=ex;}finally{fault.restore();}
 assert.ok(fault.hits()>0,'fault reaches installed investment');
 if(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)){assert.equal(result,false,'failed save must not report successful VC follow-on contribution');assert.equal(error,undefined);}else assert.match(error?.message||'',/threw/);
 assert.deepEqual(clone(s.e.g),before,'full live rollback: cash/stake/basis/finance/valuation/runway/funding/news/RNG');
 assert.equal(s.ctx.__localStorageData.get(s.key),bytes);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.durable.get(s.key),durable);
 s.control.release?.();await s.backend.flush();assert.equal(s.durable.get(s.key),bytes,'accepted predecessor survives');assert.equal(s.control.attempts.length,puts,'failed candidate never starts put');
 await loaded(s,before);assert.equal(s.e.save(),true);await s.backend.flush();await loaded(s,before);
 assert.ok(JSON.parse(s.durable.get(s.key)).saveSequence>JSON.parse(bytes).saveSequence);assert.equal(s.modules.finance.validate(clone(s.e.g)).ok,true);
 console.log(`VC follow-on ${account} ${kind}${pending?' / in-flight predecessor':''}${nested?' / nested':''} PASS`);
}
const parity=[];
async function normal(account,variant){
 const a=await setup(account,variant),b=await setup(account,variant),before=clone(a.e.g),events=[],emit=a.e.emit,save=a.e.save;let saves=0;
 a.e.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};a.e.save=function(...args){if(!this.inTransaction())saves++;return save.apply(this,args);};
 const plan=a.e.getStartupFundingRoundPlan(a.id),old=before.startups.find(x=>x.id===a.id),cashKey=account==='company'?'companyCash':'personalCash',other=account==='company'?'personalCash':'companyCash',cap=account==='company'?'Company':'Personal';
 const contribute=(side,amount)=>{assert.equal(a.e.participateStartupFundingRound(a.id,amount,side),true);assert.equal(b.e.participateStartupFundingRound(b.id,amount,side),true);};
 if(!process.env.VC_FOLLOW_PARITY_ONLY){
  for(const amount of [NaN,Infinity,0,-1,'1',null,plan[account].remaining+1]){assert.equal(a.e.participateStartupFundingRound(a.id,amount,account),false);assert.deepEqual(clone(a.e.g),before);}
  assert.equal(a.e.participateStartupFundingRound(a.id,a.amount,'invalid'),false);assert.deepEqual(clone(a.e.g),before);assert.equal(saves,0);assert.deepEqual(events,[]);
  a.e.g[cashKey]=a.amount-1;const insufficient=clone(a.e.g);assert.equal(a.e.participateStartupFundingRound(a.id,a.amount,account),false);assert.deepEqual(clone(a.e.g),insufficient);a.e.g[cashKey]=before[cashKey];assert.equal(saves,0);
 }
 contribute(account,a.amount);
 const target=a.e.g.startups.find(x=>x.id===a.id);
 assert.equal(a.e.g[cashKey],before[cashKey]-a.amount);assert.equal(a.e.g[other],before[other]);assert.equal(target.activeFundingRound[`contributed${cap}`],old.activeFundingRound[`contributed${cap}`]+a.amount);assert.equal(target[`totalInvested${cap}`],old[`totalInvested${cap}`]+a.amount);
 assert.equal(target.ownedCompany,old.ownedCompany);assert.equal(target.ownedPersonal,old.ownedPersonal);assert.equal(target.valuation,old.valuation);assert.equal(target.runwayWeeks,old.runwayWeeks);
 assert.equal(a.e.g.startupFundingHistory[a.id].length,before.startupFundingHistory[a.id].length+1);assert.equal(a.e.g.finance.transactions.length-before.finance.transactions.length,account==='company'?1:0);assert.deepEqual(clone(a.e.g.simulationRng),before.simulationRng);
 assert.deepEqual(events,['notify','saved','change']);assert.equal(saves,1);assert.deepEqual(economic(a.e.g),economic(b.e.g),'deterministic economic replay');
 const stored=x=>{const g=JSON.parse(x.backend.readSync(x.key));delete g.lastSaveDate;return g;};assert.deepEqual(stored(a),stored(b),'persisted replay includes saveSequence');
 parity.push({account,variant,first:{state:clone(a.e.g),stored:JSON.parse(a.backend.readSync(a.key)),events:[...events],saves}});
 // Multiple valid contributions in one round, then both holders fully maintain their stakes.
 const remaining=a.e.getStartupFundingRoundPlan(a.id)[account].remaining;if(remaining>0)contribute(account,remaining);
 const otherSide=account==='company'?'personal':'company',otherRemaining=a.e.getStartupFundingRoundPlan(a.id)[otherSide].remaining;contribute(otherSide,otherRemaining/2);contribute(otherSide,otherRemaining/2);
 assert.equal(a.e.g.week,before.week);assert.equal(a.e.getStartupFundingRoundPlan(a.id).company.remaining,0);assert.equal(a.e.getStartupFundingRoundPlan(a.id).personal.remaining,0);
 if(!process.env.VC_FOLLOW_PARITY_ONLY){const accepted=clone(a.e.g),count=saves;assert.equal(a.e.participateStartupFundingRound(a.id,1,account),false);assert.deepEqual(clone(a.e.g),accepted);assert.equal(saves,count);}
 assert.deepEqual(events,Array(saves).fill(['notify','saved','change']).flat());assert.deepEqual(economic(a.e.g),economic(b.e.g));assert.deepEqual(stored(a),stored(b));
 parity.at(-1).multiple={state:clone(a.e.g),stored:JSON.parse(a.backend.readSync(a.key)),events:[...events],saves};
 // The unchanged round-close formula uses the accepted contribution amounts exactly once.
 a.e.g.week=plan.closesWeek;b.e.g.week=plan.closesWeek;assert.equal(a.e.closeStartupFundingRound(target),true);assert.equal(b.e.closeStartupFundingRound(b.e.g.startups.find(x=>x.id===b.id)),true);
 assert.ok(Math.abs(target.ownedCompany-plan.company.ownershipBefore)<1e-12);assert.ok(Math.abs(target.ownedPersonal-plan.personal.ownershipBefore)<1e-12);assert.equal(target.valuation,plan.postMoneyValuation);
 assert.equal(a.e.save(),true);assert.equal(b.e.save(),true);await a.backend.flush();await b.backend.flush();await loaded(a,a.e.g);assert.deepEqual(economic(a.e.g),economic(b.e.g));assert.deepEqual(stored(a),stored(b));
 parity.at(-1).closed={state:clone(a.e.g),stored:JSON.parse(a.backend.readSync(a.key))};assert.equal(a.modules.finance.validate(clone(a.e.g)).ok,true);assert.equal(a.key,'capitalism_tycoon_web_v1');assert.equal(a.e.g.saveVersion,9);
 console.log(`VC follow-on ${account} ${variant} normal / cap / multiple / cash separation / close / replay / reload PASS`);
}
(async()=>{for(const account of ['company','personal']){
 if(!process.env.VC_FOLLOW_PARITY_ONLY){for(const fault of ['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify'])await rejected(account,fault);for(const fault of ['save-false','save-throw','saved','change'])await rejected(account,fault,true);await rejected(account,'change',false,true);}
 for(const variant of ['split','full','tail'])await normal(account,variant);
}if(process.env.VC_FOLLOW_PARITY_OUTPUT)fs.writeFileSync(process.env.VC_FOLLOW_PARITY_OUTPUT,JSON.stringify(parity));console.log('VC follow-on save atomicity PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
