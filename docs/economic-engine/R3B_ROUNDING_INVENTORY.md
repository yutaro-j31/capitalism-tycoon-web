# R3b 会社不動産・テナント/賃料/保証金 円切り上げ事前インベントリ

作成日: 2026-10-23 JST。READ_ONLY / 文書のみ。実装・ランタイムテスト実行・マージなし。

MAIN SHA: `927419156996a64edda6d3ae1b4b4182d9e81546`。ブランチ: `docs/r3b-rounding-inventory`。
全ソース行番号・assertion行番号はこの固定SHAのもの。行数は**金額判断1件/表1行**で数え、同じminified物理行内の複数額を分解する。getter・見積・既存額転記も表に含め、物理行数/ledger件数とは区別する。

開始時のorigin/mainはR2c #1092マージ後、R2dは契約§8でTODO。Owner申告ではClaudeがR2d仕上げ中。R2d/R3aの実装ブランチを変更しない。R2d後にmainが進んでも以下はこのSHAの調査記録であり、実装時に新mainとの差分を確認する。AGENTS.md、CLAUDE.mdの関係規則と[契約書](YEN_CEILING_ROUNDING_CONTRACT.md) §1–§6/§8を適用する。

## 対象の確定（実在14ファイル）

実行したコマンド: `ls js/real-estate-tenant-*.js js/real-estate-rent-*.js js/real-estate-security-deposits.js`。
グロブはUIも拾うので省かず掲載する。9 core + 5 UI。`real-estate-security-deposits-ui.js`はこの指定グロブには入らず、依存参照のみ。

- `js/real-estate-rent-guarantee-ui.js`
- `js/real-estate-rent-guarantee.js`
- `js/real-estate-rent-performance-ui.js`
- `js/real-estate-rent-performance.js`
- `js/real-estate-rent-pricing-ui.js`
- `js/real-estate-rent-pricing.js`
- `js/real-estate-security-deposits.js`
- `js/real-estate-tenant-collections-ui.js`
- `js/real-estate-tenant-collections.js`
- `js/real-estate-tenant-contracts.js`
- `js/real-estate-tenant-leasing.js`
- `js/real-estate-tenant-operations.js`
- `js/real-estate-tenant-renewals-ui.js`
- `js/real-estate-tenant-renewals.js`

## 適用規則/計上先の読み方

- `C(x)` = 共通 `economicOperation.ceilYen(x)`。銭精度を経由せず、負数も絶対値方向、noise/safe envelopeは契約§2。各fileの`round`は `Math.round(n(v)*100)/100`。
- 新規に確定/計上する額だけC。残高capは丸め後 `min(C(raw),storedCap)`。cash capは `max(0,cash)`、既存残高・過去累計は元値、増減/残差は派生値。capした額をCで戻して上限超過させない。
- 契約単価（monthlyRent）を新規合意として保存する場合は一度Cして受領/週次請求の原値へ。同一週次請求からcash/arrears/累計/ledgerへ同じ額を転記する。過去契約や過去滞納をロード時にCしない。
- 「変更なし」は時価/純粋な見積/分析/表示など§1対象外で、現行精度を保つ意味。「元値」は保存済みや確定済み額を使う意味。「派生値」は再丸めしない。
- 表の`カテゴリ / sourceType`はfinance.event呼出時の文字列。aliasによるcanonical化はfinance.jsの責任。例えばpropertyRentIncome/arrearsRecovery/securityDepositAppliedはrevenue、tenantService/tenantRetention/brokerageFee/tenantDeposit/tenantDepositRefundはotherOperating。丸めPRでtaxonomyを変えない。
- **eventのliabilityEffectがあることとBSに負債残高があることは別**。現finance.js:529のotherLiabilitiesは0。以下では保証金の意図する負債と現BSの未反映を明示し、会計PASSは主張しない。
- coreのensure-chainはrealEstateDevelopment.ensureに到達し、productionの契約実体は原則`g.realEstateDevelopment.tenantContracts`。test stubの`g.realEstate.tenantContracts`やsale側の`g.tenantContracts`と混同しない。

## `js/real-estate-tenant-contracts.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 8 | private round helper | 銭round | 13/17/18行money caller | 決済はC、元値/派生値はround除去 | 保存残高への一括C不可 |
| 10 | depositBalance/arrears | n/max、なし | 契約保証金負債相当/滞納state、現BS未反映 | 元値 | §1.1ロード端数保全 |
| 10 | rentCollectedTotal/rentMissedTotal/depositAppliedTotal | n/max、なし | 契約累計 | 元値 | 累計を正規化しない |
| 13 | monthlyRent入力/fallback p.value*.004 | なし/max | 新規契約rentの計算元 | 変更なし（raw入力） | 設定/評価から契約額を確定する境界 |
| 13 | contractRent | round(monthlyRent*multiplier) | quote.monthlyRent→contract.monthlyRent | ceilYen（新規合意額） | 提示と契約保存同額、既存契約は触らない |
| 13 | deposit | round(contractRent*depositMonths) | quote.deposit→受領額 | min不要のceilYen（上限なし） | 先に確定rent、保証金総受領を一度C |
| 17 | 受領cash加算 | round(cash+deposit) | companyCash/personalCash | 派生値 | 残高端数を保持 |
| 17 | monthlyRent/depositBalance/arrears0/累計0保存 | 転記/0 | tenantContracts、受領保証金負債相当 | 元値/変更なし（新規0） | 受領額と保存額一致 |
| 17 | 受領ledger/history | 転記 | tenantDeposit / property-tenant-deposit; cash+,liability+; 現BS未反映 | 確定deposit元値 | 返還まで保存、BS課題は別記 |
| 18 | weeklyDue | round(monthlyRent/4.345*occupancy) | cashまたはarrears/履歴、propertyRentIncome入力 | ceilYen | 週次の確定請求を分岐前に一度 |
| 18 | missed時arrears/rentMissedTotal | round(残高+weeklyDue) | 滞納/未収累計、finance receivable計上なし | 派生値 | 現状は契約stateのみ、二重認識しない |
| 18 | 回収cash/rentCollectedTotal | 各round | owner cash/累計 | 派生値 | 同weeklyDue受領 |
| 18 | 回収ledger/history | 転記 | propertyRentIncome / property-tenant-rent; cash+,profit+ | 確定weeklyDue元値 | 未収時にはpostしない現行モデル |
| 18 | default時applied | min後round | depositBalance/arrears相殺 | min(storedDeposit,storedArrears)（元値） | 既存確定額の精算、どちらもCしない |
| 18 | default時depositBalance/arrears/depositAppliedTotal | 各round(差/和) | 契約残高/累計 | 派生値 | 端数の債務/滞納を勝手に消さない |
| 18 | default充当ledger | 転記 | tenantDepositApplied / property-tenant-default; cash0,profit+,liability- | applied元値 | 保証金と未収の既存相殺、BS反映は別問題 |
| 18 | 自動更新monthlyRent | round(oldRent*1.03) | 契約monthlyRent/history | ceilYen（新規更新額） | rate1.03自体は丸めない |
| 18 | 退去refund | stored depositBalance、なし | 返還現金/保証金0 | 元値 | §8注記どおり受領後の残額を返す |
| 18 | 退去cash減額 | round(cash-refund) | owner cash | 派生値 | 旧端数保証金もそのまま返す |
| 18 | 返還ledger/history | なし（amountに-refund） | tenantDepositRefund / property-tenant-refund; cash-,liability- | 保存refund元値、符号維持 | finance.event.amountはabs、effectsは負号。再C不要 |

