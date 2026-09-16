'use strict';
// Regression test for gym startup loan default handling (Founding Route Rebalance Final, PR E).
//
// Problem: a gym startup loan (js/bank-loans-covenants.js's fundGymStartup()) that defaults after
// 3 lifetime covenant breaches is otherwise a permanent dead end -- service() skips any loan whose
// status!=='active', so its principal sits frozen in companyDebt forever while js/engine.js's
// weekly interest (companyDebt * companyBorrowRate() / 52) keeps draining cash with no repayment
// path. Measured via tests/harness.js sweeps (documented in founding-route-verification-log.md):
// a tenant whose required financing exceeds ~4.69M puts the loan's weekly payment structurally
// above what a single gym store can sustain -- neither a larger reserve (tested up to a 14.6x
// range) nor a longer term (tested up to 208 weeks) prevented default. Below ~4.6M, 0/10 defaults
// were observed even over a 500-week window. Fix is two-part: (1) gate eligibility on `required`
// at GYM_STARTUP_ELIGIBILITY_REQUIRED_MAX so new loans never enter the unaffordable zone, and
// (2) a dedicated workout safety net (not a reactivation to 'active') for any loan that still
// defaults from genuine cash-flow volatility despite that cutoff, or that already defaulted on an
// existing save under the old code before this fix shipped.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.join(__dirname,'..');
class Engine{constructor(g){this.g=g;}normalize(){}runTransaction(fn){return fn();}fail(){return false;}notify(){}}
function newContext(){
  const context={console,setTimeout,queueMicrotask,globalThis:null};
  context.globalThis=context;
  const modules={engine:{TycoonEngine:Engine},playerEngineBridge:{getEngine:()=>null},deterministicEconomicFoundation:{ensure:s=>s}};
  context.__capitalismTycoonModules=modules;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/finance.js'),'utf8'),context);
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'js/bank-loans-covenants.js'),'utf8'),context);
  return {finance:modules.finance,mod:modules.bankLoansCovenants};
}
function baseState(overrides={}){return Object.assign({week:1,companyCash:8_000_000,cash:8_000_000,totalAssets:8_000_000,personalCash:300000,cumulativeProfit:0,companyCredit:60,stores:[],economicFoundation:{indicators:{policyRate:1.5,stress:.2}}},overrides);}
// Directly poking g.companyCash to simulate "cash the company happens to have this week" (rather
// than cash moved by a real borrow()/service()/etc. call) leaves finance.js's weekly snapshots
// stale, which finance.validate() then reports as a cashDifference mismatch -- a test-harness
// artifact, not a real accounting bug. Book the injected delta as a transaction first, like any
// real weekly operating result would, so validate() stays accurate.
function setCashViaLedger(finance,g,amount){const delta=amount-g.companyCash;if(delta!==0)finance.event(g,'otherOperating',Math.abs(delta),{cashEffect:delta,profitEffect:delta,sourceType:'test',operationID:`test-cash-w${g.week}-${Math.round(amount)}`,idempotencyKey:`test-cash-w${g.week}-${Math.round(amount)}-ledger`,description:'test harness cash injection'});g.companyCash=amount;g.cash=amount;finance.rebuildDirtySnapshots(g);}

// --- 1. Unit bounds ---
{
  const {mod}=newContext();
  assert.strictEqual(mod.GYM_STARTUP_ELIGIBILITY_REQUIRED_MAX,4_600_000,'measured cutoff');
  assert.strictEqual(mod.GYM_STARTUP_WORKOUT_TRIGGER_MULTIPLIER,2,'matches credit-line REPAY_FLOOR=2x pattern');
  console.log('1. unit bounds: pass');
}

