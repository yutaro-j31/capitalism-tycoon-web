'use strict';
// Audit fix: buyStock()/sellStock() (js/engine.js) capped the per-order price impact at 3%
// but placed no limit on the quantity itself. Any order size produced at most a 3% move, so a
// player could buy/sell an arbitrary multiple of a stock's issued shares in a single order --
// this affects the whole stock market, including the player's own company. The fix caps a
// single order at STOCK_ORDER_MAX_SHARE_OF_ISSUED (5%) of issuedShares, clamping oversized
// requests down instead of rejecting them outright.
const assert = require('node:assert');
const { loadGame } = require('./harness');

function setup(seed = 1) {
  const { engineModule } = loadGame({ headless: true });
  const e = new engineModule.TycoonEngine();
  e.g.companyCash = 1_000_000_000_000;
  e.g.personalCash = 1_000_000_000_000;
  e.g.companyDebt = 0;
  delete e.g.finance;
  e.normalize();
  e.g.configured = true;
  e.g.departments.investment = { level: 1 };
  return e;
}

// 1. Buying far more than the issued shares still caps at a bounded fraction, not the full request.
{
  const e = setup();
  const stock = e.g.market.find(s => s.id !== e.g.ticker);
  const requested = Math.round(stock.issuedShares * 3); // 3x the entire float in one order
  const before = e.g.personalCash;
  assert.ok(e.buyStock(stock.id, requested, 'personal'), 'an oversized order still succeeds (clamped, not rejected)');
  const holding = e.g.personalStocks[stock.id];
  assert.ok(holding.qty < requested, 'the filled quantity is less than what was requested');
  assert.ok(holding.qty <= stock.issuedShares * 0.05 + 1, 'the filled quantity stays within the per-order cap');
  assert.ok(holding.qty > 0, 'some shares were still bought');
  const spent = before - e.g.personalCash;
  assert.ok(spent < stock.price * requested, 'cash spent reflects the clamped quantity, not the requested one');
}

// 2. The existing 3%-per-order price-impact cap is unaffected for a normal-sized order.
{
  const e = setup();
  const stock = e.g.market.find(s => s.id !== e.g.ticker);
  const priceBefore = stock.price;
  const smallQty = Math.max(1, Math.floor(stock.issuedShares * 0.01)); // well under the 5% cap
  assert.ok(e.buyStock(stock.id, smallQty, 'personal'), 'a normal-sized order still succeeds');
  const holding = e.g.personalStocks[stock.id];
  assert.equal(holding.qty, smallQty, 'a normal-sized order is filled in full, unclamped');
  assert.ok(stock.price > priceBefore, 'price still moves up on a buy');
  assert.ok(stock.price <= priceBefore * 1.03 + 1e-6, 'price impact stays within the existing 3% cap');
}

// 3. sellStock() has the same cap -- selling far more than the per-order limit still clamps.
{
  const e = setup();
  const stock = e.g.market.find(s => s.id !== e.g.ticker);
  // Buy in tranches to build up a holding above the per-order cap (a whale position acquired
  // over time, the way a real save could end up holding more than one order's worth).
  const target = Math.round(stock.issuedShares * 0.12);
  let guard = 0;
  while ((e.g.personalStocks[stock.id]?.qty ?? 0) < target) {
    guard++; assert.ok(guard <= 10, 'accumulation should finish in a bounded number of orders');
    assert.ok(e.buyStock(stock.id, target, 'personal'), 'buying continues to top up the holding');
  }
  const holdingQtyBefore = e.g.personalStocks[stock.id].qty;
  assert.ok(holdingQtyBefore >= stock.issuedShares * 0.1, 'sanity: the accumulated holding exceeds one order worth');

  const cashBefore = e.g.personalCash;
  assert.ok(e.sellStock(stock.id, holdingQtyBefore, 'personal'), 'selling the whole holding in one call still succeeds (clamped)');
  const remaining = e.g.personalStocks[stock.id]?.qty ?? 0;
  assert.ok(remaining > 0, 'a single sell order could not liquidate the whole oversized holding');
  assert.ok(holdingQtyBefore - remaining <= stock.issuedShares * 0.05 + 1, 'only up to the per-order cap was sold');
  assert.ok(e.g.personalCash > cashBefore, 'proceeds from the partial sale were still credited');
}

// 4. Small-float new listing (~1,000,000 shares, matching a fresh IPO/subsidiary listing scale):
//    throwing a large amount of capital at one order is correctly bounded.
{
  const e = setup();
  const stock = e.g.market.find(s => s.id !== e.g.ticker);
  stock.issuedShares = 1_000_000;
  stock.price = 500;
  stock.marketCap = stock.price * stock.issuedShares;
  const hugeQty = 10_000_000; // 10x the float
  const before = e.g.personalCash;
  assert.ok(e.buyStock(stock.id, hugeQty, 'personal'), 'the order still succeeds, clamped to the small float');
  const holding = e.g.personalStocks[stock.id];
  assert.ok(holding.qty <= 50_000 + 1, 'capped at 5% of the 1,000,000-share float (50,000 shares)');
  assert.ok(holding.qty > 0, 'a bounded, non-zero quantity was still filled');
  assert.ok(before - e.g.personalCash < stock.price * hugeQty, 'only the clamped quantity was paid for, not the full request');
}

// 5. A stock with (near-)zero issued shares refuses the order instead of dividing by ~0.
{
  const e = setup();
  const stock = e.g.market.find(s => s.id !== e.g.ticker);
  stock.issuedShares = 0;
  const before = e.g.personalCash;
  const result = e.buyStock(stock.id, 100, 'personal');
  assert.notEqual(result, true, 'an order on a stock with no issued shares is rejected, not silently filled');
  assert.equal(e.g.personalCash, before, 'no cash moves when the order is rejected');
}

// 6. The player's own listed company stock is subject to the same cap (this closes a hole
//    that could otherwise be used to move the player's own share price/ownership arbitrarily).
{
  const e = setup();
  e.g.publicCompany = true;
  e.g.sharesOut = 1_000_000;
  e.g.stockPrice = 1000;
  if (!e.g.market.find(s => s.id === e.g.ticker)) {
    e.g.market.push({ id: e.g.ticker, name: e.g.companyName, price: e.g.stockPrice, previous: e.g.stockPrice, issuedShares: e.g.sharesOut, marketCap: e.g.stockPrice * e.g.sharesOut, dividendYield: 0, volatility: .05, priceHistory: [] });
  } else {
    const own = e.g.market.find(s => s.id === e.g.ticker);
    own.issuedShares = e.g.sharesOut; own.price = e.g.stockPrice;
  }
  const requested = 900_000; // 90% of the player's own company in one order
  assert.ok(e.buyStock(e.g.ticker, requested, 'personal'), 'buying the player\'s own stock still succeeds (clamped)');
  const holding = e.g.personalStocks[e.g.ticker];
  assert.ok(holding.qty <= e.g.sharesOut * 0.05 + 1, 'own-company purchases are capped the same as any other stock');
}

console.log('stock order quantity cap tests passed');