## `js/real-estate-tenant-leasing.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 7 | PLANS.cost | 整数定数 | marketing fee master | 変更なし | 全プラン既に整数 |
| 8 | round helper | 銭round、incomeMultipleとも共用 | moneyと比率のcaller | 金額C/派生値と非金額helperを分離 | not-money全体免除不可 |
| 18 | getMarketingPlans cost転記 | なし | UI quote | 元値 | 費用の提示と実行を揃える |
| 19 | marketing plan.costとcash支払 | costなし/cash round | marketing / property-tenant-marketing; company/personalCash | costは元値（整数）、cash派生値 | 支払可否も同額、定数を二重Cしない |
| 19 | marketingCost/history.cost/ledger effects | 転記 | listing/履歴、cash-/profit- | 確定cost元値 | 同額利用 |
| 20 | brokerage fee | round(contract.monthlyRent*brokerRate) | contract.brokerageFee | ceilYen | 契約後の一時費用、brokerRate自体は非金額 |
| 20 | brokerage cash減額 | round | owner cash | 派生値 | 保存残高を正規化しない |
| 20 | brokerage ledger/history | 転記 | brokerageFee / property-tenant-brokerage; cash-,profit- | 確定fee元値 | nested signPropertyTenantのdepositと別決済 |
| 23 | restoration building見積元 | なし/max | cost計算用buildingValue/p.value | 変更なし | 時価はraw入力、BS簿価を書かない |
| 23 | restoration cost | round(max(50000,building*severity*...)) | 修繕due | ceilYen | 請求額を先に確定 |
| 23 | restoration paid | 直接min(cash,cost) | maintenance / property-tenant-restoration | 推奨min(C(rawCost),max(0,cash)) | 現状負cashで負支払の静的リスク。0下限は要明示 |
| 23 | cash/restorationCost/history.cost | cash round、他転記 | owner cash、c.restorationCost | 派生値/確定paid元値 | cash cap後再Cしない、初期legacy端数も保存 |

## `js/real-estate-tenant-operations.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 7 | PLANS.weeklyCost | 整数定数 | service due | 変更なし | 8000/30000/85000は整数 |
| 8 | round helper | 銭round | 18/19行金額 | Cと元値/派生値へ用途別 | 満足度には現在round呼出しなし |
| 10 | serviceCostPaid ensure | n/max、なし | 累計state | 元値 | ロード端数保持 |
| 15 | operations weeklyCost quote | PLANS転記 | UI表示/getter | 元値 | 実dueと一致 |
| 16 | service plans weeklyCost | なし | UI一覧 | 元値 | 他plan率/満足度は非金額 |
| 18 | complaint cost | round(max(30000,monthlyRent*.2*count)) | tenantService / property-tenant-complaint-resolution | ceilYen | 全額支払/不足拒否は維持 |
| 18 | complaint cash/cost履歴・戻り値 | cash round、他転記 | owner cash、history | 派生値/確定cost元値 | 同額post、満足度gainは別 |
| 19 | weekly service cost | min(cash,integer weeklyCost) | tenantService / property-tenant-service | 推奨min(C(rawDue),max(0,cash))（dueは既に整数） | cash cap後Cしない、負cash静的リスク別記 |
| 19 | cash/serviceCostPaid累計 | 各round | owner cash/累計 | 派生値 | 旧端数cash/累計保持 |
| 19 | ledger/service-week cost | 転記 | tenantService / property-tenant-service; cash-,profit- | 確定cost元値 | 担当はR3b、R3aの物件管理修繕と別 |

## `js/real-estate-tenant-renewals.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 6 | round helper | 銭round | 10/11行新規更新 | 金額確定だけC | 既存累計にC不可 |
| 8 | renewalConcessionPaid ensure | n/max、なし | 更新優遇累計 | 元値 | 旧保存保全 |
| 10 | newMonthlyRent quote | round(monthlyRent*(1+rentChange)) | 更新条件提示 | 変更なし（現行精度の更新見積） | 実行11行で新規合意額をC、getterからは転記されない |
| 10 | concession quote | round(monthlyRent*months) | 優遇一時金提示 | 変更なし（現行精度のforecast） | 11行の実優遇支出だけCする |
| 11 | concession settlement/cash可否 | round/raw比較 | tenantRetention / property-tenant-renewal-concession | ceilYen、全額支払/不足拒否維持 | acceptance前に確定、否決なら0支払 |
| 11 | 更新cash/renewalConcessionPaid | 各round | owner cash/累計 | 派生値 | 同concession支払 |
| 11 | accepted monthlyRent | round(old*(1+rentChange)) | contract.monthlyRent | ceilYenを一度確定して保存 | 自動更新contracts:18と別入口 |
| 11 | ledger/history/newMonthlyRent/return | 転記 | tenantRetention / property-tenant-renewal-concession; cash-,profit- | 確定concession/rent元値、declined額0 | 更新料収入ではなく会社の優遇支出 |

