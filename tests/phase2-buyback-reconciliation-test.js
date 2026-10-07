'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

const plain=value=>JSON.parse(JSON.stringify(value));
const money=value=>Math.round(Number(value)*100)/100;
function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};}

function setup(seed=0x52400001,{founderShares=300000,competitorOwnedRatio=0,price=100,treasury=0,companyCash=500000000}={}){
  const loaded=loadGame({headless:true,random:lcg(seed)}),finance=loaded.modules.finance;
  const game=new loaded.engineModule.TycoonEngine();
  game.configure({playerName:'P2 Buyback',companyName:'P2 Buyback Co',difficulty:'normal',scenario:'free',simulationSeed:seed});
  Object.assign(game.g,{week:12,companyCash,companyDebt:0,publicCompany:true,sharesOut:1000000,founderShares,treasuryBuybackShares:treasury,competitorOwnedRatio,stockPrice:price,ticker:'CPTY'});
  game.g.market=game.g.market.filter(row=>row.id!=='CPTY');
  game.g.market.push({id:'CPTY',name:game.g.companyName,sector:'コングロマリット',price,previous:price,dividendYield:0,volatility:0,trend:0,marketCap:price*1000000,per:20,pbr:2,issuedShares:1000000,dividendPerShare:0,shareholders:{},description:'test',listingMarket:'東証グロース',priceHistory:[{week:12,price}]});
  game.updateOwnershipRatios();
  game.g.finance=finance.defaultFinanceState(game.g);
  finance.ensureFinance(game.g);
  return {loaded,finance,game};
}
function status(f){const result=f.finance.buybackReconciliationStatus(f.game.g);assert.equal(result.ok,true,JSON.stringify(result,null,2));return result;}
function buybackRow(f){return f.game.g.finance.transactions.filter(row=>row?.buybackReconciliation).at(-1);}

// Canonical buyback reconciles cash, treasury/outstanding shares, ownership, treasury book and stock mirror.
{
  const f=setup(0x52400001,{founderShares:300000,competitorOwnedRatio:.1}),g=f.game.g;
  const cashBefore=g.companyCash,treasuryBefore=g.treasuryBuybackShares,outstandingBefore=g.sharesOut-g.treasuryBuybackShares,founderBefore=g.founderOwnershipRatio,externalBefore=g.externalShareholderRatio,rngBefore=plain(g.simulationRng);
  assert.equal(f.game.buybackOwnShares(10_000_000),true);
  const row=buybackRow(f),receipt=row.buybackReconciliation;
  assert.ok(row&&receipt,'buyback receives a reconciliation receipt');
  assert.equal(row.category,'otherFinancing');
  assert.equal(row.sourceType,'shareholderReturns');
  assert.equal(row.profitEffect,0);
  assert.equal(row.cashEffect,-10_000_000);
  assert.equal(row.equityEffect,-10_000_000);
  assert.equal(g.companyCash,cashBefore-10_000_000);
  assert.equal(g.treasuryBuybackShares,treasuryBefore+100000);
  assert.equal(g.sharesOut,1000000,'issued shares do not change');
  assert.equal(g.sharesOut-g.treasuryBuybackShares,outstandingBefore-100000);
  assert.equal(g.finance.balances.treasuryStock,10_000_000);
  assert.ok(g.founderOwnershipRatio>founderBefore);
  assert.ok(g.externalShareholderRatio<externalBefore);
  assert.ok(Math.abs(g.founderOwnershipRatio-300000/900000)<1e-12);
  assert.ok(Math.abs(g.externalShareholderRatio-(1-300000/900000-.1))<1e-12);
  assert.equal(g.market.find(x=>x.id==='CPTY').issuedShares,g.sharesOut);
  assert.equal(g.market.find(x=>x.id==='CPTY').price,g.stockPrice);
  assert.deepEqual(plain(g.simulationRng),rngBefore,'buyback reconciliation consumes no RNG');
  const s=status(f);
  assert.equal(s.metrics.recognizedCost,10_000_000);
  assert.equal(s.metrics.recognizedShares,100000);
  assert.equal(s.metrics.recognitionCount,1);
  assert.equal(f.finance.standaloneClose(g).ok,true);
  assert.equal(f.finance.validate(g).ok,true,f.finance.validate(g).errors.join(' / '));
}

