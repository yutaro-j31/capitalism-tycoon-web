'use strict';
// #966: the listed subsidiary's quarterly market catch-up and parent dividend now commit inside the week. The
// week-26 quarter (week 25 -> 26) is one production week transaction: every injected save fault rolls live,
// mirror, cache and durable state back (cash, ledger, price index, valuation, dividend record, RNG); the retry books
// the dividend once; reload and a fresh durable-only hydration agree. Shared fault harness, Node fake IndexedDB.
const assert=require('node:assert/strict');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const {LISTED_EVE,snapshot,economic,listedEve,listedDividendRows,dividendRows}=require('./fixtures/subsidiary-quarter-close');

const command=ctx=>ctx.game.advanceWeek(false)!==false;
function expectQuarter(before,after,ctx){
 assert.equal(after.week,LISTED_EVE+1,'the quarter week committed');
 assert.equal(ctx.modules.finance.validate(after).ok,true,'company accounting valid after the quarter close');
 assert.equal(dividendRows(after).length,0,'no #971 subsidiary dividend');
 const sub=after.subsidiaries.find(x=>x.id===ctx.subsidiaryID),rows=listedDividendRows(after,ctx.subsidiaryID,after.week);
 assert.equal(sub.marketLastWeek,after.week,'market caught up inside the week');
 assert.ok(rows.length<=1,'listed dividend at most once');assert.equal(sub.lastDividendWeek,after.week,'quarter settled');
 assert.equal(listedDividendRows(after,ctx.subsidiaryID).length,listedDividendRows(before,ctx.subsidiaryID).length+rows.length,'no other dividend');
}
const h=makeTransactionFaultCase({name:'listed quarter close',fixture:()=>listedEve(),command,snapshot,economic,expectSuccess:expectQuarter,
 label:(_,fault,{pending})=>`listed subsidiary quarter close ${fault}/pending=${pending}`});
// A week commits as change (inside the transaction) -> saved -> week and never emits notify, so the harness's
// post-commit 'change' / 'notify' kinds do not apply; 'saved' is the post-commit event fault for a week.
const WEEK_FAULTS=FAULT_KINDS.filter(kind=>!['change','notify'].includes(kind));
(async()=>{
 for(const fault of WEEK_FAULTS)await h.rejected('listed',fault);
 for(const fault of ['save-false','save-throw'])await h.rejected('listed',fault,{pending:true});
 const ctx=await listedEve(),before=snapshot(ctx.game),draws=ctx.host.draws,events=[],emit=ctx.game.emit;
 ctx.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
 assert.equal(command(ctx),true);ctx.game.emit=emit;
 expectQuarter(before,snapshot(ctx.game),ctx);assert.equal(ctx.host.draws,draws,'no host RNG draws');
 assert.deepEqual(events,['change','saved','week'],'single week commit');
 assert.equal(listedDividendRows(ctx.game.g,ctx.subsidiaryID,26).length,1,'the week-26 listed dividend is paid in this fixture');
 const replay=await listedEve();assert.equal(command(replay),true);
 assert.deepEqual(economic(replay.game.g),economic(ctx.game.g),'deterministic quarter close');
 await ctx.backend.flush();await h.loaded(ctx,ctx.game.g);
 console.log('listed subsidiary quarter close normal / single commit / dividend once / deterministic / reload / fresh hydration PASS');
 console.log('Listed subsidiary quarter save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
