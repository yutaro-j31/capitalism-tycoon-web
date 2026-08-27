'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

// 不動産の価格交渉（Coffee Inc 2化 item 3の最後の1本）。
// 既存の engine.buyProperty() は掲示価格での即時購入のみで、CI2にあるような
// 「安く提示して交渉する」という選択肢が存在しなかった。新しい交渉AIは発明せず、
// 他の不動産モジュール（real-estate-tenant-renewals.js の更新交渉、
// real-estate-property-disposals.js の売却査定）と同じ hash01() 決定論判定パターンを
// そのまま踏襲した。ここで守りたい不変条件は、事前試算(propertyPriceNegotiationOffers)が
// 約束した提示額・合意可否と、実行(negotiatePropertyPrice)の結果が一致すること、
// 会社/個人の資産分離が交渉購入でも保たれること、そして既存の即時購入(buyProperty)が
// 交渉機能の追加によって壊れていないこと。

// loadGame()にシードを固定した random を渡さないと g.properties の各UUIDが実行のたびに
// 変わり、hash01(id,...) による合意/決裂の判定が非決定的（テストがflakyに）になる。
// 他の不動産モジュールのテストと同じ lcg(seed) パターンで固定する。
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 0x51a17e01) {
  const { modules } = loadGame({ random: lcg(seed) });
  const engine = new modules.engine.TycoonEngine();
  engine.g.configured = true;
  engine.g.companyCash = 10_000_000_000;
  engine.g.personalCash = 10_000_000_000;
  // companyCashを直接引き上げた分、finance側の期首残高も同期させないと
  // finance.validate()の恒等式（資産=負債+純資産・現金ロールフォワード）が崩れる。
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  return { modules, engine };
}

function findOfferOutcome(modules, engine, propertyID, offers) {
  const week = Math.floor(engine.g.week);
  return offers.map(o => ({
    ...o,
    accepted: modules.realEstatePriceNegotiation.hash01(propertyID, week, `negotiate-${o.ratio}`) < o.acceptanceChance
  }));
}

// 特定の1件目の物件だけでは、そのseedで決裂/合意いずれかのケースが
// たまたま存在しないことがある（実測: 最初の未所有物件は638/1128が合意側に
// 寄っていた）。全物件・全提示率を対象に、望む結果(accepted)を最初に持つ
// 物件を探す。テスト自体の決定論性は変えず、対象物件の選び方だけを
// 頑健にする。
function findPropertyWithOutcome(modules, engine, wantAccepted) {
  for (const p of engine.g.properties) {
    if (p.owner) continue;
    const offers = engine.propertyPriceNegotiationOffers(p.id);
    const outcomes = findOfferOutcome(modules, engine, p.id, offers);
    const match = outcomes.find(o => o.accepted === wantAccepted);
    if (match) return { property: p, offers, outcomes, match };
  }
  return null;
}

// 1. 試算(propertyPriceNegotiationOffers)は読み取り専用で、4段階の提示率を返す。
// 提示率が高いほど合意確率も高くなる（安易な提示ほど成立しにくいという直感的な
// トレードオフが実際に成立していること）。
{
  const { engine } = newGame();
  const p = engine.g.properties.find(x => !x.owner);
  const snapshot = JSON.stringify(engine.g);
  const offers = engine.propertyPriceNegotiationOffers(p.id);
  engine.propertyPriceNegotiationOffers(p.id);
  assert.equal(JSON.stringify(engine.g), snapshot, 'propertyPriceNegotiationOffers は状態を変更してはならない');
  assert.equal(offers.length, 4, '提示率は4段階');
  for (let i = 1; i < offers.length; i++) {
    assert.ok(offers[i].ratio > offers[i - 1].ratio);
    assert.ok(offers[i].offerPrice > offers[i - 1].offerPrice, '提示率が高いほど提示額も高い');
    assert.ok(offers[i].acceptanceChance >= offers[i - 1].acceptanceChance, '提示率が高いほど合意確率も高い（同値は許容）');
    assert.equal(offers[i].offerPrice, Math.round(p.price * offers[i].ratio), '提示額は掲示価格×提示率と一致する');
  }
}