// Fractional stock prices still recognize quantity x execution price at cent precision.
{
  const f=setup(0x52400002,{price:123.4567});
  const before=f.game.g.companyCash;
  assert.equal(f.game.buybackOwnShares(1_000_000),true);
  const row=buybackRow(f),receipt=row.buybackReconciliation,qty=Math.floor(1_000_000/123.4567),expected=money(qty*123.4567);
  assert.equal(receipt.quantity,qty);
  assert.equal(receipt.cost,expected);
  assert.equal(row.amount,expected);
  assert.equal(row.cashEffect,-expected);
  assert.equal(money(before-f.game.g.companyCash),expected);
  status(f);
}

// The existing external-share cap is preserved: a large safe request can only retire non-founder shares.
{
  const f=setup(0x52400003,{founderShares:600000,price:100});
  assert.equal(f.game.buybackOwnShares(100_000_000),true);
  const row=buybackRow(f);
  assert.equal(row.buybackReconciliation.quantity,400000);
  assert.equal(f.game.g.treasuryBuybackShares,400000);
  assert.equal(f.game.g.sharesOut-f.game.g.treasuryBuybackShares,600000);
  assert.equal(f.game.g.founderOwnershipRatio,1);
  assert.equal(f.game.g.externalShareholderRatio,0);
  status(f);
}

// P2-4 preserves the legacy competitor/founder ownership model rather than adding a new
// eligibility restriction when external ownership clamps at zero.
{
  const f=setup(0x52400017,{founderShares:600000,competitorOwnedRatio:.25,price:100});
  assert.equal(f.game.buybackOwnShares(40_000_000),true);
  assert.equal(f.game.g.founderOwnershipRatio,1);
  assert.equal(f.game.g.externalShareholderRatio,0);
  assert.equal(f.game.g.competitorOwnedRatio,.25);
  status(f);
}

// Multiple valid buybacks in one week remain distinct and reconcile cumulatively.
{
  const f=setup(0x52400004);
  assert.equal(f.game.buybackOwnShares(5_000_000),true);
  assert.equal(f.game.buybackOwnShares(5_000_000),true);
  const rows=f.game.g.finance.transactions.filter(row=>row?.buybackReconciliation);
  assert.equal(rows.length,2);
  assert.notEqual(rows[0].idempotencyKey,rows[1].idempotencyKey);
  const s=status(f);
  assert.equal(s.metrics.recognitionCount,2);
  assert.equal(s.metrics.recognizedShares,rows.reduce((sum,row)=>sum+row.buybackReconciliation.quantity,0));
  assert.equal(s.metrics.recognizedCost,money(rows.reduce((sum,row)=>sum+row.buybackReconciliation.cost,0)));
}

// Same seed/state/action produces identical receipt and economic post-state without consuming RNG.
{
  const a=setup(0x52400018),b=setup(0x52400018);
  assert.equal(a.game.buybackOwnShares(3_000_000),true);
  assert.equal(b.game.buybackOwnShares(3_000_000),true);
  const ar=plain(buybackRow(a).buybackReconciliation),br=plain(buybackRow(b).buybackReconciliation);
  assert.deepEqual(ar,br);
  assert.deepEqual({
    cash:a.game.g.companyCash,treasury:a.game.g.treasuryBuybackShares,shares:a.game.g.sharesOut,
    founder:a.game.g.founderOwnershipRatio,external:a.game.g.externalShareholderRatio,price:a.game.g.stockPrice,
    rng:plain(a.game.g.simulationRng),book:a.game.g.finance.balances.treasuryStock
  },{
    cash:b.game.g.companyCash,treasury:b.game.g.treasuryBuybackShares,shares:b.game.g.sharesOut,
    founder:b.game.g.founderOwnershipRatio,external:b.game.g.externalShareholderRatio,price:b.game.g.stockPrice,
    rng:plain(b.game.g.simulationRng),book:b.game.g.finance.balances.treasuryStock
  });
}

// Save/reload retains the forward reconciliation state exactly.
{
  const f=setup(0x52400005);
  assert.equal(f.game.buybackOwnShares(7_500_000),true);
  const before=plain(status(f));
  const restored=new f.loaded.engineModule.TycoonEngine(plain(f.game.g));
  const after=f.finance.buybackReconciliationStatus(restored.g);
  assert.deepEqual(plain(after),before);
  assert.equal(restored.g.saveVersion,9);
}

// A later stock split changes treasury/outstanding share counts without changing buyback cost/book evidence.
// P2-4 must not claim ownership of that separate capital-action writer.
{
  const f=setup(0x52400016);
  assert.equal(f.game.buybackOwnShares(2_000_000),true);
  const before=status(f);
  f.game.stock('CPTY').priceHistory=[];
  assert.equal(f.game.stockSplit('CPTY',2),true);
  const after=f.finance.buybackReconciliationStatus(f.game.g);
  assert.equal(after.ok,true,JSON.stringify(after,null,2));
  assert.equal(after.metrics.recognizedCost,before.metrics.recognizedCost);
  assert.equal(after.metrics.recognizedShares,before.metrics.recognizedShares);
  assert.equal(f.game.g.finance.balances.treasuryStock,before.metrics.recognizedCost);
}

