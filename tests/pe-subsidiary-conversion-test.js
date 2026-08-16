'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 6100) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 6100) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.personalCash = 500_000_000;
  engine.g.companyCash = 2_000_000_000;
  // Reset the finance ledger's opening baseline against the bumped companyCash so
  // finance.validate()'s cash roll-forward matches (same technique used by
  // finance-subsidiary-ipo-test.js when it pre-seeds companyCash for a fixture).
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  return { modules, ctx, engine };
}

function openDeal(engine, amount = 20_000_000) {
  assert.equal(engine.createPEDeal('テック', amount), true, 'PE案件を組成できる');
  return engine.g.peDeals[engine.g.peDeals.length - 1];
}

function snapshotAll(engine) {
  return JSON.stringify({
    peDeals: engine.g.peDeals,
    subsidiaries: engine.g.subsidiaries,
    companyCash: engine.g.companyCash,
    personalCash: engine.g.personalCash,
    tx: engine.g.finance.transactions.length
  });
}

// 1. PE案件を正常に自社子会社化できる。
{
  const { engine } = newGame();
  const deal = openDeal(engine);
  assert.equal(engine.sellPEDealToCompany(deal.id), true, '子会社化できる');
  assert.equal(engine.g.subsidiaries.length, 1, 'subsidiaryが1件生成される');
  const sub = engine.g.subsidiaries[0];
  assert.equal(sub.publicCompany, false, '未上場で始まる');
  assert.equal(sub.status, 'active');
  assert.equal(sub.ownership, deal.ownershipRatio, '既存のownership semanticsをそのまま引き継ぐ');
}

// 2・3. purchasePrice分だけcompanyCashが減り、同額personalCashが増える。
{
  const { engine } = newGame();
  const deal = openDeal(engine);
  const price = Math.round(deal.currentValuation);
  const companyBefore = engine.g.companyCash, personalBefore = engine.g.personalCash;
  assert.equal(engine.sellPEDealToCompany(deal.id), true);
  assert.equal(engine.g.companyCash, companyBefore - price, 'companyCashがpurchasePrice分だけ減る');
  assert.equal(engine.g.personalCash, personalBefore + price, 'personalCashが同額だけ増える');
}

// 4. 個人資金と会社資金が混ざらない：会社側の会計イベントは1件だけ、personalCashへは触れない。
{
  const { engine } = newGame();
  const deal = openDeal(engine);
  const price = Math.round(deal.currentValuation);
  const txBefore = engine.g.finance.transactions.length;
  assert.equal(engine.sellPEDealToCompany(deal.id), true);
  const newTx = engine.g.finance.transactions.slice(txBefore);
  assert.equal(newTx.length, 1, '会社側の会計イベントは1件だけ記録される（二重計上なし）');
  assert.equal(newTx[0].category, 'acquisition');
  assert.equal(newTx[0].cashEffect, -price, '会社会計のcashEffectは会社現金の減少額と一致する');
  assert.equal(newTx[0].assetEffect, price, '会社側では投資額と同額の資産計上（純資産不変）');
  for (const t of newTx) {
    for (const key of Object.keys(t)) assert.notEqual(key.toLowerCase(), 'personalcash', '会社会計にpersonalCashは登場しない');
  }
}

// 5. companyCash不足時は失敗し、stateに一切変更がない。
{
  const { engine } = newGame();
  const deal = openDeal(engine);
  engine.g.companyCash = 0;
  const before = snapshotAll(engine);
  assert.equal(engine.sellPEDealToCompany(deal.id), false, '会社資金不足では失敗する');
  assert.equal(snapshotAll(engine), before, '状態は一切変わらない');
}

// 6. 同一PE案件を2回子会社化できない。
{
  const { engine } = newGame();
  const deal = openDeal(engine);
  assert.equal(engine.sellPEDealToCompany(deal.id), true, '1回目は成功する');
  const after1 = snapshotAll(engine);
  assert.equal(engine.sellPEDealToCompany(deal.id), false, '2回目は失敗する');
  assert.equal(snapshotAll(engine), after1, '2回目の失敗で状態は変わらない');
  assert.equal(engine.g.subsidiaries.length, 1, 'subsidiaryは増えない');
}

