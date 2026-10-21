'use strict';
// Track B / B2: economicSettlement.commitCompanyCashOperation pairs the authoritative company-cash
// settlement with its finance projection. It must admit an operation once, accept only the
// cut-over family, and throw (so runTransaction rolls everything back) whenever the settled cash,
// the operation identity or the projected ledger row disagree. It must never write cash itself.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');

const source=fs.readFileSync(path.join(__dirname,'..','js','economic-settlement.js'),'utf8');
const start=source.indexOf('function commitCompanyCashOperation(');
const end=source.indexOf('\nmodules.economicSettlement=',start);
assert(start>=0&&end>start,'commit boundary source must exist');
const commitSource=source.slice(start,end);
assert.equal(/companyCash\s*(?:[-+*/]?=(?!=)|\+\+|--)/.test(commitSource),false,'commit boundary must not write company cash');
assert.equal(/finance\.event\s*\(/.test(source),false,'settlement module must not record finance itself');

function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};}
function newGame(seed){
  const loaded=loadGame({random:lcg(seed)});
  const engine=loaded.ctx.__ct_engine;
  engine.g.companyCash=500_000_000;
  engine.g.finance=loaded.modules.finance.defaultFinanceState(engine.g);
  const tenant=engine.g.tenants.find(t=>!t.occupiedBy&&t.businessID==='ramen')||engine.g.tenants.find(t=>!t.occupiedBy);
  assert.notEqual(engine.openStore({tenantID:tenant.id,businessID:'ramen',name:'B2改装店',operatingHours:3}),false);
  const store=engine.g.stores[engine.g.stores.length-1];
  store.status='open';store.condition=40;
  return {modules:loaded.modules,ctx:loaded.ctx,engine,store};
}
function setup(seed){
  const game=newGame(seed),{modules,engine,store}=game,settlement=modules.economicSettlement;
  const cost=modules.storeEquipment.renovationCost(store);
  const operation=settlement.buildStoreRenovationOperation(engine.g,store,cost);
  const project=(overrides={})=>()=>modules.finance.event(engine.g,'otherOperating',cost,{
    cashEffect:-cost,profitEffect:-cost,businessID:store.businessID,storeID:store.id,sourceType:'storeRenovation',
    sourceID:store.id,operationID:operation.operationId,idempotencyKey:operation.idempotencyKey,description:'B2',...overrides});
  const settle=()=>settlement.settleStoreRenovation(engine.g,operation);
  return {...game,settlement,cost,operation,project,settle};
}

// Happy path: one cash movement, one matching ledger row, a receipt carrying the transaction ID.
{
  const {modules,engine,settlement,cost,operation,project,settle}=setup(901);
  const before=engine.g.companyCash,rows=engine.g.finance.transactions.length;
  const receipt=settlement.commitCompanyCashOperation(engine.g,operation,settle,project());
  assert.equal(receipt.applied,true);
  assert.equal(receipt.operationId,operation.operationId);
  assert.equal(receipt.companyCashBefore,before);
  assert.equal(receipt.companyCashAfter,before-cost);
  assert.equal(engine.g.companyCash,before-cost);
  assert.equal(engine.g.finance.transactions.length,rows+1);
  const row=engine.g.finance.transactions.at(-1);
  assert.equal(receipt.transactionID,row.transactionID);
  assert.equal(row.cashEffect,-cost);
  assert.equal(modules.finance.validate(engine.g).ok,true);
  assert.ok(Object.isFrozen(receipt));
  // Admitted once: a second commit of the same operation is refused before any cash moves.
  const cash=engine.g.companyCash;
  assert.throws(()=>settlement.commitCompanyCashOperation(engine.g,operation,settle,project()),/already projected/);
  assert.equal(engine.g.companyCash,cash);
}

