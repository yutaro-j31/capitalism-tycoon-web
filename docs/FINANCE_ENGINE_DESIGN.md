# Phase 1B 財務エンジン設計

`js/finance.js` は classic script として内部レジストリ `__capitalismTycoonModules.finance` に登録される。ES modules、import/export、外部ライブラリは使わない。

採用方式は会計イベント方式である。各イベントは `id`, `week`, `fiscalYear`, `fiscalQuarter`, `category`, `amount`, `cashEffect`, `profitEffect`, `assetEffect`, `liabilityEffect`, `equityEffect`, `businessID`, `storeID`, `sourceType`, `sourceID`, `description` を持つ。

財務表示は `app.js`、会計計算は `finance.js`、既存現金移動は `engine.js` に残す。財務諸表生成は会社現金を増減させない。

saveVersion 5では `finance.transactions`, `finance.fixedAssets`, `finance.loans`, `finance.balances`, `finance.lastStatements`, `finance.lastValidation` を保存する。