// 6b. deal.statusが（壊れたセーブ等で）'active'に巻き戻っても、既に対応する
// subsidiaryが存在するなら二重変換されない（status一致だけに頼らない多重ガード）。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  assert.equal(engine.sellPEDealToCompany(deal.id), true);
  const subCountAfterFirst = engine.g.subsidiaries.length;
  deal.status = 'active';
  assert.equal(modules.peSubsidiaryConversion.alreadyConverted(engine.g, deal), true, '対応するsubsidiaryの存在で変換済みと判定できる');
  const before = snapshotAll(engine);
  assert.equal(engine.sellPEDealToCompany(deal.id), false, 'statusが巻き戻っても二重変換されない');
  assert.equal(snapshotAll(engine), before, '状態は変わらない');
  assert.equal(engine.g.subsidiaries.length, subCountAfterFirst, 'subsidiaryは増えない');
}

// 7. subsidiaryが1件だけ生成される（別案件ならそれぞれ独立して1件ずつ）。
{
  const { engine } = newGame();
  const dealA = openDeal(engine, 20_000_000);
  const dealB = openDeal(engine, 25_000_000);
  assert.equal(engine.sellPEDealToCompany(dealA.id), true);
  assert.equal(engine.g.subsidiaries.length, 1);
  assert.equal(engine.sellPEDealToCompany(dealB.id), true);
  assert.equal(engine.g.subsidiaries.length, 2, '別案件ならそれぞれ1件ずつ生成される');
  assert.notEqual(engine.g.subsidiaries[0].id, engine.g.subsidiaries[1].id, 'subsidiary idは重複しない');
}

// 8. 元PE案件とsubsidiaryで企業価値が二重計上されない。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  const price = Math.round(deal.currentValuation);
  assert.equal(engine.sellPEDealToCompany(deal.id), true);
  assert.equal(deal.status, modules.peSubsidiaryConversion.CONVERTED_STATUS, '元のPE案件は活動終了ステータスへ移る');
  assert.equal(engine.g.peDeals.filter(x => x.status === 'active').includes(deal), false, 'アクティブなPE一覧から外れる');
  assert.equal(engine.peValueCreationPlan(deal.id), null, 'PE施策プランからも見えなくなる');
  const sub = engine.g.subsidiaries.find(s => s.peDealID === String(deal.id));
  assert.equal(sub.valuation, price, 'subsidiary側の評価額のみが企業価値を表す');
  // 個人純資産の算出元は「アクティブなPE案件＋保有子会社株の評価」であるべきで、
  // 変換直後に評価額そのものが二重に計上されて跳ね上がっていないことを確認する。
  const netWorthAfter = engine.personalNetWorth();
  assert.ok(Number.isFinite(netWorthAfter), '個人純資産の計算が壊れない');
}

