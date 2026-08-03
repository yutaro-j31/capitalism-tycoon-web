const fs = require('node:fs');
const path = require('node:path');
const harness = require('./harness');

const diagnostics = { market: null, loadedHireExecutiveSource: null, hireAttempts: [], finalError: null };
const outputPath = path.join(__dirname, '..', 'artifacts', 'issue-294-executive-hiring.json');
function persistAndExit(error) {
  if (error) diagnostics.finalError = String(error?.stack || error);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
  console.log(`ISSUE_294_SUMMARY ${JSON.stringify({marketRoles:diagnostics.market?.candidates?.map(row=>row.role)||[],hireAttemptCount:diagnostics.hireAttempts.length,firstAttempt:diagnostics.hireAttempts[0]||null,finalError:diagnostics.finalError?.split('\n')[0]||null})}`);
  process.exitCode = 0;
}
process.once('uncaughtException', persistAndExit);

const originalLoadGame = harness.loadGame;
harness.loadGame = function loadGameWithExecutiveDiagnostics(options) {
  const loaded = originalLoadGame(options);
  const Engine = loaded.engineModule.TycoonEngine;
  const originalConfigure = Engine.prototype.configure;
  const originalHireExecutive = Engine.prototype.hireExecutive;
  diagnostics.loadedHireExecutiveSource = String(originalHireExecutive);
  let activeAttempt = null;
  const originalRandom = loaded.ctx.Math.random;
  loaded.ctx.Math.random = function diagnosticRandom() {
    const value = originalRandom();
    if (activeAttempt) activeAttempt.randomDraws.push(value);
    return value;
  };

  Engine.prototype.configure = function configureWithExecutiveDiagnostics(config) {
    const result = originalConfigure.call(this, config);
    diagnostics.market = {week:this.g.week,candidates:(this.g.executiveMarket||[]).map(row=>({id:row.id,role:row.role,name:row.name,salary:row.salary,desiredSalary:row.desiredSalary,desiredSO:row.desiredSO}))};
    return result;
  };
  Engine.prototype.hireExecutive = function hireExecutiveWithDiagnostics(candidateID, salary, so) {
    const candidateIndex = (this.g.executiveMarket || []).findIndex(row => row.id === candidateID);
    const candidate = candidateIndex >= 0 ? this.g.executiveMarket[candidateIndex] : null;
    const desiredSalary = candidate?.desiredSalary ?? candidate?.salary ?? salary;
    const desiredSO = candidate?.desiredSO ?? 0;
    const calculatedChance = candidate ? Math.max(0.15, Math.min(0.98, 0.55 + (salary / desiredSalary - 1) * 0.8 + (so - desiredSO) * 12 + this.g.companyReputation / 300)) : null;
    const before = {week:this.g.week,candidateID,candidateIndex,candidateRole:candidate?.role||null,candidateName:candidate?.name||null,salary,so,desiredSalary:candidate?.desiredSalary??null,desiredSO:candidate?.desiredSO??null,calculatedChance,companyCash:this.g.companyCash,companyReputation:this.g.companyReputation,alreadyHired:candidate?Boolean(this.g.executives?.[candidate.role]):null,marketRoles:(this.g.executiveMarket||[]).map(row=>row.role),randomDraws:[]};
    activeAttempt = before;
    let result;
    try {
      result = originalHireExecutive.call(this, candidateID, salary, so);
    } finally {
      activeAttempt = null;
    }
    diagnostics.hireAttempts.push({before,result:Boolean(result),hiredRoles:Object.keys(this.g.executives||{}),companyCashAfter:this.g.companyCash,latestNews:this.g.news?.[0]||null});
    return result;
  };
  return loaded;
};
require('./normal-start-ipo-balance-audit-test');
persistAndExit(null);
