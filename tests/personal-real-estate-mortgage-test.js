'use strict';

// feature-requests.md R4. Personal property could only be bought outright, so the portfolio
// was capped by cash on hand and there was no capital decision past "buy when affordable".
// js/personal-real-estate-mortgage.js reuses the company mortgage model's shape (products with
// a rate, LTV ceiling, term and fee; weekly interest plus straight-line principal; prepayment)
// but keeps every yen on the personal side -- personalCash only, never the company ledger.
//
// The thing that makes borrowing a decision instead of free money is foreclosure: rent stops
// when a lease is not renewed, the payment does not, and enough consecutive misses cost the
// player the building. These tests pin that down along with the two ways debt could otherwise
// silently disappear (selling a mortgaged property, and a foreclosed one still counting).

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819001, cash = 200_000_000) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = cash;
  return { modules, ctx, engine, mortgage: modules.personalRealEstateMortgage };
}

function withHolding(seed = 260819001, offer = 'logistics-aichi', cash = 200_000_000) {
  const bag = newGame(seed, cash);
  assert.equal(bag.engine.buyPersonalRealEstate(offer), true);
  bag.asset = bag.engine.g.personalRealEstateHoldings[0];
  return bag;
}

function keepVacant(asset) {
  asset.rentalOps.occupancyStatus = 'vacant';
  asset.rentalOps.contractWeeklyRent = 0;
}

// 1. Registered like every other module here.
{
  const { mortgage } = newGame();
  assert.ok(mortgage, 'personalRealEstateMortgage モジュールが登録されている');
  assert.equal(mortgage.__installed, true);
}

// 2. Quotes: each product offers its own LTV ceiling, and a higher ceiling is what you trade
// for a higher rate or a shorter term.
{
  const { engine, asset, mortgage } = withHolding();
  const quotes = engine.getPersonalRealEstateMortgageQuotes(asset.assetID);
  assert.equal(quotes.length, 3);
  for (const quote of quotes) {
    assert.equal(quote.available, Math.round(asset.currentValue * quote.maxLTV), `${quote.label}の借入可能額はLTV上限どおり`);
    assert.equal(quote.fee, Math.round(quote.available * quote.feeRate));
    assert.equal(quote.netProceeds, quote.available - quote.fee);
    assert.ok(quote.eligible);
  }
  const byId = Object.fromEntries(quotes.map(q => [q.id, q]));
  assert.ok(byId.variable.available > byId.fixed.available, '変動金利は固定より多く借りられる');
  assert.ok(byId.conservative.available < byId.fixed.available, '低LTV商品は最も借入額が小さい');
  assert.ok(byId.conservative.annualRate < byId.fixed.annualRate, '低LTV商品は固定より金利が低い');
}

// 3. The variable product tracks the existing policyRate; the fixed ones do not. A loan that
// is cheapest today is not guaranteed to stay that way.
{
  const { engine, mortgage } = newGame();
  engine.g.policyRate = .005;
  const cheap = mortgage.annualRateFor(engine.g, 'variable');
  engine.g.policyRate = .06;
  const dear = mortgage.annualRateFor(engine.g, 'variable');
  assert.ok(dear > cheap, '政策金利が上がれば変動金利も上がる');
  assert.equal(mortgage.annualRateFor(engine.g, 'fixed'), mortgage.PRODUCTS.fixed.baseRate, '固定金利は政策金利に影響されない');
  assert.equal(mortgage.annualRateFor(engine.g, 'conservative'), mortgage.PRODUCTS.conservative.baseRate);
}

// 4. Borrowing is a swap of debt for cash, not a gain: net worth falls by exactly the
// arrangement fee. If the balance were not subtracted, borrowing would read as free money.
{
  const { engine, asset } = withHolding();
  const worthBefore = engine.personalNetWorth();
  const cashBefore = engine.g.personalCash;
  const quote = engine.getPersonalRealEstateMortgageQuotes(asset.assetID).find(q => q.id === 'variable');
  assert.equal(engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable'), true);
  assert.equal(engine.g.personalCash, cashBefore + quote.netProceeds, '手取額がそのまま個人資金に入る');
  assert.equal(engine.personalNetWorth(), worthBefore - quote.fee, '純資産は手数料の分だけしか減らない（借入自体では増えない）');
}

// 5. Weekly payment splits into interest on the balance and straight-line principal, and comes
// out of personal cash.
{
  const { engine, asset, mortgage } = withHolding();
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'fixed');
  const payment = mortgage.weeklyPaymentFor(engine.g, asset);
  assert.ok(payment.interest > 0 && payment.principal > 0);
  assert.equal(payment.due, payment.interest + payment.principal);
  const balanceBefore = mortgage.balanceOf(asset);
  const cashBefore = engine.g.personalCash;
  mortgage.processWeek(engine);
  assert.equal(engine.g.personalCash, cashBefore - payment.due, '週次返済はpersonalCashから引かれる');
  assert.equal(mortgage.balanceOf(asset), balanceBefore - payment.principal, '元本分だけ残債が減る');
  assert.equal(asset.mortgageInterestPaid, payment.interest);
}

