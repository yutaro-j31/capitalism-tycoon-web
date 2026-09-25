'use strict';
// Phase 2 for roadmap 8E.1: the unit test calls the write-off directly, so it would still
// pass if nothing in the weekly loop ever invoked it. This test proves the outcome is
// reached by playing: a funded venture runs out of runway during ordinary week advancement
// and the loss lands on the company's books without breaking the balance sheet.
const assert = require('node:assert');
const { loadGame } = require('./harness');

// Since #731 the weekly failure roll draws from the save's stream, not the host Math.random.
// Each attempt positions that real stream with the reseed hook; the weekly loop still makes
// the roll, so the test proves the write-off is reached by ordinary play. Seeds are tried in
// order and the first world where the venture fails is used.
const MAX_WEEKS = 60;
const MAX_SEEDS = 16;

function createEngine(loaded) {
  const engine = new loaded.engineModule.TycoonEngine();
  engine.g.companyCash = 500_000_000;
  engine.g.companyDebt = 0;
  delete engine.g.finance;
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = 'normal';
  engine.g.companyName = 'Venture Reachability Co';
  engine.g.departments.investment = { level: 1 };
  return engine;
}

function balanceGap(loaded, engine) {
  const sheet = loaded.modules.finance.buildStatements(engine.g, String(engine.g.week)).balanceSheet;
  return Math.round(
    (sheet.assets.totalAssets - (sheet.liabilities.totalLiabilities + sheet.equity.totalEquity)) * 100
  ) / 100;
}

function nonOperating(loaded, engine) {
  return loaded.modules.finance.buildStatements(engine.g, String(engine.g.week)).profitAndLoss.otherNonOperating;
}

function run(seed) {
  const loaded = loadGame({ headless: true, random: () => 0.5 });
  const engine = createEngine(loaded);
  loaded.modules.simulationRng.reseed(engine.g, seed);
  const startup = engine.g.startups[0];

  assert.ok(engine.investStartup(startup.id, 25_000_000, 'company'), 'the company invests in a venture');
  const invested = startup.totalInvestedCompany;
  assert.ok(invested > 0, 'the investment creates a cost basis');
  const nonOperatingBefore = nonOperating(loaded, engine);

  // A venture near the end of its runway is an ordinary situation, not a contrived one:
  // the weekly loop is what has to notice it.
  startup.runwayWeeks = 3;

  let failedWeek = null;
  for (let index = 0; index < MAX_WEEKS; index += 1) {
    engine.advanceWeek();
    assert.equal(balanceGap(loaded, engine), 0, `the sheet stays balanced at week ${engine.g.week}`);
    if (!startup.alive && failedWeek === null) failedWeek = engine.g.week;
    if (failedWeek !== null) break;
  }

  return {
    seed,
    failedWeek,
    invested,
    costBasisAfter: startup.totalInvestedCompany,
    ownedAfter: startup.ownedCompany,
    recognised: Math.round(nonOperating(loaded, engine) - nonOperatingBefore),
    balanced: balanceGap(loaded, engine) === 0,
    ledgerValid: loaded.modules.finance.validate(engine.g).ok
  };
}

let result = null;
for (let seed = 1; seed <= MAX_SEEDS && !result; seed += 1) {
  const attempt = run(seed);
  if (attempt.failedWeek !== null) result = attempt;
}
result = result || { failedWeek: null };

assert.ok(
  result.failedWeek !== null,
  `a venture that runs out of runway must fail during ordinary play within ${MAX_WEEKS} weeks in one of ${MAX_SEEDS} seeded worlds`
);
assert.equal(result.costBasisAfter, 0, 'weekly play clears the cost basis when the venture fails');
assert.equal(result.ownedAfter, 0, 'weekly play clears the stake when the venture fails');
assert.equal(
  result.recognised,
  -result.invested,
  'the full cost basis is recognised as a loss without being called directly'
);
assert.ok(result.balanced, 'the balance sheet survives the failure');
assert.ok(result.ledgerValid, 'the ledger stays valid through the failure');

// The same world must produce the same outcome every time.
const again = run(result.seed);
assert.equal(again.failedWeek, result.failedWeek, 'the failure week is deterministic');
assert.equal(again.recognised, result.recognised, 'the recognised loss is deterministic');

console.log(
  `venture write-off reachability: seed ${result.seed} failed at week ${result.failedWeek}, ` +
  `loss ${result.recognised} recognised from a ${result.invested} cost basis`
);
