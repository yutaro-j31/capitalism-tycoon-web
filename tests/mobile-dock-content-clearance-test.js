'use strict';
// QA監査(docs/QA_AUDIT_2026-08-25.md U1)の修正確認。修正前は@media(max-width:820px)で
// .d-bottom-dock(bottom:76px, height:48px)が.d-ui-active .screen(padding-bottom:76px)の
// 予約領域より48px高い位置まで浮いており、ページ末尾のコンテンツがドックの下に
// 恒久的に隠れて到達できなくなっていた(iphone-browser-mode変形でも同型のズレがあった)。
// 数値だけでなく実描画でも375x667/iPhone横のPlaywright再現で確認済み。
// ここではCSSの数値関係を静的に検証し、将来どちらかの値だけが変更されて
// 再び余白不足へ戻る回帰を防ぐ。
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('css/d-ui-mobile-company.css', 'utf8');

function px(pattern, label) {
  const m = css.match(pattern);
  assert.ok(m, `missing CSS declaration: ${label}`);
  return Number(m[1]);
}

// Default @media(max-width:820px) block: dock floats at bottom:76px with height:48px,
// so content must reserve at least 76+48=124px, or the last rows stay hidden under it.
{
  const dockBottom = px(/\.d-bottom-dock\{bottom:calc\((\d+)px \+ env\(safe-area-inset-bottom,0px\)\)!important\}/, '.d-bottom-dock bottom (default)');
  const dockHeight = px(/\.d-bottom-dock\{display:block!important;[^}]*?height:(\d+)px!important/, '.d-bottom-dock height (collapsed circle)');
  const screenPad = px(/\.d-ui-active \.screen\{padding-bottom:calc\((\d+)px \+ env\(safe-area-inset-bottom,0px\)\)!important\}/, '.d-ui-active .screen padding-bottom (default)');
  assert.ok(screenPad >= dockBottom + dockHeight, `screen padding-bottom (${screenPad}px) must clear the dock's top edge (bottom:${dockBottom}px + height:${dockHeight}px = ${dockBottom + dockHeight}px)`);
}

// iphone-browser-mode variant: same relationship, different constants.
{
  const dockBottom = px(/\.iphone-browser-mode \.d-bottom-dock\{bottom:calc\((\d+)px \+ env\(safe-area-inset-bottom,0px\)\)!important\}/, '.iphone-browser-mode .d-bottom-dock bottom');
  const dockHeight = px(/\.d-bottom-dock\{display:block!important;[^}]*?height:(\d+)px!important/, '.d-bottom-dock height (collapsed circle)');
  const screenPad = px(/body\.iphone-browser-mode\.d-ui-active \.screen\{padding-bottom:calc\((\d+)px \+ env\(safe-area-inset-bottom,0px\)\)!important\}/, 'iphone-browser-mode .screen padding-bottom');
  assert.ok(screenPad >= dockBottom + dockHeight, `iphone-browser-mode screen padding-bottom (${screenPad}px) must clear the dock's top edge (bottom:${dockBottom}px + height:${dockHeight}px = ${dockBottom + dockHeight}px)`);
}

console.log('mobile dock content clearance tests passed');
