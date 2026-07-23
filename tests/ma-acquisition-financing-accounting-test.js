const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { modules } = loadGame();
const { engine, finance } = modules;
const maf = modules.maAcquisitionFinancing;
function state(method='friendly') { const g=engine.createInitialState({configured:true}); Object.assign(g,{week:24,companyCash:120000000,companyDebt:10000000,companyCredit:82,publicCompany:true,stockPrice:1000,sharesOut:1000000,founderShares:700000,reports:[{expenses:5000000}],lastReport:{profit:6000000,expenses:5000000}}); g.finance=finance.defaultFinanceState(g); g.acquisitionTargets=[{id:'t1',name:'資金テック',valuation:80000000,sales:100000000,operatingProfit:12000000,risk:.1,synergy:.1,activeDealID:'d1'}]; g.maDealRooms=[{id:'d1',targetID:'t1',status:'accepted',diligenceLevel:'full',diligenceConfidence:.94,acceptedTerms:{method,finalPrice:100000000,acceptedWeek:23,closingDeadlineWeek:28,offerRound:1},history:[]}]; return g; }
let g=state(), d=g.maDealRooms[0];
const c1=maf.buildCapacity(g,d,{companyValue:500000000}); const c2=maf.buildCapacity(g,d,{companyValue:500000000}); assert.deepEqual(c1,c2); assert.equal(c1.minimumCashBuffer,20000000); assert.equal(c1.maximumCashContribution,100000000); assert.equal(c1.publicCompany,true); assert.ok(c1.maximumAdditionalDebt>0); assert.equal(Object.values(c1).some(v=>typeof v==='number'&&(!Number.isFinite(v)||Number.isNaN(v))),false);
const presets=maf.buildPresets(g,d,{companyValue:500000000}); assert.equal(JSON.stringify(presets.map(p=>p.presetID)), JSON.stringify(['cash-heavy','balanced','leveraged','low-dilution','liquidity-protected','custom'])); for(const p of presets) assert.equal(p.totalSources,100000000);
g.publicCompany=false; assert.equal(maf.buildPlan(g,d,{presetID:'balanced'},{companyValue:500000000}).equityRaiseAmount,0);
g=state('shareSwap'); d=g.maDealRooms[0]; assert.equal(maf.validatePlan(g,d,null).valid,true);
console.log('ma acquisition financing base tests passed');
