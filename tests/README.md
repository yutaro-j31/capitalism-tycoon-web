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
