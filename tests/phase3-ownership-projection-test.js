'use strict';

const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let seed=7,hostDraws=0;
const loaded=loadGame({headless:true,random:()=>{
  hostDraws++;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  return seed/0x100000000;
}});
const adapter=loaded.modules.economicReadModel;
const project=adapter.ownershipProjection;
assert.equal(typeof project,'function','projection must load through production module wiring');
const plain=value=>JSON.parse(JSON.stringify(value));
const state=loaded.engineModule.createInitialState({configured:true,seed:0x31010001});
Object.assign(state,{
  companyName:'Projection Company',playerName:'Projection Founder',publicCompany:true,
  sharesOut:1000,treasuryBuybackShares:100,founderShares:600,
  companyStocks:{ZZZ:{qty:3,avg:30},[state.ticker]:{qty:2,avg:20}},
  personalStocks:{ZZZ:{qty:5,avg:50},[state.ticker]:{qty:25,avg:900},AAA:{qty:4,avg:40}}
});
const before=JSON.stringify(state),drawsBefore=hostDraws;
const model=project(state);
assert.equal(JSON.stringify(state),before,'projection must preserve whole state, including ledger and simulation RNG');
assert.equal(hostDraws,drawsBefore,'projection must not draw host RNG');
assert.equal(model.authority,'read-only');
assert.equal(model.reconciliationStatus,'not-evaluated','P3-1 must not claim complete registry reconciliation');
assert.equal(model.projectionVersion,1);
assert.equal(adapter.READ_MODEL_VERSION,1,'existing P1 snapshot schema must remain unchanged');
assert.deepEqual(Array.from(model.entities).map(row=>row.entityId),[adapter.PLAYER_COMPANY_ENTITY_ID,adapter.FOUNDER_ENTITY_ID]);
const security=model.securityClasses[0];
assert.equal(security.issuerEntityId,adapter.PLAYER_COMPANY_ENTITY_ID);
assert.equal(security.securityClassId,adapter.PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID);
assert.equal(security.classType,'common');
assert.equal(security.issuedQuantity,1000);
assert.equal(security.treasuryQuantity,100);
assert.equal(security.votingRightsPerUnit,1);
assert.equal(security.economicRightsPerUnit,1);
assert.equal(security.rightsEvidence,'legacy-player-single-common-class');
assert.equal(security.treasuryQuantityDefaulted,false);
assert.deepEqual(plain(security.sourcePaths),{issuedQuantity:'sharesOut',treasuryQuantity:'treasuryBuybackShares'});
assert.deepEqual(Array.from(model.holdings).map(row=>row.holdingId),['holding:player-company:founder-legacy','holding:player-company:founder-personal-stock']);
assert.deepEqual(Array.from(model.holdings).map(row=>row.quantity),[600,25]);
for(const row of model.holdings){
  assert.equal(row.securityClassId,security.securityClassId);
  assert.equal(row.registeredHolderEntityId,adapter.FOUNDER_ENTITY_ID);
  assert.equal(row.beneficialOwnerEntityId,adapter.FOUNDER_ENTITY_ID);
  assert.equal(row.beneficialFraction,1);
}
assert.equal(model.holdings[0].sourcePath,'founderShares');
assert.equal(model.holdings[1].sourcePath,`personalStocks.${state.ticker}.qty`);
assert.deepEqual(Array.from(model.unresolvedAliases).map(row=>row.sourcePath),[`companyStocks.${state.ticker}`,'companyStocks.ZZZ','personalStocks.AAA','personalStocks.ZZZ']);
assert.equal(model.unresolvedAliases[0].reason,'company-own-share-alias-not-adopted');
assert.equal(model.unresolvedAliases[0].registeredHolderEntityId,adapter.PLAYER_COMPANY_ENTITY_ID);
assert.equal(model.unresolvedAliases[2].registeredHolderEntityId,adapter.FOUNDER_ENTITY_ID);
for(const row of model.unresolvedAliases){
  assert.equal(row.issuerEntityId,null,'aliases must not manufacture issuer identity');
  assert.equal(row.securityClassId,null,'unknown share class must remain unknown');
}
assert.deepEqual(plain(model.issues),[]);
assert.equal(JSON.stringify(project(state)),JSON.stringify(model),'same input must have byte-identical ordering');

// Map insertion order and same-name market listings cannot resolve issuer identity.
const reordered=plain(state);
reordered.companyStocks={[state.ticker]:{qty:2,avg:20},ZZZ:{qty:3,avg:30}};
reordered.personalStocks={AAA:{qty:4,avg:40},[state.ticker]:{qty:25,avg:900},ZZZ:{qty:5,avg:50}};
reordered.market.push({id:'AAA',name:state.companyName,issuedShares:1000});
assert.deepEqual(plain(project(reordered)),plain(model));

