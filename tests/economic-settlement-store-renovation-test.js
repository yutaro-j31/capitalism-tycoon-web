'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');

const settlementSource=fs.readFileSync(path.join(__dirname,'..','js','economic-settlement.js'),'utf8');
const storeSource=fs.readFileSync(path.join(__dirname,'..','js','store-equipment.js'),'utf8');
const renovateStart=storeSource.indexOf('function renovate(engine,storeID){');
const renovateEnd=storeSource.indexOf('\nfunction operatingHoursOf',renovateStart);
assert(renovateStart>=0&&renovateEnd>renovateStart,'renovate source boundary must exist');
const renovateSource=storeSource.slice(renovateStart,renovateEnd);

for(const [label,pattern] of [
  ['host RNG',/Math\.random\s*\(/],
  ['wall clock',/Date\.now\s*\(/],
  ['simulation RNG',/simulationRng/],
  ['finance event',/finance\.event\s*\(/],
  ['save call',/\.save\s*\(/],
  ['emit call',/\.emit\s*\(/],
  ['personal cash',/personalCash/],
  ['company debt',/companyDebt/],
  ['ownership writer',/(?:founderShares|sharesOut|treasuryBuybackShares)\s*=/]
]){
  assert.equal(pattern.test(settlementSource),false,`economic settlement must not depend on ${label}`);
}
assert.equal((settlementSource.match(/state\.companyCash\s*=/g)||[]).length,1,'limited settlement module has one companyCash mutation');
assert.equal(/state\.companyCash\s*[-+*/]?=/.test(renovateSource),false,'legacy renovate path must not write companyCash directly');
assert.match(renovateSource,/economicSettlement\.settleStoreRenovation\(/);
assert.match(renovateSource,/operationID:operation\.operationId/);
assert.match(renovateSource,/idempotencyKey:operation\.idempotencyKey/);
assert.match(renovateSource,/engine\.runTransaction\(/);

function lcg(seed=883){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};}
function newGame(seed=883){
  const loaded=loadGame({random:lcg(seed)});
  const engine=loaded.ctx.__ct_engine;
  engine.g.companyCash=500_000_000;
  engine.g.finance=loaded.modules.finance.defaultFinanceState(engine.g);
  return {loaded,modules:loaded.modules,ctx:loaded.ctx,engine};
}
function openRamenStore(engine){
  const tenant=engine.g.tenants.find(t=>!t.occupiedBy&&t.businessID==='ramen')
    ||engine.g.tenants.find(t=>!t.occupiedBy);
  assert.ok(tenant,'a free tenant must exist');
  assert.notEqual(engine.openStore({tenantID:tenant.id,businessID:'ramen',name:'P1-4改装店',operatingHours:3}),false);
  const store=engine.g.stores[engine.g.stores.length-1];
  store.status='open';
  return store;
}

{
  const {modules,engine}=newGame();
  const settlement=modules.economicSettlement;
  assert.ok(settlement,'economicSettlement must load in production');
  assert.equal(settlement.STORE_RENOVATION_OPERATION_TYPE,'company:store-renovation');
  assert.equal(settlement.PLAYER_COMPANY_ENTITY_ID,modules.economicReadModel.PLAYER_COMPANY_ENTITY_ID);

  const store=openRamenStore(engine);
  store.condition=40;
  const cost=modules.storeEquipment.renovationCost(store);
  const op=settlement.buildStoreRenovationOperation(engine.g,store,cost);
  const validation=modules.economicOperation.validateOperation(op);
  assert.equal(validation.ok,true,JSON.stringify(validation.errors));
  assert.equal(op.status,'committed');
  assert.equal(op.operationType,'company:store-renovation');
  assert.equal(op.idempotencyKey,op.operationId);
  assert.equal(op.decisionPeriod,engine.g.week);
  assert.equal(op.recognitionPeriod,engine.g.week);
  assert.equal(op.settlementPeriod,engine.g.week);
  assert.equal(op.effectivePeriod,engine.g.week);
  assert.deepEqual(Array.from(op.postings).map(row=>[row.accountId,row.side,row.amount]),[
    ['expense:operating','debit',cost],
    ['asset:cash','credit',cost]
  ]);

  const same=settlement.buildStoreRenovationOperation(engine.g,store,cost);
  assert.equal(JSON.stringify(same),JSON.stringify(op),'same inputs must build the same operation');
  const laterState={...engine.g,week:engine.g.week+1};
  const later=settlement.buildStoreRenovationOperation(laterState,store,cost);
  assert.notEqual(later.operationId,op.operationId,'period changes operation identity');

  const probe={companyCash:cost+123,untouched:'yes'};
  const result=settlement.settleStoreRenovation(probe,op);
  assert.equal(result.applied,true);
  assert.equal(result.amount,cost);
  assert.equal(result.companyCashBefore,cost+123);
  assert.equal(result.companyCashAfter,123);
  assert.deepEqual(probe,{companyCash:123,untouched:'yes'},'settlement mutates companyCash only');

  const wrongType=JSON.parse(JSON.stringify(op));
  wrongType.operationType='company:other';
  assert.throws(()=>settlement.settleStoreRenovation({companyCash:cost+1},wrongType),/Unsupported EconomicOperation type/);

  const wrongAccount=JSON.parse(JSON.stringify(op));
  wrongAccount.postings[0].accountId='expense:interest';
  assert.equal(modules.economicOperation.validateOperation(wrongAccount).ok,true);
  assert.throws(()=>settlement.settleStoreRenovation({companyCash:cost+1},wrongAccount),/debit posting shape is invalid/);

  const wrongEntity=JSON.parse(JSON.stringify(op));
  wrongEntity.postings.forEach(row=>{row.entityId='entity:company:other';});
  assert.equal(modules.economicOperation.validateOperation(wrongEntity).ok,true);
  assert.throws(()=>settlement.settleStoreRenovation({companyCash:cost+1},wrongEntity),/debit posting shape is invalid/);

  assert.throws(()=>settlement.settleStoreRenovation({companyCash:cost-1},op),/Insufficient company cash/);
}

// Production action: Economic Core writes cash, finance is projection only.
{
  const {modules,engine}=newGame(884);
  const store=openRamenStore(engine);
  store.condition=40;
  const cashBefore=engine.g.companyCash;
  const cost=modules.storeEquipment.renovationCost(store);
  const expectedOp=modules.economicSettlement.buildStoreRenovationOperation(engine.g,store,cost);
  const txBefore=engine.g.finance.transactions.length;

  assert.equal(engine.renovateStore(store.id),true);
  assert.equal(engine.g.companyCash,cashBefore-cost);
  assert.equal(store.condition,modules.storeEquipment.FULL_CONDITION);

  const rows=engine.g.finance.transactions.slice(txBefore).filter(row=>row.sourceType==='storeRenovation');
  assert.equal(rows.length,1,'legacy accounting projection is written once');
  const row=rows[0];
  assert.equal(row.operationID,expectedOp.operationId);
  assert.equal(row.idempotencyKey,expectedOp.idempotencyKey);
  assert.equal(row.cashEffect,-cost);
  assert.equal(row.profitEffect,-cost);
  assert.equal(row.amount,cost);
  assert.equal(row.storeID,store.id);
  assert.equal(modules.finance.validate(engine.g).ok,true,JSON.stringify(modules.finance.validate(engine.g).errors));

  // Transitional P1-4 replay receipt: if domain state is made stale but the persisted
  // projection receipt exists, the authoritative settlement must not charge cash twice.
  store.condition=40;
  const cashAfterFirst=engine.g.companyCash;
  const rowCount=engine.g.finance.transactions.length;
  assert.equal(engine.renovateStore(store.id),false,'existing projection receipt blocks duplicate settlement');
  assert.equal(engine.g.companyCash,cashAfterFirst);
  assert.equal(engine.g.finance.transactions.length,rowCount);
}

// Projection failure after settlement must roll the complete action back.
{
  const {modules,ctx,engine}=newGame(885);
  const store=openRamenStore(engine);
  store.condition=40;
  engine.save();
  const stateBefore=JSON.stringify(engine.g);
  const savedBefore=ctx.__localStorageData.get('capitalism_tycoon_web_v1');
  const originalEvent=modules.finance.event;
  modules.finance.event=function(){throw new Error('synthetic renovation projection failure');};
  try{
    assert.throws(()=>engine.renovateStore(store.id),/synthetic renovation projection failure/);
  }finally{
    modules.finance.event=originalEvent;
  }
  assert.equal(JSON.stringify(engine.g),stateBefore,'cash, condition and finance state roll back exactly');
  assert.equal(ctx.__localStorageData.get('capitalism_tycoon_web_v1'),savedBefore,'failed cutover action does not overwrite the save');
}

// Save/reload keeps v9 and the projection receipt, without a new Economic Core save root.
{
  const {modules,ctx,engine}=newGame(886);
  const store=openRamenStore(engine);
  store.condition=55;
  const cost=modules.storeEquipment.renovationCost(store);
  const before=engine.g.companyCash;
  assert.equal(engine.renovateStore(store.id),true);
  const saved=JSON.parse(ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
  assert.equal(saved.saveVersion,9);
  assert.equal(saved.companyCash,before-cost);
  assert.equal(saved.stores.find(row=>row.id===store.id).condition,100);
  assert.equal(Object.prototype.hasOwnProperty.call(saved,'economicJournal'),false,'P1-4 does not add a persisted journal root');
  assert.ok(saved.finance.transactions.some(row=>row.sourceType==='storeRenovation'&&row.idempotencyKey),'projection receipt persists');

  const reloaded=modules.engine.TycoonEngine.load();
  const reloadedStore=reloaded.g.stores.find(row=>row.id===store.id);
  assert.equal(reloadedStore.condition,100);
  assert.equal(reloaded.g.companyCash,before-cost);
  assert.ok(reloaded.g.finance.transactions.some(row=>row.sourceType==='storeRenovation'&&row.idempotencyKey));
}

console.log('economic settlement store renovation tests passed');
