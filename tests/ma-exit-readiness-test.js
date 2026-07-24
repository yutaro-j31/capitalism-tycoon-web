'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(ROOT,'js/ma-exit-readiness.js'),'utf8');
function load(){const context={globalThis:{__capitalismTycoonModules:{}}};context.globalThis.globalThis=context.globalThis;vm.runInNewContext(code,context);return context.globalThis.__capitalismTycoonModules.maExitReadiness;}
function fixture(){return {week:80,goodwillRecords:[{id:'gw-good',carryingValue:30_000_000},{id:'gw-disposed',carryingValue:99_000_000,status:'disposed'}],subsidiaries:[{id:'v-ipo',name:'成長SaaS',status:'active',valuation:600_000_000,ownership:.6,carryingBookValue:120_000_000,weeklyProfit:2_000_000,createdWeek:10,publicCompany:false},{id:'v-public',name:'上場済み子会社',status:'active',valuation:900_000_000,ownership:.55,carryingBookValue:300_000_000,weeklyProfit:2_500_000,createdWeek:5,publicCompany:true},{id:'v-disposed',name:'売却済み',status:'disposed',valuation:9_000_000_000,ownership:1,carryingBookValue:1,weeklyProfit:9_000_000}],maSubsidiaries:[{id:'m-critical',name:'停滞物流',status:'active',valuation:300_000_000,ownership:1,identifiableNetAssetsBookValue:180_000_000,goodwillRecordID:'gw-good',weeklyProfit:500_000,acquiredWeek:50,pmiStatus:'stalled',pmiHealth:25,pmiFriction:82},{id:'m-loss',name:'赤字小売',status:'active',valuation:130_000_000,ownership:1,identifiableNetAssetsBookValue:150_000_000,goodwillRecordID:'gw-disposed',weeklyProfit:-500_000,acquiredWeek:10,pmiStatus:'completed',pmiHealth:90,pmiFriction:5},{id:'m-harvest',name:'成熟サービス',status:'active',valuation:420_000_000,ownership:1,identifiableNetAssetsBookValue:180_000_000,weeklyProfit:1_000_000,acquiredWeek:1,pmiStatus:'completed',pmiHealth:92,pmiFriction:4}]};}
const mod=load(),state=fixture(),before=JSON.stringify(state),model=mod.build(state);
assert.equal(JSON.stringify(state),before,'model must not mutate state');
assert.equal(model.subsidiaries,5,'inactive/disposed subsidiaries are excluded');
assert.equal(model.ipoReady,1);assert.equal(model.divestCandidates,2);assert.equal(model.pmiBlocked,1);assert.equal(model.criticalPMI,1);
assert.equal(model.nextAction.id,'stabilize-pmi');assert.equal(model.nextAction.subsidiaryID,'m-critical');
const ipo=model.rows.find(row=>row.subsidiaryID==='v-ipo');assert.equal(ipo.ipoEligible,true);assert.equal(ipo.recommendation.id,'prepare-ipo');assert.equal(ipo.stakeValue,360_000_000);assert.equal(ipo.bookValue,120_000_000);assert.equal(ipo.unrealizedGain,240_000_000);
const critical=model.rows.find(row=>row.subsidiaryID==='m-critical');assert.deepEqual([...critical.blockers],['pmi-critical','pmi-incomplete']);assert.equal(critical.bookValue,210_000_000,'MA book value includes active goodwill carrying value');
const loss=model.rows.find(row=>row.subsidiaryID==='m-loss');assert.equal(loss.bookValue,150_000_000,'disposed goodwill is excluded');assert.equal(loss.divestCandidate,true);assert.equal(loss.recommendation.id,'review-sale');
const harvest=model.rows.find(row=>row.subsidiaryID==='m-harvest');assert.equal(harvest.divestCandidate,true,'mature high-gain subsidiary is a harvest candidate');
const reversed=fixture();reversed.subsidiaries.reverse();reversed.maSubsidiaries.reverse();reversed.goodwillRecords.reverse();assert.deepEqual(mod.build(reversed),model,'model is order invariant');
const completed=fixture();completed.maSubsidiaries[0].pmiStatus='completed';completed.maSubsidiaries[0].pmiHealth=90;completed.maSubsidiaries[0].pmiFriction=5;assert.equal(mod.build(completed).nextAction.id,'prepare-ipo','IPO readiness follows resolved PMI risk');
const empty=mod.build({});assert.equal(empty.subsidiaries,0);assert.equal(empty.nextAction.id,'none');
assert.equal(mod.pmiRisk({pmiStatus:'integrating',pmiHealth:55,pmiFriction:52}),'watch');assert.equal(mod.pmiRisk({pmiStatus:'stalled',pmiHealth:90,pmiFriction:0}),'critical');assert.equal(mod.pmiRisk({pmiStatus:'completed'}),'stable');
assert.ok(!/SAVE_KEY|saveVersion|localStorage|Math\.random|companyCash\s*[+\-*/]?=|finance\.event/.test(code),'model remains read-only and save-schema neutral');
console.log('M&A exit readiness determinism, purity, valuation, PMI and recommendation tests passed');
