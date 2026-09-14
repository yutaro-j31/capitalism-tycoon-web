'use strict';

// PE mode T5 (docs/PE_MODE_TASKS.md): state.peFirm and a single fund's lifecycle (formation,
// investment period, term, and the rule that exit proceeds are distributed immediately and
// never reinvested). No fund-formation UI and no deal-financing wiring exist yet -- this
// exercises js/pe-fund.js's createFund/processFundsWeek directly, the way a later task's real
// action will eventually call them.

const assert = require('node:assert/strict');
const fs = require('node:fs');

function load() {
  delete globalThis.__capitalismTycoonModules;
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  globalThis.document = { addEventListener() {} };
  globalThis.window = globalThis;
  for (const m of ['../js/runtime.js', '../js/data.js', '../js/store-market-environment.js', '../js/workforce.js', '../js/supply.js', '../js/competitor.js', '../js/competitor-projects.js', '../js/competitor-entry.js', '../js/competitor-credit.js', '../js/competitor-distress.js', '../js/market.js', '../js/finance.js', '../js/engine.js', '../js/save-v9.js', '../js/completion.js', '../js/pe-fund.js']) {
    delete require.cache[require.resolve(m)];
    require(m);
  }
  const modules = globalThis.__capitalismTycoonModules;
  return { modules, TycoonEngine: modules.engine.TycoonEngine, pf: modules.peFund };
}

// Every runtime module is designed to register once per process, so this file (like
// tests/pe-rivals-test.js) calls load() once and reuses the handles across scenarios.
const { TycoonEngine, pf } = load();

// 1. New games start with peFirm unlocked:false and an empty fund list.
{
  const e = new TycoonEngine();
  assert.equal(e.g.peFirm.unlocked, false);
  assert.deepEqual(e.g.peFirm.funds, []);
  assert.equal(e.g.peFirm.trackRecord.score, 0);
  assert.deepEqual(e.g.peFirm.trackRecord.exits, []);
}

// 2. Old saves without peFirm at all load without error and end up unlocked:false, with no
// other behavior change (companyCash / week / stores are untouched by normalize()).
{
  const legacy = new TycoonEngine().g;
  delete legacy.peFirm;
  delete legacy.currentCompanyFoundedInvestment;
  legacy.saveVersion = 9;
  const before = { companyCash: legacy.companyCash, week: legacy.week, storesLength: legacy.stores.length };
  const loaded = new TycoonEngine(legacy);
  assert.equal(loaded.g.peFirm.unlocked, false, 'legacy save must default peFirm.unlocked to false');
  assert.equal(loaded.g.companyCash, before.companyCash, 'legacy save load must not alter companyCash');
  assert.equal(loaded.g.week, before.week, 'legacy save load must not alter week');
  assert.equal(loaded.g.stores.length, before.storesLength, 'legacy save load must not alter stores');
}

// 3. A malformed peFirm value (wrong shape) is repaired rather than crashing.
{
  const legacy = new TycoonEngine().g;
  legacy.peFirm = 'not-an-object';
  legacy.saveVersion = 9;
  const loaded = new TycoonEngine(legacy);
  assert.equal(loaded.g.peFirm.unlocked, false);
  assert.deepEqual(loaded.g.peFirm.funds, []);
}

// 4. createFund produces the documented shape with 10-year term / 5-year investment period.
{
  const e = new TycoonEngine();
  e.g.week = 100;
  // T21: GP出資は個人資産から出るため、拠出できるだけの現金が要る（足りなければ組成は拒否される）。
  e.g.personalCash = 1_000_000_000;
  const fund = pf.createFund(e.g, { size: 2_800_000_000, gpCommit: 500_000_000, terms: { fee: .016, carry: .16, hurdle: .10 } });
  assert.equal(e.g.personalCash, 500_000_000, 'GP出資ぶんだけ個人資産が減る');
  assert.equal(fund.lpContributed, 2_300_000_000, 'LP拠出は規模−GP出資');
  assert.equal(fund.size, 2_800_000_000);
  assert.equal(fund.gpCommit, 500_000_000);
  assert.equal(fund.y0, 100);
  assert.equal(fund.investmentDeadlineWeek, 100 + pf.INVESTMENT_PERIOD_WEEKS);
  assert.equal(fund.deadlineWeek, 100 + pf.FUND_TERM_WEEKS);
  assert.equal(pf.INVESTMENT_PERIOD_WEEKS, 260, '5-year investment period in weeks');
  assert.equal(pf.FUND_TERM_WEEKS, 520, '10-year fund term in weeks');
  assert.equal(fund.status, 'investing');
  assert.equal(fund.cash, fund.size, 'T5 calls the full committed size upfront (no capital-call schedule yet)');
  assert.equal(fund.distributed, 0);
  assert.deepEqual(fund.deals, []);
  assert.equal(e.g.peFirm.funds.length, 1);
  assert.equal(e.g.peFirm.funds[0], fund);
}

