const assert=require('assert');
const fs=require('fs');
const path=require('path');

delete globalThis.__capitalismTycoonModules;
globalThis.__capitalismTycoonModules={engine:{TycoonEngine:function TycoonEngine(){}}};
globalThis.document=undefined;
require('../js/ma-investment-committee.js');
const mod=globalThis.__capitalismTycoonModules.maInvestmentCommittee;

function state(){return {
 week:24,
 acquisitionTargets:[{
  id:'target-a',name:'東亜データセンター',sales:820000000,operatingProfit:94000000,
  valuation:1150000000,growth:.16,risk:.24,synergy:.14
 }],
 maDealRooms:[{
  id:'deal-a',targetID:'target-a',status:'ready',diligenceConfidence:.72,sellerAsk:1260000000,
  valuationBridge:{adjustedEquityValue:1080000000,netDebt:150000000,legalRiskAdjustment:18000000,recommendedMaximumPrice:1320000000},
  findings:[
   {category:'customer',observedValue:34,severity:'neutral'},
   {category:'technology',observedValue:28,severity:'neutral'},
   {category:'management',observedValue:22,severity:'neutral'},
   {category:'legal',observedValue:18000000,severity:'neutral'}
  ]
 }]
};}

const first=mod.buildInvestmentMemo(state(),'deal-a');
const second=mod.buildInvestmentMemo(JSON.parse(JSON.stringify(state())),'deal-a');
assert.deepStrictEqual(first,second,'same save state must produce the same investment memo');
assert.equal(first.dealID,'deal-a');
assert.equal(first.targetID,'target-a');
assert.equal(first.targetName,'東亜データセンター');
assert(first.enterpriseValue>first.equityValue,'enterprise value includes net debt');
assert(first.dcfEquityValue>0,'DCF equity value is calculated');
assert(first.synergyNPV>0,'synergy NPV is calculated');
assert(Number.isFinite(first.evEbitda));
assert(Number.isFinite(first.per));
assert(Number.isFinite(first.pbr));
assert(first.riskScore>=0&&first.riskScore<=100);
assert(first.strategicScore>=0&&first.strategicScore<=100);
assert(first.financialScore>=0&&first.financialScore<=100);
assert(['買収推奨','条件付き推奨','追加DD','見送り推奨'].includes(first.recommendation));
assert(Object.isFrozen(first));
assert(Object.isFrozen(first.reasons));

const ordered=state();
ordered.acquisitionTargets.push({id:'target-b',name:'高リスク企業',sales:500000000,operatingProfit:-20000000,valuation:600000000,growth:.03,risk:.9,synergy:.02});
ordered.maDealRooms.push({id:'deal-b',targetID:'target-b',status:'screening',diligenceConfidence:0,sellerAsk:700000000,valuationBridge:{adjustedEquityValue:450000000,netDebt:220000000,recommendedMaximumPrice:480000000},findings:[]});
const memos=mod.buildAllMemos(ordered);
assert.equal(memos.length,2);
assert.equal(memos[0].dealID,'deal-a','lower risk deal is presented first');
assert.equal(memos[1].recommendation,'見送り推奨');
const reversed={...ordered,acquisitionTargets:[...ordered.acquisitionTargets].reverse(),maDealRooms:[...ordered.maDealRooms].reverse()};
assert.deepStrictEqual(mod.buildAllMemos(reversed),memos,'array order must not change memo order or values');

const before=JSON.stringify(ordered);
mod.buildAllMemos(ordered);
assert.equal(JSON.stringify(ordered),before,'memo building must not mutate the save state');
assert.equal(mod.buildInvestmentMemo(ordered,'missing'),null);
assert.equal(mod.buildInvestmentMemo({maDealRooms:[],acquisitionTargets:[]},'deal-a'),null);

const Engine=globalThis.__capitalismTycoonModules.engine.TycoonEngine;
const engine=new Engine();engine.g=state();
assert.deepStrictEqual(engine.getMAInvestmentMemo('deal-a'),first,'engine bridge returns the same memo');
assert.equal(engine.getMAInvestmentCommitteeMemos().length,1);
assert.equal(Engine.prototype.__maInvestmentCommitteeInstalled,true);

const source=fs.readFileSync(path.join(__dirname,'../js/ma-investment-committee.js'),'utf8');
assert(!source.includes('Math.random('),'game result must not use Math.random');
assert(!source.includes('Date.now('),'game result must not use Date.now');
assert(source.includes('@media(max-width:390px)'),'iPhone 390px contract is present');
assert(source.includes('min-height:46px'),'primary floating action is at least 44px high');
assert(source.includes('overflow-wrap:anywhere'),'long money values wrap on iPhone');
console.log('ma-investment-committee-test: ok');
