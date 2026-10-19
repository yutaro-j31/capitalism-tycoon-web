'use strict';
// #955 (7C): founding a new company after a buyout replaces the whole game state. The replacement and
// the pe-fund wrapper's founded-investment record must commit with one save: a failed save never
// reports success (live new company vs durable sold company), and a successful one reloads exactly.
const assert=require('node:assert/strict');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS,injectFault}=require('./helpers/transaction-fault-case');
// The success toast is emitted only after the outermost commit (#955 review), so a notify listener fault no longer
// happens inside the transaction: it is covered below as a post-commit fault instead of a rollback case.
const REFOUNDING_FAULTS=FAULT_KINDS.filter(kind=>kind!=='notify');
const INVESTMENT=50_000_000;
async function fixture(){
 const s=await scenario('own');Object.assign(s.game.g,{personalCash:200_000_000,companyName:'旧会社'});
 // A real personal VC purchase must not be lost when the founder replaces the sold company.
 const target=s.game.g.startups.find(x=>x.alive&&!x.subsidiary&&!x.ipoStockID&&x.minTicket<=100_000_000);
 assert.ok(target,'available VC target');
 assert.equal(s.game.investStartup(target.id,Math.max(20_000_000,target.minTicket),'personal'),true,'actual personal VC purchase');
 s.game.g.isCompanySold=true;
 assert.equal(s.game.save(),true);await s.backend.flush();return s;
}
function expectFounded(before,after,ctx){
 assert.deepEqual([after.companyName,after.isCompanySold,after.configured],['新会社',false,true]);
 assert.equal(after.personalCash,before.personalCash-INVESTMENT,'investment leaves personal cash once');
 assert.equal(after.companyCash,INVESTMENT,'new company capitalised with the investment');
 assert.equal(after.currentCompanyFoundedInvestment,INVESTMENT,'pe-fund founded-investment record is part of the commit');
 assert.equal(after.week,before.week);
 for(const old of before.startups.filter(x=>x.ownedPersonal>0||x.activeFundingRound?.contributedPersonal>0)){
  const kept=after.startups.filter(x=>x.id===old.id);
  assert.equal(kept.length,1,'one matching VC source identity retained');
  assert.equal(kept[0].name,old.name,'original VC company identity, not generated placeholder');
  assert.equal(kept[0].ownedPersonal,old.ownedPersonal,'personal VC stake survives');
  assert.equal(kept[0].totalInvestedPersonal,old.totalInvestedPersonal,'personal investment cost survives');
  assert.equal(kept[0].ownedCompany,0,'sold-company VC stake stays with purchaser');
  assert.equal(kept[0].totalInvestedCompany,0,'sold-company VC carrying cost is not transferred');
  if(old.activeFundingRound){assert.equal(kept[0].activeFundingRound?.contributedPersonal,old.activeFundingRound.contributedPersonal,'pending personal contribution survives');
    assert.equal(kept[0].activeFundingRound.contributedCompany,0,'sold-company pending contribution is not carried');}
 }
 assert.ok(after.pastCompanyRecords.length>=before.pastCompanyRecords.length,'history preserved');
 // #968: the new company's book opens at the contribution and is valid at once.
 assert.equal(after.finance.openingCash,INVESTMENT,'opening cash is the contribution');
 if(ctx)assert.equal(ctx.modules.finance.validate(after).ok,true,'new company ledger valid at once');
}
// Every refounding call counts its success toasts (a storage failure may still raise its own error notice): one after a committed outermost call, none on a failure or a
// nested call (the outer caller owns the commit).
function refound(s){
 const emit=s.game.emit,toasts=[];let result,threw=true;
 s.game.emit=function(type='change',...args){if(type==='notify'&&args[0]?.severity==='success')toasts.push(args[0]);return emit.call(this,type,...args);};
 try{result=s.game.foundNewCompanyAfterBuyout('新会社',INVESTMENT,'store');threw=false;}
 finally{s.game.emit=emit;const committed=!threw&&result===true&&!s.game.inTransaction();
  assert.equal(toasts.length,committed?1:0,committed?'one success toast after the commit':'no success toast without a commit');
  if(committed)assert.equal(JSON.stringify(toasts[0]),JSON.stringify({message:'新会社を創業しました。',severity:'success'}));}
 return result;
}
const h=makeTransactionFaultCase({name:'company refounding',fixture,command:refound,snapshot,economic,
 expectSuccess:expectFounded,label:(v,kind,{pending,nested})=>`foundNewCompanyAfterBuyout ${kind}/pending=${pending}/nested=${nested}`});
