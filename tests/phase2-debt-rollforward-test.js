'use strict';

const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};}
function plain(value){return JSON.parse(JSON.stringify(value));}
function setup(seed=0x52200001,{cash=500_000_000,debt=0}={}){
  const loaded=loadGame({headless:true,random:lcg(seed)});
  const game=new loaded.engineModule.TycoonEngine();
  game.configure({playerName:'P2 Debt',companyName:'P2 Debt Co',difficulty:'normal',scenario:'free',simulationSeed:seed});
  game.g.companyCash=cash;
  game.g.companyDebt=debt;
  game.g.finance=loaded.modules.finance.defaultFinanceState(game.g);
  return {loaded,game,finance:loaded.modules.finance,bank:loaded.modules.bankLoansCovenants,debtService:loaded.modules.playerDebtService};
}
function status(finance,game){
  const result=finance.debtRollforwardStatus(game.g);
  assert.equal(result.ok,true,JSON.stringify(result,null,2));
  return result;
}

// 1. Generic borrowing and repayment are principal movements; serialization preserves the active roll-forward.
{
  const {loaded,game,finance}=setup();
  const initial=status(finance,game);
  assert.equal(initial.metrics.openingDebt,0);
  assert.equal(initial.metrics.endingDebt,0);
  assert.equal(initial.metrics.instrumentPrincipal,0);

  assert.equal(game.borrow(10_000_000,'company'),true);
  const borrowed=status(finance,game);
  assert.equal(borrowed.metrics.openingDebt,0);
  assert.equal(borrowed.metrics.borrowings,10_000_000);
  assert.equal(borrowed.metrics.cashPrincipalRepayments,0);
  assert.equal(borrowed.metrics.cashlessPrincipalReductions,0);
  assert.equal(borrowed.metrics.expectedEndingDebt,10_000_000);
  assert.equal(borrowed.metrics.endingDebt,10_000_000);
  assert.equal(borrowed.metrics.instrumentPrincipal,10_000_000);
  assert.equal(borrowed.metrics.principalProfitEffectMagnitude,0);

  game.save();
  const persisted=JSON.parse(loaded.ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
  assert.deepEqual(persisted.finance.debtRollforwardCurrent,plain(game.g.finance.debtRollforwardCurrent));
  const restored=new loaded.engineModule.TycoonEngine(JSON.parse(JSON.stringify(persisted)));
  assert.deepEqual(plain(finance.debtRollforwardStatus(restored.g)),plain(borrowed),'reload must preserve the in-flight principal roll-forward');

  assert.equal(restored.repay(2_000_000,'company'),true);
  const repaid=status(finance,restored);
  assert.equal(repaid.metrics.borrowings,10_000_000);
  assert.equal(repaid.metrics.cashPrincipalRepayments,2_000_000);
  assert.equal(repaid.metrics.expectedEndingDebt,8_000_000);
  assert.equal(repaid.metrics.endingDebt,8_000_000);
  assert.equal(repaid.metrics.instrumentPrincipal,8_000_000);
  assert.equal(repaid.metrics.principalProfitEffectMagnitude,0);
}

// 2. A cashless liability reduction is classified as a write-off-style principal reduction without inventing a production mechanic.
{
  const {game,finance}=setup(0x52200002,{cash:100_000_000,debt:5_000_000});
  const loan=game.g.finance.loans[0];
  const cashBefore=game.g.companyCash;
  game.g.companyDebt-=1_000_000;
  loan.outstandingPrincipal-=1_000_000;
  const row=finance.event(game.g,'debtRepayment',1_000_000,{
    cashEffect:0,
    liabilityEffect:-1_000_000,
    profitEffect:0,
    sourceType:'p2-debt-contract-probe',
    sourceID:'cashless-principal',
    operationID:'p2-debt-cashless-principal',
    idempotencyKey:'p2-debt-cashless-principal'
  });
  assert.ok(row);
  const result=status(finance,game);
  assert.equal(game.g.companyCash,cashBefore);
  assert.equal(result.metrics.cashPrincipalRepayments,0);
  assert.equal(result.metrics.cashlessPrincipalReductions,1_000_000);
  assert.equal(result.metrics.expectedEndingDebt,4_000_000);
  assert.equal(result.metrics.endingDebt,4_000_000);
}

// 3. Interest is explicitly separated from principal and cannot silently move debt.
{
  const {game,finance}=setup(0x52200003,{cash:100_000_000,debt:5_000_000});
  finance.event(game.g,'interestExpense',100_000,{
    cashEffect:-100_000,
    profitEffect:-100_000,
    liabilityEffect:-50_000,
    sourceType:'p2-debt-contract-probe',
    sourceID:'bad-interest',
    operationID:'p2-debt-bad-interest'
  });
  const bad=finance.debtRollforwardStatus(game.g);
  assert.equal(bad.ok,false);
  assert.equal(bad.checks.find(row=>row.code==='P2-DEBT-INTEREST-PRINCIPAL').ok,false);
  assert.equal(bad.metrics.interestLiabilityEffectMagnitude,50_000);
}

// 4. Principal movement cannot leak into P&L.
{
  const {game,finance}=setup(0x52200004,{cash:100_000_000,debt:5_000_000});
  const loan=game.g.finance.loans[0];
  game.g.companyCash-=500_000;
  game.g.companyDebt-=500_000;
  loan.outstandingPrincipal-=500_000;
  finance.event(game.g,'debtRepayment',500_000,{
    cashEffect:-500_000,
    liabilityEffect:-500_000,
    profitEffect:-500_000,
    sourceType:'p2-debt-contract-probe',
    sourceID:'bad-principal-pnl',
    operationID:'p2-debt-bad-principal-pnl'
  });
  const bad=finance.debtRollforwardStatus(game.g);
  assert.equal(bad.ok,false);
  assert.equal(bad.checks.find(row=>row.code==='P2-DEBT-PRINCIPAL-PNL').ok,false);
  assert.equal(bad.metrics.principalProfitEffectMagnitude,500_000);
}

// 5. Production weekly close snapshots debt movements, including generic interest, then carries ending debt forward.
{
  const {game,finance}=setup(0x52200005);
  assert.equal(game.borrow(10_000_000,'company'),true);
  assert.equal(game.advanceWeek(false),true);
  const snap=game.g.finance.debtSnapshots.at(-1);
  assert.ok(snap,'weekly close must persist a debt snapshot');
  assert.equal(snap.ok,true,JSON.stringify(snap,null,2));
  assert.equal(snap.metrics.borrowings,10_000_000);
  assert.ok(snap.metrics.interestExpense>0,'generic weekly interest is observed separately');
  assert.equal(snap.metrics.interestLiabilityEffectMagnitude,0);
  assert.equal(snap.metrics.principalProfitEffectMagnitude,0);
  assert.equal(snap.metrics.endingDebt,game.g.companyDebt);
  assert.equal(snap.metrics.instrumentPrincipal,game.g.companyDebt);
  const carried=status(finance,game);
  assert.equal(carried.metrics.openingDebt,game.g.companyDebt);
  assert.equal(carried.metrics.borrowings,0);
  assert.equal(carried.metrics.cashPrincipalRepayments,0);
  assert.equal(carried.metrics.interestExpense,0);
}

// 6. Maturity/refinancing is deterministic across serialized reload branches.
{
  const {loaded,game,finance,debtService}=setup(0x52200006);
  assert.equal(game.borrowFromBank(100_000_000,156),true);
  debtService.refinancingState(game).nextMaturityWeek=game.g.week+1;
  const serialized=JSON.stringify(game.g);
  const a=new loaded.engineModule.TycoonEngine(JSON.parse(serialized));
  const b=new loaded.engineModule.TycoonEngine(JSON.parse(serialized));
  assert.equal(a.advanceWeek(false),true);
  assert.equal(b.advanceWeek(false),true);
  assert.equal(a.g.companyDebt,b.g.companyDebt);
  assert.deepEqual(plain(a.g.finance.debtSnapshots.at(-1)),plain(b.g.finance.debtSnapshots.at(-1)));
  assert.deepEqual(plain(a.g.finance.debtRollforwardCurrent),plain(b.g.finance.debtRollforwardCurrent));
  const maturity=debtService.refinancingState(a).history.at(-1);
  assert.equal(maturity.week,a.g.week);
  assert.ok(maturity.principalPaid>0,'maturity path must repay principal in this fixture');
  const snap=a.g.finance.debtSnapshots.at(-1);
  assert.ok(snap.metrics.cashPrincipalRepayments>=maturity.principalPaid);
  assert.equal(snap.metrics.rollforwardDifference,0);
  assert.equal(snap.metrics.instrumentDifference,0);
  assert.equal(finance.validate(a.g).ok,true,finance.validate(a.g).errors.join(' / '));

  const reloaded=new loaded.engineModule.TycoonEngine(JSON.parse(JSON.stringify(a.g)));
  assert.deepEqual(plain(finance.debtRollforwardStatus(reloaded.g)),plain(finance.debtRollforwardStatus(a.g)));
}

// 7. Snapshot retention is bounded.
{
  const {game,finance}=setup(0x52200007);
  game.g.finance.debtSnapshots=Array.from({length:finance.DEBT_SNAPSHOT_LIMIT},(_,i)=>({week:i+1,ok:true}));
  game.g.week=finance.DEBT_SNAPSHOT_LIMIT+1;
  const finalized=finance.finalizeDebtRollforward(game.g);
  assert.equal(finalized.ok,true);
  assert.equal(game.g.finance.debtSnapshots.length,finance.DEBT_SNAPSHOT_LIMIT);
  assert.equal(game.g.finance.debtSnapshots.at(-1).week,game.g.week);
}

console.log('Phase 2 debt roll-forward tests passed');
