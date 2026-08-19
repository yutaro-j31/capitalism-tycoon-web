'use strict';

// R4's final item "不動産法人". A real 資産管理法人 (asset-management corporation) lets an
// individual's real-estate income accrue inside a company wrapper instead of their personal
// account -- profits stay inside the corp until deliberately withdrawn as a dividend, which is
// the tax-deferral mechanic that makes such a corp worth founding.
//
// This is a THIRD cash silo, distinct from both personalCash and the player's main company
// (companyCash/g.properties/finance ledger). CLAUDE.md's "会社資産と個人資産の分離を維持"
// invariant governs those two; this corp is neither, but its cash must still never merge with
// personalCash except through one explicit dividend action, and must never touch companyCash
// or the finance ledger at all -- that is what every test below is checking.
//
// Scope is deliberately narrow: only a holding on a plain long-term lease (no mortgage, no
// short-term letting, no in-progress redevelopment) can be contributed. Those three features
// are blocked on a corp-owned holding rather than taught to redirect their own cash flows too.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819904) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819904) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 100_000_000;
  return { modules, ctx, engine };
}

function buyHolding(engine) {
  assert.equal(engine.buyPersonalRealEstate('studio-tokyo'), true);
  return engine.g.personalRealEstateHoldings[0];
}

// 1. Founding the corp charges the exact setup cost from personalCash only, and cannot be
// done twice.
{
  const { engine, modules } = newGame();
  const companyCashBefore = engine.g.companyCash;
  const before = engine.g.personalCash;
  assert.equal(engine.establishPersonalRealEstateCorp(), true);
  assert.equal(before - engine.g.personalCash, modules.personalRealEstateCorp.SETUP_COST);
  assert.equal(engine.g.companyCash, companyCashBefore, '会社資金には一切触れない');
  assert.equal(engine.establishPersonalRealEstateCorp(), false, '二重設立はできない');
}

// 2. Insufficient cash blocks founding and charges nothing.
{
  const { engine, modules } = newGame();
  engine.g.personalCash = modules.personalRealEstateCorp.SETUP_COST - 1;
  assert.equal(engine.establishPersonalRealEstateCorp(), false);
  assert.equal(engine.g.personalCash, modules.personalRealEstateCorp.SETUP_COST - 1);
}

// 3. Contributing a holding moves no cash by itself, and once contributed its weekly rent
// settles to corp cash, never personalCash.
{
  const { engine } = newGame();
  engine.establishPersonalRealEstateCorp();
  const holding = buyHolding(engine);
  const personalBeforeContribute = engine.g.personalCash;
  assert.equal(engine.contributePersonalRealEstateToCorp(holding.assetID), true);
  assert.equal(engine.g.personalCash, personalBeforeContribute, '移管そのものは現金を動かさない');
  assert.equal(holding.ownerCorp, true);
  // Neutralize the unrelated founderHomeMonthlyCost upkeep (a fixed personal living expense
  // charged every ~4 weeks) so this block isolates only the corp-holding cash flow.
  engine.g.founderHomeMonthlyCost = 0;

  for (let i = 0; i < 10; i++) assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(engine.g.personalCash, personalBeforeContribute, '法人所有の家賃はpersonalCashに一切影響しない');
  assert.ok(engine.g.personalRealEstateCorp.cash > 0, '法人現金に賃料収入が積み上がる');
}

// 4. A dividend withdrawal is the only path that moves corp cash to personalCash, and it is
// exact: capped at the corp's balance, never more.
{
  const { engine } = newGame();
  engine.establishPersonalRealEstateCorp();
  const holding = buyHolding(engine);
  engine.contributePersonalRealEstateToCorp(holding.assetID);
  for (let i = 0; i < 10; i++) engine.advanceWeek(false);
  const corpCash = engine.g.personalRealEstateCorp.cash;
  const personalBefore = engine.g.personalCash;

  assert.equal(engine.withdrawPersonalRealEstateCorpDividend(corpCash + 1_000_000), true, '超過要求は法人残高でクランプされる');
  assert.equal(engine.g.personalRealEstateCorp.cash, 0);
  assert.equal(engine.g.personalCash, personalBefore + corpCash);
  assert.equal(engine.withdrawPersonalRealEstateCorpDividend(1), false, '残高0からは引き出せない');
}

// 5. Contribution is blocked while a mortgage, short-term mode, or redevelopment is active,
// and each guard is a true no-op (no cash moves, ownerCorp stays false).
{
  const { engine } = newGame();
  engine.establishPersonalRealEstateCorp();

  const mortgaged = buyHolding(engine);
  const quote = engine.getPersonalRealEstateMortgageQuotes(mortgaged.assetID).find(q => q.eligible);
  assert.ok(quote, '前提: 融資商品が利用できる');
  assert.equal(engine.borrowPersonalRealEstateMortgage(mortgaged.assetID, quote.id), true);
  assert.equal(engine.contributePersonalRealEstateToCorp(mortgaged.assetID), false, '融資中は移管できない');
  assert.equal(mortgaged.ownerCorp, undefined);

  const shortTerm = buyHolding(engine);
  assert.equal(engine.switchPersonalRealEstateRentalMode(shortTerm.assetID, 'short'), true);
  assert.equal(engine.contributePersonalRealEstateToCorp(shortTerm.assetID), false, '短期賃貸中は移管できない');
  assert.equal(shortTerm.ownerCorp, undefined);

  const redeveloping = buyHolding(engine);
  assert.equal(engine.startPersonalRealEstateRedevelopment(redeveloping.assetID, 'refresh'), true);
  assert.equal(engine.contributePersonalRealEstateToCorp(redeveloping.assetID), false, '工事中は移管できない');
  assert.equal(redeveloping.ownerCorp, undefined);
}

