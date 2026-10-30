'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let draws=0;
const loaded=loadGame({headless:true,random:()=>{draws++;return 0.25;}});
const api=loaded.modules.economicReadModel;
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){return {saveVersion:9,ticker:'OWN',week:7,currentCompanySerial:1,isCompanySold:false,
  companyName:'Company',playerName:'Founder',publicCompany:true,sharesOut:1000,treasuryBuybackShares:100,founderShares:600,
  market:[{id:'OWN'},{id:'X'}],startups:[],personalStocks:{OWN:{qty:10,avg:2},X:{qty:20,avg:4}},companyStocks:{X:{qty:30,avg:5}}};}
const state=fixture(),before=JSON.stringify(state),drawBefore=draws;
const index=api.buildOwnershipIdentityIndex(state),model=api.projectOwnershipSnapshot(state,index);
assert.equal(model.positions.length,3);
assert.equal(model.positions[0].quantity.value,610);
assert.equal(model.classes[0].outstandingQuantity,900);
assert.equal(model.positions[0].assetRole,'founder-equity');
assert.equal(model.positions[1].accountKind,'company');assert.equal(model.positions[1].quantity.value,30);
assert.equal(model.positions[2].accountKind,'personal');assert.equal(model.positions[2].quantity.value,20);
assert.equal(model.sourceReplacements.length,4);
assert.equal(new Set(model.sourceReplacements.map(row=>row.sourcePath)).size,4);
assert(!Object.hasOwn(model,'unresolvedAliases'),'legacy aliases are replaced rather than appended');
assert.equal(model.sourceSnapshotToken,index.sourceSnapshotToken);
assert.equal(api.projectExternalListedHoldings(state,index).sourceSnapshotToken,index.sourceSnapshotToken);
assert.equal(model.complete,false);assert.equal(model.commandEligible,false);assert.equal(model.wealthComplete,false);
assert(model.coverage.some(row=>row.family==='vc'&&row.status==='not-implemented'));
assert.equal(JSON.stringify(state),before);assert.equal(draws,drawBefore);assert(!Object.isFrozen(state));
function frozen(value){if(value&&typeof value==='object'){assert(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}}
frozen(model);frozen(index);
assert.throws(()=>{model.positions[0].quantity.value=0;},TypeError);
assert.deepEqual(plain(api.projectOwnershipSnapshot(state)),plain(model));
assert.deepEqual(plain(api.projectOwnershipSnapshot(plain(state))),plain(model),'v9 JSON reload retains evidence');
for(const mutate of [s=>s.sharesOut++,s=>s.founderShares++,s=>s.personalStocks.X.qty++,s=>s.personalStocks.X.avg++,s=>s.week++,s=>s.currentCompanySerial++,s=>s.market.push({id:'X'})]){
  const raw=fixture(),handle=api.buildOwnershipIdentityIndex(raw);mutate(raw);
  for(const result of [api.projectOwnershipSnapshot(raw,handle),api.projectExternalListedHoldings(raw,handle)]){
    assert(result.issues.some(row=>row.code==='STALE_EVIDENCE'));assert.equal(result.positions.length,0);
  }
}
for(const handle of [{},api.buildListedHoldingsIdentityIndex(state),api.buildOwnershipIdentityIndex(plain(state))])assert(api.projectOwnershipSnapshot(state,handle).issues.some(row=>row.code==='STALE_EVIDENCE'));
for(const serial of [undefined,2,3]){
  const raw=fixture();raw.currentCompanySerial=serial;
  const view=api.projectOwnershipSnapshot(raw);
  assert.equal(view.positions.length,4);assert.equal(view.positions[0].quantity.value,600);
  assert.equal(view.positions[0].assetRole,'unresolved');assert.equal(view.classes.length,0);
  const retained=view.positions.find(row=>row.instrumentAlias==='OWN');assert.equal(retained.quantity.value,10);
  assert.equal(retained.securityClassId,null);assert.equal(retained.votingUnits.value,null);
  assert.equal(view.sourceReplacements.filter(row=>row.sourcePath==='personalStocks["OWN"]').length,1);
}
for(const startups of [[{id:'s',ipoStockID:'OWN',ownedPersonal:0,ownedCompany:0}]]){
  const raw=fixture();raw.startups=startups;
  const view=api.projectOwnershipSnapshot(raw);assert.equal(view.positions[0].quantity.value,600);
  assert(view.issues.some(row=>row.code==='ALIAS_CONFLICT'));assert.equal(view.positions.length,4);
}
// The adapter retains malformed-ID alias evidence, but composition rejects the
// whole invalid inventory rather than claiming a bound player class.
const badId=fixture();badId.startups=[{id:null,ipoStockID:'OWN'}];
assert(api.projectExternalListedHoldings(badId).positions.some(row=>row.instrumentAlias==='OWN'&&row.quantity.value===10));
const badIdView=api.projectOwnershipSnapshot(badId);
assert.equal(badIdView.positions.length,0);assert.equal(badIdView.classes.length,0);
assert(badIdView.issues.some(row=>row.code==='ALIAS_CONFLICT'));
const sold=fixture();sold.isCompanySold=true;assert.equal(api.projectOwnershipSnapshot(sold).positions[0].quantity.value,600);
for(const value of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'600',null]){
  const raw=fixture();raw.founderShares=value;
  const view=api.projectOwnershipSnapshot(raw);assert.equal(view.positions[0].quantity.value,null);assert.equal(view.classes.length,0);
}
let getters=0;
const accessor=fixture();Object.defineProperty(accessor,'founderShares',{enumerable:true,get(){getters++;throw Error('must not execute');}});
assert(api.projectOwnershipSnapshot(accessor).issues.some(row=>row.code==='INPUT_INVALID'));assert.equal(getters,0);
for(const raw of [null,[],new Date(),{...fixture(),companyName:{}},{...fixture(),publicCompany:1},
  {...fixture(),startups:{}},{...fixture(),market:null},{...fixture(),startups:[{ipoStockID:'OWN'}]},
  {...fixture(),ticker:' ',personalStocks:{' ':{qty:10}}},{...fixture(),ticker:'\t',personalStocks:{'\t':{qty:10}}}]){
  const view=api.projectOwnershipSnapshot(raw);assert.equal(view.positions.length,0);assert(view.issues.some(row=>row.code==='INPUT_INVALID'));
}
// Financial fields are outside this ownership token; never label it financial/wealth complete.
const cash=fixture(),cashIndex=api.buildOwnershipIdentityIndex(cash);cash.companyCash=123;
assert.equal(api.projectOwnershipSnapshot(cash,cashIndex).wealthComplete,false);
// No production consumer, transaction or save format is changed by this opt-in reader.
assert.equal(state.saveVersion,9);
console.log('PASS phase3 ownership snapshot: composition, dedup, generation quarantine, scoped tokens, purity and v9 reload');