## `js/real-estate-tenant-collections.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 5 | ACTIONS.cost | 整数定数 | collection費用master | 変更なし | 5000/25000/120000は整数 |
| 6 | round helper | 銭round | 10/11/12金額 | 用途別C/元値/派生値 | 残高に一括C不可 |
| 8 | collectionCostPaid/paymentPlanBalance ensure | n/max、なし | 累計/分割回収残高state | 元値 | ロード保全 |
| 10 | expectedRecovery quote | round(arrears*recoveryRate) | UI見積 | 変更なし | 実回収11行は異なる式。予測を実収と誤認しない |
| 11 | action cost支払/cash | costなし/cash round | collectionExpense / property-tenant-collection; cash-,profit- | cost元値、cash派生値 | 既に整数、全額不足拒否維持 |
| 11 | recovered | round(min(arrears,arrears*(.35+rate))) | arrearsRecovery / property-tenant-recovery; cash+,profit+ | min(C(rawRecovery),storedArrears) | cap後C禁止、success=falseは0 |
| 11 | arrears/cash更新 | 各round | max0残滞納、owner cash | 派生値 | 保存債権の末尾端数cap保持 |
| 11 | collectionCostPaid/planBalance | round累計/arrears転記 | 支払累計/分割残高 | 派生値/元値 | 二重丸めしない |
| 11 | ledger/history recovered/remaining | 転記 | 上記expense/recovery 2rows | 確定cost/recovered元値 | 未収をここで新規発生させない |
| 12 | payment-plan installment | round(min(arrears,max(1000,rent*.08))) | owner cash/arrears、finance.eventなし | min(C(max(1000,rent*.08)),storedArrears) | 確定回収であり見積ではない。ledger欠落は別記 |
| 12 | plan arrears/planBalance/cash/history | cash/arrears round、他転記 | state/tenantCollectionHistory | 派生値/元値 | 現BS/ledgerに回収行なし。整数のみで合格しない |
| 12 | eviction remainingArrears | 転記 | history/state | 元値 | default status変更だけで債権を消さない |

## `js/real-estate-rent-guarantee.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 6 | round helper | 銭round | 9/11/12金額 | C/元値/派生値を分離 | capと残高精度 |
| 7 | premiumPaid/payoutTotal/claimedArrears ensure | n/max、なし | 契約累計/請求済滞納 | 元値 | 旧保存保全 |
| 9 | weeklyPremium quote | round(monthlyRent*weeklyRate) | 保証料提示 | 変更なし（現行精度のforecast） | 実支払は12行でC、getterの見積を受領額に使わない |
| 11 | eligible | raw max(0,arrears-claimed) | 保証対象滞納計算 | 派生値 | 既存残高差分 |
| 11 | limit/remaining guarantee limit | なし、max(0,limit-payoutTotal) | 保証上限/残枠 | limitは契約上限原値、残枠は派生値 | 整数monthlyRent×整数monthsで既に整数、旧端数枠を越えない |
| 11 | payout | round(min(eligible*coverage,remainingLimit)) | rentGuaranteePayout / property-rent-guarantee; cash+,profit+ | min(C(eligible*coverage),remainingLimit,eligible) | 丸め後cap、eligible追加capは被保証額超過防止を明示 |
| 11 | cash/payoutTotal | 各round | owner cash/累計 | 派生値 | 同payout追加 |
| 11 | guaranteeClaimedArrears | n(arrears)転記 | 請求済対象額、arrears自体は不変 | 元値 | 保証割合/権利移転モデルを勝手に変えない |
| 11 | payout ledger/history | 転記 | 上記category/sourceType、arrears履歴 | 確定payout/arrears元値 | 未払滞納と別state、再請求拒否維持 |
| 12 | premium due | round(monthlyRent*weeklyRate) | 保証料支払入力 | ceilYen | 新規週次charge |
| 12 | paid | min(cash,premium) | rentGuaranteePremium / property-rent-guarantee-premium | 推奨min(C(rawPremium),max(0,cash)) | capした端数保持、負cash時を別記 |
| 12 | cash/guaranteePremiumPaid | cashを先にround、累計round | owner cash/累計 | 派生値（cashの先行roundも除去） | 端数現金の消失を防ぐ |
| 12 | premium ledger/history | 転記 | rentGuaranteePremium / property-rent-guarantee-premium; cash-,profit- | 確定paid元値 | dueとpaidを混同しない |

## `js/real-estate-security-deposits.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 6 | round helper | 銭round | 9/10/11全金額 | 確定targetC、保存/精算は元値と派生値 | 一括C不可 |
| 7 | held/applied/returned ensure | n/max、なし | securityDepositHeld/Applied/Returned | 元値 | depositBalanceとは別state、現BS負債なし |
| 9 | policy amount quote | round(monthlyRent*months) | 設定額提示 | 変更なし（現行精度の設定見積） | 実設定10行のtargetだけC、premium months=.5は実fraction源 |
| 10 | target | round(monthlyRent*months) | securityDepositHeld | ceilYen（新規設定額）、受領額と断言しない | 現状cash/finance受領postなし |
| 10 | delta | round(target-oldHeld) | securityDepositHistory.delta | 派生値 | 旧heldの端数を保持、受領/返還cashなし |
| 10 | held/history amount | 転記 | securityDepositHeld/履歴 | 確定target元値 | 設定変更でactual受領を自動仮定しない |
| 11 | arrears入力/applied | min後round | min(arrears,held)で相殺、securityDepositApplied / property-security-deposit | min(storedArrears,storedHeld)（元値） | 既存額同士の精算。丸めて上限超過不可 |
| 11 | returned | round(held-applied) | 返還額戻り値/履歴、cashは動かない | 派生値 | storedHeld=applied+returned、返還cash実装済と誤認しない |
| 11 | arrears/appliedTotal/returnedTotal | 各round(和差) | c.arrears/securityDepositApplied/Returned | 派生値 | 残高/過去累計の再丸めなし |
| 11 | held=0 | なし | securityDepositHeld | 変更なし（精算済の0） | ロード正規化ではない |
| 11 | applied ledger | 転記 | securityDepositApplied / property-security-deposit; cash0,profit+,liabilityEffect指定なし | 確定applied元値 | depositBalanceのtenantDepositAppliedと同じ会計ではない |
| 11 | returned/cashKey戻り値 | 転記 | settlement戻り値、history | 元値 | cashKeyを返すだけで返還していない |

## `js/real-estate-rent-pricing.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 8 | round helper | 銭round、ratio/incomeMultiple共用 | 見積と非金額caller | 変更なし（精度維持）だがhelper用途を分離 | §1対象外専用にし注記、決済で使わない |
| 12 | marketRent | round(max(...value*.004...)) | marketMonthlyRent（見積） | 変更なし | 時価/条件由来の募集目安 |
| 13 | market/previousMarket/previousAsking | 元値/n/max | marketMonthlyRent/askingMonthlyRentの再計算元 | 変更なし | 既存見積再評価、財産残高とは別 |
| 13 | askingMonthlyRent/monthlyRent再計算 | round(max(10000,market*ratio)) | p.realEstate asking/月額設定 | 変更なし（新規契約13行でC） | ensureから契約c.monthlyRentや保証金をCしない |
| 13 | vacancyOpportunityLossTotal ensure | n/max、なし | 未収益機会の分析累計 | 元値 | 実債権/cashではない |
| 15 | getPricing strategies.monthlyRent | round(market*multiplier) | 募集見積一覧 | 変更なし | contract作成時だけC |
| 16 | setAskingRent monthlyRent | round(market*multiplier) | p.realEstate募集設定/履歴 | 変更なし（設定/見積） | active契約の賃料変更ではない |
| 17 | listing.marketMonthlyRent/askingMonthlyRent | 転記 | listingスナップショット | 元値 | 確定receiptでない |
| 18 | weeklyLoss | round(marketRent/4.345*occupancy) | vacancyOpportunityLoss/history、ledgerなし | 変更なし | 機会損失は現金/請求債権でない |
| 18 | vacancyOpportunityLossTotal | round(total+weeklyLoss) | 分析累計 | 変更なし（§1分析値） | whole-yen state対象に入れない |

