# Phase 1B 財務エンジン監査

## コード上の事実

- セーブキーは `SAVE_KEY = capitalism_tycoon_web_v1` のまま、実装前の現行版は `SAVE_VERSION = 4` だった。
- 会社現金は主に `js/engine.js` の `advanceWeek()`、`openStore()`、`closeStore()`、`investBusiness()`、本社・部門・CXO・銀行・株式・VC・M&A・海外・FC処理で増減していた。
- 週次処理の順序は、週加算、マクロ・市場・不動産・スタートアップ・競合・指示更新、商品・海外・子会社・FC・個人資産更新、店舗計算、収益費用集計、税金、会社現金反映、レポート保存だった。
- 店舗売上は `advanceWeek()` 内で `market.calculateMarkets()` の結果または旧式需要式から算出され、変動費、固定費、修繕費とともに `sales` / `expenses` へ集計されていた。
- 既存利益は `sales + rentIncome + stockIncome - expenses + subs.profit` で、法人税、利息、配当も `expenses` に含まれていた。
- 税金は四半期週のみ、税前相当利益が正のとき `operatingProfit * 0.306` を即時費用・即時現金流出として扱っていた。
- 借入は `borrow()` が単一残高 `companyDebt` / `personalDebt` と現金を同時に増やし、`repay()` が単一残高と現金を同時に減らしていた。契約別ローン情報はなかった。
- 設備投資は出店費、事業投資、海外投資などが現金支出として存在したが、固定資産台帳と減価償却台帳はなかった。
- 資産データは会社現金、店舗、会社株式、会社所有不動産、スタートアップ投資、子会社、M&A子会社、のれん等に分散していた。負債は主に `companyDebt`、純資産は明示台帳なしだった。
- 個人現金と会社現金は `personalCash` と `companyCash` で分離され、株式配当や個人不動産・スポーツ等は個人側へ入る処理が存在した。

## 現金増減処理

| 区分 | 対象ファイル | 関数 | 内容 |
|---|---|---|---|
| 営業 | `js/engine.js` | `advanceWeek()` | 店舗売上、変動費、固定費、修繕、商品、海外、FC、子会社、賃料、株式配当、給与、本社費、利息、税金、配当を集計して会社現金へ反映 |
| 投資 | `js/engine.js` | `openStore()`, `investBusiness()`, `buyStock()`, `sellStock()`, `investStartup()`, `acquireTarget()`, `sellMASubsidiary()`, `openOverseas()` | 出店、事業投資、株式投資、VC、M&A、海外法人 |
| 財務 | `js/engine.js` | `borrow()`, `repay()`, `executeIPO()`, `buybackOwnShares()` | 借入、返済、IPO、自社株 |
| 税金 | `js/engine.js` | `advanceWeek()` | 四半期黒字時の法人税即時控除 |
| 拡張 | `js/expansion.js`, `js/completion.js`, `js/parity.js` | 各拡張関数・週次ラッパー | 供給契約、垂直統合、R&D、社内商品、メディア、キーパーソン等の追加調整 |

## 二重計上・未計上の可能性

- 利益と現金が同時に同額で動くため、減価償却・設備投資・元本返済の区別がなかった。
- 税金費用と税金支払のタイミング差は表現されていなかった。
- 借入金元本、支払利息、配当が費用・現金・財務CFへ分解されていなかった。
- 拡張ラッパーが `lastReport` を後から調整するため、会計イベントは週次確定後に1回だけ記録する必要がある。

## Phase 1Bで置き換える範囲

- 会社現金を再計算せず、既存処理後の実取引を `js/finance.js` の会計イベントとして記録する。
- PL、BS、CF、運転資本、固定資産台帳、ローン台帳、税金、配当可能額、指標、13週資金繰りを追加する。
- 既存の市場計算、株価、株価履歴、株式売買、Phase 1A市場結果は維持する。

## 設計判断

- 完全な複式仕訳ではなく、検証可能な会計イベント方式を採用する。
- 旧セーブ移行では架空の過去取引を生成しない。現在の会社現金、借入、保有資産から決定論的に初期残高を作る。
