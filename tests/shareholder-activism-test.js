'use strict';
const assert=require('node:assert');
const {loadGame}=require('./harness');

function createWithEarnedOpeningBalance(loaded,targetCash){
  const engine=new loaded.engineModule.TycoonEngine();
  engine.g.companyCash=targetCash;
  engine.g.companyDebt=0;
  delete engine.g.finance;
  engine.normalize();
  const finance=loaded.modules.finance.ensureFinance(engine.g);
  assert.equal(finance.openingRetainedEarnings,targetCash,'fixture opening balance is retained earnings');
  const validation=loaded.modules.finance.validate(engine.g);
  assert(validation.ok,`fixture finance invalid: ${JSON.stringify(validation)}`);
  return engine;
}

function seedCapitalUse(loaded,engine,{weeks=26,investment=0,shareholderReturns=0,excessCash=900_000_000}={}){
  const reserve=loaded.modules.shareholderActivism.operatingReserve(engine.g);
  engine.g.activistCapitalUseHistory=Array.from({length:weeks},(_,index)=>({
    week:engine.g.week-weeks+index,
    excessCash,
    operatingReserve:reserve,
    investment,
    shareholderReturns
  }));
}

function configured(difficulty='normal',options={}){
  const loaded=loadGame({headless:true});
  const engine=createWithEarnedOpeningBalance(loaded,900_000_000);
  engine.g.configured=true;
  engine.g.publicCompany=true;
  engine.g.difficulty=difficulty;
  engine.g.week=140;
  engine.g.sharesOut=Math.max(1,engine.g.sharesOut||1_000_000);
  engine.g.founderShares=Math.floor(engine.g.sharesOut*.28);
  engine.g.stockPrice=Math.max(100,engine.g.stockPrice||100);
  engine.g.ipoPrice=options.boundary?engine.g.stockPrice:engine.g.stockPrice*2;
  engine.g.boardGovernanceQuality=options.boundary?100:0;
  engine.g.dividendPerShare=0;
  engine.g.founderControlPressure=options.boundary?0:30;
  engine.g.lastActivistCampaignWeek=0;
  engine.g.subsidiaries=[];
  engine.g.maSubsidiaries=[];
  seedCapitalUse(loaded,engine,options.capitalUse||{});
  return{loaded,engine};
}

{
  const loaded=loadGame({headless:true});
  const engine=new loaded.engineModule.TycoonEngine();
  delete engine.g.activistCapitalUseHistory;
  engine.normalize();
  assert.deepEqual(engine.g.activistCapitalUseHistory,[],'old saves normalize missing capital-use history to an empty array');
}

{
  const easy=configured('easy'),normal=configured('normal'),hard=configured('hard');
  const ep=easy.engine.getShareholderActivismPressure(),np=normal.engine.getShareholderActivismPressure(),hp=hard.engine.getShareholderActivismPressure();
  assert(ep.threshold>np.threshold&&np.threshold>hp.threshold,'difficulty thresholds tighten from easy to hard');
}

{
  const {loaded,engine}=configured('normal',{boundary:true});
  const p=engine.getShareholderActivismPressure();
  assert.equal(p.metrics.windowWeeks,26,'boundary uses a complete 26-week observation window');
  assert.equal(p.metrics.cashPressure,100,'sustained excess cash with no capital use reaches maximum pressure');
  assert.equal(p.metrics.dividendPressure,100,'boundary has maximum payout pressure');
  assert.equal(p.metrics.cashHoardingBonus,16,'boundary receives the targeted hoarding bonus');
  assert.equal(p.score,p.threshold,'boundary score intentionally equals the normal threshold');
  assert(loaded.modules.shareholderActivism.maybeStart(engine),'score equal to threshold starts a campaign');
}

{
  const immature=configured('normal',{boundary:true,capitalUse:{weeks:25}}).engine.getShareholderActivismPressure();
  assert(immature.metrics.cashPressure<100,'an incomplete observation window cannot reach full stagnation pressure');
  assert.equal(immature.metrics.cashHoardingBonus,0,'a transient cash position does not receive the hoarding bonus');
}

{
  const investment=configured('normal',{boundary:true,capitalUse:{investment:20_000_000}}).engine.getShareholderActivismPressure();
  assert.equal(investment.metrics.cashPressure,0,'sustained productive investment fully suppresses capital-stagnation pressure');
  assert.equal(investment.metrics.cashHoardingBonus,0);
  const returns=configured('normal',{boundary:true,capitalUse:{shareholderReturns:10_000_000}}).engine.getShareholderActivismPressure();
  assert.equal(returns.metrics.cashPressure,0,'sustained shareholder returns suppress capital-stagnation pressure');
}

