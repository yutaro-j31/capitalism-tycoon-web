'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');

function store(id,prefID){return {id,businessID:'conveni',status:'open',prefID};}
function state(peerCount,{privateBrandShare=0}={}){
  const stores=[store('target','P0')];
  for(let i=0;i<peerCount;i++)stores.push(store(`peer-${i+1}`,`P${i+1}`));
  return {week:10,stores,conveniMerchandising:{policyID:'standard',privateBrand:{unlocked:privateBrandShare>0,pending:null,share:privateBrandShare},lastWeekByStoreID:{},totals:{revenue:0,wasteCost:0,privateBrandSavings:0}}};
}

const {modules}=loadGame({});
const mod=modules.convenienceMerchandising;
const business={price:540,unitCost:335};

assert.equal(mod.CHAIN_UNIT_COST_DISCOUNT_PER_STORE,.01,'each additional open conveni store improves procurement cost by 1%');
assert.equal(mod.CHAIN_UNIT_COST_DISCOUNT_MAX,.14,'chain-wide procurement scale is capped at 14%');

// A single store receives no chain discount. This keeps founding single-store economics unchanged.
{
  const g=state(0),target=g.stores[0];
  const result=mod.processStore(g,target,business,1000,1);
  const row=g.conveniMerchandising.lastWeekByStoreID[target.id];
  assert.equal(mod.chainCountFor(g,target),0);
  assert.equal(row.chainCount,0);
  assert.equal(row.chainUnitCostDiscount,0);
  const expectedWaste=Math.round(1000*business.price*mod.POLICIES.standard.wasteRate);
  assert.equal(result.variable,1000*business.unitCost+expectedWaste,'single-store variable cost remains unchanged');
}

// Chain benefit is company-wide rather than same-prefecture clustering, and remains bounded.
{
  const g=state(4),target=g.stores[0];
  const result=mod.processStore(g,target,business,1000,1);
  const row=g.conveniMerchandising.lastWeekByStoreID[target.id];
  assert.equal(row.clusterCount,0,'different-prefecture peers do not trigger the separate dominant-cluster bonus');
  assert.equal(row.chainCount,4);
  assert.equal(row.chainUnitCostDiscount,.04);
  const expectedWaste=Math.round(1000*business.price*mod.POLICIES.standard.wasteRate);
  assert.equal(result.variable,Math.round(1000*business.unitCost*.96+expectedWaste));
}

{
  const g=state(30),target=g.stores[0];
  mod.processStore(g,target,business,1000,1);
  const row=g.conveniMerchandising.lastWeekByStoreID[target.id];
  assert.equal(row.chainUnitCostDiscount,.14,'procurement scale never exceeds the calibrated cap');
}

// Private-brand savings compose multiplicatively after the chain procurement saving; they are not added twice.
{
  const g=state(20,{privateBrandShare:.30}),target=g.stores[0];
  const result=mod.processStore(g,target,business,1000,1);
  const row=g.conveniMerchandising.lastWeekByStoreID[target.id];
  const pb=mod.PRIVATE_BRAND_OPTIONS[.30];
  const adjustedDemand=1000*pb.demandMultiplier;
  const waste=Math.round(adjustedDemand*business.price*mod.POLICIES.standard.wasteRate);
  const chainCost=adjustedDemand*business.unitCost*(1-mod.CHAIN_UNIT_COST_DISCOUNT_MAX);
  const expected=Math.round(chainCost*pb.unitCostMultiplier+waste);
  assert.equal(row.chainUnitCostDiscount,.14);
  assert.equal(result.variable,expected,'PB and chain savings compose multiplicatively');
}

// Same state and action sequence must produce byte-for-byte identical derived rows and costs.
{
  const gA=state(17,{privateBrandShare:.15}),gB=JSON.parse(JSON.stringify(gA));
  const a=mod.processStore(gA,gA.stores[0],business,1234,1.03);
  const b=mod.processStore(gB,gB.stores[0],business,1234,1.03);
  assert.deepEqual(a,b);
  assert.deepEqual(gA.conveniMerchandising.lastWeekByStoreID,gB.conveniMerchandising.lastWeekByStoreID);
}

const source=fs.readFileSync(path.join(__dirname,'..','js','convenience-merchandising.js'),'utf8');
assert.doesNotMatch(source,/Math\.random|crypto\.randomUUID|Date\.now/,'chain procurement scale introduces no nondeterministic source');
console.log('convenience chain scale tests passed');
