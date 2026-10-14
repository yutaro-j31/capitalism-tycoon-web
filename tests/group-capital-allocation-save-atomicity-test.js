'use strict';
// #978: a group capital allocation is one production transaction. Every injected save fault rolls live, mirror,
// cache and durable state back (cash, ledger, books, allocation record, RNG); the retry allocates once with exact
// cash and book and accounting valid at once; reload and a fresh durable-only hydration agree. Shared fault harness,
// Node fake IndexedDB; VC subsidiary with fractional company cash and a taken-private listing with a fractional book.
const assert=require('node:assert/strict');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const {eve,execute,expectAllocated,snapshot,economic}=require('./fixtures/capital-allocation-exact');

const h=makeTransactionFaultCase({name:'group capital allocation',fixture:eve,command:execute,snapshot,economic,expectSuccess:expectAllocated,
 label:(variant,fault,{pending})=>`group capital allocation ${variant} ${fault}/pending=${pending}`});
(async()=>{
 for(const kind of ['vc','book']){
  for(const fault of FAULT_KINDS)await h.rejected(kind,fault);
  for(const fault of ['save-false','save-throw'])await h.rejected(kind,fault,{pending:true});
  const ctx=await eve(kind),before=snapshot(ctx.game),draws=ctx.host.draws;
  assert.equal(execute(ctx),true);expectAllocated(before,snapshot(ctx.game),ctx);assert.equal(ctx.host.draws,draws,'no host RNG draws');
  const replay=await eve(kind);assert.equal(execute(replay),true);
  assert.deepEqual(economic(replay.game.g),economic(ctx.game.g),`deterministic ${kind} allocation`);
  await ctx.backend.flush();await h.loaded(ctx,ctx.game.g);
  console.log(`group capital allocation ${kind} normal / exact / deterministic / reload / fresh hydration PASS`);
 }
 console.log('Group capital allocation save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