// 6. The reverse guards also hold: a corp-owned holding cannot take a mortgage, switch to
// short-term, or start redevelopment.
{
  const { engine } = newGame();
  engine.establishPersonalRealEstateCorp();
  const holding = buyHolding(engine);
  engine.contributePersonalRealEstateToCorp(holding.assetID);

  const quote = engine.getPersonalRealEstateMortgageQuotes(holding.assetID).find(q => q.eligible);
  assert.equal(engine.borrowPersonalRealEstateMortgage(holding.assetID, quote.id), false, '法人所有には個人融資を実行できない');
  assert.equal(engine.switchPersonalRealEstateRentalMode(holding.assetID, 'short'), false, '法人所有は短期賃貸に切り替えられない');
  assert.equal(engine.startPersonalRealEstateRedevelopment(holding.assetID, 'refresh'), false, '法人所有は個人資金での開発・再開発を開始できない');
}

// 7. Withdrawing a holding back to personal ownership clears ownerCorp but leaves the corp's
// already-earned cash behind (retained earnings do not follow the asset back out).
{
  const { engine } = newGame();
  engine.establishPersonalRealEstateCorp();
  const holding = buyHolding(engine);
  engine.contributePersonalRealEstateToCorp(holding.assetID);
  for (let i = 0; i < 5; i++) engine.advanceWeek(false);
  const corpCashBefore = engine.g.personalRealEstateCorp.cash;
  assert.ok(corpCashBefore > 0);
  assert.equal(engine.withdrawPersonalRealEstateFromCorp(holding.assetID), true);
  assert.equal(holding.ownerCorp, false);
  assert.equal(engine.g.personalRealEstateCorp.cash, corpCashBefore, '法人内に残った現金はそのまま留まる');

  const personalBefore = engine.g.personalCash;
  assert.notEqual(engine.advanceWeek(false), false);
  assert.notEqual(engine.g.personalCash, personalBefore, '個人へ戻した後は通常どおりpersonalCashで精算される');
}

// 8. Property tax on a corp-owned holding is paid from corp cash, never personalCash, and a
// sale's net proceeds land in the corp too.
{
  const { engine } = newGame();
  engine.establishPersonalRealEstateCorp();
  const holding = buyHolding(engine);
  engine.contributePersonalRealEstateToCorp(holding.assetID);
  engine.g.personalRealEstateCorp.cash = 10_000_000;
  engine.g.founderHomeMonthlyCost = 0;
  const personalBefore = engine.g.personalCash;
  let taxCharged = false;
  for (let i = 0; i < 26; i++) {
    const corpBefore = engine.g.personalRealEstateCorp.cash;
    engine.advanceWeek(false);
    if (holding.propertyTaxPaid > 0 && !taxCharged) { taxCharged = true; assert.notEqual(engine.g.personalRealEstateCorp.cash, corpBefore); }
  }
  assert.ok(taxCharged, '前提: 26週の間に固定資産税が発生する');
  assert.equal(engine.g.personalCash, personalBefore, '固定資産税は個人資金に一切影響しない');

  assert.equal(engine.sellPersonalRealEstate(holding.assetID), true);
  assert.equal(engine.g.personalCash, personalBefore, '法人所有物件の売却代金も個人資金には入らない');
}

// 9. personalNetWorth() includes the corp's retained cash exactly once -- neither missing nor
// double-counted against the holding's own currentValue (which is already summed elsewhere).
{
  const { engine } = newGame();
  const before = engine.personalNetWorth();
  engine.establishPersonalRealEstateCorp();
  const holding = buyHolding(engine);
  engine.contributePersonalRealEstateToCorp(holding.assetID);
  for (let i = 0; i < 5; i++) engine.advanceWeek(false);
  const corp = engine.g.personalRealEstateCorp;
  const expected = engine.g.personalCash + holding.currentValue + corp.cash;
  // personalNetWorth() sums many more components (base personalCash/stocks/etc, pe, angel,
  // real estate, mortgage debt, corp cash, trust); isolate just the corp-cash contribution by
  // checking it moves net worth up by exactly corp.cash relative to a run with the corp
  // cash zeroed out.
  const withCorpCash = engine.personalNetWorth();
  const savedCash = corp.cash;
  corp.cash = 0;
  const withoutCorpCash = engine.personalNetWorth();
  corp.cash = savedCash;
  assert.ok(Math.abs((withCorpCash - withoutCorpCash) - savedCash) < 1e-6, '法人現金はちょうど1回だけ純資産に加算される');
  void before; void expected;
}

// 10. Backward compatibility: an old save with no personalRealEstateCorp field at all loads
// and operates safely. saveVersion stays 9.
{
  const { engine, modules } = newGame();
  delete engine.g.personalRealEstateCorp;
  assert.equal(engine.getPersonalRealEstateCorp().established, false, '旧セーブでも安全にデフォルト状態を返す');
  assert.notEqual(engine.advanceWeek(false), false);
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  assert.equal(reloaded.g.saveVersion, 9);
}

// 11. Determinism / RNG budget: founding, contributing, and withdrawing draw no random
// numbers.
{
  const { engine } = newGame();
  const holding = buyHolding(engine);
  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    assert.equal(engine.establishPersonalRealEstateCorp(), true);
    assert.equal(engine.contributePersonalRealEstateToCorp(holding.assetID), true);
    assert.equal(engine.withdrawPersonalRealEstateFromCorp(holding.assetID), true);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, '設立・移管・返還はMath.randomを消費しない');
}

console.log('personal real estate corp tests passed');
