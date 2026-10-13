'use strict';
// #951 x #953 integration: an activist proposal opened BEFORE a stock split is answered AFTER it.
// The split rescales the proposal's per-share terms (#951); the atomic response (#953) must then
// commit the rescaled terms exactly once, roll back completely on a failed save, and never let a
// reload re-open / re-accept the proposal. Uses only installed production writers.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const BUYBACK=1_000_000,DIVIDEND=6,TOLERANCE=1e-6;
const finance=loadGame({headless:true}).modules.finance;
const outstanding=state=>Math.max(0,state.sharesOut-state.treasuryBuybackShares);
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=TOLERANCE*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);
async function campaignScenario(type,{ratios=[],respond=null}={}){
 const s=await scenario('own'),g=s.game.g;
 g.activeActivistCampaign={id:`activist-${g.week}-${type}-split-fixture`,activistName:'North Star Capital',type,title:type==='buyback'?'過剰現金の自社株買い':'配当方針の引き上げ',
  amount:type==='buyback'?BUYBACK:DIVIDEND*outstanding(g),dividendPerShare:type==='dividend'?DIVIDEND:undefined,reason:'fixture',week:g.week,
  startedWeek:g.week,deadlineWeek:g.week+8,status:'active',response:null,support:40,pressureScore:70,difficulty:'normal'};
 g.companyReputation=50;g.founderControlPressure=30;
 const proposedTotal=type==='dividend'?DIVIDEND*outstanding(g):null;
 assert.equal(s.game.save(),true);
 if(respond==='negotiate')assert.equal(s.game.negotiateShareholderProposal(),true,'negotiate before the split');
 for(const ratio of ratios){const draws=s.host.draws;assert.equal(s.game.stockSplit('CPTY',ratio),true,`production split 1:${ratio}`);assert.equal(s.host.draws,draws,'split consumes no RNG');}
 await s.backend.flush();
 return Object.assign(s,{proposedTotal,factor:ratios.reduce((a,b)=>a*b,1)});
}
function expectAccepted(type){
 return (before,after,s)=>{
  const campaign=before.activeActivistCampaign;
  assert.equal(after.activeActivistCampaign,null,'campaign completed');
  const done=after.activistCampaignHistory.at(-1);
  assert.deepEqual([done.type,done.campaignID,done.status],['campaignCompleted',campaign.id,'accepted']);
  assert.equal(after.companyReputation,before.companyReputation+2);assert.equal(after.founderControlPressure,before.founderControlPressure-10);
  if(type==='dividend'){
   close(campaign.dividendPerShare,DIVIDEND/s.factor,'open proposal carries the rescaled per-share term');
   close(after.dividendPerShare,DIVIDEND/s.factor,'declared dividend is the rescaled proposal');
   close(after.dividendPerShare*outstanding(after),s.proposedTotal,'accepted dividend total equals the pre-split proposal total');
   assert.equal(after.companyCash,before.companyCash);
  }else{
   assert.ok(after.treasuryBuybackShares>before.treasuryBuybackShares,'buyback executed once');
   assert.ok(after.companyCash<before.companyCash&&before.companyCash-after.companyCash<=BUYBACK+1,'cash spent once, within the yen-denominated proposal');
  }
  assert.equal(after.personalCash,before.personalCash,'personal cash untouched');
  assert.equal(finance.validate(after).ok,true,'company accounting valid');
 };
}
function faultCase(type,ratios){
 return makeTransactionFaultCase({name:'post-split proposal acceptance',fixture:()=>campaignScenario(type,{ratios}),command:s=>s.game.acceptShareholderProposal(),snapshot,economic,
  expectSuccess:expectAccepted(type),label:(v,kind,{pending,nested})=>`activism x split accept ${type} 1:${ratios.join('x')}/${kind}/pending=${pending}/nested=${nested}`});
}
async function payWeek(game){
 const state=game.g,personal=state.personalCash,company=state.companyCash,week=state.week;
 assert.equal((week+1)%13,0,'fixture advances into a dividend payment week');
 assert.notEqual(game.advanceWeek(false),false,'week commits');
 assert.equal(finance.validate(snapshot(game)).ok,true,'ledger valid after the dividend week');
 return {personal:state.personalCash-personal,company:state.companyCash-company,dividend:state.lastReport.dividend};
}
// Case A: dividend proposal, split, accept: paid dividend equals the never-split control, persisted
// as completed, and re-accept is rejected live, after reload and after a fresh durable-only hydration.
async function caseA(ratios){
 const control=await campaignScenario('dividend');assert.equal(control.game.acceptShareholderProposal(),true);const expected=await payWeek(control.game);
 const s=await campaignScenario('dividend',{ratios}),h=faultCase('dividend',ratios),before=snapshot(s.game),draws=s.host.draws;
 assert.equal(s.game.acceptShareholderProposal(),true);assert.equal(s.host.draws,draws,'accept consumes no RNG');
 const after=snapshot(s.game);expectAccepted('dividend')(before,after,s);
 assert.equal(s.game.acceptShareholderProposal(),false,'no second accept in the live session');
 await s.backend.flush();await h.loaded(s,s.game.g);
 const reloaded=s.engineModule.TycoonEngine.load();
 assert.equal(reloaded.g.activeActivistCampaign,null,'reload keeps the proposal completed');assert.equal(reloaded.acceptShareholderProposal(),false,'no re-accept after reload');
 close(reloaded.g.dividendPerShare,after.dividendPerShare,'reloaded declared dividend');
 const paid=await payWeek(s.game);
 for(const key of ['dividend','personal','company'])close(paid[key],expected[key],`1:${ratios.join('x')} paid ${key} equals the never-split control`);
 assert.ok(expected.dividend>0,'control actually pays a dividend');
 console.log(`activism x split case A dividend 1:${ratios.join('x')} accept once / no total growth / reload no re-accept PASS`);
}
// Case B: buyback proposal (yen-denominated) after a split: cash and treasury move once.
async function caseB(){
 const s=await campaignScenario('buyback',{ratios:[2]}),h=faultCase('buyback',[2]),before=snapshot(s.game),draws=s.host.draws;
 assert.equal(s.game.acceptShareholderProposal(),true);assert.equal(s.host.draws,draws);
 const after=snapshot(s.game);expectAccepted('buyback')(before,after,s);
 await s.backend.flush();await h.loaded(s,s.game.g);
 const reloaded=s.engineModule.TycoonEngine.load();
 assert.equal(reloaded.acceptShareholderProposal(),false,'no re-accept after reload');
 assert.equal(reloaded.g.treasuryBuybackShares,after.treasuryBuybackShares);assert.equal(reloaded.g.companyCash,after.companyCash);
 console.log('activism x split case B buyback 1:2 accept once / reload no re-accept PASS');
}
// Case C: negotiate / reject after a split persist; failed saves roll back; a commitment negotiated
// before the split is rescaled and the later accepted dividend fulfils it.
async function caseC(){
 for(const action of ['negotiate','reject']){
  const s=await campaignScenario('dividend',{ratios:[2]}),h=faultCase('dividend',[2]),draws=s.host.draws;
  const run=game=>action==='negotiate'?game.negotiateShareholderProposal():game.rejectShareholderProposal();
  assert.equal(run(s.game),true);assert.equal(s.host.draws,draws);
  const live=snapshot(s.game),c=live.activeActivistCampaign;
  assert.equal(c.response,action==='negotiate'?'negotiation':'reject');close(c.dividendPerShare,DIVIDEND/2,'rescaled term kept');
  if(action==='negotiate'){const commitment=live.governanceCommitments.find(x=>x.campaignID===c.id);close(commitment.target,DIVIDEND/2,'commitment created from the rescaled term');}
  await s.backend.flush();await h.loaded(s,s.game.g);
  for(const kind of ['save-false','save-throw']){
   const t=await campaignScenario('dividend',{ratios:[2]}),before=snapshot(t.game),bytes=t.backend.readSync(t.key),save=t.game.save;let result,error;
   t.game.save=kind==='save-false'?()=>false:function(...a){const r=save.apply(this,a);if(!this.inTransaction())throw new Error('save accepted then threw');return r;};
   try{result=run(t.game);}catch(ex){error=ex;}finally{t.game.save=save;}
   if(kind==='save-false')assert.equal(result,false);else assert.match(error?.message||'',/threw/);
   assert.deepEqual(snapshot(t.game),before,`${action} ${kind} rolls back`);assert.equal(t.backend.readSync(t.key),bytes);
   await t.backend.flush();assert.equal(t.durable.get(t.key),bytes);
   assert.equal(run(t.game),true,`${action} retry after ${kind}`);
  }
  console.log(`activism x split case C ${action} after 1:2 persists / rolls back on save failure PASS`);
 }
 const s=await campaignScenario('dividend',{ratios:[2],respond:'negotiate'}),g=s.game.g;
 const commitment=g.governanceCommitments.find(x=>x.campaignID===g.activeActivistCampaign.id);
 close(commitment.target,DIVIDEND/2,'pre-split commitment rescaled');
 assert.equal(s.game.acceptShareholderProposal(),true,'accept after negotiate + split');
 close(g.dividendPerShare*outstanding(g),s.proposedTotal,'accepted total equals the pre-split proposal');
 while(g.week<commitment.dueWeek)assert.notEqual(s.game.advanceWeek(false),false);
 assert.equal(g.governanceCommitments.find(x=>x.id===commitment.id).status,'fulfilled','accepted rescaled dividend fulfils the rescaled commitment');
 assert.equal(finance.validate(snapshot(s.game)).ok,true);
 console.log('activism x split case C negotiate -> split -> accept fulfils the commitment PASS');
}
(async()=>{
 for(const ratios of [[2],[3],[2,3]])await caseA(ratios);
 for(const [type,ratios] of [['dividend',[2]],['dividend',[2,3]],['buyback',[2]]]){
  const h=faultCase(type,ratios);
  for(const nested of [false,true])for(const kind of FAULT_KINDS)await h.rejected(type,kind,{nested});
  for(const kind of ['save-false','save-throw'])await h.rejected(type,kind,{pending:true});
 }
 await caseB();
 await caseC();
 console.log('Shareholder activism x stock split integration PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
