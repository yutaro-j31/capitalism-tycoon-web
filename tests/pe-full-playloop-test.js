'use strict';

// Full PE player-loop regression.
// Locks the connected production path from LP outreach through Fund II formation in one state:
// LP DDQ -> Fund I -> sourced deal -> DD -> accepted bid -> fund acquisition -> portfolio
// management -> canonical weekly operation -> exit/waterfall -> next-fund gate -> Fund II.
// Lower-level portfolio acquisition is used only to fill the remaining diversification slots
// after one deal has traversed the complete M&A funnel; every filler still uses the canonical
// PE financing/portfolio/exit writers rather than synthetic deal objects.

const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

function makeRandom(seed){
  let s=seed>>>0;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};
}

const {ctx,modules}=loadGame({random:makeRandom(137),isolatedLegacyIndex:true});
const engine=ctx.__ct_engine;
const pf=modules.peFund;
const ds=modules.peDealSupply;
const ops=modules.pePortfolioOperations;
const adapter=modules.peUIAdapter;

engine.configure({playerName:'PE Playloop',companyName:'Playloop Partners',difficulty:'normal'});
engine.g.departments.investment={established:true};
engine.g.departmentStaff.investment=9;
engine.g.executives.CSO={role:'CSO',skill:85};
engine.g.executives.CFO={role:'CFO',skill:85};
engine.g.companyCash=50_000_000_000;
engine.g.personalCash=30_000_000_000;
pf.recordExit(engine.g,{
  exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,
  foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30
});
engine.g.selectedTab='pe-portfolio';

// 1. LP outreach must resolve through the weekly production loop and surface in the PE UI.
assert.equal(engine.solicitPELP('wealthyFamilyOffice'),true,'first meetable LP can be solicited');
let lp=pf.lpOutreachRows(engine.g).find(x=>x.id==='wealthyFamilyOffice');
for(let i=0;i<6&&lp?.outreach?.status==='ddq';i++){
  assert.notEqual(engine.advanceWeek(false),false);
  lp=pf.lpOutreachRows(engine.g).find(x=>x.id==='wealthyFamilyOffice');
}
assert.equal(lp?.outreach?.status,'positive','DDQ reaches a positive answer without manual state mutation');
assert.ok(adapter.getPEUIData().lpRelations.positive>=1,'positive LP response reaches the production PE adapter');

// 2. Form Fund I with a player-selected GP commitment; the adapter must immediately expose real capital.
const maxPlan=engine.formablePEFund();
assert.equal(maxPlan.ok,true);
const chosenGP=maxPlan.maxGpCommit*.55;
assert.equal(engine.formPEFund({gpCommit:chosenGP}),true,'Fund I forms through the player action');
const fund=engine.g.peFirm.funds.at(-1);
assert.ok(fund&&Math.abs(fund.gpCommit-chosenGP)<1,'chosen GP commitment is the actual Fund I commitment');
let model=adapter.getPEUIData();
assert.equal(model.dashboard.fund.ordinal,1);
assert.ok(model.dashboard.capital.fundCash>0);
assert.equal(model.dashboard.capital.fundCash,fund.cash);

// 3. Source one real PE target and take it through the complete M&A/DD/bid/close path.
let target=null;
for(let i=0;i<80&&!target;i++){
  assert.notEqual(engine.advanceWeek(false),false);
  target=engine.g.acquisitionTargets.filter(ds.isPETarget).find(t=>!t.activeDealID)||null;
}
assert.ok(target,'weekly production supply produces a PE target');
assert.equal(engine.openMADealRoom(target.id),true);
const room=engine.g.maDealRooms.find(d=>d.targetID===target.id);
assert.ok(room);
assert.equal(engine.startMADueDiligence(room.id,'screening'),true,'single active fund is selected for DD');
assert.equal(room.fundID,fund.id);
for(let i=0;i<8&&room.status==='diligence';i++)assert.notEqual(engine.advanceWeek(false),false);
assert.equal(room.status,'ready');
const quote=engine.calculateMAAcquisitionPrice(target,'friendly');
const price=Math.ceil(quote.minimumPrice*1.02);
engine.setPEDealCoinvest(room.id,true);
assert.equal(engine.submitMAOffer(room.id,{method:'friendly',offerPrice:price}),true);
for(let i=0;i<6&&room.status==='offer_pending';i++)assert.notEqual(engine.advanceWeek(false),false);
assert.equal(room.status,'accepted','the deterministic offer reaches acceptance for this fixed seed');
const companyAtClose=engine.g.companyCash;
assert.equal(engine.closeMADeal(room.id),true);
assert.equal(engine.g.companyCash,companyAtClose,'PE purchase price never comes from operating-company cash');
const firstDeal=fund.deals.find(d=>d.sourceTargetID===target.id);
assert.ok(firstDeal?.portfolioCompany&&firstDeal.status==='active','accepted target becomes an active fund portfolio company');

