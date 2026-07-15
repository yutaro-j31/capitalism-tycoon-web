# Save Migration Guide

## 現在の saveVersion

現在の明示的セーブスキーマ版は `3`。保存キー `capitalism_tycoon_web_v1` は変更しない。

`saveVersion: 3` は、`saveVersion: 2` のエンティティ補完に加えて、株価履歴を `{ week, price }` 配列へ正規化するバージョンである。

## 未バージョンセーブの扱い

`saveVersion` が存在しない、`null`、`undefined`、空文字のセーブは `unversioned legacy` とみなし、次の順に処理する。

1. `migrateUnversionedToV1()`
2. `migrateV1ToV2()`
3. トップレベル `mergeDefaults()`
4. `deepNormalizeState()`
5. `validateMigratedState()`
6. `normalize()`

## 実行順

セーブ文字列の復元は次の順序を守る。

1. 保存文字列を取得
2. `JSON.parse`
3. ルート構造と `saveVersion` を確認
4. バージョンごとのマイグレーションを1段階ずつ実行
5. トップレベル初期値を補完
6. 配列要素内部を種類ごとに補完
7. `normalize()`
8. 整合性検証
9. 正常な場合のみゲーム状態として採用
10. 正常な場合のみ保存可能にする

## 新しいバージョンを追加する方法

1. `SAVE_VERSION` を1だけ増やす。
2. `migrateV2ToV3(state)` のような関数を追加する。
3. `migrateSave()` 内で既存の `if (version === n)` の後へ順番に追加する。
4. 途中バージョンを飛ばさない。
5. 冪等性を保つ。履歴追加、資金変更、乱数呼び出しを行わない。
6. `tests/fixtures/current-version-save.json` と専用テストを更新する。

## エンティティ別デフォルトの追加方法

配列要素へ新項目を追加する場合は、`entityDefaults(kind, entity, index, state)` と `ARRAY_ENTITY_KINDS` を更新する。

ルール:

- 既存の `0`, `false`, 空文字を未設定扱いしない。
- 既存ID、名称、数値、未知プロパティを保持する。
- 欠落項目だけ補完する。
- 配列順序を変えない。
- テストfixtureに欠落項目を持つ旧要素を追加する。

## 未来バージョンの扱い

`saveVersion > SAVE_VERSION` は失敗として扱う。勝手にダウングレードせず、元の保存文字列は上書きしない。

## 失敗時の動作

- 起動ロードに失敗した場合は `console.error` に具体的な理由を出し、新規ゲームへフォールバックする。
- スロットロードに失敗した場合は `false` を返し、現在状態と元スロットを保存し直さない。
- インポートに失敗した場合は例外を返し、既存のトースト表示経路で通知する。
- `migrateSave()` は入力オブジェクトを直接変更しない。

## テストfixtureの追加方法

`tests/fixtures/` に人工データのみを追加する。実在ユーザー情報を入れない。

推奨fixture:

- `legacy-unversioned-minimal.json`
- `legacy-partial-entities.json`
- `legacy-corrupted-types.json`
- `future-version-save.json`
- `current-version-save.json`

## 互換性を壊さないルール

- `SAVE_KEY` は変更しない。
- 旧セーブをリセットしない。
- マイグレーションでゲームバランス、価格、確率、週次順序、乱数呼び出し順を変えない。
- 不正データを黙って削除しない。
- 未知プロパティは可能な限り保持する。
- 補正不能な型不整合は明確なエラーとして扱う。

## ID欠落・重複IDの方針

- 配列要素の `id` が欠落、`null`、空文字の場合は、要素順に基づく決定的な `legacy-<kind>-<index>` 形式のIDを補完する。
- 既存の正常なIDは変更しない。
- `businessID`, `prefID`, `tenantID`, `productID` などの参照IDは、未知であっても勝手に別IDへ付け替えない。
- 同一配列内で同じ `id` が重複している場合、参照関係を安全に修復できないためマイグレーションエラーにする。
- 重複IDを単純な再生成や要素削除で隠さない。
- この方針は `legacy-missing-ids.json` と `legacy-duplicate-ids.json` の統合テストで検証する。

## v2 -> v3: stock price history

- `market[].priceHistory` の数値配列を `{ week, price }` に変換する。
- 履歴がない銘柄は `previous` が有効なら前週、現在 `price` を現在週として最小履歴を作る。
- 株価、保有株数、平均取得価格、銘柄ID、未知プロパティは変更しない。
- マイグレーションは入力をdeep cloneして処理し、未来バージョン拒否と破損セーブ上書き防止を維持する。


## v3 to v4
市場結果コンテナを追加する。既存株価履歴、保有株、平均取得価格、未知プロパティは維持し、capacity未設定を0にしない。

## v4 → v5

v4の会社現金、個人現金、借入、店舗ID、事業ID、市場結果、株価履歴を変更せず、`finance` 初期状態だけを決定論的に追加する。過去の架空取引は生成しない。

## v4建物付き不動産のv5初期化

v4セーブに会社所有土地、`buildingType`、正の `buildingCost` があり、まだfinance固定資産台帳が存在しない場合、v5初期化で `legacy-building-<propertyID>` を1件作成する。`propertyID` は対象不動産ID、`assetType` は `building`、取得原価と初期簿価は `buildingCost`、耐用週数は1040週、残存価額は20%とする。過去の架空償却履歴は作らず、再マイグレーションで同じ建物資産を重複作成しない。

## v5 to v6

v6 initializes Phase 1C supply containers and deterministic ramen-store starting inventory. Company cash, personal cash, store IDs, business IDs, market results, finance transactions, stock price, and stock price history are preserved. The migration is idempotent and rejects future versions through the existing version gate.

## v6 to v7 workforce migration
Existing departmentStaff is converted deterministically into workforceTeams, then departmentStaff becomes a compatibility mirror. Store base wage remains in business.wage. Cash, stock history, inventory, and finance ledgers are not changed by migration.