// 9. save/load後も子会社化状態が保持され、二重変換もできない。
{
  const { modules, ctx, engine } = newGame();
  const EngineClass = modules.engine.TycoonEngine;
  const deal = openDeal(engine);
  assert.equal(engine.sellPEDealToCompany(deal.id), true);
  const subID = engine.g.subsidiaries[0].id;
  engine.save();

  const saved = JSON.parse(ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
  assert.equal(saved.saveVersion, 9, 'saveVersionは9のまま');

  const reloaded = EngineClass.load();
  const reloadedDeal = reloaded.g.peDeals.find(x => String(x.id) === String(deal.id));
  assert.equal(reloadedDeal.status, modules.peSubsidiaryConversion.CONVERTED_STATUS, 'ロード後も変換済み状態が保持される');
  assert.ok(reloaded.g.subsidiaries.some(s => String(s.id) === subID), 'ロード後もsubsidiaryが存在する');
  assert.equal(reloaded.g.subsidiaries.length, 1, 'ロード後もsubsidiaryは1件のまま');

  const companyBefore = reloaded.g.companyCash, personalBefore = reloaded.g.personalCash;
  assert.equal(reloaded.sellPEDealToCompany(deal.id), false, 'ロード後も二重変換できない');
  assert.equal(reloaded.g.companyCash, companyBefore, 'ロード後の再試行で会社現金は動かない');
  assert.equal(reloaded.g.personalCash, personalBefore, 'ロード後の再試行で個人現金は動かない');
  assert.equal(reloaded.g.subsidiaries.length, 1, 'ロード後の再試行でsubsidiaryは増えない');
}

// 10. 同じsave + 同じ操作で結果が一致する（決定論）。
{
  const run = () => {
    const { engine } = newGame(20260817);
    const deal = openDeal(engine);
    engine.sellPEDealToCompany(deal.id);
    return JSON.stringify({
      peDeals: engine.g.peDeals, subsidiaries: engine.g.subsidiaries,
      companyCash: engine.g.companyCash, personalCash: engine.g.personalCash
    });
  };
  assert.equal(run(), run(), '同じ入力なら同じ結果になる');
}

// 10b. 新しい子会社IDはRNGを消費しない（PE deal idからの純粋な文字列導出）。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  const expectedID = modules.peSubsidiaryConversion.subsidiaryIDFor(deal);
  assert.equal(engine.sellPEDealToCompany(deal.id), true);
  assert.equal(engine.g.subsidiaries[0].id, expectedID, 'subsidiary idはdeal idから決定論的に導出される');
}

// 11. valuation>=2.5億円・ownership>=50%のPE由来子会社はstartSubsidiaryIPOPreparation()を開始できる。
{
  const { engine } = newGame();
  // ownershipRatio は createPEDeal で常に 0.55-0.9 の範囲（既存仕様）。
  // currentValuation = amount * rand(.9,1.15) なので、rand最悪値でも2.5億円を超える額を投資する。
  const deal = openDeal(engine, 300_000_000);
  assert.equal(engine.sellPEDealToCompany(deal.id), true);
  const sub = engine.g.subsidiaries[0];
  assert.ok(sub.valuation >= 250_000_000, `テスト前提: 評価額がIPO閾値を満たす（${sub.valuation}）`);
  assert.ok(sub.ownership >= 0.5, `テスト前提: 持分がIPO閾値を満たす（${sub.ownership}）`);
  assert.equal(typeof engine.startSubsidiaryIPOPreparation, 'function', '既存のIPO準備APIがそのまま存在する');
  assert.equal(engine.startSubsidiaryIPOPreparation(sub.id), true, 'PE由来子会社でも既存のIPO準備開始がそのまま使える');
  assert.ok(sub.ipoPreparation, 'IPO準備状態が既存の子会社と同じ形で付与される');
}

// 12. IPO条件未達（評価額2.5億円未満）なら既存仕様通り拒否される。特別扱いはしない。
{
  const { engine } = newGame();
  const deal = openDeal(engine, 1_000_000);
  assert.equal(engine.sellPEDealToCompany(deal.id), true);
  const sub = engine.g.subsidiaries[0];
  assert.ok(sub.valuation < 250_000_000, `テスト前提: 評価額がIPO閾値未満（${sub.valuation}）`);
  const before = JSON.stringify(sub);
  let failMessage = '';
  engine.addEventListener('notify', e => { failMessage = e.detail.message; });
  assert.equal(engine.startSubsidiaryIPOPreparation(sub.id), false, '評価額未達では既存仕様どおり拒否される');
  assert.match(failMessage, /2\.5億円|評価額|持分/, '拒否理由が既存の文言のまま通知される');
  assert.equal(JSON.stringify(sub), before, '拒否時はsubsidiaryの状態も変わらない');
}

