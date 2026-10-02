const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadGame}=require('./harness');
const ROOT=path.join(__dirname,'..');
function load(){const x=loadGame({headless:true,isolatedLegacyIndex:true});for(const f of ['real-estate-development.js','real-estate-insurance-claims.js','real-estate-insurance-risk.js','real-estate-risk-mitigation.js','real-estate-safety-certification.js','real-estate-tenant-contracts.js','real-estate-tenant-leasing.js','real-estate-tenant-operations.js','real-estate-tenant-renewals.js','real-estate-tenant-collections.js','real-estate-rent-guarantee.js','real-estate-security-deposits.js','real-estate-property-insurance.js','real-estate-maintenance-reserves.js','real-estate-property-taxes.js','real-estate-mortgage-refinancing.js','real-estate-property-disposals.js','real-estate-redevelopment-projects.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,'js',f),'utf8'),x.ctx,{filename:f});return x;}
function setup(owner='company'){const x=load(),e=new x.engineModule.TycoonEngine(),p=e.g.properties.find(p=>!p.owner);e.g.configured=true;e.g.companyCash=2e9;e.g.personalCash=2e9;e.g.companyDebt=0;p.owner=owner;p.purchasePrice=p.price||p.value;p.bookValue=p.purchasePrice;p.buildingType='賃貸マンション';x.modules.realEstate.ensure(e.g);e.setPropertyMarketSegment(p.id,'urban_core','apartment');e.g.finance=x.modules.finance.defaultFinanceState(e.g);return{...x,e,p};}
function bs(x){return x.modules.finance.buildStatements(x.e.g,'52').balanceSheet;}
function finishDevelopment(x,id){const project=x.e.g.realEstateDevelopment.projects.find(p=>p.projectID===id);while(project.status==='active'||project.status==='paused'){x.e.g.week++;x.modules.realEstateDevelopment.processWeek(x.e);}return project;}
for(const kind of ['renovation','development']){const x=setup(),beforeCash=x.e.g.companyCash,beforeBook=x.p.realEstate.buildingBookValue,beforeMarket=x.p.realEstate.buildingValue,profit=x.modules.finance.buildStatements(x.e.g,'52').profitAndLoss.netIncome,id=x.e.startPropertyDevelopment(x.p.id,kind,{totalCost:8e6,durationWeeks:4}),project=x.e.g.realEstateDevelopment.projects.find(p=>p.projectID===id);assert.equal(beforeCash-x.e.g.companyCash,project.paidCost);assert.equal(x.modules.finance.cipBook(x.e.g),project.paidCost);assert.equal(x.modules.finance.buildStatements(x.e.g,'52').profitAndLoss.netIncome,profit);assert.equal(bs(x).balanceDifference,0);assert.equal(x.modules.finance.validate(x.e.g).ok,true,x.modules.finance.validate(x.e.g).errors.join(' | '));const done=finishDevelopment(x,id);assert.equal(done.paidCost,8e6);assert.equal(x.modules.finance.cipBook(x.e.g),0);assert.equal(x.p.realEstate.buildingBookValue-beforeBook,8e6);assert.equal(x.p.realEstate.buildingValue-beforeMarket,8e6*(kind==='development'?.92:.7));assert.equal(bs(x).balanceDifference,0);}
{
 const x=setup(),id=x.e.startPropertyDevelopment(x.p.id,'renovation',{totalCost:8e6}),paid=x.modules.finance.cipBook(x.e.g),profit=x.modules.finance.buildStatements(x.e.g,'52').profitAndLoss.netIncome;assert.equal(x.e.cancelPropertyDevelopment(id),true);assert.equal(x.modules.finance.cipBook(x.e.g),0);assert.equal(x.modules.finance.buildStatements(x.e.g,'52').profitAndLoss.netIncome,profit-paid);assert.equal(x.modules.finance.validate(x.e.g).ok,true,x.modules.finance.validate(x.e.g).errors.join(' | '));assert.equal(x.e.cancelPropertyDevelopment(id),false);
}
{
 const x=setup(),id=x.e.startPropertyDevelopment(x.p.id,'renovation',{totalCost:8e6,durationWeeks:8}),project=x.e.g.realEstateDevelopment.projects.find(p=>p.projectID===id);x.e.g.companyCash=0;x.e.g.week++;x.modules.realEstateDevelopment.processWeek(x.e);assert.equal(project.status,'paused');assert.equal(x.modules.finance.cipBook(x.e.g),project.paidCost);
 const saved=JSON.parse(JSON.stringify(x.e.g)),restored=new x.engineModule.TycoonEngine(saved);x.modules.realEstateDevelopment.ensure(restored.g);assert.equal(x.modules.finance.cipBook(restored.g),project.paidCost,'save/load and legacy paidCost remain authoritative');
}
{
 const x=setup(),id=x.e.startPropertyDevelopment(x.p.id,'renovation',{totalCost:8e6}),project=x.e.g.realEstateDevelopment.projects.find(p=>p.projectID===id),paid=project.paidCost;x.e.g.properties=x.e.g.properties.filter(p=>p.id!==x.p.id);x.e.g.week++;x.modules.realEstateDevelopment.processWeek(x.e);assert.equal(project.status,'cancelled');assert.equal(x.modules.finance.cipBook(x.e.g),0);assert.equal(x.e.g.finance.transactions.filter(t=>t.idempotencyKey===`property-development-missing-property-${id}`).length,1);x.e.g.week++;x.modules.realEstateDevelopment.processWeek(x.e);assert.equal(x.e.g.finance.transactions.filter(t=>t.sourceID===id&&t.assetEffect===-paid).length,1);
}
{
 const x=setup(),id=x.e.startPropertyDevelopment(x.p.id,'development',{totalCost:8e6}),project=x.e.g.realEstateDevelopment.projects.find(p=>p.projectID===id),paid=project.paidCost,cash=x.e.g.companyCash;assert(x.e.sellProperty(x.p.id));assert.equal(project.status,'cancelled');assert.equal(project.cipDisposition,'sold');assert.equal(x.modules.finance.cipBook(x.e.g),0);x.e.buyProperty(x.p.id,'personal');x.e.g.week++;x.modules.realEstateDevelopment.processWeek(x.e);assert.equal(x.e.g.companyCash,cash+x.p.value*.97,'former company project paid after personal repurchase');assert.equal(x.e.g.finance.transactions.filter(t=>t.sourceType==='property-development-sale-disposal'&&t.assetEffect===-paid).length,1);
}
{
 const x=setup('personal'),companyCash=x.e.g.companyCash,ledger=x.e.g.finance.transactions.length,assets=bs(x).assets.totalAssets,id=x.e.startPropertyDevelopment(x.p.id,'renovation',{totalCost:8e6});x.e.g.week++;x.modules.realEstateDevelopment.processWeek(x.e);assert(id);assert.equal(x.e.g.companyCash,companyCash);assert.equal(x.e.g.finance.transactions.length,ledger);assert.equal(x.modules.finance.cipBook(x.e.g),0);assert.equal(bs(x).assets.totalAssets,assets);
}
{
 const x=setup();x.p.redevelopmentProjectID='refresh';x.p.redevelopmentCost=123456;x.p.redevelopmentOwner='';assert.equal(x.modules.finance.cipBook(x.e.g),123456,'legacy redevelopment cost remains authoritative');
}
for(const type of ['refresh','conversion','rebuild']){const x=setup(),before=x.p.realEstate.buildingBookValue,quote=x.e.startPropertyRedevelopment(x.p.id,type);assert(quote);assert.equal(x.modules.finance.cipBook(x.e.g),quote.cost);assert.equal(x.e.g.finance.transactions.at(-1).category,'capitalExpenditure');x.e.g.week=x.p.redevelopmentCompleteWeek;x.modules.realEstateRedevelopmentProjects.processWeek(x.e);assert.equal(x.modules.finance.cipBook(x.e.g),0);assert.equal(x.p.realEstate.buildingBookValue-before,quote.cost);assert.equal(bs(x).balanceDifference,0);}
{
 const x=setup(),quote=x.e.startPropertyRedevelopment(x.p.id,'refresh'),profit=x.modules.finance.buildStatements(x.e.g,'52').profitAndLoss.netIncome;assert.equal(x.e.cancelPropertyRedevelopment(x.p.id),true);assert.equal(x.modules.finance.cipBook(x.e.g),0);assert.equal(x.modules.finance.buildStatements(x.e.g,'52').profitAndLoss.netIncome,profit-quote.cost);assert.equal(bs(x).balanceDifference,0);assert.equal(x.e.cancelPropertyRedevelopment(x.p.id),false);
}
{
 const x=setup('personal'),cash=x.e.g.companyCash,ledger=x.e.g.finance.transactions.length;x.e.startPropertyRedevelopment(x.p.id,'refresh');assert.equal(x.modules.finance.cipBook(x.e.g),0);x.e.cancelPropertyRedevelopment(x.p.id);assert.equal(x.e.g.companyCash,cash);assert.equal(x.e.g.finance.transactions.length,ledger);
}
{
 const x=setup(),draws=x.e.g.simulationRng?.drawCount??0;x.e.startPropertyDevelopment(x.p.id,'renovation',{totalCost:8e6});assert.equal(x.e.g.simulationRng?.drawCount??0,draws);x.e.sellProperty(x.p.id);assert.equal(x.e.g.simulationRng?.drawCount??0,draws);
}
const save=fs.readFileSync(path.join(ROOT,'js/save-v9.js'),'utf8');assert.equal(load().modules.engine.SAVE_KEY,'capitalism_tycoon_web_v1');assert.equal(load().modules.engine.SAVE_VERSION,9);assert.match(save,/SAVE_VERSION\s*=\s*9/);
console.log('real-estate construction in progress accounting: ok');