// 4. Exercise a real management lever, then fill only the remaining deployment gate with canonical
// portfolio acquisitions. No synthetic deal rows or direct distributed/DPI mutations are allowed.
assert.ok(ops.setPriceMultiplier(engine.g,fund.id,firstDeal.id,1.05),'portfolio management writer is reachable');
assert.equal(firstDeal.portfolioCompany.priceMultiplier,1.05);
const businesses=['ramen','conveni','gym','productVentures','realEstateAgency'];
let fillerIndex=0;
const deploymentTarget=pf.requiredDeploymentRate(fund);
while(pf.fundDeploymentRate(fund)+1e-9<deploymentTarget){
  const remaining=Math.max(0,fund.size*deploymentTarget-pf.fundDeployed(fund));
  const amount=Math.min(pf.maxSingleDealSize(fund),remaining);
  assert(amount>0,'remaining deployment amount must stay positive');
  const filler=ops.acquirePillarCompany(engine.g,fund.id,{
    businessID:businesses[fillerIndex%businesses.length],
    enterpriseValue:amount,
    useCoinvest:false,
    week:engine.g.week
  });
  assert.ok(filler,'canonical portfolio acquisition fills the next diversification slot');
  fillerIndex+=1;
  assert(fillerIndex<=pf.SLOT_CAP_ABSOLUTE,'deployment gate is reachable within the production slot ceiling');
}
assert.ok(pf.fundDeploymentRate(fund)+1e-9>=deploymentTarget,'Fund I reaches its real deployment requirement');
assert.ok(pf.activeDealCount(fund)<=pf.slotCapacity(fund),'integration fixture never exceeds the production active-deal capacity');

// 5. Let production weekly operations run for the designed Fund I holding period, then exit every
// holding through the canonical preview/execution waterfall.
const holdWeeks=pf.FIRST_FUND_HOLD_WEEKS;
for(let i=0;i<holdWeeks;i++)assert.notEqual(engine.advanceWeek(false),false);
assert.ok(firstDeal.portfolioCompany.profitHistory.length>0,'portfolio company actually operated over the holding period');
for(const deal of fund.deals.filter(d=>d.status==='active')){
  const preview=engine.previewPEPortfolioExit(fund.id,deal.id,{method:'sale'});
  assert.equal(preview.ok,true);
  assert.ok(preview.grossProceeds>0);
  const companyBeforeExit=engine.g.companyCash;
  assert.equal(engine.exitPEPortfolioCompany(fund.id,deal.id,{method:'sale'}),true);
  assert.equal(engine.g.companyCash,companyBeforeExit,'fund exit proceeds never enter operating-company cash');
  assert.ok(deal.exitSettlement,'exit uses the canonical fund/coinvest/GP waterfall');
}
assert.equal(fund.deals.some(d=>d.status==='active'),false);
assert.ok(pf.fundDPI(fund)>=pf.NEXT_FUND_MIN_DPI,
  `fixed-seed Fund I must clear the DPI gate: got ${pf.fundDPI(fund).toFixed(3)}`);
assert.ok(pf.fundDeploymentRate(fund)+1e-9>=pf.requiredDeploymentRate(fund));
assert.equal(pf.canFormNextFund(engine.g),true,'realized Fund I performance unlocks the next fund');

// 6. The UI gate explanation and the actual Fund II action must agree.
model=adapter.getPEUIData();
assert.equal(model.dashboard.performance.normalGateMet,true);
assert.equal(model.dashboard.performance.nextFundEligible,true);
const fundIIPlan=engine.formablePEFund();
assert.equal(fundIIPlan.ok,true);
const fundIIPersonalBefore=engine.g.personalCash;
const fundIIGP=fundIIPlan.maxGpCommit*.5;
assert.equal(engine.formPEFund({gpCommit:fundIIGP}),true,'Fund II forms through the same player action');
const fundII=engine.g.peFirm.funds.at(-1);
assert.equal(engine.g.peFirm.funds.length,2);
assert.ok(Math.abs(fundII.gpCommit-fundIIGP)<1);
assert.ok(Math.abs(engine.g.personalCash-(fundIIPersonalBefore-fundIIGP))<1,
  'Fund II GP commitment debits personal cash exactly once');

model=adapter.getPEUIData();
assert.equal(model.dashboard.fund.ordinal,2);
assert.deepEqual([...model.dashboard.fundComparison.map(x=>x.ordinal)],[1,2],
  'PE UI compares Fund I and Fund II after the complete loop');
assert.equal(modules.finance.validate(engine.g).ok,true,'full PE loop preserves canonical finance invariants');

console.log('PE full player loop: LP -> Fund I -> deal -> manage -> exit -> Fund II passed');
