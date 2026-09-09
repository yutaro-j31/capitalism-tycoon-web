'use strict';

const assert=require('node:assert/strict');
const{loadGame}=require('./harness');

const CHECKPOINTS=new Set([26,52,78,104,156,208]);
const SEED=638515;
const makeRandom=()=>{let seed=SEED;return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);};

function maintenance(engine){return engine.g.finance.transactions.filter(row=>row.week===engine.g.week&&row.sourceType==='productMaintenance').reduce((sum,row)=>sum+Math.abs(Number(row.cashEffect)||0),0);}
function totals(engine){const products=engine.g.productVentures.filter(row=>row.status==='released');return{productCount:engine.g.productVentures.length,users:Math.round(products.reduce((sum,row)=>sum+row.users,0)),paidUsers:Math.round(products.reduce((sum,row)=>sum+row.paidUsers,0)),revenue:Math.round(products.reduce((sum,row)=>sum+row.revenue,0)),productProfit:Math.round(products.reduce((sum,row)=>sum+row.profit,0)),valuation:Math.round(products.reduce((sum,row)=>sum+row.valuation,0))};}
function simulate(ids,{departments=[],focus=null}={}){
  const loaded=loadGame({random:makeRandom(),headless:true});const{engineModule,modules}=loaded,e=new engineModule.TycoonEngine();
  e.g.configured=true;e.g.companyCash=250_000_000;e.g.personalCash=12_345_678;e.g.skipWeeklyValidation=true;
  assert.equal(e.foundDigitalBusiness(ids[0]),true);
  const office=e.g.rentalOffices.filter(row=>row.capacity>=28).sort((a,b)=>a.deposit-b.deposit)[0];assert(office);assert.equal(e.contractOffice(office.id),true);
  for(const id of departments)assert.equal(e.establishDepartment(id),true);
  if(!e.g.departments.product)assert.equal(e.establishDepartment('product'),true);
  for(const id of ids.slice(1))assert.equal(e.launchProduct(id),true);
  const initialInvestment=250_000_000-e.g.companyCash,snapshots={},personal=e.g.personalCash;let cumulativeOperatingCashFlow=0,paybackWeek=null;
  for(let elapsed=1;elapsed<=208;elapsed++){
    // A scale-up case is actively operated, not an idle-product stress case. Reinvest a modest
    // 1m per released product every half year through the production actions from #638.
    if(elapsed%26===1)for(const product of e.g.productVentures.filter(row=>row.status==='released')){assert.equal(e.productAction(product.id,'quality',500_000),true);assert.equal(e.productAction(product.id,'marketing',500_000),true);}
    e.g.week++;const core=e.updateProducts(),funnel=e.updateProductFunnelsWeekly(),lifecycle=maintenance(e),payroll=modules.workforce.weeklyPayroll(e.g),officeCost=e.g.officeWeeklyCost,interest=e.g.companyDebt*e.companyBorrowRate()/52;
    e.g.companyCash+=core.profit+funnel.adjustment-payroll-officeCost-interest;
    const portfolio=totals(e),companyProfit=portfolio.productProfit-lifecycle-payroll-officeCost-interest;cumulativeOperatingCashFlow+=companyProfit;
    if(paybackWeek===null&&cumulativeOperatingCashFlow>=initialInvestment)paybackWeek=elapsed;
    if(CHECKPOINTS.has(elapsed))snapshots[elapsed]={...portfolio,maintenance:Math.round(lifecycle),payroll:Math.round(payroll),officeCost:Math.round(officeCost),interest:Math.round(interest),companyProfit:Math.round(companyProfit),companyCash:Math.round(e.g.companyCash),companyDebt:Math.round(e.g.companyDebt),cumulativeOperatingCashFlow:Math.round(cumulativeOperatingCashFlow)};
  }
  assert.equal(e.g.personalCash,personal,'digital portfolio never touches personal cash');return{snapshots,paybackWeek,initialInvestment:Math.round(initialInvestment)};
}

const appOnly=simulate(['app']),two=simulate(['app','media'],{departments:['marketing','dx']}),three=simulate(['app','media','ai'],{departments:['marketing','dx']});
const pairs={media:two,game:simulate(['app','game'],{departments:['marketing','dx']}),ec:simulate(['app','ec'],{departments:['marketing','dx']}),ai:simulate(['app','ai'],{departments:['marketing','dx']})};
assert.ok(two.snapshots[208].companyProfit>0&&two.snapshots[208].companyCash>0,'a successful two-product company reaches full-company break-even within four years and survives');
assert.ok(three.snapshots[104].companyProfit>two.snapshots[104].companyProfit,'the third product makes shared organization economics accretive');
assert.ok(three.snapshots[208].companyCash>0&&three.snapshots[208].productCount===3,'three-product portfolio survives 208 weeks');
for(const result of Object.values(pairs))assert.ok(result.snapshots[208].companyCash>0,'every required two-product blueprint combination has runway');
assert.deepEqual(simulate(['app','media'],{departments:['marketing','dx']}),two,'portfolio simulation is deterministic');
const financeLoaded=loadGame({random:makeRandom(),headless:true}),financeEngine=new financeLoaded.engineModule.TycoonEngine();financeEngine.g.configured=true;financeEngine.g.companyCash=20_000_000;financeEngine.g.finance=financeLoaded.modules.finance.defaultFinanceState(financeEngine.g);assert.equal(financeEngine.foundDigitalBusiness('app'),true);assert.equal(financeLoaded.modules.finance.validate(financeEngine.g).ok,true,'production launch journal validates without double counting');
assert.equal(loadedVersion(),9);assert.equal(loadedKey(),'capitalism_tycoon_web_v1');

function loadedVersion(){return loadGame({random:makeRandom(),headless:true}).engineModule.SAVE_VERSION;}
function loadedKey(){return loadGame({random:makeRandom(),headless:true}).engineModule.SAVE_KEY;}
console.log(JSON.stringify({appOnly,twoProduct:two,threeProduct:three,blueprintPairs:Object.fromEntries(Object.entries(pairs).map(([id,result])=>[id,result.snapshots[208]]))},null,2));
console.log('digital portfolio profitability checks passed');