// 2. 存在しない物件・既に所有済みの物件へは空配列/失敗を返す（UI側が安全に描画できる）。
{
  const { engine } = newGame();
  assert.equal(engine.propertyPriceNegotiationOffers('missing-property-id').length, 0);
  const owned = engine.g.properties.find(x => !x.owner);
  assert.ok(engine.buyProperty(owned.id, 'company'));
  assert.equal(engine.propertyPriceNegotiationOffers(owned.id).length, 0, '所有済みの物件には交渉できない');
  assert.equal(engine.negotiatePropertyPrice(owned.id, 'company', .9), false, '所有済みの物件への交渉は失敗する');
}

// 3. 決裂ケース: 現金は動かず、所有者もつかない。予告どおりクールダウンが設定され、
// クールダウン中は再交渉（試算・実行とも）できない。
{
  const { modules, engine } = newGame();
  const found = findPropertyWithOutcome(modules, engine, false);
  assert.ok(found, 'このseedには決裂する物件・提示率の組が存在すること（フィクスチャの前提）');
  const { property: p, match: declined } = found;

  const cashBefore = engine.g.companyCash;
  const result = engine.negotiatePropertyPrice(p.id, 'company', declined.ratio);
  assert.equal(result.accepted, false);
  assert.equal(result.offerPrice, declined.offerPrice, '決裂時も試算どおりの提示額を返す');
  assert.equal(engine.g.companyCash, cashBefore, '決裂時は現金が動かない');
  const after = engine.g.properties.find(x => x.id === p.id);
  assert.equal(after.owner, null, '決裂時は所有者がつかない');
  assert.ok(after.negotiationDeclinedUntilWeek > engine.g.week, '決裂後はクールダウンが設定される');

  assert.equal(engine.propertyPriceNegotiationOffers(p.id).length, 0, 'クールダウン中は試算が空になる');
  assert.equal(engine.negotiatePropertyPrice(p.id, 'company', declined.ratio), false, 'クールダウン中は再交渉できない');
  assert.equal(engine.g.companyCash, cashBefore, 'クールダウン中の再交渉試行でも現金は動かない');
}

// 4. 合意ケース: 実際の支払額は試算した提示額と厳密に一致し、所有権・簿価も
// 交渉価格ベースで設定される。会計整合性（finance.validate）も保たれる。
{
  const { modules, engine } = newGame();
  const found = findPropertyWithOutcome(modules, engine, true);
  assert.ok(found, 'このseedには合意する物件・提示率の組が存在すること（フィクスチャの前提）');
  const { property: p, match: accepted } = found;

  const cashBefore = engine.g.companyCash;
  const result = engine.negotiatePropertyPrice(p.id, 'company', accepted.ratio);
  assert.equal(result.accepted, true);
  assert.equal(result.offerPrice, accepted.offerPrice);
  const actualPaid = cashBefore - engine.g.companyCash;
  assert.equal(actualPaid, accepted.offerPrice, `試算した提示額と実際の支払額が一致すること（試算 ${accepted.offerPrice} / 実測 ${actualPaid}）`);
  const after = engine.g.properties.find(x => x.id === p.id);
  assert.equal(after.owner, 'company');
  assert.equal(after.purchasePrice, accepted.offerPrice, '簿価は交渉価格ベース');
  assert.equal(after.bookValue, accepted.offerPrice);
  assert.equal(modules.finance.validate(engine.g).ok, true, modules.finance.validate(engine.g).errors.join(' / '));
  console.log(`real estate price negotiation: 提示 ${accepted.offerPrice} → 合意・実測 ${actualPaid} 一致`);
}

