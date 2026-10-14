'use strict';
// #978: group capital allocation moves company cash and the parent's book by exactly the ledger amount. Before the
// fix executeGroupCapitalAllocation floored company cash (and a fractional book) with integer() and no ledger row, so
// finance.validate failed at once (P2-CLOSE-BS-IDENTITY ~ the dropped fraction) and the next week never closed.
// Production writers only: VC subsidiary with fractional cash, M&A subsidiary, taken-private listing with a legacy
// fractional book. Validate at once and for 13 weeks, reload, deterministic replay, no host RNG draws.
const assert=require('node:assert/strict');
const A=require('./fixtures/capital-allocation-exact');
const {eve,execute,expectAllocated,advance,snapshot,economic,validate}=A;

function closes(ctx,weeks=13){const start=ctx.game.g.week;for(let i=0;i<weeks;i++){advance(ctx.game);assert.equal(validate(ctx).ok,true,`week ${ctx.game.g.week} accounting valid`);}assert.equal(ctx.game.g.week,start+weeks);}
(async()=>{
 for(const kind of ['vc','ma','book']){
  const ctx=await eve(kind),before=snapshot(ctx.game),draws=ctx.host.draws;
  assert.equal(execute(ctx),true,`${kind}: production allocation`);assert.equal(ctx.host.draws,draws,'no host RNG draws');
  expectAllocated(before,snapshot(ctx.game),ctx);
  await ctx.backend.flush();
  const loaded=ctx.engineModule.TycoonEngine.load();assert.equal(loaded.g.saveVersion,9);
  assert.deepEqual(economic(loaded.g),economic(new ctx.engineModule.TycoonEngine(snapshot(ctx.game)).g),'reload keeps the allocated state');
  closes(ctx);
  const replay=await eve(kind);assert.equal(execute(replay),true);closes(replay);
  assert.deepEqual(economic(replay.game.g),economic(ctx.game.g),`${kind}: deterministic replay`);
  console.log(`capital allocation ${kind} / exact cash and book / validate at once / reload / 13 weeks / deterministic PASS`);
 }
 console.log('Group capital allocation cash exact PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
