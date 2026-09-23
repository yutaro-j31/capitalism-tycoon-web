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

// Sourcing Desk exposes the existing production network as an actionable player system.
const deskNode=network.addNode(engine.g,{sourceType:'Sourcing Desk Banker',pathType:'longTermCultivation',industryTag:'finance',trust:16,week:77});
engine.g.week=77;
engine.g.peNetwork.weeklyActionsWeek=77;
engine.g.peNetwork.weeklyActionsUsed=0;
const stateBeforeDesk=JSON.stringify(engine.g);
let desk=modules.peUIAdapter.sourcingNetwork(engine.g);
assert.equal(JSON.stringify(engine.g),stateBeforeDesk,'Sourcing Desk adaptation is read-only');
assert.equal(desk.actionsRemaining,network.WEEKLY_ACTIONS);
let deskRow=desk.rows.find(row=>row.id===deskNode.id);
assert(deskRow,'new production network node appears in Sourcing Desk');
assert.equal(deskRow.access.id,'building');
assert.equal(deskRow.access.nextTrust,20);
assert.equal(deskRow.referralEligible,false);
assert.equal(deskRow.canContact,true);

const trustBeforeContact=deskNode.trust;
assert.equal(modules.peUIAdapter.perform('contactNetwork',{nodeID:deskNode.id}),true,'Sourcing Desk contact reaches production contactPENetworkNode');
assert.equal(deskNode.trust,trustBeforeContact+network.CONTACT_TRUST_GAIN);
desk=modules.peUIAdapter.sourcingNetwork(engine.g);
assert.equal(desk.actionsRemaining,1,'one contact consumes one of the two weekly actions');
assert.equal(modules.peUIAdapter.perform('contactNetwork',{nodeID:deskNode.id}),true);
desk=modules.peUIAdapter.sourcingNetwork(engine.g);
assert.equal(desk.actionsRemaining,0,'two contacts consume the weekly action budget');
assert.equal(modules.peUIAdapter.perform('contactNetwork',{nodeID:deskNode.id}),false,'third contact in the same week is rejected by production');

deskNode.trust=supply.NETWORK_REFERRAL_TRUST_THRESHOLD;
desk=modules.peUIAdapter.sourcingNetwork(engine.g);
deskRow=desk.rows.find(row=>row.id===deskNode.id);
assert.equal(deskRow.referralEligible,true);
assert.equal(deskRow.referralInspectionCount,1,'Trust 80 shows baseline referral inspection depth');
assert.equal(deskRow.competitionMultiplier,1,'Trust 80 shows baseline referral competition');
deskNode.trust=100;
desk=modules.peUIAdapter.sourcingNetwork(engine.g);
deskRow=desk.rows.find(row=>row.id===deskNode.id);
assert.equal(deskRow.referralInspectionCount,supply.NETWORK_REFERRAL_SEARCH_ATTEMPTS,'Trust 100 visibly exposes full referral inspection depth');
assert.equal(deskRow.competitionMultiplier,supply.NETWORK_REFERRAL_MIN_COMPETITION_MULTIPLIER,'Trust 100 visibly exposes reduced competition');
assert.equal(deskRow.monopolyProbability,network.MAX_MONOPOLY_SHARE,'Trust 100 displays the canonical monopoly ceiling');

// Proprietary sourcing is a player-initiated, long-horizon path. It shares the two weekly
// network actions, reveals no immediate target, and resolves deterministically after 13 weeks.
const propNode=network.addNode(engine.g,{sourceType:'Owner Relationship',pathType:'longTermCultivation',industryTag:'service',trust:100,week:200});
engine.g.week=200;
engine.g.peNetwork.weeklyActionsWeek=200;
engine.g.peNetwork.weeklyActionsUsed=0;
engine.g.acquisitionTargets=[];
assert.equal(supply.proprietarySuccessProbability({...propNode,trust:19}),0,'Trust below 20 cannot initiate proprietary sourcing');
assert.ok(Math.abs(supply.proprietarySuccessProbability({...propNode,trust:100,pathType:'longTermCultivation'})-supply.PROPRIETARY_MAX_SUCCESS)<1e-12,'best long-term relationship is capped below 50%');
const propBefore=JSON.stringify(engine.g);
const propDeskBefore=modules.peUIAdapter.sourcingNetwork(engine.g);
assert.equal(JSON.stringify(engine.g),propBefore,'proprietary desk preview is read-only');
const propRowBefore=propDeskBefore.rows.find(row=>row.id===propNode.id);
assert.equal(propRowBefore.canStartProprietary,true);
assert.ok(Math.abs(propRowBefore.proprietaryProbability-supply.PROPRIETARY_MAX_SUCCESS)<1e-12,'adapter preserves the capped proprietary probability within floating-point tolerance');
assert.equal(modules.peUIAdapter.perform('startProprietary',{nodeID:propNode.id}),true,'Sourcing Desk starts production proprietary outreach');
const campaign=engine.g.peFirm.proprietarySourcing.at(-1);
assert.equal(campaign.nodeID,propNode.id);
assert.equal(campaign.startedWeek,200);
assert.equal(campaign.responseWeek,200+supply.PROPRIETARY_OUTREACH_WEEKS);
assert.equal(campaign.status,'pending');
assert.equal(engine.g.peNetwork.weeklyActionsUsed,1,'proprietary outreach consumes exactly one canonical network action');
assert.equal(engine.g.acquisitionTargets.some(t=>t.dealChannel==='proprietary'),false,'proprietary outreach never creates an instant deal');
assert.equal(modules.peUIAdapter.perform('startProprietary',{nodeID:propNode.id}),false,'same source cannot run two active proprietary campaigns');
let propDesk=modules.peUIAdapter.sourcingNetwork(engine.g);
assert.equal(propDesk.proprietary.activeCount,1);
assert.equal(propDesk.rows.find(row=>row.id===propNode.id).proprietaryActive,true);
assert.equal(propDesk.proprietary.rows.find(row=>row.id===campaign.id).weeksRemaining,supply.PROPRIETARY_OUTREACH_WEEKS);

