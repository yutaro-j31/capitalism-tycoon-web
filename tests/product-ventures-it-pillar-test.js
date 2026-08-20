'use strict';

// 30→5業種一本化（PR #486/#487）のA3: productVenturesを事業画面のUI上で
// 「5本目の柱」として位置づけ直す。
//
// productVentures（js/engine.jsのlaunchProduct()/g.productVentures）は既に
// 開発費・進捗・品質/ブランド成長・ユーザー数・評価額を持つ深い制度だが、
// 事業画面では「自社プロダクト・新規事業」という独立したセクション名のままで、
// ラーメン/コンビニ/ジム/不動産仲介という他4本柱（businessFullCard）との
// 統一感が無かった。オーナーの提案で業種名を「IT企業」とし、表示位置も
// 「運営中の事業」「未出店の業種」の直後（Phase 1A市場・採算セクションより前）
// へ移動して、4本柱に続く5本目として読めるようにする。
//
// データモデル・ロジックは無変更（見出しと表示位置のみ）。PRODUCT_BLUEPRINTS
// （SaaS/ゲーム/EC/AI/メディア）は既存のまま、新規business IDは追加しない。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

// 1. セクション見出しが「IT企業」になっている。
{
  assert.match(appSource, /function renderProductSection\(\)\{const g=engine\.g;return `<section><h2 class="section-title">IT企業<\/h2>/, 'renderProductSectionの見出しはIT企業');
  assert.doesNotMatch(appSource, /自社プロダクト・新規事業/, '旧見出しが残っていない');
}

// 2. 5本目の柱であることを説明する subtitle が付いている。
{
  const productIndex = appSource.indexOf("card('プロダクト開発',");
  const subtitleIndex = appSource.indexOf("{subtitle:'主力5事業の1つ。アプリ・ゲーム・EC・AI・メディアを自社プロダクトとして開発・運営します。'}");
  assert.ok(productIndex >= 0 && subtitleIndex >= 0, '前提: 両方が存在する');
  assert.ok(subtitleIndex > productIndex && subtitleIndex - productIndex < 500, 'プロダクト開発カードに5本目の柱であることを説明するsubtitleがある');
}

// 3. 表示位置: renderBusiness()の中で、renderProductSection()は
//    運営中/未出店セクションの直後、renderMarketInsightSection()より前に来る。
{
  const block = appSource.slice(appSource.indexOf('function renderBusiness()'), appSource.indexOf('function renderStoreEquipment'));
  const idleIndex = block.indexOf('${idle}');
  const productIndex = block.indexOf('${renderProductSection()}');
  const marketIndex = block.indexOf('${renderMarketInsightSection()}');
  const franchiseIndex = block.indexOf('${renderFranchiseSection()}');

  assert.ok(idleIndex >= 0 && productIndex >= 0 && marketIndex >= 0 && franchiseIndex >= 0, '前提: renderBusiness()が4つのセクションをすべて描画する');
  assert.ok(idleIndex < productIndex, 'IT企業（productVentures）は未出店の業種セクションの後に来る');
  assert.ok(productIndex < marketIndex, 'IT企業（productVentures）はPhase 1A市場・採算セクションより前に来る（4本柱の直後に並ぶ）');
  assert.ok(marketIndex < franchiseIndex, '市場・採算セクションはフランチャイズより前のまま（既存順序を維持）');
}

// 4. productVenturesのデータモデル・ロジック側は無変更であることの確認
//    （見出しと表示位置だけの変更であることの裏付け）。
{
  assert.match(appSource, /PRODUCT_BLUEPRINTS\.map\(p=>/, 'PRODUCT_BLUEPRINTSの一覧描画ロジックは無変更');
  assert.match(appSource, /g\.productVentures\.map\(p=>card\(p\.name,/, 'productVenturesカードの描画ロジックは無変更');
  assert.match(appSource, /btn\('開発開始','launch-product',/, '開発開始アクションの配線は無変更');
}

console.log('product ventures IT pillar tests passed');
