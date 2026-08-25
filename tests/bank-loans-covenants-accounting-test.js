'use strict';
const assert = require('node:assert');
const { loadGame } = require('./harness');
const { SCENARIOS, SEEDS, runScenario } = require('./strategy-balance-runner');

function makeGame(){
  let seed=0x296b4a;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/0x100000000);
  const loaded=loadGame({random});
  const {engineModule,modules}=loaded;
  const state=engineModule.createInitialState({configured:true});
  state.configured=true;
  state.companyCash=20_000_000;
  state.companyDebt=0;
  state.companyCredit=80;
  state.finance=modules.finance.defaultFinanceState(state);
  return {game:new engineModule.TycoonEngine(state),modules,engineModule};
}

{
  const {game,modules}=makeGame();
  const cashBefore=game.g.companyCash;
  const creditBefore=game.g.companyCredit;
  assert.equal(game.borrowFromBank(1_000_000,52),true);
  assert.equal(game.g.companyCash,cashBefore+1_000_000);
  assert.equal(game.g.companyDebt,1_000_000);
  assert.equal(game.g.bankDebt,1_000_000,'bankDebt is a derived compatibility value');
  assert.equal(game.g.companyCredit,creditBefore-1);
  assert.equal(game.g.finance.loans.filter(l=>l.status==='active').reduce((s,l)=>s+l.outstandingPrincipal,0),1_000_000);
  assert.ok(game.g.finance.transactions.some(t=>t.category==='debtBorrowing'&&t.cashEffect===1_000_000&&t.liabilityEffect===1_000_000));
  assert.deepEqual(modules.finance.validate(game.g).errors,[],'borrowing must preserve accounting invariants');
  const debtAfterBorrow=game.g.companyDebt;
  for(let i=0;i<4;i+=1)game.advanceWeek(false);
  assert.ok(game.g.companyDebt<debtAfterBorrow,'weekly service reduces companyDebt');
  assert.ok(game.g.finance.transactions.some(t=>t.category==='debtRepayment'&&t.cashEffect<0&&t.liabilityEffect<0));
  assert.ok(game.g.finance.transactions.some(t=>t.category==='interestExpense'&&t.cashEffect<0&&t.profitEffect<0));
  assert.deepEqual(modules.finance.validate(game.g).errors,[],'repayment must preserve accounting invariants');
  for(let cycle=0;cycle<3;cycle+=1){assert.equal(game.borrowFromBank(500_000,26),true);for(let i=0;i<8;i+=1)game.advanceWeek(false);assert.deepEqual(modules.finance.validate(game.g).errors,[],`cycle ${cycle+1} must remain balanced`);}
}

{
  const {game,modules}=makeGame();
  game.g.bankFinancing={loans:[{id:'legacy-bank-1',principal:1_200_000,balance:900_000,termWeeks:52,remainingWeeks:39,annualRate:.05,weeklyPayment:25_000,status:'active',covenants:{maxLeverage:.8,minCash:50_000},breaches:0}],history:[],lastServiceWeek:null};
  game.g.bankDebt=900_000;
  game.g.companyDebt=0;
  game.g.finance=modules.finance.defaultFinanceState(game.g);
  modules.bankLoansCovenants.ensure(game.g);
  assert.equal(game.g.companyDebt,900_000);
  assert.equal(game.g.bankDebt,900_000);
  assert.equal(game.g.finance.loans.filter(l=>l.status==='active').reduce((s,l)=>s+l.outstandingPrincipal,0),900_000);
  assert.equal(game.g.bankFinancing.loans[0].financeLoanID,'legacy-bank-1');
  assert.deepEqual(modules.finance.validate(game.g).errors,[],'legacy bank financing must migrate without data loss');
  const count=game.g.finance.loans.length;
  modules.bankLoansCovenants.ensure(game.g);
  assert.equal(game.g.finance.loans.length,count,'legacy migration must be idempotent');
}

{
  // QA監査(docs/QA_AUDIT_2026-08-25.md C2)の法人税修正でconveni-leverageはSEEDS[0]も
  // 含め一時3シード全てで破産するようになったが、続くC4(役員報酬の月割り計算修正、
  // 年13/12倍の過払いを是正)で支出が下がった結果、SEEDS[0]は生存可能に回復した
  // (strategy-balance-matrix-test.jsのKNOWN_UNVIABLEはSEEDS[1]/SEEDS[2]のみ残存)。
  // このブロックは元の意図(長期シミュレーションでも会計整合性が壊れないこと)どおり、
  // 正常にIPOへ到達することを確認する。
  const def=SCENARIOS.find(row=>row.id==='conveni-leverage');
  const result=runScenario(def,SEEDS[0],{includeState:true});
  assert.equal(result.week<=208,true);
  assert.equal(result.gameOver,false,`conveni-leverage must complete without game over: ${result.reason}`);
  assert.deepEqual(result.modules.finance.validate(result.state).errors,[],'conveni-leverage must preserve accounting invariants');
}

console.log('bank loan accounting, repayment, legacy migration, and conveni-leverage regression tests passed');
