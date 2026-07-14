const { loadGame } = require('./harness');
const { engineModule, modules } = loadGame({ random: (()=>{let x=1; return ()=>((x=(x*16807)%2147483647)/2147483647);})() });
const { TycoonEngine } = engineModule;
const finance = modules.finance;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
function scenario(){const e=new TycoonEngine(); e.g.configured=true;const opening=e.g.companyCash;e.borrow(1000000,'company');finance.addFixedAsset(e.g,{assetID:'asset-1',acquisitionCost:520000,usefulLifeWeeks:52,salvageValue:0});finance.event(e.g,'capitalExpenditure',520000,{cashEffect:-520000,assetEffect:520000,sourceType:'test',sourceID:'capex',operationID:'capex-1'});e.g.companyCash-=520000;const operating=100000-30000-10000-20000-5000-1000-2000;e.g.companyCash+=operating;finance.recordWeekly(e.g,{beginningCash:opening,stores:[{storeID:'s1',businessID:'ramen',name:'店',sales:100000,variable:30000,rent:10000,wage:20000,repair:5000}],other:{interest:-1000,taxExpense:-2000,taxPayment:-2000}});return e;}
const e=scenario(), st=finance.buildStatements(e.g,'52');
assert(st.profitAndLoss.ebitda===35000,'EBITDA calculation');
assert(st.profitAndLoss.depreciation===10000,'depreciation recorded');
assert(st.profitAndLoss.operatingIncome===25000,'operating income');
assert(st.balanceSheet.assets.cashAndDeposits===e.g.companyCash,'cash equals BS cash');
assert(Math.abs(st.cashFlow.openingCash+st.cashFlow.netCashChange-st.cashFlow.endingCash)<0.1,'CF identity');
assert(finance.validate(e.g).ok, e.g.finance.lastValidation?.errors?.join('\n'));
console.log('financial statement checks passed');
module.exports={scenario};
