const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {modules}=loadGame();
function setup(opsHeadcount){
  const e=new modules.engine.TycoonEngine();
  e.g.configured=true;e.g.hasHeadOffice=true;e.g.officeCapacity=100;e.g.companyCash=100000000;
  e.g.departments.operations={...modules.data.MASTER.departments.find(d=>d.id==='operations'),established:true};
  e.g.departmentStaff.operations=opsHeadcount;
  modules.workforce.migrateV7(e.g);
  assert.equal(modules.workforce.validate(e.g).ok,true,modules.workforce.validate(e.g).errors.join('\n'));
  return e;
}
function assertNoDuplicateTeamIDs(g){
  const ids=g.workforceTeams.map(t=>t.teamID);
  assert.equal(new Set(ids).size,ids.length);
}
{
  const e=setup(1);
  const beforePayroll=modules.workforce.weeklyPayroll(e.g);
  modules.workforce.addDepartmentHeadcount(e.g,'operations',2,{roleID:'procurement',weeklySalaryPerPerson:68000,onboardingWeeks:1,averageSkill:70,averageExperience:40,expectedMorale:60});
  assert.equal(modules.workforce.validate(e.g).ok,true,modules.workforce.validate(e.g).errors.join('\n'));
  const teams=e.g.workforceTeams.filter(t=>t.departmentID==='operations'&&!t.storeID);
  const ops=teams.find(t=>t.roleID==='operations');
  const procurement=teams.find(t=>t.roleID==='procurement');
  assert(ops);
  assert(procurement);
  assert.equal(ops.headcount,1);
  assert.equal(procurement.headcount,2);
  assert.equal(teams.reduce((a,t)=>a+t.headcount,0),3);
  assert.equal(e.g.departmentStaff.operations,3);
  assertNoDuplicateTeamIDs(e.g);
  assert.equal(modules.workforce.weeklyPayroll(e.g),beforePayroll+2*68000);
  modules.workforce.recompute(e.g);
  assert(e.g.workforceResultsByDepartmentID.operations.requiredWorkload>=0);
}
{
  const e=setup(8);
  modules.workforce.addDepartmentHeadcount(e.g,'operations',2,{roleID:'procurement',weeklySalaryPerPerson:68000,onboardingWeeks:1,averageSkill:70,averageExperience:40,expectedMorale:60});
  assert.equal(modules.workforce.validate(e.g).ok,true,modules.workforce.validate(e.g).errors.join('\n'));
  let teams=e.g.workforceTeams.filter(t=>t.departmentID==='operations'&&!t.storeID);
  assert.equal(teams.find(t=>t.roleID==='operations').headcount,8);
  assert.equal(teams.find(t=>t.roleID==='procurement').headcount,2);
  assert.equal(teams.reduce((a,t)=>a+t.headcount,0),10);
  assert.equal(e.g.departmentStaff.operations,10);
  assertNoDuplicateTeamIDs(e.g);
  const saved=JSON.parse(JSON.stringify(e.g));
  modules.workforce.ensure(saved);modules.workforce.recompute(saved);
  assert.equal(modules.workforce.validate(saved).ok,true,modules.workforce.validate(saved).errors.join('\n'));
  teams=saved.workforceTeams.filter(t=>t.departmentID==='operations'&&!t.storeID);
  assert.equal(teams.reduce((a,t)=>a+t.headcount,0),10);
  assert.equal(saved.departmentStaff.operations,10);
}
console.log('workforce role cohort ok');
