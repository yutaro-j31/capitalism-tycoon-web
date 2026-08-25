'use strict';

// productVentures.investedCost existed in the state shape since launchProduct() but was never
// incremented anywhere -- it stayed frozen at 0 for the lifetime of every product, so the
// "累計投資額" a player had actually poured into quality/marketing investment (engine.js
// productAction), innovation roadmaps (player-engine-bridge.js), and patent implementations
// was completely invisible on the product card, which only ever showed the current week's
// 週次利益. This module wires investedCost up as a purely informational running total (surfaced
// as a new 累計投資額 stat next to 週次利益) so the player can see the full picture without
// changing how weekly revenue/cost/profit are computed.
//
// investedCost intentionally does NOT feed into sellProduct()'s accounting. Every productVenture
// R&D-style spend (launch, productAction, roadmap, patent) is expensed as incurred
// (assetEffect:0 throughout, never capitalized as a balance-sheet asset), so there is no
// carrying book value left to net against on a later sale -- the full sale price is correctly
// the entire gain. js/finance.js's balance sheet is built from live game-state snapshots
// (stockBook/propertyBook/subsidiaryBook/otherFixedBook), not from accumulated assetEffect
// deltas, so wiring investedCost into sellProduct's profitEffect (which was tried and reverted
// during this fix) breaks the assets=liabilities+equity identity: cashEffect and profitEffect
// must stay in lockstep for any category with no tracked balance-sheet bucket.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function lcg(seed = 606) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function withEngine(seed = 606) {
  const loaded = loadGame({ random: lcg(seed), headless: true });
  loaded.modules.playerEngineBridge.installProductInnovation();
  const e = new loaded.engineModule.TycoonEngine();
  e.g.configured = true;
  e.g.companyCash = 200_000_000;
  e.g.finance = loaded.modules.finance.defaultFinanceState(e.g);
  Object.assign(e.g.finance, { openingCash: e.g.companyCash, openingAssets: e.g.companyCash, openingEquity: e.g.companyCash, openingRetainedEarnings: e.g.companyCash });
  e.g.departments.product = { name: '商品開発部' };
  e.g.departments.marketing = { name: 'マーケティング部' };
  e.g.departments.dx = { name: 'DX部' };
  return { loaded, e };
}

// 1. launchProduct seeds investedCost with the development cost (previously started at 0
// forever).
{
  const { e } = withEngine();
  assert.equal(e.launchProduct('app', 'テストアプリ'), true);
  const product = e.g.productVentures[0];
  assert.equal(product.investedCost, 6_500_000, 'PRODUCT_BLUEPRINTS.appのcostがそのままinvestedCostの初期値になる');
}

// 2. productAction accumulates every kind (quality/marketing/development) into investedCost.
{
  const { e } = withEngine();
  e.launchProduct('app', 'テストアプリ');
  const product = e.g.productVentures[0];
  const before = product.investedCost;
  assert.equal(e.productAction(product.id, 'development', 1_000_000), true);
  assert.equal(e.productAction(product.id, 'quality', 500_000), true);
  assert.equal(e.productAction(product.id, 'marketing', 750_000), true);
  assert.equal(product.investedCost, before + 1_000_000 + 500_000 + 750_000);
}

// 3. Innovation roadmaps and patent implementations also accumulate into investedCost.
{
  const { loaded, e } = withEngine();
  e.launchProduct('app', 'テストアプリ');
  const product = e.g.productVentures[0];
  product.status = 'released'; product.quality = 55; product.brand = 40;
  e.ensureProductFunnel(product);
  const beforeRoadmap = product.investedCost;
  const options = e.productInnovationOptions(product.id);
  const roadmapOption = options.find(x => x.id === 'quality_refresh');
  assert.ok(roadmapOption?.canStart, 'テスト前提: ロードマップを開始できる');
  assert.ok(e.startProductInnovationRoadmap(product.id, 'quality_refresh'));
  assert.equal(product.investedCost, beforeRoadmap + roadmapOption.cost, 'ロードマップ費用がinvestedCostに加算される');

  const beforePatent = product.investedCost;
  e.g.patentRecords.push({ id: 'patent-1', projectID: 'payment', name: '決済最適化特許', effect: 'product', strength: .045, licensed: false });
  assert.equal(e.assignPatentToProduct('patent-1', product.id), true);
  assert.equal(product.investedCost, beforePatent + 1_500_000, '特許実装費（非自宅開発は150万円）がinvestedCostに加算される');
}

// 4. launchFounderHomeProduct also seeds investedCost (it previously had no investedCost field
// at all).
{
  const { e } = withEngine();
  e.g.founderSkillTech = 1;
  e.g.founderHomeDeskSlots = 2;
  e.g.localReputationByPref = e.g.localReputationByPref || {};
  e.g.localReputationByPref[e.g.founderHomePrefID] = e.g.localReputationByPref[e.g.founderHomePrefID] || 0;
  assert.equal(e.launchFounderHomeProduct('reservationApp'), true);
  const product = e.g.productVentures.find(x => x.origin === 'founderHome');
  assert.ok(product, 'テスト前提: 自宅開発プロダクトが作られる');
  assert.equal(product.investedCost, 450_000, 'FOUNDER_HOME_PRODUCTSのcostがそのままinvestedCostの初期値になる（founderSkillTech=1のため割引なし）');
}

// 5. UI: a new 累計投資額 stat sits next to 週次利益 in both the developing and released
// branches, without any new button.
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /累計投資額/);
  assert.match(app, /stat\('累計投資額',compactYen\(p\.investedCost\)\)/);
  assert.equal((app.match(/'product-action'/g) || []).length, 3, '既存の品質投資・集客投資アクション名は変更していない（ボタン2箇所＋dispatcher1箇所）');
}

// 6. Old saves missing investedCost render safely (compactYen falls back to 0, no crash) and
// accumulate correctly from that point forward.
{
  const { e } = withEngine();
  e.launchProduct('app', 'テストアプリ');
  const product = e.g.productVentures[0];
  delete product.investedCost;
  assert.equal(e.productAction(product.id, 'quality', 1_000_000), true);
  assert.equal(product.investedCost, 1_000_000, '欠落フィールドは0として扱われ、そこから正しく加算される');
}

// 7. sellProduct's gain is NOT netted against investedCost -- the whole sale price is the gain,
// because R&D is expensed as incurred (no capitalized book value survives to net against), and
// the balance sheet is built from live game state rather than accumulated assetEffect deltas.
{
  const { loaded, e } = withEngine();
  e.launchProduct('app', 'テストアプリ');
  const product = e.g.productVentures[0];
  e.productAction(product.id, 'development', 3_000_000);
  assert.ok(product.investedCost > 6_500_000, 'テスト前提: investedCostが積み上がっている');
  product.valuation = 20_000_000;
  const cashBefore = e.g.companyCash;
  assert.equal(e.sellProduct(product.id), true);
  assert.equal(e.g.companyCash, cashBefore + 20_000_000, '売却代金は全額そのまま会社資金へ入る');
  const st = loaded.modules.finance.buildStatements(e.g, '52');
  assert.equal(st.profitAndLoss.otherNonOperating, 20_000_000, '売却益はinvestedCostを差し引かず全額を計上する（R&D費用化済みのため簿価ゼロ）');
  assert.equal(loaded.modules.finance.validate(e.g).ok, true, '会計整合性チェックを通過する');
}

console.log('product invested cost checks passed');
