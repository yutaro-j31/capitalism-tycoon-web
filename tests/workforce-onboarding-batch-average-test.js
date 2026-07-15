const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {modules}=loadGame({random:()=>.5});
function scenario(order){
  const e=new modules.engine.TycoonEngine();
  e.g.configured=true;e.g.hasHeadOffice=true;e.g.officeCapacity=100;e.g.companyCash=100000000;
  e.g.departments.hr={...modules.data.MASTER.departments.find(d=>d.id==='hr'),established:true};
  e.g.departmentStaff.hr=2;
  modules.workforce.migrateV7(e.g);
  const team=e.g.workforceTeams.find(t=>t.departmentID==='hr'&&!t.storeID);
  team.averageSkill=50;team.averageExperience=20;team.morale=55;team.remoteRatio=.2;
  team.corporatePayrollCohorts=[{cohortID:'hr-base-pay',candidateID:null,roleID:'hr',headcount:2,weeklySalaryPerPerson:65000,hiredWeek:e.g.week,status:'active',base:true}];
  for(const item of order){
    modules.workforce.addDepartmentHeadcount(e.g,'hr',item.hc,{roleID:'hr',weeklySalaryPerPerson:item.pay,onboardingWeeks:1,candidateID:item.id,averageSkill:item.skill,averageExperience:item.exp,expectedMorale:item.morale,remoteCompatibility:item.remote});
    assert.equal(modules.workforce.validate(e.g).ok,true,modules.workforce.validate(e.g).errors.join('\n'));
  }
  assert.equal(e.g.workforceTeams.find(t=>t.departmentID==='hr').averageSkill,50);
  e.advanceWeek(false);
  const updated=e.g.workforceTeams.find(t=>t.departmentID==='hr'&&!t.storeID);
  assert.equal(modules.workforce.validate(e.g).ok,true,modules.workforce.validate(e.g).errors.join('\n'));
  assert.equal(updated.headcount,5);
  assert.equal(Math.round(updated.averageSkill*100)/100,72);
  assert.equal(updated.onboardingHeadcount,0);
  assert.equal(modules.workforce.weeklyPayroll(e.g),2*65000+2*90000+1*110000);
  const once=updated.averageSkill;
  e.advanceWeek(false);
  assert.equal(e.g.workforceTeams.find(t=>t.departmentID==='hr'&&!t.storeID).averageSkill,once);
  return once;
}
const a=[{id:'batch-a',hc:2,skill:80,exp:40,morale:70,remote:.6,pay:90000},{id:'batch-b',hc:1,skill:100,exp:60,morale:80,remote:.9,pay:110000}];
const b=[a[1],a[0]];
assert.equal(scenario(a),72);
assert.equal(scenario(b),72);
console.log('workforce onboarding batch average ok');