// P3-4 partial replacement-boundary evidence: production v9 compaction/import/load and an actual rejected transaction.
// This proves read-model index invalidation/preservation only, not authoritative writer closure or activation.
(async()=>{
 const {boot}=require('./fixtures/subsidiary-quarter-close');
 const s=boot();await s.backend.hydrate();
 const st=s.engineModule.createInitialState({configured:true});
 Object.assign(st,{week:7,companyName:'Source',ticker:'OWN',currentCompanySerial:1,isCompanySold:false,publicCompany:true,
  sharesOut:1000,treasuryBuybackShares:100,founderShares:600,stockPrice:99,startups:[],
  personalStocks:{OWN:{qty:10,avg:2},EXT:{qty:20,avg:4}},companyStocks:{EXT:{qty:30,avg:5}}});
 st.market=st.market.filter(row=>!['OWN','EXT'].includes(row.id));
 for(const [id,price,issuedShares] of [['OWN',99,1000],['EXT',4,2000]])st.market.push({id,name:id,price,previous:price,
  issuedShares,marketCap:price*issuedShares,trend:0,volatility:0,priceHistory:[{week:7,price}]});
 st.finance=s.modules.finance.defaultFinanceState(st);
 const game=new s.engineModule.TycoonEngine(st),read=s.modules.economicReadModel;
 function checked(ctx,engine,index){
  const before=JSON.stringify(engine.g),draws=ctx.host.draws;
  const view=ctx.modules.economicReadModel.projectOwnershipSnapshot(engine.g,index);
  assert.equal(JSON.stringify(engine.g),before,'reader preserves the full current state');assert.equal(ctx.host.draws,draws,'reader draws no RNG');
  assert.equal(view.commandEligible,false);assert.equal(view.wealthComplete,false);return view;
 }
 function quantities(view){
  assert(!view.issues.some(x=>x.code==='STALE_EVIDENCE'));
  assert.equal(view.classes[0].issuedQuantity,1000);assert.equal(view.classes[0].treasuryQuantity,100);
  assert.equal(view.classes[0].outstandingQuantity,900);
  assert.equal(view.positions.find(x=>x.assetRole==='founder-equity').quantity.value,610,'founder legacy600 + personal own10 exactly once');
  assert.equal(view.positions.find(x=>x.instrumentAlias==='EXT'&&x.accountKind==='personal').quantity.value,20);
  assert.equal(view.positions.find(x=>x.instrumentAlias==='EXT'&&x.accountKind==='company').quantity.value,30);
 }
 assert.equal(game.save(),true);await s.backend.flush();quantities(checked(s,game));
 for(const profile of ['normal','emergency','critical']){
  const beforeRoot=game.g,index=read.buildOwnershipIdentityIndex(game.g),cash=[game.g.companyCash,game.g.personalCash];
  const compact=s.modules.saveStorage.compactStateForStorage(game.g,profile).state;
  game.importSave(JSON.stringify(compact));
  assert.notEqual(game.g,beforeRoot,'production import replaces the root');
  assert(checked(s,game,index).issues.some(x=>x.code==='STALE_EVIDENCE'),'pre-import index cannot bind the replacement root');
  quantities(checked(s,game));assert.equal(game.g.saveVersion,9);
  assert.deepEqual([game.g.companyCash,game.g.personalCash],cash,'company/personal cash stay separate across import');
  await s.backend.flush();const bytes=s.backend.readSync(s.key);assert.equal(s.durable.get(s.key),bytes,'imported state is durable');
  const loaded=s.engineModule.TycoonEngine.load();assert(loaded,'production load succeeds');quantities(checked(s,loaded));
  const {loadGame}=require('./harness'),{indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');
  const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});
  await fresh.modules.saveStorageIDB.hydrate();const hydrated=fresh.engineModule.TycoonEngine.load();assert(hydrated);
  const before=JSON.stringify(hydrated.g),view=fresh.modules.economicReadModel.projectOwnershipSnapshot(hydrated.g);
  quantities(view);assert.equal(JSON.stringify(hydrated.g),before,'fresh hydration reader is pure');
  assert.deepEqual([hydrated.g.companyCash,hydrated.g.personalCash],cash,'fresh hydration preserves both cash accounts');
  console.log('ownership replacement '+profile+': nonzero quantities / import / reload / fresh fake-IDB PASS');
 }
 const before=JSON.stringify(game.g),bytes=s.backend.readSync(s.key),index=read.buildOwnershipIdentityIndex(game.g);
 let speculative;
 assert.equal(game.runTransaction(()=>{
  game.g.personalStocks=plain(game.g.personalStocks);game.g.personalStocks.OWN.qty++;
  speculative=read.buildOwnershipIdentityIndex(game.g);
  assert(checked(s,game,index).issues.some(x=>x.code==='STALE_EVIDENCE'),'changed backing map invalidates the old index inside the boundary');
  return false;
 }),false);
 assert.equal(JSON.stringify(game.g),before,'rejected real transaction restores every state field and persisted RNG');
 quantities(checked(s,game,index));
 assert(checked(s,game,speculative).issues.some(x=>x.code==='STALE_EVIDENCE'),'speculative index cannot survive rollback');
 assert.equal(s.backend.readSync(s.key),bytes);await s.backend.flush();assert.equal(s.durable.get(s.key),bytes,'rejected replacement cannot become durable');
 console.log('P3-4 ownership replacement-boundary read-model evidence PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
