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
  assert.equal(refound(ctx,mode),true,`${label}: production refounding`);assert.equal(ctx.host.draws,draws,'refounding draws no host RNG');
  expectRefounded(before,snapshot(ctx.game),ctx);
  await ctx.backend.flush();
  // The ledger-relevant state survives reload and a fresh durable-only hydration. (The whole-state reload equality,
  // including the founded-investment record and the news line written after the base save, is #955 / PR #965.)
  const expected=ledgerView(new ctx.engineModule.TycoonEngine(snapshot(ctx.game)).g);
  assert.deepEqual(ledgerView(ctx.engineModule.TycoonEngine.load().g),expected,'production reload');
  const fresh=loadGame({headless:true,indexedDB:indexedDBFor(ctx.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
  const hydrated=fresh.engineModule.TycoonEngine.load();assert.deepEqual(ledgerView(hydrated.g),expected,'fresh durable-only hydration');assert.equal(hydrated.g.saveVersion,9);
  assert.equal(fresh.modules.finance.validate(JSON.parse(JSON.stringify(hydrated.g))).ok,true,'hydrated accounting valid');
  closes(ctx);assert.equal(ctx.host.draws,draws,'13 weeks after refounding draw no host RNG');
  const replay=await soldCompany(opts);assert.equal(refound(replay,mode),true);closes(replay);
  assert.deepEqual(economic(replay.game.g),economic(ctx.game.g),`${label}: deterministic`);
  console.log(`refounding ${label} / book opens at the contribution / personal cash once / reload / fresh hydration / 13 weeks / deterministic PASS`);
 }
 // Every PE ownership × status combination (#968 Owner decision): only an active company deal stays with the sold
 // company; exited company deals (history), personal deals (active or exited) and legacy deals without an
 // ownerAccount (normalised to personal on load, as personalNetWorth treats them) are carried unchanged.
 {const ctx=await soldCompany({}),g=ctx.game.g,combos=[];
  for(const ownerAccount of ['company','personal',undefined])for(const status of ['active','exited']){
   const id=`pe-combo-${ownerAccount||'legacy'}-${status}`,deal={id,targetName:id,industry:'ramen',status,investedAmount:10_000_000,currentValuation:10_000_000,ownerCostBasis:10_000_000,ownershipRatio:.5,holdingWeeks:1};
   if(ownerAccount)deal.ownerAccount=ownerAccount;g.peDeals.push(deal);combos.push({id,carried:!(ownerAccount==='company'&&status==='active')});}
  const before=snapshot(ctx.game);assert.equal(refound(ctx),true);const after=snapshot(ctx.game);
  for(const c of combos){const kept=after.peDeals.find(d=>d.id===c.id);assert.equal(Boolean(kept),c.carried,`${c.id} carried=${c.carried}`);const econ=d=>JSON.stringify([d.id,d.status,d.ownerAccount||'personal',d.investedAmount,d.currentValuation,d.ownerCostBasis,d.ownershipRatio]);if(kept)assert.equal(econ(kept),econ(before.peDeals.find(d=>d.id===c.id)),`${c.id} carried unchanged`);}
  assert.equal(ctx.modules.finance.validate(after).ok,true,'combinations: validate at once');
  console.log('refounding PE ownership x status matrix (company / personal / legacy x active / exited) PASS');}
 // End to end through the production sale: the sold company's value already includes its active company PE deal (a
 // subsidiary at currentValuation), the founder receives the sale proceeds once, and the new company starts with the
 // contribution only: no subsidiary, company stock, property or PE asset of the sold company is transferred for free.
 {const ctx=await soldCompany({companyPE:true,personalPE:true}),g=ctx.game.g;g.isCompanySold=false;
  const deal=g.peDeals.find(d=>d.ownerAccount==='company'&&d.status==='active');ctx.game.advanceWeek(false);
  const wrapper=g.subsidiaries.find(s=>s.valuationManagedBy==='pe');assert.ok(wrapper,'company PE deal is a subsidiary of the sold company');
  assert.ok(Math.abs(wrapper.valuation*wrapper.ownership-deal.currentValuation)<1,'its sale value is the deal valuation');
  const value=ctx.game.companyValue(),personal=g.personalCash,ratio=g.founderOwnershipRatio;
  assert.equal(ctx.game.acceptBuyoutOffer(1.2),true,'production buyout');assert.equal(g.isCompanySold,true);
  assert.ok(Math.abs(g.personalCash-(personal+value*1.2*ratio))<1,'founder proceeds credited once');
  const beforeFound=snapshot(ctx.game);assert.equal(refound(ctx),true);const after=snapshot(ctx.game);
  assert.equal(after.personalCash,beforeFound.personalCash-R.INVESTMENT,'contribution debited once');
  assert.equal(after.subsidiaries.length+after.maSubsidiaries.length,0,'no subsidiary carried');
  assert.equal(Object.keys(after.companyStocks||{}).length,0,'no company stock carried');
  assert.equal((after.properties||[]).filter(p=>p.owner==='company').length,0,'no company property carried');
  assert.equal(after.finance.openingAssets,R.INVESTMENT,'opening assets are the contribution only');
  assert.equal(ctx.modules.finance.validate(after).ok,true,'validate at once');closes(ctx);
  console.log('refounding after the production buyout / sale value includes the company PE deal / nothing transferred free / 13 weeks PASS');}
 console.log('Refounding ledger PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
