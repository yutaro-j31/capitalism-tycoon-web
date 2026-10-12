'use strict';
// #953: accepting an activist proposal executes the capital return AND completes the campaign as one
// atomic transaction; negotiate / reject persist through the same boundary. A reload must never
// re-open an accepted proposal (no second buyback / second cash outflow).
const assert=require('node:assert/strict');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const BUYBACK=1_000_000,DIVIDEND=6;
async function campaignScenario(type){
 const s=await scenario('own'),g=s.game.g;
 g.activeActivistCampaign={id:`activist-${g.week}-${type}-fixture`,activistName:'North Star Capital',type,title:type==='buyback'?'過剰現金の自社株買い':'配当方針の引き上げ',
  amount:type==='buyback'?BUYBACK:DIVIDEND*(g.sharesOut-g.treasuryBuybackShares),dividendPerShare:type==='dividend'?DIVIDEND:undefined,reason:'fixture',week:g.week,
  startedWeek:g.week,deadlineWeek:g.week+8,status:'active',response:null,support:40,pressureScore:70,difficulty:'normal'};
 g.companyReputation=50;g.founderControlPressure=30;
 assert.equal(s.game.save(),true);await s.backend.flush();
 return s;
}
function expectAccepted(type){
 return (before,after)=>{
  const campaign=before.activeActivistCampaign;
  assert.equal(after.activeActivistCampaign,null,'campaign completed');
  const done=after.activistCampaignHistory.at(-1);
  assert.deepEqual([done.type,done.campaignID,done.status],['campaignCompleted',campaign.id,'accepted']);
  assert.equal(after.companyReputation,before.companyReputation+2);assert.equal(after.founderControlPressure,before.founderControlPressure-10);
  if(type==='buyback'){
   assert.ok(after.treasuryBuybackShares>before.treasuryBuybackShares,'buyback executed once');
   assert.ok(after.companyCash<before.companyCash&&before.companyCash-after.companyCash<=BUYBACK+1,'cash spent once, within the proposal amount');
  }else{assert.equal(after.dividendPerShare,campaign.dividendPerShare);assert.equal(after.companyCash,before.companyCash);}
  assert.equal(after.personalCash,before.personalCash);
 };
}
function faultCase(type){
 return makeTransactionFaultCase({
  name:'proposal acceptance',fixture:()=>campaignScenario(type),command:s=>s.game.acceptShareholderProposal(),snapshot,economic,
  expectSuccess:expectAccepted(type),label:(variant,kind,{pending,nested})=>`activism accept ${type}/${kind}/pending=${pending}/nested=${nested}`,
 });
}
async function acceptOnceAcrossReload(type){
 const s=await campaignScenario(type),h=faultCase(type),draws=s.host.draws,before=snapshot(s.game);
 assert.equal(s.game.acceptShareholderProposal(),true);
 const after=snapshot(s.game);expectAccepted(type)(before,after);
 if(type==='buyback')assert.equal(s.host.draws,draws,'accept consumes no simulation RNG');
 assert.equal(s.modules.finance.validate(after).ok,true,'company accounting valid');
 await s.backend.flush();await h.loaded(s,s.game.g);
 const reloaded=s.engineModule.TycoonEngine.load();
 assert.equal(reloaded.g.activeActivistCampaign,null,'reload does not re-open the accepted proposal');
 assert.equal(reloaded.acceptShareholderProposal(),false,'second accept after reload is rejected');
 assert.equal(reloaded.g.treasuryBuybackShares,after.treasuryBuybackShares);assert.equal(reloaded.g.companyCash,after.companyCash);
 assert.equal(s.game.acceptShareholderProposal(),false,'second accept in the live session is rejected');
 console.log(`activism accept ${type} once across reload / fresh hydration / no double spend PASS`);
}
async function responsesPersist(){
 for(const action of ['negotiate','reject']){
  const s=await campaignScenario('buyback'),h=faultCase('buyback'),draws=s.host.draws;
  const ok=action==='negotiate'?s.game.negotiateShareholderProposal():s.game.rejectShareholderProposal();
  assert.equal(ok,true);assert.equal(s.host.draws,draws);
  const live=snapshot(s.game);
  assert.equal(live.activeActivistCampaign.response,action==='negotiate'?'negotiation':'reject');
  await s.backend.flush();await h.loaded(s,s.game.g);
  // A failed save rolls the response back instead of keeping an unsaved live change.
  const t=await campaignScenario('buyback'),before=snapshot(t.game),save=t.game.save;
  t.game.save=()=>false;let result;try{result=action==='negotiate'?t.game.negotiateShareholderProposal():t.game.rejectShareholderProposal();}finally{t.game.save=save;}
  assert.equal(result,false,`${action} reports the failed save`);assert.deepEqual(snapshot(t.game),before,`${action} rolls back on save failure`);
  console.log(`activism ${action} persists through reload / fresh hydration and rolls back on save failure PASS`);
 }
}
(async()=>{
 for(const type of ['buyback','dividend']){
  const h=faultCase(type);
  for(const nested of [false,true])for(const kind of FAULT_KINDS)await h.rejected(type,kind,{nested});
  for(const kind of ['save-false','save-throw','saved','change'])await h.rejected(type,kind,{pending:true});
  await acceptOnceAcrossReload(type);
 }
 await responsesPersist();
 console.log('Shareholder activism accept save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
