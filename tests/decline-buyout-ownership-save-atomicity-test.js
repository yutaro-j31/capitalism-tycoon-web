'use strict';
// #955 (7A): declining a hostile inbound buyout offer raises the competitor stake out of the external
// float under the existing ownership rule (updateOwnershipRatios): founder + external + competitor
// stays 1 live and after reload. The decline commits atomically; a failed save keeps nothing.
const assert=require('node:assert/strict');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
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
  const h=makeTransactionFaultCase({name:'buyout decline',fixture:()=>fixture(variant),command:s=>s.game.declineInboundBuyoutOffer('offer-fixture'),snapshot,economic,
   expectSuccess:expectDeclined(variant),label:(v,kind,{pending,nested})=>`declineInboundBuyoutOffer ${variant}/${kind}/pending=${pending}/nested=${nested}`});
  for(const nested of [false,true])for(const kind of FAULT_KINDS)await h.rejected(variant,kind,{nested});
  for(const kind of ['save-false','save-throw'])await h.rejected(variant,kind,{pending:true});
  const s=await fixture(variant),before=snapshot(s.game),draws=s.host.draws;
  assert.equal(s.game.declineInboundBuyoutOffer('offer-fixture'),true);
  const live=snapshot(s.game);expectDeclined(variant)(before,live);assert.equal(s.host.draws,draws);
  assert.equal(s.game.declineInboundBuyoutOffer('offer-fixture'),false,'cannot decline twice');
  await s.backend.flush();await h.loaded(s,s.game.g);
  const reloaded=s.engineModule.TycoonEngine.load().g;
  for(const key of ['founderOwnershipRatio','externalShareholderRatio','competitorOwnedRatio'])assert.equal(reloaded[key],live[key],`${key}: live equals reload (no load-time fork)`);
  console.log(`declineInboundBuyoutOffer ${variant} ratios sum to 1 / live equals reload / single commit PASS`);
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
