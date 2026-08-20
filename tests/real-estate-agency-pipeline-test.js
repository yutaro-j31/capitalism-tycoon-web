'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

function lcg(seed=731){let value=seed>>>0;return()=>{value=(value*1664525+1013904223)>>>0;return value/2**32;};}
function scenario(seed=731){
  const loaded=loadGame({random:lcg(seed),headless:true});
  const game=new loaded.engineModule.TycoonEngine();
  game.configure({playerName:'Broker',companyName:'Pipeline Realty',difficulty:'normal',scenario:'free'});
  const business=game.business('realEstateAgency');
  Object.assign(business,{brand:35,quality:40,efficiency:38,dx:30});
  const tenant=game.g.tenants[0];
  game.g.companyCash=200_000_000;
  game.g.finance=loaded.modules.finance.defaultFinanceState(game.g);
  Object.assign(game.g.finance,{openingCash:game.g.companyCash,openingAssets:game.g.companyCash,openingEquity:game.g.companyCash,openingRetainedEarnings:game.g.companyCash});
  assert.equal(game.openStore({tenantID:tenant.id,businessID:business.id,name:'仲介本店'}),true);
  const store=game.g.stores.at(-1);Object.assign(store,{status:'open',openingWeek:game.g.week,weeksToOpen:0});
  return {loaded,game,store};
}

assert.ok(loadGame({headless:true}).modules.realEstateAgencyPipeline,'pipeline module is wired');
const first=scenario(),pipelineModule=first.loaded.modules.realEstateAgencyPipeline,business=first.game.business('realEstateAgency'),pref=first.game.pref(first.store.prefID),before={companyCash:first.game.g.companyCash,personalCash:first.game.g.personalCash,personalDebt:first.game.g.personalDebt,corp:JSON.stringify(first.game.g.personalRealEstateCorp)};
let inquiries=0,closed=0,lost=0,volume=0,commission=0,maxActive=0;
for(let i=0;i<208;i++){
  first.game.g.week++;const result=pipelineModule.processStore(first.game.g,first.store,business,pref),k=result.kpi;
  assert.ok(k&&Number.isFinite(k.inquiries),'weekly brokerage KPI exists');
  inquiries+=k.inquiries;closed+=k.closedDeals;lost+=k.lostDeals;volume+=k.closedTransactionVolume;commission+=k.commissionRevenue;
  maxActive=Math.max(maxActive,first.store.brokeragePipeline.activeDeals.length);
  assert.equal(result.sales,k.commissionRevenue,'only commission is returned as store revenue');
  if(k.closedTransactionVolume>0)assert.notEqual(k.closedTransactionVolume,k.commissionRevenue,'gross transaction volume is not revenue');
}
assert.ok(inquiries>0&&closed>0&&lost>0,'inquiries, closes, and losses are reachable');
assert.ok(maxActive<=first.store.brokeragePipeline.capacity,'pipeline is capacity bounded');
assert.ok(volume>commission&&commission>0,'commission is a fraction of transaction volume');
assert.deepEqual({companyCash:first.game.g.companyCash,personalCash:first.game.g.personalCash,personalDebt:first.game.g.personalDebt,corp:JSON.stringify(first.game.g.personalRealEstateCorp)},before,'pipeline statistics do not move company or personal cash directly');

first.game.save();const reloaded=first.loaded.engineModule.TycoonEngine.load();
assert.deepEqual(reloaded.g.stores.find(s=>s.id===first.store.id).brokeragePipeline,first.store.brokeragePipeline,'save/reload preserves pipeline');

const malformed=scenario(91);malformed.store.brokeragePipeline={activeDeals:null,lastWeek:{inquiries:NaN},totals:'bad'};
assert.doesNotThrow(()=>malformed.game.normalize());
assert.doesNotThrow(()=>malformed.game.advanceWeek(false));
assert.ok(Array.isArray(malformed.game.g.stores.find(s=>s.id===malformed.store.id).brokeragePipeline.activeDeals));