// Old saveVersion-9 state adopts existing historical buyback balances without pretending to reconstruct receipts.
{
  const f=setup(0x52400006),g=f.game.g,book=f.finance.ensureFinance(g),cost=10_000_000,qty=100000;
  g.companyCash-=cost;g.treasuryBuybackShares+=qty;book.balances.treasuryStock+=cost;
  const legacyRow=f.finance.event(g,'otherFinancing',cost,{cashEffect:-cost,profitEffect:0,equityEffect:-cost,sourceType:'legacy-buyback-adoption',sourceID:'legacy-buyback',idempotencyKey:'legacy-buyback',description:'legacy buyback'});
  legacyRow.sourceType='shareholderReturns';legacyRow.sourceID='buyback-12-100000';legacyRow.idempotencyKey='shareholder-buyback-12-100000';
  const own=f.game.stock(g.ticker);g.stockPrice=100*(1+Math.min(.08,qty/g.sharesOut*.8));own.price=g.stockPrice;own.marketCap=own.price*g.sharesOut;own.issuedShares=g.sharesOut;f.game.updateOwnershipRatios();
  f.finance.rebuildSnapshotForWeek(g,g.week);
  delete g.finance.buybackReconciliation;
  const restored=new f.loaded.engineModule.TycoonEngine(plain(g));
  const adopted=f.finance.buybackReconciliationStatus(restored.g);
  assert.equal(adopted.ok,true,JSON.stringify(adopted,null,2));
  assert.equal(adopted.metrics.recognizedCost,0);
  assert.equal(adopted.metrics.recognizedShares,0);
  assert.equal(adopted.metrics.treasuryShares,100000);
  assert.equal(restored.buybackOwnShares(1_000_000),true);
  assert.equal(f.finance.buybackReconciliationStatus(restored.g).metrics.recognitionCount,1);
}

// Runtime ledger compaction may archive the row, but the bounded accumulator retains exact evidence totals.
{
  const f=setup(0x52400007),g=f.game.g;
  assert.equal(f.game.buybackOwnShares(2_000_000),true);
  const row=buybackRow(f),expectedCost=row.buybackReconciliation.cost,expectedShares=row.buybackReconciliation.quantity;
  g.week=1040;
  for(let i=0;i<5001;i++)g.finance.transactions.push({id:`filler-${i}`,transactionID:`filler-${i}`,operationID:`filler-${i}`,idempotencyKey:null,week:20+Math.floor(i/100),fiscalYear:1,fiscalQuarter:1,category:'otherOperating',amount:0,cashEffect:0,profitEffect:0,assetEffect:0,liabilityEffect:0,equityEffect:0,businessID:null,storeID:null,sourceType:'test',sourceID:`filler-${i}`,receivableAmount:0,payableAmount:0,accruedExpenseAmount:0,description:'filler',inventoryAmount:0});
  f.finance.event(g,'otherOperating',0,{sourceType:'compaction-trigger',sourceID:'trigger'});
  assert.equal(g.finance.transactions.some(tx=>tx.transactionID===row.transactionID),false);
  const s=status(f);
  assert.equal(s.metrics.recognizedCost,expectedCost);
  assert.equal(s.metrics.recognizedShares,expectedShares);
  assert.equal(g.finance.buybackReconciliation.archivedCount,1);
  const replay={cashEffect:row.cashEffect,profitEffect:0,equityEffect:row.equityEffect,sourceType:row.sourceType,sourceID:row.sourceID,idempotencyKey:row.idempotencyKey,operationID:row.operationID,buybackReconciliation:plain(row.buybackReconciliation.evidence)};
  assert.throws(()=>f.finance.event(g,'otherFinancing',row.amount,replay),/P2-BUYBACK-IDEMPOTENCY/,'archived key cannot replay in a later week');
  assert.throws(()=>f.finance.event(g,'otherFinancing',row.amount,{...replay,week:row.week}),/P2-BUYBACK-IDEMPOTENCY/,'forcing the historic week cannot bypass current-week replay protection');
  assert.equal(status(f).metrics.recognitionCount,1);
}

