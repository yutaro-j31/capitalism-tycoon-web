'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

const {modules}=loadGame();
const market=modules.market;
const state=modules.engine.createInitialState({configured:true});
const tenant=state.tenants.find(t=>t.businessID==='ramen'&&t.prefID==='tokyo');
assert(tenant,'tokyo ramen tenant fixture exists');

const baseStore={
  businessID:'ramen',prefID:'tokyo',status:'open',tenantID:tenant.id,
  condition:100,operatingHours:3,quality:18,brand:10
};
state.stores=[
  {...baseStore,id:'kernel-r1',name:'Kernel Ramen 1'},
  {...baseStore,id:'kernel-r2',name:'Kernel Ramen 2'}
];

function pureInput(stores){
  const businessID=stores[0].businessID,prefID=stores[0].prefID;
  const players=stores.map(store=>market.storeOffer(state,store));
  const competitors=market.competitorOffers(state,businessID,prefID);
  const campaignBoosts={};
  for(const offer of players){
    campaignBoosts[offer.id]={};
    for(const seg of market.SEGMENTS){
      campaignBoosts[offer.id][seg.id]=modules.playerMediaAdvertising?.utilityBoost(state,offer.business?.id,seg.id)||0;
    }
  }
  return {
    businessID,
    prefID,
    areaID:market.prefAreaID(state,prefID),
    marketPotential:market.marketPotential(state,businessID,prefID),
    inflation:state.inflation,
    economy:state.economy,
    playerOffers:players,
    competitorOffers:competitors,
    campaignBoosts
  };
}

// 1. Refactor contract: the production wrapper and the pure kernel are byte-for-byte equivalent
// for the same normalized offers/context.
{
  const input=pureInput(state.stores);
  const wrapped=market.calculateMarket(state,state.stores);
  const pure=market.calculateMarketFromOffers(input);
  assert.deepEqual(pure,wrapped,'calculateMarket wrapper must preserve exact pre-refactor market output');
}

// 2. The pure kernel must never mutate normalized offers or scalar context supplied by a detached
// runtime. This is the ownership boundary the PE ramen bridge will rely on.
{
  const input=pureInput(state.stores);
  const before=JSON.stringify(input);
  market.calculateMarketFromOffers(input);
  assert.equal(JSON.stringify(input),before,'pure market allocation kernel must not mutate its input');
}

// 3. Cannibalization remains a property of the pure kernel itself: an otherwise-identical sibling
// in the same ramen::pref market reduces the first store's demand share without changing market size.
{
  const oneInput=pureInput([state.stores[0]]);
  const one=market.calculateMarketFromOffers(oneInput);
  const twoInput=pureInput(state.stores);
  const two=market.calculateMarketFromOffers(twoInput);
  assert(two.stores['kernel-r1'].marketShare<one.stores['kernel-r1'].marketShare,'synthetic sibling must cannibalize the first store in the pure kernel');
  assert.equal(two.marketPotential,one.marketPotential,'adding a sibling must not change market potential');
}

console.log('market pure allocation kernel tests passed');
