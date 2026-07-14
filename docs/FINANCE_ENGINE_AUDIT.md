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


## companyCash変更箇所と会計イベント

| 関数 | 現金増減 | 会計イベント | 備考 |
|---|---|---|---|
| `openStore()` | 出店費・保証金支払 | `capitalExpenditure`, `otherInvesting` | 店舗設備は固定資産台帳へ登録 |
| `closeStore()` | 閉店回収収入 | `assetSale` | 対応固定資産を `disposed` にし売却損益を認識 |
| `investBusiness()` | 品質・ブランド・効率・DX投資 | `advertising`, `researchAndDevelopment`, `capitalExpenditure` | 台帳がない投資は費用分類を優先 |
| `contractOffice()` / `cancelOffice()` | 保証金支払・返還 | `otherInvesting`, `assetSale` | 返還差額は資産減少として表示 |
| `establishDepartment()` / `hireDepartmentStaff()` / `hireExecutive()` | 本社費・採用費 | `headOfficeExpense`, `payroll` | 会社現金のみ対象 |
| `buyStock()` / `sellStock()` | 会社株式購入・売却 | `investmentPurchase`, `investmentSale` | 売却益損はPL営業外損益 |
| `investStartup()` / `ipoSubsidiary()` | VC投資・売出 | `investmentPurchase`, `investmentSale` | 会社資金のみ対象 |
| `acquireTarget()` / `sellMASubsidiary()` | M&A取得・売却 | `acquisition`, `assetSale` | 売却損益を認識 |
| `buySportsTeam()` / `sellSportsTeam()` | 会社球団購入・売却 | `assetPurchase`, `assetSale` | 個人所有は会計対象外 |
| `borrow()` / `repay()` | 借入・返済 | `debtBorrowing`, `debtRepayment` | ローン台帳と同期 |
| `advanceWeek()` | 店舗・商品・不動産・株式配当・税金等 | 週次イベント | 会社現金反映後に1回だけ記録 |
| `evaluateProgression()` | ミッション報酬 | `otherOperating` | idempotencyKeyで重複防止 |

拡張ファイル `expansion.js`, `completion.js`, `parity.js` には週次後調整が存在する。Phase 1Bでは主要な会社現金経路を会計接続し、今後のPhaseで拡張ラッパー単位の細分化を進める。

## Merge前最終監査: companyCash 変更箇所と会計接続

静的検索対象: `rg -n "companyCash\s*(?:[+\-*/]?=)|this\.g\.companyCash|g\.companyCash" js`。Phase 1Bでは会社資金のみを会計イベントへ接続し、個人資金はPL/BS/CFへ混在させない。

