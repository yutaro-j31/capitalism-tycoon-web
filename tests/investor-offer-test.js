'use strict';

// Verifies the pre-IPO capital structure work: a smaller initial share count
// (10,000 instead of 1,000,000), VC investor offers that dilute founder ownership in
// exchange for company cash (reusing the previously-scaffolded but unused
// state.investorOffers array), and that IPO math stays internally consistent (ratio-based
// primary offering / founder sale) regardless of how much dilution happened beforehand.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 31900) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 31900) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, ctx, engine };
}

function reachHeadOffice(engine) {
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true, '本社オフィスを契約できる');
}

// A believable (not real-tenant-opened, but well-formed) set of stores for tests that only
// need IPO eligibility, not store gameplay itself -- companyValue() reads businessID/
// lastProfit off each store, and a malformed store (missing those) produces NaN that a
// finite() wrapper elsewhere silently clamps to 0, which would make companyValue() look
// like 0 regardless of companyCash. businessID must reference a real MASTER.businesses id.
function fakeIpoReadyStores() {
  return [
    { status: 'open', businessID: 'ramen', lastProfit: 0 },
    { status: 'open', businessID: 'ramen', lastProfit: 0 },
    { status: 'open', businessID: 'ramen', lastProfit: 0 }
  ];
}

// 1. Initial capital structure: 1,000,000 ではなく 10,000 株から始まる。
{
  const { engine } = newGame();
  assert.equal(engine.g.sharesOut, 10_000, '発行株の初期値は10,000株');
  assert.equal(engine.g.founderShares, 10_000, '創業者株の初期値は10,000株（100%所有）');
}

// 2. 本社オフィス無しでは出資提案を生成できない。
{
  const { engine } = newGame();
  assert.equal(engine.g.hasHeadOffice, false);
  assert.equal(engine.refreshInvestorOffers(), false, '本社オフィス無しでは出資提案を生成できない');
  assert.equal(engine.g.investorOffers.length, 0);
}

// 3. 本社オフィス契約後は出資提案を生成できる。1〜2件、pending状態で追加される。
{
  const { engine } = newGame();
  reachHeadOffice(engine);
  assert.equal(engine.refreshInvestorOffers(), true);
  assert.ok(engine.g.investorOffers.length >= 1 && engine.g.investorOffers.length <= 2, '1〜2件の提案が生成される');
  for (const o of engine.g.investorOffers) {
    assert.equal(o.status, 'pending');
    assert.ok(o.amount > 0, '出資額が正');
    assert.ok(o.equity > 0 && o.equity < 1, '取得予定持分が0〜1の範囲');
    assert.ok(o.preMoneyValuation > 0, 'プレマネー評価額が正');
    assert.ok(o.expiresWeek > engine.g.week, '期限は現在週より先');
  }
}

// 4. 出資を受け入れると、companyCashが増え、sharesOutが希薄化計算どおりに増える。
// personalCash/personalStocksには一切触れない（会社/個人分離）。
{
  const { engine } = newGame();
  reachHeadOffice(engine);
  assert.equal(engine.refreshInvestorOffers(), true);
  const offer = engine.g.investorOffers[0];
  const sharesBefore = engine.g.sharesOut;
  const cashBefore = engine.g.companyCash;
  const personalCashBefore = engine.g.personalCash;
  const personalStocksBefore = JSON.stringify(engine.g.personalStocks);

  const expectedNewShares = Math.max(1, Math.round(sharesBefore * offer.amount / offer.preMoneyValuation));
  assert.equal(engine.acceptInvestorOffer(offer.id), true);

  assert.equal(engine.g.companyCash, cashBefore + offer.amount, 'companyCashが出資額分だけ増える');
  assert.equal(engine.g.sharesOut, sharesBefore + expectedNewShares, 'sharesOutが希薄化計算どおりに増える');
  assert.equal(engine.g.founderShares, 10_000, '創業者の保有株数そのものは変わらない（比率だけ希薄化）');
  assert.ok(engine.g.founderOwnershipRatio < 1, '創業者の所有比率は希薄化される');
  assert.equal(engine.g.personalCash, personalCashBefore, 'personalCashは不変');
  assert.equal(JSON.stringify(engine.g.personalStocks), personalStocksBefore, 'personalStocksは不変');
  assert.equal(offer.status, 'accepted');
}

