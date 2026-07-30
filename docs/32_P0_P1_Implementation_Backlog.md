# P0 / P1 実装バックログ

## 1. 目的

本章は、`31_Spec_Consistency_and_Code_Gap_Audit.md`で確認した重大ギャップを、独立してレビュー・検証可能なPR単位へ分割する。

優先順位は、次の順で決定する。

1. セーブ互換性を壊す危険
2. 決定論を壊す危険
3. 会計整合性を壊す危険
4. iPhoneでプレイ不能になる危険
5. 開発速度と回帰検出力

## 2. 実装原則

- 1 PR 1責務を基本とする
- 既存セーブを読み込めない変更は禁止する
- P0では見た目の全面刷新を行わない
- 先に観測・テストを追加し、その後に内部実装を置換する
- 大規模一括リファクタリングを避け、互換レイヤーを使って段階移行する
- すべてのPRで対象docsと変更履歴を更新する

## 3. 推奨マイルストーン

### M1 決定論・セーブ基盤の固定

対象:

- P0-01 乱数監査と静的禁止
- P0-02 管理乱数サービス導入
- P0-03 安定ID採番
- P0-04 saveVersion正本統合

完了条件:

- 同一seedで520週の主要state hashが一致
- 保存・再読込を挟んでも結果が一致
- v8、v9の既存fixtureを読込可能
- 既存テストがすべて成功

### M2 実ブラウザ品質ゲート

対象:

- P0-05 Playwright基盤
- P0-06 iPhone WebKit smoke
- P0-07 保存・再読込E2E
- P0-08 長期自動プレイのブラウザ接続

完了条件:

- PR CIで短時間smokeが成功
- nightlyで複数戦略が実行可能
- console error、page error、主要導線停止を検出可能

### M3 スキーマ・起動構造・運用基盤

対象:

- P1-01 JSON Schema
- P1-02 script manifestと依存検査
- P1-03 inline bridge分離
- P1-04 構造化ログ
- P1-05 リリースゲート対応表

完了条件:

- セーブが機械検証できる
- script順序事故をCIで検出できる
- 障害レポートに相関IDと主要state情報が残る
- リリースコマンドと仕様上のゲートが1対1で追跡できる

## 4. P0バックログ

## P0-01 乱数直接使用の棚卸しとCIガード

目的:

管理乱数導入前に、直接乱数使用箇所を完全に可視化する。

作業:

- `js/`、`tests/`、`scripts/`の`Math.random`、`Date.now`依存IDを検索
- 用途を「ゲーム結果」「表示のみ」「テスト補助」に分類
- 許可リストを作成
- ゲーム結果へ影響する直接使用をCIで失敗させる静的試験を追加

受入条件:

- 検出結果が機械可読レポートになる
- 新規の無許可`Math.random`追加でCIが失敗する
- 既存箇所にIssueまたは移行タスクIDが付く

依存: なし

推奨PR名:

`test: audit unmanaged randomness`

## P0-02 RandomServiceとseed状態の導入

目的:

ゲーム結果へ影響する乱数を単一サービスへ統合する。

最低API:

- `nextFloat()`
- `nextInt(min, max)`
- `pick(array)`
- `shuffle(array)`
- `fork(scopeID)`または同等のサブストリーム
- `snapshot()`
- `restore(snapshot)`

state項目:

- `rng.algorithm`
- `rng.seed`
- `rng.state`
- `rng.drawCount`

作業:

- 初期stateへrng情報を追加
- 旧セーブには決定的な既定seedを付与
- `engine.js`の`rand`、`pick`をサービス経由へ変更
- 役員生成、イベント、競合、物件変動などを段階移行

受入条件:

- 同一seed・同一入力でstate hash一致
- セーブ・ロード後も乱数列が継続
- 旧セーブ読込成功
- seed違いで適切に結果が分散

依存: P0-01

推奨PR名:

`feat: introduce deterministic random service`

## P0-03 安定ID・連番採番基盤

目的:

ランタイムUUIDと時刻依存IDを、セーブ互換性のある安定採番へ移行する。

ID分類:

