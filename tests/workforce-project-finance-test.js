const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { modules } = loadGame({ random: () => 0.5 });

function setup() {
  const e = new modules.engine.TycoonEngine();
  e.g.configured = true;
  e.g.companyCash = 1000000000;
  e.g.finance = modules.finance.defaultFinanceState(e.g);
  e.g.hasHeadOffice = true;
  e.g.officeCapacity = 200;
  for (const d of modules.data.MASTER.departments) { e.g.departments[d.id] = { ...d, established: true }; e.g.departmentStaff[d.id] = 10; }
  e.g.stores.push({ id: 's0', businessID: 'ramen', prefID: 'tokyo', name: 's0', status: 'open', condition: 100, operatingHours: 3, openingWeek: 1, weeksToOpen: 0 });
  modules.workforce.migrateV7(e.g);
  return e;
}

for (const tmpl of modules.workforce.PROJECT_TEMPLATES) {
  const e = setup();
  const beforeWorkload = modules.workforce.workload(e.g, 'procurement');
  const beforeMorale = e.g.workforceTeams.reduce((a, t) => a + t.morale, 0);
  assert.equal(e.startWorkforceProject(tmpl.templateID), true, tmpl.templateID);
  const p = e.g.workforceProjects[0];
  assert.equal(p.operationID, p.projectID);
  while (p.status !== 'completed') {
    e.advanceWeek(false);
    assert(p.spentBudget <= p.totalBudget + 0.01, tmpl.templateID);
    assert.notEqual(p.status, 'failed', tmpl.templateID);
  }
  const spent = p.spentBudget;
  assert.equal(p.benefitApplied, true, tmpl.templateID);
  e.advanceWeek(false);
  assert.equal(p.spentBudget, spent, tmpl.templateID);
  if (tmpl.benefitType === 'morale') assert(e.g.workforceTeams.reduce((a, t) => a + t.morale, 0) > beforeMorale, tmpl.templateID);
  if (tmpl.benefitType === 'departmentEffect') assert(e.g.departments[tmpl.ownerDepartmentID].phase4ABonus > 0, tmpl.templateID);
  if (tmpl.benefitType === 'supplyBacklog') {
    assert(e.g.workforceSettings.supplyBacklogReduction > 0, tmpl.templateID);
    const reduced = modules.workforce.workload(e.g, 'procurement'); const oldReduction = e.g.workforceSettings.supplyBacklogReduction; e.g.workforceSettings.supplyBacklogReduction = 0; const unreduced = modules.workforce.workload(e.g, 'procurement'); e.g.workforceSettings.supplyBacklogReduction = oldReduction; assert(reduced < unreduced, tmpl.templateID);
    const saved = JSON.parse(JSON.stringify(e.g));
    assert.equal(saved.workforceSettings.supplyBacklogReduction, e.g.workforceSettings.supplyBacklogReduction);
  }
  assert.equal(modules.finance.validate(e.g).ok, true, modules.finance.validate(e.g).errors.join('\n'));
  assert.equal(modules.supply.validate(e.g).ok, true, modules.supply.validate(e.g).errors.join('\n'));
  assert.equal(modules.workforce.validate(e.g).ok, true, modules.workforce.validate(e.g).errors.join('\n'));
}

const paused = setup();
paused.startWorkforceProject('dx-rollout');
const pp = paused.g.workforceProjects[0]; pp.status = 'active';
paused.setWorkforceProjectStatus(pp.projectID, 'paused');
paused.advanceWeek(false);
assert.equal(pp.spentBudget, 0);
paused.setWorkforceProjectStatus(pp.projectID, 'cancelled');
paused.advanceWeek(false);
assert.equal(pp.spentBudget, 0);
console.log('workforce project finance ok');