// 6. Balance shrinks over a year of on-time payments through the real game loop.
{
  const { engine, asset, mortgage } = withHolding();
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'fixed');
  const opening = mortgage.balanceOf(asset);
  for (let i = 0; i < 52; i++) assert.notEqual(engine.advanceWeek(false), false);
  assert.ok(mortgage.balanceOf(asset) < opening, 'advanceWeek()経由でも残債が減る');
  assert.equal(engine.getPersonalRealEstateMortgage(asset.assetID).delinquentWeeks, 0, '家賃が入っていれば延滞しない');
}

// 7. Prepayment reduces the balance, and paying it off completely clears the product.
{
  const { engine, asset, mortgage } = withHolding();
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'conservative');
  const balance = mortgage.balanceOf(asset);
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.prepayPersonalRealEstateMortgage(asset.assetID, 10_000_000), true);
  assert.equal(mortgage.balanceOf(asset), balance - 10_000_000);
  assert.equal(engine.g.personalCash, cashBefore - 10_000_000);
  assert.equal(engine.prepayPersonalRealEstateMortgage(asset.assetID, 999_000_000), true, '残債を超える指定は残債ぶんだけ返済される');
  assert.equal(mortgage.balanceOf(asset), 0);
  assert.equal(mortgage.hasMortgage(asset), false, '完済で融資が終了する');
  assert.equal(asset.mortgageProductID, '');
}

// 8. The LTV ceiling is real: a second loan on the same building is limited to the remaining
// headroom, and a fully-charged property offers nothing.
{
  const { engine, asset, mortgage } = withHolding();
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable');
  const quotes = engine.getPersonalRealEstateMortgageQuotes(asset.assetID);
  const variable = quotes.find(q => q.id === 'variable');
  assert.equal(variable.available, 0, '上限まで借りた物件にはもう担保余力がない');
  assert.equal(variable.eligible, false);
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable'), false, '担保余力ゼロでの追加借入は拒否される');
  assert.equal(engine.g.personalCash, cashBefore, '拒否された借入は現金を動かさない');
  assert.ok(mortgage.currentLTV(asset) <= mortgage.PRODUCTS.variable.maxLTV + 1e-9);
}

// 9. Mixing products on one property is refused rather than silently stacking two loans.
{
  const { engine, asset } = withHolding();
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'conservative');
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.borrowPersonalRealEstateMortgage(asset.assetID, 'fixed'), false, '別商品の重ね borrowing は拒否される');
  assert.equal(engine.g.personalCash, cashBefore);
}

// 10. Missing payments accrues delinquency instead of silently skipping. This is what makes a
// vacancy dangerous once leveraged.
{
  const { engine, asset, mortgage } = withHolding();
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable');
  keepVacant(asset);
  engine.g.personalCash = 0;
  mortgage.processWeek(engine);
  assert.equal(engine.getPersonalRealEstateMortgage(asset.assetID).delinquentWeeks, 1, '払えなければ延滞が積み上がる');
  assert.equal(engine.g.personalCash, 0, '無い金は引かれない（残高がマイナスにならない）');
}

// 11. Delinquency resets once a payment lands again -- a single missed week is survivable.
{
  const { engine, asset, mortgage } = withHolding();
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable');
  keepVacant(asset);
  engine.g.personalCash = 0;
  mortgage.processWeek(engine);
  assert.equal(asset.mortgageDelinquentWeeks, 1);
  engine.g.personalCash = 50_000_000;
  asset.mortgageProcessedWeek = -1;
  mortgage.processWeek(engine);
  assert.equal(asset.mortgageDelinquentWeeks, 0, '払えた週で延滞はリセットされる');
}