## `js/real-estate-rent-performance.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 4 | round helper | 銭round | 分析額/比率 | 非決済専用として変更なし、率と金額を区別 | 決済helperに切り替えない |
| 7 | market/asking/realized/collected/missed/arrears/vacancyLoss | n/max、なし | metric output | 元値読取り | sourceの精度を保つ |
| 7 | expected=collected+missed | なし | collectionRateの分母 | 派生値 | 実決済しない |
| 7 | pricingGap/revenueLeakage | round(差/和) | 分析output | 変更なし | 損益postでない。負gapもC不可 |
| 8 | totals各金額sum | なし | report totals | 元値の和 | 複数物件の合計であって配分でない |
| 9 | report getter | 転記 | engine.getRealEstateRentPerformance | 変更なし | cash/ledgerへのwriteなし |
| 10 | weekly performance履歴金額 | report転記 | rentPerformanceHistory | 元値/変更なし | 分析snapshotを整数ガードの決済対象にしない |

## `js/real-estate-tenant-collections-ui.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 2 | money表示helper | Math.round(Number(v)) | UI文字列のみ | 変更なし | UIは契約§1対象外 |
| 2 | collections金額の読取り/描画 | money(helper)で表示 | arrears/paymentPlanBalance/options.cost/expectedRecovery | 元値読取り/表示は変更なし | authoritative state/ledgerを更新しない |

## `js/real-estate-tenant-renewals-ui.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 2 | money表示helper | Math.round(Number(v)) | UI文字列のみ | 変更なし | UIは契約§1対象外 |
| 2 | renewals金額の読取り/描画 | money(helper)で表示 | newMonthlyRent/concession | 元値読取り/表示は変更なし | authoritative state/ledgerを更新しない |

## `js/real-estate-rent-guarantee-ui.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 2 | money表示helper | Math.round(Number(v)) | UI文字列のみ | 変更なし | UIは契約§1対象外 |
| 2 | guarantee金額の読取り/描画 | money(helper)で表示 | guaranteePremiumPaid/PayoutTotal/plans.weeklyPremium | 元値読取り/表示は変更なし | authoritative state/ledgerを更新しない |

## `js/real-estate-rent-performance-ui.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 2 | money表示helper | Math.round(Number(v)) | UI文字列のみ | 変更なし | UIは契約§1対象外 |
| 2 | performance金額の読取り/描画 | money(helper)で表示 | totals.vacancyLoss/missed/revenueLeakage、各rowのmarket/realized/leakage | 元値読取り/表示は変更なし | authoritative state/ledgerを更新しない |

## `js/real-estate-rent-pricing-ui.js`

| 行番号 | 項目 | 現在の丸め | 計上先（category/sourceType、state、BS） | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 4 | money表示helper | Math.round(Number(v)) | UI文字列 | 変更なし | UI整形は対象外 |
| 5 | strategies/monthlyRent/marketMonthlyRent/askingMonthlyRent/vacancyLoss描画 | moneyで表示 | 画面のみ | 元値読取り/表示は変更なし | ratio百分率は非金額 |

## not-money候補（率・倍率・稼働率）

以下は銭パターンのliteral定義と呼出しの両方を含む候補件数。現状literalはprivate helper行にあり、呼出行にコメントするだけではlexical ratchetを外せない。混在minified行を分割し、金額writerと同一行への広域免除を避ける。満足度/creditScore/complaintChance/rentChange/coverage/retentionBonusは非金額だが、現在この丸めパターンを使わないものは候補件数に加えない。UIのtoFixedも銭writerではない。

| ファイル | 行 | 非金額項目 | コメント/分離案 |
|---|---|---|---|
| `real-estate-tenant-leasing.js` | 8 | round定義の非金額caller | `incomeMultiple専用rへ分離して /* not-money: applicant income-to-rent multiple */` |
| `real-estate-tenant-leasing.js` | 22 | incomeMultiple | `/* not-money: applicant income-to-rent multiple */` |
| `real-estate-rent-pricing.js` | 8 | round定義の非金額caller | `ratio/income専用helperに /* not-money: asking-rent ratio and applicant income multiple */` |
| `real-estate-rent-pricing.js` | 13 | askingRentRatio=round(ratio) | `/* not-money: asking rent to market rent ratio */` |
| `real-estate-rent-pricing.js` | 16 | askingRentRatio=round(strategy.multiplier) | `/* not-money: asking-rent strategy multiplier */` |
| `real-estate-rent-pricing.js` | 17 | incomeMultiple | `/* not-money: applicant income-to-rent multiple */` |
| `real-estate-rent-performance.js` | 4 | round定義の非金額caller | `比率専用helperへ /* not-money: performance ratios and occupancy */` |
| `real-estate-rent-performance.js` | 7 | realizedRate/askingRate | `/* not-money: realized and asking rent ratios */` |
| `real-estate-rent-performance.js` | 8 | totals.collectionRate/realizedRate/occupancy | `/* not-money: collection realization and occupancy fractions */` |

純粋な見積/分析金額も§1対象外だが率とは別物。rent-pricing:8とrent-performance:4でその精度を残す場合、非決済専用helperへ分離して `/* not-money: unsettled rent estimates only */` / `/* not-money: nonposting rent analytics only */` のように§1対象外の理由を同じliteral定義行へ記す。tenant-renewals:6、tenant-collections:6、rent-guarantee:6、security-deposits:6にも再計算forecast用の銭丸めが残るため、実writer用C/残差と見積用helperを分離して後者のliteral行だけに `/* not-money: nonposting forecast only */` 等の根拠を記す。これは受領額/保証金/滞納/回収のhelper免除に使わない。定義行を完全に金額writer用Cへ置換し、非決済の銭丸めだけinlineに残す場合も個々のinline行へ正確に注記する。

## 行数集計

金額判断には表示・分析・helperも含む。not-money候補は上表のみ（非決済金額helperの注記案は二重カウントしない）。

