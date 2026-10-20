'use strict';
// P4-AUD-003: installed Founder Capital contribution transaction + durable save fault gate.
// This is a production regression, not a new Phase 4 debt writer or authority cutover.
const assert=require('node:assert/strict');
const {scenario,snapshot,economic}=require('../tests/fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('../tests/helpers/transaction-fault-case');
const AMOUNT=1_000_000;
async function fixture(){
  const s=await scenario('own');
  s.game.g.personalCash=40_000_000;
  assert.equal(s.game.save(),true);
  await s.backend.flush();
  assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true);
  return s;
}
const command=s=>s.game.contributeFounderCapital(AMOUNT);
function expectSuccess(before,after){
  assert.equal(after.companyCash,before.companyCash+AMOUNT);
  assert.equal(after.personalCash,before.personalCash-AMOUNT);
  assert.equal(after.companyDebt,before.companyDebt);
  assert.equal(after.personalDebt,before.personalDebt);
  assert.equal(after.finance.transactions.length,before.finance.transactions.length+1);
  assert.equal(after.finance.transactions.at(-1).sourceType,'founderCapitalContribution');
  assert.equal(after.finance.balances.capitalSurplus,before.finance.balances.capitalSurplus+AMOUNT);
}
(async()=>{
  const h=makeTransactionFaultCase({name:'founder-capital-contribution',fixture,command,snapshot,economic,expectSuccess});
  for(const nested of [false,true]){
    for(const kind of FAULT_KINDS)await h.rejected('capital',kind,{nested});
  }
  for(const kind of ['save-false','save-throw'])await h.rejected('capital',kind,{pending:true});
  const s=await fixture(),before=snapshot(s.game),draws=s.host.draws;
  assert.equal(command(s),true);
  expectSuccess(before,snapshot(s.game));
  assert.equal(s.host.draws,draws,'no host RNG consumed');
  await s.backend.flush();
  await h.loaded(s,s.game.g);
  console.log('P4-AUD-003 founder capital transaction gate PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
