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
 const s=await scenario('own');Object.assign(s.game.g,{isCompanySold:true,personalCash:200_000_000,companyName:'旧会社'});
 assert.equal(s.game.save(),true);await s.backend.flush();return s;
}
function expectFounded(before,after,ctx){
 assert.deepEqual([after.companyName,after.isCompanySold,after.configured],['新会社',false,true]);
 assert.equal(after.personalCash,before.personalCash-INVESTMENT,'investment leaves personal cash once');
 assert.equal(after.companyCash,INVESTMENT,'new company capitalised with the investment');
 assert.equal(after.currentCompanyFoundedInvestment,INVESTMENT,'pe-fund founded-investment record is part of the commit');
 assert.equal(after.week,before.week);
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
 console.log('Found new company save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
