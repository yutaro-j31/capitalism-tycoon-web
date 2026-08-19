'use strict';

// feature-requests.md R4. A personal holding had exactly one way to earn: sign a tenant on a
// 52-week lease and collect the same rent every week. Steady, and with nothing to decide after
// the purchase.
//
// js/personal-real-estate-short-term.js adds a second mode. Short-term letting charges a much
// higher headline rate but stops guaranteeing it: occupancy is recomputed weekly from
// seasonality, building condition and the economy, running costs are far higher, and guests
// wear the building down twice as fast as a single tenant. Converting costs money and locks
// the mode for a quarter, so it cannot be flipped week to week to chase the better number.
//
// The tension only bites in combination: the mortgage payment and the property tax bill do not
// care how the season went, so a leveraged holding run short-term through a quiet stretch is
// the fastest route to a missed payment.
//
// Occupancy is derived from a hash, never rolled, so no randomness is consumed.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260819777) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819777, cash = 500_000_000) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = cash;
  return { modules, ctx, engine, shortTerm: modules.personalRealEstateShortTerm };
}

function withHolding(seed = 260819777, offer = 'logistics-aichi', cash = 500_000_000) {
  const bag = newGame(seed, cash);
  assert.equal(bag.engine.buyPersonalRealEstate(offer), true);
  bag.asset = bag.engine.g.personalRealEstateHoldings[0];
  return bag;
}

// 1. Registered like every other module here.
{
  const { shortTerm } = newGame();
  assert.ok(shortTerm, 'personalRealEstateShortTerm モジュールが登録されている');
  assert.equal(shortTerm.__installed, true);
}

// 2. A freshly bought holding is a long let, exactly as before this feature.
{
  const { engine, asset, shortTerm } = withHolding();
  assert.equal(shortTerm.modeOf(asset), shortTerm.MODE_LONG);
  assert.equal(shortTerm.isShortTerm(asset), false);
  assert.equal(engine.getPersonalRealEstateRentalMode(asset.assetID).mode, 'long');
  assert.equal(asset.rentalOps.occupancyStatus, 'occupied', '長期は従来どおり入居状態から始まる');
}

// 3. Converting costs the fit-out fee and gives up the signed lease.
{
  const { engine, asset, shortTerm } = withHolding();
  const cost = shortTerm.conversionCostFor(asset);
  assert.ok(cost > 0);
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short'), true);
  assert.equal(engine.g.personalCash, cashBefore - cost, '初期費用が引かれる');
  assert.equal(shortTerm.isShortTerm(asset), true);
  assert.equal(asset.rentalOps.occupancyStatus, 'vacant', '契約は解除される');
  assert.equal(asset.rentalOps.contractWeeklyRent, 0);
}

// 4. The mode locks for a quarter in both directions, so it cannot be flipped to chase the
// better week.
{
  const { engine, asset, shortTerm } = withHolding();
  assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short'), true);
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'long'), false, '切替直後は戻せない');
  assert.equal(engine.g.personalCash, cashBefore, '拒否された切替は課金しない');
  assert.equal(engine.getPersonalRealEstateRentalMode(asset.assetID).lockedWeeks, shortTerm.MODE_LOCK_WEEKS);
  engine.g.week += shortTerm.MODE_LOCK_WEEKS;
  assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'long'), true, 'ロック明けなら戻せる');
  assert.equal(shortTerm.isShortTerm(asset), false);
}

// 5. Switching to the mode it is already in is refused rather than charging again.
{
  const { engine, asset } = withHolding();
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'long'), false, '同じ運用方式への切替は拒否される');
  assert.equal(engine.g.personalCash, cashBefore);
}

// 6. Not enough cash for the fit-out is refused cleanly.
{
  const { engine, asset, shortTerm } = withHolding();
  engine.g.personalCash = shortTerm.conversionCostFor(asset) - 1;
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short'), false);
  assert.equal(engine.g.personalCash, cashBefore);
  assert.equal(shortTerm.isShortTerm(asset), false);
}

// 7. Occupancy is derived, not rolled: same holding, same week, same figure every time.
{
  const { engine, asset, shortTerm } = withHolding();
  engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
  const first = shortTerm.occupancyFor(engine.g, asset);
  const second = shortTerm.occupancyFor(engine.g, asset);
  assert.equal(first, second, '同じ週なら何度読んでも同じ稼働率');
  engine.g.week += 1;
  assert.notEqual(shortTerm.occupancyFor(engine.g, asset), first, '週が変われば稼働率も変わる');
}

