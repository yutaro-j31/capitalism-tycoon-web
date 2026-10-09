'use strict';
function prepareAcceptedPE(modules,coinvest=false,lpWitness=false){
const pf = modules.peFund, ds = modules.peDealSupply; const engineModule=modules.engine; const assert={ok(v,msg){if(!v)throw new Error(msg||'fixture ok');},equal(a,b,msg){if(a!==b)throw new Error((msg||'fixture equal')+': '+a+' != '+b);}};
const e = new engineModule.TycoonEngine();
e.configure({ playerName: 'PE Fault Audit', companyName: 'PE Audit Holdings', difficulty: 'normal' });
e.g.departments.investment = { established: true };
e.g.departmentStaff.investment = 9;
e.g.executives.CSO = { role: 'CSO', skill: 80 };
e.g.executives.CFO = { role: 'CFO', skill: 80 };
e.g.companyCash = 50_000_000_000;
pf.recordExit(e.g, {
  exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000,
  foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30
});
e.g.personalCash = 30_000_000_000;
// Diagnostic capital endowment must initialize matching company ledger before actual weeks.
e.g.finance = modules.finance.defaultFinanceState(e.g);
const size = pf.formableFundSize(e.g);
const fund = pf.createFund(e.g, {
  size, gpCommit: size * pf.requiredGPRatio(e.g.peFirm.trackRecord.score),
  terms: pf.fundTermsForScore(e.g.peFirm.trackRecord.score), y0: e.g.week
});
assert.ok(fund, 'precondition: fund created');

let target = null;
for (let i = 0; i < 80 && !target; i++) {
  e.advanceWeek(false);
  target = e.g.acquisitionTargets.filter(ds.isPETarget).find(t => {
    const quote = e.calculateMAAcquisitionPrice(t, 'friendly');
    const price = Math.ceil(quote.minimumPrice * 1.02);
    return (()=>{const p=pf.planDealFinancing(fund,price,coinvest);return p.rejectedAmount===0&&(!coinvest||p.coinvestPortion>0);})();
  }) || null;
}
assert.ok(target, 'precondition: a suitable PE target was supplied');
assert.equal(e.openMADealRoom(target.id), true);
const deal = e.g.maDealRooms.find(x => x.targetID === target.id);
assert.equal(e.startMADueDiligence(deal.id, 'screening', fund.id), true); if(coinvest)assert.equal(e.setPEDealCoinvest(deal.id,true),true);
for (let i = 0; i < 6 && deal.status === 'diligence'; i++) e.advanceWeek(false);
assert.equal(deal.status, 'ready');
const price = Math.ceil(e.calculateMAAcquisitionPrice(target, 'friendly').minimumPrice * 1.02);
assert.equal(e.submitMAOffer(deal.id, { method: 'friendly', offerPrice: price }), true);
for (let i = 0; i < 4 && deal.status === 'offer_pending'; i++) e.advanceWeek(false);
assert.equal(deal.status, 'accepted', 'precondition: closeable PE deal');
if(lpWitness){
  assert.ok(pf.addLPCommitment(fund,{lpTypeID:'universitySovereign',committedAmount:1000000,promiseAccepted:true}));
  // Deliberate LP restriction witness: keep supplied target economics, mark tested LP-restricted tier.
  target.peTierID='largeCap';
}
return {e,fundID:fund.id,dealID:deal.id,targetID:target.id,price};
}
function economic(g) { const c=JSON.parse(JSON.stringify(g)); delete c.lastSaveDate; delete c.saveSequence; return c; }
function makeRandom(seed=7) { let s=seed>>>0; return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;}; }
// Native hist() places the same row in ascending deal.history and descending maDealHistory.
// Recreate that live object graph after a JSON fixture transfer, without changing saved values.
function linkHistoryRows(g) {
  const rows=new Map(g.maDealHistory.map(row=>[row.id,row]));
  for(const deal of g.maDealRooms)deal.history=deal.history.map(row=>rows.get(row.id)||row);
}
function fillHistoryCaps(g,dealID) {
  const deal=g.maDealRooms.find(x=>x.id===dealID);
  const prefix=Array.from({length:100-deal.history.length},(_,i)=>({id:'pe-cap-'+i,week:0,type:'diagnostic',message:'history cap witness '+i}));
  deal.history=[...prefix,...deal.history];
  g.maDealHistory=[...deal.history].reverse();
  while(g.maDealHistory.length<200)g.maDealHistory.push({id:'pe-global-cap-'+g.maDealHistory.length,week:0,type:'diagnostic',message:'global history cap witness'});
}
module.exports={prepareAcceptedPE,economic,makeRandom,linkHistoryRows,fillHistoryCaps};
