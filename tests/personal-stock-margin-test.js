'use strict';

// Personal margin trading: borrow against personally-held stock to buy more of it, with the
// risk that comes with real leverage. js/personal-stock-margin.js reuses
// personal-real-estate-mortgage.js's shape (a product with a rate and an LTV ceiling, borrow /
// prepay, a weekly processing pass) but diverges where the two instruments actually differ --
// interest-only with capitalizing unpaid interest instead of straight-line amortization, and a
// same-week mark-to-market margin call/forced-liquidation trigger instead of an 8-week
// delinquency grace period. These tests pin down both the reused shape (quote ceilings scale
// with maxLTV, borrowing is a pure cash-for-debt swap, prepayment works) and the two custom
// mechanics (interest capitalization, forced liquidation), along with determinism and the
// personal/company asset separation invariant.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function lcg(seed = 1) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function withPortfolio(seed = 1, qty = 1000) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const e = ctx.__ct_engine;
  e.g.configured = true;
  e.g.personalCash = 200_000_000;
  const stock = e.g.market[0];
  assert.equal(e.buyStock(stock.id, qty, 'personal'), true, 'テスト前提: 個人口座で保有株式を作れる');
  return { modules, ctx, e, margin: modules.personalStockMargin, stockID: stock.id };
}

// 1. Registered like every other module here.
{
  const { margin } = withPortfolio();
  assert.ok(margin, 'personalStockMargin モジュールが登録されている');
  assert.equal(margin.__installed, true);
}

// 2. Quotes: available scales with portfolio value and each product's own maxLTV ceiling. The
// bigger ceiling costs more.
{
  const { e, margin } = withPortfolio();
  const value = margin.portfolioValueOf(e.g);
  const quotes = e.getPersonalStockMarginQuotes();
  assert.equal(quotes.length, 2);
  for (const q of quotes) {
    assert.equal(q.available, Math.round(value * q.maxLTV));
    assert.ok(q.eligible);
  }
  const byId = Object.fromEntries(quotes.map(q => [q.id, q]));
  assert.ok(byId.standard.available > byId.conservative.available, '標準型のほうが借入可能額が大きい');
  assert.ok(byId.standard.annualRate > byId.conservative.annualRate, '借入枠が大きい商品のほうが金利は高い');
}

// 3. Borrowing is a pure swap of cash for debt with no arrangement fee: net worth is unchanged.
{
  const { e } = withPortfolio();
  const worthBefore = e.personalNetWorth();
  const cashBefore = e.g.personalCash;
  const quote = e.getPersonalStockMarginQuotes().find(q => q.id === 'standard');
  assert.equal(e.borrowPersonalStockMargin('standard'), true);
  assert.equal(e.g.personalCash, cashBefore + quote.available, '借入額がそのまま個人資金に入る');
  assert.equal(e.personalNetWorth(), worthBefore, '借入自体では純資産は変わらない（現金と負債が相殺）');
  assert.equal(e.getPersonalStockMargin().balance, quote.available);
}

// 4. Cannot open a second loan on a different product without repaying the first, and the
// blocked product reports zero availability rather than silently stacking debt.
{
  const { e } = withPortfolio();
  assert.equal(e.borrowPersonalStockMargin('standard'), true);
  assert.equal(e.borrowPersonalStockMargin('conservative'), false, '別商品への切り替えは完済するまでできない');
  const blocked = e.getPersonalStockMarginQuotes().find(q => q.id === 'conservative');
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.available, 0);
}

// 5. Weekly interest comes out of personalCash when cash covers it; the balance is untouched.
{
  const { e, margin } = withPortfolio();
  e.borrowPersonalStockMargin('standard');
  const balanceBefore = margin.balanceOf(e.g);
  const expectedInterest = Math.round(balanceBefore * margin.annualRateFor('standard') / 52);
  const cashBefore = e.g.personalCash;
  const result = margin.processWeek(e);
  assert.equal(result.interest, expectedInterest);
  assert.equal(result.unpaid, 0, '手元資金が十分なので未払いは発生しない');
  assert.equal(e.g.personalCash, cashBefore - expectedInterest);
  assert.equal(margin.balanceOf(e.g), balanceBefore, '利息を払えている限り元本は増えない');
}

// 6. When personal cash cannot cover the weekly interest, the unpaid portion capitalizes into
// the balance -- no delinquency counter, unlike the mortgage.
{
  const { e, margin } = withPortfolio();
  e.borrowPersonalStockMargin('standard');
  const balanceBefore = margin.balanceOf(e.g);
  e.g.personalCash = 0;
  const result = margin.processWeek(e);
  assert.ok(result.unpaid > 0, '現金が無いので利息が未払いになる');
  assert.equal(margin.balanceOf(e.g), balanceBefore + result.unpaid, '未払い利息は残債に加算される');
  assert.equal(e.g.personalCash, 0, '現金はマイナスにはならない');
}