| ファイル | 金額判断行数 | not-money候補数 |
|---|---|---|
| `real-estate-rent-guarantee-ui.js` | 2 | 0 |
| `real-estate-rent-guarantee.js` | 13 | 0 |
| `real-estate-rent-performance-ui.js` | 2 | 0 |
| `real-estate-rent-performance.js` | 7 | 3 |
| `real-estate-rent-pricing-ui.js` | 2 | 0 |
| `real-estate-rent-pricing.js` | 10 | 4 |
| `real-estate-security-deposits.js` | 12 | 0 |
| `real-estate-tenant-collections-ui.js` | 2 | 0 |
| `real-estate-tenant-collections.js` | 12 | 0 |
| `real-estate-tenant-contracts.js` | 20 | 0 |
| `real-estate-tenant-leasing.js` | 12 | 2 |
| `real-estate-tenant-operations.js` | 10 | 0 |
| `real-estate-tenant-renewals-ui.js` | 2 | 0 |
| `real-estate-tenant-renewals.js` | 8 | 0 |
| 合計 | 114 | 9 |

## 保証金: 保存受領額を返す / 2つのstateを混ぜない

### tenant-contracts の実受領 `depositBalance`

`quote:13`で新規合意月額rentをCし、受領depositをCしてから、`signPropertyTenant:17`がcash・depositBalance・tenantDepositのcashEffect/liabilityEffectへ**同額**を渡す。受領後に市場賃料や募集倍率が変わっても返還額を再計算しない。新規depositを整数で保存していれば、満額返還も整数。defaultで一部を相殺した後の残額だけ返す。

`processWeek:18`のrefundはstored depositBalanceそのもの。返還時に`ceilYen(refund)`は呼ばず、cashは`oldCash-refund`、liabilityEffectは`-refund`。負のamountを渡す既存呼出しではfinance.eventがabsolute amountを作るが、effectsの符号を変えない。未収充当は`min(storedDeposit,storedArrears)`で、どちらも過去に確定済みなので新たなCは不要。元の受領額 = 累計充当 + 返還済額 + 現在残額を追跡する（既存stateに返還累計がない経路は履歴とledgerを使い、保存形式は増やさない）。

旧セーブの保証金10.5円はロードも返還も10.5円、滞納4.3なら充当4.3・残額6.2。旧sub-cent10.504はstateを保存値のまま使い、finance.eventの銭精度でledgerが10.50になる可能性は§1.1の既存toleranceで確認する。旧保存を拒否/正規化したり残差をprofitへ追加しない。

### security-deposits の設定/記録 `securityDepositHeld`

`setPropertySecurityDeposit:10`はtargetをheldに設定するが、cash受領・liabilityEffectをpostしない。`settlePropertySecurityDeposit:11`もapplied/returnedを記録しcashKeyを返すだけで、returnedの現金返還は実行しない。appliedのeventはcash0/profit+でliabilityEffectを指定しない。これは上記depositBalanceと異なる実装で、**2つを合算して会社の実受領保証金負債と見なせない**。

丸め提案は設定target=C、delta=target-oldHeld、精算applied=min(arrears,held)、returned=held-applied、過去累計は和差のみ。契約注記「Deposits are refunded at their stored whole-yen amount」をこのAPIで実際に満たすには、受領・返還・負債のcanonicalな出所をClaude/Ownerが確認する必要がある。ここで存在しない返還eventを発明しないし、returnedを返すだけで返還PASSとはしない。旧heldや既存depositBalanceをload時に同一化しない。

### BS負債の静的な未解決点

finance.js:511のeventはtenantDepositのliabilityEffectをrowに保持するが、同:519のapplyWorkingCapitalはtenant保証金用balanceを更新せず、同:529のBS otherLiabilitiesは固定0。受領cash増をdepositBalance由来の負債としてBS集計する処理はこの範囲では確認できない。したがってeventがwhole-yenでもfinance.validate合格は別途確認が必要。会計体系の追加変更は本インベントリ/丸めPRの権限と混同しない。端数処理と独立に残るなら専用concernとして扱い、受入をBLOCKEDと報告する。

## 賃料: 週次請求・未収・回収・滞納・減額

1. `real-estate-rent-pricing.js:12–18`の市場/募集/機会損失は設定・予測・分析。Cを適用して市場目安/分析額を決済に見せない。ensureによる募集見積の再評価は既存挙動で、実契約c.monthlyRent/deposit/arrearsのロード時整数化とは別。
2. `tenant-contracts:13/17`はquoteをそのまま新規契約へ保存する入口なので、新規合意rentをCする。`tenant-contracts:18`の自動更新、`tenant-renewals:11`の合意による更新も新しい契約額をCする。`getPropertyTenantRenewalOptions`は再計算される非決済forecastなので元の銭精度を維持し、実行writerへ値を流用しない。新賃料=C(oldRent*(1+rentChange))、差額を追加Cしない。増額/減額rateや合意確率は元精度。
3. `tenant-contracts:18`は毎週raw=`c.monthlyRent/4.345*occupancy`をCしてdue確定後、支払成功ならcash/collected累計/収益ledgerへ、missならarrears/missed累計だけへ同dueを使う。missはcash減額/finance receivable計上をしていない。未収stateをBS accountsReceivableと同一視しない。
4. `tenant-collections:11`は回収成功額=`min(C(arrears*(.35+recoveryRate)),storedArrears)`、due費用とreceiptを別決済。`tenant-collections:12`の分割回収は`min(C(max(1000,monthlyRent*.08)),storedArrears)`。paymentPlanBalance/arrears/cashの和差にCしない。**分割回収にはfinance.eventがない**ため、整数化だけでstate=ledger/会計整合を満たすとはしない。
5. default保証金充当は確定済残高同士の相殺。既存滞納額をCし直さない。arrearsRecoveryは現行profit+なので、未収発生時に勝手にrevenueを追加すると二重認識になる。
6. `rent-guarantee:11`の支払はrawEligible*coverageをC後に残保証枠cap（必要ならeligibleもcap）。claimedArrearsは元の滞納のスナップショットで、payoutでc.arrearsは減らない。保証後の滞納回収と保証金充当との経済的重複は既存モデルの確認事項であり、丸めだけで権利移転/消込の仕様を変更しない。
7. R3aのbase `real-estate.js:38`は別に賃料収入をpostする。active tenantがあってもskipする条件が同関数にはなく、tenant週次収入と併存し得る。どちらを止めるかは未承認の収益モデル変更。各額の整数化と、実ゲームで二重収益がないことの証明は分ける。

現範囲に独立の「rent rebate/滞納免除」をcash/ledgerへpostするAPIは確認できない。retention戦略の-3%は将来の契約賃料減額、concessionは一時支出。両者を同じ「減額の払戻し」にまとめない。

