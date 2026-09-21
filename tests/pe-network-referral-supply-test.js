'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadGame}=require('./harness');

const {ctx,modules}=loadGame();
const engine=ctx.__ct_engine;
engine.configure({playerName:'Referral Supply Test',companyName:'Referral Supply Co',difficulty:'normal'});
const pf=modules.peFund,supply=modules.peDealSupply,network=modules.peNetwork;
const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:0,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
assert(fund,'fund created');
const node=network.addNode(engine.g,{sourceType:'banker',pathType:'longTermCultivation',trust:100,week:1});
assert(node,'network node created');
assert.equal(supply.strongestReferralSource(engine.g).id,node.id);

for(const week of [1,14,27]) supply.processSupplyWeek(engine.g,week);
const live=engine.g.acquisitionTargets.filter(supply.isPETarget);
const referrals=live.filter(t=>t.dealChannel==='network-referral');
assert(referrals.length>=3,'high-trust network produces a referral each quarterly supply cycle');
assert(live.length>2,'network 100 is no longer capped at the two-deal board caused by 26-week lifetime');
assert(live.length<=supply.MAX_PE_TARGETS,'global PE board cap is preserved');
for(const target of referrals){
  assert.equal(target.peSourceNodeID,node.id);
  assert.equal(target.peSourcePathType,'longTermCultivation');
  assert.equal(target.friendly,true);
}
assert.equal(node.trust,100,'ordinary referral supply does not consume trust; only monopoly sourcing does');

const firstReferralIDs=referrals.map(t=>t.id);
engine.g.acquisitionTargets=[];
engine.g.peFirm.lastDealSupplyWeek=0;
node.trust=100;
for(const week of [1,14,27]) supply.processSupplyWeek(engine.g,week);
assert.deepEqual(
  engine.g.acquisitionTargets.filter(t=>t.dealChannel==='network-referral').map(t=>t.id),
  firstReferralIDs,
  'referral supply is deterministic for the same state and weeks'
);

engine.g.acquisitionTargets=[];
engine.g.peFirm.lastDealSupplyWeek=0;
node.trust=supply.NETWORK_REFERRAL_TRUST_THRESHOLD-1;
supply.processSupplyWeek(engine.g,1);
assert.equal(engine.g.acquisitionTargets.some(t=>t.dealChannel==='network-referral'),false,'below-threshold network does not create bonus supply');

const source=fs.readFileSync('js/pe-deal-supply.js','utf8');
assert.doesNotMatch(source,/Math\.random\(\)|Date\.now\(\)|crypto\.randomUUID/,'referral supply adds no nondeterministic source');

console.log('PE network referral supply tests passed');
