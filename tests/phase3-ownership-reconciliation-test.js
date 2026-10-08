'use strict';

const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let seed=9,hostDraws=0;
const loaded=loadGame({headless:true,random:()=>{
  hostDraws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;
}});
const adapter=loaded.modules.economicReadModel,reconcile=adapter.ownershipReconciliation;
assert.equal(typeof reconcile,'function','reconciliation must use production module wiring');
const plain=value=>JSON.parse(JSON.stringify(value));
function freezeDeep(value){
  if(value&&typeof value==='object'){for(const child of Object.values(value))freezeDeep(child);Object.freeze(value);}
  return value;
}
function assertFrozen(value){
  if(value&&typeof value==='object'){assert(Object.isFrozen(value));for(const child of Object.values(value))assertFrozen(child);}
}
const state=loaded.engineModule.createInitialState({configured:true,seed:0x31020001});
Object.assign(state,{
  publicCompany:true,sharesOut:1000,treasuryBuybackShares:100,founderShares:600,
  personalStocks:{ZZZ:{qty:5,avg:50},[state.ticker]:{qty:25,avg:900}},
  companyStocks:{[state.ticker]:{qty:2,avg:20},ZZZ:{qty:3,avg:30}}
});
state.externalShareholderRatio=1-state.founderShares/900;
const before=JSON.stringify(state),draws=hostDraws;
const result=reconcile(freezeDeep(state));
assert.equal(result.ok,true,JSON.stringify(result.issues));
assert.equal(result.authority,'read-only');
assert.equal(result.scope,'player-company-common-founder-and-unallocated-residual');
assert.deepEqual(plain(result.checks),[{id:'ECO-010',ok:true},{id:'ECO-011',ok:true}]);
const security=result.securityClasses[0],holding=result.beneficialHoldings[0];
assert.equal(result.securityClasses.length,1);
assert.equal(security.issuerEntityId,adapter.PLAYER_COMPANY_ENTITY_ID);
assert.equal(security.securityClassId,adapter.PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID);
assert.equal(security.issuedQuantity,1000);
assert.equal(security.treasuryQuantity,100);
assert.equal(security.outstandingQuantity,900);
assert.equal(security.unallocatedOutstandingQuantity,275);
assert.equal(result.beneficialHoldings.length,1,'two source buckets must produce one beneficial holding');
assert.equal(holding.beneficialOwnerEntityId,adapter.FOUNDER_ENTITY_ID);
assert.equal(holding.quantity,625,'personal purchases join original founder shares exactly once; treasury is excluded');
assert.deepEqual(Array.from(holding.sourceHoldingIds),Array.from(result.sourceHoldings).map(row=>row.holdingId));
assert.equal(security.issuedQuantity,security.treasuryQuantity+holding.quantity+security.unallocatedOutstandingQuantity);
assert.equal(result.unresolvedAliases.length,3);
for(const alias of result.unresolvedAliases){assert.equal(alias.issuerEntityId,null);assert.equal(alias.securityClassId,null);}
assert.equal(JSON.stringify(state),before,'including accounting, source holdings and simulation RNG');
assert.equal(hostDraws,draws);
assertFrozen(result);
assert.throws(()=>{holding.quantity=1;},TypeError);
assert.throws(()=>{holding.sourceHoldingIds.push('duplicate');},{name:'TypeError'});
assert.equal(JSON.stringify(reconcile(state)),JSON.stringify(result));
assert.equal(adapter.ownershipProjection(state).reconciliationStatus,'not-evaluated','P3-1 API remains source evidence only');

// Independent P1 public API parity: the own-company bucket is absent from generic personal assets.
const legacy=adapter.snapshot(state),legacyFounder=legacy.entities.find(row=>row.entity.entityId===adapter.FOUNDER_ENTITY_ID);
assert.equal(adapter.compareLegacyParity(state,legacy).ok,true);
for(const [projected,key] of [[security.issuedQuantity,'issuedShares'],[security.treasuryQuantity,'treasuryShares'],
  [security.outstandingQuantity,'outstandingShares'],[holding.quantity,'founderBeneficialShares'],
  [security.unallocatedOutstandingQuantity,'nonFounderBeneficialShares']])assert.equal(projected,legacy.ownership[key]);
assert.equal(legacyFounder.marketHoldings.some(row=>row.instrumentId===state.ticker),false);
assert.equal(state.externalShareholderRatio,1-600/900,'legacy gameplay ratio remains unchanged, not replaced by beneficial ratio');

