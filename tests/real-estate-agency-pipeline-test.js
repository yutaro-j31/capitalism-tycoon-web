'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame,findStateIssues}=require('./harness');

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
{
  const mod=loadGame({headless:true}).modules.realEstateAgencyPipeline;
  assert.notEqual(mod.commissionRateForSide('single'),mod.commissionRateForSide('double'),'single and double brokerage must have distinct economics');
  assert.equal((mod.commissionRateForSide('single')+mod.commissionRateForSide('double'))/2,.06,'the expected blended yield preserves the calibrated 6% economics');
  assert.equal(mod.sideForDeal(123,'deal-1','store-1'),mod.sideForDeal(123,'deal-1','store-1'),'same seed and deal identity derives the same side');
  assert.ok(['single','double'].includes(mod.sideForDeal(123,'deal-1','store-1')),'derived side uses the supported schema');
  assert.deepEqual(Array.from(mod.SEGMENTS),['residential','luxury','investment','corporateDeal'],'deal segment schema exposes the four supported types without ratio-like suffixes');
  assert.equal(mod.segmentForDeal(123,'deal-1','store-1'),mod.segmentForDeal(123,'deal-1','store-1'),'same seed and deal identity derives the same segment');
  assert.ok(mod.SEGMENTS.includes(mod.segmentForDeal(123,'deal-1','store-1')),'derived segment uses the supported schema');
  assert.ok(mod.SEGMENT_CONFIG.residential.weight>mod.SEGMENT_CONFIG.luxury.weight,'general residential is more common than luxury');
  assert.notEqual(mod.SEGMENT_CONFIG.residential.valueMultiplier,mod.SEGMENT_CONFIG.corporateDeal.valueMultiplier,'segments have distinct transaction values');
  assert.notEqual(mod.SEGMENT_CONFIG.residential.closeMultiplier,mod.SEGMENT_CONFIG.luxury.closeMultiplier,'segments have distinct closing behavior');
}
{
  const pipeline=loadGame({headless:true}).modules.realEstateAgencyPipeline,open={businessID:'realEstateAgency',status:'open',brokeragePipeline:{activeDeals:[{}],capacity:10}},closed={businessID:'realEstateAgency',status:'closed',brokeragePipeline:{activeDeals:[{},{}],capacity:99}},preparing={businessID:'realEstateAgency',status:'preparing',brokeragePipeline:{activeDeals:[{}],capacity:88}};
  const eligible=pipeline.eligibleStores([open,closed,preparing]);
  assert.deepEqual(Array.from(eligible),[open],'weekly UI aggregation excludes stale closed and preparing stores');
  assert.equal(eligible.reduce((sum,store)=>sum+store.brokeragePipeline.activeDeals.length,0),1);
  assert.equal(eligible.reduce((sum,store)=>sum+store.brokeragePipeline.capacity,0),10);
  const appSource=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
  assert.match(appSource,/const eligible=__modules\.realEstateAgencyPipeline\?\.eligibleStores\(stores\)/,'business UI must derive one open-store set');
  assert.match(appSource,/active=eligible\.reduce[\s\S]*capacity=eligible\.reduce/,'active and capacity must use the same eligible stores');
  assert.match(appSource,/片手 \/ 両手[\s\S]*累計 片手 \/ 両手/,'business UI explains weekly and cumulative brokerage-side outcomes');
  assert.match(appSource,/案件タイプ（累計）[\s\S]*residential[\s\S]*luxury[\s\S]*investment[\s\S]*corporateDeal/,'business UI shows the cumulative segment mix');
}
const first=scenario(),pipelineModule=first.loaded.modules.realEstateAgencyPipeline,business=first.game.business('realEstateAgency'),pref=first.game.pref(first.store.prefID),before={companyCash:first.game.g.companyCash,personalCash:first.game.g.personalCash,personalDebt:first.game.g.personalDebt,corp:JSON.stringify(first.game.g.personalRealEstateCorp)};
let inquiries=0,closed=0,lost=0,volume=0,commission=0,singleClosed=0,doubleClosed=0,maxActive=0,week52=null;const segmentClosed={residential:0,luxury:0,investment:0,corporateDeal:0},segmentSeen=new Set(),crossSeen=new Set();
for(let i=0;i<208;i++){
  first.game.g.week++;const result=pipelineModule.processStore(first.game.g,first.store,business,pref),k=result.kpi;
  assert.ok(k&&Number.isFinite(k.inquiries),'weekly brokerage KPI exists');
  assert.equal(k.commissionRevenue,k.singleCommissionRevenue+k.doubleCommissionRevenue,'commission equals the per-side closed-deal fee totals');
  inquiries+=k.inquiries;closed+=k.closedDeals;lost+=k.lostDeals;volume+=k.closedTransactionVolume;commission+=k.commissionRevenue;singleClosed+=k.singleClosedDeals;doubleClosed+=k.doubleClosedDeals;
  for(const segment of pipelineModule.SEGMENTS)segmentClosed[segment]+=k.closedBySegment[segment];
  for(const deal of first.store.brokeragePipeline.activeDeals){segmentSeen.add(deal.segment);crossSeen.add(`${deal.segment}:${deal.side}`);}
  maxActive=Math.max(maxActive,first.store.brokeragePipeline.activeDeals.length);
  assert.equal(result.sales,k.commissionRevenue,'only commission is returned as store revenue');
  if(k.closedTransactionVolume>0)assert.notEqual(k.closedTransactionVolume,k.commissionRevenue,'gross transaction volume is not revenue');
  if(i===51)week52={inquiries,closed,lost,singleClosed,doubleClosed,closedTransactionVolume:volume,commissionRevenue:commission};
}
assert.ok(inquiries>0&&closed>0&&lost>0,'inquiries, closes, and losses are reachable');
assert.ok(singleClosed>0&&doubleClosed>0,'both brokerage sides are reachable over 208 weeks');
assert.equal(singleClosed+doubleClosed,closed,'side close counts reconcile to total closes');
assert.deepEqual(Array.from(segmentSeen).sort(),Array.from(pipelineModule.SEGMENTS).sort(),'all four deal segments are reachable over 208 weeks');
assert.equal(Object.values(segmentClosed).reduce((sum,value)=>sum+value,0),closed,'segment close counts reconcile to total closes');
assert.equal(Object.values(first.store.brokeragePipeline.totals.closedBySegment).reduce((sum,value)=>sum+value,0),first.store.brokeragePipeline.totals.closedDeals,'cumulative segment close counts reconcile to cumulative closes');
assert.deepEqual(findStateIssues(first.store.brokeragePipeline,'brokeragePipeline'),[],'segment totals do not collide with generic ratio invariants');
assert.ok(crossSeen.size>=6,'multiple segment and side combinations are independently reachable');
assert.ok(first.store.brokeragePipeline.activeDeals.every(deal=>['single','double'].includes(deal.side)),'every new active deal has a brokerage side');
assert.ok(first.store.brokeragePipeline.activeDeals.every(deal=>pipelineModule.SEGMENTS.includes(deal.segment)),'every new active deal has a segment');
assert.ok(maxActive<=first.store.brokeragePipeline.capacity,'pipeline is capacity bounded');
assert.ok(volume>commission&&commission>0,'commission is a fraction of transaction volume');
assert.deepEqual({companyCash:first.game.g.companyCash,personalCash:first.game.g.personalCash,personalDebt:first.game.g.personalDebt,corp:JSON.stringify(first.game.g.personalRealEstateCorp)},before,'pipeline statistics do not move company or personal cash directly');

