// CLAUDE.md's investment-company founding route must be able to reach IPO with zero
// stores, matching Coffee Inc 2's real IPO conditions (board + CFO, sustained profit,
// minimum shares issued) which have no store-count requirement at all. Before this test's
// companion change, ipoMissingReasons() unconditionally required stores.length>=3, which
// made IPO permanently unreachable on the investment route regardless of profit or
// company value -- this test proves that gate is gone, and that nothing else was loosened
// along with it.
const assert = require('node:assert');
const { loadGame } = require('./harness');

let seed = 0x19be5702 >>> 0;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const { engineModule, modules } = loadGame({ random, isolatedLegacyIndex: true });
const { finance } = modules;
const game = new engineModule.TycoonEngine();

game.configure({
  playerName: '投資監査者',
  companyName: '投資監査ホールディングス',
  difficulty: 'normal',
  scenario: 'standard'
});
assert.equal(game.g.configured, true, 'initial setup must complete');
assert.equal(game.g.stores.length, 0, 'precondition: no stores opened yet');

// This is a capitalized release-audit scenario, matching the existing pattern in
// tests/v1-progression-gate-test.js: shorten waiting time without bypassing production
// action methods or their unlock conditions.
game.g.companyCash = 2_000_000_000;
game.g.finance = finance.defaultFinanceState(game.g);
const personalCashBeforeSetup = game.g.personalCash;
const personalStocksBeforeSetup = JSON.stringify(game.g.personalStocks);

const office = game.g.rentalOffices.find(row => row.grade === 'C') || game.g.rentalOffices[0];
assert.ok(office, 'head-office candidate must exist');
assert.equal(game.contractOffice(office.id), true, 'head office must be contractible with zero stores');

// 1. Store-operations departments stay blocked at store-zero (unchanged by this feature).
for (const id of ['hr', 'product', 'operations', 'marketing', 'dx']) {
  assert.equal(game.establishDepartment(id), false, `store-zero must not unlock ${id}`);
}
// 2. investment and accounting are the two departments this route needs, and both are
// reachable at store-zero (accounting is required by ipoMissingReasons() itself).
assert.equal(game.establishDepartment('investment'), true, 'investment department must unlock at store-zero');
assert.equal(game.establishDepartment('accounting'), true, 'accounting department must unlock at store-zero');

// 3. Company-account VC investment and consolidation -- no store, no personal-asset
// side effect. Mirrors the conglomerate step in v1-progression-gate-test.js but with
// zero stores throughout.
const startup = game.g.startups.find(row => row.alive && !row.subsidiary);
assert.ok(startup, 'startup candidate must exist without any store having been opened');
const ticket = Math.max(startup.minTicket, 200_000_000);
assert.equal(game.investStartup(startup.id, ticket, 'company'), true, 'first company VC investment must succeed');
assert.equal(game.investStartup(startup.id, ticket, 'company'), true, 'follow-on company VC investment must succeed');
assert.ok(startup.ownedCompany >= 0.5, 'company ownership must reach subsidiary threshold');
assert.equal(game.makeSubsidiary(startup.id), true, 'startup must convert to consolidated subsidiary');
assert.equal(game.g.subsidiaries.length, 1, 'one VC subsidiary must exist');
assert.equal(game.g.stores.length, 0, 'subsidiary consolidation must not create or require a store');
assert.equal(game.g.personalCash, personalCashBeforeSetup, 'company-account VC investment must not touch personalCash');
assert.equal(JSON.stringify(game.g.personalStocks), personalStocksBeforeSetup, 'company-account VC investment must not touch personalStocks');

// 4. Board: CEO/CFO hiring negotiation is excluded from this deterministic gate (same
// exclusion as v1-progression-gate-test.js); establishBoard() itself is exercised for real.
game.g.executives.CEO = { role: 'CEO', name: '投資監査CEO', skill: 80, salary: 4_000_000 };
game.g.executives.CFO = { role: 'CFO', name: '投資監査CFO', skill: 80, salary: 3_000_000 };
assert.equal(game.establishBoard(), true, 'board must be establishable with CEO and CFO and zero stores');

