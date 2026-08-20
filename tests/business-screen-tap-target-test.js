'use strict';

// 外部監査P2③（iPhone実プレイ監査引き継ぎ資料 §7③「44px tap target」）。
//
// iPhone実測で以下がiOS推奨最小タップ高さ44pxを満たしていなかった:
//   出店ボタン: 約44×34px（.btn.small基準の34px）
//   事業画面の button-grid（品質投資/広告/効率化/DX/価格変更/設備強化）: 約34px
//   一部主要CTA（.btn.small を付けない通常ボタン）: 約42px
//
// 修正方針: .btn.small は他に131箇所（本PRの対象外画面を多数含む）で使われており、
// 一律に44pxへ引き上げると未監査の画面まで広く見た目が変わるリスクがある。
// そのため既存の "iPhone WebKit minimum tap targets" パターン（M&A/PMI/week-controls/
// store-concept向けの [data-action="..."] 個別上書き）を踏襲し、実測で指摘された
// data-action だけを44pxへ上書きする。一方でベースの.btn（42px、small無しの主要CTA全般）は
// 全画面共通の土台であり、42→44pxの2px増は既存レイアウトを壊すリスクが小さいため、
// ここだけは共通クラスを直接引き上げる。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./harness');

const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');

function ruleBody(selectorRegex, label) {
  const m = css.match(selectorRegex);
  assert.ok(m, `${label}: セレクタが見つからない`);
  return m;
}

// 1. ベースの.btn（smallを付けない主要CTA全般）が44px以上になっている。
{
  const m = ruleBody(/\.btn\{[^}]*\}/, 'base .btn rule');
  assert.match(m[0], /min-height:44px/, 'base .btn の min-height は44pxである');
  assert.doesNotMatch(m[0], /min-height:42px/, 'base .btn は42pxのまま残っていない');
}

// 2. .btn.small 自体は34pxのまま（一律引き上げしていないことの固定）。
{
  const m = ruleBody(/\.btn\.small\{[^}]*\}/, '.btn.small rule');
  assert.match(m[0], /min-height:34px/, '.btn.small は34pxのまま（未監査画面への影響を避けるため一律変更しない）');
}

// 3. 実測で指摘された4つのdata-actionだけが44pxへ個別に上書きされている。
{
  const targeted = ['open-store', 'business-invest', 'business-price', 'upgrade-store-equipment'];
  const block = css.match(/\/\*\s*iPhone WebKit minimum tap targets for store founding and business operations CTAs\s*\*\/\s*([\s\S]*?\{min-height:44px\})/);
  assert.ok(block, '対象data-action向けの上書きブロックが見つからない');
  for (const action of targeted) {
    assert.match(block[1], new RegExp(`\\.btn\\[data-action="${action}"\\]`), `${action}: 44pxへの上書きセレクタが存在する`);
  }
  assert.match(block[1], /min-height:44px/, '上書きブロックの値は44pxである');
}

// 4. 上書きブロックは.btn.smallの定義より後ろに置かれている（CSSのソース順が同じ詳細度の
//    セレクタでは後勝ちになるため、順序が逆だと上書きが効かなくなる）。
{
  const smallIndex = css.indexOf('.btn.small{min-height:34px');
  const overrideIndex = css.indexOf('.btn[data-action="open-store"]');
  assert.ok(smallIndex >= 0 && overrideIndex >= 0, '前提: 両方のルールが存在する');
  assert.ok(overrideIndex > smallIndex, '上書きブロックは.btn.smallの定義より後ろにあり、カスケードで確実に勝つ');
}

// 5. 上書き対象の4つのdata-actionは、実際にapp.js側で.small系のkindと共に使われている
//    （CSS側の上書きが実在するボタンに対して意味を持つことの確認。死んだセレクタの防止）。
{
  assert.match(app, /btn\('出店','open-store',\{kind:'primary small'/, '出店ボタンはprimary small（34px相当）のまま');
  assert.match(app, /btn\('品質投資','business-invest',\{kind:'small'/, '品質投資ボタンはsmall（34px相当）のまま');
  assert.match(app, /btn\('広告','business-invest',\{kind:'small'/, '広告ボタンはsmall（34px相当）のまま');
  assert.match(app, /btn\('効率化','business-invest',\{kind:'small'/, '効率化ボタンはsmall（34px相当）のまま');
  assert.match(app, /btn\('DX','business-invest',\{kind:'small'/, 'DXボタンはsmall（34px相当）のまま');
  assert.match(app, /btn\('価格変更','business-price',\{kind:'ghost small'/, '価格変更ボタンはghost small（34px相当）のまま');
  assert.match(app, /btn\(`設備強化 \$\{compactYen\(plan\.cost\)\}`,'upgrade-store-equipment',\{kind:'secondary small'/, '設備強化ボタンはsecondary small（34px相当）のまま');
}

// 6. css-extraction-test.js が要求するバイト完全一致の対象であるbaseline fixtureも
//    同じ内容に更新されていることを確認する（更新漏れの防止）。
{
  const baseline = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'extracted-css-baseline.css'), 'utf8').replace(/\r\n?/g, '\n').trim();
  const current = css.replace(/\r\n?/g, '\n').trim();
  assert.equal(baseline, current, 'tests/fixtures/extracted-css-baseline.css がcss/app.cssと一致していない');
}

console.log('business screen tap target tests passed');
