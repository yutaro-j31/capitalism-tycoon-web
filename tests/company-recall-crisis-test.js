'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadGame}=require('./harness');
function makeRandom(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/0x100000000;};}
function setup(seed=8801){
  const handles=loadGame({random:makeRandom(seed),isolatedLegacyIndex:true});
  const e=new handles.engineModule.TycoonEngine();
  e.configure({playerName:'Recall Test',companyName:'Recall Co',difficulty:'normal'});
  e.g.companyCash=300_000_000;e.g.companyReputation=60;
  const tenant=e.g.tenants.find(t=>t.businessID==='conveni'&&!t.occupiedBy);
  assert(tenant);assert.equal(e.openStore({tenantID:tenant.id,businessID:'conveni',name:'Recall Conveni'}),true);
  const store=e.g.stores.at(-1);store.status='open';store.openingWeek=e.g.week;store.weeksToOpen=0;store.condition=100;
  return {...handles,e,store,crisis:handles.modules.companyRecallCrisis};
}
{
  const base=setup(8802),untreated=setup(8802),responded=setup(8802);
  untreated.crisis.start(untreated.e.g,'conveni',untreated.e.g.week,{storeID:untreated.store.id});
  responded.crisis.start(responded.e.g,'conveni',responded.e.g.week,{storeID:responded.store.id});
  const responseCost=responded.crisis.responseCost(responded.e.g),cashBefore=responded.e.g.companyCash;
  assert.equal(responded.e.respondRecallCrisis(),true);assert.equal(responded.e.g.companyCash,cashBefore-responseCost);
  const txn=responded.e.g.finance.transactions.find(t=>t.sourceType==='companyRecallCrisis');
  assert(txn);assert.equal(txn.cashEffect,-responseCost);assert.equal(txn.profitEffect,-responseCost);
  base.e.advanceWeek(false);untreated.e.advanceWeek(false);responded.e.advanceWeek(false);
  assert(base.store.lastSales>0);
  assert(untreated.store.lastSales<responded.store.lastSales);
  assert(responded.store.lastSales<base.store.lastSales);
  assert(responded.e.g.activeRecallCrisis.resolveWeek<untreated.e.g.activeRecallCrisis.resolveWeek);
}
{
  const {e,store,crisis}=setup(8803);store.condition=40;e.g.week=103;
  const reputationBefore=e.g.companyReputation;
  assert.equal(crisis.prepareWeek(e.g,104),null,'本社を持たない創業ルートには自動リコールを発生させない');
  assert.equal(e.g.companyReputation,reputationBefore,'未成熟企業の通常劣化は会社危機として評判を毀損しない');
  e.g.hasHeadOffice=true;
  const started=crisis.prepareWeek(e.g,104);
  assert(started);assert.equal(started.startedWeek,104);assert.equal(started.storeID,store.id);assert(e.g.companyReputation<reputationBefore);
  assert.equal(e.g.recallCrisisHistory.filter(row=>row.type==='started').length,1);
  const resolveAt=started.resolveWeek+1;crisis.prepareWeek(e.g,resolveAt);assert.equal(e.g.activeRecallCrisis,null);
  e.g.week=resolveAt;store.condition=40;assert.equal(crisis.maybeTrigger(e.g,130),null);
}
{
  const {e,store,crisis}=setup(8804);crisis.start(e.g,'conveni',e.g.week,{storeID:store.id});
  const cost=crisis.responseCost(e.g);e.g.companyCash=cost-1;
  const before=JSON.stringify({cash:e.g.companyCash,crisis:e.g.activeRecallCrisis,tx:e.g.finance.transactions});
  assert.equal(e.respondRecallCrisis(),false);assert.equal(JSON.stringify({cash:e.g.companyCash,crisis:e.g.activeRecallCrisis,tx:e.g.finance.transactions}),before);
  e.g.companyCash=cost+10_000_000;assert.equal(e.respondRecallCrisis(),true);
  const cashAfter=e.g.companyCash,txAfter=e.g.finance.transactions.filter(t=>t.sourceType==='companyRecallCrisis').length;
  assert.equal(e.respondRecallCrisis(),false);assert.equal(e.g.companyCash,cashAfter);assert.equal(e.g.finance.transactions.filter(t=>t.sourceType==='companyRecallCrisis').length,txAfter);
}
{
  const {e,crisis}=setup(8805);delete e.g.activeRecallCrisis;delete e.g.recallCrisisHistory;delete e.g.companyRecallCrisisVersion;
  assert.doesNotThrow(()=>crisis.ensure(e.g));assert.equal(e.g.activeRecallCrisis,null);
  e.g.recallCrisisHistory=Array.from({length:50},(_,idx)=>({type:'resolved',week:idx+1}));crisis.ensure(e.g);
  assert.equal(e.g.recallCrisisHistory.length,crisis.HISTORY_LIMIT);assert.equal(crisis.validate(e.g).ok,true);
  const app=fs.readFileSync('js/app.js','utf8');assert.match(app,/data-company-recall-crisis/);assert.match(app,/respond-recall-crisis/);
  const source=fs.readFileSync('js/company-recall-crisis.js','utf8');assert.doesNotMatch(source,/Math\.random\(|Date\.now\(|randomUUID\(|uuid\(/);
}
{
  const {e,store,crisis}=setup(8806);
  store.condition=40;e.g.week=103;e.g.hasHeadOffice=false;
  for(const week of [104,117,130,143,156,169,182,195,208,221,234]){
    e.g.week=week-1;
    assert.equal(crisis.maybeTrigger(e.g,week),null,'本社なしの創業ルートは長期でも自動リコール対象外');
  }
  assert.equal(e.g.recallCrisisHistory.filter(row=>row.type==='started').length,0);
}

console.log('company recall crisis minimum-core tests passed');