// 8. Occupancy responds to season, condition and the economy, and stays inside its bounds.
{
  const { engine, asset, shortTerm } = withHolding();
  engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
  const at = (week, condition, economy) => {
    engine.g.week = week; asset.rentalOps.condition = condition; engine.g.economy = economy;
    return shortTerm.occupancyFor(engine.g, asset);
  };
  const tired = at(10, 40, 1);
  const kept = at(10, 95, 1);
  assert.ok(kept > tired, '状態が良いほど稼働する');
  const slump = at(10, 90, .8);
  const boom = at(10, 90, 1.3);
  assert.ok(boom > slump, '好景気ほど稼働する');
  const peak = at(13, 90, 1);
  const trough = at(39, 90, 1);
  assert.ok(peak > trough, '繁忙期と閑散期で差が出る');
  for (const week of [0, 7, 13, 26, 39, 51]) {
    const value = at(week, 100, 1.4);
    assert.ok(value >= shortTerm.OCCUPANCY_FLOOR && value <= shortTerm.OCCUPANCY_CEILING, '稼働率は上下限に収まる');
  }
}

// 9. A fully booked week is worth substantially more than the equivalent lease -- that is what
// is being traded for the loss of a guaranteed rent.
{
  const { asset, shortTerm } = withHolding();
  assert.equal(shortTerm.fullRateFor(asset), Math.round(asset.weeklyRent * shortTerm.SHORT_TERM_RATE_MULTIPLIER));
  assert.ok(shortTerm.SHORT_TERM_RATE_MULTIPLIER > 1.5, '満室週は長期の契約家賃を大きく上回る');
}

// 10. The weekly result is gross times occupancy, less the standing cost and the commission.
{
  const { engine, asset, shortTerm } = withHolding();
  engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
  const result = shortTerm.weeklyResultFor(engine.g, asset);
  assert.equal(result.gross, Math.round(shortTerm.fullRateFor(asset) * result.occupancy));
  const standing = Math.round(asset.purchasePrice * shortTerm.SHORT_TERM_STANDING_COST_RATE);
  assert.equal(result.expense, standing + Math.round(result.gross * shortTerm.SHORT_TERM_VARIABLE_COST));
  assert.equal(result.noi, result.gross - result.expense);
  assert.ok(standing > 0, '空室でも発生する固定的な費用がある');
}

// 11. The weekly loop pays the NOI into personal cash and records it on the holding.
{
  const { engine, asset, shortTerm } = withHolding();
  engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
  const expected = shortTerm.weeklyResultFor(engine.g, asset);
  const cashBefore = engine.g.personalCash;
  engine.updatePersonalExpandedWeekly();
  assert.equal(engine.g.personalCash, cashBefore + expected.noi, '週次NOIがそのまま個人資金へ');
  assert.equal(asset.rentalOps.lastNOI, expected.noi);
  assert.equal(asset.shortTermWeeks, 1);
}

// 12. Short-term letting wears the building down faster than a long lease does. Without this,
// short-term would be gentler on the property than a tenant, which is backwards.
{
  function conditionAfter(mode) {
    const { engine, asset } = withHolding(4242);
    if (mode === 'short') engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
    asset.rentalOps.condition = 90;
    for (let i = 0; i < 20; i++) engine.advanceWeek(false);
    return asset.rentalOps.condition;
  }
  const longCondition = conditionAfter('long');
  const shortCondition = conditionAfter('short');
  assert.ok(shortCondition < longCondition, `短期のほうが建物が早く傷む (${shortCondition} < ${longCondition})`);
}

// 13. Over a year short-term out-earns a lease on average -- otherwise there would be no
// reason to take on the variability or the wear.
{
  function yearOf(mode) {
    const { engine, asset } = withHolding(909);
    if (mode === 'short') engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
    const cashBefore = engine.g.personalCash;
    for (let i = 0; i < 52; i++) engine.advanceWeek(false);
    return engine.g.personalCash - cashBefore;
  }
  const longYear = yearOf('long');
  const shortYear = yearOf('short');
  assert.ok(shortYear > longYear, `短期は平均では長期を上回る (${shortYear} > ${longYear})`);
}