// Force the deterministic fixture onto the success side of the already-frozen probability so
// the success transition and target metadata can be verified independently of one hash value.
campaign.outcomeRoll=0;
const campaignID=campaign.id,responseWeek=campaign.responseWeek;
const rawPropDeal=supply.proprietaryDealForCampaign(engine.g,campaign);
const expectedPropTarget=supply.buildTargetFromDeal(rawPropDeal,responseWeek);
supply.processProprietarySourcingWeek(engine.g,responseWeek-1);
let liveCampaign=engine.g.peFirm.proprietarySourcing.find(row=>row.id===campaignID);
assert.equal(liveCampaign.status,'pending','campaign cannot resolve before its response week');
supply.processProprietarySourcingWeek(engine.g,responseWeek);
liveCampaign=engine.g.peFirm.proprietarySourcing.find(row=>row.id===campaignID);
assert.equal(liveCampaign.status,'success','canonical state records a successful proprietary campaign');
const propTarget=engine.g.acquisitionTargets.find(t=>t.id===liveCampaign.targetID);
assert(propTarget,'successful proprietary outreach materializes one PE target');
assert.equal(propTarget.dealChannel,'proprietary');
assert.equal(propTarget.peNetworkAccess,'exclusive');
assert.equal(propTarget.peCompetitionMultiplier,0,'successful proprietary outreach gets exclusive negotiation');
assert.equal(propTarget.peSourceNodeID,propNode.id);
assert.equal(propTarget.peProprietarySourcingID,campaignID);
assert.equal(propTarget.valuation,expectedPropTarget.valuation,'proprietary outreach grants exclusivity but no hidden monopoly discount');
propDesk=modules.peUIAdapter.sourcingNetwork(engine.g);
assert.equal(propDesk.accessCounts.proprietary,1);
assert.equal(propDesk.proprietary.rows.find(row=>row.id===campaignID).status,'success');

const uiSource=fs.readFileSync('js/pe-ui.js','utf8');
assert.match(uiSource,/data-pe-sourcing-desk/,'PE network tab renders the Sourcing Desk');
assert.match(uiSource,/data-pe-network-contact/,'Sourcing Desk exposes the production contact action');
assert.match(uiSource,/data-pe-proprietary-start/,'Sourcing Desk exposes player-initiated proprietary outreach');
assert.match(uiSource,/data-pe-proprietary-pipeline/,'Sourcing Desk renders the long-horizon proprietary pipeline');
assert.match(uiSource,/Trust 20 限定入札/);
assert.match(uiSource,/40 DD内部情報/);
assert.match(uiSource,/60 独占案件/);
assert.match(uiSource,/80 Referral \/ 買い手紹介/);
const peCss=fs.readFileSync('css/d-ui-pe.css','utf8');
assert.match(peCss,/\.pe-sourcing-node \.btn\{[^}]*min-height:44px/,'Sourcing Desk contact keeps an iPhone-safe tap target');
assert.match(peCss,/\.pe-sourcing-actions\{grid-template-columns:1fr 1fr/,'desktop sourcing card exposes contact and proprietary actions side by side');
assert.match(peCss,/@media\(max-width:520px\)\{[^@]*\.pe-sourcing-actions\{grid-template-columns:1fr\}/,'proprietary action stacks to a full-width iPhone tap target');
assert.match(peCss,/@media\(max-width:820px\)\{[^@]*\.pe-proprietary-grid\{grid-template-columns:1fr\}/,'proprietary pipeline stacks on iPhone width');
assert.match(peCss,/@media\(max-width:820px\)\{[^@]*\.pe-sourcing-kpis\{grid-template-columns:1fr 1fr\}/,'Sourcing Desk KPI grid keeps the iPhone breakpoint');
assert.match(peCss,/@media\(max-width:820px\)\{[^@]*\.pe-sourcing-grid\{grid-template-columns:1fr\}/,'Sourcing Desk stacks node cards on iPhone width');

const source=fs.readFileSync('js/pe-deal-supply.js','utf8');
assert.doesNotMatch(source,/Math\.random\(\)|Date\.now\(\)|crypto\.randomUUID/,'referral and proprietary supply add no nondeterministic source');
const roomSource=fs.readFileSync('js/ma-deal-room.js','utf8');
assert.doesNotMatch(roomSource,/Math\.random\(\)|Date\.now\(\)|crypto\.randomUUID/,'competition scaling adds no nondeterministic source');

console.log('PE network referral quality/access tests passed');