const reordered=plain(state);
reordered.personalStocks={[state.ticker]:{qty:25,avg:900},ZZZ:{qty:5,avg:50}};
reordered.companyStocks={ZZZ:{qty:3,avg:30},[state.ticker]:{qty:2,avg:20}};
reordered.market.push({id:'ZZZ',name:state.companyName,issuedShares:1000});
assert.deepEqual(plain(reconcile(reordered)),plain(result),'map order / market names cannot create another founder interest');
const renamed=plain(state);renamed.companyName='Renamed';renamed.playerName='Renamed founder';renamed.publicCompany=false;
assert.equal(reconcile(renamed).beneficialHoldings[0].beneficialHoldingId,holding.beneficialHoldingId);
assert.equal(reconcile(renamed).beneficialHoldings[0].quantity,625);
const retickered=plain(state);retickered.ticker='NEW';retickered.personalStocks.NEW=retickered.personalStocks[state.ticker];
delete retickered.personalStocks[state.ticker];
assert.equal(reconcile(retickered).beneficialHoldings[0].beneficialHoldingId,holding.beneficialHoldingId);
assert.equal(reconcile(retickered).beneficialHoldings[0].quantity,625);

const minimal={companyName:'Old v9',ticker:'OLD',sharesOut:10000,founderShares:10000,saveVersion:9};
const minimalBefore=JSON.stringify(minimal),old=reconcile(freezeDeep(minimal));
assert.equal(old.ok,true);
assert.equal(old.securityClasses[0].treasuryQuantity,0);
assert.equal(old.securityClasses[0].outstandingQuantity,10000);
assert.equal(old.securityClasses[0].unallocatedOutstandingQuantity,0);
assert.equal(old.beneficialHoldings[0].quantity,10000);
assert.equal(JSON.stringify(minimal),minimalBefore,'old optional defaults remain read-only');

// Independent exact dyadic oracle for Number arithmetic; BigInt stays in this Node test.
function exactUnits(value){
  const bits=new DataView(new ArrayBuffer(8));bits.setFloat64(0,value);
  const raw=bits.getBigUint64(0),exponent=Number((raw>>52n)&0x7ffn),fraction=raw&((1n<<52n)-1n);
  return exponent?(fraction|(1n<<52n))<<BigInt(exponent-1):fraction;
}
function exactResult(left,right,direction){
  const candidate=left+direction*right;
  if(!Number.isFinite(candidate)||candidate<0||candidate>Number.MAX_SAFE_INTEGER)return null;
  return exactUnits(candidate)===exactUnits(left)+BigInt(direction)*exactUnits(right)?candidate:null;
}
const numericCases=[0,1,.25,.1,.2,.3,2**-54,Number.MIN_VALUE,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER-1,2**52,2**52-.5,2**50+.25];
for(const left of numericCases)for(const right of numericCases){
  const sum=reconcile({...minimal,sharesOut:Number.MAX_SAFE_INTEGER,founderShares:left,personalStocks:{OLD:{qty:right}}});
  assert.equal(sum.beneficialHoldings[0].quantity,exactResult(left,right,1),`exact founder sum ${left} + ${right}`);
  const difference=reconcile({...minimal,sharesOut:left,treasuryBuybackShares:right,founderShares:0});
  assert.equal(difference.securityClasses[0].outstandingQuantity,exactResult(left,right,-1),`exact outstanding ${left} - ${right}`);
}

