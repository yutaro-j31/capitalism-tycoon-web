'use strict';
const assert=require('node:assert');
const {loadGame}=require('./harness');

function createEngine(loaded,mode){
  const engine=new loaded.engineModule.TycoonEngine();
  if(mode==='adverse'){
    engine.g.companyCash=900_000_000;
    engine.g.companyDebt=0;
    delete engine.g.finance;
  }
  engine.normalize();
  if(mode==='adverse'){
    const finance=loaded.modules.finance.ensureFinance(engine.g);
    assert.equal(finance.openingRetainedEarnings,900_000_000,'adverse play starts with accumulated retained earnings');
  }
  engine.g.configured=true;
  engine.g.difficulty='normal';
  engine.g.companyName=mode==='adverse'?'Reachability Co':'Healthy Operator Co';
  return engine;
}

function run(mode){
  const loaded=loadGame({headless:true});
  const engine=createEngine(loaded,mode);
  let firstCampaignWeek=null;

  for(let i=0;i<208;i++){
    if(engine.g.week>=53){
      engine.g.publicCompany=true;
      engine.g.sharesOut=Math.max(1,Number(engine.g.sharesOut)||1_000_000);
      engine.g.founderShares=Math.floor(engine.g.sharesOut*.28);
      engine.g.stockPrice=Math.max(100,Number(engine.g.stockPrice)||100);
      engine.g.ipoPrice=engine.g.stockPrice;
      engine.g.lastActivistCampaignWeek=Math.max(0,Number(engine.g.lastActivistCampaignWeek)||0);
      engine.g.founderControlPressure=0;
      engine.g.subsidiaries=[];
      engine.g.maSubsidiaries=[];
      if(mode==='adverse'){
        engine.g.boardGovernanceQuality=100;
        engine.g.dividendPerShare=0;
      }else{
        engine.g.boardGovernanceQuality=90;
        const cap=loaded.modules.shareholderReturns.capacity(engine);
        engine.g.dividendPerShare=cap.outstandingShares>0?cap.safeAmount/cap.outstandingShares:0;
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
