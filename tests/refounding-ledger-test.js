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
  const value=ctx.game.companyValue(),personal=g.personalCash,ratio=g.founderOwnershipRatio,lot=g.personalStocks.CPTY.qty,outstanding=g.sharesOut-g.treasuryBuybackShares;
  assert.equal(ctx.game.acceptBuyoutOffer(1.2),true,'production buyout');assert.equal(g.isCompanySold,true);
  // G1 D1: the founder's bought own-company lot is bought out at the sale price per share, once.
  assert.ok(Math.abs(g.personalCash-(personal+value*1.2*ratio+value*1.2*lot/outstanding))<2,'founder proceeds and the own-company lot credited once');
  assert.equal(g.personalStocks.CPTY,undefined,'no old-company lot survives the sale');
  const beforeFound=snapshot(ctx.game);assert.equal(refound(ctx),true);const after=snapshot(ctx.game);
  assert.equal(after.personalCash,beforeFound.personalCash-R.INVESTMENT,'contribution debited once');
  assert.equal(after.subsidiaries.length+after.maSubsidiaries.length,0,'no subsidiary carried');
  assert.equal(Object.keys(after.companyStocks||{}).length,0,'no company stock carried');
  assert.equal((after.properties||[]).filter(p=>p.owner==='company').length,0,'no company property carried');
  assert.equal(after.finance.openingAssets,R.INVESTMENT,'opening assets are the contribution only');
  assert.equal(ctx.modules.finance.validate(after).ok,true,'validate at once');closes(ctx);
  console.log('refounding after the production buyout / sale value includes the company PE deal / nothing transferred free / 13 weeks PASS');}
 // P3-4 W-NEW-COMPANY: actual sale/refounding, not a synthetic serial edit. A reused ticker is not an issuer binding.
 {const ctx=await soldCompany({}),game=ctx.game,g=game.g,read=ctx.modules.economicReadModel;
  g.isCompanySold=false;delete g.companyStocks.CPTY;g.finance=ctx.modules.finance.defaultFinanceState(g);
  const root=g,oldIndex=read.buildOwnershipIdentityIndex(g),scope={issuerEntityId:read.PLAYER_COMPANY_ENTITY_ID,actingEntityId:read.FOUNDER_ENTITY_ID};
  function observe(runtime,engine,index){
   const before=JSON.stringify(engine.g),bytes=runtime.backend.readSync(runtime.key),mirror=runtime.ctx.localStorage.getItem(runtime.key),durable=runtime.durable.get(runtime.key),attempts=runtime.control.attempts.length,draws=runtime.host?.draws;
   const api=runtime.modules.economicReadModel,view=api.projectOwnershipSnapshot(engine.g,index);
   const eligibility=runtime.modules.phase3ControlEligibility.projectControlEligibility(api.ownershipReconciliation(engine.g),scope);
   assert.equal(view.commandEligible,false);assert.equal(view.wealthComplete,false);assert.equal(eligibility.executable,false);
   assert.ok(eligibility.capabilities.every(row=>row.executionStatus==='NOT_AUTHORIZED'));
   assert.equal(JSON.stringify(engine.g),before,'ownership/control readers preserve all state including persisted RNG');
   assert.equal(runtime.backend.readSync(runtime.key),bytes);assert.equal(runtime.ctx.localStorage.getItem(runtime.key),mirror);assert.equal(runtime.durable.get(runtime.key),durable);
   assert.equal(runtime.control.attempts.length,attempts,'readers enqueue no writes');assert.equal(runtime.host?.draws,draws,'readers draw no host RNG');
   return {view,eligibility};
  }
  const first=observe(ctx,game,oldIndex);assert.equal(first.view.positions[0].quantity.value,620000);
  assert.equal(first.view.classes[0].issuedQuantity,1000000);assert.equal(first.eligibility.status,'EVALUATED');
  assert.equal(game.acceptBuyoutOffer(1.2),true,'actual company buyout');await ctx.backend.flush();
  assert.equal(game.g.personalStocks.CPTY,undefined,'G1 D1: the sale bought out the old-company lot');
  assert.ok(observe(ctx,game,oldIndex).view.issues.some(row=>row.code==='STALE_EVIDENCE'),'sale invalidates unsold evidence');
  const soldIndex=read.buildOwnershipIdentityIndex(game.g),sold=snapshot(game),bytes=ctx.backend.readSync(ctx.key),mirror=ctx.ctx.localStorage.getItem(ctx.key);
  assert.equal(observe(ctx,game,soldIndex).eligibility.issues[0].code,'GENERATION_UNPROVEN');
  for(const fault of ['false','throw']){
   const save=game.save;let speculative;
   game.save=function(){speculative=read.buildOwnershipIdentityIndex(this.g);if(fault==='throw')throw Error('refounding save fault');return false;};
   try{if(fault==='throw')assert.throws(()=>refound(ctx),/refounding save fault/);else assert.equal(refound(ctx),false,'failed refounding is rejected');}finally{game.save=save;}
   assert.ok(speculative,'fault reaches the replaced speculative state');assert.equal(game.g,root,'rollback preserves root identity');
   assert.deepEqual(snapshot(game),sold,'failed refounding restores every field');
   assert.ok(!observe(ctx,game,soldIndex).view.issues.some(row=>row.code==='STALE_EVIDENCE'),'sold index valid again after rollback');
   assert.ok(observe(ctx,game,speculative).view.issues.some(row=>row.code==='STALE_EVIDENCE'),'speculative generation cannot survive rollback');
   await ctx.backend.flush();assert.equal(ctx.backend.readSync(ctx.key),bytes);assert.equal(ctx.ctx.localStorage.getItem(ctx.key),mirror);assert.equal(ctx.durable.get(ctx.key),bytes);
  }
  assert.equal(refound(ctx),true,'healthy retry succeeds');assert.equal(game.g,root,'successful refounding also retains the root');
  expectRefounded(sold,snapshot(game),ctx);assert.equal(game.g.currentCompanySerial,2);assert.equal(game.g.ticker,'CPTY','fixture really reuses the old ticker');
  function second(runtime,engine){
   const {view,eligibility}=observe(runtime,engine);
   // G1 D0 (Owner 2026-11-05): the refounded company is the proven current generation (serial 2 above the recorded
   // serial-1 sale) and is reconciled afresh from its own buckets. Authority stays disabled (observe() checks that).
   assert.equal(view.classes.length,1,'the new generation adopts its own common class');assert.equal(view.classes[0].issuedQuantity,10000);
   assert.equal(view.positions[0].quantity.value,10000,'new founder bucket');
   assert.equal(view.positions[0].assetRole,'founder-equity');
   // G1 D1: nothing of the sold company sits under the reused ticker.
   assert.equal(view.positions.filter(row=>row.instrumentAlias==='CPTY').length,0,'no old-company lot under the reused ticker');
   assert.equal(engine.g.market.some(row=>row.id==='CPTY'),false,'the sold company listing row is not carried over');
   const reconciliation=runtime.modules.economicReadModel.ownershipReconciliation(engine.g);
   assert.equal(reconciliation.ok,true);assert.equal(reconciliation.generationEvidence.currentCompanySerial,2);
   assert.equal(reconciliation.beneficialHoldings[0].quantity,10000,'only the new founder shares, nothing of the sold company');
   assert.equal(eligibility.status,'EVALUATED');assert.equal(eligibility.issues.length,0);
   assert.equal(engine.g.companyCash,R.INVESTMENT);assert.equal(engine.g.personalCash,sold.personalCash-R.INVESTMENT);
   assert.deepEqual(JSON.parse(JSON.stringify(engine.g.personalStocks)),sold.personalStocks,'all personal lots retained once');
   assert.equal(Object.keys(engine.g.companyStocks).length,0,'sold company lots are not carried free');
   assert.equal(runtime.modules.finance.validate(JSON.parse(JSON.stringify(engine.g))).ok,true);
  }
  // A save written before G1 D1 can still hold the old 20,000-share lot under the reused ticker. The engine passed here
  // was loaded from such a save through the real load path, and loading must keep the lot exactly as saved.
  // G1 D2 (Owner 2026-11-05): with the refounded generation proven, that residual own-ticker lot counts as a holding of
  // the current company. D2b: here it cannot fit (founder 10,000 + lot 20,000 > 10,000 issued), so reconciliation
  // fails closed: no class is adopted, no votes, and nothing is normalized, deleted or rewritten.
  function legacy(runtime,engine){
   assert.deepEqual(JSON.parse(JSON.stringify(engine.g.personalStocks.CPTY)),{qty:20000,avg:1000},'the legacy lot is loaded unchanged');
   const {view,eligibility}=observe(runtime,engine);
   assert.equal(view.classes.length,0,'no class adopted for an over-allocated generation');
   assert.equal(view.positions[0].quantity.value,30000,'D2: the lot is read as the current company\'s, with the founder shares');
   assert.equal(view.positions[0].assetRole,'unresolved');assert.equal(view.positions[0].securityClassId,null);
   assert.equal(view.positions[0].votingUnits.value,null,'an over-allocated generation grants no votes');
   assert.ok(view.positions[0].reasons.some(row=>row.code==='PLAYER_RECONCILIATION_FAILED'));
   assert.ok(view.positions.every(row=>row.votingUnits.value===null),'no position carries votes');
   // Never normalize the lot just to manufacture votes.
   const reconciliation=runtime.modules.economicReadModel.ownershipReconciliation(engine.g);
   assert.equal(reconciliation.ok,false);assert.ok(reconciliation.checks.some(row=>row.id==='ECO-011'&&!row.ok));
   assert.equal(eligibility.status,'UNKNOWN');assert.equal(eligibility.issues[0].code,'RECONCILIATION_FAILED');
   assert.ok(eligibility.capabilities.every(row=>row.status==='UNKNOWN'));
  }
  second(ctx,game);assert.ok(observe(ctx,game,soldIndex).view.issues.some(row=>row.code==='STALE_EVIDENCE'));
  await ctx.backend.flush();second(ctx,ctx.engineModule.TycoonEngine.load());
  const freshControl={attempts:[]},fresh=loadGame({headless:true,indexedDB:indexedDBFor(ctx.durable,freshControl)});await fresh.modules.saveStorageIDB.hydrate();
  const freshRuntime={...fresh,backend:fresh.modules.saveStorageIDB,key:ctx.key,durable:ctx.durable,control:freshControl},freshEngine=fresh.engineModule.TycoonEngine.load();
  second(freshRuntime,freshEngine);
  // R2-02: a pre-D1 saveVersion 9 save that still holds the old lot, written through the real save path and read back
  // through reload and a fresh fake-IDB hydration. Loading neither rewrites the save nor binds the lot to the new company.
  game.g.personalStocks.CPTY={qty:20000,avg:1000};assert.equal(game.save(),true,'legacy-shaped save written');await ctx.backend.flush();
  const legacyBytes=ctx.backend.readSync(ctx.key),legacySave=JSON.parse(legacyBytes);
  assert.equal(legacySave.saveVersion,9);assert.equal(legacySave.currentCompanySerial,2);assert.equal(legacySave.ticker,'CPTY');
  assert.deepEqual(legacySave.personalStocks.CPTY,{qty:20000,avg:1000});assert.equal(ctx.durable.get(ctx.key),legacyBytes,'durable bytes hold the legacy lot');
  const reloaded=ctx.engineModule.TycoonEngine.load();legacy(ctx,reloaded);
  const legacyControl={attempts:[]},legacyFresh=loadGame({headless:true,indexedDB:indexedDBFor(ctx.durable,legacyControl)});await legacyFresh.modules.saveStorageIDB.hydrate();
  const legacyRuntime={...legacyFresh,backend:legacyFresh.modules.saveStorageIDB,key:ctx.key,durable:ctx.durable,control:legacyControl};
  legacy(legacyRuntime,legacyFresh.engineModule.TycoonEngine.load());
  assert.equal(ctx.durable.get(ctx.key),legacyBytes,'loading does not rewrite the legacy save');
  console.log('P3-4 actual sale/refounding: same root / ticker reuse / old and speculative evidence rejected / rollback / reload / fresh fake-IDB PASS');
 }
 console.log('Refounding ledger PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
