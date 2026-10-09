'use strict';
// Same zero-store investment route and actions as investment-route-ipo-reachability-test.
// Browser tests use this function in the loaded production runtime as well.
function prepareIPO(modules) {
  const check = {
    equal(a, b, message) { if (a !== b) throw new Error(message || `${a} !== ${b}`); },
    ok(value, message) { if (!value) throw new Error(message || 'IPO fixture precondition'); }
  };
  const { finance } = modules;
  const game = new modules.engine.TycoonEngine();
  game.configure({
    playerName: '投資監査者',
    companyName: '投資監査ホールディングス',
    difficulty: 'normal',
    scenario: 'standard'
  });
  check.equal(game.g.configured, true, 'initial setup must complete');
  check.equal(game.g.stores.length, 0, 'precondition: no stores opened yet');

  // This is a capitalized release-audit scenario, matching the existing pattern in
  // tests/v1-progression-gate-test.js: shorten waiting time without bypassing production
  // action methods or their unlock conditions.
  game.g.companyCash = 2_000_000_000;
  game.g.finance = finance.defaultFinanceState(game.g);
  const personalCashBeforeSetup = game.g.personalCash;
  const personalStocksBeforeSetup = JSON.stringify(game.g.personalStocks);

  const office = game.g.rentalOffices.find(row => row.grade === 'C') || game.g.rentalOffices[0];
  check.ok(office, 'head-office candidate must exist');
  check.equal(game.contractOffice(office.id), true, 'head office must be contractible with zero stores');

  // 1. Store-operations departments stay blocked at store-zero (unchanged by this feature).
  for (const id of ['hr', 'operations', 'marketing', 'dx']) {
    check.equal(game.establishDepartment(id), false, `store-zero must not unlock ${id}`);
  }
  // 2. investment and accounting are the two departments this route needs, and both are
  // reachable at store-zero (accounting is required by ipoMissingReasons() itself).
  check.equal(game.establishDepartment('investment'), true, 'investment department must unlock at store-zero');
  check.equal(game.establishDepartment('accounting'), true, 'accounting department must unlock at store-zero');

  // 3. Company-account VC investment and consolidation -- no store, no personal-asset
  // side effect. Mirrors the conglomerate step in v1-progression-gate-test.js but with
  // zero stores throughout.
  const startup = game.g.startups.find(row => row.alive && !row.subsidiary);
  check.ok(startup, 'startup candidate must exist without any store having been opened');
  const ticket = Math.max(startup.minTicket, 200_000_000);
  check.equal(game.investStartup(startup.id, ticket, 'company'), true, 'first company VC investment must succeed');
  check.equal(game.investStartup(startup.id, ticket, 'company'), true, 'follow-on company VC investment must succeed');
  check.ok(startup.ownedCompany >= 0.5, 'company ownership must reach subsidiary threshold');
  check.equal(game.makeSubsidiary(startup.id), true, 'startup must convert to consolidated subsidiary');
  check.equal(game.g.subsidiaries.length, 1, 'one VC subsidiary must exist');
  check.equal(game.g.stores.length, 0, 'subsidiary consolidation must not create or require a store');
  check.equal(game.g.personalCash, personalCashBeforeSetup, 'company-account VC investment must not touch personalCash');
  check.equal(JSON.stringify(game.g.personalStocks), personalStocksBeforeSetup, 'company-account VC investment must not touch personalStocks');

  // 4. Board: CEO/CFO hiring negotiation is excluded from this deterministic gate (same
  // exclusion as v1-progression-gate-test.js); establishBoard() itself is exercised for real.
  game.g.executives.CEO = { role: 'CEO', name: '投資監査CEO', skill: 80, salary: 4_000_000 };
  game.g.executives.CFO = { role: 'CFO', name: '投資監査CFO', skill: 80, salary: 3_000_000 };
  check.equal(game.establishBoard(), true, 'board must be establishable with CEO and CFO and zero stores');

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

  check.equal(game.ipoMissingReasons().length, 0, 'IPO must be reachable');
  return game;
}
function economic(g) {
  return JSON.parse(JSON.stringify({
    publicCompany: g.publicCompany, sharesOut: g.sharesOut, founderShares: g.founderShares,
    companyCash: g.companyCash, personalCash: g.personalCash, stockPrice: g.stockPrice,
    ticker: g.ticker, selectedListingMarket: g.selectedListingMarket,
    founderOwnershipRatio: g.founderOwnershipRatio, externalShareholderRatio: g.externalShareholderRatio,
    market: g.market, finance: g.finance, peFirm: g.peFirm, peNetwork: g.peNetwork,
    simulationRng: g.simulationRng, scenarioProgress: g.scenarioProgress, missions: g.missions,
    news: g.news, companyStocks: g.companyStocks, personalStocks: g.personalStocks
  }));
}
module.exports = { prepareIPO, economic };