(async()=>{
 for(const nested of [false,true])for(const kind of REFOUNDING_FAULTS)await h.rejected('company',kind,{nested});
 for(const kind of ['save-false','save-throw'])await h.rejected('company',kind,{pending:true});
 // Root identity: callers holding the engine state object keep observing it after both outcomes.
 for(const fail of [true,false]){
  const s=await fixture(),root=s.game.g,save=s.game.save;if(fail)s.game.save=()=>false;
  const result=s.game.foundNewCompanyAfterBuyout('新会社',INVESTMENT,'store');s.game.save=save;
  assert.equal(result,!fail);assert.equal(s.game.g,root,`state root identity kept after ${fail?'failed':'successful'} refounding`);
  assert.equal(root.companyName,fail?'旧会社':'新会社');
 }
 // The founded-investment record is the contribution actually made (minimum 1,000,000 yen, whole yen), as the
 // new company's opening cash and the personal-cash debit are, not the raw input.
 for(const [input,made] of [[0,1_000_000],[-5,1_000_000],[12_345_678.9,12_345_678],['abc',1_000_000],[INVESTMENT,INVESTMENT]]){
  const s=await fixture(),personal=s.game.g.personalCash;
  assert.equal(s.game.foundNewCompanyAfterBuyout('新会社',input,'store'),true);
  assert.deepEqual([s.game.g.companyCash,personal-s.game.g.personalCash,s.game.g.currentCompanyFoundedInvestment],[made,made,made],`input ${input}: contribution, debit and record agree`);
  await s.backend.flush();assert.equal(s.engineModule.TycoonEngine.load().g.currentCompanyFoundedInvestment,made,`input ${input}: reload keeps the record`);
 }
 console.log('foundNewCompanyAfterBuyout founded investment = contribution actually made / reload PASS');
 // A throwing notify listener runs after the commit: the founding is already saved and durable, and it reloads.
 {const s=await fixture(),before=snapshot(s.game),injection=injectFault(s,'notify');let error;
  try{s.game.foundNewCompanyAfterBuyout('新会社',INVESTMENT,'store');}catch(ex){error=ex;}finally{injection.restore();}
  assert.equal(injection.hits(),1,'the toast is emitted once');assert.match(error?.message||'',/threw/);
  expectFounded(before,snapshot(s.game),s);await s.backend.flush();await h.loaded(s,s.game.g);
  console.log('foundNewCompanyAfterBuyout notify listener fault after the commit / founding saved / reload / fresh hydration PASS');}
 const s=await fixture(),before=snapshot(s.game),events=[],emit=s.game.emit;
 s.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
 assert.equal(s.game.foundNewCompanyAfterBuyout('新会社',INVESTMENT,'store'),true);s.game.emit=emit;
 expectFounded(before,snapshot(s.game),s);assert.equal(events.join(),'saved,change,notify','single commit, then the success toast');
 assert.equal(s.game.g.news[0],`第${s.game.g.week}週：新会社を創業しました。`,'the founding news line is committed with the state');
 await s.backend.flush();await h.loaded(s,s.game.g);
 assert.equal(s.engineModule.TycoonEngine.load().g.currentCompanyFoundedInvestment,INVESTMENT,'reload keeps the founded investment');
 assert.equal(s.game.foundNewCompanyAfterBuyout('次の会社',INVESTMENT,'store'),false,'cannot refound an unsold company');
 // The founded company keeps closing: 13 weeks, every week ledger-valid.
 {const start=s.game.g.week;for(let i=0;i<13;i++){assert.notEqual(s.game.advanceWeek(false),false,`week ${s.game.g.week+1} commits`);assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true,`week ${s.game.g.week} ledger valid`);}assert.equal(s.game.g.week,start+13);}
 console.log('foundNewCompanyAfterBuyout normal / single commit / live equals reload / fresh hydration PASS');
 // Mixed company/personal VC and an open financing round: only personal equity and funded
 // personal commitment survive; old company capital and subscriptions never transfer.
 {const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  s.game.g.isCompanySold=false;
  const amount=Math.max(20_000_000,st.minTicket);
  assert.equal(s.game.investStartup(st.id,amount,'company'),true,'real company VC purchase');
  st.fundingOpen=true;
  assert.equal(s.game.openStartupFundingRound(st),true,'real follow-on round');
  const plan=s.game.getStartupFundingRoundPlan(st.id);
  assert.ok(plan?.personal.remaining>0&&plan.company.remaining>0,'mixed owned round');
  const personalAmount=Math.min(1_000_000,plan.personal.remaining/2),companyAmount=Math.min(1_000_000,plan.company.remaining/2);
  assert.equal(s.game.participateStartupFundingRound(st.id,personalAmount,'personal'),true,'personal funded subscription');
  assert.equal(s.game.participateStartupFundingRound(st.id,companyAmount,'company'),true,'company funded subscription');
  s.game.g.isCompanySold=true;
  assert.equal(s.game.save(),true);await s.backend.flush();
  const before=snapshot(s.game);assert.equal(s.game.foundNewCompanyAfterBuyout('新会社',INVESTMENT,'store'),true);
  const after=snapshot(s.game);expectFounded(before,after,s);
  const kept=after.startups.find(x=>x.id===st.id),r=kept.activeFundingRound;
  assert.equal(r?.contributedPersonal,personalAmount);
  assert.equal(r?.contributedCompany,0);
  assert.equal(r?.preRoundOwnedCompany,0);
  assert.equal(after.startupFundingHistory[st.id]?.some(x=>x.account==='company'),false,'sold company funding evidence excluded');
  assert.equal(after.startups.filter(x=>x.id===st.id).length,1,'no duplicate startup ID');
  await s.backend.flush();await h.loaded(s,s.game.g);
  console.log('P1 #1008 mixed VC/personal pending round / no asset transfer / fresh hydration PASS');}
 // Installed production sale command, not direct isCompanySold mutation: retain the same
 // legal ownership through sale, successful refounding and durable reload.
 {const s=await scenario('own');s.game.g.personalCash=200_000_000;
  const st=s.game.g.startups.find(x=>x.alive&&!x.subsidiary&&!x.ipoStockID&&x.minTicket<=100_000_000);
  assert.ok(st,'real-sale target');
  assert.equal(s.game.investStartup(st.id,Math.max(st.minTicket,20_000_000),'personal'),true);
  const held=st.ownedPersonal;
  assert.equal(s.game.acceptBuyoutOffer(1.2),true,'installed company sale command');
  assert.equal(s.game.g.startups.find(x=>x.id===st.id).ownedPersonal,held,'stake survives sale');
  assert.equal(s.game.foundNewCompanyAfterBuyout('新会社',INVESTMENT,'store'),true,'installed founding command');
  assert.equal(s.game.g.startups.find(x=>x.id===st.id).ownedPersonal,held,'stake survives refounding');
  await s.backend.flush();
  assert.equal(s.engineModule.TycoonEngine.load().g.startups.find(x=>x.id===st.id).ownedPersonal,held,'durable VC persists');
  await h.loaded(s,s.game.g);
  console.log('P1 #1008 real sale -> refound -> durable/fresh VC ownership PASS');}
 // Every original source participates in ID validation, including unheld/company-only rows.
 for(const companyOwned of [false,true])for(const conflictFirst of [false,true]){
  const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  const duplicate={...JSON.parse(JSON.stringify(st)),name:'異なる発行体',ownedPersonal:0,totalInvestedPersonal:0,
   ownedCompany:companyOwned?0.1:0,totalInvestedCompany:companyOwned?1_000_000:0,activeFundingRound:null};
  if(conflictFirst)s.game.g.startups.unshift(duplicate);else s.game.g.startups.push(duplicate);
  const before=snapshot(s.game),mirror=s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY);
  assert.equal(s.game.foundNewCompanyAfterBuyout('新会社',INVESTMENT,'store'),false,'ambiguous old startup identity must reject');
  assert.deepEqual(snapshot(s.game),before,'rejected refounding preserves live state and all assets');
  await s.backend.flush();
  assert.equal(s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY),mirror,'rejected identity does not write a new save');
 }
 console.log('P1 #1008 duplicate personal/unheld/company source IDs in both row orders rejected PASS');
 // #1027: malformed legacy rounds must not cross wholesale state replacement.
 // Start with real opening/subscription writers, then deliberately corrupt saved evidence.
 for(const corrupt of [r=>delete r.closesWeek,r=>r.preMoneyValuation=0,r=>r.targetRaise=-1,
  r=>r.postMoneyValuation+=1,r=>delete r.contributedCompany,r=>r.preRoundOwnedCompany=NaN]){
  const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  st.fundingOpen=true;assert.equal(s.game.openStartupFundingRound(st),true);
  const amount=Math.min(1_000_000,s.game.getStartupFundingRoundPlan(st.id).personal.remaining/2);
  assert.equal(s.game.participateStartupFundingRound(st.id,amount,'personal'),true);
  corrupt(st.activeFundingRound);assert.equal(s.game.getStartupFundingRoundPlan(st.id),null);
  const before=snapshot(s.game),root=s.game.g,mirror=s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY);
  assert.equal(refound(s),false,'invalid personally funded round rejects refounding');
  assert.equal(s.game.g,root);assert.deepEqual(snapshot(s.game),before,'all live assets and RNG unchanged');
  await s.backend.flush();assert.equal(s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY),mirror,'no replacement save');
 }
 console.log('#1027 invalid personally funded rounds rejected without replacement/save/RNG mutation PASS');
 // P1 review: finite values alone do not prove economic validity. These all
 // pass the legacy plan reader but must never survive wholesale replacement.
 for(const corrupt of [r=>r.preRoundOwnedPersonal=-1,r=>r.preRoundOwnedPersonal=1.1,
  r=>r.preRoundOwnedCompany=-.1,r=>r.preRoundOwnedCompany=1.1,
  r=>r.contributedCompany=-1,r=>r.contributedCompany=r.targetRaise+1,
  r=>r.contributedPersonal=r.targetRaise+1,r=>r.contributedPersonal=-1]){
  const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  st.fundingOpen=true;assert.equal(s.game.openStartupFundingRound(st),true);
  assert.equal(s.game.participateStartupFundingRound(st.id,Math.min(1_000_000,s.game.getStartupFundingRoundPlan(st.id).personal.remaining/2),'personal'),true);
  corrupt(st.activeFundingRound);
  const before=snapshot(s.game),root=s.game.g,mirror=s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY);
  assert.equal(refound(s),false,'out-of-range retained evidence rejects refounding');
  assert.equal(s.game.g,root);assert.deepEqual(snapshot(s.game),before);
  await s.backend.flush();assert.equal(s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY),mirror);
 }
 console.log('P1 retained round economic bounds / both accounts / no replacement or save PASS');
 // In-range snapshots must still describe the current legal source. Otherwise
 // closing a retained round can erase or inflate a previously purchased stake.
 for(const [account,ownership] of [['personal',0],['personal',.8],['company',.4]]){
  const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  st.fundingOpen=true;assert.equal(s.game.openStartupFundingRound(st),true);
  st.activeFundingRound[account==='personal'?'preRoundOwnedPersonal':'preRoundOwnedCompany']=ownership;
  const before=snapshot(s.game),root=s.game.g,mirror=s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY);
  assert.equal(refound(s),false,'contradictory source ownership rejects refounding');
  assert.equal(s.game.g,root);assert.deepEqual(snapshot(s.game),before,'assets and RNG unchanged');
  await s.backend.flush();assert.equal(s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY),mirror,'no replacement save');
  s.game.g.week=st.activeFundingRound.closesWeek;
  const due=snapshot(s.game);assert.equal(s.game.closeStartupFundingRound(st),false,'direct close rejects contradictory source ownership');
  assert.deepEqual(snapshot(s.game),due);
  const held=JSON.stringify(st.activeFundingRound);s.game.updateStartups();
  assert.equal(JSON.stringify(st.activeFundingRound),held,'weekly close preserves the rejected funded snapshot');
 }
 console.log('Retained round source ownership consistency / both accounts PASS');
 // P1: the entire target raise is not either account's legal pro-rata limit.
 // Use the installed participation writer as the boundary oracle, not a new policy.
 for(const account of ['company','personal'])for(const excess of [false,true]){
  const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  if(account==='company'){
   s.game.g.isCompanySold=false;
   assert.equal(s.game.investStartup(st.id,Math.max(20_000_000,st.minTicket),'company'),true);
   s.game.g.isCompanySold=true;
  }
  st.fundingOpen=true;assert.equal(s.game.openStartupFundingRound(st),true);
  const plan=s.game.getStartupFundingRoundPlan(st.id),amount=plan[account].proRataRequired+(excess?1:5e-8);
  assert.equal(s.game.participateStartupFundingRound(st.id,amount,account),!excess,'existing writer tolerance');
  if(excess)st.activeFundingRound[account==='company'?'contributedCompany':'contributedPersonal']=amount;
  const before=snapshot(s.game),root=s.game.g,mirror=s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY);
  assert.equal(refound(s),!excess,'reject impossible contribution; retain writer-admitted tolerance');
  if(excess){assert.equal(s.game.g,root);assert.deepEqual(snapshot(s.game),before);
   await s.backend.flush();assert.equal(s.ctx.localStorage.getItem(s.engineModule.SAVE_KEY),mirror);}
 }
 {const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  st.fundingOpen=true;assert.equal(s.game.openStartupFundingRound(st),true);
  assert.equal(st.ownedCompany,0);st.activeFundingRound.contributedCompany=1e-8;
  const before=snapshot(s.game);assert.equal(refound(s),false,'zero stake has no participation entitlement');
  assert.deepEqual(snapshot(s.game),before);
 }
 console.log('Retained round pro-rata limits / both accounts / installed tolerance PASS');
 // Inclusive ownership/capital endpoints remain supported; no EPSILON right grants.
 for(const ownership of [0,1]){
  const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  st.ownedPersonal=ownership;st.ownedCompany=1-ownership;
  st.fundingOpen=true;assert.equal(s.game.openStartupFundingRound(st),true);
  assert.equal(refound(s),true,'bounded round endpoint remains supported');
 }
 // Within-entitlement amounts must still be backed by actual personal payments.
 for(const corrupt of [
  (s,st)=>st.activeFundingRound.contributedPersonal=s.game.getStartupFundingRoundPlan(st.id).personal.proRataRequired,
  (s,st)=>delete s.game.g.startupFundingHistory[st.id],
  (s,st)=>delete st.activeFundingRound.openedWeek,
  (s,st)=>s.game.g.startupFundingHistory[st.id]=[],
  (s,st)=>st.totalInvestedPersonal=0,
  (s,st)=>s.game.g.startupFundingHistory[st.id][0].amount+=1,
  (s,st)=>s.game.g.startupFundingHistory[st.id][0].postMoneyValuation+=1,
  (s,st)=>s.game.g.startupFundingHistory[st.id].unshift({...s.game.g.startupFundingHistory[st.id][0]})
 ]){
  const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  st.fundingOpen=true;assert.equal(s.game.openStartupFundingRound(st),true);
  assert.equal(s.game.participateStartupFundingRound(st.id,1_000_000,'personal'),true);
  corrupt(s,st);const before=snapshot(s.game),root=s.game.g,mirror=s.backend.readSync(s.key);
  assert.equal(refound(s),false,'unproven personal payment must not become retained equity');
  assert.equal(s.game.g,root);assert.deepEqual(snapshot(s.game),before);
  await s.backend.flush();assert.equal(s.backend.readSync(s.key),mirror);
  // Refusing refounding must not leave a direct/weekly close bypass to mint
  // the same unpaid equity, nor silently discard the funded corrupt round.
  s.game.g.week=st.activeFundingRound.closesWeek;
  const due=snapshot(s.game);
  assert.equal(s.game.closeStartupFundingRound(st),false);
  assert.deepEqual(snapshot(s.game),due);
  const retained=JSON.stringify(st.activeFundingRound),ownership=st.ownedPersonal;
  s.game.updateStartups();
  assert.equal(JSON.stringify(st.activeFundingRound),retained);
  assert.equal(st.ownedPersonal,ownership);
 }
 // The writer and replacement guard use the same cumulative tolerance. Repeated
 // sub-tolerance commands cannot build an overage rejected by the reader.
 for(const account of ['personal','company']){
  const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
  if(account==='company')assert.equal(s.game.investStartup(st.id,20_000_000,'company'),true);
  st.fundingOpen=true;assert.equal(s.game.openStartupFundingRound(st),true);
  const required=s.game.getStartupFundingRoundPlan(st.id)[account].proRataRequired;
  assert.equal(s.game.participateStartupFundingRound(st.id,required+6e-8,account),true);
  const before=snapshot(s.game);
  assert.equal(s.game.participateStartupFundingRound(st.id,6e-8,account),false);
  assert.deepEqual(snapshot(s.game),before,'cumulative overage rejection never charges cash');
  assert.equal(refound(s),true,'actual supported payment remains retainable');
 }
 const paidHarness=makeTransactionFaultCase({name:'paid-personal-refounding',
  fixture:async()=>{const s=await fixture(),st=s.game.g.startups.find(x=>x.ownedPersonal>0);
   st.fundingOpen=true;assert.equal(s.game.openStartupFundingRound(st),true);
   assert.equal(s.game.participateStartupFundingRound(st.id,1_000_000,'personal'),true);
   await s.backend.flush();return s;},command:refound,snapshot,economic,expectSuccess:expectFounded});
 for(const kind of ['save-false','save-throw'])await paidHarness.rejected('personal',kind,{nested:true});
 console.log('Paid personal round evidence / cumulative writer tolerance PASS');
 console.log('Found new company save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