// --- 2. Eligibility gating on `required`, at and around the cutoff ---
{
  const {finance,mod}=newContext();
  // required = upfront - cash. Pin cash so `required` lands exactly at the boundary.
  const safe=baseState({companyCash:0,cash:0});
  finance.ensureFinance(safe);
  const q1=mod.gymStartupQuote(safe,mod.GYM_STARTUP_ELIGIBILITY_REQUIRED_MAX);
  assert.strictEqual(q1.required,mod.GYM_STARTUP_ELIGIBILITY_REQUIRED_MAX);
  assert.strictEqual(q1.eligible,true,'required exactly at the cutoff must remain eligible');

  const unsafe=baseState({companyCash:0,cash:0});
  finance.ensureFinance(unsafe);
  const q2=mod.gymStartupQuote(unsafe,mod.GYM_STARTUP_ELIGIBILITY_REQUIRED_MAX+1);
  assert.strictEqual(q2.required,mod.GYM_STARTUP_ELIGIBILITY_REQUIRED_MAX+1);
  assert.strictEqual(q2.eligible,false,'required one yen over the cutoff must be ineligible');
  assert.strictEqual(mod.fundGymStartup(unsafe,mod.GYM_STARTUP_ELIGIBILITY_REQUIRED_MAX+1),false,'fundGymStartup must refuse an over-cutoff request');
  console.log('2. eligibility gating at the measured cutoff: pass');
}

// --- 3. reserveAtOrigination is recorded on a freshly-originated loan ---
{
  const {finance,mod}=newContext();
  const g=baseState({companyCash:0,cash:0});
  finance.ensureFinance(g);
  const upfront=3_000_000;
  const q=mod.gymStartupQuote(g,upfront);
  assert(mod.fundGymStartup(g,upfront),'origination should succeed within the safe band');
  const loan=finance.ensureFinance(g).loans.find(l=>l.sourceType==='gymStartupLoan');
  assert.strictEqual(loan.reserveAtOrigination,q.principal-q.required,'reserveAtOrigination must match the quoted cushion');
  console.log('3. reserveAtOrigination recorded at origination: pass');
}

// --- 4. Workout transition: defaulted -> workout -> repaid, gated by the measured 2x-reserve trigger ---
{
  const {finance,mod}=newContext();
  const g=baseState({companyCash:0,cash:0});
  finance.ensureFinance(g);
  // Force a default the same way tests/bank-loans-covenants-default-consistency-test.js does:
  // starve cash so service() breaches the covenant 3 times in a row on a real gymStartupLoan.
  assert(mod.fundGymStartup(g,4_500_000),'origination within the safe band');
  finance.rebuildDirtySnapshots(g); // flush while g.week still matches the origination week
  const reserve=finance.ensureFinance(g).loans.find(l=>l.sourceType==='gymStartupLoan').reserveAtOrigination;
  let defaulted=false;
  for(let i=0;i<10&&!defaulted;i++){
    g.week++;setCashViaLedger(finance,g,0);
    mod.service(g);
    mod.serviceGymStartupWorkout(g);
    const loan=finance.ensureFinance(g).loans.find(l=>l.sourceType==='gymStartupLoan');
    if(loan.status==='defaulted')defaulted=true;
  }
  assert(defaulted,'テスト前提: 現金枯渇でコベナンツ違反3回に到達すること');
  const loanBefore=finance.ensureFinance(g).loans.find(l=>l.sourceType==='gymStartupLoan');
  const outstanding=loanBefore.outstandingPrincipal;

  // Below the trigger, workout must not fire yet.
  g.week++;setCashViaLedger(finance,g,Math.round(2*reserve)-1);
  mod.serviceGymStartupWorkout(g);
  assert.strictEqual(finance.ensureFinance(g).loans.find(l=>l.sourceType==='gymStartupLoan').status,'defaulted','below 2x reserve must stay defaulted');

  // Cash recovers well above the trigger: transitions to workout, then sweeps to repaid.
  let iterations=0,repaid=false;
  while(iterations++<200&&!repaid){
    g.week++;setCashViaLedger(finance,g,Math.round(2*reserve)+outstanding+1);
    mod.serviceGymStartupWorkout(g);
    const loan=finance.ensureFinance(g).loans.find(l=>l.sourceType==='gymStartupLoan');
    if(loan.status==='repaid')repaid=true;
    else assert(loan.status==='defaulted'||loan.status==='workout',`unexpected status ${loan.status}`);
  }
  assert(repaid,'workout must fully repay the loan once cash comfortably clears the trigger');
  const finalLoan=finance.ensureFinance(g).loans.find(l=>l.sourceType==='gymStartupLoan');
  assert.strictEqual(finalLoan.outstandingPrincipal,0);
  assert.strictEqual(g.companyDebt,0,'companyDebt must be cleared once the workout loan is fully repaid');
  const meta=g.bankFinancing.loans.find(m=>(m.financeLoanID||m.id)===finalLoan.loanID);
  assert.strictEqual(meta.status,'repaid','bankFinancing meta must track the same status');
  assert.strictEqual(finance.validate(g).ok,true,'finance.validate must stay OK through the workout cycle');
  console.log('4. workout transition (defaulted -> workout -> repaid): pass');
}

