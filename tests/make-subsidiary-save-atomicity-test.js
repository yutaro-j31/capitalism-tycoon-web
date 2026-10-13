'use strict';
// #954 (writer 3/4): makeSubsidiary must consolidate the startup (startup flag, subsidiary record,
// negotiated stake reset) in one transaction; a failed save never reports success or keeps the change.
const assert=require('node:assert/strict');
const {scenario,economic,snapshot}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
async function fixture(){
 const s=await scenario('own'),g=s.game.g,startup=g.startups.find(x=>x.alive!==false);
 Object.assign(startup,{ownedCompany:.6,totalInvestedCompany:30_000_000,ddNegotiatedOwnedCompany:.1,subsidiary:false,activeFundingRound:null});
 g.finance=s.modules.finance.defaultFinanceState(g);
 assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true,'fixture accounting valid');
 assert.equal(s.game.save(),true);await s.backend.flush();
 return Object.assign(s,{startupID:startup.id});
}
function expectConsolidated(before,after,s){
 const startup=after.startups.find(x=>x.id===s.startupID);
 assert.equal(startup.subsidiary,true);assert.equal(startup.ddNegotiatedOwnedCompany,0);
 assert.equal(after.subsidiaries.length,before.subsidiaries.length+1);
 const sub=after.subsidiaries.at(-1);assert.deepEqual([sub.startupID,sub.ownership,sub.carryingBookValue,sub.status],[s.startupID,.6,30_000_000,'active']);
 for(const key of ['companyCash','personalCash'])assert.equal(after[key],before[key],`${key} untouched`);
 assert.equal(s.modules.finance.validate(after).ok,true,'company accounting valid');
}
const h=makeTransactionFaultCase({name:'subsidiary consolidation',fixture,command:s=>s.game.makeSubsidiary(s.startupID),snapshot,economic,
 expectSuccess:expectConsolidated,label:(v,kind,{pending,nested})=>`makeSubsidiary ${kind}/pending=${pending}/nested=${nested}`});
(async()=>{
 for(const nested of [false,true])for(const kind of FAULT_KINDS)await h.rejected('company',kind,{nested});
 for(const kind of ['save-false','save-throw'])await h.rejected('company',kind,{pending:true});
 const s=await fixture(),before=snapshot(s.game),draws=s.host.draws,events=[],emit=s.game.emit;
 s.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
 assert.equal(s.game.makeSubsidiary(s.startupID),true);s.game.emit=emit;
 expectConsolidated(before,snapshot(s.game),s);assert.equal(s.host.draws,draws);assert.deepEqual(events,['notify','saved','change'],'single commit');
 assert.equal(s.game.makeSubsidiary(s.startupID),false,'cannot consolidate twice');
 await s.backend.flush();await h.loaded(s,s.game.g);
 console.log('makeSubsidiary normal / single commit / no double consolidation / reload / fresh hydration PASS');
 console.log('Make subsidiary save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
