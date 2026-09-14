'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const SEED=190826107;
function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2**32;};}
function run(){
  const {ctx,modules}=loadGame({random:lcg(SEED),headless:true});
  const e=new ctx.__ct_headlessEngineClass();e.save=()=>{};e.emit=()=>{};
  e.configure({playerName:'Tester',companyName:'RE Co',difficulty:'normal',scenario:'free'});e.g.skipWeeklyValidation=true;e.g.seed=SEED;
  const available=e.g.tenants.filter(t=>!t.occupiedBy).sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id)));
  const tenant=available.find(t=>t.businessID==='realEstateAgency')||available[0];
  assert.ok(tenant,'an available founding tenant exists');
  assert.equal(e.openStore({tenantID:tenant.id,businessID:'realEstateAgency',name:'RE-1',operatingHours:3}),true,'first brokerage store opens');
  const store=e.g.stores.at(-1);let firstClose=null;
  for(let i=0;i<52&&!e.g.gameOver;i++){
    e.advanceWeek(false);
    const row=store.brokeragePipeline?.lastWeek;
    if(row?.closedDeals>0&&firstClose===null)firstClose=e.g.week;
    const check=modules.finance.validate(e.g);assert.equal(check.ok,true,check.errors.join('\n'));
  }
  return {gameOver:e.g.gameOver,week:e.g.week,firstClose,foundingDeals:modules.realEstateAgencyPipeline.FOUNDING_INITIAL_DEALS,closedDeals:store.brokeragePipeline?.totals?.closedDeals||0,commissionRevenue:store.brokeragePipeline?.totals?.commissionRevenue||0,companyCash:e.g.companyCash,companyDebt:e.g.companyDebt,activeDeals:store.brokeragePipeline?.activeDeals?.length||0};
}
const a=run(),b=run();
assert.equal(a.foundingDeals,4,'founding brokerage pipeline seeds exactly four existing mandates');
assert.equal(a.gameOver,false,'historically failing founding seed survives the first year');
assert.ok(a.firstClose!==null&&a.firstClose<=13,`first close arrives within startup runway: ${JSON.stringify(a)}`);
assert.ok(a.closedDeals>0&&a.commissionRevenue>0,'normal pipeline closes and commission revenue remain reachable');
assert.deepEqual(a,b,'founding route is deterministic for the same seed and actions');
console.log(JSON.stringify(a));