- マスター由来: 固定ID
- プレイ中生成: 種類別連番
- 取引: operation ID + sequence
- 表示・DOM一時ID: セーブ対象外

state項目例:

- `sequences.store`
- `sequences.employee`
- `sequences.competitorPresence`
- `sequences.transaction`
- `sequences.event`

移行方針:

- 既存`id`は即削除しない
- `stableID`または新IDを追加し参照を段階置換
- 旧IDから新IDへの移行表をmigration内で生成
- 同じマスターデータから毎回同じIDを生成

受入条件:

- 新規ゲーム2件が同一seedで同じID集合を持つ
- 既存v9セーブが参照切れなく読める
- 重複IDが0件
- 孤立参照が0件

依存: P0-02

推奨PR名:

`refactor: add stable entity id allocation`

## P0-04 saveVersionとmigration registryの統合

目的:

v8基底実装とv9ラッパーへ分散したバージョン管理を単一正本へ移す。

推奨構成:

- `js/save-version.js`
- `js/migrations/index.js`
- `js/migrations/v8-to-v9.js`
- 将来の`v9-to-v10.js`

作業:

- `CURRENT_SAVE_VERSION = 9`を単一定義
- migrationを昇順registryへ登録
- 欠番、重複、逆順を起動時に拒否
- `createInitialState`が直接現行版を返す
- `TycoonEngine`の多重ラップを縮小

受入条件:

- v0相当、v8、v9 fixtureが現行版へ移行
- 将来版は明確なエラーで拒否
- `SAVE_KEY`は変更されない
- saveVersion定数が複数箇所に存在しない

依存: P0-02と並行可能。ただしマージ順を調整する

推奨PR名:

`refactor: centralize save version and migrations`

## P0-05 Playwright基盤導入

目的:

実ブラウザ上の起動、操作、保存、エラーをCIで検出する。

作業:

- Playwright依存追加
- ローカル静的サーバー起動設定
- ChromiumとWebKit設定
- iPhone相当device profile追加
- trace、screenshot、console logを失敗時artifact化

最初のテスト:

1. 初期画面表示
2. 新規創業
3. 最初の店舗画面へ到達
4. 週送り
5. 手動保存
6. リロード後の継続

受入条件:

- `npm run test:e2e`で実行可能
- CI上でWebKitテスト成功
- page errorと未許可console errorで失敗
- 失敗artifactが取得可能

依存: なし

推奨PR名:

`test: add Playwright browser smoke suite`

## P0-06 iPhone主要導線E2E

対象導線:

- 創業フォーム
- 店舗選択・出店
- 商品・価格変更
- 週送り
- 財務確認
- 保存・読込
- モーダル開閉
- 下部ナビゲーション
- 倒産または危機画面からの再建操作

受入条件:

- 横スクロール事故なし
- 主要ボタンがviewport外へ固定されない
- タップ不能要素なし
- モーダルを閉じられる
- セーフエリアを侵害しない

依存: P0-05

推奨PR名:

`test: cover iPhone critical gameplay flows`

## P0-07 決定論ブラウザ回帰

目的:

Node試験だけでなく、実アプリロード経路でも同一結果を確認する。

作業:

- テスト専用seed注入方法
- 操作シナリオJSON
- 指定週時点のstate digest取得API
- 同一シナリオ2回のdigest比較

受入条件:

- 52週シナリオがWebKitで一致
- 保存・リロードを挟むシナリオも一致
- 不一致時に最初の差分pathを出力

依存: P0-02、P0-05

推奨PR名:

`test: add deterministic browser replay`

## P0-08 リリースゲートへのE2E統合

作業:

- PR必須: 短時間WebKit smoke
- mainマージ後: Chromium + WebKit主要導線
- nightly: 複数seed・複数戦略長期試験
- release: 保存migration fixture + E2E +会計不変条件

受入条件:

- `test:release`から必須E2Eが追跡可能
- nightly失敗時にseed、週、戦略、save artifactが残る
- flaky retryで不具合を隠さない

依存: P0-05〜P0-07

推奨PR名:

`ci: integrate browser gates into release validation`