// Every disagreement throws. The caller's transaction is responsible for rollback.
{
  const {settlement,engine,operation,project,settle,cost}=setup(902);
  assert.throws(()=>settlement.commitCompanyCashOperation(engine.g,{...operation,operationType:'company:other'},settle,project()),/Unsupported EconomicOperation type/);
  assert.throws(()=>settlement.commitCompanyCashOperation(engine.g,operation,settle),/requires settlement and projection/);
  assert.throws(()=>settlement.commitCompanyCashOperation(engine.g,operation,null,project()),/requires settlement and projection/);
  assert.throws(()=>settlement.commitCompanyCashOperation(null,operation,settle,project()),/state must be an object/);
  const fresh=()=>setup(902);
  {
    const t=fresh();
    assert.throws(()=>t.settlement.commitCompanyCashOperation(t.engine.g,t.operation,()=>({...t.settle(),operationId:'other'}),t.project()),/receipt does not match/);
  }
  {
    const t=fresh();
    assert.throws(()=>t.settlement.commitCompanyCashOperation(t.engine.g,t.operation,()=>{const r=t.settle();t.engine.g.companyCash-=1;return r;},t.project()),/does not match the EconomicOperation postings/);
  }
  {
    const t=fresh();
    assert.throws(()=>t.settlement.commitCompanyCashOperation(t.engine.g,t.operation,t.settle,t.project({cashEffect:-(t.cost-1)})),/cash effect does not match/);
  }
  {
    const t=fresh();
    assert.throws(()=>t.settlement.commitCompanyCashOperation(t.engine.g,t.operation,t.settle,t.project({operationID:'other-op',idempotencyKey:'other-key'})),/did not record the EconomicOperation identity/);
  }
  {
    const t=fresh();
    assert.throws(()=>t.settlement.commitCompanyCashOperation(t.engine.g,t.operation,t.settle,()=>null),/did not record the EconomicOperation identity/);
  }
  {
    const t=fresh();
    assert.throws(()=>t.settlement.commitCompanyCashOperation(t.engine.g,t.operation,t.settle,()=>{const row=t.project()();t.engine.g.companyCash+=1;return row;}),/must not change company cash/);
  }
  assert.ok(cost>0);
}

// Production action: a mismatching projection inside renovateStore rolls cash, condition,
// finance and the save back exactly, and the retry then commits once.
{
  const {modules,ctx,engine,store,cost}=setup(903);
  engine.save();
  const before=JSON.stringify(engine.g),saved=ctx.__localStorageData.get('capitalism_tycoon_web_v1');
  const original=modules.finance.event;
  modules.finance.event=function(g,category,amount,opts){return original.call(this,g,category,amount,{...opts,cashEffect:opts.cashEffect+1});};
  try{assert.throws(()=>engine.renovateStore(store.id),/cash effect does not match/);}finally{modules.finance.event=original;}
  assert.equal(JSON.stringify(engine.g),before,'cash, condition and finance roll back exactly');
  assert.equal(ctx.__localStorageData.get('capitalism_tycoon_web_v1'),saved,'a rejected commit does not overwrite the save');
  const cash=engine.g.companyCash;
  assert.equal(engine.renovateStore(store.id),true);
  assert.equal(engine.g.companyCash,cash-cost);
  assert.equal(store.condition,modules.storeEquipment.FULL_CONDITION);
  assert.equal(engine.g.finance.transactions.filter(row=>row.sourceType==='storeRenovation').length,1);
  assert.equal(JSON.parse(ctx.localStorage.getItem('capitalism_tycoon_web_v1')).saveVersion,9);
}

// A late-game balance beyond the cent-exact envelope (> MAX_SAFE_INTEGER/100) still commits:
// only the operation-sized delta is quantized, never the whole balance.
{
  const {engine,store,cost}=setup(905);
  engine.g.companyCash=1e15+0.5;
  assert.ok(engine.g.companyCash>Number.MAX_SAFE_INTEGER/100);
  assert.equal(engine.renovateStore(store.id),true);
  assert.equal(engine.g.companyCash,1e15+0.5-cost);
  assert.equal(engine.g.finance.transactions.filter(row=>row.sourceType==='storeRenovation').at(-1).cashEffect,-cost);
}

// Deterministic: the same seed and action produce the same state (save wall-clock stamp excluded).
{
  const run=()=>{const t=setup(904);assert.equal(t.engine.renovateStore(t.store.id),true);return JSON.stringify({...t.engine.g,lastSaveDate:null});};
  assert.equal(run(),run());
}

console.log('economic settlement company cash commit tests passed');
