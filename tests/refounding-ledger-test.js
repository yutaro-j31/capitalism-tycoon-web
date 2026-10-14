'use strict';
// #968: refounding after a company sale opens the new company's book at the founder's contribution. Before the fix
// foundNewCompanyAfterBuyout kept the constructor's default book (opening cash 8,000,000) while setting company cash
// to the contribution, so finance.validate failed (P2-CLOSE-BS-IDENTITY 42,000,000) and the next week threw; a
// company PE deal of the sold company was also carried and re-created a ¥100m book in the new company.
// Production writers only: store and digital modes, with and without PE deals; validate at once and for 13 weeks,
// reload and fresh durable-only hydration, deterministic replay, no host RNG draws.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');
const R=require('./fixtures/refounding-ledger');
const {soldCompany,refound,expectRefounded,snapshot,economic}=R;

const ledgerView=g=>JSON.stringify({companyName:g.companyName,companyCash:g.companyCash,personalCash:g.personalCash,companyDebt:g.companyDebt,finance:g.finance,peDeals:g.peDeals,subsidiaries:g.subsidiaries,isCompanySold:g.isCompanySold});
function closes(ctx,weeks=13){const start=ctx.game.g.week;for(let i=0;i<weeks;i++){assert.notEqual(ctx.game.advanceWeek(false),false,`week ${ctx.game.g.week+1} commits`);assert.equal(ctx.modules.finance.validate(snapshot(ctx.game)).ok,true,`week ${ctx.game.g.week} accounting valid`);}assert.equal(ctx.game.g.week,start+weeks);}
(async()=>{
 for(const [label,opts,mode] of [['store',{},'store'],['digital',{},'digital'],['store with company and personal PE deals',{companyPE:true,personalPE:true},'store']]){
  const ctx=await soldCompany(opts),before=snapshot(ctx.game),draws=ctx.host.draws;
  assert.equal(refound(ctx,mode),true,`${label}: production refounding`);
  expectRefounded(before,snapshot(ctx.game),ctx);
  await ctx.backend.flush();
  // The ledger-relevant state survives reload and a fresh durable-only hydration. (The whole-state reload equality,
  // including the founded-investment record and the news line written after the base save, is #955 / PR #965.)
  const expected=ledgerView(new ctx.engineModule.TycoonEngine(snapshot(ctx.game)).g);
  assert.deepEqual(ledgerView(ctx.engineModule.TycoonEngine.load().g),expected,'production reload');
  const fresh=loadGame({headless:true,indexedDB:indexedDBFor(ctx.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
  const hydrated=fresh.engineModule.TycoonEngine.load();assert.deepEqual(ledgerView(hydrated.g),expected,'fresh durable-only hydration');assert.equal(hydrated.g.saveVersion,9);
  assert.equal(fresh.modules.finance.validate(JSON.parse(JSON.stringify(hydrated.g))).ok,true,'hydrated accounting valid');
  closes(ctx);
  const replay=await soldCompany(opts);assert.equal(refound(replay,mode),true);closes(replay);
  assert.deepEqual(economic(replay.game.g),economic(ctx.game.g),`${label}: deterministic`);
  console.log(`refounding ${label} / book opens at the contribution / personal cash once / reload / fresh hydration / 13 weeks / deterministic PASS`);
 }
 console.log('Refounding ledger PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