const inactive=scenario(92);inactive.store.status='preparing';delete inactive.store.brokeragePipeline;
assert.equal(inactive.loaded.modules.realEstateAgencyPipeline.processStore(inactive.game.g,inactive.store,inactive.game.business('realEstateAgency'),inactive.game.pref(inactive.store.prefID)),null);assert.equal(inactive.store.brokeragePipeline,undefined,'inactive stores generate no pipeline');

const deterministicA=scenario(500),deterministicB={loaded:deterministicA.loaded,game:new deterministicA.loaded.engineModule.TycoonEngine(JSON.parse(JSON.stringify(deterministicA.game.g)))};deterministicB.store=deterministicB.game.g.stores.find(s=>s.id===deterministicA.store.id);
for(let i=0;i<52;i++){deterministicA.game.g.week++;deterministicB.game.g.week++;deterministicA.loaded.modules.realEstateAgencyPipeline.processStore(deterministicA.game.g,deterministicA.store,deterministicA.game.business('realEstateAgency'),deterministicA.game.pref(deterministicA.store.prefID));deterministicB.loaded.modules.realEstateAgencyPipeline.processStore(deterministicB.game.g,deterministicB.store,deterministicB.game.business('realEstateAgency'),deterministicB.game.pref(deterministicB.store.prefID));}
assert.deepEqual(deterministicA.store.brokeragePipeline,deterministicB.store.brokeragePipeline,'pipeline is deterministic');

function marketRun(cycle){const x=scenario(610);x.game.g.realEstateCycle=cycle;let q=0,v=0,c=0;for(let i=0;i<52;i++){x.game.g.week++;const row=x.loaded.modules.realEstateAgencyPipeline.processStore(x.game.g,x.store,x.game.business('realEstateAgency'),x.game.pref(x.store.prefID)).kpi;q+=row.inquiries;v+=row.closedTransactionVolume;c+=row.closedDeals;}return {inquiries:q,averageValue:c?v/c:0,closed:c};}
const boom=marketRun(1.4),recession=marketRun(.7);
assert.ok(boom.inquiries>recession.inquiries,'market cycle increases inquiry volume');
assert.ok(boom.averageValue>recession.averageValue,'market cycle increases transaction value');
assert.ok(boom.closed>recession.closed,'market cycle improves closing outcomes');

const accounting=scenario(811);accounting.game.g.founderHomeMonthlyCost=0;const accountBefore={personalCash:accounting.game.g.personalCash,personalDebt:accounting.game.g.personalDebt,corp:JSON.stringify(accounting.game.g.personalRealEstateCorp)};
for(let i=0;i<30;i++)accounting.game.advanceWeek(false);
const brokerageRows=accounting.game.g.finance.transactions.filter(t=>t.storeID===accounting.store.id&&t.sourceType==='weekly-store-revenue');
const bookedRevenue=brokerageRows.reduce((total,row)=>total+row.amount,0),bookedVolume=accounting.store.brokeragePipeline.totals.closedTransactionVolume;
assert.equal(bookedRevenue,accounting.store.brokeragePipeline.totals.commissionRevenue,'ledger books aggregate commission only');
assert.ok(bookedVolume>bookedRevenue,'ledger never books gross transaction volume as revenue');
assert.deepEqual({personalCash:accounting.game.g.personalCash,personalDebt:accounting.game.g.personalDebt,corp:JSON.stringify(accounting.game.g.personalRealEstateCorp)},accountBefore,'weekly accounting preserves personal accounts');
assert.equal(accounting.loaded.modules.finance.validate(accounting.game.g).ok,true,accounting.loaded.modules.finance.validate(accounting.game.g).errors.join('\n'));

console.log(JSON.stringify({weeks:208,inquiries,closed,lost,maxActive,closedTransactionVolume:volume,commissionRevenue:commission,closeRate:closed/inquiries},null,2));