{
  const {loaded,engine}=configured('normal');
  const p=engine.getShareholderActivismPressure();
  console.log(`direct fixture pressure=${p.score} threshold=${p.threshold} public=${engine.g.publicCompany} week=${engine.g.week} last=${engine.g.lastActivistCampaignWeek}`);
  assert(p.score>=p.threshold,`fixture pressure ${p.score} must meet threshold ${p.threshold}`);
  const campaign=loaded.modules.shareholderActivism.maybeStart(engine);
  assert(campaign,'campaign starts from adverse governance and sustained capital-stagnation state');
  assert(['buyback','dividend'].includes(campaign.type));
  const beforeCash=engine.g.companyCash;
  assert.equal(engine.negotiateShareholderProposal(),true);
  assert.equal(engine.g.companyCash,beforeCash,'negotiation never mutates cash');
  assert.equal(engine.g.governanceCommitments.length,1);
  assert(engine.g.activeActivistCampaign.support<campaign.support+1,'negotiation reduces support');
  const snapshot=JSON.parse(JSON.stringify(engine.g));
  const restored=new loaded.engineModule.TycoonEngine(snapshot);
  restored.normalize();
  assert(restored.g.activeActivistCampaign,'campaign survives normalize/save-shaped reload');
  assert.equal(restored.g.activistCapitalUseHistory.length,26,'capital-use history survives save-shaped reload');
}

{
  const {engine}=configured('normal');
  const before=engine.getShareholderActivismPressure();
  console.log(`weekly wrapper before week=${engine.g.week} pressure=${before.score}/${before.threshold} active=${Boolean(engine.g.activeActivistCampaign)}`);
  const result=engine.advanceWeek();
  const after=engine.getShareholderActivismPressure();
  console.log(`weekly wrapper after week=${engine.g.week} pressure=${after.score}/${after.threshold} active=${Boolean(engine.g.activeActivistCampaign)}`);
  assert.notEqual(result,false,'advanceWeek must complete');
  assert(engine.g.activeActivistCampaign,'shareholder-activism.js advanceWeek wrapper reaches maybeStart without a compatibility hook');
}

{
  const {loaded,engine}=configured('hard');
  const campaign=loaded.modules.shareholderActivism.maybeStart(engine);
  assert(campaign);
  campaign.support=72;
  assert.equal(engine.rejectShareholderProposal(),true);
  assert.equal(engine.g.activeActivistCampaign.status,'proxyFight');
  const result=loaded.modules.shareholderActivism.resolveProxy(engine,engine.g.activeActivistCampaign);
  assert.equal(result.won,true,'activist wins with high support');
  assert.equal(engine.g.boardActivistSeats,1);
  assert(engine.g.founderControlPressure>0);
  assert.equal(engine.g.activeActivistCampaign,null);
}

{
  const a=configured('normal'),b=configured('normal');
  const ca=a.loaded.modules.shareholderActivism.maybeStart(a.engine),cb=b.loaded.modules.shareholderActivism.maybeStart(b.engine);
  assert.deepEqual(JSON.parse(JSON.stringify(ca)),JSON.parse(JSON.stringify(cb)),'same state creates deterministic campaign');
}

{
  const {loaded,engine}=configured('normal');
  const campaign=loaded.modules.shareholderActivism.maybeStart(engine);
  assert(campaign);
  const before=engine.g.companyCash;
  assert.equal(engine.acceptShareholderProposal(),true);
  assert.equal(engine.g.activeActivistCampaign,null);
  const validation=loaded.modules.finance.validate(engine.g);
  assert(validation.ok,JSON.stringify(validation));
  if(campaign.type==='buyback')assert(engine.g.companyCash<before,'buyback canonical path spends cash');
  else assert(engine.g.dividendPerShare>0,'dividend canonical path changes declared dividend without direct cash mutation');
}

{
  const {loaded,engine}=configured('normal');
  engine.g.activistCapitalUseHistory=Array.from({length:80},(_,week)=>({week,excessCash:week,operatingReserve:8_000_000,investment:0,shareholderReturns:0}));
  loaded.modules.shareholderActivism.ensure(engine.g);
  assert.equal(engine.g.activistCapitalUseHistory.length,loaded.modules.shareholderActivism.HISTORY_LIMIT,'capital-use history remains bounded');
  assert.equal(engine.g.activistCapitalUseHistory[0].week,28,'history keeps the most recent rows');
}

console.log('shareholder-activism-test: ok');