// 5. finance ledgerの整合性：会計イベントは1件のみ、cashEffect/equityEffectが出資額と一致する。
{
  const { modules, engine } = newGame();
  reachHeadOffice(engine);
  assert.equal(engine.refreshInvestorOffers(), true);
  const offer = engine.g.investorOffers[0];
  const txBefore = engine.g.finance.transactions.length;
  assert.equal(engine.acceptInvestorOffer(offer.id), true);
  const newTx = engine.g.finance.transactions.slice(txBefore);
  assert.equal(newTx.length, 1, '会計イベントは1件だけ記録される');
  assert.equal(newTx[0].category, 'equityFinancing');
  assert.equal(newTx[0].cashEffect, offer.amount);
  assert.equal(newTx[0].equityEffect, offer.amount);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 6. 出資提案を見送っても状態は変わらない（statusだけ更新）。
{
  const { engine } = newGame();
  reachHeadOffice(engine);
  assert.equal(engine.refreshInvestorOffers(), true);
  const offer = engine.g.investorOffers[0];
  const cashBefore = engine.g.companyCash, sharesBefore = engine.g.sharesOut;
  assert.equal(engine.declineInvestorOffer(offer.id), true);
  assert.equal(offer.status, 'declined');
  assert.equal(engine.g.companyCash, cashBefore);
  assert.equal(engine.g.sharesOut, sharesBefore);
}

// 7. atomicity: 期限切れ・存在しない・上場済みの提案は失敗し、状態が一切変わらない。
{
  const { engine } = newGame();
  reachHeadOffice(engine);
  assert.equal(engine.refreshInvestorOffers(), true);
  const offer = engine.g.investorOffers[0];

  const snapshot = () => JSON.stringify({
    companyCash: engine.g.companyCash, sharesOut: engine.g.sharesOut,
    personalCash: engine.g.personalCash, tx: engine.g.finance.transactions.length
  });

  let before = snapshot();
  assert.equal(engine.acceptInvestorOffer('missing-offer-id'), false, '存在しない提案は失敗する');
  assert.equal(snapshot(), before, '状態は変わらない');

  offer.expiresWeek = engine.g.week - 1;
  before = snapshot();
  assert.equal(engine.acceptInvestorOffer(offer.id), false, '期限切れの提案は失敗する');
  assert.equal(snapshot(), before, '状態は変わらない');
  offer.expiresWeek = engine.g.week + 6;

  assert.equal(engine.acceptInvestorOffer(offer.id), true, '一度目は成功する');
  before = snapshot();
  assert.equal(engine.acceptInvestorOffer(offer.id), false, '同一提案を二重承諾できない');
  assert.equal(snapshot(), before, '状態は変わらない');
}

// 8. 週送りで期限切れ提案は自動的に'expired'へ遷移する。
{
  const { engine } = newGame();
  reachHeadOffice(engine);
  assert.equal(engine.refreshInvestorOffers(), true);
  const offer = engine.g.investorOffers[0];
  const expiry = offer.expiresWeek;
  while (engine.g.week <= expiry) engine.advanceWeek(false);
  assert.equal(offer.status, 'expired', '期限を過ぎるとexpiredへ自動遷移する');
  assert.equal(engine.acceptInvestorOffer(offer.id), false, '期限切れ後は承諾できない');
}

// 9. 週送りで自動的に提案が生成される（本社オフィスがあれば）。生成上限（pending 2件）を超えない。
{
  const { engine } = newGame(5151);
  reachHeadOffice(engine);
  for (let i = 0; i < 40 && engine.g.investorOffers.filter(o => o.status === 'pending').length === 0; i++) engine.advanceWeek(false);
  assert.ok(engine.g.investorOffers.length >= 1, '週送りだけで出資提案が自動生成される');
  for (let i = 0; i < 60; i++) engine.advanceWeek(false);
  const pendingCounts = [];
  for (const o of engine.g.investorOffers) if (o.status === 'pending') pendingCounts.push(o);
  assert.ok(pendingCounts.length <= 2, `pending提案は上限2件を超えない（実際 ${pendingCounts.length}）`);
}

// 10. 本社オフィス無しでは自動生成されない。店舗ルート序盤の進行を妨げない。
{
  const { engine } = newGame(6161);
  assert.equal(engine.g.hasHeadOffice, false);
  for (let i = 0; i < 30; i++) engine.advanceWeek(false);
  assert.equal(engine.g.investorOffers.length, 0, '本社オフィス契約前は提案が生成されない');
}

// 11. 上場後は出資提案を新規生成・承諾できない（別の資金調達手段へ切り替わる）。
{
  const { modules, engine } = newGame(7171);
  engine.g.companyCash = 500_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  reachHeadOffice(engine);
  engine.g.stores = fakeIpoReadyStores();
  engine.g.departments.accounting = { setupCost: 0 };
  engine.g.boardEstablished = true;
  engine.g.reports = Array.from({ length: 52 }, (_, i) => ({ week: i + 1, profit: 500_000 }));
  assert.equal(engine.ipoMissingReasons().length, 0, `IPO条件が揃っていない: ${engine.ipoMissingReasons().join('、')}`);
  assert.equal(engine.executeIPO('東証グロース'), true);
  assert.equal(engine.refreshInvestorOffers(), false, '上場後は出資提案を生成できない');
}

// 12. IPO整合性：VC出資を複数回受けて希薄化した後でもIPOのfinance整合性が保たれる
// （primary offering / founder saleの計算式がsharesOutの変動に追従することの回帰確認）。
{
  const { modules, engine } = newGame(8181);
  engine.g.companyCash = 500_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  reachHeadOffice(engine);
  for (let round = 0; round < 3; round++) {
    assert.equal(engine.refreshInvestorOffers(), true);
    const pending = engine.g.investorOffers.find(o => o.status === 'pending');
    assert.equal(engine.acceptInvestorOffer(pending.id), true);
  }
  assert.ok(engine.g.sharesOut > 10_000, 'VC出資で株数が希薄化前より増えている');
  assert.ok(engine.g.founderOwnershipRatio < 1, '創業者比率が希薄化されている');

  engine.g.stores = fakeIpoReadyStores();
  engine.g.departments.accounting = { setupCost: 0 };
  engine.g.boardEstablished = true;
  engine.g.reports = Array.from({ length: 52 }, (_, i) => ({ week: i + 1, profit: 500_000 }));
  assert.equal(engine.ipoMissingReasons().length, 0, `IPO条件が揃っていない: ${engine.ipoMissingReasons().join('、')}`);

  const cashBefore = engine.g.companyCash;
  assert.equal(engine.executeIPO('東証グロース'), true);
  assert.ok(engine.g.companyCash > cashBefore, 'IPOで会社現金が増える');
  assert.ok(engine.g.founderShares > 0 && engine.g.founderShares < 10_000, '創業者株の一部だけが売り出される（マイナスにならない）');

  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 13. 株式分割は既存実装のまま利用でき、株数の小さい新しい基準でも正しく機能する。
{
  const { modules, engine } = newGame(9191);
  engine.g.companyCash = 500_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  reachHeadOffice(engine);
  engine.g.stores = fakeIpoReadyStores();
  engine.g.departments.accounting = { setupCost: 0 };
  engine.g.boardEstablished = true;
  engine.g.reports = Array.from({ length: 52 }, (_, i) => ({ week: i + 1, profit: 500_000 }));
  assert.equal(engine.executeIPO('東証グロース'), true);

  const sharesBefore = engine.g.sharesOut, founderBefore = engine.g.founderShares, priceBefore = engine.g.stockPrice;
  assert.equal(engine.stockSplit(engine.g.ticker, 2), true, '既存のstockSplitが引き続き機能する');
  assert.equal(engine.g.sharesOut, sharesBefore * 2);
  assert.equal(engine.g.founderShares, founderBefore * 2);
  assert.ok(Math.abs(engine.g.stockPrice - priceBefore / 2) < 1e-6);
}

// 14. save→reload後も出資提案の状態が保持される。
{
  const { modules, ctx, engine } = newGame(2020);
  reachHeadOffice(engine);
  assert.equal(engine.refreshInvestorOffers(), true);
  const offer = engine.g.investorOffers[0];
  assert.equal(engine.acceptInvestorOffer(offer.id), true);
  const sharesAfter = engine.g.sharesOut, cashAfter = engine.g.companyCash;
  engine.save();

  const saved = JSON.parse(ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
  assert.equal(saved.saveVersion, 9, 'saveVersionは9のまま');

  const EngineClass = modules.engine.TycoonEngine;
  const reloaded = EngineClass.load();
  assert.equal(reloaded.g.sharesOut, sharesAfter, 'reload後もsharesOutが一致する');
  assert.equal(reloaded.g.companyCash, cashAfter, 'reload後もcompanyCashが一致する');
  const reloadedOffer = reloaded.g.investorOffers.find(o => o.id === offer.id);
  assert.equal(reloadedOffer.status, 'accepted', 'reload後も提案の状態が保持される');
}

// 15. 決定論：同じseed・同じ操作で同じ結果になる。
{
  const run = () => {
    const { engine } = newGame(3030);
    reachHeadOffice(engine);
    engine.refreshInvestorOffers();
    const offer = engine.g.investorOffers[0];
    engine.acceptInvestorOffer(offer.id);
    return JSON.stringify({
      sharesOut: engine.g.sharesOut, companyCash: engine.g.companyCash,
      founderOwnershipRatio: engine.g.founderOwnershipRatio, offers: engine.g.investorOffers
    });
  };
  assert.equal(run(), run(), '同じ入力なら同じ結果になる');
}

// 16. 旧セーブ互換：sharesOutの初期値を1,000,000→10,000へ変更したが、既存セーブが
// 明示的に持っている1,000,000株という値は上書きされず、そのまま維持される
// （新規ゲームだけが新しい初期値で始まる）。investorOffersも安全に配列へ復元される。
{
  const { modules } = newGame();
  const fs = require('node:fs');
  const raw = fs.readFileSync(require('node:path').join(__dirname, 'fixtures', 'current-version-save.json'), 'utf8');
  const migrated = modules.engine.migrateSave(JSON.parse(raw));
  assert.equal(migrated.ok, true, (migrated.errors || []).join('\n'));
  assert.equal(migrated.state.sharesOut, 1_000_000, '既存セーブの発行株数（旧初期値）は書き換えられない');
  assert.equal(migrated.state.founderShares, 1_000_000, '既存セーブの創業者株数も書き換えられない');
  assert.ok(Array.isArray(migrated.state.investorOffers), 'investorOffersは配列として復元される');
  assert.equal(migrated.state.saveVersion, 9, 'saveVersionは9へ正規化される');
}

console.log('Investor offer / pre-IPO capital structure tests passed');
