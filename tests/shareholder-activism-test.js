'use strict';
const assert=require('node:assert');
const {loadGame}=require('./harness');
function configured(difficulty='normal'){
  const loaded=loadGame({headless:true});
  const engine=new loaded.engineModule.TycoonEngine();
  engine.normalize();
  engine.g.configured=true;
  engine.g.publicCompany=true;
  engine.g.difficulty=difficulty;
  engine.g.week=140;
  engine.g.companyCash=900_000_000;
  engine.g.sharesOut=Math.max(1,engine.g.sharesOut||1_000_000);
  engine.g.founderShares=Math.floor(engine.g.sharesOut*.28);
  engine.g.stockPrice=Math.max(100,engine.g.stockPrice||100);
  engine.g.ipoPrice=engine.g.stockPrice*2;
  engine.g.boardGovernanceQuality=0;
  engine.g.dividendPerShare=0;
  engine.g.founderControlPressure=30;
  engine.g.lastActivistCampaignWeek=0;
  return{loaded,engine};
}
{
  const easy=configured('easy'),normal=configured('normal'),hard=configured('hard');
  const ep=easy.engine.getShareholderActivismPressure(),np=normal.engine.getShareholderActivismPressure(),hp=hard.engine.getShareholderActivismPressure();
  assert(ep.threshold>np.threshold&&np.threshold>hp.threshold,'difficulty thresholds tighten from easy to hard');
}
{
  const {loaded,engine}=configured('normal');
  const p=engine.getShareholderActivismPressure();
  console.log(`direct fixture pressure=${p.score} threshold=${p.threshold} public=${engine.g.publicCompany} week=${engine.g.week} last=${engine.g.lastActivistCampaignWeek}`);
  assert(p.score>=p.threshold,`fixture pressure ${p.score} must meet threshold ${p.threshold}`);
  const campaign=loaded.modules.shareholderActivism.maybeStart(engine);
  assert(campaign,'campaign starts from adverse governance and capital allocation state');
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
  assert(loaded.modules.finance.validate(engine.g).ok,'finance remains valid after canonical acceptance path');
  if(campaign.type==='buyback')assert(engine.g.companyCash<before,'buyback canonical path spends cash');
  else assert(engine.g.dividendPerShare>0,'dividend canonical path changes declared dividend without direct cash mutation');
}
console.log('shareholder-activism-test: ok');
