'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const acceptance=require('../scripts/phase2-acceptance');
const phase05=require('../scripts/phase0-5-harness');
const SOURCE_SHA='47bcd31e04160d275aad5192ba850bf7ab4ec2f3';
const runtime=acceptance.createAcceptanceRuntime({sourceMainSha:SOURCE_SHA});
phase05.stepEconomicTick(runtime);
const finance=runtime.loaded.modules.finance;
const snapshot=state=>acceptance.snapshotAccountingAcceptance(state,finance);
const plain=value=>JSON.parse(JSON.stringify(value));
const before=JSON.stringify(runtime.engine.g);
const good=snapshot(runtime.engine.g);
assert.equal(good.ok,true,JSON.stringify(good));
assert.equal(good.readOnly,true);
assert.equal(JSON.stringify(runtime.engine.g),before,'probe must preserve every state field, including RNG and diagnostics');
assert.deepEqual(plain(snapshot(runtime.engine.g)),plain(good),'same state produces identical evidence');
assert.equal(good.close.checks.length,acceptance.REQUIRED_CLOSE_CHECKS.length);
assert.equal(good.close.dividendReconciliation.metrics.paymentCount,1);
assert.equal(good.close.buybackReconciliation.metrics.recognitionCount,1);
assert.ok(runtime.engine.g.finance.transactions.some(row=>row.category==='debtBorrowing'));
assert.equal(runtime.engine.g.finance.fixedAssets.filter(row=>row.p2Lifecycle.origin==='recognized').length,2);

// Raw inspection must precede JSON conversion and finance's legacy numeric normalization.
for(const value of [NaN,Infinity,-Infinity]){
  for(const mutate of [
    state=>{state.companyCash=value;},state=>{state.personalCash=value;},
    state=>{state.simulationRng.state=value;},
    state=>{state.finance.balances.accountsReceivable=value;},
    state=>{state.finance.transactions[0].cashEffect=value;},
    state=>{state.finance.transactions[0].metadata={nested:{amount:value}};},
    state=>{state.finance.loans[0].outstandingPrincipal=value;},
    state=>{state.finance.fixedAssets[0].bookValue=value;}
  ]){
    const state=plain(runtime.engine.g);mutate(state);
    let evaluated=false;
    const rejected=acceptance.snapshotAccountingAcceptance(state,{standaloneClose(){evaluated=true;throw new Error('must not normalize');}});
    assert.equal(rejected.ok,false);
    assert.ok(rejected.failedGates.includes('P2-ACCEPT-RAW-FINITE'));
    assert.equal(evaluated,false,'invalid raw state must fail before close/normalization');
    assert.ok(phase05.findNonFiniteNumbers(state).length>0,'raw invalid number remains unmodified');
  }
}
{
  const state=plain(runtime.engine.g);state.circular=state;
  assert.equal(snapshot(state).ok,false,'cycles fail closed before serialization');
  assert.equal(state.circular,state);
}
for(const transactions of [null,{},[null],new Array(1)]){
  const state=plain(runtime.engine.g);state.finance.transactions=transactions;
  assert.ok(snapshot(state).failedGates.includes('P2-ACCEPT-TRANSACTION-SHAPE'));
}
// A single malformed material row must fail even without an identifier collision.
for(const value of [undefined,null,'','   ',0,{},[]]){
  const state=plain(runtime.engine.g);
  const row=state.finance.transactions.find(item=>item.category==='debtBorrowing');
  if(value===undefined)delete row.transactionID;else row.transactionID=value;
  const before=JSON.stringify(state);
  let evaluated=false;
  const rejected=acceptance.snapshotAccountingAcceptance(state,{standaloneClose(){evaluated=true;throw new Error('must not normalize identity');}});
  assert.equal(rejected.ok,false);
  assert.ok(rejected.failedGates.includes('P2-ACCEPT-TRANSACTION-IDENTITY'));
  assert.equal(evaluated,false,'malformed identity must fail before finance normalization');
  assert.equal(rejected.readOnly,true);
  assert.equal(JSON.stringify(state),before,'invalid identity must remain untouched');
}
// Zero-effect duplicate rows isolate identity gates from cash/BS reconciliation errors.
for(const key of ['transactionID','idempotencyKey']){
  const state=plain(runtime.engine.g);
  const row={transactionID:'p2-duplicate-1',idempotencyKey:key==='idempotencyKey'?'p2-duplicate-key':null,
    week:state.week,category:'otherOperating',amount:0,cashEffect:0,profitEffect:0,assetEffect:0,liabilityEffect:0,equityEffect:0};
  state.finance.transactions.push(row,{...row,transactionID:key==='transactionID'?row.transactionID:'p2-duplicate-2'});
  const rejected=snapshot(state);
  assert.equal(rejected.ok,false);
  assert.ok(rejected.failedGates.includes(key==='transactionID'?'P2-ACCEPT-TRANSACTION-ID':'P2-ACCEPT-IDEMPOTENCY-KEY'));
}
{
  const state=plain(runtime.engine.g);state.companyCash-=.06;
  const rejected=snapshot(state);
  assert.equal(rejected.ok,false,'cent-scale cash divergence must fail the existing strict close');
  assert.ok(rejected.failedGates.includes('P2-ACCEPT-CLOSE'));
}
{
  const state=plain(runtime.engine.g);state.finance.fixedAssets[0].bookValue+=.01;
  assert.equal(snapshot(state).close.checks.find(row=>row.code==='P2-ASSET-BOOK').ok,false);
}
for(const [mutate,code] of [
  [state=>{state.companyDebt+=.02;},'P2-DEBT-INSTRUMENTS'],
  [state=>{state.finance.dividendReconciliation.grossPaid+=.01;},'P2-DIVIDEND-CONSERVATION'],
  [state=>{state.finance.buybackReconciliation.recognizedShares+=1;},'P2-BUYBACK-EVIDENCE-SHARES']
]){
  const state=plain(runtime.engine.g);mutate(state);
  const rejected=snapshot(state);
  assert.equal(rejected.ok,false);
  assert.equal(rejected.close.checks.find(row=>row.code===code).ok,false,`${code} must actually detect corrupted evidence`);
}
{
  const state=plain(runtime.engine.g);state.finance.balances.accountsPayable=-.11;
  assert.ok(snapshot(state).failedGates.includes('P2-ACCEPT-LEGACY-VALIDATION'),'negative working capital retains its existing invariant');
}
for(const code of acceptance.REQUIRED_CLOSE_CHECKS){
  const incomplete={...finance,standaloneClose(state,period){const close=finance.standaloneClose(state,period);
    return {...close,checks:close.checks.filter(row=>row.code!==code)};}};
  const rejected=acceptance.snapshotAccountingAcceptance(runtime.engine.g,incomplete);
  assert.ok(rejected.failedGates.includes('P2-ACCEPT-CLOSE-COVERAGE'),`${code} may not silently disappear`);
}
{
  const repeated={...finance,standaloneClose(state,period){const close=finance.standaloneClose(state,period);
    return {...close,checks:[...close.checks,close.checks[0]]};}};
  assert.ok(acceptance.snapshotAccountingAcceptance(runtime.engine.g,repeated).failedGates.includes('P2-ACCEPT-CLOSE-COVERAGE'));
}
{
  const rejected=acceptance.snapshotAccountingAcceptance(runtime.engine.g,{standaloneClose(){throw new Error('injected-close-error');}});
  assert.equal(rejected.ok,false);
  assert.ok(rejected.failedGates.includes('P2-ACCEPT-CLOSE'));
  assert.equal(JSON.stringify(runtime.engine.g),before);
}
{
  const state=plain(runtime.engine.g);state.saveVersion=8;
  assert.ok(snapshot(state).failedGates.includes('P2-ACCEPT-SAVE-V9'));
}
const replay=acceptance.replayRecognizedTransactions(runtime);
assert.equal(replay.ok,true);
assert.equal(replay.unchanged,true);
assert.equal(JSON.stringify(runtime.engine.g),before,'recognized production operations cannot move cash, ledger or RNG twice');
assert.deepEqual([...replay.families],['debt','dividend','buyback','fixed-asset']);

