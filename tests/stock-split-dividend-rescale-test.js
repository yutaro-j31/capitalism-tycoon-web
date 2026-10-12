'use strict';
// A stock split must leave every holder's quarterly dividend total unchanged: the per-share
// dividend is divided by the split ratio. Uses the production stockSplit, setDividend and the
// installed advanceWeek dividend path (engine weekly close + shareholder-returns payment week).
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {scenario,economic,snapshot,assertSplit}=require('./fixtures/stock-split-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const EXT_DPS=30,OWN_DPS=6,TOLERANCE=1e-6;
const finance=loadGame({headless:true}).modules.finance;
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=TOLERANCE*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);
async function dividendScenario(family){
 const s=await scenario(family);
 s.game.stock('EXT').dividendPerShare=EXT_DPS;
 assert.equal(s.game.setDividend(OWN_DPS),true,'production dividend declaration');
 await s.backend.flush();
 return s;
}
function totals(state){
 const own=state.market.find(x=>x.id==='CPTY'),ext=state.market.find(x=>x.id==='EXT');
 return {
  ownDeclared:state.dividendPerShare*Math.max(0,state.sharesOut-state.treasuryBuybackShares),
  ownMarket:own.dividendPerShare*own.issuedShares,
  extIssued:ext.dividendPerShare*ext.issuedShares,
  companyExt:state.companyStocks.EXT.qty*ext.dividendPerShare,
  personalExt:state.personalStocks.EXT.qty*ext.dividendPerShare,
 };
}
function assertTotalsPreserved(before,after,label){
 const a=totals(before),b=totals(after);
 for(const key of Object.keys(a))close(b[key],a[key],`${label} ${key} sharesBefore*dpsBefore==sharesAfter*dpsAfter`);
}
function assertSplitSideEffects(before,after,stockID,ratio,label){
 assertSplit(before,after,stockID,ratio);
 const prior=before.market.find(x=>x.id===stockID),stock=after.market.find(x=>x.id===stockID);
 close(stock.dividendPerShare,prior.dividendPerShare/ratio,`${label} market dividendPerShare`);
 assert.equal(stock.dividendYield,prior.dividendYield,`${label} dividend yield unchanged`);
 close(after.dividendPerShare,before.dividendPerShare/(stockID==='CPTY'?ratio:1),`${label} declared dividendPerShare`);
 assert.equal(after.founderOwnershipRatio,before.founderOwnershipRatio,`${label} founder ownership ratio`);
 for(const key of ['externalShareholderRatio','competitorOwnedRatio'])assert.equal(after[key],before[key],`${label} ${key}`);
 assert.deepEqual(after.shareholderReturns,before.shareholderReturns,`${label} dividend policy/history untouched`);
}
async function payWeek(game){
 const state=game.g,personalCash=state.personalCash,companyCash=state.companyCash,week=state.week;
 assert.equal((week+1)%13,0,'fixture advances into a dividend payment week');
 assert.notEqual(game.advanceWeek(false),false,'week commits');
 const report=state.lastReport;
 assert.equal(report.week,week+1);
 const validation=finance.validate(snapshot(game));assert.equal(validation.ok,true,`finance ledger valid after dividend week: ${JSON.stringify(validation.errors||validation.reasons||'')}`);
 return {personal:state.personalCash-personalCash,company:state.companyCash-companyCash,dividend:report.dividend,stockIncome:report.stockIncome};
}
function assertPayment(actual,expected,label){
 for(const key of ['personal','company','dividend','stockIncome'])close(actual[key],expected[key],`${label} ${key}`);
}
async function loaded(s,expected){
 const wanted=economic(new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected))).g);
 const reloaded=s.engineModule.TycoonEngine.load();
 assert.deepEqual(economic(reloaded.g),wanted,'production reload');
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 const hydrated=fresh.engineModule.TycoonEngine.load();
 assert.deepEqual(economic(hydrated.g),wanted,'fresh durable-only hydration');await fresh.modules.saveStorageIDB.flush();
 return {reloaded,fresh,hydrated};
}
let baselineCache;
async function baseline(){
 if(!baselineCache){const s=await dividendScenario('external');baselineCache={state:snapshot(s.game),payment:await payWeek(s.game)};}
 return baselineCache;
}
async function splitAndPay(family,ratios){
 const s=await dividendScenario(family),base=await baseline(),start=snapshot(s.game);
 assert.equal(start.dividendPerShare,OWN_DPS);assert.equal(start.market.find(x=>x.id==='EXT').dividendPerShare,EXT_DPS);
 for(const ratio of ratios){
  const before=snapshot(s.game),draws=s.host.draws;
  assert.equal(s.game.stockSplit(s.stockID,ratio),true);
  const after=snapshot(s.game);
  assertSplitSideEffects(before,after,s.stockID,ratio,`${family} 1:${ratio}`);
  assertTotalsPreserved(before,after,`${family} 1:${ratio}`);
  assert.equal(s.host.draws,draws,'split consumes no RNG');
 }
 assertTotalsPreserved(start,snapshot(s.game),`${family} ${ratios.join('x')} cumulative`);
 const factor=ratios.reduce((a,b)=>a*b,1);
 close(s.game.stock(s.stockID).dividendPerShare,(s.stockID==='CPTY'?OWN_DPS:EXT_DPS)/factor,'cumulative dividendPerShare');
 await s.backend.flush();
 const {reloaded,hydrated}=await loaded(s,s.game.g);
 // Weekly dividend cash, ledger and report match the never-split baseline for the live engine,
 // the production reload and a fresh durable-only IDB hydration.
 assertPayment(await payWeek(s.game),base.payment,`${family} ${ratios.join('x')} live`);
 assertPayment(await payWeek(reloaded),base.payment,`${family} ${ratios.join('x')} reload`);
 assertPayment(await payWeek(hydrated),base.payment,`${family} ${ratios.join('x')} fresh hydration`);
 console.log(`stockSplit dividend ${family} ratios=${ratios.join(',')} totals/payment/reload/hydration PASS`);
}
async function tradesAfterSplit(family){
 const s=await dividendScenario(family);
 assert.equal(s.game.stockSplit('EXT',2),true);
 for(const account of ['company','personal']){assert.equal(s.game.buyStock('EXT',1000,account),true);assert.equal(s.game.sellStock('EXT',400,account),true);}
 const state=s.game.g,dps=s.game.stock('EXT').dividendPerShare;
 close(dps,EXT_DPS/2,'post-split EXT dividendPerShare');
 const companyQty=state.companyStocks.EXT.qty,personalQty=state.personalStocks.EXT.qty;
 const payment=await payWeek(s.game);
 // Company account income is booked as stockIncome; external dividend income is only EXT here.
 close(payment.stockIncome,companyQty*dps,'company dividend uses post-split dps for post-split trades');
 const base=await baseline();
 close(payment.personal-base.payment.personal,(personalQty*dps-base.state.personalStocks.EXT.qty*EXT_DPS)*.797,'personal dividend uses post-split dps for post-split trades');
 assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true);
 console.log(`stockSplit dividend ${family} trades-after-split PASS`);
}
function fault(s,kind){
 if(kind!=='save-before-throw')return inject(s.game,s.modules,s.ctx.localStorage,s.key,kind);
 const save=s.game.save;let hits=0;s.game.save=()=>{hits++;throw new Error('save before admission threw');};
 return {hits:()=>hits,restore(){s.game.save=save;}};
}
async function rejected(family,kind,{pending=false,nested=false}={}){
 const s=await dividendScenario(family);
 if(pending){s.control.holdPut=true;assert.equal(s.game.save(),true);for(let i=0;i<100&&!s.control.release;i++)await new Promise(r=>setImmediate(r));assert.equal(typeof s.control.release,'function');}
 const before=snapshot(s.game),bytes=s.backend.readSync(s.key),durable=s.durable.get(s.key),puts=s.control.attempts.length,draws=s.host.draws;
 const injection=fault(s,kind);let result,error;
 try{result=nested?s.game.runTransaction(()=>s.game.stockSplit(s.stockID,2)):s.game.stockSplit(s.stockID,2);}catch(ex){error=ex;}finally{injection.restore();}
 assert.ok(injection.hits()>0,'fault reaches installed writer');
 if(kind==='save-false'){assert.equal(result,false);assert.equal(error,undefined);}else assert.match(error?.message||'',/threw/);
 assert.deepEqual(snapshot(s.game),before,'failed split restores dividendPerShare with the rest of state');
 assert.equal(s.game.g.dividendPerShare,OWN_DPS);assert.equal(s.game.stock('EXT').dividendPerShare,EXT_DPS);assert.equal(s.game.stock('CPTY').dividendPerShare,OWN_DPS);
 assert.equal(s.host.draws,draws);
 assert.equal(s.ctx.__localStorageData.get(s.key),bytes);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.durable.get(s.key),durable);
 s.control.release?.();await s.backend.flush();
 assert.equal(s.durable.get(s.key),bytes,'predecessor preserved, failed split never durable');assert.equal(s.control.attempts.length,puts,'cancel failed pending put');
 await loaded(s,before);
 assert.equal(s.game.stockSplit(s.stockID,2),true,'failed split can retry');
 const after=snapshot(s.game);
 assertSplitSideEffects(before,after,s.stockID,2,`${family} retry after ${kind}`);assertTotalsPreserved(before,after,`${family} retry after ${kind}`);
 await s.backend.flush();const {hydrated}=await loaded(s,s.game.g);
 assertPayment(await payWeek(hydrated),(await baseline()).payment,`${family} retry after ${kind} hydrated payment`);
 console.log(`stockSplit dividend ${family}/${kind}/pending=${pending}/nested=${nested} rollback/retry PASS`);
}
async function legacyZeroDividend(){
 const s=await scenario('external');
 const ext=s.game.stock('EXT');delete ext.dividendPerShare;ext.dividendYield=.04;s.game.g.dividendPerShare=0;
 const before=snapshot(s.game);
 assert.equal(s.game.stockSplit('EXT',2),true);
 const after=snapshot(s.game),stock=after.market.find(x=>x.id==='EXT');
 assert.equal(Object.prototype.hasOwnProperty.call(stock,'dividendPerShare'),false,'missing dps is not invented');
 assert.equal(stock.dividendYield,.04);assert.equal(after.dividendPerShare,0);
 assertSplit(before,after,'EXT',2);
 console.log('stockSplit dividend legacy yield-only stock PASS');
}
(async()=>{
 for(const family of ['own','external'])for(const ratios of [[2],[3],[2,3]])await splitAndPay(family,ratios);
 for(const family of ['own','external'])await tradesAfterSplit(family);
 for(const family of ['own','external']){
  for(const kind of ['save-false','save-throw','save-before-throw'])for(const nested of [false,true])await rejected(family,kind,{nested});
  for(const kind of ['save-false','save-throw'])await rejected(family,kind,{pending:true});
 }
 await legacyZeroDividend();
 console.log('Stock split dividend rescale PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
