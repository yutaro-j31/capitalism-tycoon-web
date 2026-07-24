'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(ROOT,'js/ma-portfolio-summary.js'),'utf8');
function load(){const context={globalThis:{__capitalismTycoonModules:{}}};context.globalThis.globalThis=context.globalThis;vm.runInNewContext(code,context);return context.globalThis.__capitalismTycoonModules.maPortfolioSummary;}
function fixture(){return {week:42,finance:{transactions:[{id:'b'},{id:'a'}]},maDealRooms:[{id:'d1',status:'diligence'},{id:'d2',status:'countered'},{id:'d3',status:'accepted'},{id:'d4',status:'expired'}],goodwillRecords:[{id:'gw1',carryingValue:25000000},{id:'gw2',carryingValue:8000000},{id:'gw3',carryingValue:5000000,status:'disposed'},{id:'gw4',carryingValue:-100}],maSubsidiaries:[{id:'s1',status:'active',pmiStatus:'planning',pmiHealth:80,pmiFriction:20,acquisitionPrice:120000000,identifiableNetAssetsBookValue:90000000,goodwillBookValue:30000000,goodwillRecordID:'gw1',pmiWeeklySynergyProfit:400000},{id:'s2',status:'active',pmiStatus:'stalled',pmiHealth:30,pmiFriction:82,acquisitionPrice:80000000,identifiableNetAssetsBookValue:70000000,goodwillBookValue:10000000,goodwillRecordID:'gw2',realizedWeeklySynergy:150000},{id:'s3',status:'active',pmiStatus:'completed',pmiHealth:95,pmiFriction:5,acquisitionPrice:50000000,identifiableNetAssetsBookValue:45000000,goodwillBookValue:5000000,goodwillRecordID:'gw3',weeklyRealizedSynergy:300000},{id:'s4',status:'disposed',pmiStatus:'completed',pmiHealth:1,pmiFriction:100,acquisitionPrice:90000000,identifiableNetAssetsBookValue:1,goodwillBookValue:999999999,goodwillRecordID:'gw4',weeklyRealizedSynergy:9000000}]};}
const mod=load(),state=fixture(),before=JSON.stringify(state),a=mod.build(state),b=mod.build(state);
assert.deepEqual(a,b,'summary must be deterministic');
assert.equal(JSON.stringify(state),before,'summary must not mutate save state');
assert.equal(a.activeDeals,3);assert.equal(a.terminalDeals,1);assert.equal(a.diligenceDeals,1);assert.equal(a.negotiatingDeals,1);assert.equal(a.acceptedDeals,1);
assert.equal(a.subsidiaries,3,'disposed subsidiaries are excluded');assert.equal(a.planningSubsidiaries,1);assert.equal(a.integratingSubsidiaries,1);assert.equal(a.completedSubsidiaries,1);
assert.equal(a.criticalSubsidiaries,1);assert.equal(a.watchSubsidiaries,0);assert.equal(a.totalAcquisitionPrice,250000000);assert.equal(a.identifiableNetAssetsBookValue,205000000);assert.equal(a.goodwillBookValue,33000000,'goodwill uses non-disposed carrying value after impairment');assert.equal(a.weeklyRealizedSynergy,850000);assert.equal(a.portfolioHealth,68);
assert.equal(a.nextAction.id,'stabilize-pmi','critical PMI must outrank accepted closing');
const accepted=fixture();accepted.maSubsidiaries=accepted.maSubsidiaries.map(s=>({...s,pmiStatus:'completed',pmiHealth:90,pmiFriction:10}));assert.equal(mod.build(accepted).nextAction.id,'plan-financing');
const empty=mod.build({});assert.equal(empty.portfolioHealth,100);assert.equal(empty.nextAction.id,'source-deals');
assert.equal(mod.riskFor({pmiStatus:'integrating',pmiHealth:55,pmiFriction:52}),'watch');assert.equal(mod.riskFor({pmiStatus:'stalled',pmiHealth:90,pmiFriction:0}),'critical');assert.equal(mod.riskFor({pmiStatus:'planning',pmiHealth:80,pmiFriction:10}),'stable');assert.equal(mod.riskFor({pmiStatus:'integrating',pmiHealth:20,pmiFriction:10}),'critical');assert.equal(mod.riskFor({pmiStatus:'integrating',pmiHealth:80,pmiFriction:80}),'critical');assert.equal(mod.riskFor({pmiStatus:'completed'}),'stable');
const reversed=fixture();reversed.maDealRooms.reverse();reversed.maSubsidiaries.reverse();reversed.finance.transactions.reverse();assert.deepEqual(mod.build(reversed),a,'summary is order invariant for equivalent state');
const forbidden=/SAVE_KEY|saveVersion|localStorage|Math\.random|advanceWeek|companyCash\s*[+\-*/]?=/;assert.ok(!forbidden.test(code),'summary stays read-only and save-schema neutral');
console.log('M&A portfolio summary deterministic/purity/risk/priority/accounting aggregation tests passed');
const { loadGame } = require('./harness');
const full = loadGame().modules;
const maf = full.maAcquisitionFinancing;
function acceptedState() {
  const g = full.engine.createInitialState({ configured: true });
  g.week = 12; g.companyCash = 200000000; g.reports = [{ expenses: 1000000 }];
  g.acquisitionTargets = [{ id: 'pt1', name: '優先対象', valuation: 50000000, activeDealID: 'pd1' }];
  g.maDealRooms = [{ id: 'pd1', targetID: 'pt1', status: 'accepted', diligenceConfidence: 0.94, acceptedTerms: { method: 'friendly', finalPrice: 60000000, acceptedWeek: 11, closingDeadlineWeek: 16, offerRound: 1 }, history: [] }];
  return g;
}
let g2 = acceptedState();
assert.equal(full.maPortfolioSummary.build(g2).nextAction.id, 'plan-financing', 'unapproved accepted deal must prioritize board approval');
g2.maDealRooms[0].acquisitionFinancingPlan = maf.buildPlan(g2, g2.maDealRooms[0], { presetID: 'custom', cashAmount: 60000000, termLoanAmount: 0, bridgeLoanAmount: 0, equityRaiseAmount: 0 }, { companyValue: 450000000 });
g2.maDealRooms[0].boardApproval = { status: 'approved', financingPlanKey: g2.maDealRooms[0].acquisitionFinancingPlan.planKey, approvedWeek: 12, expiresWeek: 14, termsKey: full.maBoardApproval.buildTermsKey(g2.maDealRooms[0]), approvedPrice: 60000000, approvedMethod: 'friendly', cashBufferAfter: 120000000, expectedDilution: 0, criticalSubsidiaries: 0 };
assert.equal(full.maPortfolioSummary.build(g2).nextAction.id, 'close-deal', 'valid board approval must prioritize final contract');
g2.week = 15;
assert.equal(full.maPortfolioSummary.build(g2).nextAction.id, 'approve-deal', 'expired approval must return to board approval');
g2 = acceptedState();
g2.maDealRooms[0].acquisitionFinancingPlan = maf.buildPlan(g2, g2.maDealRooms[0], { presetID: 'custom', cashAmount: 60000000, termLoanAmount: 0, bridgeLoanAmount: 0, equityRaiseAmount: 0 }, { companyValue: 450000000 });
g2.maDealRooms[0].boardApproval = { status: 'approved', financingPlanKey: g2.maDealRooms[0].acquisitionFinancingPlan.planKey, approvedWeek: 12, expiresWeek: 14, termsKey: 'wrong', approvedPrice: 60000000, approvedMethod: 'friendly', cashBufferAfter: 120000000, expectedDilution: 0, criticalSubsidiaries: 0 };
assert.equal(full.maPortfolioSummary.build(g2).nextAction.id, 'approve-deal', 'termsKey mismatch must return to board approval');
g2.maSubsidiaries = [{ id: 'critical', status: 'active', pmiStatus: 'stalled', pmiHealth: 20, pmiFriction: 80 }];
assert.equal(full.maPortfolioSummary.build(g2).nextAction.id, 'stabilize-pmi', 'critical PMI still outranks board approval');
