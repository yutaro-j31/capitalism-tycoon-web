'use strict';

const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

const SEED=638;
let seed=SEED;
const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
const loaded=loadGame({random,headless:true});
const {engineModule,modules}=loaded;

function financeOK(engine,label){
  const result=modules.finance.validate(engine.g);
  assert.equal(result.ok,true,`${label}: ${result.errors.join(' / ')}`);
}
function maintenanceFor(engine,productID){
  return engine.g.finance.transactions.filter(row=>row.week===engine.g.week&&row.sourceType==='productMaintenance'&&row.sourceID===productID).reduce((sum,row)=>sum+Math.abs(Number(row.cashEffect)||0),0);
}
function run(strategy){
  seed=SEED;
  const engine=new engineModule.TycoonEngine();
  engine.configure({playerName:'現実派創業者',companyName:'現実IT',difficulty:'normal',scenario:'free'});
  assert.equal(engine.g.companyCash,8_000_000,'normal fresh companyのcanonical初期会社資金');
  const initialCash=engine.g.companyCash;
  assert.equal(engine.foundDigitalBusiness('app'),true);
  const launchedCash=engine.g.companyCash;
  assert.equal(launchedCash,1_500_000,'app初期開発費は実会社現金から支払う');
  financeOK(engine,`${strategy} launch`);

  let borrowing=0,qualityInvestment=0,marketingInvestment=0,developmentBurn=0,cumulativeContribution=0;
  let operatingBreakEvenWeek=null,companyContributionBreakEvenWeek=null,investmentPaybackWeek=null;
  let hqReached=false,productDepartmentReached=false,secondProductReached=false,exitProceeds=0;
  const snapshots={};
  if(strategy==='borrow-and-grow'||strategy==='scale-up'){
    const requested=2_000_000;
    assert.ok(engine.companyCreditLimit()-engine.g.companyDebt>=requested,'player-visible company credit supports the requested loan');
    assert.equal(engine.borrow(requested,'company'),true,'production company borrowing action');
    borrowing=requested;
  }

  for(let elapsed=1;elapsed<=104;elapsed++){
    let app=engine.g.productVentures.find(product=>product.blueprintID==='app');
    if(app?.status==='released'){
      const releaseAge=engine.g.week-app.releaseWeek;
      const invest=(kind,amount)=>{
        assert.ok(engine.g.companyCash>=amount+500_000,`${strategy} ${kind} investment must preserve its cash buffer`);
        assert.equal(engine.productAction(app.id,kind,amount),true);
        if(kind==='quality')qualityInvestment+=amount;else marketingInvestment+=amount;
      };
      if(strategy==='conservative'){
        if(releaseAge===0)invest('quality',250_000);
        if(releaseAge===13)invest('marketing',250_000);
      }
      if(strategy==='borrow-and-grow'||strategy==='scale-up'){
        if(releaseAge===0){invest('quality',500_000);invest('marketing',500_000);}
        if(releaseAge===26){invest('quality',500_000);invest('marketing',500_000);}
      }
    }

    // The scale route uses the existing product exit, office contract, department, and launch
    // actions. No test-only cash is introduced: the first app's sale funds the organization and
    // second product after its operating model has proven itself.
    if(strategy==='scale-up'&&elapsed===70&&app?.status==='released'){
      const value=app.valuation;
      assert.equal(engine.sellProduct(app.id),true);exitProceeds=value;
      const office=engine.g.rentalOffices.filter(row=>row.capacity>=8).sort((a,b)=>a.deposit-b.deposit)[0];
      assert.ok(office&&engine.g.companyCash>=office.deposit,'exit proceeds make a real HQ affordable');
      assert.equal(engine.contractOffice(office.id),true);hqReached=true;
      assert.ok(engine.g.companyCash>=1_800_000);assert.equal(engine.establishDepartment('product'),true);productDepartmentReached=true;
      assert.ok(engine.g.companyCash>=8_000_000);assert.equal(engine.launchProduct('media'),true);secondProductReached=true;
    }

    const beforeWeekCash=engine.g.companyCash;
    assert.equal(engine.advanceWeek(false),true,`${strategy} survives elapsed week ${elapsed}`);
    app=engine.g.productVentures.find(product=>product.blueprintID==='app');
    if(app?.status==='developing')developmentBurn+=Math.max(0,-Number(engine.g.lastReport?.profit||0));
    const maintenance=app?maintenanceFor(engine,app.id):0;
    if(app?.status==='released'){
      const contribution=app.profit-maintenance;cumulativeContribution+=contribution;
      if(operatingBreakEvenWeek===null&&app.profit>=0)operatingBreakEvenWeek=elapsed;
      if(companyContributionBreakEvenWeek===null&&contribution>=0)companyContributionBreakEvenWeek=elapsed;
      if(investmentPaybackWeek===null&&cumulativeContribution>=6_500_000+qualityInvestment+marketingInvestment)investmentPaybackWeek=elapsed;
    }
    assert.ok(Number.isFinite(beforeWeekCash)&&Number.isFinite(engine.g.companyCash));
    assert.equal(engine.g.gameOver,false,`${strategy} must not go bankrupt by week ${elapsed}`);
    if([26,52,104].includes(elapsed)){
      const product=app||engine.g.productVentures[0];
      snapshots[elapsed]={
        companyCash:Math.round(engine.g.companyCash),companyDebt:Math.round(engine.g.companyDebt),availableCredit:Math.round(Math.max(0,engine.companyCreditLimit()-engine.g.companyDebt)),
        users:Math.round(product?.users||0),paidUsers:Math.round(product?.paidUsers||0),weeklyRevenue:Math.round(product?.revenue||0),productOperatingCost:Math.round(product?.cost||0),productProfit:Math.round(product?.profit||0),
        lifecycleMaintenance:Math.round(maintenance),departmentPayroll:Math.round(modules.workforce.weeklyPayroll(engine.g)),officeCost:Math.round(engine.g.hasHeadOffice?engine.g.officeWeeklyCost:0),companyWeeklyProfit:Math.round(engine.g.lastReport?.profit||0),
        qualityInvestment,marketingInvestment,totalProductInvestedCost:Math.round(product?.investedCost||0),valuation:Math.round(product?.valuation||0),gameOver:engine.g.gameOver,hq:engine.g.hasHeadOffice,productCount:engine.g.productVentures.length
      };
      financeOK(engine,`${strategy} week ${elapsed}`);
    }
  }
  assert.ok(developmentBurn>0,`${strategy} observes real development burn`);
  return{strategy,initialCash,launchedCash,borrowing,developmentBurn:Math.round(developmentBurn),qualityInvestment,marketingInvestment,operatingBreakEvenWeek,companyContributionBreakEvenWeek,investmentPaybackWeek,cumulativeContribution:Math.round(cumulativeContribution),exitProceeds:Math.round(exitProceeds),hqReached,productDepartmentReached,secondProductReached,snapshots};
}

