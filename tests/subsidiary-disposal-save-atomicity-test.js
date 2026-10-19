'use strict';
// #975: a group-restructuring sale or liquidation is one production transaction. Every injected save fault rolls
// live, mirror, cache and durable state back (cash, ledger, subsidiary status/book, RNG); the retry disposes once
// with accounting valid at once; reload and a fresh durable-only hydration agree. Shared fault harness, Node fake IDB.
const assert=require('node:assert/strict');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const D=require('./fixtures/subsidiary-disposal');
const {snapshot,economic,subOf,distress,vcEve}=D;

const commands={
 sold:ctx=>ctx.game.executeGroupRestructuringSale(ctx.subsidiaryID)!==false,
 liquidated:ctx=>ctx.game.executeGroupRestructuringLiquidation(ctx.subsidiaryID)!==false
};
// The liquidation signals are operating inputs set before the snapshot, so a rollback restores them too.
async function fixture(kind){const ctx=await vcEve();if(kind==='liquidated'){distress(subOf(ctx.game.g,ctx.subsidiaryID));assert.equal(ctx.game.save(),true);await ctx.backend.flush();}return {...ctx,kind};}
const cases=Object.fromEntries(Object.keys(commands).map(kind=>[kind,makeTransactionFaultCase({name:`subsidiary ${kind}`,fixture,command:ctx=>commands[ctx.kind](ctx),snapshot,economic,
 expectSuccess:(before,after,ctx)=>D.expectDisposed(before,after,ctx,{status:ctx.kind}),label:(variant,fault,{pending})=>`subsidiary disposal ${variant} ${fault}/pending=${pending}`})]));
// The disposal writers raise no 'notify' (their outcome is the ledger row and the restructuring history), so the
// harness's notify fault has no writer to reach; 'change' and 'saved' are the post-commit event faults here.
const DISPOSAL_FAULTS=FAULT_KINDS.filter(kind=>kind!=='notify');
(async()=>{
 for(const kind of Object.keys(commands)){
  for(const fault of DISPOSAL_FAULTS)await cases[kind].rejected(kind,fault);
  for(const fault of ['save-false','save-throw'])await cases[kind].rejected(kind,fault,{pending:true});
  const ctx=await fixture(kind),before=snapshot(ctx.game),draws=ctx.host.draws;
  assert.equal(commands[kind](ctx),true);D.expectDisposed(before,snapshot(ctx.game),ctx,{status:kind});assert.equal(ctx.host.draws,draws,'no host RNG draws');
  const replay=await fixture(kind);assert.equal(commands[kind](replay),true);
  assert.deepEqual(economic(replay.game.g),economic(ctx.game.g),`deterministic ${kind}`);
  await ctx.backend.flush();await cases[kind].loaded(ctx,ctx.game.g);
  console.log(`subsidiary disposal ${kind} normal / validate at once / deterministic / reload / fresh hydration PASS`);
 }
 console.log('Subsidiary disposal save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
