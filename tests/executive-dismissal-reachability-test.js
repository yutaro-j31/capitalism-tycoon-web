'use strict';
const assert=require('node:assert');
const {loadGame}=require('./harness');

function createEngine(loaded,mode){
  const engine=new loaded.engineModule.TycoonEngine();
  engine.g.companyCash=200_000_000;
  engine.g.companyDebt=0;
  delete engine.g.finance;
  engine.normalize();
  engine.g.configured=true;
  engine.g.difficulty='normal';
  engine.g.companyName=mode==='adverse'?'Executive Reachability Co':'Healthy Executive Co';
  engine.g.boardGovernanceQuality=100;
  engine.g.employeeSatisfaction=80;
  return engine;
}

function tryHirePair(engine,mode){
  const candidates=engine.generateExecutiveCandidates();
  assert.equal(candidates.length,3,'normal candidate generation exposes three executives');
  const ordered=[...candidates].sort((a,b)=>a.skill-b.skill||String(a.id).localeCompare(String(b.id)));
  const target=mode==='adverse'?ordered.find(row=>row.skill<=60):[...ordered].reverse().find(row=>row.skill>=85);
  if(!target)return null;
  const successor=[...ordered].reverse().find(row=>row.id!==target.id);
  assert(successor,'successor candidate is available');
  assert.equal(engine.hireExecutive(target.id),true,'target executive can be hired through gameplay API');
  assert.equal(engine.hireExecutive(successor.id),true,'successor executive can be hired through gameplay API');
  const wrongDepartment=['finance','operations','technology'].find(dept=>dept!==target.fit);
  assert.equal(engine.assignExecutive(target.id,wrongDepartment),true,'target can be assigned through gameplay API');
  assert.equal(engine.assignExecutive(successor.id,successor.fit),true,'successor can be assigned through gameplay API');
  assert.equal(engine.designateExecutiveSuccessor(successor.id),true,'successor can be designated through gameplay API');
  return{target,successor,hiredWeek:engine.g.week};
}

function run(mode){
  const loaded=loadGame({headless:true});
  const engine=createEngine(loaded,mode);
  let pair=null,decisionWeek=null,lastAssessment=null;

  for(let i=0;i<208;i++){
    if(!pair)pair=tryHirePair(engine,mode);
    else if(decisionWeek===null){
      assert.equal(engine.holdExecutiveReview(),true,'board review is reachable through gameplay API');
      lastAssessment=engine.assessExecutiveDismissal(pair.target.id,'underperformance');
      assert(lastAssessment,'dismissal assessment is available after review');
      if(mode==='healthy'){
        assert.equal(engine.dismissExecutiveWithReason(pair.target.id,'underperformance'),false,`high-performing executive dismissal is rejected: ${JSON.stringify({target:pair.target,assessment:lastAssessment})}`);
        decisionWeek=engine.g.week;
      }else if(lastAssessment.approved){
        assert.equal(engine.dismissExecutiveWithReason(pair.target.id,'underperformance'),true,`approved low-performing executive can be dismissed: ${JSON.stringify({target:pair.target,assessment:lastAssessment})}`);
        decisionWeek=engine.g.week;
      }
    }
    const progressed=engine.advanceWeek();
    assert.notEqual(progressed,false,'weekly progression must continue');
  }

  assert(pair,`${mode} play finds a suitable executive candidate within 208 weeks`);
  const decisions=engine.g.executiveGovernance.dismissalDecisions||[];
  const approvedCount=decisions.filter(row=>row?.outcome==='approved').length;
  const rejectedCount=decisions.filter(row=>row?.outcome==='rejected').length;
  const validation=loaded.modules.finance.validate(engine.g);
  assert(validation.ok,JSON.stringify(validation));
  return{
    hiredWeek:pair.hiredWeek,
    targetSkill:pair.target.skill,
    decisionWeek,
    approvedCount,
    rejectedCount,
    targetStillEmployed:engine.g.executiveManagement.executives.some(row=>row.id===pair.target.id),
    disruptionUntilWeek:engine.g.executiveDismissalDisruptionUntilWeek,
    finalSupport:lastAssessment?.support??null,
    finalScore:lastAssessment?.score??null
  };
}

function sampleCandidateDistribution(){
  const loaded=loadGame({headless:true});
  const engine=createEngine(loaded,'adverse');
  const lowCandidateWeeks=[];
  let totalLowCandidates=0,totalCandidates=0;
  for(let i=0;i<208;i++){
    const candidates=engine.generateExecutiveCandidates();
    totalCandidates+=candidates.length;
    const low=candidates.filter(row=>row.skill<=60);
    if(low.length){lowCandidateWeeks.push(engine.g.week);totalLowCandidates+=low.length;}
    assert.notEqual(engine.advanceWeek(),false,'distribution sample weekly progression must continue');
  }
  const validation=loaded.modules.finance.validate(engine.g);
  assert(validation.ok,JSON.stringify(validation));
  return{
    firstWeek:lowCandidateWeeks[0]??null,
    weeksAppeared:lowCandidateWeeks.length,
    totalLowCandidates,
    totalCandidates,
    lowCandidateWeeks
  };
}

const distributionA=sampleCandidateDistribution(),distributionB=sampleCandidateDistribution();
assert.deepEqual(distributionA,distributionB,'208-week candidate distribution is deterministic');
assert(distributionA.totalLowCandidates>0,'ability 60 or lower candidates appear within 208 weeks');
assert.equal(distributionA.totalCandidates,208*3,'three candidates are sampled in every one of 208 weeks');

const adverseA=run('adverse'),adverseB=run('adverse');
assert(adverseA.decisionWeek!==null&&adverseA.decisionWeek<=208,'adverse play reaches dismissal within 208 weeks');
assert.equal(adverseA.approvedCount,1,'adverse play records one approved dismissal');
assert.equal(adverseA.rejectedCount,0,'adverse play records no rejected dismissal');
assert.equal(adverseA.targetStillEmployed,false,'approved target is removed from executives');
assert(adverseA.disruptionUntilWeek>=adverseA.decisionWeek+4,'approved dismissal creates four-week disruption');
assert.deepEqual(adverseA,adverseB,'adverse reachability result is deterministic');

const healthyA=run('healthy'),healthyB=run('healthy');
assert.equal(healthyA.approvedCount,0,'healthy control has no approved underperformance dismissal');
assert.equal(healthyA.rejectedCount,1,'healthy control records one rejected proposal');
assert.equal(healthyA.targetStillEmployed,true,'healthy high performer remains employed');
assert.deepEqual(healthyA,healthyB,'healthy control result is deterministic');

console.log('executive-candidate-distribution:');
console.log(`  firstWeek=${distributionA.firstWeek} weeksAppeared=${distributionA.weeksAppeared} totalLow=${distributionA.totalLowCandidates} totalAll=${distributionA.totalCandidates}`);
console.log(`executive-dismissal-reachability-test: ok (adverse hired ${adverseA.hiredWeek}, decision ${adverseA.decisionWeek}, skill ${adverseA.targetSkill}, support ${adverseA.finalSupport}; healthy decision ${healthyA.decisionWeek}, rejected ${healthyA.rejectedCount})`);