## 更新料・仲介手数料・原状回復・その他一時金

| 種別/入口 | 丸め時点 | 注意点 |
|---|---|---|
| startPropertyTenantListing | 定数plan.costは既に整数、cash差分のみ | marketing支出。各applicantへ配分する費用writerなし |
| approvePropertyTenantApplication | 契約月額×brokerRateのfeeをC、cash/contract/ledger同額 | nested sign受領depositは別取引。手数料不足時のrollbackとsave失敗は実装PRで確認 |
| offerPropertyTenantRenewal | 合意時concession=C(old monthlyRent*concessionMonths) | tenantRetention支出であり更新料収入ではない。否決なら支出0 |
| resolvePropertyTenantComplaints | complaint due=C(max(30000,rent*.2*complaintCount)) | 全額不足拒否、cash/ledger/履歴同額 |
| processRestoration | due=C(max(50000,buildingValue*severity*factor))、paidをcash cap | legacy端数cash cap後再丸め禁止。costDueとpaidを区別、現実装はrestorationProcessedで打切る |
| collectPropertyTenantArrears | action定額費用は整数、success回収を別C+cap | 費用と回収をnet一行にしない |
| rent guarantee premium | 週次raw rent*weeklyRateをC後cash cap | 満額premiumと実paidを区別。未払保証料負債の新設はしない |

この範囲に独立した更新料「収入」APIはない。更新料の追加・敷金から原状回復費の自動相殺・礼金・前受家賃などを新設する作業ではない。将来追加時は個別sourceと保存受領額に基づいて設計する。

## 複数テナントへの配分/按分（§4）

**現行9 coreにallocateYen必須となる多受取人配分はない。** ループは各契約の独立したweeklyDue/fee/paymentを別々に確定する。契約ごとにCすることは「一つの合計額を各テナントに配る」処理ではない。report:8のtotalsは集計、応募者の削除/追加は人数処理、market rent×倍率は単価設定であり配分ではない。

保証金applied+returned=storedHeldは、既に受領済みの残高に対するcapと残差（元値/派生値）。fee/interest等の未確定chargeを2つ独立切上げする問題とは区別し、allocateYenで旧保存heldを整数化しない。将来共益費の一括請求・修繕費の各契約負担・一括優遇枠等を配分するなら、総額C→`allocateYen(total,weights,stableContractIDs)`、stable ID昇順tie-breakが必要。現実装にないその仕様は追加しない。

## R3a/R3bの境界と静的リスク

| 場所（基準SHA行） | 担当提案 | 境界/未解決の確認事項 |
|---|---|---|
| real-estate.js:38 賃料/修繕/reserve/cash、40市場イベント | R3aが同ファイル内を移行 | R3bは再編集せず、tenant-contracts:18と別sourceであることを記録。二重収益の変更権限はない |
| real-estate.js:42 月額設定 | R3a側設定のまま | R3bの新規契約確定13/17でC、occupancy/market倍率を整数化しない |
| 物件簿価/取得/抵当/売却/固定資産/CIP | R3a | R3bは貸主本体の資産・debt・売却gainを丸めない |
| real-estate-property-disposals.js:24/36 | R3a | top-level g.tenantContractsを終了/occupancy判定に使用。一方R3b実契約はnested。実契約終了/保証金返還が自動完了するとは断言しない |
| real-estate-tenant-contracts.js全体 | R3b | 受領/週次請求/滞納/自動更新/返還を同時に整合 |
| real-estate-tenant-leasing.js全体 | R3b | marketing/brokerage/tenant退去由来のrestorationもR3b。物件本体の一般修繕R3a/R3cと区別 |
| real-estate-tenant-operations.js全体 | **R3b** | tenant service/complaint支出、満足度/retention。名称operationsでも物件本体/R3aではない |
| tenant-renewals/collections、rent-guarantee、security-deposits | R3b | 契約収支/保証料/受領保証金記録。未収/保証の消込体系を勝手に追加しない |
| rent-pricing/performanceと同glob UI | R3b inventoryに含む | 見積/分析/表示は現精度、必要なlexical exemptionだけ実装側で説明。UIのMath.roundをCしない |
| shared owner personal枝（g.properties） | ファイル所有に従いR3bで同時計算移行を提案 | 会社/個人口座・ledger分離維持。personal-real-estate-*.js専用カタログはR4でここでは触らない |
| finance.js:28 r/511 event/519 WC/529 BS | 共有基盤、R3bで一括変更不可 | rはR1後も銭。C済入力は同じ額でpost、old fractionalは§1.1。保証金BS課題をR3b整数化の成功として隠さない |
| real-estate-security-deposits-ui.js | 指定glob対象外の関連UI | coreの戻り値表示を読むだけ、必要性が生じたらClaudeが別途対象明記 |

追加静的リスク（再現試験/P0/P1認定は未実施）:

- leasing:23 / operations:19 / guarantee:12は `min(cash,due)`でcashが負なら支払額も負になる。stateは増cash/負累計になり、`paid>0`のpost条件から外れる。推奨の`max(0,cash)`はこの境界の具体的提案だが、丸めに無関係な挙動修正を黙って混載しない。Claudeが意図したcap修正として説明するか、別是正へ切り出す。
- collections:12は週次idempotency guardも持たない。繰り返し呼出し時の二重回収とledger欠落は別の問題。新規guardシナリオで整数だけを見て成功扱いしない。
- actual nested契約とtop-level参照の違いは売却/BS/portfolio表示境界にまたがる。新しいaliasや保存migrationを本文の提案だけで追加しない。R3a/Claudeへ引継ぐ。
- securityDepositHeldの設定/精算はdepositBalanceの受領/返還と別経路。whole-yen整数チェックが通っても「保存受領額の現金返還」を証明しない。

## 移行で期待値が動きそうなテスト（未実行）

全て`tests/`配下、assertionは固定MAIN SHAの実在行を照合。現fixtureが整数なら値が変わらない場合も含む。元々のcash/ledger/保存/RNG条件を弱めず、変わる値と原因を実装PRへ記録する。

