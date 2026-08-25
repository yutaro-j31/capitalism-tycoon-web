'use strict';
// QA監査(docs/QA_AUDIT_2026-08-25.md U2)の修正確認。
//
// .d-topbar .brand は display:flex(css/d-ui-reference-fidelity.css)で、
// js/d-ui-shell.js:65 がレンダリングするマークアップは
// <div class="d-brand-crest">…</div><div><h1>…</h1><p>…</p></div> という構造。
// h1自体にはwhite-space:nowrap;overflow:hidden;text-overflow:ellipsisが
// 設定されていた(css/iphone-playtest-fixes.css、@media(max-width:820px))が、
// h1を包む無名divがflexアイテムとして扱われ、flexアイテムの既定値
// min-width:auto（コンテンツの内在的最小幅=省略前提のフルテキスト幅）
// のせいで実際には縮まず、ellipsisが効かないまま長いタイトルが
// 週送りコントロール(.week-controls: 日付ピル・速度ボタン・進めるボタン)の
// 上に視覚的に重なっていた(375px/390pxでPlaywright実プレイ再現済み)。
// 修正はそのdivにもmin-width:0を明示し、flexの縮小を許可すること。
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('css/iphone-playtest-fixes.css', 'utf8');
const mobileBlockMatch = css.match(/@media\(max-width:820px\)\{([\s\S]*?)\n\}/);
assert.ok(mobileBlockMatch, 'iphone-playtest-fixes.css must keep its @media(max-width:820px) block');
const mobileBlock = mobileBlockMatch[1];

assert.match(mobileBlock, /\.d-topbar \.brand>div\{min-width:0!important\}/, 'the h1/p wrapper div must get min-width:0 so it can shrink inside the flex .brand container, or the title overflows onto the week-controls again');
assert.match(mobileBlock, /\.d-topbar \.brand h1\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/, 'the title must still truncate with an ellipsis instead of wrapping or overflowing');
assert.match(mobileBlock, /\.d-topbar \.brand\{min-width:0!important\}/, 'the .brand flex item itself must also stay shrinkable');

console.log('topbar title / week-controls clearance tests passed');