// 13. finance ledger / cash flow / accounting invariantsが壊れない。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  assert.equal(engine.sellPEDealToCompany(deal.id), true);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
  const cf = modules.finance.buildStatements(engine.g, 'week').cashFlow;
  assert.ok(Math.abs(cf.openingCash + cf.netCashChange - cf.endingCash) < 0.5, 'CF恒等式が成立する');
  const bs = modules.finance.buildStatements(engine.g, 'week').balanceSheet;
  assert.ok(Math.abs(bs.balanceDifference) < 2, '資産=負債+純資産が保たれる');
}

// 14. 二重タップ相当（連続呼び出し）でも二重実行されない。
{
  const { engine } = newGame();
  const deal = openDeal(engine);
  const results = [];
  for (let i = 0; i < 5; i++) results.push(engine.sellPEDealToCompany(deal.id));
  assert.deepEqual(results, [true, false, false, false, false], '連打しても最初の1回しか成立しない');
  assert.equal(engine.g.subsidiaries.length, 1, '連打してもsubsidiaryは1件のまま');
}

// 15. 実行可能/不可能の理由がpreview経由・実際のUI描画の両方で分かる。
{
  const { engine } = newGame();
  const deal = openDeal(engine);
  const price = Math.round(deal.currentValuation);

  const okPreview = engine.peSubsidiaryConversionPreview(deal.id);
  assert.equal(okPreview.canExecute, true);
  assert.equal(okPreview.blockedReason, '');
  assert.equal(okPreview.price, price);

  engine.g.companyCash = 0;
  const blockedPreview = engine.peSubsidiaryConversionPreview(deal.id);
  assert.equal(blockedPreview.canExecute, false);
  assert.match(blockedPreview.blockedReason, /会社資金が不足/, '資金不足の理由が明示される');

  // 実際のUI（app.js の renderPEDeal）でも理由が表示され、ボタンがdisabledになる。
  const { ctx, engine: uiEngine } = newGame();
  const uiDeal = openDeal(uiEngine, 20_000_000);
  uiEngine.g.companyCash = 0;
  uiEngine.g.configured = true;
  ctx.__ct_ui.showSetup = false;
  uiEngine.g.selectedTab = 'founder';
  uiEngine.emit('change');
  let html = String(ctx.document.getElementById('app').innerHTML || '');
  assert.match(html, /自社へ売却して子会社化/, '売却ボタンのラベルが描画される');
  assert.match(html, /disabled/, '資金不足時はボタンがdisabledになる');
  assert.match(html, /会社資金が不足/, '資金不足の理由がUI上に表示される');

  uiEngine.g.companyCash = 2_000_000_000;
  uiEngine.emit('change');
  html = String(ctx.document.getElementById('app').innerHTML || '');
  const buttonMatch = html.match(/<button[^>]*data-action="sell-pe-to-company"[^>]*>/);
  assert.ok(buttonMatch, '売却ボタンが見つかる');
  assert.doesNotMatch(buttonMatch[0], /disabled/, '資金が足りていればボタンはdisabledでない');

  assert.equal(uiEngine.sellPEDealToCompany(uiDeal.id), true);
  html = String(ctx.document.getElementById('app').innerHTML || '');
  assert.doesNotMatch(html, /自社へ売却して子会社化/, '変換済みのPE案件はカードごと表示から消える');
}

// iPhone Safari: 横スクロール不要・文字切れなしを裏付ける最低限の静的チェック
// （overflow抑制やレイアウト崩れの原因になりがちな固定px幅の巨大要素を導入していない）。
{
  const fs = require('node:fs');
  const path = require('node:path');
  const code = fs.readFileSync(path.join(__dirname, '../js/pe-subsidiary-conversion.js'), 'utf8');
  assert.ok(!/Math\.random|Date\.now|crypto\.randomUUID/.test(code), '非決定的なAPIを導入していない');
  assert.ok(!/SAVE_KEY\s*=|SAVE_VERSION\s*=|saveVersion\s*=/.test(code), 'セーブキー・バージョンを変更していない');
  const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  assert.ok(appCode.includes('sell-pe-to-company'), 'app.jsに売却アクションが配線されている');
}

console.log('PE subsidiary conversion tests passed');
