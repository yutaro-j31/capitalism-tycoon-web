'use strict';
const assert=require('node:assert/strict');
const {VARIANTS,fixture,command,expectSuccess,economic,snapshot}=require('./fixtures/debt-command-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
(async()=>{
 for(const variant of VARIANTS){
  const h=makeTransactionFaultCase({name:variant,fixture:()=>fixture(variant),command,snapshot,economic,expectSuccess});
  for(const nested of [false,true])for(const kind of FAULT_KINDS)await h.rejected(variant,kind,{nested});
  for(const kind of ['save-false','save-throw'])await h.rejected(variant,kind,{pending:true});
  const s=await fixture(variant),before=snapshot(s.game),events=[],emit=s.game.emit,draws=s.host.draws;
  s.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
  assert.equal(command(s),true);s.game.emit=emit;expectSuccess(before,snapshot(s.game),s);
  assert.equal(events.filter(x=>x==='saved').length,1);assert.equal(events.filter(x=>x==='change').length,1);
  assert.equal(s.host.draws,draws,'no host RNG');await s.backend.flush();await h.loaded(s,s.game.g);
  console.log(variant+' normal / one commit / reload / fresh hydration PASS');
 }
 console.log('Debt command save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