| 処理/関数 | 現金増減 | 会計カテゴリ | CF区分 | PL影響 | BS影響 | 対応イベント | 備考 |
|---|---:|---|---|---|---|---|---|
| `openStore` | 店舗設備・保証金支払 | `capitalExpenditure`, `otherInvesting` | 投資CF | なし | 固定資産・保証金増 | `openStore`, `openStoreDeposit` | 店舗設備は固定資産台帳 |
| `closeStore` | 除却回収額入金 | `assetSale` | 投資CF | 売却損益 | 固定資産除却 | `closeStore` | 翌週以降償却停止 |
| `investBusiness` | 品質/ブランド/効率/DX投資 | `researchAndDevelopment`, `advertising`, `headOfficeExpense` | 営業CF | 費用 | assetEffect 0 | `investBusiness` | 効率/DXはPhase 1Bでは費用処理 |
| `contractOffice` | 保証金支払 | `otherInvesting` | 投資CF | なし | 保証金資産増 | `contractOffice` | 簿価=保証金 |
| `cancelOffice` | 60%返還 | `assetSale` | 投資CF | 40%解約損 | 保証金全額除却 | `cancelOffice` | 返還額と簿価差をPL認識 |
| `refreshExecutives` | 紹介費支払 | `headOfficeExpense` | 営業CF | 費用 | なし | `refreshExecutives` | 乱数は候補生成のみ |
| `hireDepartmentStaff` / `hireExecutive` | 採用・契約金 | `payroll` | 営業CF | 費用 | なし | `hireDepartmentStaff`, `hireExecutive` | 会社資金 |
| `buyStock` / `sellStock` | 会社株式売買 | `investmentPurchase`, `investmentSale` | 投資CF | 売却損益 | 投資有価証券簿価 | `buyStock`, `sellStock` | 購入手数料込み取得原価 |
| `borrow` / `repay` | 借入・返済 | `debtBorrowing`, `debtRepayment` | 財務CF | 利息のみ費用 | 借入残高 | `borrow`, `repay` | 会社借入のみ会計対象 |
| `investStartup` / `makeSubsidiary` | VC投資 | `investmentPurchase` | 投資CF | なし | 投資資産/子会社簿価 | `investStartup` | 簿価は投資額 |
| `acquireTarget` / `sellMASubsidiary` | M&A取得/売却 | `acquisition`, `assetSale` | 投資CF | 売却損益 | 子会社簿価・のれん | `acquireTarget`, `sellMASubsidiary` | 取得原価基準 |
| `launchProduct` / `productAction` / `sellProduct` | 商品事業支出/売却 | `researchAndDevelopment`, `advertising`, `assetSale` | 営業CF/投資CF | 開発費・売却損益 | Phase 1Bは追加支出を費用処理 | `launchProduct`, `productAction`, `sellProduct` | valuationはBSに直接反映しない |
| `buyProperty` / `sellProperty` / `buildOnLand` | 不動産取得/売却/建設 | `assetPurchase`, `assetSale`, `capitalExpenditure` | 投資CF | 売却損益 | 取得原価・建物固定資産 | `buyProperty`, `sellProperty`, `buildOnLand` | valuation変動は参考値のみ |
| `openOverseas` / `overseasAction` | 海外法人設立/追加投資 | `assetPurchase`, `researchAndDevelopment`, `advertising` | 投資CF/営業CF | 追加投資は費用 | 海外法人簿価は設立原価 | `openOverseas`, `overseasAction` | valuationはBSに直接反映しない |
| `buySportsTeam` / `sellSportsTeam` / `acceptTeamSaleOffer` | 球団取得/売却 | `assetPurchase`, `assetSale` | 投資CF | 売却損益 | 球団購入原価 | `buySportsTeam`, `sellSportsTeam`, `acceptTeamSaleOffer` | 補強費は営業費用 |
| `missionReward` | 報酬入金 | `otherOperating` | 営業CF | 収益 | 現金増 | `missionReward` | イベント後に正式再スナップショット |
| `workforce-invest` | 福利厚生投資 | `headOfficeExpense` | 営業CF | 費用 | なし | `workforceInvest` | UI inline処理だが会計イベントへ接続済み |

未接続を隠すための自動現金差額計上は禁止。`validate()` はスナップショットの `cashDifference`、期間CF期末現金、累積cashEffectロールフォワードを検査する。

## 店舗保証金と建物付き不動産の最終処理

- `openStore` は店舗設備を `capitalExpenditure`、テナント保証金を `otherInvesting` として記録する。
- `closeStore` は既存ゲーム仕様どおり店舗設備回収額のみ会社現金へ加算し、保証金返還は追加しない。閉店時に `closeStoreDeposit` イベントで `cashEffect=0`、`assetEffect=-tenant.deposit`、`profitEffect=-tenant.deposit` を記録し、保証金没収損として利益剰余金へ反映する。
- `buildOnLand` の建物固定資産は `propertyID` で土地へ紐付ける。土地本体の簿価と建物固定資産簿価は分離し、売却時は `sellProperty` が土地取得原価 + 有効建物固定資産の正味簿価を総簿価として売却損益を計算する。
- `sellProperty` は売却収入を会社現金へ1回だけ加算し、紐づく建物固定資産を `disposed` にして翌週以降の減価償却を停止する。
