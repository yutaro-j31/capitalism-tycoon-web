'use strict';
const assert=require('node:assert');
const {loadGame}=require('./harness');

function run(){
  const loaded=loadGame({headless:true});
  const engine=new loaded.engineModule.TycoonEngine();
  engine.normalize();
  engine.g.configured=true;
  engine.g.difficulty='normal';
  engine.g.companyName='Reachability Co';
  let firstCampaignWeek=null;
  for(let i=0;i<208;i++){
    if(engine.g.week>=53){
      engine.g.publicCompany=true;
      engine.g.companyCash=Math.max(Number(engine.g.companyCash)||0,160_000_000);
      engine.g.sharesOut=Math.max(1,Number(engine.g.sharesOut)||1_000_000);
      engine.g.founderShares=Math.floor(engine.g.sharesOut*.28);
      engine.g.stockPrice=Math.max(100,Number(engine.g.stockPrice)||100);
      engine.g.ipoPrice=engine.g.stockPrice*1.35;
      engine.g.boardGovernanceQuality=42;
      engine.g.dividendPerShare=0;
    }
    const before=engine.g.activeActivistCampaign;
    const result=engine.advanceWeek();
    assert.notEqual(result,false,'weekly progression must continue');
    if(!before&&engine.g.activeActivistCampaign&&firstCampaignWeek===null)firstCampaignWeek=engine.g.week;
  }
  assert(firstCampaignWeek!==null,'208-week reachable play must create at least one activist campaign');
  assert(firstCampaignWeek>=53&&firstCampaignWeek<=208,`campaign week ${firstCampaignWeek} must be post-IPO and within horizon`);
  assert(loaded.modules.finance.validate(engine.g).ok,'finance remains valid after reachable play');
  return firstCampaignWeek;
}
const a=run(),b=run();
assert.equal(a,b,'campaign reachability week is deterministic');
console.log(`shareholder-activism-reachability-test: ok (week ${a})`);
