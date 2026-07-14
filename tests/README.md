# Baseline tests

Node.js標準機能のみで、`index.html` のゲームコードを変更せずに検査します。

## Commands

- `npm test`: 全テスト
- `npm run test:syntax`: `<script>` とイベントハンドラー属性の構文検査
- `npm run test:static`: HTML静的検査、およびリポジトリ内テキストファイルの不可視文字/制御文字検査
- `npm run test:save`: 必須シンボル、新規状態、保存往復、旧セーブfixture検査
- `npm run test:week`: 通常資金の52週基礎テストとsave/emit診断
- `npm run test:long`: 520週の安定性テスト

`test:long` は開始時に会社/個人現金へ各10億円を一度だけ追加します。これはバランス検証ではなく、長期実行時の未処理例外や非有限数値を探すための安定性検査です。

## Save migration tests

- `npm run test:migration`: `tests/save-migration-test.js` を実行し、未バージョン旧セーブ、部分的な配列要素、壊れた型、未来バージョン、冪等性、非破壊性、保存往復を検査します。
- `npm test` は `test:migration` も含みます。
- 追加fixtureは `tests/fixtures/legacy-unversioned-minimal.json`, `legacy-partial-entities.json`, `legacy-corrupted-types.json`, `future-version-save.json`, `current-version-save.json` です。

## Save/load integration tests

- `npm run test:load`: `tests/save-load-integration-test.js` を実行し、実際の `TycoonEngine.load()`, `save()`, `loadSlot()`, `importSave()` と `localStorage` 書き込み履歴を検査します。
- `npm test` は `test:load` も含みます。

## CSS extraction test

- `npm run test:css`: `tests/css-extraction-test.js` verifies the Phase 0 stylesheet split.
- The test confirms that `index.html` references `./css/app.css`, the referenced file exists and is non-empty, the path is relative for GitHub Pages project-site deployment, no large static `<style>` block remains in `index.html`, CSS braces are balanced, `@media`/`@supports`/`@keyframes` blocks are not obviously broken, line endings are LF without UTF-8 BOM, unexpected bidirectional controls are absent, local `url(...)` assets exist, and no CDN reference is introduced by the CSS file.
- CSS identity is checked by comparing `css/app.css` against `tests/fixtures/extracted-css-baseline.css`, which was captured from the original `index.html` `<style>` block during extraction. The comparison normalizes CRLF/CR to LF and trims only outer whitespace, so selector changes, declaration value changes, rule deletions, media query changes, keyframe changes, and rule reordering fail the test.
- `npm test` includes `test:css` through `tests/run-all.js`.

## JavaScript extraction test

- `npm run test:javascript`: verifies the Phase 0 JavaScript files referenced by `index.html`.
- The test resolves script `src` values from `index.html` in document order and executes the same production file paths that GitHub Pages loads.
- The test confirms `index.html` references `./js/runtime.js`, `./js/data.js`, `./js/engine.js`, `./js/expansion.js`, `./js/completion.js`, `./js/parity.js`, and `./js/app.js`; each referenced file exists and is non-empty; paths are relative; scripts remain classic without `type="module"`, `defer`, or `async`; no large executable inline script remains; no new external CDN script is introduced; and relevant files are UTF-8 without BOM using LF line endings.
- `npm test` includes `test:javascript` through `tests/run-all.js`.

## JavaScript module split test

- `npm run test:modules`: verifies the Phase 0 internal IIFE module split.
- The test reads `index.html` script tags in document order, requires `runtime.js` first and `app.js` last, confirms all referenced files exist and are non-empty, checks LF/no-BOM/no bidi controls, verifies required module exports, confirms the internal registry is non-enumerable, checks duplicate module registration errors, and ensures `TycoonEngine.load()` plus initial `render()` execute once in the instrumented harness.
- `npm test` includes `test:modules` through `tests/run-all.js`.

- `npm run test:stock`: 株価履歴、株式チャートUI、v3マイグレーション、固定シード基本回帰を検証します。

## Phase 1A market tests
- `npm run test:market`: market engine and integration checks.
- `npm run test:market-migration`: saveVersion 4 migration checks.
- `npm run test:market-ui`: static UI/CSS/load-order checks.
