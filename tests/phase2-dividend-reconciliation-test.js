'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const plain=value=>JSON.parse(JSON.stringify(value));
const money=value=>Math.round(value*100)/100;
// Match the permanent reload gate: save wall-clock metadata is outside simulation state.
const simulation=value=>{const copy=plain(value);delete copy.lastSaveDate;return copy;};
function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};}
function setup(seed=0x52300001,{founderShares=300000,treasury=100000}={}){
  const loaded=loadGame({headless:true,random:lcg(seed)}),finance=loaded.modules.finance;
  const game=new loaded.engineModule.TycoonEngine();
  game.configure({playerName:'P2 Dividend',companyName:'P2 Dividend Co',difficulty:'normal',scenario:'free',simulationSeed:seed});
  Object.assign(game.g,{week:12,companyCash:500000000,companyDebt:0,publicCompany:true,sharesOut:1000000,founderShares,treasuryBuybackShares:treasury,stockPrice:100,ticker:'CPTY'});
  game.g.market=game.g.market.filter(row=>row.id!=='CPTY');
  game.g.market.push({id:'CPTY',name:game.g.companyName,sector:'コングロマリット',price:100,previous:100,dividendYield:0,volatility:0,trend:0,marketCap:100000000,per:20,pbr:2,issuedShares:1000000,dividendPerShare:0,shareholders:{},description:'test',listingMarket:'東証グロース',priceHistory:[{week:12,price:100}]});
  game.updateOwnershipRatios();game.g.finance=finance.defaultFinanceState(game.g);game.g.finance.ledgerCoverageVersion=finance.LEDGER_COVERAGE_VERSION;finance.ensureFinance(game.g);
  return {loaded,finance,game};
}
function status(finance,game){const result=finance.dividendReconciliationStatus(game.g);assert.equal(result.ok,true,JSON.stringify(result,null,2));return result;}
function pay(fixture,amount=.123456789){assert.equal(fixture.game.setDividend(amount),true);assert.equal(fixture.game.advanceWeek(false),true);return fixture.game.g.finance.transactions.find(row=>row.category==='dividend'&&row.week===13);}

// The full production composition preserves the existing economic outcome while proving each leg.
for(const ownership of [{founderShares:300000,treasury:100000},{founderShares:0,treasury:0},{founderShares:1000000,treasury:0}]){
  const paid=setup(0x52300001,ownership),control=setup(0x52300001,ownership),row=pay(paid);
  assert.equal(control.game.advanceWeek(false),true);
  const d=row.dividendDistribution,raw=d.evidence.gross;
  assert.equal(d.gross,money(.123456789*(1000000-ownership.treasury)),'treasury shares receive no dividend');
  assert.equal(d.payerReduction,d.gross);
  assert.equal(money(control.game.g.companyCash-paid.game.g.companyCash),d.gross);
  assert.equal(money(paid.game.g.personalCash-control.game.g.personalCash),d.personalNet);
  assert.equal(d.personalNet,money(raw*d.founderRatio*.797));
  assert.equal(d.withholding,money(raw*d.founderRatio*(1-.797)));
  assert.equal(d.externalGross,money(raw*(1-d.founderRatio)));
  assert.equal(money(d.personalNet+d.withholding+d.externalGross+d.roundingResidual),d.gross);
  assert.equal(row.profitEffect,0);
  assert.equal(paid.game.g.lastReport.profit,control.game.g.lastReport.profit);
  assert.deepEqual(plain(paid.game.g.simulationRng),plain(control.game.g.simulationRng),'observation consumes no RNG');
  const a=paid.finance.buildStatements(paid.game.g,'52'),b=control.finance.buildStatements(control.game.g,'52');
  assert.equal(money(b.balanceSheet.equity.retainedEarnings-a.balanceSheet.equity.retainedEarnings),d.gross);
  assert.equal(a.cashFlow.dividend,-d.gross);
  assert.equal(status(paid.finance,paid.game).metrics.paymentCount,1);
  assert.equal(paid.finance.standaloneClose(paid.game.g).ok,true);
  assert.equal(paid.finance.validate(paid.game.g).ok,true);
}

// At least one fractional entitlement exercises the signed, explicitly calculated cent residual.
{
  const f=setup(0x52300002);let perShare;
  for(let cents=1;cents<200;cents++){
    const total=cents/100,founder=total/3;
    if(money(money(total)-money(founder*.797)-money(founder*(1-.797))-money(total-founder))!==0){perShare=total/900000;break;}
  }
  assert.ok(perShare);
  const row=pay(f,perShare);assert.equal(Math.abs(row.dividendDistribution.roundingResidual),.01);
  status(f.finance,f.game);
}

