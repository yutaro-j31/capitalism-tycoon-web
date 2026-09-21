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

// Trust now scales access quality without changing supply quantity. Trust 80 preserves the
// old first-eligible referral, while Trust 100 inspects the full deterministic pool and can
// only choose a deal that is no smaller and no lower-quality than that baseline.
const lowSource={...node,trust:supply.NETWORK_REFERRAL_TRUST_THRESHOLD};
const highSource={...node,trust:100};
const baseline=supply.buildReferralDeal(engine.g,fund,1,lowSource);
const highTrustDeal=supply.buildReferralDeal(engine.g,fund,1,highSource);
assert(baseline&&highTrustDeal,'both trust tiers find an eligible referral');
assert.equal(supply.referralInspectionCount(lowSource),1,'Trust 80 preserves the legacy first-match behavior');
assert.equal(supply.referralInspectionCount(highSource),supply.NETWORK_REFERRAL_SEARCH_ATTEMPTS,'Trust 100 can inspect the whole referral pool');
assert(highTrustDeal.enterpriseValue>=baseline.enterpriseValue,'higher Trust never downgrades referral deal size');
assert(supply.referralQualityScore(highTrustDeal,1)>=supply.referralQualityScore(baseline,1)-1e-12,'higher Trust never downgrades referral fundamentals');
assert.equal(supply.referralCompetitionMultiplier(80),1,'threshold Trust keeps baseline competition');
assert.equal(supply.referralCompetitionMultiplier(100),supply.NETWORK_REFERRAL_MIN_COMPETITION_MULTIPLIER,'Trust 100 gets the strongest non-exclusive competition reduction');

for(const week of [1,14,27]) { node.trust=100; supply.processSupplyWeek(engine.g,week); }
const live=engine.g.acquisitionTargets.filter(supply.isPETarget);
const referrals=live.filter(t=>t.dealChannel==='network-referral');
assert(referrals.length>=3,'high-trust network produces a referral each quarterly supply cycle');
assert(live.length>2,'network 100 is no longer capped at the two-deal board caused by 26-week lifetime');
assert(live.length<=supply.MAX_PE_TARGETS,'global PE board cap is preserved');
for(const target of referrals){
  assert.equal(target.peSourceNodeID,node.id);
  assert.equal(target.peSourcePathType,'longTermCultivation');
  assert.equal(target.peSourceTrustAtSupply,100);
  assert(Number.isFinite(target.peNetworkQualityScore),'referral records the selected fundamentals score');
  assert(target.peCompetitionMultiplier>=0&&target.peCompetitionMultiplier<=supply.NETWORK_REFERRAL_MIN_COMPETITION_MULTIPLIER,'Trust 100 is limited-auction or exclusive');
  assert(['limited-auction','exclusive'].includes(target.peNetworkAccess),'Trust 100 referral visibly receives better access');
  assert.equal(target.friendly,true);
}
assert(referrals.every(t=>t.dealChannel==='network-referral'),'referral rows stay distinct from monopoly-sourced rows');

const firstReferralIDs=referrals.map(t=>t.id);
engine.g.acquisitionTargets=[];
engine.g.peFirm.lastDealSupplyWeek=0;
node.trust=100;
for(const week of [1,14,27]) { node.trust=100; supply.processSupplyWeek(engine.g,week); }
assert.deepEqual(
  [...engine.g.acquisitionTargets.filter(t=>t.dealChannel==='network-referral').map(t=>t.id)],
  [...firstReferralIDs],
  'referral supply is deterministic for the same state and weeks'
);

engine.g.acquisitionTargets=[];
engine.g.peFirm.lastDealSupplyWeek=0;
node.trust=supply.NETWORK_REFERRAL_TRUST_THRESHOLD-1;
supply.processSupplyWeek(engine.g,1);
assert.equal(engine.g.acquisitionTargets.some(t=>t.dealChannel==='network-referral'),false,'below-threshold network does not create bonus supply');

// The deal-room competition engine must honor true exclusivity. Build a minimal PE target and
// room with multiplier 0; even across all eligible weeks no rival may appear.
const exclusiveDeal=supply.buildReferralDeal(engine.g,fund,40,{...node,trust:100});
const exclusiveTarget=supply.buildTargetFromDeal(exclusiveDeal,40);
exclusiveTarget.id='pe-target-exclusive-competition-contract';
exclusiveTarget.peCompetitionMultiplier=0;
exclusiveTarget.peNetworkAccess='exclusive';
exclusiveTarget.maCreatedWeek=40;
exclusiveTarget.maStableKey='exclusive-competition-contract';
exclusiveTarget.activeDealID='ma-exclusive-competition-contract';
engine.g.acquisitionTargets.push(exclusiveTarget);
modules.maDealRoom.ensure(engine.g);
engine.g.maDealRooms.push({
  id:'ma-exclusive-competition-contract',targetID:exclusiveTarget.id,targetStableKey:exclusiveTarget.maStableKey,
  status:'screening',openedWeek:40,deadlineWeek:56,diligenceLevel:'none',diligenceConfidence:0,
  activeDiligence:null,findings:[],valuationBridge:null,sellerAsk:exclusiveTarget.valuation,
  offerRounds:[],currentOffer:null,counterOffer:null,competingBid:null,competingBids:[],acceptedTerms:null,
  lastProcessedWeek:40,history:[]
});
for(let week=41;week<=55;week++) modules.maDealRoom.processDealWeek(engine.g,week);
const exclusiveRoom=engine.g.maDealRooms.find(d=>d.id==='ma-exclusive-competition-contract');
assert.equal(exclusiveRoom.competingBid,null,'exclusive network access suppresses rival creation in the real deal-room engine');
assert.equal(exclusiveRoom.competingBids.length,0,'exclusive network access leaves zero rival bids');

// UI adapter carries the access/trust metadata through to the deal board contract.
// This focused fixture creates Fund I directly instead of unlocking PE through the production
// progression gate, so explicitly mark the already-created PE firm as unlocked for UI exposure.
engine.g.peFirm.unlocked=true;
engine.g.selectedTab='pe-portfolio';
const exclusiveUI=modules.peUIAdapter.getPEUIData().deals.find(d=>d.id==='ma-exclusive-competition-contract');
assert(exclusiveUI,'exclusive network deal reaches the PE adapter');
assert.equal(exclusiveUI.sourcing.access,'exclusive');
assert.equal(exclusiveUI.sourcing.competitionMultiplier,0);

const source=fs.readFileSync('js/pe-deal-supply.js','utf8');
assert.doesNotMatch(source,/Math\.random\(\)|Date\.now\(\)|crypto\.randomUUID/,'referral supply adds no nondeterministic source');
const roomSource=fs.readFileSync('js/ma-deal-room.js','utf8');
assert.doesNotMatch(roomSource,/Math\.random\(\)|Date\.now\(\)|crypto\.randomUUID/,'competition scaling adds no nondeterministic source');

console.log('PE network referral quality/access tests passed');
