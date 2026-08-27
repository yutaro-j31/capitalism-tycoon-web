'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 店舗比較テーブル（Coffee Inc 2化ロードマップ item 2）の静的検証。
//
// businessFullCard()は業種合計の週次利益しか見せておらず、同一業種で複数店舗を
// 持つプレイヤーには「どの店舗が稼いでいて、どの店舗が苦戦しているか」を店舗単位で
// 比較する手段が無かった（renderMarketInsightSection()も店舗ごとの個別カードを
// 並べるだけで、横並び比較のテーブルは存在しなかった）。
//
// 新しい経営指標は発明せず、全業種の店舗が既に持つ store.lastSales / store.lastProfit
// と、詳細な市場シミュレーション対象（現状ramenのみ、market.isTargetBusinessID）の
// 店舗が持つ store.marketResult.customerSatisfaction / marketShare をそのまま
// 並べるだけの純粋な読み取り専用テーブルである（js/engine.js・js/market.jsは
// 変更していない）。Playwrightでの実機確認（テスト対象外・スクラッチのみ）で、
// 複数店舗を開店すると週次利益の降順でソートされたテーブルが表示され、赤字店舗が
// 既存の.downクラスで着色されること、対象業種では満足度・市場シェア列が追加され
// 未計算時は—にフォールバックすること、1店舗以下では表示されないことを確認済み。
// ここではソースレベルで、新しいUI関数が既存フィールドをそのまま参照していること・
// 呼び出し配線が生きていることを検証する。

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const marketSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'market.js'), 'utf8');
const dUIShellSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'd-ui-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');

function extractFunction(source, signaturePattern) {
  const match = source.match(signaturePattern);
  assert.ok(match, `関数定義が見つかること: ${signaturePattern}`);
  return match[0];
}

// 1. renderStoreComparisonTable() が定義され、既存のstoreフィールドをそのまま
// 参照していること（新しい経営指標を作らないことの担保）。
const tableFn = extractFunction(app, /function renderStoreComparisonTable\([^)]*\)\{[\s\S]*?\n\}/);
{
  for (const field of ['s.lastSales', 's.lastProfit', 's.marketResult?.customerSatisfaction', 's.marketResult?.marketShare']) {
    assert.ok(tableFn.includes(field), `renderStoreComparisonTable() は ${field} をそのまま参照すること`);
  }
  // 満足度・市場シェアを独自の重み付けで再合成していないこと（market.jsの値をそのまま使うだけ）。
  assert.doesNotMatch(tableFn, /customerSatisfaction\s*[*+]/, '満足度を独自の式で再計算していないこと');
}

// 2. 店舗数が2未満なら何も表示しないこと（1店舗の比較には意味が無い）。
{
  assert.match(tableFn, /stores\.length\s*<\s*2\s*\)\s*return\s*''/, '店舗数が2未満なら空文字列を返すこと');
}

// 3. businessFullCard() から実際に呼ばれ、カード本文に挿入されていること（配線の担保）。
{
  assert.match(app, /const comparison=renderStoreComparisonTable\(ss,g\)/, 'businessFullCard() 内でrenderStoreComparisonTable(ss,g) が呼ばれること');
  assert.match(app, /\$\{comparison\}<div class="button-grid">/, 'カード本文の投資ボタン群の直前にcomparisonが挿入されること');
}

// 4. 対象業種（market.isTargetBusinessID、既存の判定式）でのみ満足度・市場シェア列を
// 追加すること。非対象業種はmarketResultを持たないため、無条件参照だと壊れる。
{
  assert.match(tableFn, /marketModule\.isTargetBusinessID\(stores\[0\]\.businessID\)/, '対象業種判定にmarketModule.isTargetBusinessID()を使うこと（新しい判定式を作らない）');
  assert.match(tableFn, /Number\.isFinite\(r\.satisfaction\)\?r\.satisfaction\.toFixed\(1\):'—'/, '満足度が未計算(preparing中など)の店舗は—にフォールバックすること');
  assert.match(tableFn, /Number\.isFinite\(r\.share\)\?pct\(r\.share\):'—'/, '市場シェアが未計算の店舗は—にフォールバックすること');
}

// 5. 週次利益の降順でソートしていること（勝ち組・負け組が一目でわかる並び順）。
{
  assert.match(tableFn, /\.sort\(\(a,b\)=>b\.profit-a\.profit\)/, '週次利益の降順でソートすること');
}

// 6. 赤字店舗は既存の.down/.upクラスで着色していること（renderReport()の週次履歴等と
// 同じ配色規約を再利用し、新しい色分けを増やしていない）。
{
  assert.match(tableFn, /class="\$\{r\.profit>=0\?'up':'down'\}"/, '週次利益セルは既存の up/down クラスで着色すること');
  assert.ok(css.includes('.up{') && css.includes('.down{'), '前提: up/downクラスはcss/app.cssに既存であること');
}

// 7. 状態ラベルは js/d-ui-shell.js の storeStatusLabel() と同じ表記
// （開業準備中・あと{n}週 / 営業中 / 閉店）を使うこと。表記が食い違うと、
// マップ画面と店舗比較テーブルで同じstore.statusに対して違う言葉が出る。
{
  assert.ok(dUIShellSrc.includes('開業準備中・あと'), '前提: d-ui-shell.jsの状態表記が変わっていないこと');
  const statusFn = extractFunction(app, /function storeComparisonStatusLabel\([^)]*\)\{[\s\S]*?\n\}/);
  assert.ok(statusFn.includes('開業準備中・あと'), '店舗比較テーブルもd-ui-shell.jsと同じ「開業準備中・あと」という表記を使うこと');
  assert.match(statusFn, /return\s*'閉店'/, '閉店の表記が存在すること');
  assert.match(statusFn, /return\s*'営業中'/, '営業中の表記が存在すること');
}

// 8. データ源であるmarket.jsが、参照しているフィールドを依然として算出し続けていること
// （将来market.js側のフィールド名が変わった場合にこのUIが静かに空欄化することを防ぐ）。
{
  for (const field of ['customerSatisfaction', 'marketShare']) {
    assert.ok(marketSrc.includes(field), `market.js は ${field} を算出し続けていること`);
  }
}

// 9. UIから到達できること。テーブル本体は既存のクラス（learning-card/market-scroll）だけで
// 組んでおり、CSS追加が不要であること（バイト一致要件のcss/app.cssを変更しない）。
{
  for (const className of tableFn.match(/class="([a-z- ]+)"/g) || []) {
    for (const name of className.replace(/class="|"/g, '').split(/\s+/).filter(Boolean)) {
      assert.ok(css.includes(`.${name}`), `renderStoreComparisonTable()が使う .${name} はcss/app.cssに既存であること`);
    }
  }
  assert.match(tableFn, /data-store-comparison/, 'テスト・将来のUI拡張から特定できるdata-store-comparison属性を持つこと（新規CSSクラスは追加しない）');
}

console.log('store comparison table tests passed');
