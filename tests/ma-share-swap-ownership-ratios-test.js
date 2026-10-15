'use strict';
// D3 (Track A): a share-swap acquisition issues new player-company shares to the target's sellers. The founder
// and the competitor keep their share counts and are diluted over the new outstanding denominator (issued −
// treasury); the new shares are external. Ratios sum to 1, each ratio × outstanding equals the holder's share
// count, the live state equals reload and fresh hydration, cash and the ledger are unchanged by the ratio fix,
// and no RNG is used. Covers the installed deal-room chain (closeMADeal / completeTargetAcquisition with the
// financing, board-approval and PE wrappers) and the dormant legacy engine.acquireTarget('shareSwap').
const assert=require('node:assert/strict');
const {createScenario,snapshot}=require('./ma-acquisition-financing-fixture');
const {loadGame}=require('./harness');
const {indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');
const EPS=1e-9;
const outstanding=g=>Math.max(1,g.sharesOut-g.treasuryBuybackShares);
const holdings=g=>{const o=outstanding(g),founder=g.founderShares,competitor=g.competitorOwnedRatio*o;return {o,founder,competitor,external:o-founder-competitor};};
function close(a,b,label){assert.ok(Math.abs(a-b)<EPS*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);}
function assertRatios(g,label){
 close(g.founderOwnershipRatio+g.competitorOwnedRatio+g.externalShareholderRatio,1,`${label}: ratios sum to 1`);
 close(g.founderOwnershipRatio,g.founderShares/outstanding(g),`${label}: founder ratio = founder shares / outstanding`);
}
async function scenario({treasury=0,competitor=0,founderShares=700000}={}){
 const durable=new Map(),control={attempts:[]},host={draws:0};let seed=934013;
 const random=()=>{host.draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const s=createScenario({method:'shareSwap',founderShares,loadOptions:{headless:true,random,indexedDB:indexedDBFor(durable,control)}});
 await s.modules.saveStorageIDB.hydrate();
 Object.assign(s.game.g,{treasuryBuybackShares:treasury,competitorOwnedRatio:competitor});s.game.updateOwnershipRatios();
 assert.equal(s.game.approveMAClosing(s.deal.id),true);assert.equal(s.game.save(),true);await s.modules.saveStorageIDB.flush();
 return {...s,durable,control,host,key:s.engineModule.SAVE_KEY};
}
const CLOSE={
 close:s=>s.game.closeMADeal(s.deal.id),
 complete:s=>s.game.completeTargetAcquisition({targetID:s.deal.targetID,method:'shareSwap',approvedPrice:s.deal.acceptedTerms.finalPrice,dealID:s.deal.id}),
 outer:s=>s.game.runTransaction(()=>s.game.closeMADeal(s.deal.id))
};
async function check(s,run,label){
 const g=s.game.g,before=holdings(g),cash=g.companyCash,personal=g.personalCash,debt=g.companyDebt,tx=g.finance.transactions.length,rng=JSON.stringify(g.simulationRng),draws=s.host.draws;
 assert.equal(run(s),true,`${label}: share swap closes`);
 const after=holdings(g),issued=after.o-before.o;
 assert.equal(issued,Math.ceil(s.deal.acceptedTerms.finalPrice/1000),`${label}: new shares issued`);
 close(after.founder,before.founder,`${label}: founder keeps its share count`);
 close(after.competitor,before.competitor,`${label}: competitor keeps its share count (diluted ratio)`);
 close(after.external,before.external+issued,`${label}: the new shares go to external holders`);
 close(g.competitorOwnedRatio,before.competitor/after.o,`${label}: competitor diluted`);
 close(g.externalShareholderRatio,(before.external+issued)/after.o,`${label}: external ratio`);
 assertRatios(g,label);
 assert.deepEqual([g.companyCash,g.personalCash,g.companyDebt],[cash,personal,debt],`${label}: cash and debt unchanged`);
 assert.equal(g.finance.transactions.length,tx+2,`${label}: acquisition + equity journal only`);
 assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true,`${label}: accounting valid`);
 assert.equal(JSON.stringify(g.simulationRng),rng,`${label}: no simulation RNG`);assert.equal(s.host.draws,draws,`${label}: no host RNG`);
 await s.modules.saveStorageIDB.flush();
 const ratios=x=>JSON.stringify([x.sharesOut,x.founderShares,x.treasuryBuybackShares,x.founderOwnershipRatio,x.competitorOwnedRatio,x.externalShareholderRatio]);
 assert.equal(ratios(s.engineModule.TycoonEngine.load().g),ratios(g),`${label}: reload equals live`);
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 assert.equal(ratios(fresh.engineModule.TycoonEngine.load().g),ratios(g),`${label}: fresh durable-only hydration equals live`);
 return g;
}

(async()=>{
 // 1. Installed chain, three entries, with treasury shares and a competitor stake.
 for(const [entry,run] of Object.entries(CLOSE)){
  const s=await scenario({treasury:50000,competitor:.2}),g=await check(s,run,`${entry} treasury+competitor`);
  close(g.founderOwnershipRatio,700000/1050000,'founder 700k / 1.05M');close(g.competitorOwnedRatio,190000/1050000,'competitor 190k / 1.05M');close(g.externalShareholderRatio,160000/1050000,'external 160k / 1.05M');
  console.log(`share swap via ${entry}: founder / competitor diluted, new shares external, sum 1, cash + ledger unchanged, reload / fresh hydration PASS`);
 }
 // 2. Other ownership shapes: no competitor/treasury; founder owns every outstanding share.
 for(const shape of [{},{founderShares:1000000},{competitor:.49,founderShares:500000}]){
  const s=await scenario(shape);await check(s,CLOSE.close,`shape ${JSON.stringify(shape)}`);
  console.log(`share swap shape ${JSON.stringify(shape)}: dilution exact PASS`);
 }
 // 3. Dormant legacy engine.acquireTarget('shareSwap') uses the same issuance rule.
 {const s=await scenario({treasury:50000,competitor:.2}),g=s.game.g;s.game.save=()=>true;
  g.acquisitionTargets[0].activeDealID=null;const price=s.game.calculateAcquisitionPrice?.(g.acquisitionTargets[0],'shareSwap');
  const before=holdings(g),cash=g.companyCash;
  assert.equal(s.game.acquireTarget(g.acquisitionTargets[0].id,'shareSwap'),true,'legacy share swap');
  const after=holdings(g),issued=after.o-before.o;assert.ok(issued>0);
  close(after.founder,before.founder,'legacy founder count');close(after.competitor,before.competitor,'legacy competitor count');close(after.external,before.external+issued,'legacy external');
  assertRatios(g,'legacy');assert.equal(g.companyCash,cash,'legacy: no cash');assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true);
  void price;console.log('legacy acquireTarget shareSwap: same dilution rule PASS');}
 // 4. Deterministic: two identical runs produce identical states.
 const a=await scenario({treasury:50000,competitor:.2}),b=await scenario({treasury:50000,competitor:.2});
 CLOSE.close(a);CLOSE.close(b);const economic=g=>{const c=snapshot(g);delete c.lastSaveDate;delete c.saveSequence;return JSON.stringify(c);};
 assert.equal(economic(a.game),economic(b.game),'deterministic (save wall-clock metadata excluded)');
 assert.notEqual(a.game.advanceWeek(false),false);assertRatios(a.game.g,'after the next week');
 console.log('share swap ownership ratios PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
