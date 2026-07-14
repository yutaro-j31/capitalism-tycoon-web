# Phase 1B 財務エンジン設計

`js/finance.js` は classic script として内部レジストリ `__capitalismTycoonModules.finance` に登録される。ES modules、import/export、外部ライブラリは使わない。

採用方式は会計イベント方式である。各イベントは `id`, `week`, `fiscalYear`, `fiscalQuarter`, `category`, `amount`, `cashEffect`, `profitEffect`, `assetEffect`, `liabilityEffect`, `equityEffect`, `businessID`, `storeID`, `sourceType`, `sourceID`, `description` を持つ。

財務表示は `app.js`、会計計算は `finance.js`、既存現金移動は `engine.js` に残す。財務諸表生成は会社現金を増減させない。

saveVersion 5では `finance.transactions`, `finance.fixedAssets`, `finance.loans`, `finance.balances`, `finance.lastStatements`, `finance.lastValidation` を保存する。

## ロールフォワードと期間CF

純資産は `openingRetainedEarnings + 累積純利益 - 累積配当 + 過年度修正` で独立計算する。BS差額は純資産へ自動投入せず、`validate()` で失敗させる。期間CFは `weeklySnapshots` の `openingCash`, `endingCash`, `operatingCashFlow`, `investingCashFlow`, `financingCashFlow` を集計し、外部から任意の期首現金を渡さない。

## 重複排除

会計イベントは `transactionID`, `operationID`, `idempotencyKey` を分離する。週次自動取引は決定論的な `idempotencyKey` を持ち、ユーザー操作は操作ごとに一意の `operationID` を使う。
