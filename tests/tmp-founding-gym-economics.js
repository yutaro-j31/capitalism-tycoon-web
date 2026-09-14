'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const PRICE=Number(process.env.GYM_PRICE||7800);
const SEED=190826041;
function lcg(seed=SEED){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2**32;};}
function last8AvgProfit(engine){const h=engine.g.weeklyProfitHistory.slice(-8);return h.length?h.reduce((a,n)=>a+n,0)/h.length:0;}
const {ctx}=loadGame({random:lcg(),headless:true});
const engine=new ctx.__ct_headlessEngineClass();engine.save=()=>{};
engine.configure({playerName:'Tester',companyName:'Gym Co',difficulty:'normal',scenario:'free'});
engine.g.skipWeeklyValidation=true;
const gym=engine.business('gym');gym.price=PRICE;
// Operating-economics calibration only: give enough equity cash to isolate mature store economics
// from startup financing. The final production route will test financing separately.
engine.g.companyCash=25_000_000;
const free=engine.g.tenants.filter(t=>!t.occupiedBy);const matching=free.filter(t=>t.businessID==='gym');
const tenant=(matching.length?matching:free).sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id)))[0];
assert.ok(tenant,'gym tenant required');
assert.equal(engine.openStore({tenantID:tenant.id,businessID:'gym',name:'Gym-1',operatingHours:3}),true);
let minCash=engine.g.companyCash;
while(engine.g.week<500&&!engine.g.gameOver){engine.advanceWeek(false);minCash=Math.min(minCash,engine.g.companyCash);}
const store=engine.g.stores.find(s=>s.businessID==='gym');
const result={price:PRICE,week:engine.g.week,gameOver:engine.g.gameOver,companyValue:engine.companyValue(),companyCash:engine.g.companyCash,minCash,avgProfitLast8:last8AvgProfit(engine),lastStoreProfit:store?.lastProfit??null,storeCount:engine.g.stores.filter(s=>s.businessID==='gym').length,gymMembership:store?.gymMembership||null};
console.log(`FOUNDING_GYM_ECONOMICS ${JSON.stringify(result)}`);
assert.equal(result.gameOver,false);
assert.equal(result.storeCount,1);