const first=acceptance.runPhase2Acceptance({sourceMainSha:SOURCE_SHA});
const second=acceptance.runPhase2Acceptance({sourceMainSha:SOURCE_SHA});
assert.equal(first.ok,true,JSON.stringify(first));
assert.deepEqual(first,second,'same persisted seed and actions produce identical acceptance evidence');
assert.equal(first.scope,'smoke','smoke PASS alone does not attest the long-run envelope or GitHub CI');
assert.equal(first.weeks,13);
assert.deepEqual([...first.failedGates],[]);
assert.equal(first.checks.find(row=>row.code==='P2-ACCEPT-WEEKLY').details.violations,0);
assert.equal(first.checks.find(row=>row.code==='P2-ACCEPT-CANONICAL-PERSISTENCE').ok,true);
for(const fork of first.checks.find(row=>row.code==='P2-ACCEPT-SAVE-RELOAD-REPLAY').details.persistence){
  assert.equal(fork.ok,true);
  assert.equal(fork.replay.ok,true);
  assert.equal(fork.checkpoints.length,3);
}
assert.deepEqual([...acceptance.LONG_RUN_ENVELOPE.routes],['ramen','conveni','gym','realEstateAgency']);
assert.equal(acceptance.LONG_RUN_ENVELOPE.weeks,208);
assert.equal(acceptance.LONG_RUN_ENVELOPE.allowedViolations,0);
const longRun=fs.readFileSync(path.join(__dirname,acceptance.LONG_RUN_ENVELOPE.test.replace('tests/','')),'utf8');
assert.match(longRun,/phase2Acceptance\.snapshotAccountingAcceptance/);
assert.match(longRun,/phase2AcceptanceViolations:0/);
for(const weeks of [0,-1,209,NaN,Infinity,1.5])assert.throws(()=>acceptance.runPhase2Acceptance({weeks}),RangeError);
console.log('Phase 2 accounting acceptance gate tests passed');