first.game.save();const reloaded=first.loaded.engineModule.TycoonEngine.load();
assert.deepEqual(reloaded.g.stores.find(s=>s.id===first.store.id).brokeragePipeline,first.store.brokeragePipeline,'save/reload preserves pipeline');

const legacy=scenario(77);legacy.store.brokeragePipeline={activeDeals:[{id:'legacy-deal',storeID:legacy.store.id,createdWeek:legacy.game.g.week,askingValue:40_000_000},{id:'pr-development-deal',storeID:legacy.store.id,createdWeek:legacy.game.g.week,askingValue:50_000_000,segment:'corporate'}],totals:{closedBySegment:{corporate:2}}};
legacy.game.normalize();legacy.store=legacy.game.g.stores.find(s=>s.id===legacy.store.id);const legacySide=legacy.store.brokeragePipeline.activeDeals[0].side;
const legacySegment=legacy.store.brokeragePipeline.activeDeals[0].segment;
assert.ok(['single','double'].includes(legacySide),'old saves deterministically backfill a missing side');
assert.ok(legacy.loaded.modules.realEstateAgencyPipeline.SEGMENTS.includes(legacySegment),'old saves deterministically backfill a missing segment');
assert.equal(legacy.store.brokeragePipeline.activeDeals[1].segment,'corporateDeal','PR-development corporate segment normalizes to the collision-safe ID');
assert.equal(legacy.store.brokeragePipeline.totals.closedBySegment.corporateDeal,2,'PR-development corporate totals normalize to the collision-safe key');
legacy.game.normalize();assert.equal(legacy.store.brokeragePipeline.activeDeals[0].side,legacySide,'legacy side backfill is stable across normalization');
assert.equal(legacy.store.brokeragePipeline.activeDeals[0].segment,legacySegment,'legacy segment backfill is stable across normalization');
legacy.game.save();const legacyReloaded=legacy.loaded.engineModule.TycoonEngine.load();assert.equal(legacyReloaded.g.stores.find(s=>s.id===legacy.store.id).brokeragePipeline.activeDeals[0].side,legacySide,'legacy backfill survives save/reload');
assert.equal(legacyReloaded.g.stores.find(s=>s.id===legacy.store.id).brokeragePipeline.activeDeals[0].segment,legacySegment,'legacy segment backfill survives save/reload');

const economics=scenario(78);economics.game.g.week=10;economics.store.brokeragePipeline={activeDeals:[{id:'forced-single',storeID:economics.store.id,createdWeek:1,askingValue:40_000_000,side:'single'},{id:'forced-double',storeID:economics.store.id,createdWeek:1,askingValue:40_000_000,side:'double'}],totals:{}};
const economicsRow=economics.loaded.modules.realEstateAgencyPipeline.processStore(economics.game.g,economics.store,economics.game.business('realEstateAgency'),economics.game.pref(economics.store.prefID)).kpi;
assert.equal(economicsRow.commissionRevenue,economicsRow.singleCommissionRevenue+economicsRow.doubleCommissionRevenue,'weekly commission equals the sum of side-specific commissions');

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

console.log(JSON.stringify({week52,week208:{inquiries,closed,lost,singleClosed,doubleClosed,maxActive,closedTransactionVolume:volume,commissionRevenue:commission,closeRate:closed/inquiries}},null,2));
