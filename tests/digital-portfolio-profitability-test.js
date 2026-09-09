'use strict';

const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

const SEED=639208;
const CHECKPOINTS=new Set([26,52,78,104,156,208]);
const makeRandom=()=>{let seed=SEED;return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);};

function financeOK(modules,engine,label){
  const result=modules.finance.validate(engine.g);
  assert.equal(result.ok,true,`${label}: ${(result.errors||[]).join(' / ')}`);
}
function weeklyMaintenance(engine){
  return (engine.g.finance?.transactions||[])
    .filter(row=>row.week===engine.g.week&&row.sourceType==='productMaintenance')
    .reduce((sum,row)=>sum+Math.abs(Number(row.cashEffect)||0),0);
}
function availableCredit(engine){
  return Math.max(0,engine.companyCreditLimit()-engine.g.companyDebt);
}
function borrowFor(engine,requiredCash,result,label){
  const need=Math.max(0,Math.ceil(requiredCash-engine.g.companyCash));
  if(!need)return true;
  const capacity=Math.floor(availableCredit(engine));
  if(capacity<need)return false;
  assert.equal(engine.borrow(need,'company'),true,`${label}: production borrowing`);
  result.borrowing+=need;
  return true;
}
function topUpRunway(engine,result){
  if(engine.g.companyCash>=750_000)return false;
  const capacity=Math.floor(availableCredit(engine));
  const amount=Math.min(2_000_000,capacity);
  if(amount<250_000)return false;
  assert.equal(engine.borrow(amount,'company'),true,'production runway borrowing');
  result.borrowing+=amount;
  result.runwayBorrowCount++;
  return true;
}
function investIfAffordable(engine,product,kind,amount,result,buffer){
  if(!product||product.status!=='released'||engine.g.companyCash<amount+buffer)return false;
  assert.equal(engine.productAction(product.id,kind,amount),true,`${kind} production investment`);
  result[kind==='quality'?'qualityInvestment':'marketingInvestment']+=amount;
  return true;
}
function productOperatingProfit(engine){
  return engine.g.productVentures
    .filter(row=>row.status==='released'&&row.status!=='sold')
    .reduce((sum,row)=>sum+(Number(row.profit)||0),0);
}
function snapshot(engine,modules,result){
  const products=engine.g.productVentures.filter(row=>row.status!=='sold');
  const released=products.filter(row=>row.status==='released');
  const maintenance=weeklyMaintenance(engine);
  return {
    week:engine.g.week,
    companyCash:Math.round(engine.g.companyCash),
    companyDebt:Math.round(engine.g.companyDebt),
    availableCredit:Math.round(availableCredit(engine)),
    companyWeeklyProfit:Math.round(Number(engine.g.lastReport?.profit)||0),
    sales:Math.round(Number(engine.g.lastReport?.sales)||0),
    expenses:Math.round(Number(engine.g.lastReport?.expenses)||0),
    productCount:products.length,
    releasedProducts:released.length,
    users:Math.round(released.reduce((sum,row)=>sum+(Number(row.users)||0),0)),
    paidUsers:Math.round(released.reduce((sum,row)=>sum+(Number(row.paidUsers)||0),0)),
    productRevenue:Math.round(released.reduce((sum,row)=>sum+(Number(row.revenue)||0),0)),
    productProfit:Math.round(released.reduce((sum,row)=>sum+(Number(row.profit)||0),0)),
    lifecycleMaintenance:Math.round(maintenance),
    departmentPayroll:Math.round(modules.workforce.weeklyPayroll(engine.g)),
    officeCost:Math.round(engine.g.hasHeadOffice?engine.g.officeWeeklyCost:0),
    valuation:Math.round(released.reduce((sum,row)=>sum+(Number(row.valuation)||0),0)),
    hq:engine.g.hasHeadOffice,
    departments:Object.keys(engine.g.departments||{}).sort(),
    gameOver:engine.g.gameOver,
    gameOverReason:engine.g.gameOverReason||'',
    borrowing:Math.round(result.borrowing),
    equityFunding:Math.round(result.equityFunding),
    equityRefreshCount:result.equityRefreshCount,
    runwayBorrowCount:result.runwayBorrowCount
  };
}