const idle=run('idle'),conservative=run('conservative'),borrowAndGrow=run('borrow-and-grow'),scaleUp=run('scale-up');
for(const result of[idle,conservative,borrowAndGrow,scaleUp])for(const week of[26,52,104])assert.equal(result.snapshots[week].gameOver,false);
assert.equal(idle.borrowing,0);assert.equal(conservative.borrowing,0);assert.equal(borrowAndGrow.borrowing,2_000_000);
assert.ok(borrowAndGrow.companyContributionBreakEvenWeek<=52,'借入成長routeはactual maintenance込みで52週以内に週次黒字化');
assert.equal(borrowAndGrow.investmentPaybackWeek,null,'週次黒字化と初期投資回収を混同しない（104週時点は未回収）');
assert.ok(scaleUp.exitProceeds>0&&scaleUp.hqReached&&scaleUp.productDepartmentReached&&scaleUp.secondProductReached,'成功appのEXITでHQ・商品開発部・second productへ到達');
assert.deepEqual(run('borrow-and-grow'),borrowAndGrow,'同じseedとplayer actionsは26/52/104週を含め完全に決定論的');

// Actual lifecycle policy expense is max(blueprint maintenance floor, revenue * policy rate),
// is paid once, and reaches the company report once without duplicating the finance journal.
const policyEngine=new engineModule.TycoonEngine();policyEngine.configure({playerName:'保守',companyName:'保守IT',difficulty:'normal',scenario:'free'});assert(policyEngine.foundDigitalBusiness('app'));
while(policyEngine.g.productVentures[0].status!=='released')assert(policyEngine.advanceWeek(false));
for(const policyID of['lean','standard','intensive']){
  const product=policyEngine.g.productVentures[0];assert(policyEngine.setProductMaintenancePolicy(product.id,policyID));assert(policyEngine.advanceWeek(false));
  const expected=Math.round(Math.max(modules.data.DIGITAL_PRODUCT_ECONOMICS.app.maintenanceFloor,product.revenue*modules.productLifecycle.POLICIES[policyID].costRate));
  const actual=maintenanceFor(policyEngine,product.id);assert.equal(actual,expected,`${policyID} actual lifecycle cost`);assert.equal(policyEngine.g.lastReport.productLifecycleMaintenance,actual);assert.equal(policyEngine.g.finance.transactions.filter(row=>row.week===policyEngine.g.week&&row.sourceType==='productMaintenance'&&row.sourceID===product.id).length,1);financeOK(policyEngine,`${policyID} maintenance`);
}

// Migration policy B: only the canonical legacy AI default (price and ARPU both 4,800 yen) is
// upgraded to 24,000 yen. A deliberately customized positive legacy ARPU is preserved.
function legacyAI(arpu){const engine=new engineModule.TycoonEngine(),product={id:`legacy-ai-${arpu}`,blueprintID:'ai',name:'旧AI',category:'AI',status:'released',quality:20,brand:5,users:100,paidUsers:5,price:4800,serverCost:520000,market:140000,risk:.24,valuation:18e6,revenue:0,cost:0,profit:0};engine.g.productVentures.push(product);engine.g.productFunnels[product.id]={productID:product.id,awareness:.03,registeredUsers:100,monthlyActiveUsers:55,paidUsers:5,conversionRate:.025,churnRate:.08,arpu,serverLoad:0,supportBurden:.1,b2bContracts:0,lastUpdatedWeek:1};const funnel=engine.ensureProductFunnel(product);return{product,funnel};}
const canonicalAI=legacyAI(4800);assert.equal(canonicalAI.product.price,24000);assert.equal(canonicalAI.funnel.arpu,24000);assert.equal(canonicalAI.product.economicsVersion,1);
const customAI=legacyAI(7200);assert.equal(customAI.product.price,4800);assert.equal(customAI.funnel.arpu,7200);assert.equal(customAI.product.economicsVersion,1);
assert.equal(engineModule.SAVE_KEY,'capitalism_tycoon_web_v1');assert.equal(engineModule.SAVE_VERSION,9);

console.log(JSON.stringify({idle,conservative,borrowAndGrow,scaleUp},null,2));
console.log('digital product realistic playability checks passed');