## 5. P1バックログ

## P1-01 v9 JSON Schema追加

成果物:

- `schemas/save-v9.schema.json`
- schema検証テスト
- fixture群

段階:

1. ルートと重要不変項目
2. finance、stores、workforce、competitors
3. M&A、危機対応、履歴

受入条件:

- 正常fixtureが通る
- 非有限数、型不正、必須ID欠落を拒否
- migration後stateがschema適合

## P1-02 script manifestと依存順検査

成果物:

- script一覧の単一manifest
- 必須先行モジュール定義
- 重複登録・欠落・順序違反テスト

受入条件:

- `index.html`とmanifestの不一致でCI失敗
- 起動依存が文書化される
- inline script追加をレビューで検知できる

## P1-03 inline bridgeの名前付きモジュール化

対象優先順:

1. save recovery bridge
2. setup recovery
3. navigation proxy
4. subsidiary IPO loader
5. game-over settings bridge

受入条件:

- `index.html`のinline実行コードを縮小
- 各bridgeに単体または静的試験
- 起動順をmanifestで管理

## P1-04 構造化Logger

イベント例:

- `boot.started`
- `boot.failed`
- `save.load.started`
- `save.migration.failed`
- `week.advance.started`
- `week.advance.failed`
- `finance.invariant.failed`
- `e2e.checkpoint`

必須項目:

- timestamp
- eventName
- severity
- correlationID
- saveVersion
- week
- module
- sanitizedContext

受入条件:

- 個人情報やセーブ全文を自動送信しない
- ローカル診断JSONを出力できる
- 同一週送り処理を相関IDで追跡できる

## P1-05 リリースゲート・コマンド対応表

成果物:

- ゲートID
- 実行コマンド
- 実行頻度
- timeout
- artifact
- failure owner

例:

- RG-01 syntax/static
- RG-02 save/migration
- RG-03 accounting invariants
- RG-04 deterministic long run
- RG-05 WebKit iPhone smoke
- RG-06 strategy balance
- RG-07 security/schema

受入条件:

- `test:release`の各段階がゲートIDを出力
- 失敗したゲートを一意に特定可能

## P1-06 会計現金変更の静的・動的網羅

目的:

会社現金、個人現金、負債を直接変更する経路を減らす。

作業:

- 直接代入・加減算の棚卸し
- 許可経路の明示
- finance event経由へ移行
- 操作前後の仕訳・残高ロールフォワード検査

受入条件:

- 未許可の直接現金変更でCI失敗
- 全取引にoperation IDまたはidempotency key
- 二重クリックで二重計上されない

## 6. PR実装順

推奨順:

1. P0-01 乱数監査
2. P0-05 Playwright基盤
3. P0-02 RandomService
4. P0-04 saveVersion統合
5. P0-03 stable ID
6. P0-06 iPhone主要導線
7. P0-07 決定論ブラウザ回帰
8. P0-08 リリース統合
9. P1-01 JSON Schema
10. P1-02 script manifest
11. P1-03 inline bridge分離
12. P1-04 Logger
13. P1-05 release gate対応表
14. P1-06 会計変更網羅

Playwright基盤を早期に導入する理由は、内部基盤の変更で実画面を破壊した場合に即座に検出するためである。

## 7. 各PR共通チェックリスト

- [ ] 対象仕様書を参照した
- [ ] セーブ互換性への影響を記載した
- [ ] migration要否を判断した
- [ ] 決定論への影響を記載した
- [ ] 会計への影響を記載した
- [ ] 会社資産と個人資産を分離した
- [ ] iPhone操作を確認した
- [ ] 回帰試験を追加した
- [ ] docsと変更履歴を更新した
- [ ] rollback方法を記載した

## 8. マイルストーン完了後の次工程

P0/P1完了後は、以下へ進む。

1. 実績・殿堂・世代交代の長期シナリオ強化
2. アクセシビリティ自動検査
3. 低メモリ・復帰・オフライン耐性
4. script bundle分割と起動性能改善
5. ゲームバランスの継続的統計評価
6. リリース候補版の実機プレイ監査