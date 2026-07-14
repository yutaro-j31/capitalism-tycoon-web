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