function run(strategy,maxWeeks=208){
  const loaded=loadGame({random:makeRandom(),headless:true});
  const {engineModule,modules}=loaded;
  const engine=new engineModule.TycoonEngine();
  engine.configure({playerName:'ポートフォリオ創業者',companyName:'Portfolio IT',difficulty:'normal',scenario:'free'});
  assert.equal(engine.g.companyCash,8_000_000,'canonical normal start');
  assert.equal(engineModule.SAVE_KEY,'capitalism_tycoon_web_v1');
  assert.equal(engineModule.SAVE_VERSION,9);
  const personalCash=engine.g.personalCash;
  const result={
    strategy,initialCash:engine.g.companyCash,borrowing:0,equityFunding:0,equityRefreshCount:0,runwayBorrowCount:0,qualityInvestment:0,marketingInvestment:0,
    exitProceeds:0,hqWeek:null,secondProductWeek:null,marketingDepartmentWeek:null,dxDepartmentWeek:null,
    fullCompanyBreakEvenWeek:null,investmentPaybackWeek:null,cumulativeOperatingProfit:0,
    committedInvestment:6_500_000,snapshots:{}
  };

  assert.equal(engine.foundDigitalBusiness('app'),true);
  assert.equal(engine.g.companyCash,1_500_000);
  assert.equal(engine.g.personalCash,personalCash,'digital founding does not touch personal cash');
  financeOK(modules,engine,'launch');

  const initialLoan=2_000_000;
  assert.ok(availableCredit(engine)>=initialLoan,'fresh digital company has player-accessible credit');
  assert.equal(engine.borrow(initialLoan,'company'),true);
  assert.equal(engine.g.personalCash,personalCash,'company borrowing does not touch personal cash');
  result.borrowing+=initialLoan;

  let positiveStreak=0;
  let lastOfferRefreshWeek=-999;

  for(let elapsed=1;elapsed<=maxWeeks;elapsed++){
    let app=engine.g.productVentures.find(row=>row.blueprintID==='app'&&row.status!=='sold');
    let media=engine.g.productVentures.find(row=>row.blueprintID==='media'&&row.status!=='sold');

    if(app?.status==='released'){
      const age=engine.g.week-app.releaseWeek;
      if(age===0||age===26){
        investIfAffordable(engine,app,'quality',500_000,result,600_000);
        investIfAffordable(engine,app,'marketing',500_000,result,600_000);
      }
    }

    if(strategy==='exit'&&elapsed===70&&app?.status==='released'){
      result.exitProceeds=Math.round(app.valuation);
      assert.equal(engine.sellProduct(app.id),true,'direct product sale uses production action');
      app=null;
    }

    if(!engine.g.hasHeadOffice&&(strategy==='hold'||strategy==='exit')){
      const office=engine.g.rentalOffices.filter(row=>row.capacity>=24).sort((a,b)=>a.deposit-b.deposit)[0];
      assert.ok(office,'small HQ exists');
      const required=office.deposit+1_800_000+1_500_000;
      const canAttempt=strategy==='exit'?result.exitProceeds>0:elapsed>=52;
      if(canAttempt&&engine.g.companyCash+availableCredit(engine)>=required&&borrowFor(engine,required,result,'HQ')){
        assert.equal(engine.contractOffice(office.id),true,'production HQ contract');
        assert.equal(engine.establishDepartment('product'),true,'production product department');
        result.committedInvestment+=1_800_000;
        result.hqWeek=elapsed;
        financeOK(modules,engine,`HQ week ${elapsed}`);
      }
    }

    // Equity is a real player-accessible scale-up tool once HQ exists. Limit the diagnostic
    // to at most two fundraising rounds so survival cannot come from repeatedly refreshing
    // offers forever; dilution remains the trade-off for retaining the first product.
    if(strategy==='hold'&&engine.g.hasHeadOffice&&result.equityRefreshCount<2&&engine.g.week-lastOfferRefreshWeek>=13){
      const needsGrowthCapital=!media&&engine.g.companyCash<11_000_000;
      const needsRunway=!!media&&engine.g.companyCash<1_500_000;
      if(needsGrowthCapital||needsRunway){
        assert.equal(engine.refreshInvestorOffers(),true,'production investor offer refresh');
        result.equityRefreshCount++;
        lastOfferRefreshWeek=engine.g.week;
        for(const offer of engine.g.investorOffers.filter(row=>row.status==='pending'&&engine.g.week<=row.expiresWeek)){
          const before=engine.g.companyCash;
          assert.equal(engine.acceptInvestorOffer(offer.id),true,'production equity funding');
          result.equityFunding+=engine.g.companyCash-before;
          if((!media&&engine.g.companyCash>=11_000_000)||(media&&engine.g.companyCash>=3_000_000))break;
        }
        financeOK(modules,engine,`equity week ${elapsed}`);
      }
    }

    if(engine.g.hasHeadOffice&&!media){
      const required=10_000_000;
      if(engine.g.companyCash+availableCredit(engine)>=required&&borrowFor(engine,required,result,'second product')){
        assert.equal(engine.launchProduct('media'),true,'production second product launch');
        result.committedInvestment+=8_000_000;
        result.secondProductWeek=elapsed;
        media=engine.g.productVentures.find(row=>row.blueprintID==='media'&&row.status!=='sold');
        financeOK(modules,engine,`second product week ${elapsed}`);
      }
    }

    if(media?.status==='released'){
      const age=engine.g.week-media.releaseWeek;
      if(age===0||age===26){
        investIfAffordable(engine,media,'quality',250_000,result,1_500_000);
        investIfAffordable(engine,media,'marketing',250_000,result,1_500_000);
      }

      // Scale departments only after the products can economically carry the new recurring
      // payroll. This is the player decision #639 is intended to create: product department
      // unlocks product two, while marketing and DX are accretive later-stage capabilities.
      const operatingProfit=productOperatingProfit(engine);
      const currentPayroll=modules.workforce.weeklyPayroll(engine.g);
      const currentOffice=engine.g.hasHeadOffice?engine.g.officeWeeklyCost:0;
      if(!engine.g.departments.marketing){
        const postDepartmentFixed=currentPayroll+currentOffice+70_000;
        const supported=operatingProfit>=postDepartmentFixed+50_000;
        const required=1_600_000+1_500_000;
        if(supported&&engine.g.companyCash+availableCredit(engine)>=required&&borrowFor(engine,required,result,'marketing department')){
          assert.equal(engine.establishDepartment('marketing'),true);
          result.committedInvestment+=1_600_000;
          result.marketingDepartmentWeek=elapsed;
        }
      }else if(!engine.g.departments.dx){
        const postDepartmentFixed=currentPayroll+currentOffice+90_000;
        const supported=operatingProfit>=postDepartmentFixed+100_000;
        const required=2_200_000+1_500_000;
        if(supported&&engine.g.companyCash+availableCredit(engine)>=required&&borrowFor(engine,required,result,'DX department')){
          assert.equal(engine.establishDepartment('dx'),true);
          result.committedInvestment+=2_200_000;
          result.dxDepartmentWeek=elapsed;
        }
      }
    }

    topUpRunway(engine,result);
    assert.equal(engine.advanceWeek(false),true,`${strategy} survives elapsed week ${elapsed}`);
    assert.equal(engine.g.gameOver,false,`${strategy} game over at elapsed week ${elapsed}: ${JSON.stringify(snapshot(engine,modules,result))}`);
    assert.ok(Number.isFinite(engine.g.personalCash),'personal cash remains finite during unrelated personal-life processing');

    const reportProfit=Number(engine.g.lastReport?.profit)||0;
    result.cumulativeOperatingProfit+=reportProfit;
    const hasPortfolio=engine.g.productVentures.filter(row=>row.status!=='sold').length>=2;
    if(hasPortfolio&&reportProfit>=0)positiveStreak++;else positiveStreak=0;
    if(result.fullCompanyBreakEvenWeek===null&&positiveStreak>=4)result.fullCompanyBreakEvenWeek=elapsed-3;
    if(result.investmentPaybackWeek===null&&result.cumulativeOperatingProfit>=result.committedInvestment)result.investmentPaybackWeek=elapsed;

    if(CHECKPOINTS.has(elapsed)){
      result.snapshots[elapsed]=snapshot(engine,modules,result);
      financeOK(modules,engine,`${strategy} week ${elapsed}`);
    }
  }

  assert.ok(result.hqWeek!==null,`${strategy} reaches HQ`);
  assert.ok(result.secondProductWeek!==null,`${strategy} reaches a second product`);
  assert.ok(result.hqWeek<=208&&result.secondProductWeek<=208);
  assert.equal(engine.g.gameOver,false);
  assert.ok(Number.isFinite(engine.g.companyCash)&&Number.isFinite(engine.g.companyDebt));
  financeOK(modules,engine,`${strategy} final`);
  result.final=snapshot(engine,modules,result);
  return result;
}