// 14. But a quiet week earns clearly less than a let property does, which is the risk being
// taken on -- and what a mortgage payment lands on top of.
{
  const { engine, asset, shortTerm } = withHolding();
  engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
  const results = [];
  for (let week = 1; week <= 52; week++) {
    engine.g.week = week;
    results.push(shortTerm.weeklyResultFor(engine.g, asset).noi);
  }
  const worst = Math.min(...results);
  const best = Math.max(...results);
  assert.ok(best > worst * 1.5, `週によって手取りが大きく振れる (最低 ${worst} / 最高 ${best})`);
  const leaseWeekly = asset.weeklyRent - asset.purchasePrice * .006 / 52 - asset.weeklyRent * .05;
  assert.ok(worst < leaseWeekly, `閑散期は長期の入居中を下回る (${worst} < ${Math.round(leaseWeekly)})`);
}

// 15. Switching back to a long let does not charge again and leaves the unit looking for a
// tenant rather than pretending one is already in place.
{
  const { engine, asset, shortTerm } = withHolding();
  engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
  engine.g.week += shortTerm.MODE_LOCK_WEEKS;
  const cashBefore = engine.g.personalCash;
  assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'long'), true);
  assert.equal(engine.g.personalCash, cashBefore, '長期へ戻すのは無料');
  assert.equal(asset.rentalOps.occupancyStatus, 'vacant', '戻した直後は空室から入居者探し');
  assert.equal(asset.rentalOps.contractWeeklyRent, 0);
}

// 16. Company separation: none of this touches companyCash or the company ledger.
{
  function run(convert) {
    const { modules, engine, asset } = newGameWithOffice();
    if (convert) assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short'), true);
    for (let i = 0; i < 8; i++) engine.advanceWeek(false);
    return { engine, modules };
  }
  function newGameWithOffice() {
    const bag = withHolding(4242);
    const office = bag.engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
    assert.equal(bag.engine.contractOffice(office.id), true);
    bag.engine.g.companyCash = 5_000_000_000;
    bag.engine.g.finance = bag.modules.finance.defaultFinanceState(bag.engine.g);
    return bag;
  }
  const converted = run(true);
  const not = run(false);
  assert.equal(converted.engine.g.companyCash, not.engine.g.companyCash, '短期賃貸はcompanyCashを動かさない');
  assert.equal(converted.engine.g.finance.transactions.length, not.engine.g.finance.transactions.length, '会社台帳に行を作らない');
  assert.equal(converted.modules.finance.validate(converted.engine.g).ok, true);
}