// Reposting the same current operation is an idempotent no-op; another ID for that week fails.
{
  const f=setup(0x52300003),row=pay(f),before=JSON.stringify(f.game.g.finance);
  const opts={...plain(row),dividendDistribution:plain(row.dividendDistribution.evidence)};
  assert.equal(f.finance.event(f.game.g,'dividend',row.amount,opts),null);
  assert.equal(JSON.stringify(f.game.g.finance),before);
  assert.throws(()=>f.finance.event(f.game.g,'dividend',row.amount,{...opts,transactionID:'duplicate-dividend',operationID:'duplicate-dividend',idempotencyKey:'duplicate-dividend'}),/P2-DIVIDEND-DUPLICATE/);
  assert.equal(JSON.stringify(f.game.g.finance),before);
}

// Save/reload and all quota compaction profiles retain cumulative evidence after row archival.
{
  const f=setup(0x52300004),row=pay(f);f.game.save();
  const saved=JSON.parse(f.loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
  const reload=new f.loaded.engineModule.TycoonEngine(saved);
  assert.equal(reload.g.saveVersion,9);assert.deepEqual(plain(status(f.finance,reload)),plain(status(f.finance,f.game)));
  f.game.g.week=1040;
  for(const profile of ['normal','emergency','critical']){
    const compact=f.loaded.modules.saveStorage.compactStateForStorage(f.game.g,profile).state;
    assert.equal(compact.finance.transactions.some(tx=>tx.transactionID===row.transactionID),false);
    assert.equal(compact.finance.archivedDividendTotal,row.amount);
    const restored=new f.loaded.engineModule.TycoonEngine(compact);
    assert.deepEqual(plain(status(f.finance,restored).metrics),plain(status(f.finance,f.game).metrics));
    const before=JSON.stringify(restored.g.finance);
    assert.throws(()=>f.finance.event(restored.g,'dividend',row.amount,{...plain(row),dividendDistribution:plain(row.dividendDistribution.evidence)}),/P2-DIVIDEND-DUPLICATE/);
    assert.equal(JSON.stringify(restored.g.finance),before,'archived payment cannot be recognized again');
  }
}

// Runtime's 5000-row compactor also preserves conservation and archived idempotency.
{
  const f=setup(0x52300010),row=pay(f);f.game.g.week=1040;
  for(let i=0;i<5001;i++)f.game.g.finance.transactions.push({transactionID:`filler-${i}`,id:`filler-${i}`,week:20+Math.floor(i/100),category:'otherOperating',amount:0,cashEffect:0,profitEffect:0});
  f.finance.event(f.game.g,'otherOperating',0,{operationID:'compaction-trigger'});
  assert.equal(f.game.g.finance.transactions.some(tx=>tx.transactionID===row.transactionID),false);
  assert.equal(f.game.g.finance.archivedDividendTotal,row.amount);status(f.finance,f.game);
}

// Owning own ticker in a portfolio cannot cause a second founder/company dividend credit.
{
  const f=setup(0x52300011),control=setup(0x52300011);
  for(const x of [f,control]){
    x.game.g.personalStocks.CPTY={qty:300000,avg:100};
    x.game.g.companyStocks.CPTY={qty:100000,avg:100};
    x.game.g.finance=x.finance.defaultFinanceState(x.game.g);x.finance.ensureFinance(x.game.g);
  }
  const row=pay(f);assert.equal(control.game.advanceWeek(false),true);
  assert.equal(money(f.game.g.personalCash-control.game.g.personalCash),row.dividendDistribution.personalNet);
  assert.equal(f.game.g.lastReport.stockIncome,control.game.g.lastReport.stockIncome);
  assert.equal(status(f.finance,f.game).metrics.paymentCount,1);
}

// An old v9 save adopts its historic total without inventing historic recipient receipts.
{
  const f=setup(0x52300005),row=pay(f),legacy=plain(f.game.g);
  delete legacy.finance.dividendReconciliation;
  for(const tx of legacy.finance.transactions)delete tx.dividendDistribution;
  const oldCash=legacy.companyCash,oldPersonal=legacy.personalCash;
  const restored=new f.loaded.engineModule.TycoonEngine(legacy);
  assert.equal(restored.g.companyCash,oldCash);assert.equal(restored.g.personalCash,oldPersonal);
  assert.equal(status(f.finance,restored).metrics.openingDividendTotal,row.amount);
  assert.equal(status(f.finance,restored).metrics.paymentCount,0);
  while(restored.g.week<26)assert.equal(restored.advanceWeek(false),true);
  assert.equal(status(f.finance,restored).metrics.paymentCount,1);
  assert.equal(restored.g.finance.transactions.filter(tx=>tx.category==='dividend'&&tx.week===26).length,1);
}

// Repeated quarterly recognition closes identically after a mid-run save/reload fork.
{
  const f=setup(0x52300012);assert.equal(f.game.setDividend(.123456789),true);
  while(f.game.g.week<52)assert.equal(f.game.advanceWeek(false),true);
  const restored=new f.loaded.engineModule.TycoonEngine(plain(f.game.g));
  while(f.game.g.week<104){
    assert.equal(f.game.advanceWeek(false),true);assert.equal(restored.advanceWeek(false),true);
    assert.deepEqual(plain(status(f.finance,restored)),plain(status(f.finance,f.game)));
  }
  assert.deepEqual(simulation(restored.g),simulation(f.game.g),'dividend evidence, economics and RNG replay exactly');
  assert.equal(status(f.finance,f.game).metrics.paymentCount,8);
}

// Capacity capping is retained, and zero declarations never create a material distribution.
{
  const f=setup(0x52300006);assert.equal(f.game.setDividend(100),true);
  f.game.g.companyCash=20000000;f.game.g.finance=f.finance.defaultFinanceState(f.game.g);
  assert.equal(f.game.advanceWeek(false),true);
  const paid=f.game.g.lastReport.dividend;assert.ok(paid>0&&paid<90000000);
  assert.equal(status(f.finance,f.game).metrics.grossPaid,money(paid));
  assert.equal(f.game.g.dividendPerShare,100,'declaration is restored');
  const zero=setup(0x52300007);assert.equal(zero.game.advanceWeek(false),true);
  assert.equal(status(zero.finance,zero.game).metrics.paymentCount,0);
}

// Actual payer/recipient mismatches abort the entire production week and preserve durable bytes.
for(const field of ['payerCashAfter','personalCashAfter','gross']){
  const f=setup(0x52300008);assert.equal(f.game.setDividend(1),true);f.game.save();
  const before=JSON.stringify(f.game.g),saved=f.loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1');
  const base=f.finance.recordWeekly;let reached=false;
  f.finance.recordWeekly=function(g,ctx){if(ctx.dividendDistribution){reached=true;ctx.dividendDistribution[field]+=.02;}return base(g,ctx);};
  assert.throws(()=>f.game.advanceWeek(false),/P2-DIVIDEND-/);
  assert.equal(reached,true);assert.equal(JSON.stringify(f.game.g),before);
  assert.equal(f.loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1'),saved);
}

// Missing recognition cannot hide inside the older five-cent weekly cash envelope.
{
  const f=setup(0x52300015);assert.equal(f.game.setDividend(.01/900000),true);f.game.save();
  const before=JSON.stringify(f.game.g),saved=f.loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1');
  const base=f.finance.recordWeekly;
  f.finance.recordWeekly=function(g,ctx){if(ctx.dividendDistribution)delete ctx.other.dividend;return base(g,ctx);};
  assert.throws(()=>f.game.advanceWeek(false),/P2-DIVIDEND-PENDING/);
  assert.equal(JSON.stringify(f.game.g),before);assert.equal(f.loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1'),saved);
}

// Persisted drift, missing/new receipts and non-finite diagnostic state are fail-closed.
for(const mutate of [
  g=>{g.finance.dividendReconciliation.personalNet+=.02;},
  g=>{g.finance.dividendReconciliation.payerReduction+=.02;},
  g=>{g.finance.dividendReconciliation.grossPaid+=.02;},
  g=>{g.finance.dividendReconciliation.withholding=NaN;},
  g=>{g.finance.dividendReconciliation.personalNet=Infinity;},
  g=>{g.finance.dividendReconciliation=null;},
  g=>{g.finance.dividendReconciliation.paymentCount=.5;},
  g=>{g.finance.dividendReconciliation.externalGross=-1;},
  g=>{g.finance.transactions.find(tx=>tx.category==='dividend').profitEffect=-.02;},
  g=>{delete g.finance.transactions.find(tx=>tx.category==='dividend').dividendDistribution;},
  g=>{g.finance.transactions.find(tx=>tx.category==='dividend').dividendDistribution.evidence.personalCashAfter+=.02;}
]){
  const f=setup(0x52300009);pay(f);mutate(f.game.g);
  assert.equal(f.finance.dividendReconciliationStatus(f.game.g).ok,false);
  assert.equal(f.finance.standaloneClose(f.game.g).ok,false);
  assert.equal(f.finance.validate(f.game.g).ok,false);
}
// Corrupt accumulator values cannot be sanitized away by a subsequent payment.
{
  const f=setup(0x52300013);assert.equal(f.game.setDividend(1),true);
  // Persisted non-finite JSON values arrive as null; live NaN/Infinity are tested above.
  f.game.g.finance.dividendReconciliation.withholding=null;
  const before=JSON.stringify(f.game.g);
  assert.throws(()=>f.game.advanceWeek(false),/P2-DIVIDEND-FINITE/);
  assert.equal(JSON.stringify(f.game.g),before);
  assert.equal(f.finance.dividendReconciliationStatus(f.game.g).ok,false);
  assert.equal(f.game.g.week,12);
}
console.log('Phase 2 dividend reconciliation tests passed');
