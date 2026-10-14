'use strict';
// #954 (writer 4/4): personal angel investment create / exit must move personal cash and the
// investment record in one transaction; a failed save never reports success or keeps the change.
const assert=require('node:assert/strict');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const AMOUNT=1_000_000;
async function fixture(variant){
 const s=await scenario('own');s.game.g.personalCash=10_000_000;
 if(variant==='exit'){assert.equal(s.game.createAngelInvestment(AMOUNT),true);s.game.g.angelInvestments.at(-1).multiple=2.5;}
 assert.equal(s.game.save(),true);await s.backend.flush();
 return Object.assign(s,{angelID:s.game.g.angelInvestments.at(-1)?.id});
}
const command=variant=>s=>variant==='create'?s.game.createAngelInvestment(AMOUNT):s.game.exitAngelInvestment(s.angelID);
function expect(variant){
 return (before,after,s)=>{
  assert.equal(after.companyCash,before.companyCash,'company cash untouched (personal investment)');
  if(variant==='create'){assert.equal(after.personalCash,before.personalCash-AMOUNT);assert.equal(after.angelInvestments.length,before.angelInvestments.length+1);assert.equal(after.angelInvestments.at(-1).status,'active');}
  else{assert.equal(after.personalCash,before.personalCash+AMOUNT*2.5);assert.equal(after.angelInvestments.find(a=>a.id===s.angelID).status,'exited');}
  assert.equal(s.modules.finance.validate(after).ok,true);
 };
}
(async()=>{
 for(const variant of ['create','exit']){
  const h=makeTransactionFaultCase({name:`angel ${variant}`,fixture:()=>fixture(variant),command:command(variant),snapshot,economic,expectSuccess:expect(variant),
   label:(v,kind,{pending,nested})=>`angel ${variant} ${kind}/pending=${pending}/nested=${nested}`});
  for(const nested of [false,true])for(const kind of FAULT_KINDS)await h.rejected(variant,kind,{nested});
  for(const kind of ['save-false','save-throw'])await h.rejected(variant,kind,{pending:true});
  const s=await fixture(variant),before=snapshot(s.game),draws=s.host.draws,events=[],emit=s.game.emit;
  s.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
  assert.equal(command(variant)(s),true);s.game.emit=emit;
  expect(variant)(before,snapshot(s.game),s);assert.equal(s.host.draws,draws);assert.deepEqual(events,['notify','saved','change'],'single commit');
  if(variant==='exit')assert.equal(s.game.exitAngelInvestment(s.angelID),false,'no double exit');
  await s.backend.flush();await h.loaded(s,s.game.g);
  console.log(`angel ${variant} normal / single commit / reload / fresh hydration PASS`);
 }
 console.log('Angel investment save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
