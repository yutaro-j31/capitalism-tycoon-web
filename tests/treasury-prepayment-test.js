const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame, findStateIssues } = require('./harness');

const load = loadGame();
for (const file of ['player-debt-service.js', 'treasury-prepayment.js']) {
  const key = file.replace('.js', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  if (!load.modules[key]) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), load.ctx, { filename: file });
}
const { modules } = load;
const { engine, finance, treasuryPrepayment } = modules;

assert.ok(treasuryPrepayment?.__installed, 'treasury prepayment module must be installed');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);
assert.equal(typeof engine.TycoonEngine.prototype.prepayCompanyDebtVoluntarily, 'function');

function makeGame() {
  const state = engine.createInitialState({ configured: true });
  state.companyCash = 30_000_000;
  state.companyDebt = 20_000_000;
  state.finance = finance.defaultFinanceState(state);
  state.finance.loans = [
    { id: 'low', loanID: 'low', status: 'active', principal: 8_000_000, outstandingPrincipal: 8_000_000, interestRate: 0.03 },
    { id: 'high', loanID: 'high', status: 'active', principal: 12_000_000, outstandingPrincipal: 12_000_000, interestRate: 0.08 }
  ];
  return new engine.TycoonEngine(state);
}

const game = makeGame();
assert.deepEqual(game.voluntaryDebtPrepaymentCapacity(), {
  debt: 20_000_000,
  cash: 30_000_000,
  minCash: 5_000_000,
  maxAmount: 20_000_000
});

assert.equal(game.prepayCompanyDebtVoluntarily(10_000_000), true);
assert.equal(game.g.companyCash, 20_000_000);
assert.equal(game.g.companyDebt, 10_000_000);
assert.equal(game.g.finance.loans.find(x => x.id === 'high').outstandingPrincipal, 2_000_000, 'highest-rate loan must be repaid first');
assert.equal(game.g.finance.loans.find(x => x.id === 'low').outstandingPrincipal, 8_000_000);
assert.equal(game.g.finance.voluntaryDebtPrepayments.length, 1);
assert.equal(game.g.finance.voluntaryDebtPrepayments[0].amount, 10_000_000);
const txn = game.g.finance.transactions.find(x => x.sourceType === 'voluntaryDebtPrepayment');
assert.ok(txn, 'voluntary repayment must be recorded in the finance ledger');
assert.equal(txn.cashEffect, -10_000_000);
assert.equal(txn.liabilityEffect, -10_000_000);
assert.equal(finance.validate(game.g).ok, true, finance.validate(game.g).errors.join(' / '));
assert.deepEqual(findStateIssues(game.g).filter(x => !x.startsWith('g.finance.lastStatements.ratios.')), []);

const protectedCash = makeGame();
protectedCash.g.companyCash = 9_000_000;
assert.equal(protectedCash.voluntaryDebtPrepaymentCapacity().maxAmount, 4_000_000);
assert.equal(protectedCash.prepayCompanyDebtVoluntarily(5_000_000), false, 'minimum operating cash must be protected');
assert.equal(protectedCash.g.companyCash, 9_000_000);
assert.equal(protectedCash.g.companyDebt, 20_000_000);

const restored = new engine.TycoonEngine(JSON.parse(JSON.stringify(game.g)));
assert.equal(restored.g.finance.voluntaryDebtPrepayments.length, 1, 'history must survive save/load without save version changes');
assert.equal(restored.voluntaryDebtPrepaymentCapacity().maxAmount, 10_000_000);

console.log('treasury prepayment tests passed');
