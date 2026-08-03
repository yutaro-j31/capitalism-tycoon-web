const harness = require('./harness');

const originalLoadGame = harness.loadGame;
harness.loadGame = function loadGameWithExecutiveDiagnostics(options) {
  const loaded = originalLoadGame(options);
  const Engine = loaded.engineModule.TycoonEngine;
  const originalConfigure = Engine.prototype.configure;
  const originalHireExecutive = Engine.prototype.hireExecutive;

  Engine.prototype.configure = function configureWithExecutiveDiagnostics(config) {
    const result = originalConfigure.call(this, config);
    console.log(`ISSUE_294_MARKET ${JSON.stringify({
      week: this.g.week,
      candidates: (this.g.executiveMarket || []).map(row => ({
        id: row.id,
        role: row.role,
        name: row.name,
        salary: row.salary,
        desiredSalary: row.desiredSalary,
        desiredSO: row.desiredSO
      }))
    })}`);
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
    console.log(`ISSUE_294_HIRE ${JSON.stringify({
      before,
      result: Boolean(result),
      hiredRoles: Object.keys(this.g.executives || {}),
      companyCashAfter: this.g.companyCash,
      latestNews: this.g.news?.[0] || null
    })}`);
    return result;
  };

  return loaded;
};

require('./normal-start-ipo-balance-audit-test');