const hold=run('hold');
const exit=run('exit');

assert.ok(hold.secondProductWeek<208,'hold route scales before the end of four years');
assert.equal(hold.exitProceeds,0,'hold route retains the first product');
assert.ok(hold.equityFunding>=0&&hold.borrowing>0,'hold route uses player-accessible financing only');
assert.ok(hold.equityRefreshCount<=2,'hold route does not rely on unlimited equity refreshes');
assert.ok(hold.final.productCount>=2&&hold.final.companyCash>0,'retained-product portfolio survives');
assert.ok(hold.fullCompanyBreakEvenWeek!==null&&hold.fullCompanyBreakEvenWeek<=208,`successful hold portfolio reaches sustained full-company break-even: ${JSON.stringify(hold)}`);
assert.ok(exit.exitProceeds>0,'exit route retains its short-term funding advantage');
assert.ok(exit.final.companyCash>0&&!exit.final.gameOver,'exit route remains viable');
assert.notEqual(hold.final.valuation,exit.final.valuation,'hold and exit preserve a real ownership/value trade-off');

// A short deterministic replay protects the production path without doubling the expensive 208-week test.
const replay=run('hold',78);
for(const week of[26,52,78])assert.deepEqual(replay.snapshots[week],hold.snapshots[week],`deterministic checkpoint ${week}`);
assert.equal(replay.hqWeek,hold.hqWeek);
if(hold.secondProductWeek<=78)assert.equal(replay.secondProductWeek,hold.secondProductWeek);

// Global department master changes are intentional and bounded; setup costs remain unchanged.
const data=loadGame({random:makeRandom(),headless:true}).modules.data;
const dept=id=>data.MASTER.departments.find(row=>row.id===id);
assert.equal(dept('product').setupCost,1_800_000);assert.equal(dept('product').weeklyCost,75_000);
assert.equal(dept('marketing').setupCost,1_600_000);assert.equal(dept('marketing').weeklyCost,70_000);
assert.equal(dept('dx').setupCost,2_200_000);assert.equal(dept('dx').weeklyCost,90_000);

console.log(JSON.stringify({hold,exit},null,2));
console.log('digital business scale-up production playability checks passed');
