'use strict';
// #975: group-restructuring disposals settle the parent's book exactly. A sold, liquidated or integrated subsidiary
// leaves the balance sheet; an explicit book of 0 does not fall back to the acquisition cost; the ledger removes the
// raw (also fractional legacy) book; company cash moves only by ledger amounts. Before the fix every full disposal
// failed finance.validate at once (P2-CLOSE-BS-IDENTITY ~ the whole book) and the next week never closed.
const assert=require('node:assert/strict');
const D=require('./fixtures/subsidiary-disposal');
const {subOf,validate,subsidiaryAssets,distress,advance,snapshot,economic}=D;

function closes(ctx,weeks=13){const start=ctx.game.g.week;for(let i=0;i<weeks;i++){advance(ctx.game);assert.equal(validate(ctx).ok,true,`week ${ctx.game.g.week} accounting valid`);}assert.equal(ctx.game.g.week,start+weeks,`${weeks} weeks after the disposal close`);}
function dispose(ctx,kind,id=ctx.subsidiaryID){
 const before=snapshot(ctx.game),draws=ctx.host.draws;
 if(kind==='liquidated')distress(subOf(ctx.game.g,id));
 const setup=snapshot(ctx.game),ok=kind==='sold'?ctx.game.executeGroupRestructuringSale(id):ctx.game.executeGroupRestructuringLiquidation(id);
 assert.equal(ok,true,`production ${kind} disposal`);assert.equal(ctx.host.draws,draws,'no host RNG draws');
 D.expectDisposed(setup,snapshot(ctx.game),ctx,{status:kind,id});
 return before;
}

// Pure balance-sheet rule: inactive subsidiaries are not held; an explicit 0 is a book value; a missing one falls back.
{const {modules}=D.boot(),finance=modules.finance,book=subs=>finance.buildStatements({week:1,companyCash:0,subsidiaries:subs,finance:finance.defaultFinanceState({week:1,companyCash:0})}).balanceSheet.assets.subsidiariesAndAffiliates;
 assert.equal(book([{id:'a',status:'sold',carryingBookValue:0,investedCost:900}]),0,'sold subsidiary is not held');
 assert.equal(book([{id:'a',status:'liquidated',carryingBookValue:0,investedCost:900}]),0,'liquidated subsidiary is not held');
 assert.equal(book([{id:'a',status:'integrated',carryingBookValue:500,investedCost:900}]),0,'integrated subsidiary moved to the merged company');
 assert.equal(book([{id:'a',status:'active',carryingBookValue:0,investedCost:900}]),0,'explicit book 0 does not fall back to cost');
 assert.equal(book([{id:'a',status:'active',investedCost:900}]),900,'a missing book falls back to cost (legacy shape)');
 assert.equal(book([{id:'a',carryingBookValue:123.37,investedCost:900}]),123.37,'a fractional book is kept exactly');
 console.log('subsidiary balance-sheet book rule PASS');}