| テスト名 | assertion行 | 移行による影響/保持条件 |
|---|---|---|
| real-estate-tenant-contracts-test.js | 8,9,10,11,12,13,14,15 | 9行のweeklyDue銭式→C、cash/Collected/Arrears、受領保証金、更新新rent。15行effect契約保持。13/14のdeterminism/保存も保持 |
| real-estate-tenant-leasing-test.js | 8,9,10,11,12,13 | brokerage/C、restoration due/cash cap、cash=before+deposit-fee、個人分離。incomeMultipleの銭精度は維持 |
| real-estate-tenant-operations-test.js | 8,9,10,11,12 | complaint cost/C、service cash cap。定額85000/8000は据置。satisfaction/renewalChanceは整数化しない |
| real-estate-tenant-renewals-test.js | 12,13 | 現在はsource static検査のみ、金額期待値assertionなし。新runtime/concession/減額ケースが必要、既存検査をruntime証拠としない |
| real-estate-tenant-collections-test.js | 6 | minified行のcash=before-5000+recovered、recovery cap/保存。payment-plan weekly/finance整合は現assertionで網羅しない |
| real-estate-rent-guarantee-test.js | 1 | 1物理行のpremium/payout定義、VM helper注入候補。現assertionは不等式/有限性のみ、cap末尾・負cash・財務一致を追加提案 |
| real-estate-security-deposits-test.js | 6,7 | 200000/150000/50000の整数例は据置、端数months/legacy精算を追加。ここはstub state g.realEstate、production nested保証金会計のPASSを証明しない |
| real-estate-rent-pricing-test.js | 23,24,25,26,27,28,29,30 | 25行見積Math.round(*100)/100は据置、askingRentRatio/applicant数/機会損失も維持。契約側Cをこの非決済期待値へ波及させない |
| real-estate-rent-performance-test.js | 13 | 分析0.9/漏出額/集計を据置、upstream請求値の変化はsourceから反映。rateを整数化しない |
| real-estate-foundation-test.js | 下記静的抽出表 | base賃料（R3a）との金額・口座分離・保存影響を区別 |
| canonical-property-disposition-test.js | 9,12,15,18,21,24,27,30 | 売却側R3aに渡す終了/債務/簿価。tenant返還をこのテストで網羅しているとしない |

以下は関連テストの実在assertion位置の静的抽出。全ての期待値を変更する指示ではなく、周辺金額/保存/再現性の再確認位置。テストの実行結果は未確認。

| テスト | 金額/会計/保存に関係するassertion行 | 注記 |
|---|---|---|
| `real-estate-foundation-test.js` | 13, 14, 25, 26, 27, 28, 31, 35, 36, 37, 41, 46, 50, 51, 52, 55, 57, 58, 78, 79 | R3a/R3c/他flowの差分と切分け |
| `real-estate-construction-in-progress-test.js` | 11, 13, 16, 17, 20, 23, 26, 29, 31, 33, 36, 39, 41 | R3a/R3c/他flowの差分と切分け |
| `real-estate-portfolio-dashboard-test.js` | 4, 12 | R3a/R3c/他flowの差分と切分け |
| `real-estate-property-disposals-test.js` | 4, 5 | R3a/R3c/他flowの差分と切分け |
| `real-estate-property-tax-ledger-test.js` | 56, 57, 58, 59, 60, 81, 83, 111, 123, 124, 137 | R3a/R3c/他flowの差分と切分け |
| `real-estate-complete-cycle-test.js` | 4, 8, 9, 10, 11, 12, 16, 20, 28, 29, 30, 31, 32, 33, 34, 35, 36 | R3a/R3c/他flowの差分と切分け |
| `real-estate-agency-credit-line-test.js` | 79, 80, 96, 115, 124, 142, 158, 176, 234, 235, 239, 240, 266 | R3a/R3c/他flowの差分と切分け |

ガード`tests/yen-ceiling-rounding-guard-test.js`とbaseline、transaction fingerprints等の変更はClaudeの実装PRで行う。純粋VMテスト（collections/guarantee/security/pricing/performance等）は共通economicOperationのstub/bindingを明示的に用意する必要があり得るが、共通ceilYenの複製で実テストから乖離させない。実装PRはaffected testsを選び、finance.validate/debt rollforward等を実行する。新旧境界でfixtureが動いたら、説明なくfingerprintを更新しない。

## SCENARIOSへ追加するガード案（全て未実装・未実行）

9 coreの入口を直接駆動し、新規ゲームwhole cash/whole bookから開始する。raw formula/master/requestだけにfractionを入れる。filterで重要な不正行を落とさず、sourceTypeごとの期待件数・API成功・非空rows・written stateをassertする。UI/見積/分析/率をstrict monetary stateへ含めない。owner=company/personalを別ケースにし、personalは会社ledger非増をassertする。