// A replay of a live recognized buyback is rejected rather than silently double-recognized.
{
  const f=setup(0x52400008);
  assert.equal(f.game.buybackOwnShares(1_000_000),true);
  const row=buybackRow(f),before=JSON.stringify(f.game.g.finance);
  assert.throws(()=>f.finance.event(f.game.g,'otherFinancing',row.amount,{cashEffect:row.cashEffect,profitEffect:0,equityEffect:row.equityEffect,sourceType:row.sourceType,sourceID:row.sourceID,idempotencyKey:row.idempotencyKey,operationID:row.operationID,buybackReconciliation:plain(row.buybackReconciliation.evidence)}),/P2-BUYBACK-DUPLICATE/);
  assert.equal(JSON.stringify(f.game.g.finance),before);
}

// Corrupted evidence fails inside the existing transaction boundary and rolls every state/save mutation back.
function rollbackCase(seed,mutate,pattern=/P2-BUYBACK-/){
  const f=setup(seed);
  // buyback() performs its safe-capacity statement build before entering runTransaction.
  // Warm that read/cache boundary so this assertion measures transaction rollback only.
  f.game.shareholderReturnCapacity();f.game.save();
  const before=JSON.stringify(f.game.g),saved=f.loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1'),base=f.finance.event;
  f.finance.event=function(g,category,amount,opts={}){
    if(opts.buybackReconciliation){
      opts={...opts,buybackReconciliation:{...opts.buybackReconciliation}};
      mutate(opts.buybackReconciliation);
    }
    return base(g,category,amount,opts);
  };
  try{assert.throws(()=>f.game.buybackOwnShares(1_000_000),pattern);}
  finally{f.finance.event=base;}
  assert.equal(JSON.stringify(f.game.g),before);
  assert.equal(f.loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1'),saved);
}
rollbackCase(0x52400010,e=>{e.companyCashAfter+=.02;});
rollbackCase(0x52400011,e=>{e.treasurySharesAfter+=1;});
rollbackCase(0x52400012,e=>{e.issuedSharesAfter+=1;});
rollbackCase(0x52400013,e=>{e.founderOwnershipAfter+=.01;});
rollbackCase(0x52400014,e=>{e.stockMirrorPriceAfter+=.02;});
rollbackCase(0x52400015,e=>{e.cost=Infinity;});
rollbackCase(0x52400019,e=>{e.quantity+=1;});
rollbackCase(0x5240001a,e=>{e.executionPrice+=.02;});
rollbackCase(0x5240001b,e=>{e.treasuryBookAfter+=.02;});

// Missing reconciliation evidence is also fail-closed and atomic.
{
  const f=setup(0x5240001c);f.game.shareholderReturnCapacity();f.game.save();
  const before=JSON.stringify(f.game.g),saved=f.loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1'),base=f.finance.event;
  f.finance.event=function(g,category,amount,opts={}){if(opts.buybackReconciliation){opts={...opts};delete opts.buybackReconciliation;}return base(g,category,amount,opts);};
  try{assert.throws(()=>f.game.buybackOwnShares(1_000_000),/P2-BUYBACK-FINITE/);}
  finally{f.finance.event=base;}
  assert.equal(JSON.stringify(f.game.g),before);
  assert.equal(f.loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1'),saved);
}

// Persisted drift is detected by the permanent close gate.
for(const mutate of [
  g=>{g.finance.buybackReconciliation.recognizedCost+=.02;},
  g=>{g.finance.buybackReconciliation.recognizedShares+=1;},
  g=>{g.finance.buybackReconciliation.recognitionCount+=1;},
  g=>{g.finance.balances.treasuryStock+=.02;},
  g=>{g.finance.transactions.find(row=>row?.buybackReconciliation).buybackReconciliation.evidence.treasurySharesAfter+=1;},
  g=>{g.finance.transactions.find(row=>row?.buybackReconciliation).buybackReconciliation.evidence.companyCashAfter+=.02;},
  g=>{g.finance.transactions.find(row=>row?.buybackReconciliation).buybackReconciliation.evidence.founderOwnershipAfter+=.01;},
  g=>{g.finance.transactions.find(row=>row?.buybackReconciliation).buybackReconciliation.evidence.stockMirrorPriceAfter+=.02;}
]){
  const f=setup(0x52400020);assert.equal(f.game.buybackOwnShares(1_000_000),true);mutate(f.game.g);
  assert.equal(f.finance.buybackReconciliationStatus(f.game.g).ok,false);
  assert.equal(f.finance.standaloneClose(f.game.g).ok,false);
  assert.equal(f.finance.validate(f.game.g).ok,false);
}

console.log('Phase 2 buyback reconciliation tests passed');