// VC subsidiary: full sale and liquidation, each valid at once and for 13 weeks; deterministic replay.
(async()=>{
 for(const kind of ['sold','liquidated']){
  const ctx=await D.vcEve();dispose(ctx,kind);
  assert.equal(subsidiaryAssets(ctx),0,`${kind}: no subsidiary book left on the balance sheet`);
  closes(ctx);
  const replay=await D.vcEve();dispose(replay,kind);closes(replay);
  assert.deepEqual(economic(replay.game.g),economic(ctx.game.g),`${kind}: deterministic replay`);
  console.log(`VC subsidiary ${kind} / validate at once / 13 weeks / deterministic PASS`);
 }
 // Negotiated full sale (group-restructuring-progress): raw book out, cash by the ledger's net proceeds.
 {const ctx=await D.vcEve(),g=ctx.game.g,id=ctx.subsidiaryID,offers=ctx.modules.groupRestructuringProgress.buyerCandidates(g,id);
  assert.equal(ctx.game.startSubsidiarySaleNegotiation(id,offers[0].buyerType),true,'production negotiation');
  const n=g.saleNegotiations.at(-1);assert.equal(ctx.game.actOnSubsidiarySaleNegotiation(n.id,'accept'),true);
  while(g.week<n.closeWeek)advance(ctx.game);
  const before=snapshot(ctx.game);assert.equal(ctx.game.closeNegotiatedSubsidiarySale(n.id),true,'production negotiated close');
  const row=g.finance.transactions.at(-1);assert.equal(subOf(g,id).status,'sold');assert.equal(-row.assetEffect,subOf(before,id).carryingBookValue,'raw book removed');
  assert.equal(g.companyCash,before.companyCash+row.cashEffect,'cash by the ledger net proceeds');assert.equal(row.profitEffect,row.cashEffect+row.assetEffect,'gain = net - book');
  assert.equal(validate(ctx).ok,true,'negotiated sale valid at once');closes(ctx);
  console.log('negotiated full sale / validate at once / 13 weeks PASS');}
 // Listed subsidiary: a partial listed sale keeps the 10% stake; a taken-private listing is fully sold or liquidated.
 {const c=require('./fixtures/subsidiary-quarter-close').listedGame(17),g=c.game.g,id=c.subsidiaryID;
  while(g.week<subOf(g,id).ipoOfferTerms.lockupUntilWeek)advance(c.game);
  assert.equal(c.game.executeGroupRestructuringSale(id),true,'listed restructuring sale (via the market writer)');
  assert.equal(subOf(g,id).status,'active');assert.ok(subOf(g,id).ownership>0.0999&&subOf(g,id).ownership<0.1001,'10% listed stake kept');
  assert.equal(validate(c).ok,true,'listed partial sale valid at once');closes(c);
  console.log('listed subsidiary partial sale / validate at once / 13 weeks PASS');}
 for(const fraction of [0,D.FRACTION])for(const kind of ['sold','liquidated']){
  const c=D.privateGame(fraction);dispose(c,kind);
  assert.equal(subsidiaryAssets(c),0,'no subsidiary book left');closes(c);
  console.log(`taken-private listing ${kind} / book ${fraction?'fractional legacy':'whole yen'} / validate at once / 13 weeks PASS`);
 }
 // Merge (candidates) and integration project (progress): the merged company carries the raw sum of both books.
 {const c=D.mergeGame(),g=c.game.g,[a,b]=c.ids,sum=subOf(g,a).carryingBookValue+subOf(g,b).carryingBookValue,cash=g.companyCash;
  assert.equal(c.game.executeGroupRestructuringMerge(a,b),true,'production merge');
  const merged=g.subsidiaries.at(-1),row=g.finance.transactions.at(-1);assert.equal(merged.carryingBookValue,sum,'merged book is the raw sum');
  assert.equal(g.companyCash,cash+row.cashEffect,'merge cost by the ledger amount');assert.equal(validate(c).ok,true,'merge valid at once');closes(c);
  console.log('merge / raw book sum / validate at once / 13 weeks PASS');}
 // Integration project: the sources leave the group when the merged company is created (as the direct merge does),
 // so the capital-allocation plan, the weekly profit and the balance sheet see only the merged company.
 {const c=D.mergeGame(),g=c.game.g,[a,b]=c.ids,sum=subOf(g,a).carryingBookValue+subOf(g,b).carryingBookValue;
  assert.equal(c.game.startSubsidiaryIntegrationProject(a,b),true,'production integration project');
  for(let i=0;i<40&&!g.integrationProjects.some(p=>p.status==='completed');i++){advance(c.game);assert.equal(validate(c).ok,true,`integration week ${g.week} valid`);}
  assert.equal(g.integrationProjects.at(-1).status,'completed');
  const merged=g.subsidiaries.find(s=>s.id===g.integrationProjects.at(-1).mergedID);
  assert.equal(g.subsidiaries.map(s=>s.id).join(),merged.id,'the sources left the group');
  assert.equal(merged.carryingBookValue,sum,'merged book is the raw sum');assert.equal(subsidiaryAssets(c),sum,'held once');
  assert.equal(c.game.runGroupCapitalAllocationPlan(),true,'production capital-allocation plan');
  assert.equal(g.groupCapitalAllocation.rows.map(r=>r.id).join(),merged.id,'allocation plans only the merged company');
  closes(c);
  console.log('integration project / sources leave the group / allocation sees the merged company only / 13 weeks PASS');}
 // A PE-managed subsidiary is the company's view of a PE deal: group restructuring refuses to sell, liquidate, negotiate
 // or merge it (state unchanged), and the deal's own exit settles it with valid accounting.
 {const ctx=D.boot(),game=new ctx.engineModule.TycoonEngine();
  game.configure({playerName:'T',companyName:'PE975',difficulty:'normal',scenario:'free',simulationSeed:975});
  game.g.companyCash=3_000_000_000;game.g.departments.investment=true;game.g.finance=ctx.modules.finance.defaultFinanceState(game.g);
  const c={...ctx,game},g=game.g;assert.equal(game.createPEDeal('ramen',100_000_000,'company'),true,'production company PE deal');
  const deal=g.peDeals.at(-1),wrapper=g.subsidiaries.find(s=>s.valuationManagedBy==='pe');assert.ok(wrapper,'PE subsidiary wrapper');
  for(let i=0;i<3;i++)advance(game);
  assert.equal(game.groupRestructuringSalePreview(wrapper.id),null,'no sale preview');assert.equal(game.groupRestructuringLiquidationPreview(wrapper.id),null,'no liquidation preview');
  const before=JSON.stringify(g); // after the previews: their structural normalization is the module's existing behaviour
  assert.equal(game.executeGroupRestructuringSale(wrapper.id),false,'sale refused');assert.equal(game.executeGroupRestructuringLiquidation(wrapper.id),false,'liquidation refused');
  assert.equal(game.startSubsidiarySaleNegotiation(wrapper.id,'strategic'),false,'negotiation refused');
  assert.equal(JSON.stringify(g),before,'refusals change nothing');
  assert.equal(game.exitPEDeal(deal.id),true,'the PE deal exits through its own writer');assert.equal(validate(c).ok,true,'PE exit valid');
  assert.equal(subsidiaryAssets(c),0,'nothing left on the balance sheet');closes(c);
  console.log('PE-managed subsidiary / restructuring refused / PE exit valid / 13 weeks PASS');}
 // Reload after a disposal: load writes nothing economic and the next weeks close.
 {const ctx=await D.vcEve();dispose(ctx,'sold');await ctx.backend.flush();
  const loaded=ctx.engineModule.TycoonEngine.load();assert.equal(loaded.g.saveVersion,9);
  assert.deepEqual(economic(loaded.g),economic(new ctx.engineModule.TycoonEngine(snapshot(ctx.game)).g),'reload keeps the disposed state');
  assert.equal(ctx.modules.finance.validate(snapshot(loaded)).ok,true,'reloaded accounting valid');
  closes({...ctx,game:loaded});
  console.log('reload after disposal / saveVersion 9 / 13 weeks PASS');}
 console.log('Subsidiary disposal accounting PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
