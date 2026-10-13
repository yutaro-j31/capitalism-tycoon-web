'use strict';
// #954 (writer 1/4): legacy createPEDeal must create the deal, move cash, post the ledger event and
// sync the subsidiary in one transaction; a failed save never reports success or leaves the deal.
const assert=require('node:assert/strict');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const AMOUNT=20_000_000;
const fixture=account=>scenario('own').then(s=>{s.game.g.personalCash=50_000_000;assert.equal(s.game.save(),true);return s.backend.flush().then(()=>s);});
function expectCreated(account){
 return (before,after,s)=>{
  const cashKey=account==='company'?'companyCash':'personalCash',other=account==='company'?'personalCash':'companyCash';
  assert.equal(after[cashKey],before[cashKey]-AMOUNT,'cash moved once');assert.equal(after[other],before[other],'other account untouched');
  assert.equal(after.peDeals.length,before.peDeals.length+1);
  const deal=after.peDeals.at(-1);assert.deepEqual([deal.status,deal.ownerAccount,deal.investedAmount],['active',account,AMOUNT]);
  if(account==='company'){assert.ok(after.subsidiaries.some(x=>x.peDealID===deal.id||x.id===deal.subsidiaryID),'subsidiary synced');}
  else assert.equal(after.subsidiaries.length,before.subsidiaries.length);
  assert.equal(s.modules.finance.validate(after).ok,true,'company accounting valid');
 };
}
function faultCase(account){
 return makeTransactionFaultCase({name:'PE deal creation',fixture:()=>fixture(account),command:s=>s.game.createPEDeal('テック',AMOUNT,account),snapshot,economic,
  expectSuccess:expectCreated(account),label:(v,kind,{pending,nested})=>`createPEDeal ${account}/${kind}/pending=${pending}/nested=${nested}`});
}
async function normal(account){
 const s=await fixture(account),h=faultCase(account),before=snapshot(s.game),draws=s.host.draws,events=[],emit=s.game.emit;
 s.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
 assert.equal(s.game.createPEDeal('テック',AMOUNT,account),true);s.game.emit=emit;
 expectCreated(account)(before,snapshot(s.game),s);assert.equal(s.host.draws,draws,'no host RNG');
 assert.deepEqual(events,['notify','saved','change'],'single commit: notify, then one save and one change');
 await s.backend.flush();await h.loaded(s,s.game.g);
 // Validation failures stay no-ops.
 const t=await fixture(account),b=snapshot(t.game);t.game.g[account==='company'?'companyCash':'personalCash']=1;const low=snapshot(t.game);
 assert.equal(t.game.createPEDeal('テック',AMOUNT,account),false);assert.deepEqual(snapshot(t.game).peDeals,b.peDeals);assert.deepEqual(snapshot(t.game).peDeals,low.peDeals);
 console.log(`createPEDeal ${account} normal / single commit / reload / fresh hydration PASS`);
}
(async()=>{
 for(const account of ['company','personal']){
  const h=faultCase(account);
  for(const nested of [false,true])for(const kind of FAULT_KINDS)await h.rejected(account,kind,{nested});
  for(const kind of ['save-false','save-throw'])await h.rejected(account,kind,{pending:true});
  await normal(account);
 }
 console.log('PE deal creation save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
