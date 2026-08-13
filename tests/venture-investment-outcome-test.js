'use strict';
// Roadmap 8E.1 minimum core: a venture investment must reach a real exit or write-off
// outcome. Investing already produced an asset on the balance sheet, but neither ending
// touched the books — a failed venture stayed on the balance sheet at cost forever, and
// an IPO conversion created listed shares with a zero cost basis, so the entire holding
// was recognised as profit a second time when those shares were sold.
const assert = require('node:assert');
const { loadGame } = require('./harness');

function createEngine(loaded) {
  const engine = new loaded.engineModule.TycoonEngine();
  engine.g.companyCash = 500_000_000;
  engine.g.companyDebt = 0;
  delete engine.g.finance;
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = 'normal';
  engine.g.companyName = 'Venture Co';
  engine.g.departments.investment = { level: 1 };
  engine.g.hasHeadOffice = true;
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

// --- a failed venture leaves the balance sheet and books the loss ---------
{
  const loaded = loadGame({ headless: true });
  const engine = createEngine(loaded);
  assert.equal(balanceGap(loaded, engine), 0, 'the sheet balances before investing');

  const startup = engine.g.startups[0];
  assert.ok(engine.investStartup(startup.id, 20_000_000, 'company'), 'the company can invest');
  assert.equal(startup.totalInvestedCompany, 20_000_000, 'the cost basis is recorded');
  assert.equal(balanceGap(loaded, engine), 0, 'investing keeps the sheet balanced');
  const nonOperatingBefore = nonOperating(loaded, engine);

  assert.ok(engine.writeOffStartup(startup, 'テスト'), 'a held venture can be written off');
  assert.equal(startup.totalInvestedCompany, 0, 'the cost basis is cleared');
  assert.equal(startup.ownedCompany, 0, 'the company stake is cleared');
  assert.equal(startup.ownedPersonal, 0, 'the personal stake is cleared');
  assert.equal(balanceGap(loaded, engine), 0, 'writing off keeps the sheet balanced');
  assert.ok(loaded.modules.finance.validate(engine.g).ok, 'the ledger stays valid');
  assert.equal(
    nonOperating(loaded, engine) - nonOperatingBefore,
    -20_000_000,
    'the whole cost basis is recognised as a loss'
  );
}

// --- writing off twice does not double count ------------------------------
{
  const loaded = loadGame({ headless: true });
  const engine = createEngine(loaded);
  const startup = engine.g.startups[0];
  engine.investStartup(startup.id, 15_000_000, 'company');
  assert.ok(engine.writeOffStartup(startup, 'テスト'), 'the first write-off books the loss');
  const afterFirst = nonOperating(loaded, engine);
  assert.equal(engine.writeOffStartup(startup, 'テスト'), false, 'a second write-off is a no-op');
  assert.equal(nonOperating(loaded, engine), afterFirst, 'the loss is not recognised twice');
  assert.equal(balanceGap(loaded, engine), 0, 'the sheet stays balanced');
}

// --- a venture held only personally has nothing to write off --------------
{
  const loaded = loadGame({ headless: true });
  const engine = createEngine(loaded);
  engine.g.personalCash = 100_000_000;
  const startup = engine.g.startups[0];
  assert.ok(engine.investStartup(startup.id, 10_000_000, 'personal'), 'the founder can invest personally');
  assert.equal(startup.totalInvestedCompany, 0, 'the company has no cost basis');
  const before = nonOperating(loaded, engine);
  assert.equal(engine.writeOffStartup(startup, 'テスト'), false, 'there is no company loss to book');
  assert.equal(nonOperating(loaded, engine), before, 'company results are untouched');
  assert.equal(startup.totalInvestedPersonal, 0, 'the personal cost basis is cleared');
  assert.equal(balanceGap(loaded, engine), 0, 'the sheet stays balanced');
}

// --- an exit carries the cost basis into the listed shares ---------------
{
  const loaded = loadGame({ headless: true });
  const engine = createEngine(loaded);
  const startup = engine.g.startups[1];
  assert.ok(engine.investStartup(startup.id, 30_000_000, 'company'), 'the company can invest');
  const nonOperatingBefore = nonOperating(loaded, engine);

  engine.listStartup(startup);
  const holding = engine.g.companyStocks[startup.ipoStockID];
  assert.ok(holding, 'the exit produces a listed holding');
  assert.ok(holding.qty > 0, 'the holding has shares');
  assert.equal(
    Math.round(holding.qty * holding.avg),
    30_000_000,
    'the listed holding carries the original cost basis'
  );
  assert.equal(startup.totalInvestedCompany, 0, 'the venture cost basis is transferred out');
  assert.equal(balanceGap(loaded, engine), 0, 'converting keeps the sheet balanced');
  assert.ok(loaded.modules.finance.validate(engine.g).ok, 'the ledger stays valid');
  assert.equal(
    nonOperating(loaded, engine),
    nonOperatingBefore,
    'the conversion itself recognises no gain: the gain belongs to the eventual sale'
  );
}

// --- selling after an exit recognises only the real gain ------------------
{
  const loaded = loadGame({ headless: true });
  const engine = createEngine(loaded);
  const startup = engine.g.startups[1];
  engine.investStartup(startup.id, 30_000_000, 'company');
  engine.listStartup(startup);

  const stockID = startup.ipoStockID;
  const holding = engine.g.companyStocks[stockID];
  const listed = engine.g.market.find(row => row.id === stockID);
  assert.ok(listed, 'the venture is listed');

  const execution = engine.stockExecution(listed, holding.qty, 'sell');
  const costBasis = execution.filled * holding.avg;
  const proceeds = execution.total;
  const expectedGain = Math.round(proceeds - costBasis);
  const nonOperatingBefore = nonOperating(loaded, engine);

  assert.ok(engine.sellStock(stockID, holding.qty, 'company'), 'the listed holding can be sold');
  const recognised = Math.round(nonOperating(loaded, engine) - nonOperatingBefore);
  assert.equal(recognised, expectedGain, 'only the gain over the cost basis is recognised');
  assert.ok(
    recognised < Math.round(proceeds),
    'the proceeds are not recognised as pure profit, which a zero cost basis would have caused'
  );
  assert.equal(balanceGap(loaded, engine), 0, 'selling keeps the sheet balanced');
  assert.ok(loaded.modules.finance.validate(engine.g).ok, 'the ledger stays valid');
}

console.log('venture investment outcome tests passed');
