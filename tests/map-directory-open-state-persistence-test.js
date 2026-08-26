'use strict';
// QA監査(docs/QA_AUDIT_2026-08-25.md U3)の修正確認。
//
// app.js の render() は #screen の innerHTML を毎回まるごと置き換えるため
// (state更新のたびに呼ばれる、例: マップ画面内の都道府県select変更)、
// js/d-ui-shell.js の renderMapWorkspace() が作る
// <details class="d-map-directory">（テナント・不動産・オフィス一覧）は
// 呼び出しのたびにDOMごと作り直される。以前はdetails生成時に
// `directory.open=globalThis.innerWidth<960` を都度計算していたため、
// ユーザーが手動で開いても次の再描画で閉じた状態に戻っていた
// (デスクトップ幅では既定で閉じているため、開いてすぐ閉じるように見える)。
// Playwright(Chromium, 1280x900)で実プレイ再現し、
// 手動で開く→ open=true、都道府県select変更(→render()を誘発)→ open=false
// (修正前)/true(修正後) を確認済み。
//
// 修正: 開閉状態をモジュールスコープの変数(mapDirectoryOpen)に保持し、
// details再生成時にその値を読み、toggleイベントで書き戻すことで
// #screen再描画をまたいで開閉状態を維持する。
//
// tests/harness.js の擬似DOMは querySelector が常にnullを返すなど
// 簡易実装のため、実際のDOM永続化挙動はPlaywrightでの実プレイでのみ
// 検証可能（上記で実施済み）。ここではソースコード上に修正パターンが
// 維持されていることを固定し、将来のリファクタで再びこのバグへ戻る
// ことを防ぐ。
const assert = require('node:assert/strict');
const fs = require('node:fs');

const src = fs.readFileSync('js/d-ui-shell.js', 'utf8');

assert.match(src, /let mapDirectoryOpen\s*=\s*null;/, 'a module-level variable must persist the accordion open state across #screen rebuilds');
assert.match(src, /directory\.open\s*=\s*mapDirectoryOpen===null\s*\?\s*globalThis\.innerWidth<960\s*:\s*mapDirectoryOpen/, 'the details element must be (re)created using the persisted open state, not just the viewport-width default');
assert.match(src, /directory\.addEventListener\('toggle',\s*\(\)\s*=>\s*\{\s*mapDirectoryOpen\s*=\s*directory\.open;\s*\}\)/, 'the details element must write user toggles back into the persisted variable');

console.log('map directory open-state persistence tests passed');
