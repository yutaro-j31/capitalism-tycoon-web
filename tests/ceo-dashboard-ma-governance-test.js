'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {ROOT}=require('./harness');
const ceoCode=fs.readFileSync(path.join(ROOT,'js/ceo-dashboard.js'),'utf8');
const summaryCode=fs.readFileSync(path.join(ROOT,'js/ma-portfolio-summary.js'),'utf8');
const uiCode=fs.readFileSync(path.join(ROOT,'js/ma-portfolio-summary-ui.js'),'utf8');
const appCode=fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');
function loadDashboard(){const context={globalThis:{__capitalismTycoonModules:{}}};context.globalThis.globalThis=context.globalThis;vm.runInNewContext(ceoCode,context);return context.globalThis.__capitalismTycoonModules.ceoDashboard;}
function loadSummary(){const context={globalThis:{__capitalismTycoonModules:{}}};context.globalThis.globalThis=context.globalThis;vm.runInNewContext(summaryCode,context);return context.globalThis.__capitalismTycoonModules.maPortfolioSummary;}
function fixture(){return {week:24,saveVersion:9,companyCash:50000000,companyDebt:0,finance:{transactions:[{id:'t2'},{id:'t1'}]},maDealRooms:[{id:'d1',status:'accepted'},{id:'d2',status:'diligence'},{id:'d3',status:'countered'}],goodwillRecords:[{id:'gw1',carryingValue:21600000},{id:'gw2',carryingValue:999999,status:'disposed'}],maSubsidiaries:[{id:'s1',status:'active',pmiStatus:'stalled',pmiHealth:30,pmiFriction:80,acquisitionPrice:90000000,identifiableNetAssetsBookValue:68400000,goodwillRecordID:'gw1',goodwillBookValue:30000000,pmiWeeklySynergyProfit:400000},{id:'s2',status:'disposed',pmiStatus:'completed',pmiHealth:100,pmiFriction:0,acquisitionPrice:777,identifiableNetAssetsBookValue:777,goodwillRecordID:'gw2',goodwillBookValue:999999,weeklyRealizedSynergy:777}]};}
const dashboard=loadDashboard(),summary=loadSummary();
function maFor(state){return dashboard.maGovernance(state,{maPortfolio:summary.build(state)});}
let state=fixture(),before=JSON.stringify(state),shared=summary.build(state),ma=maFor(state);
assert.deepEqual(ma,dashboard.maGovernance(state,{maPortfolio:shared}),'M&A governance is deterministic with the same shared summary');
assert.equal(JSON.stringify(state),before,'M&A governance must not mutate state');
for(const key of ['activeDeals','diligenceDeals','negotiatingDeals','acceptedDeals','subsidiaries','planningSubsidiaries','integratingSubsidiaries','completedSubsidiaries','portfolioHealth','criticalSubsidiaries','watchSubsidiaries','totalAcquisitionPrice','identifiableNetAssetsBookValue','goodwillBookValue','weeklyRealizedSynergy']) assert.equal(ma[key],shared[key],`${key} mirrors shared portfolio summary`);
assert.equal(ma.nextAction.id,'stabilize-pmi','critical PMI outranks accepted closing');
assert.equal(ma.goodwillBookValue,21600000,'disposed goodwill is excluded and impaired carrying value is used');
assert.equal(ma.totalAcquisitionPrice,90000000,'disposed subsidiary acquisition price is excluded');
let accepted=fixture();accepted.maSubsidiaries=accepted.maSubsidiaries.map(s=>({...s,pmiStatus:'completed',pmiHealth:90,pmiFriction:10}));assert.equal(maFor(accepted).nextAction.id,'close-deal','accepted deal priority');
let dd={maDealRooms:[{status:'diligence'}],maSubsidiaries:[]};assert.equal(maFor(dd).nextAction.id,'complete-dd','DD priority');
let negotiating={maDealRooms:[{status:'offer_pending'}],maSubsidiaries:[]};assert.equal(maFor(negotiating).nextAction.id,'review-offer','negotiating priority');
let planning={maDealRooms:[],maSubsidiaries:[{status:'active',pmiStatus:'planning',pmiHealth:80,pmiFriction:10}]};assert.equal(maFor(planning).nextAction.id,'start-pmi','PMI planning priority');
let zero=maFor({});assert.equal(zero.nextAction.id,'source-deals','zero state sources deals');assert.equal(zero.portfolioHealth,100);assert.equal(zero.activeDeals,0);assert.equal(zero.subsidiaries,0);
let unavailable=dashboard.maGovernance({},{});assert.equal(unavailable.available,false);assert.equal(unavailable.portfolioHealth,100);assert.equal(unavailable.nextAction.id,'source-deals');
const reversed=fixture();reversed.maDealRooms.reverse();reversed.maSubsidiaries.reverse();reversed.goodwillRecords.reverse();reversed.finance.transactions.reverse();assert.deepEqual(maFor(reversed),ma,'dashboard M&A meaning follows shared summary under reordered arrays');
for(const selector of ['data-ceo-ma-governance','data-ceo-ma-health','data-ceo-ma-action','data-ceo-ma-active-deals','data-ceo-ma-subsidiaries','data-ceo-ma-goodwill','data-ceo-ma-synergy']) assert.match(appCode,new RegExp(selector),`${selector} exists`);
assert.match(appCode,/data-tab="ma"/,'M&A CTA navigates to M&A tab');
assert.match(appCode,/ACTION_SELECTORS/,'M&A CTA reuses shared UI action selectors');
for(const [id,selectorText] of Object.entries({ 'stabilize-pmi':'\\[data-ma-subsidiary\\] \\[data-ma-pmi-support\\]','close-deal':'ma-close-deal','complete-dd':'data-ma-dd-progress','review-offer':'data-ma-offer-price','start-pmi':'data-ma-pmi-strategy','source-deals':'generate-ma'})) assert.match(uiCode,new RegExp(selectorText),`shared ACTION_SELECTORS has ${id}`);
const cards=(appCode.match(/fold\('ma-governance'/g)||[]).length;assert.equal(cards,1,'render source contains one M&A governance card');
const saveCode=fs.readFileSync(path.join(ROOT,'js/engine.js'),'utf8')+fs.readFileSync(path.join(ROOT,'js/save-v9.js'),'utf8');assert.match(saveCode,/capitalism_tycoon_web_v1/,'SAVE_KEY remains capitalism_tycoon_web_v1');assert.match(saveCode,/const SAVE_VERSION=9/,'saveVersion remains 9');
const forbidden=/localStorage\.setItem|localStorage\.removeItem|Math\.random|advanceWeek|companyCash\s*[+\-*/]?=|companyDebt\s*[+\-*/]?=|saveVersion\s*=/;assert.ok(!forbidden.test(ceoCode),'CEO dashboard governance remains render/model read-only');
console.log('CEO dashboard M&A governance shared-summary/determinism/purity/priority/accounting/selector/save tests passed');