// 7. A price crash that pushes LTV past MAINTENANCE_LTV triggers forced liquidation the same
// week -- no grace period. Any shortfall after selling everything becomes personalDebt.
{
  const { e, margin, stockID } = withPortfolio();
  assert.equal(e.borrowPersonalStockMargin('standard'), true);
  const stock = e.g.market.find(s => s.id === stockID);
  stock.price = Math.max(1, stock.price * .1);
  assert.ok(margin.currentLTV(e.g) > margin.MAINTENANCE_LTV, 'テスト前提: 追証水準を超えている');
  const debtBefore = e.g.personalDebt;
  const result = margin.processWeek(e);
  assert.equal(result.liquidated, true);
  assert.equal(margin.balanceOf(e.g), 0, '強制決済後は残債ゼロ');
  assert.equal(e.getPersonalStockMargin().hasLoan, false);
  if (result.shortfall > 0) assert.equal(e.g.personalDebt, debtBefore + result.shortfall, '売却代金で返しきれない分は個人負債になる');
}

// 8. Determinism: quoting, borrowing, weekly processing and forced liquidation never touch
// Math.random -- every figure here is a function of already-known state.
{
  const { ctx, e, margin, stockID } = withPortfolio();
  assert.equal(e.borrowPersonalStockMargin('standard'), true);
  let calls = 0;
  const orig = ctx.Math.random;
  ctx.Math.random = () => { calls++; return orig(); };
  margin.processWeek(e);
  e.g.market.find(s => s.id === stockID).price *= .1;
  margin.processWeek(e);
  ctx.Math.random = orig;
  assert.equal(calls, 0, 'personal-stock-marginはMath.randomを一切消費しない');
}

// 9. Prepayment reduces the balance; paying it off in full clears the product.
{
  const { e, margin } = withPortfolio();
  e.borrowPersonalStockMargin('conservative');
  const balance = margin.balanceOf(e.g);
  assert.equal(e.prepayPersonalStockMargin(Math.floor(balance / 2)), true);
  assert.ok(margin.balanceOf(e.g) < balance);
  assert.equal(e.prepayPersonalStockMargin(margin.balanceOf(e.g)), true);
  assert.equal(margin.balanceOf(e.g), 0);
  assert.equal(e.getPersonalStockMargin().productID, '');
}

// 10. Old/malformed saves normalize safely via ensure().
{
  const { e, margin } = withPortfolio();
  for (const malformed of [undefined, null, 'bad', { balance: -5 }, { balance: NaN, productID: 'nope' }]) {
    e.g.personalMarginLoan = malformed;
    const loan = margin.ensure(e.g);
    assert.ok(Number.isInteger(loan.balance) && loan.balance >= 0, `malformed値(${JSON.stringify(malformed)})も安全な非負整数へ`);
    assert.ok(loan.productID === '' || margin.PRODUCTS[loan.productID]);
  }
}

// 11. personalNetWorth subtracts outstanding margin debt like every other personal liability,
// and stays independent of unrelated cash movement.
{
  const { e, margin } = withPortfolio();
  const before = e.personalNetWorth();
  e.borrowPersonalStockMargin('standard');
  assert.ok(margin.balanceOf(e.g) > 0);
  assert.equal(e.personalNetWorth(), before, '借入直後（利払い前）は純資産が変わらない');
  e.g.personalCash += 1;
  assert.equal(e.personalNetWorth(), before + 1, '無関係な現金増分はそのまま反映される');
}

// 12. Company accounts are never touched: only personalCash / personalStocks / personalDebt move.
{
  const { e } = withPortfolio();
  const companyCashBefore = e.g.companyCash, companyStocksBefore = JSON.stringify(e.g.companyStocks);
  e.borrowPersonalStockMargin('standard');
  e.prepayPersonalStockMargin(1000);
  assert.equal(e.g.companyCash, companyCashBefore, '会社現金は変化しない');
  assert.equal(JSON.stringify(e.g.companyStocks), companyStocksBefore, '会社保有株式は変化しない');
}

// 13. UI: exactly one new card, wired through two new dispatcher actions, without touching any
// existing stock-trading or mortgage action names.
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /信用取引（個人）/);
  assert.equal((app.match(/'borrow-stock-margin'/g) || []).length, 2, 'ボタン1箇所＋dispatcher1箇所');
  assert.equal((app.match(/'prepay-stock-margin'/g) || []).length, 3, 'ボタン2箇所（一部/全額）＋dispatcher1箇所');
  assert.equal((app.match(/'buy-stock'/g) || []).length, 3, '既存の株式購入アクションは変更していない');
  assert.equal((app.match(/'sell-stock'/g) || []).length, 3, '既存の株式売却アクションは変更していない');
}

// 14. index.html and module-load-order.json both register the new script after engine.js.
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /personal-stock-margin\.js/);
  const order = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'module-load-order.json'), 'utf8')).scripts;
  const engineIdx = order.indexOf('./js/engine.js');
  const marginIdx = order.indexOf('./js/personal-stock-margin.js');
  assert.ok(engineIdx >= 0 && marginIdx > engineIdx, 'personal-stock-margin.jsはengine.jsより後に読み込む');
}

console.log('personal stock margin tests passed');