| 案 | 入口API | 端数の元データ位置 | 必須観測/会計の限界 |
|---|---|---|---|
| 新規契約保証金/週次成功 | engine.getPropertyTenantQuotes → signPropertyTenant、modules.realEstateTenantContracts.processWeek | g.propertiesのrentalEnabled物件p.realEstate.monthlyRent=10001.3、occupancy=.913、profile stable/growth、確定hashで成功週を探索 | 新規rent/deposit C、cash/保存deposit/受領ledger同額、週due C。BS保証金未反映は別gateで検出し隠さない |
| miss/保証金default充当 | modules.realEstateTenantContracts.processWeek | whole契約monthlyRentを使い /4.345*.913でraw fraction、missするcontractID/週をhashで探索 | miss時cash不変、dueとarrears/累計同額、3miss後applied≤deposit/arrears、cashless相殺 |
| 満額返還 | 同processWeek | 新規受領whole depositのまま、expiresWeek超過でrenewal hash否決、payment hash成功、十分なwhole cash | refund=stored balance（市場rentを別値に変えても不変）、cash/liabilityEffect同額、返還後deposit0 |
| 自動更新/戦略更新・減額 | processWeek; engine.getPropertyTenantRenewalOptions / offerPropertyTenantRenewal | whole monthlyRent=10001、strategy balanced/retention、satisfaction/renewalChanceで決定論的合意fixture | monthlyRent更新C、concession C、preview銭据置、否決はcash不変。+3%自動更新は別経路 |
| 募集/仲介/原状回復 | engine.startPropertyTenantListing / approvePropertyTenantApplication、modules.realEstateTenantLeasing.processWeek/processRestoration | whole新規contract.monthlyRent=10001とagency brokerRate=.5、p.realEstate.buildingValue=100000003.3は見積、cashをwhole 1等に設定 | fee C、restoration due C→cash cap、depositとfee別ledger、現金不足/nested rollback。incomeMultipleは非金額 |
| テナントservice/苦情 | engine.setPropertyTenantServicePlan / resolvePropertyTenantComplaints、modules.realEstateTenantOperations.processWeek | whole monthlyRent=200003とcomplaint count=2、whole cash=1/0、既存plan定額 | complaint cost C、service paid≤cash、serviceCostPaid同額。満足度/retentionは元精度、負cash case別途 |
| 通知回収/法的回収 | engine.getPropertyTenantCollectionOptions / collectPropertyTenantArrears | whole c.arrears=10001、rate=.18等既存ACTIONS、成功hash fixture | recovered=min(C(raw),arrears)、cash=before-cost+recovered、arrears差一致、expense/recovery別ledger、再実行拒否 |
| 分割滞納回収 | modules.realEstateTenantCollections.processWeek | whole c.monthlyRent=20003、arrears/paymentPlanBalance=5001 | payment C+arrears cap、cash増加とledger存在をassert。現実装eventなしなので会計gateは未達候補。繰返し同週caseも必要 |
| 保証料/保証残枠 | engine.setPropertyRentGuarantee / claimPropertyRentGuarantee、modules.realEstateRentGuarantee.processWeek | whole monthlyRent=10001、plan率=.011/coverage=.75、whole arrears、payoutTotalをlimit-1にfixture | premium C→cash cap、payout≤remainingLimit/eligible、同額ledger、claimedArrearsは元値、再請求拒否 |
| security target/精算 | engine.getPropertySecurityDepositPolicies / setPropertySecurityDeposit / settlePropertySecurityDeposit | whole monthlyRent=10001、premium months=.5、whole arrearsでcap | target C、held=applied+returned、累計保持。戻り値returnedをcash返還と誤ってassertしない。受領/返還canonical化決定前は実送金保証BLOCKED |
| 既存端数保証金/滞納/cash | 保存JSON→engine load/normalize→上記refund/settle/collect | consistent pre-R9 fixtureのdepositBalance=10.5、securityDepositHeld=10.5（別case）、arrears=4.3、fractional cash | loadで端数保持、applied元値cap/returned差分、state/ledgerを§1.1許容で照合。strict整数scenarioと別枠 |
| 旧sub-cent保存 | 同load/normalize、返還/充当 | book/cash/保証金10.504等を整合したlegacy fixture | state10.504保持、event10.50が許容内、round/Cで差を隠さない |
| pricing/performance/非金額保護 | engine.setPropertyAskingRent/getPropertyRentPricing/getRealEstateRentPerformance、modules.realEstateRentPricing.processWeek/realEstateRentPerformance.processWeek | 見積p.marketValue=10000003.3、ratio=.95、incomeMultiple/occupancyにfraction | 現金/ledgerのno-op、割合維持、解析snapshotはstrict整数対象外。lexical exemptionの狭さを確認 |
| R3a連携: base賃料と売却 | 実installed engine.updateParityWeekly/advanceWeekとsellProperty/settlePropertyDisposition（R3a後） | whole新規tenant契約、p.marketValue見積にfraction、actual nested契約を作る | 両賃料sourceの出現/合計cashとledger、売却後nested statusと保証金残額。既存挙動の二重収入/未精算を検出して別concern化 |

各ケースでfinance.validateを実際に呼び、借入を伴うR3a連携のみdebt rollforwardも照合する。既存保証金BS/分割回収ledger問題でvalidateが失敗する場合、rows filterや検証後のrebaseで隠さず、そのケースを受入BLOCKEDとして報告する。newGame後にinitial integer fixtureのopening booksを整えることと、失敗後に財務帳簿をリセットしてPASSにすることは区別する。

legacy caseは通常SCENARIOSのstrict integer loopにそのまま返さない。既存guardに明示的legacy経路を追加し、非空row/端数保持/state・ledger一致と会計gateをrun内でassertする設計をClaudeが行う。整数state/rowsを空にして合格件数だけ増やしてはならない。各ケース同seed2回のreceipt/stateを比較、RNG draw不要のhash選択、保存失敗rollbackやfresh hydrationは既存suiteの守備範囲も確認する。

## 1 PRか分割か

推奨は**2 PRを順次**。この文書PRは1本、以下はClaudeの将来実装PRの提案。契約§8のsub-row/fixture更新もClaudeが行う。

| 案 | ファイル/責務 | リスク |
|---|---|---|
| R3b-1（先行） | tenant-contracts、tenant-leasing、tenant-operations、tenant-renewals | 受領保証金→週請求→更新→返還、仲介・原状回復・serviceを同PRで整合。monthlyRentやdepositを後続が読むので最初にCを統一。BS保証金未反映/nested経路を先に確認 |
| R3b-2（後続） | tenant-collections、rent-guarantee、security-deposits、rent-pricing、rent-performance、必要なら対象UI（現時点は変更不要） | 回収/保証/敷金記録の重複、cash cap、計上欠落が高リスク。非決済helperと実決済を分ける。1の最新main後に着手、前半のwhole契約額を使う |

1 PRなら9coreのC/raw/残差を一度に整合でき中間混在が減るが、114金額判断行（表示/分析含む）と既存会計課題を一緒にレビューする負担が大きい。3 PR以上はdeposit/arrears/guaranteeの共有state境界が長く残り、guardの限定やbaseline残留の説明が増える。2 PRでも全R3b DONEを先取りせず、未移行のcallerは§3.5の移行混在として明記。BS/ledger等の既存課題が別concernなら必要な是正PRを先行し、それを「円切上げ2 PRに紛れ込ませた新会計機能」にしない。

## Claude / Ownerへの確認事項と次作業

1. ファイル所有に従いoperations/tenant由来restorationはR3b、base property rent/repair/loan/saleはR3aとする案。shared personal g.properties枝も同時計算移行、専用personal-real-estateはR4。契約§8と実装PR本文でこの境界を記録する。
2. tenantDepositのBS負債未反映、securityDepositHeldとdepositBalanceの実受領/返還canonical経路、collections分割回収のledger欠落は丸めだけでは会計合格を保証できない。専用是正の必要性を判断し、範囲外なら受入BLOCKEDを明記する。
3. negative cash時の支払capをmax(0,cash)に直す扱い、同週分割回収guard、保証後の債権消込、base+tenant二重収益、nested契約の売却終了の各既存挙動は静的リスクとして引継ぐ。実装/実行再現済P1と断言しない。
4. 新規合意額と単なるpreviewを区別し、quoteが保存/決済に直接転記される入口だけC。再計算するweekly tax/premium/renewal/security previewは現精度を維持する（#1094の税previewレビュー修正とも整合）。

NEXT TASK: ClaudeがR2d/R3a後の最新mainとの差分と上記会計境界を確認し、R3b-1から実装。守備範囲のテスト・guard SCENARIOS・期待値/fixture/契約§8を自身の実装PRで更新する。本書はOwner/Claude確認待ちでマージしない。

検証範囲: 14実在ファイルの静的読取り、finance/各API/同名stateの参照、テストassertionと契約の照合。ランタイム/guard/browserテストは未実行。push前text-safetyと文書表/参照/単一ファイルdiffの検査実績はPRへ記録する。Codex著者であり、同モデルのレビューを独立金融監査と呼ばない。
