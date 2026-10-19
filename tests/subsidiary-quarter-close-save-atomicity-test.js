'use strict';
// #971: the first quarter close with a VC or M&A subsidiary (week 12 -> 13) is one production week transaction.
// Every injected save fault rolls live, mirror, cache and durable state back (including RNG and the subsidiary's
// retainedEarnings); the retry commits the quarter with no subsidiary dividend and valid accounting; reload and a
// fresh durable-only hydration agree. Shared fault harness, Node fake IndexedDB only (WebKit is a separate test).
const assert=require('node:assert/strict');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const {QUARTER_EVE,snapshot,economic,quarterEve,subsidiaryOf,dividendRows}=require('./fixtures/subsidiary-quarter-close');

// advanceWeek returns false when the week's save is refused; any other result is a committed week.
const command=ctx=>ctx.game.advanceWeek(false)!==false;
function expectQuarter(before,after,ctx){
 assert.equal(after.week,QUARTER_EVE+1,'the quarter week committed');
 assert.equal(ctx.modules.finance.validate(after).ok,true,'company accounting valid after the quarter close');
 assert.equal(dividendRows(after).length,0,'no subsidiary dividend row');
 const prior=subsidiaryOf(before,ctx.kind,ctx.subsidiaryID),sub=subsidiaryOf(after,ctx.kind,ctx.subsidiaryID);
 assert.ok(Math.abs(sub.retainedEarnings-(prior.retainedEarnings+sub.weeklyProfit))<1e-6,'retainedEarnings only accumulates the week\'s profit');
 for(const key of ['ownership','carryingBookValue','investedCost','acquisitionPrice'])assert.equal(sub[key],prior[key],`${key} unchanged`);
}
const h=makeTransactionFaultCase({name:'quarter close',fixture:kind=>quarterEve(kind),command,snapshot,economic,expectSuccess:expectQuarter,
 label:(kind,fault,{pending})=>`${kind} subsidiary quarter close ${fault}/pending=${pending}`});
// A week commits as change (inside the transaction) -> saved -> week, and never emits notify. The harness's
// 'change' / 'notify' kinds target a post-commit change / a notify, which a week never raises; the post-commit
// event fault for a week is 'saved'. The normal path below asserts that exact event order.
const WEEK_FAULTS=FAULT_KINDS.filter(kind=>!['change','notify'].includes(kind));
(async()=>{
 for(const kind of ['vc','ma']){
  for(const fault of WEEK_FAULTS)await h.rejected(kind,fault);
  for(const fault of ['save-false','save-throw'])await h.rejected(kind,fault,{pending:true});
  const ctx=await quarterEve(kind),before=snapshot(ctx.game),draws=ctx.host.draws,events=[],emit=ctx.game.emit;
  ctx.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
  assert.equal(command(ctx),true);ctx.game.emit=emit;
  expectQuarter(before,snapshot(ctx.game),ctx);assert.equal(ctx.host.draws,draws,'no host RNG draws');
  assert.deepEqual(events,['change','saved','week'],'single week commit');
  // Same seed, same week: an unfaulted replay from the same week-12 state reaches the identical quarter.
  const replay=await quarterEve(kind);assert.equal(command(replay),true);
  assert.deepEqual(economic(replay.game.g),economic(ctx.game.g),'deterministic quarter close');
  await ctx.backend.flush();await h.loaded(ctx,ctx.game.g);
  console.log(`${kind} subsidiary quarter close normal / single commit / deterministic / reload / fresh hydration PASS`);
 }
 console.log('Subsidiary quarter close save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
