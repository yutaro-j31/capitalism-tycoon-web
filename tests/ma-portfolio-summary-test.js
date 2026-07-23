'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(ROOT,'js/ma-portfolio-summary.js'),'utf8');
function load(){const context={globalThis:{__capitalismTycoonModules:{}}};context.globalThis.globalThis=context.globalThis;vm.runInNewContext(code,context);return context.globalThis.__capitalismTycoonModules.maPortfolioSummary;}
function fixture(){return {maDealRooms:[{id:'d1',status:'diligence'},{id:'d2',status:'countered'},{id:'d3',status:'accepted'},{id:'d4',status:'expired'}],maSubsidiaries:[{id:'s1',pmiStatus:'planning',pmiHealth:80,pmiFriction:20,acquisitionPrice:120000000,goodwillBookValue:30000000,weeklyRealizedSynergy:400000},{id:'s2',pmiStatus:'stalled',pmiHealth:30,pmiFriction:82,acquisitionPrice:80000000,goodwillBookValue:10000000,realizedWeeklySynergy:150000},{id:'s3',pmiStatus:'completed',pmiHealth:95,pmiFriction:5,acquisitionPrice:50000000,goodwillBookValue:5000000,weeklyRealizedSynergy:300000}]};}
const mod=load(),state=fixture(),before=JSON.stringify(state),a=mod.build(state),b=mod.build(state);
assert.deepEqual(a,b,'summary must be deterministic');
assert.equal(JSON.stringify(state),before,'summary must not mutate save state');
assert.equal(a.activeDeals,3);assert.equal(a.terminalDeals,1);assert.equal(a.diligenceDeals,1);assert.equal(a.negotiatingDeals,1);assert.equal(a.acceptedDeals,1);
assert.equal(a.subsidiaries,3);assert.equal(a.planningSubsidiaries,1);assert.equal(a.integratingSubsidiaries,1);assert.equal(a.completedSubsidiaries,1);
assert.equal(a.criticalSubsidiaries,1);assert.equal(a.watchSubsidiaries,0);assert.equal(a.totalAcquisitionPrice,250000000);assert.equal(a.goodwillBookValue,45000000);assert.equal(a.weeklyRealizedSynergy,850000);assert.equal(a.portfolioHealth,68);
assert.equal(a.nextAction.id,'stabilize-pmi','critical PMI must outrank accepted closing');
const accepted=fixture();accepted.maSubsidiaries=accepted.maSubsidiaries.map(s=>({...s,pmiStatus:'completed',pmiHealth:90,pmiFriction:10}));assert.equal(mod.build(accepted).nextAction.id,'close-deal');
const empty=mod.build({});assert.equal(empty.portfolioHealth,100);assert.equal(empty.nextAction.id,'source-deals');
assert.equal(mod.riskFor({pmiStatus:'integrating',pmiHealth:55,pmiFriction:52}),'watch');assert.equal(mod.riskFor({pmiStatus:'stalled',pmiHealth:90,pmiFriction:0}),'critical');assert.equal(mod.riskFor({pmiStatus:'completed'}),'stable');
const forbidden=/SAVE_KEY|saveVersion|localStorage|Math\.random|advanceWeek|companyCash\s*[+\-*/]?=/;assert.ok(!forbidden.test(code),'summary stays read-only and save-schema neutral');
console.log('M&A portfolio summary deterministic/purity/risk/priority/accounting aggregation tests passed');
