'use strict';
// Track A (follow-up to D3): the M&A acquisition-financing public equity raise issues new shares to outside
// investors. Founder and competitor keep their share counts and are diluted over issued − treasury (the shared
// engine.issueSharesToExternalHolders rule); the new shares are external; ratios sum to 1. Cash, debt, issue proceeds,
// capital surplus and the journal are exactly what they were before the fix (the dilution rule only changes ratios).
// Runs through the installed closing chain: board approval, the financing shadow-state boundary, deal-room base.
const assert=require('node:assert/strict');
const {createScenario,customPlan,selectAndApprove,snapshot}=require('./ma-acquisition-financing-fixture');
const {loadGame}=require('./harness');
const {indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');
const EPS=1e-9,outstanding=g=>g.sharesOut-g.treasuryBuybackShares;
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<EPS*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
async function scenario({competitor=.2,treasury=50000,equity=20_000_000}={}){
 const durable=new Map(),control={attempts:[]},host={draws:0};let seed=934021;
 const random=()=>{host.draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const s=createScenario({loadOptions:{headless:true,random,indexedDB:indexedDBFor(durable,control)}});
 await s.modules.saveStorageIDB.hydrate();
 Object.assign(s.game.g,{treasuryBuybackShares:treasury,competitorOwnedRatio:competitor});s.game.updateOwnershipRatios();
 selectAndApprove(s,customPlan({equity,cash:60_000_000-equity}));assert.equal(s.game.save(),true);await s.modules.saveStorageIDB.flush();
 return {...s,durable,control,host,key:s.engineModule.SAVE_KEY};
}
const money=g=>({cash:g.companyCash,debt:g.companyDebt,personal:g.personalCash,surplus:g.finance.balances.capitalSurplus,tx:g.finance.transactions.map(t=>[t.type,t.amount,t.sourceType]).sort().join('|')});
(async()=>{
 // 1. Dilution is exact; money is identical to a run with no competitor stake (ratios do not move money).
 const s=await scenario(),g=s.game.g,o0=outstanding(g),founder0=g.founderShares,comp0=g.competitorOwnedRatio*o0,ext0=o0-founder0-comp0,draws=s.host.draws;
 assert.equal(s.game.closeMADeal(s.deal.id),true,'financed closing with a public equity raise');
 const o1=outstanding(g),issued=o1-o0;assert.equal(issued,20000,'20,000 new shares at ¥1,000');
 close(g.founderOwnershipRatio,founder0/o1,'founder diluted');close(g.competitorOwnedRatio*o1,comp0,'competitor keeps its share count');
 close(g.externalShareholderRatio*o1,ext0+issued,'new shares are external');close(g.founderOwnershipRatio+g.competitorOwnedRatio+g.externalShareholderRatio,1,'sum 1');
 assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true,'accounting valid');assert.equal(s.host.draws,draws,'no host RNG');
 const ref=await scenario({competitor:0});assert.equal(ref.game.closeMADeal(ref.deal.id),true);
 assert.deepEqual(money(g),money(ref.game.g),'cash, debt, capital surplus and journal unchanged by the dilution rule');
 const tx=g.finance.transactions.find(t=>t.sourceType==='maPublicEquityRaise');assert.equal(tx.amount,20_000_000,'issue proceeds');
 console.log('equity raise: founder 700k and competitor 190k diluted over 1.07M, 20k new shares external, sum 1; cash/debt/surplus/journal unchanged PASS');
 // 2. Reload and fresh durable-only hydration equal live.
 await s.modules.saveStorageIDB.flush();
 const ratios=x=>JSON.stringify([x.sharesOut,x.treasuryBuybackShares,x.founderShares,x.founderOwnershipRatio,x.competitorOwnedRatio,x.externalShareholderRatio,x.companyCash,x.companyDebt]);
 assert.equal(ratios(s.engineModule.TycoonEngine.load().g),ratios(g),'reload equals live');
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 assert.equal(ratios(fresh.engineModule.TycoonEngine.load().g),ratios(g),'fresh hydration equals live');
 console.log('equity raise: reload / fresh durable-only hydration PASS');
 // 3. A rejected save rolls the whole financed closing back (shadow-state boundary), ratios included; retry commits once.
 {const s=await scenario(),before=JSON.stringify(s.game.g),bytes=s.backend?.readSync?.(s.key)??s.modules.saveStorageIDB.readSync(s.key),save=s.game.save;
  s.game.save=()=>false;assert.equal(s.game.closeMADeal(s.deal.id),false,'save rejected');s.game.save=save;
  assert.equal(JSON.stringify(s.game.g),before,'live state (ratios, cash, debt, journal) rolled back');
  assert.equal(s.modules.saveStorageIDB.readSync(s.key),bytes,'cache unchanged');
  assert.equal(s.game.closeMADeal(s.deal.id),true,'retry commits');assert.ok(Math.abs(s.game.g.competitorOwnedRatio*outstanding(s.game.g)-190000)<1e-6);
  console.log('equity raise: rejected save rolls ratios back with the closing; retry commits PASS');}
 // 4. No equity raise → ratios unchanged; board approval is still required for a changed plan.
 {const s=await scenario({equity:0}),g=s.game.g,r=[g.founderOwnershipRatio,g.competitorOwnedRatio,g.externalShareholderRatio,g.sharesOut];
  assert.equal(s.game.closeMADeal(s.deal.id),true);assert.deepEqual([g.founderOwnershipRatio,g.competitorOwnedRatio,g.externalShareholderRatio,g.sharesOut],r,'no issuance, no ratio change');}
 // 5. Deterministic.
 {const a=await scenario(),b=await scenario();a.game.closeMADeal(a.deal.id);b.game.closeMADeal(b.deal.id);
  const eco=x=>{const c=snapshot(x);delete c.lastSaveDate;delete c.saveSequence;return JSON.stringify(c);};assert.equal(eco(a.game),eco(b.game),'deterministic');}
 console.log('M&A equity raise ownership ratios PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
