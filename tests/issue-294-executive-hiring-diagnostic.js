const fs = require('node:fs');
const path = require('node:path');
const harness = require('./harness');

const diagnostics = {
  market: null,
  hireAttempts: [],
  finalError: null
};
const outputPath = path.join(__dirname, '..', 'artifacts', 'issue-294-executive-hiring.json');

function persistAndExit(error) {
  if (error) diagnostics.finalError = String(error?.stack || error);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
  console.log(`ISSUE_294_SUMMARY ${JSON.stringify({
    marketRoles: diagnostics.market?.candidates?.map(row => row.role) || [],
    hireAttemptCount: diagnostics.hireAttempts.length,
    attempts: diagnostics.hireAttempts.map(row => ({
      week: row.before.week,
      role: row.before.candidateRole,
      result: row.result,
      latestNews: row.latestNews
    })),
    finalError: diagnostics.finalError?.split('\n')[0] || null
  })}`);
  process.exitCode = 0;
}

process.once('uncaughtException', persistAndExit);

const originalLoadGame = harness.loadGame;
harness.loadGame = function loadGameWithExecutiveDiagnostics(options) {
  const loaded = originalLoadGame(options);
  const Engine = loaded.engineModule.TycoonEngine;
  const originalConfigure = Engine.prototype.configure;
  const originalHireExecutive = Engine.prototype.hireExecutive;

  Engine.prototype.configure = function configureWithExecutiveDiagnostics(config) {
    const result = originalConfigure.call(this, config);
    diagnostics.market = {
      week: this.g.week,
      candidates: (this.g.executiveMarket || []).map(row => ({
        id: row.id,
        role: row.role,
        name: row.name,
        salary: row.salary,
        desiredSalary: row.desiredSalary,
        desiredSO: row.desiredSO
      }))
    };
    return result;
  };

  Engine.prototype.hireExecutive = function hireExecutiveWithDiagnostics(candidateID, salary, so) {
    const candidate = (this.g.executiveMarket || []).find(row => row.id === candidateID) || null;
    const before = {
      week: this.g.week,
      candidateID,
      candidateRole: candidate?.role || null,
      candidateName: candidate?.name || null,
      salary,
      so,
      desiredSalary: candidate?.desiredSalary ?? null,
      desiredSO: candidate?.desiredSO ?? null,
      companyCash: this.g.companyCash,
      companyReputation: this.g.companyReputation,
      alreadyHired: candidate ? Boolean(this.g.executives?.[candidate.role]) : null,
      marketRoles: (this.g.executiveMarket || []).map(row => row.role)
    };
    const result = originalHireExecutive.call(this, candidateID, salary, so);
    diagnostics.hireAttempts.push({
      before,
      result: Boolean(result),
      hiredRoles: Object.keys(this.g.executives || {}),
      companyCashAfter: this.g.companyCash,
      latestNews: this.g.news?.[0] || null
    });
    return result;
  };

  return loaded;
};

require('./normal-start-ipo-balance-audit-test');
persistAndExit(null);