// 5. 会社資産と個人資産の分離: 個人での交渉購入はpersonalCashだけを動かし、
// companyCash・会社のfinance元帳には一切触れない（既存のbuyProperty()と同じ扱い）。
{
  const { modules, engine } = newGame();
  const found = findPropertyWithOutcome(modules, engine, true);
  assert.ok(found, 'このseedには合意する物件・提示率の組が存在すること（フィクスチャの前提）');
  const { property: p, match: accepted } = found;

  const companyCashBefore = engine.g.companyCash;
  const personalCashBefore = engine.g.personalCash;
  const transactionCountBefore = modules.finance.ensureFinance(engine.g).transactions.length;
  const result = engine.negotiatePropertyPrice(p.id, 'personal', accepted.ratio);
  assert.equal(result.accepted, true);
  assert.equal(engine.g.companyCash, companyCashBefore, '個人交渉は会社資金に触れない');
  assert.equal(companyCashBefore - engine.g.companyCash + (personalCashBefore - engine.g.personalCash), accepted.offerPrice);
  assert.equal(personalCashBefore - engine.g.personalCash, accepted.offerPrice, '個人資金からのみ支払われる');
  assert.equal(modules.finance.ensureFinance(engine.g).transactions.length, transactionCountBefore, '個人購入は会社のfinance元帳に記帳しない（buyPropertyと同じ扱い）');
  const after = engine.g.properties.find(x => x.id === p.id);
  assert.equal(after.owner, 'personal');
}

// 6. 資金不足時は交渉自体が失敗し、状態も変わらない。
{
  const { engine } = newGame();
  const p = engine.g.properties.find(x => !x.owner);
  const offers = engine.propertyPriceNegotiationOffers(p.id);
  const cheapest = offers[0];
  engine.g.companyCash = cheapest.offerPrice - 1;
  const before = JSON.stringify(engine.g.properties.find(x => x.id === p.id));
  assert.equal(engine.negotiatePropertyPrice(p.id, 'company', cheapest.ratio), false, '資金不足なら交渉できない');
  assert.equal(JSON.stringify(engine.g.properties.find(x => x.id === p.id)), before, '資金不足の失敗時は物件の状態が変わらない');
}

// 7. 決定論: 試算・交渉ともMath.randomを消費しない（hash01のみを使う）。
{
  const { engine } = newGame();
  const p = engine.g.properties.find(x => !x.owner);
  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    engine.propertyPriceNegotiationOffers(p.id);
    engine.negotiatePropertyPrice(p.id, 'company', .7);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, '不動産の価格交渉はMath.randomを消費しない');
}

// 8. 旧セーブ互換: negotiationDeclinedUntilWeekフィールドが存在しない物件でも
// クラッシュしない。saveVersionは9のまま。
{
  const { engine } = newGame();
  const p = engine.g.properties.find(x => !x.owner);
  delete p.negotiationDeclinedUntilWeek;
  assert.doesNotThrow(() => engine.propertyPriceNegotiationOffers(p.id));
  engine.save();
  assert.equal(engine.g.saveVersion, 9);
}

// 9. 既存の即時購入(buyProperty)は交渉機能の追加後も掲示価格でそのまま動作する
// （新しい選択肢を追加しただけで、既存の導線を壊していないことの担保）。
{
  const { engine } = newGame();
  const p = engine.g.properties.find(x => !x.owner);
  const priceBefore = p.price;
  const cashBefore = engine.g.companyCash;
  assert.equal(engine.buyProperty(p.id, 'company'), true);
  assert.equal(cashBefore - engine.g.companyCash, priceBefore, '即時購入は引き続き掲示価格そのままで動作する');
}

// 10. UIから到達できること。エンジンに実装があっても画面にボタンが無ければ
// プレイヤーには存在しないのと同じ（store-closure-plan-test.js等と同じパターン）。
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /data-action="negotiate-property-company"|'negotiate-property-company'/, 'negotiate-property-company アクションが app.js に存在する');
  assert.match(app, /data-action="negotiate-property-personal"|'negotiate-property-personal'/, 'negotiate-property-personal アクションが app.js に存在する');
  assert.match(app, /case 'negotiate-property-company':/);
  assert.match(app, /case 'negotiate-property-personal':/);
  assert.match(app, /case 'negotiate-property-price':/);
  assert.match(app, /function confirmPropertyNegotiation/, '実行前に提示額・合意確率を提示する確認ダイアログを経由する');
  assert.doesNotMatch(app, /case 'negotiate-property-company':engine\.negotiatePropertyPrice\(/, '確認なしで直接negotiatePropertyPrice()を呼ばない');
}

console.log('real estate price negotiation tests passed');
