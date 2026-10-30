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
 // 5. P3-4 verification leg (W-SHARE-SWAP): with the listing's own market row present, the swap issues exactly the
 // computed shares and mirrors them on that row at once; an issued-share write skewed by one share is refused and the
 // whole closing is rolled back (nothing durable); a second-generation company keeps the existing closing.
 async function listed(serial=1){
  const s=await scenario({treasury:50000,competitor:.2}),g=s.game.g;g.currentCompanySerial=serial;
  g.market=g.market.filter(x=>x.id!==g.ticker);g.market.push({id:g.ticker,name:g.companyName,price:1000,issuedShares:g.sharesOut,marketCap:1000*g.sharesOut,priceHistory:[{week:g.week,price:1000}]});
  assert.equal(s.game.save(),true);await s.modules.saveStorageIDB.flush();return s;
 }
 {const s=await listed(),g=s.game.g,issued=Math.ceil(s.deal.acceptedTerms.finalPrice/1000);
  assert.equal(s.modules.phase3OwnershipPlanner.inspectOwnershipAuthority(g,{family:'player-common',issuerEntityId:'entity:company:player',securityClassId:'security:player-company:common',currentCompanySerial:1}).status,'OBSERVED','listed: the leg is plannable');
  const before=g.sharesOut;await check(s,CLOSE.close,'listed leg');
  assert.equal(g.sharesOut,before+issued,'listed: exactly the computed new shares');
  const own=g.market.find(x=>x.id===g.ticker);assert.equal(own.issuedShares,g.sharesOut,'listed: own market row mirrors the issued quantity');assert.equal(own.marketCap,own.price*g.sharesOut);}
 {const s=await listed(),prior=JSON.stringify(s.game.g),bytes=s.durable.get(s.key)??null,ratios=s.game.updateOwnershipRatios;
  s.game.updateOwnershipRatios=function(...args){this.g.sharesOut+=1;return ratios.apply(this,args);};
  assert.equal(s.game.closeMADeal(s.deal.id),false,'a skewed issued-share write is refused');
  assert.equal(JSON.stringify(s.game.g),prior,'and the whole closing is rolled back');
  await s.modules.saveStorageIDB.flush();assert.equal(s.durable.get(s.key)??null,bytes,'nothing durable');}
 {const s=await listed(2),g=s.game.g,ratios=s.game.updateOwnershipRatios;
  s.game.updateOwnershipRatios=function(...args){this.g.sharesOut+=1;return ratios.apply(this,args);};
  assert.equal(s.game.closeMADeal(s.deal.id),true,'second generation keeps the existing closing (unchecked)');}
 console.log('share swap P3-4 verification leg: listed issuance + mirror, skewed write refused and rolled back, second generation unchanged PASS');
 // W-ISSUE-RAW has no persistence boundary or authority of its own. Test it only within the existing caller TX,
 // separately from the deal-room and M&A shadow contracts above; this does not make it a standalone command.
 for(const mode of ['commit','reject','throw','save-false','save-throw']){
  const s=await listed(),game=s.game,backend=s.modules.saveStorageIDB,raw=game.issueSharesToExternalHolders;
  assert.equal(s.modules.phase3OwnershipPlanner.WRITER_POLICIES['W-ISSUE-RAW'].rejection,'INTERNAL_ENTRY');
  const before=snapshot(game),prior=holdings(before),bytes=backend.readSync(s.key),puts=s.control.attempts.length,draws=s.host.draws;
  assert.deepEqual([before.sharesOut,before.treasuryBuybackShares,before.founderShares],[1000000,50000,700000]);
  close(prior.competitor,190000,'pinned competitor quantity');close(prior.external,60000,'pinned external quantity');
  const save=game.save;
  if(mode==='save-false')game.save=()=>false;
  if(mode==='save-throw')game.save=function(...args){const result=save.apply(this,args);if(!this.inTransaction())throw Error('raw issuance save admitted then threw');return result;};
  let entered=false,result,error;
  try{result=game.runTransaction(()=>{
   assert.equal(game.inTransaction(),true);entered=true;
   const methods={save:game.save,emit:game.emit,notify:game.notify};
   const noSideEffect=()=>{throw Error('raw helper attempted save/event');};
   Object.assign(game,{save:noSideEffect,emit:noSideEffect,notify:noSideEffect});
   try{assert.equal(raw.call(game,123),undefined);}finally{Object.assign(game,methods);}
   assert.equal(game.g.sharesOut,before.sharesOut+123);assert.equal(game.stock(game.g.ticker).issuedShares,before.sharesOut+123);
   assert.equal(game.stock(game.g.ticker).marketCap,1000*(before.sharesOut+123));
   close(game.g.competitorOwnedRatio,prior.competitor/(prior.o+123),'raw helper preserves competitor quantity');
   close(holdings(game.g).external,prior.external+123,'raw helper issues only external units');
   for(const key of ['founderShares','treasuryBuybackShares','personalStocks','companyStocks','companyCash','personalCash','companyDebt','personalDebt','finance','simulationRng'])
    assert.deepEqual(snapshot(game)[key],before[key],'raw helper leaves '+key+' unchanged');
   assert.equal(backend.readSync(s.key),bytes,'raw helper has not saved');assert.equal(s.host.draws,draws);
   if(mode==='reject')return false;if(mode==='throw')throw Error('caller rejected raw issuance');return true;
  });}catch(e){error=e;}finally{game.save=save;}
  assert.equal(entered,true,'actual raw helper caller boundary reached');
  if(mode==='throw'||mode==='save-throw')assert.match(error?.message||'',/caller rejected raw issuance|raw issuance save admitted then threw/);
  else{assert.equal(error,undefined);assert.equal(result,mode==='commit');}
  await backend.flush();
  if(mode==='commit'){
   assert.equal(game.g.sharesOut,before.sharesOut+123);assert.equal(game.stock(game.g.ticker).issuedShares,before.sharesOut+123);
   assert.equal(s.modules.finance.validate(snapshot(game)).ok,true);
  }else{
   assert.deepEqual(snapshot(game),before,'caller/save failure restores full state');
   assert.equal(backend.readSync(s.key),bytes);assert.equal(s.control.attempts.length,puts,'rejected put never starts');
  }
  assert.equal(s.host.draws,draws);assert.equal(s.ctx.__localStorageData.get(s.key),backend.readSync(s.key));
  assert.equal(s.durable.get(s.key),backend.readSync(s.key));
  const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
  const restored=fresh.engineModule.TycoonEngine.load();assert(restored);
  assert.equal(restored.g.sharesOut,before.sharesOut+(mode==='commit'?123:0));
  assert.equal(restored.stock(restored.g.ticker).issuedShares,restored.g.sharesOut);
  close(holdings(restored.g).competitor,190000,'fresh durable competitor quantity');
  close(holdings(restored.g).external,mode==='commit'?60123:60000,'fresh durable external quantity');
  assert.deepEqual(snapshot(restored).simulationRng,before.simulationRng,'fresh hydration preserves persisted RNG');
  for(const key of ['companyCash','personalCash','founderShares','treasuryBuybackShares'])assert.equal(restored.g[key],before[key]);
  assert.equal(fresh.modules.finance.validate(snapshot(restored)).ok,true);
  console.log('raw external issuance / existing caller TX / '+mode+' / fresh durable hydration PASS');
 }
 // W-ACQUIRE-COMPAT: capture the old engine body, not the installed deal-room wrapper.
 // Only the explicit existing caller TX below owns persistence/rollback; standalone use stays unproved.
 const {injectFault}=require('./helpers/transaction-fault-case');
 const economicState=g=>{const copy=JSON.parse(JSON.stringify(g));delete copy.lastSaveDate;delete copy.saveSequence;return copy;};
 let compatReference;
 for(const mode of ['normal','save-false','save-throw']){
  const s=await listed(),game=s.game,backend=s.modules.saveStorageIDB;
  game.g.acquisitionTargets[0].activeDealID=null;assert.equal(game.save(),true);await backend.flush();
  const proto=Object.getPrototypeOf(s.engineModule.TycoonEngine.prototype),captured=proto.acquireTarget;
  assert.equal(Object.hasOwn(proto,'acquireTarget'),true);assert.notEqual(captured,game.acquireTarget);
  assert.equal(s.modules.phase3OwnershipPlanner.WRITER_POLICIES['W-ACQUIRE-COMPAT'].rejection,'INTERNAL_ENTRY');
  game.acquireTarget=()=>{throw Error('installed compatibility wrapper must not run');};
  const before=snapshot(game),bytes=backend.readSync(s.key),puts=s.control.attempts.length,draws=s.host.draws,targetID=before.acquisitionTargets[0].id;
  assert.equal(before.acquisitionTargets[0].valuation,80000000,'pinned legacy valuation');
  let calls=0;
  const invoke=()=>game.runTransaction(()=>{assert.equal(game.inTransaction(),true);calls++;return captured.call(game,targetID,'shareSwap');});
  async function loaded(expected){
   const wanted=economicState(new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected))).g);
   assert.deepEqual(economicState(s.engineModule.TycoonEngine.load().g),wanted,'compat production reload');
   const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
   assert.deepEqual(economicState(fresh.engineModule.TycoonEngine.load().g),wanted,'compat fresh durable-only hydration');
  }
  const fault=mode==='normal'?null:injectFault({...s,backend},mode);
  try{if(mode==='save-throw')assert.throws(invoke,/save accepted then threw/);else assert.equal(invoke(),mode==='normal');}finally{fault?.restore();}
  assert.equal(calls,1,'captured acquisition really executed');
  if(fault){
   assert.ok(fault.hits()>0);assert.deepEqual(snapshot(game),before,'full legacy acquisition/RNG rollback');
   await backend.flush();assert.equal(backend.readSync(s.key),bytes);assert.equal(s.ctx.localStorage.getItem(s.key),bytes);
   assert.equal(s.durable.get(s.key),bytes);assert.equal(s.control.attempts.length,puts,'failed compat put never starts');
   await loaded(before);assert.equal(invoke(),true,'same captured acquisition retries');assert.equal(calls,2);
  }
  const after=snapshot(game);
  assert.equal(after.sharesOut,before.sharesOut+86400,'legacy 80M x1.08 /1000 issues86400 external shares');
  assert.equal(game.stock(after.ticker).issuedShares,after.sharesOut);assert.equal(game.stock(after.ticker).marketCap,1000*after.sharesOut);
  for(const key of ['founderShares','treasuryBuybackShares','personalStocks','companyStocks','companyCash','personalCash','companyDebt','personalDebt','maDealRooms'])
   assert.deepEqual(after[key],before[key],'compat preserves '+key);
  for(const key of ['seed','state','draws'])assert.equal(after.simulationRng[key],before.simulationRng[key],'goodwill ID does not draw RNG: '+key);
  assert.equal(s.host.draws,draws);assert.ok(after.simulationRng.nextID>before.simulationRng.nextID,'existing goodwill ID allocation retained');
  close(holdings(after).competitor,190000,'legacy competitor quantity preserved');close(holdings(after).external,146400,'legacy external quantity');assertRatios(after,'captured compatibility');
  assert.equal(after.acquisitionTargets.some(t=>t.id===targetID),false);assert.equal(after.totalAcquisitions,before.totalAcquisitions+1);
  assert.equal(after.maSubsidiaries.length,before.maSubsidiaries.length+1);assert.equal(after.goodwillRecords.length,before.goodwillRecords.length+1);
  const sub=after.maSubsidiaries.at(-1);assert.equal(sub.acquisitionPrice,86400000);assert.equal(sub.identifiableNetAssetsBookValue,80000000);assert.equal(sub.goodwillBookValue,6400000);
  for(const [source,field] of [['acquireTargetShareSwap','assetEffect'],['shareSwapCapital','equityEffect']]){
   const rows=after.finance.transactions.filter(t=>t.sourceType===source&&t.sourceID===targetID);
   assert.equal(rows.length,1,'one '+source+' receipt');assert.equal(rows[0].cashEffect,0);assert.equal(rows[0][field],86400000);
  }
  assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok,true);
  if(compatReference)assert.deepEqual(economicState(after),compatReference,'rollback+retry equals uninterrupted legacy acquisition including ID/RNG');else compatReference=economicState(after);
  await backend.flush();assert.equal(s.control.attempts.length,puts+1,'one successful compat put');await loaded(after);
  const stable=snapshot(game),saved=backend.readSync(s.key);assert.equal(invoke(),false,'consumed target cannot be acquired twice');
  assert.deepEqual(snapshot(game),stable);await backend.flush();assert.equal(backend.readSync(s.key),saved);assert.equal(s.control.attempts.length,puts+1);
  console.log('captured acquireTarget / explicit caller TX / '+mode+' / retry-replay-fresh fake-IDB PASS');
 }
 console.log('share swap ownership ratios PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
