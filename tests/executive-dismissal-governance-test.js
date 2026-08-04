'use strict';
const assert=require('node:assert');
const {loadGame}=require('./harness');
function setup(){
  const loaded=loadGame({headless:true});
  const engine=new loaded.engineModule.TycoonEngine();
  engine.g.configured=true;
  engine.g.week=160;
  engine.g.companyCash=200_000_000;
  engine.g.companyReputation=70;
  engine.g.employeeSatisfaction=75;
  engine.g.boardGovernanceQuality=65;
  engine.g.executiveManagement={
    executives:[
      {id:'exec-low',name:'低評価役員',role:'COO',skill:42,salary:5_000_000,hiredWeek:120,fit:'operations'},
      {id:'exec-high',name:'高評価役員',role:'CFO',skill:90,salary:12_000_000,hiredWeek:80,fit:'finance'},
      {id:'exec-successor',name:'後継役員',role:'CSO',skill:78,salary:8_000_000,hiredWeek:130,fit:'strategy'}
    ],
    assignments:{operations:'exec-low',finance:'exec-high',strategy:'exec-successor'}
  };
  engine.g.executiveGovernance={reviews:[
    {week:159,executiveId:'exec-low',score:40,rating:'C'},
    {week:159,executiveId:'exec-high',score:92,rating:'S'}
  ],boardHistory:[],dismissalDecisions:[],successorId:'exec-successor',lastReviewWeek:159};
  engine.normalize();
  return{loaded,engine};
}
{
  const {engine}=setup();
  const low=engine.assessExecutiveDismissal('exec-low','underperformance');
  const high=engine.assessExecutiveDismissal('exec-high','underperformance');
  assert(low.approved,'low-rated executive should be removable for underperformance');
  assert(!high.approved,'high-rated executive should resist unsupported underperformance dismissal');
}
{
  const {loaded,engine}=setup();
  const beforeCash=engine.g.companyCash;
  assert.equal(engine.dismissExecutiveWithReason('exec-low','underperformance'),true);
  assert(!engine.g.executiveManagement.executives.some(e=>e.id==='exec-low'));
  assert(engine.g.companyCash<beforeCash,'approved dismissal pays severance');
  assert.equal(engine.g.executiveGovernance.dismissalDecisions.at(-1).outcome,'approved');
  assert(engine.g.executiveDismissalDisruptionUntilWeek>=164);
  assert(loaded.modules.finance.validate(engine.g).ok,'finance remains valid after severance journal');
}
{
  const {loaded,engine}=setup();
  const beforeCash=engine.g.companyCash;
  assert.equal(engine.dismissExecutiveWithReason('exec-high','underperformance'),false);
  assert(engine.g.executiveManagement.executives.some(e=>e.id==='exec-high'));
  assert.equal(engine.g.companyCash,beforeCash,'rejected proposal does not move cash');
  assert.equal(engine.g.executiveGovernance.dismissalDecisions.at(-1).outcome,'rejected');
  assert(loaded.modules.finance.validate(engine.g).ok);
}
{
  const a=setup(),b=setup();
  const aa=a.engine.assessExecutiveDismissal('exec-high','misconduct');
  const bb=b.engine.assessExecutiveDismissal('exec-high','misconduct');
  assert.deepEqual(JSON.parse(JSON.stringify(aa)),JSON.parse(JSON.stringify(bb)),'assessment is deterministic');
  assert(aa.approved,'misconduct can justify removal of a strong executive');
}
{
  const {loaded,engine}=setup();
  engine.dismissExecutiveWithReason('exec-low','underperformance');
  const snapshot=JSON.parse(JSON.stringify(engine.g));
  const restored=new loaded.engineModule.TycoonEngine(snapshot);
  restored.normalize();
  assert.equal(restored.g.executiveGovernance.dismissalDecisions.length,1,'dismissal history survives old-save-shaped reload');
  assert(restored.g.executiveGovernance.dismissalDecisions.length<=80);
}
console.log('executive-dismissal-governance-test: ok');