function freezeDeep(value){
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
freezeDeep(state);
assert.deepEqual(plain(project(state)),plain(model),'frozen authoritative state must be readable');
function assertFrozen(value){
  if(value&&typeof value==='object'){
    assert.equal(Object.isFrozen(value),true,'all returned objects must be frozen');
    for(const child of Object.values(value))assertFrozen(child);
  }
}
assertFrozen(model);
assert.throws(()=>{model.holdings[0].quantity=1;},TypeError);
assert.throws(()=>{model.securityClasses[0].sourcePaths.issuedQuantity='personalCash';},TypeError);
assert.equal(JSON.stringify(state),before);

// Source bucket IDs survive renaming and private/public transitions; no ticker-derived ID.
const renamed=plain(state);
renamed.companyName='Renamed';renamed.playerName='Renamed founder';renamed.publicCompany=false;
const renamedModel=project(renamed);
assert.deepEqual(Array.from(renamedModel.holdings).map(row=>row.holdingId),Array.from(model.holdings).map(row=>row.holdingId));
assert.equal(renamedModel.securityClasses[0].securityClassId,security.securityClassId);
const retickered=plain(state);
retickered.ticker='NEW';retickered.personalStocks.NEW=retickered.personalStocks[state.ticker];
delete retickered.personalStocks[state.ticker];
assert.deepEqual(Array.from(project(retickered).holdings).map(row=>row.holdingId),Array.from(model.holdings).map(row=>row.holdingId));
assert.equal(project(retickered).holdings[1].sourcePath,'personalStocks.NEW.qty');

// Old optional fields default only in the projection; source remains untouched.
const minimal={companyName:'Old v9',sharesOut:10000,founderShares:10000,ticker:'OLD',saveVersion:9};
const minimalBefore=JSON.stringify(minimal),oldModel=project(minimal);
assert.equal(oldModel.securityClasses[0].treasuryQuantity,0);
assert.equal(oldModel.securityClasses[0].treasuryQuantityDefaulted,true);
assert.equal(oldModel.holdings[1].quantity,0);
assert.equal(oldModel.holdings[1].sourcePath,null);
assert.equal(JSON.stringify(minimal),minimalBefore,'no defaults or registry root may be persisted');

for(const field of ['sharesOut','treasuryBuybackShares','founderShares']){
  for(const value of [NaN,Infinity,-1,Number.MAX_SAFE_INTEGER+1,'25',{},true]){
    const invalid={...minimal,[field]:value};
    const result=project(invalid);
    assert(result.issues.some(row=>row.sourcePath===field),'invalid quantity must have explicit reason');
    const quantity=field==='sharesOut'?result.securityClasses[0].issuedQuantity:field==='treasuryBuybackShares'?result.securityClasses[0].treasuryQuantity:result.holdings[0].quantity;
    assert.equal(quantity,null,'invalid input must not be clamped or fabricated');
    assert.equal(invalid[field],value,'invalid source must not be repaired by a reader');
  }
}
assert(project({...minimal,sharesOut:undefined}).issues.some(row=>row.sourcePath==='sharesOut'));
for(const row of [null,[],42,{qty:-1},{qty:Infinity},{},Object.assign(new Date(0),{qty:25})]){
  const invalid={...minimal,personalStocks:{OLD:row}};
  const result=project(invalid);
  assert.equal(result.holdings[1].quantity,null);
  assert(result.issues.some(issue=>issue.sourcePath.startsWith('personalStocks.OLD')));
}
for(const source of [[],3,'bad',new Date(0),new Map()]){
  const result=project({...minimal,personalStocks:source});
  assert.equal(result.holdings[1].quantity,null);
  assert(result.issues.some(row=>row.reason==='holding-map-invalid'));
}
const missingTicker=project({...minimal,ticker:null,personalStocks:{OLD:{qty:25}}});
assert.equal(missingTicker.holdings[1].quantity,null);
assert(missingTicker.issues.some(row=>row.reason==='player-instrument-binding-missing'));
assert.equal(missingTicker.unresolvedAliases[0].issuerEntityId,null);
const inherited=Object.create({OLD:{qty:999}});
assert.equal(project({...minimal,personalStocks:inherited}).holdings[1].quantity,0,'inherited alias must not be recognized as a holding');
assert.equal(project({...minimal,founderShares:10.5}).holdings[0].quantity,10.5,'valid legacy fractions must not be rounded');
assert.throws(()=>project(null),/requires a state object/);
assert.throws(()=>project([]),/requires a state object/);

// Read repeatedly around compacted save/reload; projections must never enter the save.
const engine=new loaded.engineModule.TycoonEngine();
const originalSave=JSON.stringify(engine.g);
project(engine.g);project(engine.g);
assert.equal(JSON.stringify(engine.g),originalSave);
const compact=loaded.modules.saveStorage.compactStateForStorage(engine.g,'critical').state;
const compactBefore=JSON.stringify(compact),compactProjection=plain(project(compact));
assert.equal(JSON.stringify(compact),compactBefore);
const restored=new loaded.engineModule.TycoonEngine();
restored.g=plain(compact);restored.normalize();
assert.deepEqual(plain(project(restored.g)),compactProjection);
assert.equal(restored.g.saveVersion,9);
assert.equal(loaded.engineModule.SAVE_KEY,'capitalism_tycoon_web_v1');
assert.equal(Object.hasOwn(restored.g,'ownershipProjection'),false);
assert.equal(Object.hasOwn(restored.g,'securityClasses'),false);
console.log('Phase 3 read-only ownership identity projection tests passed');
