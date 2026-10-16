'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let draws=0;
const loaded=loadGame({headless:true,random:()=>{draws++;return 0.25;}});
const api=loaded.modules.economicReadModel;
const plain=value=>JSON.parse(JSON.stringify(value));
const project=api.projectExternalListedHoldings;
assert.equal(typeof project,'function','installed module exposes opt-in reader');
const state={ticker:'OWN',saveVersion:9,currentCompanySerial:1,
  market:[{id:'X',issuedShares:1000,price:3},{id:'IPO',issuedShares:1000000}],
  startups:[{id:'s:1/%',ipoStockID:'IPO',ownedPersonal:0,ownedCompany:0}],
  personalStocks:{X:{qty:20,avg:90},OWN:{qty:10,avg:10},IPO:{qty:30,avg:4}},
  companyStocks:{X:{qty:30,avg:95},OWN:{qty:5,avg:2}},simulationRng:{seed:42}};
const before=JSON.stringify(state),drawBefore=draws;
const index=api.buildListedHoldingsIdentityIndex(state),result=project(state,index);
assert.equal(JSON.stringify(state),before);assert.equal(draws,drawBefore);
assert.equal(result.authority,'read-only');assert.equal(result.complete,false);
assert.equal(result.positions.length,4,'personal own lot delegates to P3-2, company own lot remains unresolved');
const personal=result.positions.find(x=>x.accountKind==='personal'&&x.instrumentAlias==='X');
const company=result.positions.find(x=>x.accountKind==='company'&&x.instrumentAlias==='X');
assert.equal(personal.quantity.value,20);assert.equal(company.quantity.value,30);
assert.notEqual(personal.registeredHolder.entityId,company.registeredHolder.entityId);
assert.notEqual(personal.positionId,company.positionId);
assert.equal(company.registeredHolder.generation,null,'active slot/serial is not historical ownership proof');
const ipo=result.positions.find(x=>x.instrumentAlias==='IPO');
assert.equal(ipo.issuer.entityId,'entity:company:startup:s%3A1%2F%25');
assert.equal(ipo.issuer.identityStatus,'source-scoped');
for(const position of result.positions){
  assert.equal(position.securityClassId,null);assert.equal(position.ownershipKey,null);
  assert.equal(position.votingUnits.value,null);assert.equal(position.economicFraction.value,null);
  assert.equal(position.assetRole,'unresolved');
}
assert.equal(personal.issuer.entityId,null,'listing alias and issued count are insufficient legal identity');
for(const extra of [{market:{}},{startups:{}},{market:[{id:' '}]},{startups:[{id:' ',ipoStockID:'OTHER'}]}]){
  const raw={ticker:'OWN',currentCompanySerial:1,market:[],startups:[],personalStocks:{OWN:{qty:10}},...extra};
  const view=project(raw);
  assert(view.issues.some(row=>row.code==='INPUT_INVALID'));
  assert(!view.sourceCoverage.some(row=>row.status==='delegated'),'invalid alias inventories cannot prove safe delegation');
  assert.equal(view.positions.length,1);assert.equal(view.positions[0].quantity.value,10);
  assert.equal(view.positions[0].issuer.entityId,null);assert.equal(view.positions[0].assetRole,'unresolved');
}
for(const ticker of [' ','\t']){
  const view=project({ticker,currentCompanySerial:1,market:[],startups:[],personalStocks:{[ticker]:{qty:10}}});
  assert(!view.sourceCoverage.some(row=>row.status==='delegated'),'match P3-2 nonblank player binding');
  assert.equal(view.positions.length,1);assert.equal(view.positions[0].quantity.value,10);
  assert.equal(view.positions[0].issuer.entityId,null);assert.equal(view.positions[0].votingUnits.value,null);
}
function frozen(value){if(value&&typeof value==='object'){assert(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}}
frozen(result);frozen(index);
assert(!Object.isFrozen(state),'reader must not freeze the input');
assert.throws(()=>{result.positions[0].sourceRefs[0].path='changed';},TypeError);
assert.deepEqual(plain(project(state)),plain(result));
const reorder=plain(state);reorder.personalStocks={IPO:state.personalStocks.IPO,OWN:state.personalStocks.OWN,X:state.personalStocks.X};
assert.deepEqual(plain(project(reorder)),plain(result),'map insertion ordering is immaterial');
assert(project(plain(state),index).issues.some(x=>x.code==='STALE_EVIDENCE'));
state.personalStocks.X.qty++;
assert(project(state,index).issues.some(x=>x.code==='STALE_EVIDENCE'),'same-object same-week mutation invalidates index');
state.personalStocks.X.qty--;
assert.deepEqual(plain(project(state,index)),plain(result));
assert(project(state,{}).issues.some(x=>x.code==='STALE_EVIDENCE'));
for(const raw of [null,[],42,'bad',new Date(),new Map()])assert(project(raw).issues.some(x=>x.code==='INPUT_INVALID'));
for(const map of ['personalStocks','companyStocks']){
  for(const qty of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'3',null,{},true]){
    const raw={ticker:'OWN',[map]:{X:{qty}}},model=project(raw);
    assert.equal(model.positions.length,1);assert.equal(model.positions[0].quantity.value,null);
    assert(model.issues.some(x=>x.code==='QUANTITY_OUT_OF_ENVELOPE'));
    assert(Object.is(raw[map].X.qty,qty));
  }
  for(const qty of [0,0.5,Number.MAX_SAFE_INTEGER])assert.equal(project({ticker:'OWN',[map]:{X:{qty}}}).positions[0].quantity.value,qty);
  for(const malformed of [null,[],5,new Date()])assert(project({[map]:malformed}).issues.some(x=>x.code==='INPUT_INVALID'));
}
let getters=0;
const accessor={ticker:'OWN',personalStocks:{X:{get qty(){getters++;throw Error('must not call');}}}};
assert(project(accessor).issues.some(x=>x.code==='INPUT_INVALID'));assert.equal(getters,0);
const rootGetter={get personalStocks(){getters++;throw Error('must not call');}};
assert(project(rootGetter).issues.some(x=>x.code==='INPUT_INVALID'));assert.equal(getters,0);
for(const raw of [
  {personalStocks:{['\ud800']:{qty:1}}},
  {market:[{id:'IPO'}],startups:[{id:'\ud800',ipoStockID:'IPO',ownedCompany:0,ownedPersonal:0}],personalStocks:{IPO:{qty:1}}},
  new Proxy({},{getPrototypeOf(){throw Error('proxy trap');}}),
  {market:new Array(2)}
])assert(project(raw).issues.some(x=>x.code==='INPUT_INVALID'),'malformed sources must fail with structured evidence');
const cyclic={};cyclic.self=cyclic;
assert(project({personalStocks:cyclic}).issues.some(x=>x.code==='INPUT_INVALID'));
assert(project({personalStocks:Object.create({X:{qty:4}})}).issues.some(x=>x.code==='INPUT_INVALID'));
const collision=plain(state);collision.market.push({...collision.market[1]});
assert.equal(project(collision).positions.find(x=>x.instrumentAlias==='IPO').issuer.entityId,null);
assert(project(collision).issues.some(x=>x.code==='ALIAS_CONFLICT'));
for(const change of [
  s=>s.startups.push({id:'other',ipoStockID:'IPO',ownedPersonal:0,ownedCompany:0}),
  s=>s.startups.push({id:s.startups[0].id}),
  s=>{s.startups[0].ownedPersonal=0.1;},
  s=>{s.ticker='IPO';}
]){
  const raw=plain(state);change(raw);
  const rows=project(raw).positions.filter(x=>x.instrumentAlias==='IPO');
  for(const row of rows)assert.equal(row.issuer.entityId,null,'conflicting claims must not receive issuer identity');
}
for(const badID of [undefined,'',null,42]){
 const raw=plain(state);raw.startups.push({id:badID,ipoStockID:'IPO',ownedPersonal:0,ownedCompany:0});
 const position=project(raw).positions.find(x=>x.instrumentAlias==='IPO');
 assert.equal(position.issuer.entityId,null,'invalid source ID must still quarantine its conflicting listing alias');
 assert(position.reasons.some(x=>x.code==='ALIAS_CONFLICT'));
}
for(const serial of [undefined,2,3]){
 const raw=plain(state);raw.currentCompanySerial=serial;
 const position=project(raw).positions.find(x=>x.accountKind==='personal'&&x.instrumentAlias==='OWN');
 assert(position,'generation-ambiguous own ticker lot remains observable');
 assert.equal(position.quantity.value,10);assert.equal(position.issuer.entityId,null);
 assert(position.reasons.some(x=>x.code==='GENERATION_UNPROVEN'));
}
const orphan=project({ticker:'OWN',personalStocks:{LOST:{qty:9}}});
assert.equal(orphan.positions[0].quantity.value,9);assert.equal(orphan.positions[0].issuer.entityId,null);
const split=plain(state);split.personalStocks.IPO.qty*=2;split.market[1].issuedShares*=2;
assert.equal(project(split).positions.find(x=>x.instrumentAlias==='IPO').positionId,ipo.positionId);
split.market[1].suspended=true;
assert.equal(project(split).positions.find(x=>x.instrumentAlias==='IPO').listingStatus,'suspended');
const missingIpoTicker=plain(state);delete missingIpoTicker.ticker;
const unresolvedIpo=project(missingIpoTicker).positions.find(x=>x.instrumentAlias==='IPO');
assert.equal(unresolvedIpo.issuer.entityId,null);assert.equal(unresolvedIpo.issuer.identityStatus,'unresolved');
const missingTicker=project({personalStocks:{OWN:{qty:7}}});
assert.equal(missingTicker.positions.length,1);assert.equal(missingTicker.positions[0].issuer.entityId,null);
const special=project({personalStocks:{'a:b':{qty:1},'a%3Ab':{qty:2},'__proto__':{qty:3}}});
assert.equal(new Set(special.positions.map(x=>x.positionId)).size,special.positions.length);
// Real old-save compaction/hydration path, no new saved registry or writer call.
const engine=new loaded.engineModule.TycoonEngine();
const original=JSON.stringify(engine.g),rngBefore=draws;
const first=plain(project(engine.g));project(engine.g);
assert.equal(JSON.stringify(engine.g),original);assert.equal(draws,rngBefore);
const compact=loaded.modules.saveStorage.compactStateForStorage(engine.g,'critical').state;
const compactBefore=JSON.stringify(compact);project(compact);assert.equal(JSON.stringify(compact),compactBefore);
const restored=new loaded.engineModule.TycoonEngine();restored.g=plain(compact);restored.normalize();
assert.deepEqual(plain(project(restored.g)),plain(project(compact)));
assert.equal(restored.g.saveVersion,9);assert.equal(loaded.engineModule.SAVE_KEY,'capitalism_tycoon_web_v1');
assert.equal(Object.hasOwn(restored.g,'ownershipIdentityIndex'),false);
assert.equal(first.authority,'read-only');
console.log('Phase 3 external listed holdings read-only adapter tests passed');
