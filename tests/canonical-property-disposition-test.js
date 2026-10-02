const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const x=loadGame({headless:true});
const {finance,realEstatePropertyDisposals:disposals,realEstateCompleteCycle:cycle,simulationRng}=x.modules;
function make(owner='company',cash=40_000_000){
  const e=new x.engineModule.TycoonEngine();e.g.configured=true;e.g.week=20;e.g.companyCash=owner==='company'?cash:90_000_000;e.g.personalCash=owner==='personal'?cash:50_000_000;e.g.companyDebt=0;e.g.personalDebt=0;e.g.properties=[{id:`GF3-020-${owner}`,name:'Canonical Tower',owner,value:100_000_000,marketValue:100_000_000,purchasePrice:80_000_000,realEstate:{landBookValue:30_000_000,buildingBookValue:40_000_000,monthlyRent:2_000_000,occupancyRate:1,expenseRatio:.2}}];e.g.finance=finance.defaultFinanceState(e.g);cycle.ensure(e.g);return e;
}
{
 const e=make(),before=e.g.companyCash,row=e.settlePropertyDisposition({propertyID:'GF3-020-company',grossSalePrice:90_000_000,fees:2_000_000,idempotencyKey:'gf3-020-unlevered'});assert(row);assert.equal(row.bookBasis,70_000_000);assert.equal(row.gain,18_000_000);assert.equal(e.g.companyCash-before,88_000_000);assert.equal(e.g.properties.length,0);assert.equal(finance.buildStatements(e.g,'52').balanceSheet.assets.buildingsAndLand,0);const count=e.g.finance.transactions.length;assert.deepEqual(e.settlePropertyDisposition({propertyID:'GF3-020-company',grossSalePrice:90_000_000,fees:2_000_000,idempotencyKey:'gf3-020-unlevered'}),row);assert.equal(e.g.finance.transactions.length,count);assert(finance.validate(e.g).ok,finance.validate(e.g).errors.join(' | '));
}
{
 const e=make('personal'),cc=e.g.companyCash,ledger=e.g.finance.transactions.length,pc=e.g.personalCash,row=e.settlePropertyDisposition({propertyID:'GF3-020-personal',grossSalePrice:75_000_000,fees:1_000_000,idempotencyKey:'gf3-020-personal'});assert(row);assert.equal(e.g.personalCash-pc,74_000_000);assert.equal(e.g.companyCash,cc);assert.equal(e.g.finance.transactions.length,ledger);
}
{
 const e=make(),loan=cycle.borrow(e.g,'GF3-020-company',30_000_000,{rateType:'fixed'}),before=e.g.companyCash,row=e.settlePropertyDisposition({propertyID:'GF3-020-company',grossSalePrice:80_000_000,fees:1_000_000,idempotencyKey:'gf3-020-levered'});assert(loan&&row);assert.equal(e.g.companyCash-before,49_000_000);assert.equal(e.g.companyDebt,0);assert.equal(loan.status,'paid');assert.equal(e.g.finance.loans.find(l=>l.loanID===loan.id).status,'repaid');assert(finance.validate(e.g).ok,finance.validate(e.g).errors.join(' | '));
}
{
 const e=make('company',20_000_000),loan=cycle.borrow(e.g,'GF3-020-company',50_000_000,{rateType:'fixed'});e.g.companyCash=20_000_000;const before=e.g.companyCash,row=e.settlePropertyDisposition({propertyID:'GF3-020-company',grossSalePrice:35_000_000,fees:1_000_000,idempotencyKey:'gf3-020-funded'});assert(row);assert.equal(e.g.companyCash-before,-16_000_000);assert.equal(loan.status,'paid');
}
{
 const e=make('company',1_000_000),loan=cycle.borrow(e.g,'GF3-020-company',50_000_000,{rateType:'fixed'});e.g.companyCash=1_000_000;const rng=JSON.stringify(e.g.simulationRng),before=JSON.stringify(e.g),result=e.settlePropertyDisposition({propertyID:'GF3-020-company',grossSalePrice:35_000_000,fees:1_000_000,idempotencyKey:'gf3-020-reject'});assert.equal(result,false);assert.equal(JSON.stringify(e.g),before);assert.equal(JSON.stringify(e.g.simulationRng),rng);assert.equal(loan.status,'active');
}
{
 const e=make(),q=e.listPropertyForDisposal('GF3-020-company','quick');e.g.week=q.delayWeeks+20;const row=disposals.processWeek(e)[0];assert(row&&row.methodID==='quick');const saved=JSON.parse(JSON.stringify(e.g));assert.equal(saved.properties.length,0);assert.equal(disposals.ensure(saved).propertyDisposalHistory.filter(r=>r.type==='property-disposed').length,1);
}
{
 const e=make(),before=JSON.stringify(e.g),real=finance.event;finance.event=()=>{throw new Error('injected disposition post failure');};assert.throws(()=>e.settlePropertyDisposition({propertyID:'GF3-020-company',grossSalePrice:90_000_000,fees:1,idempotencyKey:'gf3-020-fail'}),/injected/);finance.event=real;assert.equal(JSON.stringify(e.g),before);
}
{
 const e=make();delete e.g.properties[0].realEstate;const before=JSON.stringify(e.g);assert.throws(()=>e.settlePropertyDisposition({propertyID:'GF3-020-company',grossSalePrice:90_000_000,idempotencyKey:'gf3-020-legacy'}),/canonical land\/building/);assert.equal(JSON.stringify(e.g),before);
}
assert(!require('node:fs').readFileSync('js/real-estate-property-disposals.js','utf8').includes('Math.random'));
console.log('canonical property disposition GF3-020: ok');
