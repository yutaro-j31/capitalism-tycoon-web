'use strict';
// #955 (7A): declining a hostile inbound buyout offer raises the competitor stake out of the external
// float under the existing ownership rule (updateOwnershipRatios): founder + external + competitor
// stays 1 live and after reload. The decline commits atomically; a failed save keeps nothing.
const assert=require('node:assert/strict');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS,injectFault}=require('./helpers/transaction-fault-case');
// The decline notice is emitted after the outermost commit (#963 review), so a notify listener fault is a
// post-commit case (covered below), not a rollback case.
const DECLINE_FAULTS=FAULT_KINDS.filter(kind=>kind!=='notify');
const NOTICE='Rival Holdingsからの買収提案を拒否しました。';
// Every decline call counts its notices: one after a committed outermost call, none on a failure or a nested call.
function decline(s,variant){
 const emit=s.game.emit,notices=[];let result,threw=true;
 s.game.emit=function(type='change',...args){if(type==='notify'&&args[0]?.severity!=='error')notices.push(args[0]);return emit.call(this,type,...args);};
 try{result=s.game.declineInboundBuyoutOffer('offer-fixture');threw=false;}
 finally{s.game.emit=emit;const committed=!threw&&result===true&&!s.game.inTransaction();
  assert.equal(notices.length,committed?1:0,committed?'one decline notice after the commit':'no decline notice without a commit');
  if(committed)assert.equal(JSON.stringify(notices[0]),JSON.stringify({message:NOTICE,severity:variant==='hostile'?'warning':'info'}));}
 return result;
}
const sum=g=>g.founderOwnershipRatio+g.externalShareholderRatio+g.competitorOwnedRatio;
async function fixture(variant){
 const s=await scenario('own'),g=s.game.g;
 g.competitorOwnedRatio=.1;s.game.updateOwnershipRatios();g.shareholderTrust=60;
 g.inboundBuyoutOffers=[{id:'offer-fixture',bidderName:'Rival Holdings',offerAmount:500_000_000,premiumRate:1.3,createdWeek:g.week,expiresWeek:g.week+8,hostile:variant==='hostile',status:'pending'}];
 assert.ok(Math.abs(sum(g)-1)<1e-12,'fixture ratios sum to 1');
 assert.equal(s.game.save(),true);await s.backend.flush();
 return s;
}
function expectDeclined(variant){
 return (before,after)=>{
  assert.equal(after.inboundBuyoutOffers[0].status,'declined');
  if(variant==='hostile'){
   assert.ok(Math.abs(after.competitorOwnedRatio-(before.competitorOwnedRatio+.025))<1e-12,'competitor stake +2.5pt');
   assert.ok(Math.abs(after.externalShareholderRatio-(before.externalShareholderRatio-.025))<1e-12,'taken from the external float');
   assert.equal(after.shareholderTrust,before.shareholderTrust-2);
  }else for(const key of ['competitorOwnedRatio','externalShareholderRatio','shareholderTrust'])assert.equal(after[key],before[key]);
  assert.equal(after.founderOwnershipRatio,before.founderOwnershipRatio,'founder unchanged');
  assert.ok(Math.abs(sum(after)-1)<1e-12,`ownership ratios sum to 1 (got ${sum(after)})`);
  for(const key of ['companyCash','personalCash','sharesOut','founderShares'])assert.equal(after[key],before[key]);
 };
}
(async()=>{
 for(const variant of ['hostile','friendly']){
  const h=makeTransactionFaultCase({name:'buyout decline',fixture:()=>fixture(variant),command:s=>decline(s,variant),snapshot,economic,
   expectSuccess:expectDeclined(variant),label:(v,kind,{pending,nested})=>`declineInboundBuyoutOffer ${variant}/${kind}/pending=${pending}/nested=${nested}`});
  for(const nested of [false,true])for(const kind of DECLINE_FAULTS)await h.rejected(variant,kind,{nested});
  for(const kind of ['save-false','save-throw'])await h.rejected(variant,kind,{pending:true});
  const s=await fixture(variant),before=snapshot(s.game),draws=s.host.draws,events=[],emit=s.game.emit;
  s.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
  assert.equal(s.game.declineInboundBuyoutOffer('offer-fixture'),true);s.game.emit=emit;
  assert.equal(events.join(),'saved,change,notify','single commit, then the decline notice');
  const live=snapshot(s.game);expectDeclined(variant)(before,live);assert.equal(s.host.draws,draws);
  assert.equal(live.news[0],`第${live.week}週：${NOTICE}`,'the decline news line is committed with the state');
  assert.equal(s.game.declineInboundBuyoutOffer('offer-fixture'),false,'cannot decline twice');
  await s.backend.flush();await h.loaded(s,s.game.g);
  const reloaded=s.engineModule.TycoonEngine.load().g;
  for(const key of ['founderOwnershipRatio','externalShareholderRatio','competitorOwnedRatio'])assert.equal(reloaded[key],live[key],`${key}: live equals reload (no load-time fork)`);
  console.log(`declineInboundBuyoutOffer ${variant} ratios sum to 1 / live equals reload / single commit PASS`);
  // A throwing notice listener runs after the commit: the decline is already saved and durable, and it reloads.
  {const s=await fixture(variant),before=snapshot(s.game),injection=injectFault(s,'notify');let error;
   try{s.game.declineInboundBuyoutOffer('offer-fixture');}catch(ex){error=ex;}finally{injection.restore();}
   assert.equal(injection.hits(),1,'the notice is emitted once');assert.match(error?.message||'',/threw/);
   expectDeclined(variant)(before,snapshot(s.game));await s.backend.flush();await h.loaded(s,s.game.g);
   console.log(`declineInboundBuyoutOffer ${variant} notify listener fault after the commit / decline saved / reload / fresh hydration PASS`);}
 }
 // The hostile stake is capped at the external float that remains: a wholly founder-owned company gives the bidder
 // nothing, a 1% float gives at most 1%; the founder sells nothing and the ratios still sum to 1 (#963 review).
 for(const [label,founderShare,gain] of [['founder holds everything',1,0],['1% external float',.99,.01]]){
  const s=await fixture('hostile'),g=s.game.g;g.treasuryBuybackShares=0;g.founderShares=Math.round(g.sharesOut*founderShare);g.competitorOwnedRatio=0;s.game.updateOwnershipRatios();
  assert.equal(s.game.save(),true);await s.backend.flush();const before=snapshot(s.game);
  assert.equal(s.game.declineInboundBuyoutOffer('offer-fixture'),true);const after=snapshot(s.game);
  assert.ok(Math.abs(after.competitorOwnedRatio-gain)<1e-12,`${label}: competitor gains ${gain}`);
  assert.equal(after.founderOwnershipRatio,before.founderOwnershipRatio,`${label}: founder unchanged`);assert.equal(after.founderShares,before.founderShares);
  assert.ok(Math.abs(sum(after)-1)<1e-12,`${label}: ratios sum to 1 (got ${sum(after)})`);
  await s.backend.flush();const reloaded=s.engineModule.TycoonEngine.load().g;
  for(const key of ['founderOwnershipRatio','externalShareholderRatio','competitorOwnedRatio'])assert.equal(reloaded[key],after[key],`${label}: ${key} live equals reload`);
  console.log(`declineInboundBuyoutOffer hostile / ${label} / stake capped at the float / ratios sum to 1 / reload PASS`);
 }
 console.log('Decline buyout ownership save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