// 5. Trailing 52-week profit, seeded the same way as v1-progression-gate-test.js's
// capitalized audit route.
const reportStartWeek = Math.max(1, game.g.week - 51);
game.g.reports = Array.from({ length: 52 }, (_, index) => ({
  week: reportStartWeek + index,
  sales: 5_000_000,
  expenses: 3_000_000,
  profit: 2_000_000
}));
game.g.lastReport = game.g.reports[game.g.reports.length - 1];

// 6. The core assertion: IPO must be fully reachable, and the store-count reason string
// must never appear (not merely unmet -- it must not exist as a possible reason at all).
const missing = game.ipoMissingReasons();
assert.ok(!missing.includes('店舗3店'), 'store-count must never be a listed IPO blocker');
assert.deepEqual(missing, [], 'zero-store investment route must satisfy every remaining IPO condition');
assert.equal(game.g.stores.length, 0, 'IPO eligibility must be reached without ever opening a store');

const capitalSurplusBeforeIPO = game.g.finance.balances.capitalSurplus;
assert.equal(game.executeIPO('東証グロース'), true, 'zero-store investment company must be able to execute IPO');
assert.equal(game.g.publicCompany, true, 'company must be public after IPO');
assert.equal(game.g.stores.length, 0, 'company remains store-less after going public');
assert.ok(game.g.market.some(row => row.id === game.g.ticker), 'player stock must be added to the market');
const ipoTransaction = game.g.finance.transactions.find(row => row.sourceType === 'parentCompanyIPO');
assert.ok(ipoTransaction, 'parent IPO equity financing transaction must exist');
assert.ok(ipoTransaction.cashEffect > 0 && ipoTransaction.equityEffect > 0, 'parent IPO transaction must increase cash and equity');
assert.ok(game.g.finance.balances.capitalSurplus > capitalSurplusBeforeIPO, 'capitalSurplus must increase from the IPO raise');

const validation = finance.validate(game.g);
assert.equal(validation.ok, true, (validation.errors || []).join('\n'));

// 7. Determinism: same seed, same actions -> identical resulting IPO outcome.
function runOnce() {
  let localSeed = 0x19be5702 >>> 0;
  const localRandom = () => {
    localSeed = (localSeed * 1664525 + 1013904223) >>> 0;
    return localSeed / 0x100000000;
  };
  const { engineModule: mod, modules: mods } = loadGame({ random: localRandom, isolatedLegacyIndex: true });
  const g = new mod.TycoonEngine();
  g.configure({ playerName: '投資監査者', companyName: '投資監査ホールディングス', difficulty: 'normal', scenario: 'standard' });
  g.g.companyCash = 2_000_000_000;
  g.g.finance = mods.finance.defaultFinanceState(g.g);
  const off = g.g.rentalOffices.find(row => row.grade === 'C') || g.g.rentalOffices[0];
  g.contractOffice(off.id);
  g.establishDepartment('investment');
  g.establishDepartment('accounting');
  const su = g.g.startups.find(row => row.alive && !row.subsidiary);
  const tk = Math.max(su.minTicket, 200_000_000);
  g.investStartup(su.id, tk, 'company');
  g.investStartup(su.id, tk, 'company');
  g.makeSubsidiary(su.id);
  g.g.executives.CEO = { role: 'CEO', name: '投資監査CEO', skill: 80, salary: 4_000_000 };
  g.g.executives.CFO = { role: 'CFO', name: '投資監査CFO', skill: 80, salary: 3_000_000 };
  g.establishBoard();
  const startWeek = Math.max(1, g.g.week - 51);
  g.g.reports = Array.from({ length: 52 }, (_, index) => ({ week: startWeek + index, sales: 5_000_000, expenses: 3_000_000, profit: 2_000_000 }));
  g.g.lastReport = g.g.reports[g.g.reports.length - 1];
  g.executeIPO('東証グロース');
  return JSON.stringify({ publicCompany: g.g.publicCompany, stores: g.g.stores.length, stockPrice: g.g.stockPrice, sharesOut: g.g.sharesOut, companyCash: g.g.companyCash });
}
assert.equal(runOnce(), runOnce(), 'same seed and actions must produce the same zero-store IPO outcome');

console.log('Investment-route IPO reachability tests passed');