// 17. Zero new randomness.
{
  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { modules, ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 500_000_000;
  engine.buyPersonalRealEstate('logistics-aichi');
  const asset = engine.g.personalRealEstateHoldings[0];
  const before = calls;
  engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
  modules.personalRealEstateShortTerm.weeklyResultFor(engine.g, asset);
  modules.personalRealEstateShortTerm.processWeek(engine, asset);
  assert.equal(calls - before, 0, '切替・稼働率算定・週次処理はMath.randomを消費しない');
}

// 18. Determinism.
{
  function run() {
    const { engine, asset } = withHolding(20260819);
    engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
    for (let i = 0; i < 20; i++) engine.advanceWeek(false);
    return JSON.stringify({ cash: engine.g.personalCash, holdings: engine.g.personalRealEstateHoldings });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 19. Save/reload keeps the mode and its counters.
{
  const { modules, engine, asset } = withHolding();
  engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short');
  for (let i = 0; i < 5; i++) engine.advanceWeek(false);
  const weeks = asset.shortTermWeeks;
  const market = { currentValue: asset.currentValue, weeklyRent: asset.weeklyRent };
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  const loaded = reloaded.g.personalRealEstateHoldings[0];
  assert.equal(loaded.rentalMode, 'short', 'reload後も運用方式が残る');
  assert.equal(loaded.shortTermWeeks, weeks);
  assert.equal(loaded.currentValue, market.currentValue, 'reload後も更新済み市場評価額が残る');
  assert.equal(loaded.weeklyRent, market.weeklyRent, 'reload後も更新済み市場家賃が残る');
  assert.equal(reloaded.g.saveVersion, 9);
}

// 20. Legacy holdings with no mode field read as long lets and keep behaving exactly as they
// did before this feature existed.
{
  const { engine, asset, shortTerm } = withHolding();
  delete asset.rentalMode;
  delete asset.rentalModeChangedWeek;
  delete asset.shortTermWeeks;
  assert.equal(shortTerm.modeOf(asset), shortTerm.MODE_LONG, '旧セーブは長期賃貸として読める');
  const summary = engine.getPersonalRealEstateRentalMode(asset.assetID);
  assert.equal(summary.mode, 'long');
  assert.equal(summary.lockedWeeks, 0, '旧セーブは切替ロックにかからない');
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short'), true, '旧セーブの物件も通常どおり切り替えられる');
}

// 21. The founder screen offers the switch before it is taken and reports occupancy after,
// including how long the mode is locked for.
{
  const { ctx } = loadGame({ random: lcg() });
  const engine = ctx.__ct_engine, ui = ctx.__ct_ui;
  engine.g.configured = true;
  ui.showSetup = false;
  engine.g.personalCash = 500_000_000;
  engine.buyPersonalRealEstate('logistics-aichi');
  const asset = engine.g.personalRealEstateHoldings[0];
  engine.g.selectedTab = 'founder';
  engine.emit('change');
  const offered = String(ctx.document.getElementById('app').innerHTML || '');
  for (const label of ['短期賃貸へ切り替える', '初期費用']) {
    assert.ok(offered.includes(label), `切替前の画面に「${label}」が表示される`);
  }

  assert.equal(engine.switchPersonalRealEstateRentalMode(asset.assetID, 'short'), true);
  engine.emit('change');
  const running = String(ctx.document.getElementById('app').innerHTML || '');
  for (const label of ['短期賃貸で運用中', '今週の稼働', '長期賃貸へ戻す']) {
    assert.ok(running.includes(label), `切替後の画面に「${label}」が表示される`);
  }
  assert.ok(/運用方式の変更まであと\d+週/.test(running), 'ロック期間が表示される');
}

// 22. Rental mode changes operations, not the property's market. Both modes must receive the
// same value and market-rent movement in rising and falling markets, over short and long holds.
// A signed long lease remains fixed separately in contractWeeklyRent.
{
  const bag = withHolding(20260819);
  const template = JSON.parse(JSON.stringify(bag.asset));
  function compareMarket(cycle, economy, weeks) {
    const { modules, engine, shortTerm } = bag;
    const long = JSON.parse(JSON.stringify(template));
    const short = JSON.parse(JSON.stringify(long));
    short.assetID = `${long.assetID}-short`;
    short.rentalMode = shortTerm.MODE_SHORT;
    short.rentalOps.occupancyStatus = 'vacant';
    short.rentalOps.contractWeeklyRent = 0;
    engine.g.personalRealEstateHoldings = [long, short];
    engine.g.week = template.purchasedWeek;
    engine.g.personalCash = 500_000_000;
    const signedRent = long.rentalOps.contractWeeklyRent;
    const initialValue = long.currentValue;
    const initialRent = long.weeklyRent;
    for (let i = 0; i < weeks; i++) {
      engine.g.realEstateCycle = cycle;
      engine.g.economy = economy;
      engine.updatePersonalExpandedWeekly();
      engine.g.week++;
    }
    assert.equal(short.currentValue, long.currentValue, `${weeks}週後の市場評価額は運用方式に依存しない`);
    assert.equal(short.weeklyRent, long.weeklyRent, `${weeks}週後の市場家賃は運用方式に依存しない`);
    assert.equal(long.rentalOps.contractWeeklyRent, signedRent, '締結済み契約家賃は市場家賃と分離する');
    assert.equal(shortTerm.fullRateFor(short), Math.round(short.weeklyRent * shortTerm.SHORT_TERM_RATE_MULTIPLIER), '短期基準収益は更新済み市場家賃を使う');
    assert.equal(modules.personalRealEstateTaxes.annualTaxFor(short), modules.personalRealEstateTaxes.annualTaxFor(long), '固定資産税評価も運用方式に依存しない');
    return { initialValue, initialRent, currentValue: long.currentValue, weeklyRent: long.weeklyRent };
  }
  for (const weeks of [1, 13, 52]) {
    const rising = compareMarket(1.2, 1.1, weeks);
    assert.ok(rising.currentValue > rising.initialValue, `${weeks}週の上昇市場で評価額が上がる`);
    assert.ok(rising.weeklyRent > rising.initialRent, `${weeks}週の上昇市場で市場家賃が上がる`);
    const falling = compareMarket(.8, .9, weeks);
    assert.ok(falling.currentValue < falling.initialValue, `${weeks}週の下落市場で評価額が下がる`);
    assert.ok(falling.weeklyRent < falling.initialRent, `${weeks}週の下落市場で市場家賃が下がる`);
  }
}

// 23. Static source scan: no MutationObserver introduced.
{
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['../js/personal-real-estate-short-term.js', '../js/expansion.js', '../js/app.js']) {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(src), `${file}に新しいMutationObserverを追加していない`);
  }
}

console.log('personal real estate short-term tests passed');
