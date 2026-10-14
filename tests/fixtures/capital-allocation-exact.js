'use strict';
// #978 group capital allocation through production writers: runGroupCapitalAllocationPlan -> executeGroupCapitalAllocation
// on a VC subsidiary (fractional company cash, as in any normal play), an M&A subsidiary, and a taken-private listing
// whose book carries a legacy fraction. Shared by the Node accounting test, the save-atomicity test and the WebKit test.
const assert=require('node:assert/strict');
const {boot,advance,liveGame,snapshot,economic}=require('./subsidiary-quarter-close');
const {privateGame,FRACTION}=require('./subsidiary-disposal');

const WEEK=14;
const validate=ctx=>ctx.modules.finance.validate(snapshot(ctx.game));
const builders={
 vc:()=>liveGame('vc',WEEK),
 ma:()=>liveGame('ma',WEEK),
 book:()=>privateGame(FRACTION)
};
const states={};
function stateOf(kind){return states[kind]||(states[kind]=JSON.stringify(builders[kind]().game.g));}
// A fresh production runtime over the stored state, saved once so the durable predecessor exists.
async function eve(kind){
 const ctx=boot();await ctx.backend.hydrate();
 const game=new ctx.engineModule.TycoonEngine(JSON.parse(stateOf(kind)));
 assert.equal(ctx.modules.finance.validate(snapshot(game)).ok,true,`${kind} accounting valid before the allocation`);
 assert.ok(!Number.isInteger(game.g.companyCash),`${kind}: company cash carries a fraction`);
 assert.equal(game.runGroupCapitalAllocationPlan(),true,'production capital-allocation plan');
 assert.equal(game.save(),true);await ctx.backend.flush();
 return {...ctx,game,kind};
}
const execute=ctx=>ctx.game.executeGroupCapitalAllocation()!==false;
// Cash falls by exactly the ledger amount, each subsidiary's book rises by exactly its whole-yen allocation, and the
// fractional parts survive; accounting is valid at once.
function expectAllocated(before,after,ctx){
 const box=after.groupCapitalAllocation,run=box.executions[0],rows=after.finance.transactions.slice(before.finance.transactions.length).filter(t=>t.sourceType==='groupCapitalAllocationExecution');
 assert.equal(rows.length,1,'one allocation ledger row');assert.equal(Number.isInteger(run.total),true,'allocation stays whole yen');
 assert.equal(after.companyCash,before.companyCash+rows[0].cashEffect,'cash moves by exactly the ledger amount');
 assert.equal(after.companyCash-Math.trunc(after.companyCash),before.companyCash-Math.trunc(before.companyCash),'the cash fraction is kept');
 for(const r of run.rows){
  const all=s=>[...(s.maSubsidiaries||[]),...(s.subsidiaries||[])],pre=all(before).find(x=>String(x.id)===r.id),now=all(after).find(x=>String(x.id)===r.id);
  const key=(before.maSubsidiaries||[]).some(x=>String(x.id)===r.id)?'identifiableNetAssetsBookValue':'carryingBookValue';
  assert.equal(now[key],Number(pre[key])+r.amount,`${r.id}: book rises by exactly the allocation (${key})`);
 }
 assert.equal(ctx.modules.finance.validate(after).ok,true,'finance.validate right after the allocation');
}
module.exports={WEEK,FRACTION,validate,stateOf,eve,execute,expectAllocated,advance,snapshot,economic};