// 5. Weekly processing advances a fund past its investment deadline into 'harvesting', and
// past its term deadline into 'closed'.
{
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size: 1_000_000_000 });
  e.g.week = fund.investmentDeadlineWeek + 1;
  pf.processFundsWeek(e.g, e.g.week);
  assert.equal(fund.status, 'harvesting', 'past the investment deadline the fund must stop investing');
  assert.notEqual(fund.status, 'closed', 'the investment deadline alone must not close the fund');

  e.g.week = fund.deadlineWeek + 1;
  pf.processFundsWeek(e.g, e.g.week);
  assert.equal(fund.status, 'closed', 'past the term deadline the fund must close');
  assert.equal(fund.closedWeek, e.g.week);
}

// 6. Exit proceeds (here: undeployed capital returned at the investment deadline) are
// distributed immediately and never reinvested -- fund.cash must never be replenished by
// processFundsWeek, only ever drained to fund.distributed.
{
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size: 1_000_000_000 });
  assert.equal(fund.cash, 1_000_000_000);
  e.g.week = fund.investmentDeadlineWeek + 1;
  pf.processFundsWeek(e.g, e.g.week);
  assert.equal(fund.cash, 0, 'undeployed capital must be paid out, not left sitting in the fund');
  assert.equal(fund.distributed, 1_000_000_000, 'the full undeployed amount must be distributed at par (1.0x)');
  assert.equal(fund.undeployedReturned, 1_000_000_000);
  // advancing many more weeks (still investing-adjacent) must not add cash back
  for (let w = e.g.week + 1; w <= fund.deadlineWeek - 1; w += 25) { e.g.week = w; pf.processFundsWeek(e.g, w); }
  assert.equal(fund.cash, 0, 'fund.cash must never be replenished once distributed -- no reinvestment');
}

// 7. processFundsWeek is idempotent for a given week: calling it twice for the same week (or
// for a week already passed) must not double-distribute.
{
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size: 500_000_000 });
  e.g.week = fund.investmentDeadlineWeek + 1;
  pf.processFundsWeek(e.g, e.g.week);
  const distributedOnce = fund.distributed;
  pf.processFundsWeek(e.g, e.g.week);
  assert.equal(fund.distributed, distributedOnce, 'reprocessing the same week must not distribute again');
}

// 8. Multiple funds are processed independently (different y0, different deadlines).
{
  const e = new TycoonEngine();
  e.g.week = 1;
  const early = pf.createFund(e.g, { size: 300_000_000, y0: 1 });
  const late = pf.createFund(e.g, { size: 400_000_000, y0: 200 });
  e.g.week = early.investmentDeadlineWeek + 1;
  pf.processFundsWeek(e.g, e.g.week);
  assert.equal(early.status, 'harvesting');
  assert.equal(late.status, 'investing', 'a later fund must not be affected by an earlier fund crossing its own deadline');
}

// 9. The weekly fund lifecycle also advances through the real engine.advanceWeek() flow, not
// only via direct processFundsWeek calls.
{
  const e = new TycoonEngine();
  e.g.configured = true;
  const fund = pf.createFund(e.g, { size: 200_000_000, y0: e.g.week });
  for (let i = 0; i < pf.INVESTMENT_PERIOD_WEEKS + 2; i++) e.advanceWeek(false);
  assert.equal(fund.status, 'harvesting', 'advanceWeek must drive the same fund lifecycle as processFundsWeek');
  assert.equal(fund.cash, 0);
  assert.equal(fund.distributed, 200_000_000);
}

// 10. currentCompanyFoundedInvestment is backfilled for old saves and defaults sanely for new
// games (used by T6's personal MOIC calculation).
{
  const e = new TycoonEngine();
  assert.equal(e.g.currentCompanyFoundedInvestment, e.g.companyCash, 'a fresh game\'s founding investment must match its starting companyCash');
}

// 11. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-fund.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe fund tests passed');
