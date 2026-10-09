'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {prepareAcceptedPE,economic,makeRandom,linkHistoryRows,fillHistoryCaps}=require('./fixtures/pe-fund-acquisition-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const clone=x=>JSON.parse(JSON.stringify(x));
async function fixture(co){
  const s=loadGame({headless:true,random:makeRandom()});
  const p=prepareAcceptedPE(s.modules,co);
  assert.equal(s.modules.finance.validate(clone(p.e.g)).ok,true,'valid endowment and weekly accounting');
  return {...p,g:clone(p.e.g),e:undefined};
}
async function setup(f,lp=false){
  const durable=new Map(),control={attempts:[]},s=loadGame({headless:true,random:makeRandom(),indexedDB:indexedDBFor(durable,control)});
  const e=new s.engineModule.TycoonEngine(clone(f.g)),key=s.engineModule.SAVE_KEY,backend=s.modules.saveStorageIDB;
  if(lp){const fund=e.g.peFirm.funds.find(x=>x.id===f.fundID);assert.ok(s.modules.peFund.addLPCommitment(fund,{lpTypeID:'universitySovereign',committedAmount:1000000,promiseAccepted:true}));
    // Controlled restriction branch witness, not a claim of natural large-cap supply reachability.
    e.g.acquisitionTargets.find(x=>x.id===f.targetID).peTierID='largeCap';}
  await backend.hydrate();assert.equal(e.save(),true);await backend.flush();
  return {...s,e,key,backend,durable,control};
}
async function loaded(s,expected){
  const normalized=new s.engineModule.TycoonEngine(clone(expected));
  assert.deepEqual(economic(s.engineModule.TycoonEngine.load().g),economic(normalized.g),'production reload');
  const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
  assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g),economic(normalized.g),'fresh durable-only hydration');
  await fresh.modules.saveStorageIDB.flush();
}
async function rejected(f,kind,pending=false,lp=false,nested=false,capped=false){
  const s=await setup(f,lp);
  if(pending){s.control.holdPut=true;assert.equal(s.e.save(),true);await new Promise(r=>setTimeout(r,0));assert.equal(typeof s.control.release,'function');}
  if(capped){fillHistoryCaps(s.e.g,f.dealID);assert.equal(s.e.save(),true);await s.backend.flush();}
  linkHistoryRows(s.e.g);
  const before=clone(s.e.g),bytes=s.backend.readSync(s.key),durable=s.durable.get(s.key),puts=s.control.attempts.length;
  const fault=inject(s.e,s.modules,s.ctx.localStorage,s.key,kind);let result,error;
  try{result=nested?s.e.runTransaction(()=>s.e.closeMADeal(f.dealID)):s.e.closeMADeal(f.dealID);}catch(ex){error=ex;}finally{fault.restore();}
  assert.ok(fault.hits()>0,'fault reaches installed PE closing');
  if(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)){assert.equal(result,false,'failed save must not report completed PE acquisition');assert.equal(error,undefined);}
  else assert.match(error?.message||'',/PE acquisition .*threw/);
  assert.deepEqual(clone(s.e.g),before,'complete live rollback: fund, coinvest, LP, target/deal/history/news, finance and RNG');
  assert.equal(s.ctx.__localStorageData.get(s.key),bytes,'mirror bytes');assert.equal(s.backend.readSync(s.key),bytes,'cache bytes');assert.equal(s.durable.get(s.key),durable,'durable unchanged synchronously');
  s.control.release?.();await s.backend.flush();assert.equal(s.durable.get(s.key),bytes,'prior accepted pending save retained');assert.equal(s.control.attempts.length,puts,'failed candidate never starts a put');
  await loaded(s,before);const seq=JSON.parse(bytes).saveSequence;
  assert.equal(s.e.save(),true);await s.backend.flush();assert.ok(JSON.parse(s.durable.get(s.key)).saveSequence>seq,'sequence remains monotonic');
  await loaded(s,s.e.g);assert.equal(s.e.g.maDealRooms.find(x=>x.id===f.dealID).status,'accepted','recovery save cannot resurrect rejected acquisition');
  assert.equal(s.modules.finance.validate(clone(s.e.g)).ok,true);
  console.log(`PE acquisition ${f.coinvest?'coinvest':'fund-only'} ${kind}${pending?' / pending':''}${lp?' / LP':''}${nested?' / nested':''}${capped?' / capped history':''} PASS`);
}
async function normal(f,lp=false){
  const a=await setup(f,lp),b=await setup(f,lp),before=clone(a.e.g),events=[],emit=a.e.emit,save=a.e.save;let commits=0;
  a.e.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
  a.e.save=function(...args){if(!this.inTransaction())commits++;return save.apply(this,args);};
  assert.equal(a.e.closeMADeal(f.dealID),true);assert.equal(b.e.closeMADeal(f.dealID),true);
  assert.deepEqual(economic(a.e.g),economic(b.e.g),'deterministic successful replay');assert.deepEqual(events,['notify','saved','change']);assert.equal(commits,1,'one save commit');
  const oldFund=before.peFirm.funds.find(x=>x.id===f.fundID),fund=a.e.g.peFirm.funds.find(x=>x.id===f.fundID),plan=a.modules.peFund.planDealFinancing(oldFund,f.price,f.coinvest);
  assert.equal(fund.cash,oldFund.cash-plan.fundPortion);assert.equal(fund.coinvestCommitted,oldFund.coinvestCommitted+plan.coinvestPortion);
  if(lp)assert.equal(fund.lps.find(x=>x.lpTypeID==='universitySovereign').promiseFulfilled,false,'LP outcome committed with acquisition');
  assert.equal(fund.deals.at(-1).acquisitionPrice,f.price);assert.equal(fund.deals.at(-1).investedAmount,plan.fundPortion+plan.coinvestPortion);
  assert.equal(a.e.g.companyCash,before.companyCash);assert.equal(a.e.g.personalCash,before.personalCash);assert.deepEqual(clone(a.e.g.finance),before.finance);assert.deepEqual(clone(a.e.g.simulationRng),before.simulationRng);
  const completed=clone(a.e.g),bytes=a.backend.readSync(a.key);assert.equal(a.e.closeMADeal(f.dealID),false);assert.deepEqual(clone(a.e.g),completed);assert.equal(a.backend.readSync(a.key),bytes);assert.equal(commits,1);
  await a.backend.flush();await b.backend.flush();await loaded(a,completed);assert.equal(a.modules.finance.validate(clone(a.e.g)).ok,true);
  assert.equal(a.key,'capitalism_tycoon_web_v1');assert.equal(a.e.g.saveVersion,9);console.log(`PE acquisition ${f.coinvest?'coinvest':'fund-only'} normal${lp?' / LP':''} / replay / duplicate / reload PASS`);
}
(async()=>{for(const co of [false,true]){const f=await fixture(co);f.coinvest=co;
  for(const fault of ['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify'])await rejected(f,fault);
  await rejected(f,'save-false',true);await rejected(f,'change',true);await rejected(f,'save-false',false,true);await rejected(f,'change',false,true);await rejected(f,'save-false',false,false,true);await rejected(f,'change',false,false,false,true);await rejected(f,'save-false',false,false,false,true);await normal(f);await normal(f,true);
}console.log('PE fund acquisition save atomicity PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