// 12. Foreclosure: enough consecutive misses and the lender takes the building, settles out of
// a discounted sale, and hands back whatever is left. This is the risk that makes leverage a
// decision rather than free money.
{
  const { engine, asset, mortgage } = withHolding(555);
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable');
  keepVacant(asset);
  engine.g.personalCash = 0;
  for (let i = 0; i < mortgage.MAX_DELINQUENT_WEEKS && asset.status === 'owned'; i++) {
    keepVacant(asset);
    engine.advanceWeek(false);
  }
  assert.equal(asset.status, 'foreclosed', `${mortgage.MAX_DELINQUENT_WEEKS}週の延滞で差し押さえられる`);
  assert.equal(mortgage.balanceOf(asset), 0, '差押えで残債は清算される');
  assert.ok(engine.g.personalCash > 0, '売却代金が残債を上回れば差額が手元に残る');
  assert.equal(engine.g.personalRealEstateHoldings.filter(x => x.status === 'owned').length, 0);
}

// 13. Underwater foreclosure: when the discounted sale cannot cover the loan, the shortfall
// follows the borrower as personal debt rather than vanishing with the building.
{
  const { engine, asset, mortgage } = withHolding(90);
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable');
  const debtBefore = engine.g.personalDebt;
  const collapse = () => { asset.currentValue = asset.purchasePrice * .5; keepVacant(asset); };
  collapse();
  engine.g.personalCash = 0;
  assert.ok(mortgage.balanceOf(asset) > asset.currentValue, '前提: 債務超過の状態');
  for (let i = 0; i < mortgage.MAX_DELINQUENT_WEEKS && asset.status === 'owned'; i++) {
    collapse();
    engine.advanceWeek(false);
  }
  assert.equal(asset.status, 'foreclosed');
  assert.ok(engine.g.personalDebt > debtBefore, '返しきれなかった残債は個人負債として残る');
}

// 14. A foreclosed property stops counting: neither its value nor its (settled) debt lingers
// in net worth.
{
  const { engine, asset, mortgage } = withHolding(555);
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable');
  keepVacant(asset);
  engine.g.personalCash = 0;
  for (let i = 0; i < mortgage.MAX_DELINQUENT_WEEKS && asset.status === 'owned'; i++) {
    keepVacant(asset);
    engine.advanceWeek(false);
  }
  assert.equal(asset.status, 'foreclosed');
  assert.equal(mortgage.totalDebt(engine.g), 0, '差押え済み物件の残債は二重計上されない');
}

// 15. Selling a mortgaged property repays the loan out of the proceeds. Without this, selling
// would be a way to erase a loan and keep the money.
{
  const { engine, asset, mortgage } = withHolding(3);
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'fixed');
  const balance = mortgage.balanceOf(asset);
  const value = asset.currentValue;
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.sellPersonalRealEstate(asset.assetID), true);
  assert.equal(engine.g.personalCash, cashBefore + Math.round(value) - balance, '売却代金から残債が清算される');
  assert.equal(mortgage.totalDebt(engine.g), 0);
}

