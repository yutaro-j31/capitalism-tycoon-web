'use strict';
// PE-PORTFOLIO-EXIT-ATOMICITY-001: a rejected or throwing save must roll the whole PE portfolio Exit
// back (fund settlement, GP personal proceeds, deal status) on both enabled entry routes: the installed
// engine method and the primary PE UI adapter. Economics are untouched; this checks atomicity only.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {prepareAcceptedPE,makeRandom}=require('./fixtures/pe-fund-acquisition-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const clone=x=>JSON.parse(JSON.stringify(x));
function find(g,f){const fund=g.peFirm.funds.find(x=>x.id===f.fundID);return{fund,deal:fund.deals.find(x=>x.id===f.portfolioID)};}
function makeFixture(){
  const s=loadGame({headless:true,random:makeRandom()}),p=prepareAcceptedPE(s.modules,true);
  assert.equal(p.e.closeMADeal(p.dealID),true,'actual accepted PE acquisition closes');
  const fund=p.e.g.peFirm.funds.find(x=>x.id===p.fundID),deal=fund.deals.at(-1);
  assert.ok(deal.portfolioCompany&&deal.status==='active');
  // Controlled maturity/eligibility witness (as in the exit-preview tests), not natural 156-week play.
  p.e.g.week=deal.acquiredWeek+156;deal.portfolioCompany.improvementScore=67;
  assert.equal(s.modules.finance.validate(clone(p.e.g)).ok,true,'valid baseline company ledger');
  const f={g:clone(p.e.g),fundID:fund.id,portfolioID:deal.id};
  for(const method of ['sale','ipo'])assert.equal(p.e.previewPEPortfolioExit(f.fundID,f.portfolioID,{method}).ok,true,'eligible '+method);
  return f;
}
async function setup(f){
  const durable=new Map(),control={attempts:[]},s=loadGame({headless:true,random:makeRandom(),indexedDB:indexedDBFor(durable,control)});
  const e=new s.engineModule.TycoonEngine(clone(f.g)),backend=s.modules.saveStorageIDB,key=s.engineModule.SAVE_KEY;
  await backend.hydrate();assert.equal(e.save(),true);await backend.flush();
  return{...s,e,key,backend,durable,control};
}
async function freshStatus(s,f){
  const h=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await h.modules.saveStorageIDB.hydrate();
  const g=clone(h.engineModule.TycoonEngine.load().g),{fund,deal}=find(g,f);return{status:deal.status,personalCash:g.personalCash,distributed:fund.distributed};
}
function run(s,f,method,route){
  if(route==='adapter'){s.modules.playerEngineBridge.bindEngine(s.e);return s.modules.peUIAdapter.performPortfolio('exit',{fundID:f.fundID,dealID:f.portfolioID,method});}
  return s.e.exitPEPortfolioCompany(f.fundID,f.portfolioID,{method});
}
async function faulted(f,route,method,kind,pending){
  const s=await setup(f);
  if(pending){s.control.holdPut=true;assert.equal(s.e.save(),true);await new Promise(r=>setTimeout(r,0));assert.equal(typeof s.control.release,'function','in-flight predecessor');}
  const before=clone(s.e.g),bytes=s.backend.readSync(s.key),durable=s.durable.get(s.key),puts=s.control.attempts.length;
  const fault=inject(s.e,s.modules,s.ctx.localStorage,s.key,kind);let returned,error;
  try{returned=run(s,f,method,route);}catch(ex){error=ex;}finally{fault.restore();}
  assert.ok(fault.hits()>0,'fault reaches the Exit save');
  if(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)){assert.equal(returned,false,'failed save must not report a completed Exit');assert.equal(error,undefined);}
  else assert.match(error?.message||'',/threw/);
  assert.deepEqual(clone(s.e.g),before,'complete live rollback of fund settlement, deal status, finance and RNG');
  assert.equal(s.ctx.__localStorageData.get(s.key),bytes,'mirror bytes');assert.equal(s.backend.readSync(s.key),bytes,'cache bytes');assert.equal(s.durable.get(s.key),durable,'durable unchanged synchronously');
  s.control.release?.();await s.backend.flush();assert.equal(s.control.attempts.length,puts,'failed candidate never starts a put');
  assert.equal((await freshStatus(s,f)).status,'active','fresh durable hydration still holds the active deal');
  assert.equal(s.e.save(),true);await s.backend.flush();
  const rec=await freshStatus(s,f);assert.equal(rec.status,'active','a later healthy save cannot resurrect the failed Exit');
  assert.equal(rec.personalCash,before.personalCash);assert.equal(rec.distributed,find(before,f).fund.distributed);
  assert.equal(s.modules.finance.validate(clone(s.e.g)).ok,true);
  console.log(`PE portfolio exit ${route} ${method} ${kind}${pending?' / pending':''} PASS`);
}
async function normal(f,route,method){
  const a=await setup(f),b=await setup(f),before=clone(a.e.g);
  assert.equal(run(a,f,method,route),true);assert.equal(run(b,f,method,route),true);
  const stable=g=>{const x=clone(g);delete x.lastSaveDate;return x;};
  assert.deepEqual(stable(a.e.g),stable(b.e.g),'deterministic replay (wall-clock save date excluded)');
  const{fund,deal}=find(a.e.g,f),old=find(before,f);
  assert.equal(deal.status,'exited');assert.ok(a.e.g.personalCash>=before.personalCash);assert.ok(fund.distributed>old.fund.distributed);
  assert.equal(a.e.g.companyCash,before.companyCash,'company cash untouched');
  assert.deepEqual(clone(a.e.g.simulationRng),before.simulationRng,'no RNG consumed');
  assert.equal(a.modules.finance.validate(clone(a.e.g)).ok,true);
  await a.backend.flush();assert.equal((await freshStatus(a,f)).status,'exited','committed Exit is durable');
  assert.equal(run(a,f,method,route),false,'duplicate Exit refused');
  console.log(`PE portfolio exit ${route} ${method} normal PASS`);
}
(async()=>{
  const f=makeFixture();
  for(const route of ['engine','adapter'])for(const method of ['sale','ipo']){
    await normal(f,route,method);
    for(const kind of ['save-false','mirror','save-throw'])await faulted(f,route,method,kind,false);
  }
  for(const method of ['sale','ipo']){
    for(const kind of ['enqueue-false','enqueue-throw','saved','change'])await faulted(f,'engine',method,kind,false);
    for(const kind of ['save-false','save-throw','change'])await faulted(f,'engine',method,kind,true);
  }
  console.log('PE portfolio exit save atomicity tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
