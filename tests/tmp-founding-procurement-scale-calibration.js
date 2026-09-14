'use strict';

// Temporary calibration only. Rewrites the checked-out js/supply.js in this runner before loading
// the production harness, so inventory book value, cash payments and consumed COGS all see the same
// candidate chain procurement discount. Nothing here is production code.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const cap=Number(process.env.CHAIN_DISCOUNT_CAP||0);
const perStore=Number(process.env.CHAIN_DISCOUNT_PER_STORE||0);
const supplyPath=path.join(__dirname,'..','js','supply.js');
let source=fs.readFileSync(supplyPath,'utf8');
const needle="const mult=n(c?.agreedPriceMultiplier,s.priceMultiplier)*(opts.isEmergency?s.spotPurchasePremium+1:1);";
assert.ok(source.includes(needle),'expected supply createOrder multiplier anchor');
const replacement=`const openChainStores=(g.stores||[]).filter(row=>row.businessID===st.businessID&&row.status==='open').length;const chainProcurementDiscount=st.businessID==='ramen'?Math.min(${cap},Math.max(0,openChainStores-1)*${perStore}):0;const mult=n(c?.agreedPriceMultiplier,s.priceMultiplier)*(1-chainProcurementDiscount)*(opts.isEmergency?s.spotPurchasePremium+1:1);`;
source=source.replace(needle,replacement);
fs.writeFileSync(supplyPath,source);

const {loadGame}=require('./harness');
const SEED=190826041;
function lcg(seed=SEED){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2**32;};}
function tenantPool(engine,businessID){const free=engine.g.tenants.filter(t=>!t.occupiedBy);const matching=free.filter(t=>t.businessID===businessID);return (matching.length?matching:free).sort((a,b)=>b.traffic-a.traffic||String(a.id).localeCompare(String(b.id)));}
function plannedFinancing(engine,businessID,tenant){const business=engine.business(businessID),cost=business.storeCost+tenant.deposit,cash=engine.g.companyCash;if(cash>=cost)return{affordable:true,cost,ordinaryBorrow:0};const ordinaryCapacity=Math.max(0,engine.companyCreditLimit()-engine.g.companyDebt),ordinaryBorrow=Math.min(cost-cash,ordinaryCapacity),cashAfterOrdinary=cash+ordinaryBorrow;if(cashAfterOrdinary>=cost)return{affordable:true,cost,ordinaryBorrow};const savedCash=engine.g.companyCash;engine.g.companyCash=cashAfterOrdinary;const estimate=engine.estimateStoreOpening({tenantID:tenant.id,businessID,operatingHours:3});engine.g.companyCash=savedCash;return estimate?.affordable?{affordable:true,cost,ordinaryBorrow}:{affordable:false,cost,ordinaryBorrow:0};}
function bestAffordableTenant(engine,businessID){for(const tenant of tenantPool(engine,businessID)){const plan=plannedFinancing(engine,businessID,tenant);if(plan.affordable)return{tenant,plan};}return null;}
function tryOpenStore(engine,businessID){const found=bestAffordableTenant(engine,businessID);if(!found)return false;if(found.plan.ordinaryBorrow>0&&engine.borrow(Math.ceil(found.plan.ordinaryBorrow),'company')!==true)return false;return engine.openStore({tenantID:found.tenant.id,businessID,name:`${businessID}-${engine.g.stores.length+1}`,operatingHours:3})===true;}
function last8AvgProfit(engine){const h=engine.g.weeklyProfitHistory.slice(-8);return h.length?h.reduce((a,n)=>a+n,0)/h.length:0;}
function run({allowExpansion=true,maxWeeks=500}){const {ctx}=loadGame({random:lcg(),headless:true}),engine=new ctx.__ct_headlessEngineClass();engine.save=()=>{};engine.configure({playerName:'Tester',companyName:'Ramen Co',difficulty:'normal',scenario:'free'});engine.g.skipWeeklyValidation=true;const b=engine.business('ramen');const master={price:b.price,unitCost:b.unitCost,demand:b.demand,storeCost:b.storeCost,fixedCost:b.fixedCost,brand:b.brand};const firstStoreOpened=tryOpenStore(engine,'ramen');let weekReached1B=null,minCash=engine.g.companyCash;const openingWeeks=firstStoreOpened?[engine.g.week]:[];while(engine.g.week<maxWeeks&&!engine.g.gameOver){engine.advanceWeek(false);minCash=Math.min(minCash,engine.g.companyCash);if(weekReached1B===null&&engine.companyValue()>=1e9)weekReached1B=engine.g.week;if(allowExpansion&&engine.g.week%4===0&&last8AvgProfit(engine)>0){const tenant=tenantPool(engine,'ramen')[0];if(tenant){const nextCost=engine.business('ramen').storeCost+tenant.deposit;if(engine.g.companyCash>nextCost*3){const before=engine.g.stores.length;if(tryOpenStore(engine,'ramen')&&engine.g.stores.length>before)openingWeeks.push(engine.g.week);}}}}return{cap,perStore,allowExpansion,...master,week:engine.g.week,weekReached1B,firstStoreOpened,gameOver:engine.g.gameOver,companyValue:engine.companyValue(),companyCash:engine.g.companyCash,companyDebt:engine.g.companyDebt,storeCount:engine.g.stores.filter(s=>s.businessID==='ramen').length,avgProfitLast8:last8AvgProfit(engine),minCash,openingWeeks};}
const expanded=run({allowExpansion:true});
const oneStore=run({allowExpansion:false});
console.log(`FOUNDING_RAMEN_PROCUREMENT_SCALE ${JSON.stringify(expanded)}`);
console.log(`FOUNDING_RAMEN_PROCUREMENT_ONE_STORE ${JSON.stringify(oneStore)}`);
assert.equal(expanded.firstStoreOpened,true);
assert.equal(expanded.gameOver,false);
assert.equal(oneStore.firstStoreOpened,true);
assert.equal(oneStore.gameOver,false);