// --- 5. Backward-compatible fallback: a pre-fix loan with no reserveAtOrigination still works ---
{
  const {finance,mod}=newContext();
  const g=baseState({companyCredit:60});
  const f=finance.ensureFinance(g);
  // Simulate an old save: a defaulted gymStartupLoan created before this fix, so it has no
  // reserveAtOrigination field at all.
  const loan={loanID:'legacy-gym-loan',principal:2_000_000,outstandingPrincipal:2_000_000,interestRate:.09,termWeeks:104,remainingWeeks:80,repaymentMethod:'weekly',weeklyPrincipalPayment:10000,nextPaymentWeek:g.week+1,status:'defaulted',sourceType:'gymStartupLoan',sourceID:'legacy-gym-loan'};
  f.loans.push(loan);
  g.companyDebt=2_000_000;
  mod.ensure(g);
  g.bankFinancing.loans.push({id:'legacy-gym-loan',financeLoanID:'legacy-gym-loan',status:'defaulted',balance:2_000_000,breaches:3,productType:'gymStartup'});
  assert.strictEqual(loan.reserveAtOrigination,undefined,'テスト前提: 旧セーブのローンにreserveAtOriginationが無いこと');

  // Below the fallback (GYM_STARTUP_RESERVE=1,000,000) x2 threshold: must not transition yet.
  g.companyCash=2*mod.GYM_STARTUP_RESERVE-1;g.cash=g.companyCash;
  mod.serviceGymStartupWorkout(g);
  assert.strictEqual(loan.status,'defaulted','below the fallback threshold must stay defaulted');

  // Above it: an already-defaulted save from before this fix becomes workout-eligible immediately,
  // with no migration step required.
  g.companyCash=2*mod.GYM_STARTUP_RESERVE+1;g.cash=g.companyCash;
  mod.serviceGymStartupWorkout(g);
  assert.strictEqual(loan.status,'workout','pre-fix defaulted loan must use the GYM_STARTUP_RESERVE fallback');
  console.log('5. backward-compatible fallback (no reserveAtOrigination): pass');
}

// --- 6. Isolation: a generic borrow()-sourced loan is never touched, even if forced to 'defaulted' ---
{
  const {finance,mod}=newContext();
  const g=baseState();
  finance.ensureFinance(g);
  assert(mod.borrow(g,1_000_000,52),'generic borrow should succeed');
  const genericLoan=finance.ensureFinance(g).loans.find(l=>l.sourceType==='bankLoansCovenants');
  genericLoan.status='defaulted';
  const meta=g.bankFinancing.loans.find(m=>(m.financeLoanID||m.id)===genericLoan.loanID);
  if(meta)meta.status='defaulted';
  g.companyCash=50_000_000;g.cash=g.companyCash; // comfortably above any plausible trigger
  mod.serviceGymStartupWorkout(g);
  assert.strictEqual(genericLoan.status,'defaulted','a non-gymStartupLoan sourceType must never be swept into workout');
  console.log('6. isolation (generic borrow() loans untouched): pass');
}

console.log('gym-startup-loan-workout tests passed');
