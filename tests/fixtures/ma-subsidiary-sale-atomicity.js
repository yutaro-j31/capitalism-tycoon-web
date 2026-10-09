'use strict';
// Acquisitions are fixture setup before any fault is installed, matching PR #925.
// Keep the actual installed sale method and production save/load path in both runtimes.
function prepareSale(modules, count = 1) {
  const game = new modules.engine.TycoonEngine(modules.engine.createInitialState({ configured: true, seed: 0x19be5702 }));
  game.g.companyCash = 1_000_000_000;
  game.g.finance = modules.finance.defaultFinanceState(game.g);
  game.g.departments.investment = { name: '投資部', established: true };
  game.g.acquisitionTargets = Array.from({ length: count }, (_, i) => ({
    id: `audit-sale-target-${i}`, name: `Audit Sale Subsidiary ${i}`, domain: 'SaaS',
    valuation: 100_000_000 + i * 10_000_000, sales: 80_000_000, operatingProfit: 8_000_000,
    growth: .1, risk: .1, synergy: .1, friendly: true, expiresWeek: 99
  }));
  for (const target of [...game.g.acquisitionTargets]) {
    if (game.acquireTarget(target.id, 'friendly') !== true) throw new Error('sale fixture acquisition failed');
  }
  if (!modules.finance.validate(game.g).ok) throw new Error('sale fixture accounting invalid');
  return game;
}
function economic(g) {
  return JSON.parse(JSON.stringify({
    companyCash: g.companyCash, personalCash: g.personalCash,
    maSubsidiaries: g.maSubsidiaries, goodwillRecords: g.goodwillRecords, totalMAGain: g.totalMAGain,
    finance: g.finance, simulationRng: g.simulationRng,
    sharesOut: g.sharesOut, founderShares: g.founderShares, treasuryBuybackShares: g.treasuryBuybackShares,
    companyStocks: g.companyStocks, personalStocks: g.personalStocks,
    news: g.news, saveVersion: g.saveVersion
  }));
}
module.exports = { prepareSale, economic };