// 16. Company separation: taking and servicing a personal mortgage leaves the company side
// bit-for-bit identical. Compared against a parallel run that skips the loan, because a
// company with an office booked has its own weekly costs either way.
{
  function run(borrow) {
    const { modules, engine, asset } = withHolding(4242);
    const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
    assert.equal(engine.contractOffice(office.id), true);
    engine.g.companyCash = 5_000_000_000;
    engine.g.finance = modules.finance.defaultFinanceState(engine.g);
    if (borrow) assert.equal(engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable'), true);
    for (let i = 0; i < 6; i++) engine.advanceWeek(false);
    return { engine, modules };
  }
  const withLoan = run(true);
  const without = run(false);
  assert.equal(withLoan.engine.g.companyCash, without.engine.g.companyCash, '個人不動産のローンはcompanyCashを1円も動かさない');
  assert.equal(withLoan.engine.g.finance.transactions.length, without.engine.g.finance.transactions.length, 'ローンの有無で会社台帳の行数は変わらない');
  assert.notEqual(withLoan.engine.g.personalCash, without.engine.g.personalCash, '前提: 個人側は当然変わっている');
  assert.equal(withLoan.modules.finance.validate(withLoan.engine.g).ok, true);
}

// 17. Zero new randomness: rates, payments and the foreclosure clock are pure functions.
{
  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { modules, ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 200_000_000;
  engine.buyPersonalRealEstate('logistics-aichi');
  const asset = engine.g.personalRealEstateHoldings[0];
  const before = calls;
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable');
  modules.personalRealEstateMortgage.processWeek(engine);
  engine.prepayPersonalRealEstateMortgage(asset.assetID, 1_000_000);
  assert.equal(calls - before, 0, '借入・返済・繰上返済はMath.randomを一切消費しない');
}

// 18. Determinism.
{
  function run() {
    const { engine, asset } = withHolding(20260819);
    engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable');
    for (let i = 0; i < 20; i++) engine.advanceWeek(false);
    return JSON.stringify({ cash: engine.g.personalCash, holdings: engine.g.personalRealEstateHoldings });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 19. Save/reload keeps the loan intact.
{
  const { modules, engine, asset, mortgage } = withHolding();
  engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable');
  for (let i = 0; i < 4; i++) engine.advanceWeek(false);
  const balance = mortgage.balanceOf(asset);
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  const loaded = reloaded.g.personalRealEstateHoldings[0];
  assert.equal(mortgage.balanceOf(loaded), balance, 'reload後も残債が一致する');
  assert.equal(loaded.mortgageProductID, 'variable');
  assert.equal(reloaded.g.saveVersion, 9);
}

// 20. Legacy saves: a holding from before this feature has no mortgage fields at all. It must
// read as unmortgaged, contribute nothing to debt, and still be borrowable against.
{
  const { engine, asset, mortgage } = withHolding();
  delete asset.mortgageBalance;
  delete asset.mortgageProductID;
  delete asset.mortgageRemainingWeeks;
  delete asset.mortgageDelinquentWeeks;
  assert.equal(mortgage.hasMortgage(asset), false, '旧セーブの物件は無借金として読める');
  assert.equal(mortgage.balanceOf(asset), 0);
  assert.equal(mortgage.totalDebt(engine.g), 0);
  const summary = engine.getPersonalRealEstateMortgage(asset.assetID);
  assert.equal(summary.hasMortgage, false);
  assert.ok(Number.isFinite(summary.weeklyPayment), '旧セーブでもNaNにならない');
  assert.equal(engine.borrowPersonalRealEstateMortgage(asset.assetID, 'fixed'), true, '旧セーブの物件にも通常どおり借り入れできる');
  assert.notEqual(engine.advanceWeek(false), false);
}

// 21. The founder screen offers the loan before there is one and reports it afterwards,
// including how close a delinquent loan is to costing the player the building.
{
  const { ctx } = loadGame({ random: lcg() });
  const engine = ctx.__ct_engine, ui = ctx.__ct_ui;
  engine.g.configured = true;
  ui.showSetup = false;
  engine.g.personalCash = 300_000_000;
  engine.buyPersonalRealEstate('logistics-aichi');
  const asset = engine.g.personalRealEstateHoldings[0];
  engine.g.selectedTab = 'founder';
  engine.emit('change');
  const offered = String(ctx.document.getElementById('app').innerHTML || '');
  for (const label of ['担保に借り入れる', '固定金利', '変動金利', '手取']) {
    assert.ok(offered.includes(label), `借入前の画面に「${label}」が表示される`);
  }
  assert.ok(/差し押さえ/.test(offered), '借入前にリスクが明示されている');

  assert.equal(engine.borrowPersonalRealEstateMortgage(asset.assetID, 'variable'), true);
  engine.emit('change');
  const held = String(ctx.document.getElementById('app').innerHTML || '');
  for (const label of ['残債', '週次返済', '繰上返済']) {
    assert.ok(held.includes(label), `借入後の画面に「${label}」が表示される`);
  }
  assert.ok(!held.includes('担保に借り入れる'), '担保余力を使い切ったら借入メニューは消える');

  asset.mortgageDelinquentWeeks = 5;
  engine.emit('change');
  assert.ok(/返済遅延 5週/.test(String(ctx.document.getElementById('app').innerHTML || '')), '延滞中は残り週数つきで警告される');
}

// 22. Static source scan: no MutationObserver introduced.
{
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['../js/personal-real-estate-mortgage.js', '../js/expansion.js', '../js/app.js']) {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(src), `${file}に新しいMutationObserverを追加していない`);
  }
}

console.log('personal real estate mortgage tests passed');
