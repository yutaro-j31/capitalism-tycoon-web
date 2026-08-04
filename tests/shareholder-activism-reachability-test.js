'use strict';
const assert=require('node:assert');
const {loadGame}=require('./harness');

function recordFunding(loaded,engine,targetCash,id){
  const delta=targetCash-(Number(engine.g.companyCash)||0);
  engine.g.companyCash+=delta;
  loaded.modules.finance.event(engine.g,'revenue',delta,{
    cashEffect:delta,
    profitEffect:delta,
    sourceType:'test',
    sourceID:id,
    idempotencyKey:id
  });
  loaded.modules.finance.rebuildSnapshotForWeek(engine.g,engine.g.week);
}

function run(mode){
  const loaded=loadGame({headless:true});
  const engine=new loaded.engineModule.TycoonEngine();
  engine.normalize();
  engine.g.configured=true;
  engine.g.difficulty='normal';
  engine.g.companyName=mode==='adverse'?'Reachability Co':'Healthy Operator Co';
  let funded=false;
  let firstCampaignWeek=null;

  for(let i=0;i<208;i++){
    if(engine.g.week>=53){
      engine.g.publicCompany=true;
      engine.g.sharesOut=Math.max(1,Number(engine.g.sharesOut)||1_000_000);
      engine.g.founderShares=Math.floor(engine.g.sharesOut*.28);
      engine.g.stockPrice=Math.max(100,Number(engine.g.stockPrice)||100);
      engine.g.lastActivistCampaignWeek=Math.max(0,Number(engine.g.lastActivistCampaignWeek)||0);
      if(mode==='adverse'){
        if(!funded){
          recordFunding(loaded,engine,900_000_000,'activism-reachability-funding');
          funded=true;
        }
        engine.g.ipoPrice=engine.g.stockPrice;
        engine.g.boardGovernanceQuality=100;
        engine.g.founderControlPressure=0;
        engine.g.dividendPerShare=0;
        engine.g.subsidiaries=[];
        engine.g.maSubsidiaries=[];
      }else{
        engine.g.ipoPrice=engine.g.stockPrice;
        engine.g.boardGovernanceQuality=90;
        engine.g.founderControlPressure=0;
        engine.g.dividendPerShare=1_000_000;
      }
    }

    const startsBefore=(engine.g.activistCampaignHistory||[]).filter(x=>x&&x.type==='campaignStarted').length;
    const result=engine.advanceWeek();
    assert.notEqual(result,false,'weekly progression must continue');
    const startsAfter=(engine.g.activistCampaignHistory||[]).filter(x=>x&&x.type==='campaignStarted').length;
    if(startsAfter>startsBefore&&firstCampaignWeek===null)firstCampaignWeek=engine.g.week;
  }

  const campaignCount=(engine.g.activistCampaignHistory||[]).filter(x=>x&&x.type==='campaignStarted').length;
  const validation=loaded.modules.finance.validate(engine.g);
  assert(validation.ok,JSON.stringify(validation));
  return{firstCampaignWeek,campaignCount};
}

const adverseA=run('adverse'),adverseB=run('adverse');
assert(adverseA.firstCampaignWeek!==null,'208-week adverse play must create at least one activist campaign');
assert(adverseA.firstCampaignWeek>=53&&adverseA.firstCampaignWeek<=208,`campaign week ${adverseA.firstCampaignWeek} must be post-IPO and within horizon`);
assert.equal(adverseA.firstCampaignWeek,adverseB.firstCampaignWeek,'campaign reachability week is deterministic');
assert.equal(adverseA.campaignCount,adverseB.campaignCount,'campaign count is deterministic');

const healthyA=run('healthy'),healthyB=run('healthy');
assert.equal(healthyA.campaignCount,0,'healthy 208-week operation should not trigger activist campaigns');
assert.deepEqual(healthyA,healthyB,'healthy control is deterministic');

console.log(`shareholder-activism-reachability-test: ok (adverse week ${adverseA.firstCampaignWeek}, campaigns ${adverseA.campaignCount}; healthy ${healthyA.campaignCount})`);
