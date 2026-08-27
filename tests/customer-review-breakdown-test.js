'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 顧客レビュー内訳（Coffee Inc 2化 item 3）の静的検証。
//
// market.js の storeOffer() は、価格・品質(quality)・サービス(serviceQuality)・
// 利便性(convenience)・総合満足度(customerSatisfaction) をすでに毎週算出しており、
// これらは店舗の売上(repeatRate/satisfaction経由)に直接使われている。ところが
// これまでUIのどこにも「なぜこの店の評判が良い/悪いのか」を一目で示すレビュー
// 内訳が無かった（js/app.jsのrenderMarketInsightSection()内で店舗ごとのKPIは
// 表示していたが、満足度の構成要素は表示していなかった）。
//
// この機能は新しい満足度モデルを発明せず、既に計算済みの数値を並べて見せる
// だけの純粋なUI追加である（js/engine.js・js/market.jsは変更していない）。
// Playwrightでの実機確認（テスト対象外・スクラッチのみ）では、
// レビュー内訳に表示される数値が store.marketResult の各フィールドと
// 完全に一致することを確認済み。ここではソースレベルで、新しいUI関数が
// market.js の既存フィールドをそのまま参照していること・呼び出し配線が
// 生きていることを検証する。

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const marketSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'market.js'), 'utf8');

// 1. UI関数が定義され、既存のマーケット結果フィールドをそのまま参照していること
// （新しい計算式を発明していないことの担保）。
{
  const fnMatch = app.match(/function renderCustomerReviewBreakdown\(r\)\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'renderCustomerReviewBreakdown() が app.js に定義されていること');
  const body = fnMatch[0];
  for (const field of ['r.customerSatisfaction', 'r.price', 'r.quality', 'r.serviceQuality', 'r.convenience']) {
    assert.ok(body.includes(field), `renderCustomerReviewBreakdown() は ${field} をそのまま参照すること（新しい満足度式を作らない）`);
  }
  // 新しい満足度の合成計算（quality/serviceQualityなどを重み付けして再計算する式）を
  // 持ち込んでいないことの簡易チェック。既存の重み付け合成はmarket.js側だけに存在する。
  assert.doesNotMatch(body, /quality\s*\*\s*\.?\d/, 'サービス・品質を独自の係数で再合成していないこと（market.jsの計算を再利用するだけ）');
}

// 2. renderMarketInsightSection() から実際に呼ばれていること（配線されていること）。
{
  assert.match(app, /<h4>顧客レビュー内訳<\/h4>\$\{renderCustomerReviewBreakdown\(r\)\}/, 'renderCustomerReviewBreakdown(r) がrenderMarketInsightSection()内で呼ばれること');
}

// 3. 表示している5項目のラベルが存在すること。
{
  for (const label of ['顧客レビュー内訳', '総合満足度', '商品', 'サービス', '利便性']) {
    assert.ok(app.includes(label), `「${label}」というラベルが app.js に存在すること`);
  }
}

// 4. データ源であるmarket.jsのstoreOffer()が、参照している5フィールドを
// 依然として算出していること（将来market.js側のフィールド名が変わった場合に
// このUIが静かに空欄化することを防ぐ）。
{
  for (const field of ['customerSatisfaction', 'quality', 'serviceQuality', 'convenience']) {
    assert.ok(marketSrc.includes(field), `market.js は ${field} を算出し続けていること`);
  }
}

// 5. 価格の注記（価格競争力）は既存のformatMarketReasonValue()を再利用しており、
// 独自の価格ラベリングロジックを増やしていないこと。
{
  assert.match(app, /priceReason\s*=\s*\(r\.reasons\|\|\[\]\)\.find\(x=>x\.label==='価格競争力'\)/, '価格の注記は既存のreasons配列（価格競争力）から取得すること');
  assert.match(app, /formatMarketReasonValue\(priceReason\)/, '価格の注記表示は既存のformatMarketReasonValue()を再利用すること');
}

console.log('customer review breakdown tests passed');