function fails(input,check){
  const encoded=JSON.stringify(input),count=hostDraws,out=reconcile(freezeDeep(input));
  assert.equal(out.ok,false);
  if(check)assert.equal(out.checks.find(row=>row.id===check).ok,false);
  assert(out.issues.length>0);
  assert.equal(JSON.stringify(input),encoded);assert.equal(hostDraws,count);
  for(const row of out.securityClasses)for(const key of ['issuedQuantity','treasuryQuantity','outstandingQuantity','unallocatedOutstandingQuantity']){
    assert(row[key]===null||Number.isFinite(row[key])&&row[key]>=0&&row[key]<=Number.MAX_SAFE_INTEGER);
  }
  assert(out.beneficialHoldings[0].quantity===null||Number.isFinite(out.beneficialHoldings[0].quantity)&&out.beneficialHoldings[0].quantity>=0&&out.beneficialHoldings[0].quantity<=Number.MAX_SAFE_INTEGER);
  assertFrozen(out);return out;
}
fails({...minimal,treasuryBuybackShares:10001},'ECO-010');
fails({...minimal,personalStocks:{OLD:{qty:1}}},'ECO-011');
fails({...minimal,sharesOut:Number.MAX_SAFE_INTEGER,founderShares:Number.MAX_SAFE_INTEGER,personalStocks:{OLD:{qty:1}}},'ECO-011');
const lostFraction=fails({...minimal,sharesOut:Number.MAX_SAFE_INTEGER,founderShares:Number.MAX_SAFE_INTEGER-1,personalStocks:{OLD:{qty:.25}}},'ECO-011');
assert.equal(lostFraction.beneficialHoldings[0].quantity,null);
assert(lostFraction.issues.some(row=>row.reason==='derived-quantity-precision-loss'));
fails({...minimal,sharesOut:1,treasuryBuybackShares:2**-54,founderShares:0},'ECO-010');
const envelope=reconcile({...minimal,sharesOut:Number.MAX_SAFE_INTEGER,founderShares:Number.MAX_SAFE_INTEGER-1,personalStocks:{OLD:{qty:1}}});
assert.equal(envelope.ok,true);assert.equal(envelope.beneficialHoldings[0].quantity,Number.MAX_SAFE_INTEGER);
fails({...minimal,sharesOut:0,founderShares:1},'ECO-011');
for(const field of ['sharesOut','founderShares','treasuryBuybackShares']){
  for(const value of [NaN,Infinity,-1,Number.MAX_SAFE_INTEGER+1,'1',undefined]){
    if(field==='treasuryBuybackShares'&&value===undefined)continue;
    fails({...minimal,[field]:value});
  }
}
for(const row of [null,[],{}, {qty:-1},{qty:Infinity},{qty:'1'}])fails({...minimal,personalStocks:{OLD:row}},'ECO-011');
fails({...minimal,companyStocks:{EXT:{qty:-1}}});
fails({...minimal,personalStocks:{EXT:null}});
fails({...minimal,ticker:null},'ECO-011');
const fractional=reconcile({...minimal,sharesOut:10.5,treasuryBuybackShares:1.5,founderShares:6.25,personalStocks:{OLD:{qty:1.25}}});
assert.equal(fractional.ok,true);assert.equal(fractional.beneficialHoldings[0].quantity,7.5);
// No EPSILON/clamp/rounding may turn a negative Number residual into a conservation PASS.
const precision=fails({...minimal,sharesOut:.3,treasuryBuybackShares:.1,founderShares:.2},'ECO-011');
assert.equal(precision.securityClasses[0].unallocatedOutstandingQuantity,null);
fails({...minimal,sharesOut:.3,treasuryBuybackShares:.03,founderShares:0},'ECO-010');
const empty=reconcile({...minimal,sharesOut:0,founderShares:0});
assert.equal(empty.ok,true);assert.equal(empty.beneficialHoldings[0].quantity,0,'zero supply grants no command or control capability');
assert.throws(()=>reconcile(null),/requires a state object/);

// Actual installed buy/sell/split paths; observation must not change their cash/accounting/save behavior.
const engine=new loaded.engineModule.TycoonEngine();
Object.assign(engine.g,{publicCompany:true,personalCash:1e12,sharesOut:1000000,founderShares:600000,treasuryBuybackShares:0,stockPrice:1000});
engine.g.market.push({id:engine.g.ticker,name:engine.g.companyName,price:1000,previous:1000,issuedShares:1000000,marketCap:1e9,dividendYield:0,volatility:.05,priceHistory:[]});
assert.equal(engine.buyStock(engine.g.ticker,1000,'personal'),true);
assert.equal(reconcile(engine.g).beneficialHoldings[0].quantity,601000);
assert.equal(engine.sellStock(engine.g.ticker,500,'personal'),true);
assert.equal(reconcile(engine.g).beneficialHoldings[0].quantity,600500);
assert.equal(engine.stockSplit(engine.g.ticker,2),true);
assert.equal(reconcile(engine.g).beneficialHoldings[0].quantity,1201000);
const afterCommands=JSON.stringify(engine.g),afterDraws=hostDraws;
reconcile(engine.g);reconcile(engine.g);
assert.equal(JSON.stringify(engine.g),afterCommands);assert.equal(hostDraws,afterDraws);
const compact=loaded.modules.saveStorage.compactStateForStorage(engine.g,'critical').state;
const compactBefore=JSON.stringify(compact),projected=plain(reconcile(compact));
assert.equal(projected.ok,true);assert.equal(projected.beneficialHoldings[0].quantity,1201000);
assert.equal(JSON.stringify(compact),compactBefore);
const restored=new loaded.engineModule.TycoonEngine();restored.g=plain(compact);restored.normalize();
assert.deepEqual(plain(reconcile(restored.g)),projected);
assert.equal(restored.g.saveVersion,9);assert.equal(loaded.engineModule.SAVE_KEY,'capitalism_tycoon_web_v1');
for(const key of ['ownershipReconciliation','beneficialHoldings','sourceHoldings','securityClasses'])assert.equal(Object.hasOwn(restored.g,key),false);
console.log('Phase 3 read-only ownership conservation and beneficial dedup tests passed');
