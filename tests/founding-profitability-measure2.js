'use strict';

// Founding-route measurement: use the normal engine paths, deterministic seeds, the cheapest
// available tenant, and observe actual cash/profit for the opening week plus the following weeks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

const IDS = ['ramen', 'conveni', 'gym', 'realEstateAgency'];
const EXPECTED_STORE_COSTS = { ramen: 1_700_000, conveni: 4_300_000, gym: 14_000_000, realEstateAgency: 4_800_000 };
const seeds = [190826041];
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

const loaded = loadGame({ random: lcg(seeds[0]) });
function measure(businessID, seed) {
  const engine = new loaded.modules.engine.TycoonEngine(loaded.modules.engine.createInitialState({ configured: true }));
  engine.g.configured = true;
  const tenant = engine.g.tenants.filter(t => !t.occupiedBy).sort((a, b) => a.deposit - b.deposit || a.id.localeCompare(b.id))[0];
  const upfront = engine.business(businessID).storeCost + tenant.deposit;
  const ordinaryBorrowing = Math.min(Math.max(0, upfront - engine.g.companyCash), Math.floor(engine.companyCreditLimit() - engine.g.companyDebt));
  if (ordinaryBorrowing > 0) assert.equal(engine.borrow(ordinaryBorrowing, 'company'), true);
  const before = engine.estimateStoreOpening({ tenantID: tenant.id, businessID, operatingHours: 3 });
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID, name: `${businessID} 1号店`, operatingHours: 3 }), true);
  const store = engine.g.stores.at(-1), rows = [];
  for (let i = 0; i < before.weeksToOpen + 8; i++) {
    assert.notEqual(engine.advanceWeek(false), false);
    rows.push({ week: engine.g.week, cash: engine.g.companyCash, debt: engine.g.companyDebt, status: store.status, profit: store.lastProfit });
  }
  const operating = rows.filter(row => row.status === 'open');
  assert.equal(loaded.modules.finance.validate(engine.g).ok, true, `${businessID} accounting must balance`);
  return { businessID, seed, storeCost: engine.business(businessID).storeCost, upfront, ordinaryBorrowing, startupLoan: before.startupLoan, opened: operating.length > 0,
    openingProfit: operating[0]?.profit, averageOpenProfit: operating.reduce((sum, row) => sum + row.profit, 0) / operating.length,
    minimumCash: Math.min(...rows.map(row => row.cash)), endingCash: rows.at(-1).cash, gameOver: engine.g.gameOver };
}

const appSource = fs.readFileSync(require('node:path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
assert.match(appSource, /ジム開業ローン/);
assert.match(appSource, /ローンを組んで出店する/);

const results = IDS.flatMap(id => seeds.map(seed => measure(id, seed)));
for (const row of results) {
  assert.equal(row.storeCost, EXPECTED_STORE_COSTS[row.businessID], `${row.businessID} storeCost must stay unchanged`);
  assert.equal(row.opened, true, `${row.businessID} must open in standard play`);
  assert.equal(row.gameOver, false, `${row.businessID} must remain solvent through the measured opening period`);
  assert.ok(row.minimumCash >= 0, `${row.businessID} must not run out of cash during the measured opening period`);
  if (row.businessID === 'gym') {
    assert.equal(row.startupLoan?.eligible, true, 'only the first gym may use the startup loan after ordinary credit');
    assert.ok(row.startupLoan.annualRate > 0 && row.startupLoan.weeklyPayment > 0 && row.startupLoan.term === 104, 'gym startup funding must carry interest and scheduled repayment');
  } else assert.equal(row.startupLoan, null, `${row.businessID} must not receive gym startup funding`);
}

console.log(`FOUNDING_PROFITABILITY_MEASURE2 ${JSON.stringify(results)}`);
