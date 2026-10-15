'use strict';
// Audit test (tests only, no production change): the M&A acquisition-financing shadow-state boundary
// (js/ma-acquisition-financing.js installMAAcquisitionFinancing → completeTargetAcquisition wrapper) with a ¥20M
// public equity raise (engine.issueSharesToExternalHolders), treasury 50,000 and a 20% competitor stake.
//
// Boundary under test: clone live → shadow (Object.create(engine); save/emit/notify are no-ops) → executeFinancing
// (loans + equity raise + fees) → deal-room base completion on the shadow → finance.validate → replaceState(live,
// committed) → this.save() → this.emit() → this.notify(); any throw/false → replaceState(live, snapshot) +
// checkpointSaveStorage() restore (mirror bytes, IDB cache bytes, cancel this boundary's queued IDB put).
//
// For every storage/event fault (save-false, save accepted then throws, `saved` / `change` / `notify` emit throws,
// mirror reject, enqueue-false, enqueue-throw) and for a closing that fails while an earlier accepted save is still
// in flight in IndexedDB, this test proves: closeMADeal returns false (the wrapper swallows the error, it does not
// rethrow); live state equals the pre-closing snapshot (ratios, shares, cash, debt, loans, capital surplus, journal,
// deal status, RNG); localStorage mirror, IDB cache and durable IDB bytes are unchanged and the closing's put never
// starts; reload and fresh durable-only hydration equal the rolled-back live state; no host RNG is drawn. A retry
// commits exactly once (one acquisition, one maPublicEquityRaise row, competitor 190,000 and founder 700,000 over
// 970,000 outstanding, 20,000 new external shares, ratios sum to 1) and reload / fresh hydration equal live.
// Nested in an outer game.runTransaction the closing commits with the outer single save or rolls back with it.
//
// Owner's key question — save SUCCEEDED, then `saved` / `change` / `notify` throws: the already-saved closing IS
// cancelled, but consistently: live, mirror, IDB cache and durable IDB all return to the pre-closing bytes (the
// closing's IDB put is cancelled before it starts, because the boundary is synchronous). No live/durable fork.
//
// Known gaps, recorded here and NOT asserted (they are current behaviour, not contracts):
//  G1 (P2, semantics) The success notice is emitted inside the rollback region. A throwing `notify` (or `change`)
//     emit cancels a closing whose save already succeeded, and the error is swallowed (returns false, no rethrow).
//     engine.runTransaction rethrows post-save emit errors, and the #955 pattern (completion.js
//     declineInboundBuyoutOffer / announceFoundedCompany) emits the notice only after the outermost commit,
//     outside the rollback region. In a real browser a throwing addEventListener listener does not propagate out of
//     dispatchEvent, so only a throwing emit itself (wrapper/instance override) reaches this path.
//  G2 (P3) The success news line is written by this.notify() AFTER this.save(), so the persisted payload lacks
//     「…買収資金調達と最終契約を完了しました。」 until the next save; reload differs from live only in news.
//     The comparisons below therefore ignore that one line.
//  G3 (P3) Inside an outer transaction the wrapper emits `change` and the success `notify` immediately (save is
//     deferred); if the outer transaction then rolls back, the UI has already shown a success notice for a closing
//     that never committed. Economic state, mirror, cache and durable stay consistent.
//  G4 (P3) A `saved` event is dispatched for the closing payload before the post-save rollback restores storage.
const assert=require('node:assert/strict');
const {createScenario,customPlan,selectAndApprove,snapshot}=require('./ma-acquisition-financing-fixture');
const {loadGame}=require('./harness');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const clone=v=>JSON.parse(JSON.stringify(v));
const NOTICE='買収資金調達と最終契約を完了しました';
const FAULTS=['save-false','save-throw','saved','change','notify','mirror','enqueue-false','enqueue-throw'];
const POST_SAVE=['save-throw','saved','change','notify'];
const outstanding=g=>g.sharesOut-g.treasuryBuybackShares;
async function scenario(){
 const durable=new Map(),control={attempts:[]},host={draws:0};let seed=934021;
 const random=()=>{host.draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const s=createScenario({loadOptions:{headless:true,random,indexedDB:indexedDBFor(durable,control)}});
 await s.modules.saveStorageIDB.hydrate();
 Object.assign(s.game.g,{treasuryBuybackShares:50000,competitorOwnedRatio:.2});s.game.updateOwnershipRatios();
 selectAndApprove(s,customPlan({equity:20_000_000,cash:40_000_000}));assert.equal(s.game.save(),true);await s.modules.saveStorageIDB.flush();
 return {...s,durable,control,host,key:s.engineModule.SAVE_KEY,backend:s.modules.saveStorageIDB};
}
// Full state after the load-boundary normalization, minus save metadata and the G2 notice line.
function strip(state){
 const g=clone(state);delete g.lastSaveDate;delete g.saveSequence;
 g.news=(g.news||[]).filter(x=>!String(x).includes(NOTICE));return g;
}
// The expected side goes through the same load-boundary normalization (memoized: the deterministic fault cases
// share identical pre-closing and committed states, and normalizing a full state is the slow step).
const normalizedCache=new Map();
function expectedOf(s,state){
 const key=JSON.stringify(strip(state));
 if(!normalizedCache.has(key))normalizedCache.set(key,strip(new s.engineModule.TycoonEngine(clone(state)).g));
 return normalizedCache.get(key);
}
async function assertReloads(s,expected,label){
 const want=expectedOf(s,expected);
 assert.deepEqual(strip(s.engineModule.TycoonEngine.load().g),want,`${label}: reload equals live`);
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 assert.deepEqual(strip(fresh.engineModule.TycoonEngine.load().g),want,`${label}: fresh durable-only hydration equals live`);
}
function assertCommittedOnce(s,before,label){
 const g=s.game.g,o=outstanding(g),tx=g.finance.transactions;
 assert.equal(g.maDealRooms.find(d=>d.id===s.deal.id).status,'acquired',`${label}: deal closed`);
 assert.equal(g.maSubsidiaries.length,before.maSubsidiaries.length+1,`${label}: one acquisition`);
 assert.equal(tx.filter(t=>t.sourceType==='maPublicEquityRaise').length,1,`${label}: one equity raise row`);
 assert.equal(tx.filter(t=>t.sourceType==='maPublicEquityRaise'&&t.category==='equityFinancing'&&t.amount===20_000_000).length,1,`${label}: ¥20M equityFinancing`);
 assert.equal(tx.filter(t=>t.sourceType==='acquireTarget').length,1,`${label}: one acquisition row`);
 assert.equal(g.finance.loans.filter(l=>l.sourceID===s.deal.id).length,1,`${label}: one term loan`);
 assert.equal(o,970000,`${label}: 950,000 + 20,000 outstanding`);assert.equal(g.sharesOut,before.sharesOut+20000);
 assert.ok(Math.abs(g.competitorOwnedRatio*o-190000)<1e-6,`${label}: competitor keeps 190,000`);
 assert.ok(Math.abs(g.founderOwnershipRatio-700000/970000)<1e-12,`${label}: founder 700,000/970,000`);
 assert.ok(Math.abs(g.externalShareholderRatio*o-(60000+20000))<1e-6,`${label}: 20,000 new shares external`);
 assert.ok(Math.abs(g.founderOwnershipRatio+g.competitorOwnedRatio+g.externalShareholderRatio-1)<1e-12,`${label}: ratios sum to 1`);
 assert.equal(g.finance.balances.capitalSurplus,before.finance.balances.capitalSurplus+20_000_000,`${label}: capital surplus`);
 assert.equal(g.companyDebt,before.companyDebt+40_000_000,`${label}: term debt`);
 assert.equal(g.personalCash,before.personalCash,`${label}: personal cash untouched`);
 assert.equal(s.modules.finance.validate(clone(g)).ok,true,`${label}: accounting valid`);
}
async function faultCase(kind,{pending=false}={}){
 const s=await scenario(),label=`${kind}${pending?'/pending':''}`;
 if(pending){
  s.control.holdPut=true;s.game.g.news.unshift('earlier accepted save');assert.equal(s.game.save(),true);
  for(let i=0;i<100&&!s.control.release;i++)await new Promise(r=>setImmediate(r));
  assert.equal(typeof s.control.release,'function',`${label}: earlier IDB put in flight`);
 }
 const before=snapshot(s.game),mirror=s.ctx.__localStorageData.get(s.key),cache=s.backend.readSync(s.key),durable=s.durable.get(s.key),puts=s.control.attempts.length,draws=s.host.draws;
 if(pending)assert.notEqual(durable,cache,`${label}: earlier save not yet durable`);
 // Count closing payloads admitted to the IDB cache (proves the post-save faults hit after an accepted save).
 const backend=s.modules.saveStorageIDB;let admitted=0;
 if(!['enqueue-false','enqueue-throw'].includes(kind))s.modules.saveStorageIDB={...backend,writeSync(k,v){if(k===s.key&&String(v).includes('maPublicEquityRaise'))admitted++;return backend.writeSync(k,v);}};
 const fault=inject(s.game,s.modules,s.ctx.localStorage,s.key,kind);let result,error;
 try{result=s.game.closeMADeal(s.deal.id);}catch(e){error=e;}finally{fault.restore();s.modules.saveStorageIDB=backend;}
 assert.ok(fault.hits()>0,`${label}: fault reached the installed closing`);
 assert.equal(error,undefined,`${label}: wrapper swallows the fault`);assert.equal(result,false,`${label}: closing rejected`);
 if(POST_SAVE.includes(kind))assert.equal(admitted,1,`${label}: the closing save was accepted before the fault`);
 assert.deepEqual(snapshot(s.game),before,`${label}: live = pre-closing (ratios, shares, cash, debt, loans, surplus, journal, deal, RNG)`);
 assert.equal(s.game.g.maDealRooms.find(d=>d.id===s.deal.id).status,'accepted');assert.equal(s.host.draws,draws,`${label}: no host RNG`);
 assert.equal(s.ctx.__localStorageData.get(s.key),mirror,`${label}: mirror bytes unchanged`);
 assert.equal(s.backend.readSync(s.key),cache,`${label}: cache bytes unchanged`);
 assert.equal(s.durable.get(s.key),durable,`${label}: durable unchanged before flush`);
 s.control.release?.();await s.backend.flush();
 assert.equal(s.durable.get(s.key),cache,`${label}: durable = earlier accepted save, never the rejected closing`);
 assert.equal(s.control.attempts.length,puts,`${label}: the closing's IDB put never started`);
 await assertReloads(s,before,`${label} rolled back`);
 // Retry after removing the fault commits exactly once.
 assert.equal(s.game.closeMADeal(s.deal.id),true,`${label}: retry commits`);assertCommittedOnce(s,before,`${label} retry`);
 assert.equal(s.game.closeMADeal(s.deal.id),false,`${label}: no second closing`);assertCommittedOnce(s,before,`${label} after repeat`);
 await s.backend.flush();
 assert.equal(s.durable.get(s.key),s.backend.readSync(s.key),`${label}: durable = cache after commit`);
 assert.equal(s.ctx.__localStorageData.get(s.key),s.backend.readSync(s.key),`${label}: mirror = cache after commit`);
 await assertReloads(s,s.game.g,`${label} committed`);assert.equal(s.host.draws,draws,`${label}: no host RNG on retry`);
 console.log(`M&A equity raise shadow boundary ${label}: rolled back live/mirror/cache/durable; retry commits once; reload/fresh PASS`);
}
(async()=>{
 for(const kind of FAULTS)await faultCase(kind);
 for(const kind of ['save-throw','notify'])await faultCase(kind,{pending:true});
 // Nested in an outer transaction: commit with the outer single save; roll back with the outer rollback.
 {const s=await scenario(),before=snapshot(s.game);let saves=0;const save=s.game.save;s.game.save=function(...a){if(!this.inTransaction())saves++;return save.apply(this,a);};
  assert.equal(s.game.runTransaction(()=>{const ok=s.game.closeMADeal(s.deal.id);s.game.g.news.unshift('outer marker');return ok;}),true);s.game.save=save;
  assert.equal(saves,1,'nested: one outer save');assertCommittedOnce(s,before,'nested commit');await s.backend.flush();
  assert.equal(s.durable.get(s.key),s.backend.readSync(s.key));const stored=JSON.parse(s.durable.get(s.key));
  assert.equal(stored.news[0],'outer marker','nested: outer change durable with the closing');
  assert.equal(stored.companyCash,s.game.g.companyCash);assert.equal(stored.maSubsidiaries.length,1);
  assert.ok(stored.news.some(x=>x.includes(NOTICE)),'nested: the deferred outer save also persists the notice line');
  await assertReloads(s,s.game.g,'nested commit');console.log('nested commit PASS');}
 {const s=await scenario(),before=snapshot(s.game),mirror=s.ctx.__localStorageData.get(s.key),cache=s.backend.readSync(s.key),puts=s.control.attempts.length;let inner;
  assert.throws(()=>s.game.runTransaction(()=>{inner=s.game.closeMADeal(s.deal.id);throw new Error('outer rollback');}),/outer rollback/);
  assert.equal(inner,true,'nested: inner closing reported success before the outer rollback (G3)');
  assert.deepEqual(snapshot(s.game),before,'nested: outer rollback restores the closing');
  assert.equal(s.ctx.__localStorageData.get(s.key),mirror);assert.equal(s.backend.readSync(s.key),cache);await s.backend.flush();
  assert.equal(s.durable.get(s.key),cache);assert.equal(s.control.attempts.length,puts);await assertReloads(s,before,'nested rollback');
  assert.equal(s.game.closeMADeal(s.deal.id),true);assertCommittedOnce(s,before,'nested rollback retry');console.log('nested outer rollback PASS');}
 {const s=await scenario(),before=snapshot(s.game),fault=inject(s.game,s.modules,s.ctx.localStorage,s.key,'notify');let r;
  try{r=s.game.runTransaction(()=>{const ok=s.game.closeMADeal(s.deal.id);s.game.g.news.unshift('outer marker');return {ok};});}finally{fault.restore();}
  assert.equal(r.ok,false,'nested: failed inner closing returns false');assert.ok(fault.hits()>0);
  assert.equal(s.game.g.maDealRooms.find(d=>d.id===s.deal.id).status,'accepted');assert.equal(s.game.g.maSubsidiaries.length,0);assert.equal(s.game.g.sharesOut,before.sharesOut);
  assert.equal(s.game.g.companyCash,before.companyCash,'nested: no closing money');assert.equal(s.game.g.companyDebt,before.companyDebt);
  assert.equal(s.game.g.news[0],'outer marker','nested: outer change still commits alone');await s.backend.flush();
  assert.equal(s.durable.get(s.key),s.backend.readSync(s.key));assert.equal(JSON.parse(s.durable.get(s.key)).news[0],'outer marker');
  await assertReloads(s,s.game.g,'nested inner failure');console.log('nested inner failure PASS');}
 // Determinism.
 {const a=await scenario(),b=await scenario();assert.equal(a.game.closeMADeal(a.deal.id),true);assert.equal(b.game.closeMADeal(b.deal.id),true);
  const eco=x=>{const c=snapshot(x);delete c.lastSaveDate;delete c.saveSequence;return JSON.stringify(c);};assert.equal(eco(a.game),eco(b.game),'deterministic');
  assert.equal(a.host.draws,b.host.draws);console.log('determinism PASS');}
 console.log('M&A equity raise shadow-state atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
