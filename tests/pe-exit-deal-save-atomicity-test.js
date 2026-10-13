'use strict';
// #954 (writer 2/4): legacy exitPEDeal (and its installed premium wrapper, which raises the deal's
// valuation before calling the base) must pay out, post the ledger event, remove the subsidiary and
// mark the deal exited in one transaction; a failed save never reports success or keeps any of it.
const assert=require('node:assert/strict');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const AMOUNT=20_000_000;
async function fixture(variant){
 const s=await scenario('own'),account=variant.startsWith('company')?'company':'personal';
 s.game.g.personalCash=50_000_000;
 assert.equal(s.game.createPEDeal('テック',AMOUNT,account),true);
 const deal=s.game.g.peDeals.at(-1);
 if(variant.endsWith('premium'))deal.improvementScore=95;
 assert.equal(s.game.save(),true);await s.backend.flush();
 return Object.assign(s,{dealID:deal.id,account});
}
function expectExited(variant){
 return (before,after,s)=>{
  const prior=before.peDeals.find(d=>d.id===s.dealID),deal=after.peDeals.find(d=>d.id===s.dealID);
  assert.equal(deal.status,'exited');
  const cashKey=s.account==='company'?'companyCash':'personalCash',other=s.account==='company'?'personalCash':'companyCash';
  const proceeds=after[cashKey]-before[cashKey];
  assert.ok(proceeds>=prior.currentValuation-1,'proceeds at least the carried valuation');
  if(variant.endsWith('premium'))assert.ok(proceeds>prior.currentValuation,'premium wrapper applied once');
  else assert.equal(proceeds,prior.currentValuation);
  assert.equal(after[other],before[other]);
  if(s.account==='company')assert.ok(!after.subsidiaries.some(x=>x.peDealID===s.dealID),'subsidiary removed');
  assert.equal(s.modules.finance.validate(after).ok,true,'company accounting valid');
 };
}
function faultCase(variant){
 return makeTransactionFaultCase({name:'PE exit',fixture:()=>fixture(variant),command:s=>s.game.exitPEDeal(s.dealID),snapshot,economic,
  expectSuccess:expectExited(variant),label:(v,kind,{pending,nested})=>`exitPEDeal ${variant}/${kind}/pending=${pending}/nested=${nested}`});
}
async function normal(variant){
 const s=await fixture(variant),h=faultCase(variant),before=snapshot(s.game),draws=s.host.draws,events=[],emit=s.game.emit;
 s.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
 assert.equal(s.game.exitPEDeal(s.dealID),true);s.game.emit=emit;
 expectExited(variant)(before,snapshot(s.game),s);assert.equal(s.host.draws,draws);
 assert.deepEqual(events,['notify','saved','change'],'single commit');
 assert.equal(s.game.exitPEDeal(s.dealID),false,'exited deal cannot exit again');
 await s.backend.flush();await h.loaded(s,s.game.g);
 console.log(`exitPEDeal ${variant} normal / single commit / no double exit / reload / fresh hydration PASS`);
}
(async()=>{
 for(const variant of ['company','personal','company-premium']){
  const h=faultCase(variant);
  for(const nested of [false,true])for(const kind of FAULT_KINDS)await h.rejected(variant,kind,{nested});
  for(const kind of ['save-false','save-throw'])await h.rejected(variant,kind,{pending:true});
  await normal(variant);
 }
 console.log('PE deal exit save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
