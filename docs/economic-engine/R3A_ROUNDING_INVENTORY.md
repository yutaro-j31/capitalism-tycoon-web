# R3a 会社不動産・円単位切り上げ事前インベントリ

作成日: 2026-10-23 JST。状態: READ_ONLY / 文書のみ / 実装・テスト実行・マージなし。

MAIN SHA: `927419156996a64edda6d3ae1b4b4182d9e81546`。
以下の全ソース・assertion行番号はこの固定SHAのもの。minifiedな同一物理行に複数の金額があるため、**1金額判断/1表行**で分解する。同じ行番号の重複は意図的。金額行数は表のデータ行数であり、物理行数・finance.event件数ではない。getter、原値転記、残高初期化、履歴も含む。非金額は別表。

開始時にorigin/mainを取得し、AGENTS.md、CLAUDE.md、[契約書](YEN_CEILING_ROUNDING_CONTRACT.md) §1–§6/§8を読んだ。基準mainの§8ではR2b #1090/R2c #1092 DONE、R2d TODO。OPEN PR検索でR3aの重複文書/実装PRなし。Owner申告のClaudeによるR2d作業を妨げない。R2dが後でマージされても、この文書は上記SHAのインベントリとして読む。実装開始前に対象9ファイルとテストの差分を再照合する。

レビュー追補（2026-10-23）: 最新origin/mainを再取得して上記SHAと同一であることを確認。R2dは未マージで、対象9ファイル/テストの基準行番号は変わっていない。再レビューP2（税preview）とP3（償却assertion参照）を修正した。R3b静的調査で、実契約がg.realEstateDevelopment.tenantContractsにある一方disposals:24はg.tenantContractsを読むこと、tenantDepositのliabilityEffectがBSにそのまま反映されるわけではないことも確認した。本文の「tenant終了」はコード上のtop-level配列処理であり、nested実契約の終了/保証金精算完了を保証しない。finance.js:529のotherLiabilitiesは固定0なので、保証金の受入を含む会計合格は別途検証が必要。本書はそのPASSを主張しない。

## 適用規則と表の読み方

- `C(x)` = `economicOperation.ceilYen(x)`。負数も絶対値方向に切り上げ、浮動小数ノイズ許容、finite/safe envelopeは§2どおり。`Math.ceil`や先行の銭丸めは不可。既存`n`による入力coercionは必要なら維持する。
- 表の「round」は各ファイルの `Math.round(n(v)*100)/100`。「元値」は既存残高・既に確定した額をそのまま使用。「派生値」は和/差を再丸めしない。「変更なし」は非決済の時価/予測の現行精度等を維持する。非決済値は整数化の義務がない。
- 新規決済のみC。stateとledger全effectに同じ額を使う。capは `min(C(raw), cap)`、cashもcapなら `min(C(raw), balance, max(0,cash))`。残高や損益へCをかけない（§3.2–§3.5）。
- 計上先 `カテゴリ / sourceType` は**呼出時の文字列**。financeのalias正規化後カテゴリとは区別する。`—`は直接のfinance.eventなし。会社のBS現金/借入金/不動産/CIPはstateに従う。個人枝は会社ledgerを作らない。
- 本文の推奨はファイル単位のR3a所有（共用関数は個人枝も同時移行）、R3b/R3c/R8との明示的引継ぎを前提とする。未決の境界は末尾に集約。今回はその決定や契約書変更を行わない。

## `js/real-estate.js`

| 行番号 | 項目 | 現在の丸め | 計上先 | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 17 | 共用round定義 | 銭round | 下記全呼出し | 変更なし（一括置換不可） | 率/時価/個人/賃貸を分離し金額決済だけC |
| 23 | splitBase 総取得額 | Math.max/round | 初期land/buildingBookValue | 新規取得C(total)、保存済総額は元値 | §1.1、ロードと取得を区別 |
| 23 | splitBase 土地のみ | round(total) | landBookValue | 元値（新規は確定取得額） | 土地のみで再認識益を作らない |
| 23 | splitBase 土地建物の比率配分 | 両方round | landBookValue/buildingBookValue | allocateYen(total,weights,stable IDs) | 独立切上げで総額超過不可、§4多配分 |
| 24 | monthlyRent/repairReserve/lastIncome/lastExpense/lastNetIncome | n/max、なし | p.realEstate各既存額 | 元値 | ロードで端数を書き換えない |
| 24 | landBookValue/buildingBookValue/buildingOriginalCost | n/max、base fallback | 不動産BS簿価 | 元値、欠損fallbackは23行参照 | 保存済簿価の整数化禁止 |
| 24 | landValue/buildingValue/lastValuation | n/max | 時価state | 変更なし | 見積は対象外 |
| 25 | v4移行target/oldBook/delta | 各round | 土地簿価、建物簿価0 | 元値と派生値（C不可） | 旧バージョン補正を丸め移行にしない |
| 25 | companyAdjustment/priorPeriodAdjustments/landBasisMigrationV4Adjustment | 各round | finance.balances.priorPeriodAdjustments、移行履歴 | 派生値、既存値を再量子化しない | §1.1。既存v4補正の意味は維持、再丸めだけ分離 |
| 26 | loan.principal/outstandingPrincipal | n/max | realEstate.loans、借入残高 | 元値 | ロード正規化禁止 |
| 30 | land/building/total valuation | 各round | x.landValue/buildingValue、p.value | 変更なし | 時価は非決済 |
| 32 | 減価償却floorと週次額 | cap後round | 38行depreciationの入力 | 新規floor=C(originalCost*.2)、dep=min(C(rawSchedule),max(0,book-floor)) | capを後に。旧簿価/旧floorは保全、R1 convention照合 |
| 34 | securedOutstanding | sum、なし | 担保残高getter | 元値の和 | 残高読取り |
| 35 | gross担保評価とavailable | round、round(gross-used) | collateralCapacity getter | 変更なし（availableは派生値推奨） | 見積。47行の借入限度と矛盾させない |
| 36 | recordの賃料/費用/手取/時価転記 | なし | lastIncome/lastExpense/lastNetIncome/lastValuation、ledger | 元値 | 確定済row転記 |
| 37 | 担保ローンinterest/principal/payment | 部品別round、sum round | realEstate.loans、37行ledger | total=C(rawInterest+rawPrincipal)、interest=min(C(rawInterest),total)、principal=total-interest、残元本capを加味 | §4。満額払のみの現行挙動維持 |
| 37 | 担保ローン残高/現金/会社または個人Debt | 各round | cash、outstandingPrincipal、companyDebt/personalDebt | 派生値 | 支払後の端数保全 |
| 37 | 利息と元本ledger | roundした部品 | interestExpense / property-collateral-interest; debtRepayment / property-collateral-principal | 上記確定額（元値） | stateと同一額。失敗時payment=0維持 |
| 38 | 建物簿価減少 | round(book-dep) | buildingBookValue; depreciation / property-depreciation | 派生値、depは32行確定額 | 二重償却避けるhasFinanceBuildingAsset維持 |
| 38 | weeklyRent | round | revenue / property-rent、grossRent | ceilYen（R3b連携、同ファイル移行推奨） | 4.345等から端数発生 |
| 38 | maintenance/repairShock | 各round | maintenance / property-maintenance の費用入力 | 各ceilYen（R3c境界） | chargeを先に確定 |
| 38 | reserveUseとreserve積立 | min、round(reserve+rent*.03-use) | repairReserve | use=min(C(rawShock),storedReserve)、contribution=C(rent*.03)、残高は派生値 | 残高を丸めない。積立はcash外stateの既存意味維持 |
| 38 | cashRepair/expense/net | 各round | expense/netIncome、同rent/maintenance ledger | 派生値 | shock-use、maintenance+cashRepair、rent-expense |
| 38 | 会社/個人cash更新 | round | companyCash/personalCash | 派生値 | §3.5、個人別口座維持 |
| 40 | 市場イベントcost | round | maintenance / property-market-event、marketEvents.cost | ceilYen（R3c境界） | 請求額を一度確定 |
| 40 | イベントcash減額 | round | owner別cash | 派生値 | 残高再丸めなし |
| 42 | 設定monthlyRent | なし | realEstate.monthlyRent | 変更なし、R3bの契約決済時C | ここは賃料設定パラメータ |
| 44 | price/annualGross/annualNet/valuation/yields/capacity等metrics | なし、一部既存helper | getPropertyInvestmentMetrics | 変更なし（週次depのみ32行に追従） | 予測/表示。利回りを整数化しない |
| 47 | 旧borrowAgainstProperty principal | round(max(amount)) | loan principal; debtBorrowing / property-collateral-borrowing | ceilYen、capacity超過は拒否維持 | 後載complete-cycleが公開API上書き。旧経路もinventory対象 |
| 47 | 旧借入cash/debt | 各round | 会社/個人cash,debt | 派生値 | 同principal加算 |
| 48 | 旧repayPropertyLoan pay | round(min(balance,request,cash)) | debtRepayment / property-collateral-prepayment | min(C(request),storedBalance,cash) | cap後切上げ不可、Infinity fallback維持 |
| 48 | 旧返済cash/debt/outstandingPrincipal | 各round | 現金/借入残高 | 派生値 | 後載API上書きでも直接テストに注意 |
| 49 | 投資売却book/valuation | round(sum) | realEstate.salesの簿価/評価 | book=元値和、valuation=変更なし | 簿価と時価を区別 |
| 49 | 投資売却proceeds/landProceeds/buildingProceeds | 各round | sales履歴、sellPropertyへ委譲 | 決済proceedsはC、配分はallocateYen、委譲先実売却額を共用 | 現在は実売却と別計算。時価優先順の差を新仕様で隠さない |
| 49 | landGain/buildingGain/totalGain | 各round | sales履歴 | 派生値 | 保存済簿価から差引、損失もCしない |

## `js/real-estate-mortgage-refinancing.js`

| 行番号 | 項目 | 現在の丸め | 計上先 | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 6 | round/valueOf helper | 銭round/n | maxLTV計算元 | 金額呼出しを個別分類 | 保存残高へのC不可 |
| 14 | syncLoan balance/principal | round | finance.loans.outstandingPrincipal/principal | 元値 | property側とmirrorを同一値 |
| 16 | weeklyPrincipalPayment | round(min(balance,balance/remaining)) | finance.loans予定元本 | 派生値（週次総額/利息と同じ分割式） | 29行と不一致不可、現予測はinterest控除未反映 |
| 17 | mortgageBalance/PrincipalPaid/InterestPaid ensure | なし | 保存state | 元値 | ロード保持 |
| 20 | otherSecuredDebt | sum | 担保審査getter | 元値の和 | defaultedも維持 |
| 23 | quote old | round | 旧mortgageBalance読取り | 元値 | 負債消滅/増加禁止 |
| 23 | quote target/gross/fee | 各round | maxPrincipal/available、審査 | target=C(value*LTV)、gross=派生値、fee=C(target*feeRate) | 実行24行と同じ額を提示、LTV境界注意 |
| 24 | refinance target/old/gross/fee/net | 各round、一部差分 | mortgageBalance、新規cash/debt、履歴 | target/fee=C、old元値、gross/net派生値 | gross<fee/target<old拒否維持 |
| 27 | refinance cash/companyDebt、finance loan同期 | round | companyCash/companyDebt、mortgageBalance | 派生値/元値 | grossを負債、netを現金へ |
| 27 | tracked 借入/手数料post | なし（確定額） | propertyMortgageProceeds,propertyMortgageFee / propertyMortgage | 元値 | gross cash/+liability、fee cash/-profitの既存分離維持 |
| 27 | 旧off-book借換post | 同上 | propertyMortgageProceeds / property-mortgage; propertyMortgageFee / property-mortgage-fee | 元値 | net cashとcashless feeの旧会計を変えない |
| 28 | prepay requested/paid | requestedなし、min後round | propertyMortgagePrepayment / propertyMortgage または property-mortgage-prepayment | min(C(requested),storedBalance,max(0,cash)) | balance/cashが端数でも越えない |
| 28 | prepay cash/balance/principalPaid/companyDebt | 各round | 残高・累計・mirror | 派生値 | 累計も再丸めしない |
| 29 | raw scheduled principal/interest/due | 部品別round、合計round | mortgage週次支払 | rawP=min(B,B/max(1,weeks)); total=min(C(rawI+rawP),B+C(rawI)) | 先に総額、利息chargeを確定、元本cap |
| 29 | paid/interestPaid/principalPaid | min後roundを反復 | interestExpense, debtRepayment / propertyMortgage（旧はproperty-mortgage-payment） | paid=min(total,max(0,cash)); interestPaid=min(C(rawI),paid); principalPaid=paid-interestPaid | §4のcash cap例を満たす |
| 29 | cash/balance/interestPaid累計/principalPaid累計/companyDebt | 各round | state/finance loan mirror | 派生値 | 確定部品の同一額をstateとledgerへ |
| 29 | unpaidInterest | round(interest-interestPaid) | 32行元本組入の入力 | 派生値 | interestはC(rawI)、支払額との差 |
| 32 | 未払利息元本組入・companyDebt | 各round | interestExpense, debtBorrowing / propertyMortgage | 元値/派生値 | cash=0、費用と借入を同額計上、二重切上げなし |
| 32 | history.unpaid/balance | round(due-paid)、元値 | propertyMortgageHistory | 派生値/元値 | 返済額と整合 |

## `js/real-estate-property-disposals.js`

| 行番号 | 項目 | 現在の丸め | 計上先 | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 6 | round helper | 銭round | 以下全体 | 一括C不可 | 残高/簿価と決済を分離 |
| 7 | valueOf | なし | 売却評価入力 | 変更なし | 時価 |
| 12 | disposalExpectedPrice ensure | なし | 保存見積 | 元値 | ロード保持 |
| 14 | land/building/linkedBuildingBook/total | 各round | 不動産+固定資産の除却簿価 | 元値と和（再丸めなし） | §1.1、固定資産簿価をCするとBS破壊 |
| 15 | market/collateral/legacyBalance/total | 各round | 債務完済額の集計 | 元値の和 | defaultedも含む、旧off-book区別 |
| 20 | companyOffBookMortgageBalance | round(sum) | S1/S2保留判定 | 元値の和 | 端数を判定前に変更しない、tol維持 |
| 23 | postAssetSale/postDebtRepayment | なし | assetSale/debtRepayment、sourceTypeは32/30行 | 元値 | wrapperで再丸め不可 |
| 24 | disposeLifecycle | 直接金額なし | CIP除却、tenant終了、保険終了 | 変更なし、CIPは各writerの元値 | 保証金/前受金の精算はR3b、ここで自動消去しない |
| 25 | market/collateral paid | round(balance) | 会社/個人Debt、loan/mirrorゼロ | 元値 | 完済は保存された債務額 |
| 29 | tracked mortgage返済 | round(Debt-legacy) | companyDebt、mortgage/finance rowゼロ | 派生値 | off-bookはaggregateを減らさない |
| 30 | onBookSettled/debt.total post | round差分 | debtRepayment / property-disposition-debt | 派生値/元値 | cash=-total、liability=-onBookSettledは別額のまま |
| 31 | gross/fees | round | 売却決済入力 | 各ceilYen（feesは非負） | 初回決済、負のgross拒否を維持 |
| 31 | obligations/deficiency/debtPaid/residualDebt | 各round | 売却可否、強制売却分岐 | 派生値、debtPaidはmin(storedDebt,max(0,gross-fees)) | 残債capにC不可、不足強制売却throw維持 |
| 31 | forced defaulted allocated balance | min後round | market loan/finance mirror | 元値cap/派生値 | 未払債務を丸めて消さない、rollback維持 |
| 32 | cash更新 | round(cash+gross-fees-debtPaid) | 会社/個人cash | 派生値 | 現金再量子化禁止 |
| 32 | sale amount/profitEffect/assetEffect | round(gross-book.total) | assetSale / input.sourceType既定property-disposition | amount=gross、profit=gross-book、asset=-book（元値/派生値） | 売却損益をCしない |
| 32 | fixedAssetDisposals[].bookValue | round | 固定資産disposal metadata | 元値 | finance validatorと実簿価一致 |
| 32 | fees post | なし（確定額） | assetSale / property-disposition-fee | 元値 | cash/profit=-fees |
| 33 | 固定資産disposalBookValue/GainLoss、bookValue=0 | n/なし | fixedAssets、BS | 元値、負号、ゼロ | 履歴をCしない |
| 33 | result.net/gain/bookBasis/salePrice/fee/mortgage | net/gain round、他転記 | propertyDisposalHistory | 派生値/元値 | net=gross-fees-debt、gain=gross-fees-book |
| 33 | retainPropertyの簿価/建物額ゼロ | なし | property BS残高 | 変更なし | 実売却のゼロ化でありロード正規化ではない |
| 35 | sellProperty gross | round(value*.97) | settlePropertyDisposition sourceType=sellProperty | ceilYen | 実売却入口、通知Math.roundはUIのまま |
| 36 | price/fee/expectedNet quote | 各round | disposal preview | 変更なし（raw見積維持）、決済39/31でC | 見積を先に銭丸めし決済の原値を失わないようraw再計算/保持が必要 |
| 37 | disposalExpectedPrice 保存 | なし | 上場時見積 | 元値 | 約定価格か単なる見積か実装で統一、下記質問 |
| 38 | 取消disposalExpectedPrice=0 | なし | 見積state | 変更なし | 残高を整数化する操作ではない |
| 39 | delayed price/fees | 各round | 31行settlement | ceilYenを決済境界で一度、feesは確定grossからC | 保存価格が旧端数なら決済入力としてC可、簿価ではない |

## `js/real-estate-property-taxes.js`

| 行番号 | 項目 | 現在の丸め | 計上先 | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 6 | round/valueOf | 銭round/なし | 税試算/既存残高支払 | 用途別分離 | 残高全体のC不可 |
| 7 | propertyTaxAccrued/PaidTotal ensure | なし | 旧未払税/累計 | 元値 | 旧負債をロード時に変更しない |
| 11 | taxBasisOf | なし | development.propertyTaxBasis fallback value | 元値 | 簿価を先行丸めしない |
| 12 | weeklyAccrual preview | round | tax regime表示（非決済の週次予測） | 変更なし（現行の銭精度） | §1のforecast。実際の税額はdevelopment:23/31で別途Cして確定、previewは保存/転記しない |
| 14 | legacy tax amount | round(min(cash,accrued)) | propertyTaxPayment / property-tax-payment | min(max(0,cash),storedAccrued)（元値） | §1.1/§3.5、既存債務精算をCしない |
| 14 | cash/accrued/PaidTotal更新 | 各round | 現金/旧未払/累計 | 派生値 | 残高再丸め禁止 |
| 14 | payment ledger/history.remaining | なし | 上記カテゴリ、history | 元値 | 新規accrual/liabilityEffectを追加する移行ではない |

## `js/real-estate-development.js`

| 行番号 | 項目 | 現在の丸め | 計上先 | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 7 | round helper | 銭round | 全金額/進捗 | 個別分離 | 非金額progress含む |
| 8 | projects totalCost/paidCost、policies premiumPerWeek ensure | なし/n/clamp | CIP/保険保存state | 元値 | ロード端数保全 |
| 14 | CIP disposition wrapper | なし | assetSaleまたはotherNonOperating | 元値 | 15行の確定簿価を受ける |
| 15 | disposeCIP amount | round(paidCost) | assetSale / property-development-sale-disposal; otherNonOperating / property-development-write-off | 元値 | cash0、profit/asset=-storedCIP |
| 16 | settlePropertyProjects amount合計 | round反復 | 戻り値 | 派生値 | 個別CIPを再丸めしない |
| 17 | propertyTaxBasis | round(book/fallback) | 週/年税の課税元値 | 元値/和 | 簿価や課税前rawを丸めない |
| 23 | weeklyPropertyTax | round | 31行taxExpense/taxPayment入力 | ceilYen | 週次決済額 |
| 24 | annualPropertyTax | round | dashboard等の年額予測 | 変更なし（R3c表示境界） | 決済でない。既存テスト期待値は週額と区別 |
| 25 | totalCost | round(max(...)) | 新規project契約額 | ceilYen | 新規確定契約 |
| 25 | deposit | round(totalCost*.15) | capitalExpenditure / property-development、paidCost | min(C(totalCost*.15),totalCost) | 着手金はCIP資産、保証金負債ではない |
| 25 | cash/project paidCost/history amount | cash round、転記 | 会社/個人cash、CIP | 派生値/元値 | CIP取得額とcash同一 |
| 27 | premiumPerWeek 新規契約 | round | policiesの保険料 | ceilYen（本ファイルR3a、他保険はR3c） | 所有ファイル内の実支払入力 |
| 29 | remaining | round(totalCost-paidCost) | CIP未払予定額 | 派生値 | 保存済契約額を整数化しない |
| 29 | due | round(min(remaining,remaining/weeksLeft)) | capitalExpenditure / property-development | min(C(remaining/weeksLeft),remaining) | 末尾支払cap、cash不足ならpause維持 |
| 29 | cash/paidCost | 各round | 現金/CIP | 派生値 | 同一dueの増減 |
| 29 | completion buildingBookValue/bookValue | round(book+paidCost) | CIP→不動産簿価 | 元値加算 | 既計上資産の振替、追加切上げ禁止 |
| 29 | gain/buildingValue/p.value | gainなし、value各round | 非決済時価 | 変更なし | .92/.7の時価増分はBS原価でない |
| 30 | premium実支払 | round(stored premium) | insuranceExpense / property-insurance | 元値（新規契約27行でC） | 旧保存premiumは§1.1、既定契約額を再認識しない |
| 30 | premium cash | round | owner cash | 派生値 | 既存端数を保持 |
| 31 | tax/paid | weekly helper、min(cash,tax) | taxExpense / property-tax; taxPayment / property-tax-payment | tax=C(raw)、paid=min(tax,max(0,cash)) | cash cap後丸め禁止、expense/paymentは同paid |
| 31 | tax cash/shortfall | cash/shortfall各round | 現金/history/rows | 派生値 | 不足分の新負債計上を勝手に追加しない |

## `js/real-estate-price-negotiation.js`

| 行番号 | 項目 | 現在の丸め | 計上先 | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 14 | round helper | 銭round | cash/土地建物/確率 | 用途別分離 | 確率をCしない |
| 31 | offerPrice | Math.round(price*ratio) | quote、成立purchasePrice/bookValue | ceilYen（提示=約定額として固定） | 整数四捨五入も切上げへ |
| 44 | cash支払可否 | なし | owner別cash比較 | 確定offer元値 | 試算と実行同額 |
| 50 | declined.offerPrice | なし | 戻り値 | 元値 | 決裂時は金銭writeなし |
| 52 | cash減額 | round | companyCash/personalCash | 派生値 | 残高にround/C不可 |
| 53 | purchasePrice/bookValue | なし | 取得簿価 | 元値（確定offer） | 67行と同額 |
| 61 | priorTotal | なし | 既存土地建物比率計算 | 元値和 | 配分weights、旧簿価自体を整数化しない |
| 63 | landBookValue配分 | round(price*landRatio) | 新規取得土地簿価 | allocateYen(total,weights,stable IDs)の土地分 | 土地/建物はchargeでない、§4多配分 |
| 64 | buildingBookValue配分 | round(total-land) | 新規取得建物簿価 | allocateYenの建物分（総額との差と一致） | 二重切上げ禁止 |
| 65 | buildingOriginalCost | なし | 取得原価 | 元値 | 建物配分と一致 |
| 67 | assetPurchase post | なし | assetPurchase / negotiatePropertyPrice | 確定offer元値 | cash=-offer、asset=offer |
| 70 | accepted.offerPrice | なし | 戻り値 | 元値 | 同約定額 |

## `js/real-estate-complete-cycle.js`

| 行番号 | 項目 | 現在の丸め | 計上先 | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 7 | round helper | 銭round | 金額/率/指数共用 | 一括置換禁止 | not-moneyと見積を分離 |
| 36 | valueOf/annualNOI | なし/round | quote/vehicleの見積 | 変更なし | 非決済評価 |
| 38 | addFinanceLoan principal/outstanding | 転記 | finance.loans principal/outstandingPrincipal | 元値 | loan authoritative rowと一致 |
| 39 | syncFinanceLoan balance | 転記 | finance.loans outstandingPrincipal | 元値 | mirrorを別丸めしない |
| 40 | post wrapper | なし | debtBorrowing/debtRepayment/interestExpense/otherOperating / propertySecuredLoan | 元値 | caller確定額を全effectへ |
| 43 | quote principal | round(amount) | 44行loan origination入力 | ceilYen | 整数roundも含め決済額確定 |
| 43 | existingDebt | round(sum) | quote | 元値和 | 既存負債を変更しない |
| 43 | weeklyPayment | round(payment) | 借入時の予定支払額 | C(rawPayment)、実service式と揃える | settled schedule入力。他NOI/valueは見積 |
| 44 | borrow cash/debt | 各round | 会社/個人cash,debt; debtBorrowing / propertySecuredLoan | 派生値/確定principal元値 | 原本とmirror一致 |
| 50 | prepay pay | min(balance,round(request)) | debtRepayment / propertySecuredLoan | min(storedBalance,C(request))、cash不足拒否維持 | 残高cap後Cしない |
| 50 | prepay cash/balance/companyDebt/personalDebt | 各round | 現金/借入/mirror | 派生値 | defaulted/accountingTracked分岐維持 |
| 51 | refinance payoff | なし | old.balance完済 | 元値 | 既存残債をCしない |
| 51 | refinance fee/new principal | round(payoff*.015)、quote round | otherOperating / propertySecuredLoan; debtBorrowing / propertySecuredLoan | fee=C(rawFee)、新規principal=C(payoff+fee)、差分は明示 | 旧端数payoffで新借入との差額cashを隠さない |
| 51 | refi cash/debt/old.balanceゼロ | 各round/ゼロ | debtRepayment / propertySecuredLoan、state | 派生値/元値 | 借入額-payoff-feeを追跡 |
| 52 | initRivals cash/debt/portfolioValue | 整数リテラル | rivals state | 変更なし | 既に整数。R8との重複を避ける |
| 54 | raw pay/interest/principal/due | interest/principal/due各round | weeklyPayment、scheduled postings | interest=C(B*wr)、due=min(C(rawPay),B+interest)、principal=due-interest（非負保証） | §4、元本cap。cash不足の全額不払維持 |
| 54 | scheduled cash/balance/debt | 各round | debtRepayment,interestExpense / propertySecuredLoan | 派生値/上記確定額 | 支払と元利ledger総和を一致 |
| 54 | 満期balance=0 | なし | loan.balance/status、finance mirror | 変更なしは条件付き：端数/残元本が残らない最終dueを計算 | weeksRemaining=0だけで未払元本を消さない。既存問題は別是正扱い |
| 55 | rival spend | cap後round | rivals.cash | min(C(rawSpend),cash,他の硬い金額cap) | 本ファイル所有でR3a移行を提案、R8へ二重変更禁止 |
| 55 | rival acquisition portfolioValue+=spend*1.08 | なし | rivals.portfolioValue | 変更なし（時価） | NPCの時価まで決済金額化しない |
| 55 | rival renovation portfolioValue | round | rivals.portfolioValue | 変更なし（時価） | 同上 |
| 55 | rival sale/cash/portfolioValue | sale round、差引なし | rivals.cash、portfolioValue | sale=C(rawSale)、現金/評価減は派生値 | NPCの売却receiptは金銭writer |
| 56 | disaster grossLoss/recovery/netLoss | 各roundを独立計算 | otherOperating / realEstateDisasterEvent、events | gross=C(rawLoss)、recovery=min(C(gross*insured),gross)、net=gross-recovery | §4保険charge/残差を明示、gross=recovery+net |
| 56 | disaster cash | round(cash-net) | owner cash | 派生値 | 負現金許容、0 clamp追加禁止 |
| 57 | vehicle aggregate value | round(sum) | vehicles.value/history | 変更なし | 評価額/適格性。cash配当writerなし |
| 70 | personal generic repay requested | round(min(total,request)) | 拒否guard（支払なし） | R4で上流repayと同じC+cap、現R3aでは変更なし | guardだけ先行CはR4実支払と不一致 |
| 75 | unsecured residual | round(total-personalSecured) | 個人repay guard | 元値差分、R4で上記と同時 | 残債配分を整数化しない |

## `js/real-estate-redevelopment-projects.js`

| 行番号 | 項目 | 現在の丸め | 計上先 | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 6 | round helper/valueOf | 銭round/なし | 以下金額と時価 | 用途別分離 | 残高はCしない |
| 7 | redevelopmentCost/ValueGain/SpentTotal ensure | なし | 保存CIP/時価増分/累計 | 元値 | ロード保持 |
| 8 | CIP disposition wrapper | なし | assetSaleまたはotherNonOperating | 元値 | callerの簿価使用 |
| 9 | disposeCIP amount | round(storedCost) | assetSale / property-redevelopment-sale-disposal; otherNonOperating / property-redevelopment-write-off | 元値 | CIP原価にC不可、cash0 profit/asset=-cost |
| 11 | quote cost | round(value*costRate) | 12行CAPEX契約額 | ceilYen | 支出同額の提示 |
| 11 | quote valueGain/targetValue | 各round | 再開発後の時価予測 | 変更なし | 非決済推定 |
| 12 | cash/redevelopmentSpentTotal | 各round | cash/CIP累計 | 派生値 | 新規costだけC |
| 12 | redevelopmentCost、capex/history | quote転記 | capitalExpenditure / property-redevelopment-capex、state | 確定cost元値 | cash=-cost、asset=cost |
| 14 | gain/newValue/buildingValue/p.value | 各round | 非決済時価 | 変更なし | 時価gainは売却益ではない |
| 14 | cost/book/buildingBookValue | 各round | CIP→不動産簿価 | cost元値、book加算は派生値 | 二重認識/丸め禁止 |
| 14 | 完了時cost=0等 | ゼロ/転記 | CIPゼロ、履歴cost | 変更なし/元値 | 振替済資産の正当なゼロ化 |

## `js/real-estate-agency-credit-line.js`

| 行番号 | 項目 | 現在の丸め | 計上先 | 提案ルール | 理由 |
|---|---|---|---|---|---|
| 48 | CAP/CUSHION/REPAY_FLOOR | 整数定数/積 | credit枠/運転資金閾値 | 変更なし | 既に整数 |
| 49 | PER_STORE/MAX | 整数定数 | cushion計算 | 変更なし | 金額定数 |
| 52 | outstandingBalance | sum | finance.loans getter | 元値和 | 既存残債保持 |
| 55 | cushionFor | minと整数加算 | 会社必要資金見積 | 変更なし | 整数入力、店舗数は非金額 |
| 56 | repayFloorFor | 積 | 閾値 | 変更なし | 既に整数 |
| 58 | draw amount | finite/max、なし | 60–62行借入 | min(C(request),max(0,CAP-outstanding)) | 公開drawにも枠cap、serviceのminをCで超えない |
| 60 | draw cash/debt | 加算のみ | companyCash/companyDebt | 派生値（現状維持） | 同amount加算 |
| 61 | loan principal/outstanding、weeklyPrincipalPayment0 | 転記/ゼロ | finance.loans | 確定amount元値/変更なし | mirror一致 |
| 62 | borrowing ledger | なし | debtBorrowing / realEstateAgencyCreditLine | 確定amount元値 | cash/liability同額 |
| 66 | repay requested | finite/max、なし | 68行remaining | C(request)後に残債/available cash cap | 公開APIのcash超過防止。serviceはcash-repayFloorもcap |
| 68 | remaining/paid初期 | 転記/0 | 返済配分内部 | 元値 | 以降追加切上げしない |
| 71 | loan別pay | min(remaining,balance) | 残債取崩し | 元値cap | 既存端数ローンを越えない |
| 72 | outstandingPrincipal更新 | max(0,balance-pay) | loan残高 | 派生値（現状維持） | 再量子化なし |
| 73 | remaining/paid累積 | 和差のみ | 返済額合計 | 派生値（現状維持） | 配分総額一致 |
| 74 | <=.01の残高ゼロ化 | 閾値による切捨て | loan outstanding/status | 端数は元値保持、実際の完済時のみ0 | §1.1。未払0.004円の消失を禁止 |
| 77 | cash/debt返済 | 差分/max、なし | companyCash/companyDebt | 派生値（現状維持） | 同paid減算、ledgerと一致 |
| 79 | repayment ledger | なし | debtRepayment / realEstateAgencyCreditLine | 確定paid元値 | cash/liability=-paid |
| 85 | outstanding/cash読取り | finite/sum | service内部 | 元値 | 残高をCしない |
| 87 | room/need | max/min、なし | draw要求額 | room=CAP-storedOutstanding; need=min(C(cushion-cash),room) | 丸め後cap、drawで同額を保持 |
| 90 | auto repay要求額 | min(cash-floor,outstanding)、なし | repay入力 | min(C(rawRequest),cash-floor,storedOutstanding) | 下限を割らない。cap済額をrepayで再Cしない設計が必要 |

## 非金額の銭パターン・not-money候補（呼出しと定義を区別）

現在のliteral銭パターンはhelper定義行。呼出行へコメントを足すだけでは定義行をlexical guardから除外できない。下表は移行後の専用helper/inline化候補を含む。時価/予測は金額表に記載済みで、この表の件数には含めない。minified行全体への免除で同居するmoneyを見逃さないよう、行を分ける。

| ファイル | 行番号 | 非金額用途 | コメント/分離案 |
|---|---|---|---|
| `real-estate.js` | 17 | 混在round helper | `非金額専用rを分離して同じ行に /* not-money: occupancy and market multipliers */。混在helper全体を免除しない` |
| `real-estate.js` | 28 | demandMultiplier/rentMultiplier/landMultiplier | `/* not-money: market demand rent and land multipliers */` |
| `real-estate.js` | 38 | occupancy smoothing | `/* not-money: occupancy fraction */。金額と同一物理行を先に分割` |
| `real-estate-development.js` | 7 | 混在round helper | `/* not-money: project progress fraction */ は非金額helperだけ` |
| `real-estate-development.js` | 25 | deposit/totalCost progress | `/* not-money: development progress fraction */` |
| `real-estate-price-negotiation.js` | 14 | 混在round helper | `/* not-money: acceptance probability */ は確率専用helperだけ` |
| `real-estate-price-negotiation.js` | 32 | acceptanceChance | `/* not-money: negotiation acceptance probability */` |
| `real-estate-complete-cycle.js` | 7 | 混在round helper | `非金額専用rに分離、/* not-money: rates ratios and macro indices */` |
| `real-estate-complete-cycle.js` | 43 | rate/ltv/dscr | `/* not-money: annual rate LTV and DSCR ratios */` |
| `real-estate-complete-cycle.js` | 44 | spread | `/* not-money: annual interest spread */` |
| `real-estate-complete-cycle.js` | 53 | policyRate/inflation/landIndex/constructionIndex/rentIndex | `/* not-money: macro rates and price indices */` |
| `real-estate-complete-cycle.js` | 54 | variable rate | `/* not-money: annual variable interest rate */` |

## 行数集計

| ファイル | 金額判断行数 | not-money候補数 |
|---|---|---|
| `real-estate.js` | 35 | 3 |
| `real-estate-mortgage-refinancing.js` | 19 | 0 |
| `real-estate-property-disposals.js` | 26 | 0 |
| `real-estate-property-taxes.js` | 7 | 0 |
| `real-estate-development.js` | 21 | 2 |
| `real-estate-price-negotiation.js` | 12 | 2 |
| `real-estate-complete-cycle.js` | 27 | 5 |
| `real-estate-redevelopment-projects.js` | 11 | 0 |
| `real-estate-agency-credit-line.js` | 20 | 0 |
| 合計 | 178 | 12 |

## 個別に固定すべき会計上の扱い

### ローン元本と利息

`real-estate.js:37`（旧担保）、`real-estate-mortgage-refinancing.js:29`（住宅）、`real-estate-complete-cycle.js:54`（専門融資）は別サービス。住宅はpartial cash支払、他2つはcash不足なら全額不払という現行仕様を維持する。公開borrow/repayはcomplete-cycle:59が旧APIを上書きするが、旧担保ローン保存データはbase:37で引き続きサービスされる。公開APIテストだけで旧経路の網羅を主張しない。

推奨共通式（rawI/rawPは未丸め、Bは保存元本）:

1. 元金均等は `rawP=min(B,B/max(1,remaining))`、元利均等は既存のannuity式でrawTotalを出す。最終回は元本全額+rawIをrawTotalにする。
2. `I=C(rawI)`、`T=min(C(rawTotal), B+I)`。Iを先に計算しても、rawTotalをI+丸めたPから作らない。
3. 住宅は `paid=min(T,max(0,cash))`、利息charge=`min(I,paid)`、元本=`paid-charge`。他2経路はT全額を払える時だけ同じ分割。I>Tとなる境界でも元本負数を作らない。
4. 元本capを総額の側へ適用し、最後の元本を別途Cしない。例 rawTotal99.7/rawI12.3 → paid100/I13/P87。rawTotal1.2/rawI1.1/cash1 → paid1/I1/P0。
5. unpaidInterest=`I-interestPaid`は派生値。tracked住宅ではcashless interestExpenseとdebtBorrowingを同額postし、property/finance.loans/companyDebtへ同額追加する。旧off-bookとpersonalへこのtracked会計を拡張しない。

`syncLoan:16`のweeklyPrincipalPaymentも上と同じ総額・chargeから導出する。finance.js:536以降の13週予測は読取り専用の銭精度が残るので、実支払の整数化を予測helperの一括Cへ波及させない。残高/paid累計/loan mirrorは全て元値の和差。legacy sub-centは契約§1.1の既存tolerance内で照合する。

### 売却簿価と損益

新規gross/feeだけC。土地簿価・建物簿価・リンク固定資産簿価・CIP・既存残債は**元値**。canonicalBook:14をCで置き換えない。gross90 / fee2 / book100.5ならsale profit=-10.5、fee profit=-2、net gain=-12.5。売却損へCをかけない。fixedAssetDisposals metadataと実bookValueも同値。CIPの別行除却を既存property bookに二重加算しない。抵当完済cash額とon-book liability減額を区別し、legacy S1/S2隔離・不足強制売却throwを維持する。

土地/建物の取得・履歴配分はcharge/remainderではなく§4多配分なので`allocateYen`を使う。安定IDはproperty IDに`:land`/`:building`を付したキー等、PRで明示してtie-breakを固定する。旧端数保存値の単なる読取りにallocateYenは使わない。`sellPropertyInvestment`は独自にproceedsを計算してから`sellProperty`へ委譲するため、marketValue優先とx.landValue+x.buildingValue優先が異なるケースがある。丸め移行で別々の実売却額を確定させず、既存売却receiptを共用するか、非権威の参考履歴と明示する。別の会計不具合を修正する必要があればこのmigrationと混載せず相談する。

### 保証金・前受金・その他負債

- 9対象ファイルにはtenantDepositの受入/返還writerがない。`real-estate-property-disposals.js:24`はtenant statusをendedにするだけで、保証金返還・前受家賃の残高精算まで実装している証拠ではない。売却に合わせて負債を0にしたりgainへ取り込まない。
- R3bの`real-estate-tenant-contracts.js:10/17`にdepositBalanceの保存/受入（`tenantDeposit / property-tenant-deposit`, cash+・liability+）がある。同:18の充当/返還、`real-estate-security-deposits.js:7/10/11`のsecurityDepositHeld/Applied/Returned・arrearsはR3bで保全する。返還は保存額、充当は残高cap、残額は差分。securityDeposit系は別の追跡stateでありdepositBalanceと無条件に同じ負債とは仮定しない。
- 前受金/前受家賃の新規writerはこの9ファイルでは確認できない。存在しないフィールド/finance categoryを追加してはならない。R3bが実際のtenant契約・運営APIとBS liabilityの対応を確認する。旧保存値があればロード時にCしない。
- 開発着手金（development:25のdeposit）は支払済CIP資産。借主保証金の負債とは別物。会社の店舗/オフィス支払保証金（R2a/R2c）も借主側資産であり、R3b受取保証金と混ぜない。
- propertyTaxAccruedは旧未払で、property-taxes:14が保存額をcash capで払う。現行canonical weekly税はdevelopment:31のtaxExpense/taxPayment同額でfinance.balances.accruedTaxesを往復し、propertyTaxAccruedへ重複加算しない。
- mortgageBalance、realEstate.loans、realEstateMarket.loans、finance.loans、companyDebtの関係はtracked flagとsource familyごとに保全。credit lineの<=.01ゼロ化は旧端数残債を消すので、完済条件と同額postを確認する。

## 他スライス/共通基盤との境界

| 対象 | 所有/推奨 | 変更境界 |
|---|---|---|
| finance.js:28 r、finance.event、validate/statement/reconciliation | R1後も銭精度の共有normaliser | R3aで変更しない。Cした決済額をcallerが渡す。旧簿価処分は端数effectをそのまま渡す |
| economic-settlement.js roundMoney | 共通基盤/R9 | 一括C不可、R3a対象外 |
| real-estate.js:38/40/42の賃料/修繕/保険相当 | R3b/R3cの機能領域、§8ファイル所有はR3a | 推奨: このファイル内のmoney callerはR3aで全移行し、R3b/R3cはtenant/rent/insurance専用ファイルのみ。9ファイルのpartial DONEを避ける |
| development:27/30既存保険 | 同ファイルR3a、専用property-insurance/insurance-*はR3c | policy元値を保持、新規premiumをC。保険支払経路を統合しない |
| complete-cycle:55 NPC cash | ファイルR3a、NPC一括はR8 | この関数のcash決済のみ先行R3a、時価は除外、R8で重複修正しないことを記録 |
| 各9ファイルのowner personal枝 | §8 R3aの共用writer | 推奨: 同じ計算関数はR3aで会社/個人とも移行。会社ledgerへpersonalを流さない |
| personal-real-estate-*.js、personalRealEstateHoldings | R4 | ここでは編集しない。g.properties personal枝とは別カタログ |
| complete-cycle:70/75 generic personal repay guard | R4上流repayとの境界 | monetary guardの丸めはR4の支払式と同時変更するのが原則。R3a完了までに残すならpendingFiles残留理由とR4での除去を明示し、file全体DONEとは言わない |
| engine.js buyProperty/buildOnLand/sellProperty underlying | R4/R9等の未割当箇所も要照合 | R3a対象9ファイル外を勝手に編集しない。取得時にfraction bookを作る未移行writerがあればstrict whole-yen scenarioは直接の移行済入口/整数fixtureで構成し、全ゲーム保証はR9まで主張しない |
| finance.loansをgeneric repay/prepayから同期する既存基盤 | R1/R5、property-debt-principal-sync tests | specialist mirrorを別量子化しない、authoritative sourceの切替はしない |

non-money専用helperに銭精度を残す場合、§1対象外の時価/予測用途も正確に説明したcommentが必要。残高処理を含むhelper全体へnot-moneyを付けるのは禁止。未移行R3b/R4 callerをhelperに残す選択では、pendingFilesをまだ外せない（本書はbaselineを変更しない）。

## テスト期待値・fixtureへの影響（全て未実行）

下表は変更候補/保持すべきassertionの定義位置。失敗を確認したという意味ではない。既存整数fixtureでは数値が動かないものも含む。test sourceのliteral expectedをCへ置換するだけでなく、cap/parts conservation/state=ledgerを独立oracleで検証する。toleranceを広げず、skip/削除しない。

| テスト | assertion行（基準SHA） | 予想影響/対応 |
|---|---|---|
| real-estate-building-depreciation-test.js | 57（式56）、65、84/85（floor77）、132 | straight-line銭期待値→C+cap、最終floor、10週累計とnetYield。floorを新規/旧保存で区別 |
| real-estate-price-negotiation-test.js | 73、120/122/125/126/127、143–147 | Math.round提示額→C、取得簿価配分と総額、会社/個人同じ確定offer |
| real-estate-property-tax-ledger-test.js | 56/58、81/87（式78）、92/95/98/99、123、136–139、148 | 実支払81は週税C、preview87は式78の現行銭精度を維持して期待値を分離。年税/NOI予測は据置、旧未払5000は据置、netは差分 |
| p4-aud-007-option-a-mortgage-test.js | 57、124/125（式120）、127 | schedule principalがtotal-chargeへ、未払利息Cの資本化。debt/BS一致を維持 |
| real-estate-complete-cycle-test.js | 8–12、28–36 | 週次元利・借換fee・災害netの数値traceが動く。整数originationは不変、所有分離/BS/rollback不変 |
| real-estate-mortgage-refinancing-test.js | 4 | minifiedな週次cash/balance/interestPaid/prepayの定義、VMへeconomicOperation注入が必要 |
| real-estate-property-taxes-test.js | 5 | 旧5000精算/二重accrualなしは維持、VM helper binding調整が必要なら実装PRで |
| real-estate-redevelopment-projects-test.js | 5/6 | cost/SpentTotal/book transfer trace、元の整数例は変わらない可能性、VM helper binding |
| real-estate-property-disposals-test.js | 5 | quote/fees/net/cashと履歴。期待件数/tenant終了は維持、VM helper binding |
| canonical-property-disposition-test.js | 9/12/15/18/21/24/27/30 | 売却gross/feeのCとlegacy簿価そのまま。整数の現金差・拒否・rollbackは維持 |
| real-estate-development-test.js | 14/21–26/29/30/35 | deposit/due、完了週、保険料・税額、pause、保存同一性と再現性 |
| real-estate-agency-credit-line-test.js | 115/119/120/124、142/158、176/181、235/236 | draw/repay trace、capとrescue時cash。旧fractionだと厳密cushionへの一致が動く可能性、新規整数fixtureは維持 |
| property-mortgage-refinance-conservation-test.js | 101/104/105、113–117、131–134 | 整数借換は据置、端数feeの追加oracleが必要。save-fault/durable rollbackは維持 |
| p4-aud-009-shared-collateral-test.js | 35/37/38/40/41/45、54/56/57、64/65/67 | 切上げprincipalでLTV境界が変わり得る。既存担保残高を丸めない、拒否時無変更維持 |
| property-debt-principal-sync-test.js | 4/10/15/18/20 | generic返済後serviceの鏡残高/保存。整数返済は不変、次週charge変化を区別 |
| property-lifecycle-ledger-test.js | 81/83/98、134 | 再取得時book=paid、丸め累積で簿価不一致を隠さない |

追加の関係テストは次表で、**実ファイル内のassertion位置を静的抽出**した。金額/会計/traceまたはVM wiringの再確認候補で、全行の期待値書換えを指示するものではない。大量のassertionが同じminified行にある場合はその行を一度だけ列挙する。

| テストファイル（tests/配下） | 関係assertion行 | 確認対象 |
|---|---|---|
| `real-estate-foundation-test.js` | 25, 26, 27, 28, 31, 34, 35, 36, 37, 41, 49, 50, 51, 52, 55, 57, 58, 78, 79 | 金額派生・会計整合・保存/再現性 |
| `real-estate-land-book-classification-test.js` | 37, 41, 42, 43, 45, 48, 49, 50, 51, 57, 65, 67, 72, 74, 77, 78, 79, 87, 88, 89, 92, 102, 103, 125, 129, 130, 131, 132, 133, 134, 139, 142, 146, 160, 161, 166, 172 | 金額派生・会計整合・保存/再現性 |
| `real-estate-construction-in-progress-test.js` | 11, 13, 16, 17, 20, 23, 26, 29, 31, 33, 36, 39, 41 | 金額派生・会計整合・保存/再現性 |
| `real-estate-complete-cycle-draws-test.js` | 48, 49, 52 | 金額派生・会計整合・保存/再現性 |
| `real-estate-cycle-state-collision-test.js` | 33, 35, 36, 44, 45, 66, 87, 88, 89, 90, 91, 92, 93, 103, 104, 114, 125, 164, 187, 188, 189, 190 | 金額派生・会計整合・保存/再現性 |
| `real-estate-capex-roi-test.js` | 90, 91, 92, 94, 95, 97, 99, 103, 104, 105, 106, 107, 112, 113, 118, 122 | 金額派生・会計整合・保存/再現性 |
| `real-estate-capex-actuals-test.js` | 11, 12, 13, 14, 15 | 金額派生・会計整合・保存/再現性 |
| `real-estate-portfolio-dashboard-test.js` | 4, 10, 11, 12 | 金額派生・会計整合・保存/再現性 |
| `real-estate-insurance-claims-test.js` | 13, 14, 15, 16 | 金額派生・会計整合・保存/再現性 |
| `real-estate-insurance-risk-test.js` | 8, 9, 10, 11 | 金額派生・会計整合・保存/再現性 |
| `real-estate-risk-mitigation-test.js` | 8, 9, 10, 11, 12 | 金額派生・会計整合・保存/再現性 |
| `real-estate-tenant-contracts-test.js` | 8, 9, 10, 11, 12, 13, 14, 15 | 金額派生・会計整合・保存/再現性 |
| `real-estate-tenant-operations-test.js` | 8, 9, 10, 11, 12 | 金額派生・会計整合・保存/再現性 |
| `real-estate-security-deposits-test.js` | 6 | 金額派生・会計整合・保存/再現性 |
| `p4-aud-007-mortgage-disposal-debt-test.js` | 72, 75, 81, 111, 113, 114, 115, 118, 119, 120, 121, 123, 124, 125, 132, 133, 134, 135, 136, 139, 141, 146, 147, 149, 150, 151, 152, 156, 157, 158, 159, 166, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 180, 181, 186, 189, 190, 208, 211, 212, 213, 214, 216, 225, 234, 237, 238, 239 | 金額派生・会計整合・保存/再現性 |
| `p4-aud-007-mortgage-disposal-debt-webkit-test.js` | 113, 119 | 金額派生・会計整合・保存/再現性 |
| `property-mortgage-refinance-webkit-test.js` | 66 | 金額派生・会計整合・保存/再現性 |
| `property-debt-principal-sync-webkit-test.js` | 26, 28 | 金額派生・会計整合・保存/再現性 |
| `p4-aud-004-personal-secured-repayment-test.js` | 20, 23, 24, 25, 28, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 63, 64, 65, 73, 74, 75, 76, 77, 85, 89, 90, 92, 93, 94, 96, 97, 98, 99, 100, 102, 103, 104, 105, 106, 108, 109, 119, 120, 121, 122, 124, 125, 126, 144, 146, 147, 148, 149, 151, 153, 154 | R4境界: 個人保護/口座分離 |
| `p4-aud-004-personal-secured-repayment-webkit-test.js` | 65, 66, 67, 80, 89, 91, 92, 93, 95 | R4境界: 個人保護/口座分離 |

`tests/yen-ceiling-rounding-guard-test.js`はSCENARIOSとpendingFilesのratchet期待値が動くが、今回編集しない。既存のtransaction-baseline-v1.json等のfingerprint/金額/RNG call countも波及候補であり、未実行なので差分を確定しない。実装PRが実測値と原因を説明してからfixture更新する。statements/forecastの銭helperはテスト全体の整数化を理由に変更しない。

## 古いセーブの注意（契約§1.1）

- ensure/normalizeの呼出しだけで現金、土地建物簿価、loan balance、CIP、deposit、累計をC/銭丸めしない。特にbase:23/25の初期基礎とv4移行、mortgage:14/16のmirror同期、disposals:14/15/20、development:15/17、redevelopment:9/14が再丸めを隠しやすい。
- 旧B=10.5の完済は10.5、cash=10.5をcapにした支払は10.5。同額をstate/ledgerに使う。cashを0.01へ正規化し直すのも禁止。sub-cent10.504はfinance.eventの既存銭normalisationで10.50になり得るが、その差は既存toleranceで扱い、新たなC/拒否/補正で隠さない。
- 旧book100.5の売却ではassetEffect=-100.5とその差分損益。CIP paidCost/redevelopmentCostも保存額を除却/振替する。新たに契約したgross/fee/工事額はCするが、historical額の読取りを新規決済と誤認しない。
- credit-line:74のtiny balance切捨て、complete-cycle:54の満期ゼロ化は端数消失を生み得る。実装時に「返済として同額減った」ことを検証し、丸め変更に無関係な既存不具合なら別concernとして報告する。
- pre-R9 gameはstrict whole-yen保証対象外だがload/playとfinance.validate/debt rollforwardは引き続き必要。saveVersion9、SAVE_KEY、IndexedDB保存形式を変更しない。

## 推奨PR分割とリスク

推奨は**3 PR、順次実施**。契約§8が許すR3a-1〜3のsub-row化はClaudeの実装側で行い、本書では契約書を更新しない。

| 順序 | 内容/所有ファイル | リスクと合格境界 |
|---|---|---|
| R3a-1 | real-estate.js + real-estate-price-negotiation.js | 取得簿価配分/減価償却/旧担保/賃貸共用helperを分離。R3b/R3c共用のため最も広い。個人枝・非金額倍率・時価維持を直接確認。旧/実際のsell委譲の数値一致も観察 |
| R3a-2 | real-estate-mortgage-refinancing.js + real-estate-complete-cycle.js + real-estate-agency-credit-line.js | 元利split/未払利息資本化/担保共有/残高mirrorを1PR内で整合。R3a-1マージ後のmainをbaseにする。partial cash、満期、legacy tiny balance、R4 guardの境界が高リスク |
| R3a-3 | real-estate-development.js + real-estate-property-taxes.js + real-estate-property-disposals.js + real-estate-redevelopment-projects.js | CIP・税・売却時除却を一括検証。前2PRの確定額を受ける。旧簿価/旧債務処分、税二重計上、入居保証金精算の誤拡張が高リスク |

1 PRの利点は途中の新旧混在が短く、helper/guard/fixture/受入を一度に更新できること。欠点は178金額判断行、複数loan/CIP/売却/個人/NPCを一つのレビューで扱うため見落し・差分追跡・失敗切り分けの負担が大きい。2 PRなら取得/融資の前半と税/CIP/売却の後半だが、前半が広すぎる。3 PRを推すが、各最終HEADの必須CI/レビューと§8受入は省略しない。1 PR CI実行中のpush禁止、PRは同時更新せず順次。中間状態はR3a全体DONEではなく、§3.5の移行混在として扱う。

## guard SCENARIOS追加案（未実装・未実行）

既存guardのnewGame(seed)/rowsSinceを再利用。新規ゲーム側は**残高/簿価を整数で開始**し、raw formulaやrequest/master priceへfractionを注入する。得られたrowsが0件でPASSしないようカテゴリ/件数/API成功を先にassertし、written stateを明示的にreturnする。直接module関数の呼出しは全ゲームtickで他スライスを混ぜないためであり、公開API上書きの事実も別に検証する。

| シナリオ | 入口API | 端数を入れる元データ | チェックするstate/ledger |
|---|---|---|---|
| 新規交渉取得・土地建物配分 | engine.propertyPriceNegotiationOffers → negotiatePropertyPrice | g.propertiesのunowned p.price=10000001.3、既存整数land/building比率、合意するhashのID/週を探索（RNG消費なし） | offer=C(raw)、cash差/assetPurchase一致、配分合計=取得額、originalCost整数、確率は従来精度 |
| base償却の通常週/末尾 | modules.realEstate.processWeek(engine) | integer buildingOriginalCost=1000001、bookはinteger、raw weekly式にfraction発生。別fixtureはbook=floor+1、rental disabled | depreciation額=min(C(raw),remaining)、簿価下限/土地不変、二重fixedAsset償却なし |
| 旧担保loanの週次/繰上 | modules.realEstate.processLoans(engine,week); 旧prototype APIはisolated loadで別fixture | g.realEstate.loansにinteger元本1000001、interestRate=.0451、remainingWeeks=13。繰上request=1234.3 | property-collateral-interest/principalの和=payment、cash/debt/loan差一致 |
| 新規専門融資・返済・借換 | engine.borrowAgainstProperty / prepayRealEstateLoan / refinanceRealEstateLoan、modules.realEstateCompleteCycle.processLoans(g) | request=10000001.3、integer property value/rent、options.spread=.0251、termWeeks=53。返済request=1234.3 | propertySecuredLoanのprincipal/C、fee/C、元利和、mirrorとcompanyDebt一致。quote承認前提をassert |
| 専門loan最終回とdefaulted | modules.realEstateCompleteCycle.processLoans(g), engine.prepayRealEstateLoan | integer B/remaining=1のfixture、非整数raw利息率。別fixture status=defaulted | 最終P=Bで残高ゼロ、未払時不払、defaulted返済のみ減額、loans同期 |
| 住宅新規/借換 | engine.refinancePropertyMortgage | integer p.marketValue=10000003でtarget/feeに端数（未取得見積なら10000003.3も可）、p.mortgageBalance=0 | propertyMortgageProceeds/Fee、cash/debt/finance.loan同額、下方借換拒否 |
| 住宅partial cash・未払利息資本化 | modules.realEstateMortgageRefinancing.processWeek(engine) | integer B、rateはPRODUCTSの既存値、cash=1、remainingWeeksでrawPに端数。trackedフラグとfinance loanを整合 | 利息charge優先P0、paid=1、未払利息=I-paidがcashless expense/borrowing同額、mirror |
| 住宅繰上cap | engine.prepayPropertyMortgage | integer B=10、cash=5、request=4.3/5.3/12.3を別ゲーム | C(request)→cash/B cap、残高とPrincipalPaid累計、同額ledger |
| 開発着手・分割・末尾・取消 | engine.startPropertyDevelopment / cancelPropertyDevelopment、modules.realEstateDevelopment.processWeek(engine) | options.totalCost=100000.3、durationWeeks=7、integer開始cash/book | CAPEX=deposit/due、paidCost≤totalCost、CIP簿価移転は元値。取消write-off同額 |
| 再開発完了/取消/売却中断 | engine.startPropertyRedevelopment / cancelPropertyRedevelopment、modules.realEstateRedevelopmentProjects.processWeek | p.marketValue=10000003.3（見積）、integer簿価、refresh等既存rate | cost C、CIP/BS、SpentTotal、除却と振替の二重計上なし、時価は整数assert対象外 |
| 税の週次/cash cap/旧未払 | modules.realEstateDevelopment.processWeek、engine.payPropertyTax | integer landBookValue=10000003からraw週税fraction、cash=1。旧未払は別legacy case | taxExpense/taxPayment同paid、accruedTaxes net0、shortfall派生、tax regime二重accrualなし |
| 即時/遅延売却 | engine.settlePropertyDisposition / sellProperty / listPropertyForDisposal + modules.realEstatePropertyDisposals.processWeek | integer book、input.grossSalePrice=90000000.3/fees=2000000.3、integer linked asset/secured debts | assetSale gross/fees C、assetEffect元book、net/gain派生、債務rowとmirror完済 |
| credit draw cap/repay/多loan | modules.realEstateAgencyCreditLine.draw / repay / service | draw/repay request=1234.3、整数loan balance/cashを初期化。serviceはeligible open realEstateAgency storeを用意 | CAP越えなし、cash/debt/loan/ledger一致、loan別cap、cushion下限、no bankFinancing mutation |
| 同ファイル賃貸/修繕/保険（境界採用時） | modules.realEstate.processWeek/processMarketWeek; engine.buyPropertyInsurance + modules.realEstateDevelopment.processWeek | monthlyRent=10000.3、整額簿価/残高、既存hashからrepair/week条件を決定、premiumPerWeek=1000.3 | rent/maintenance/market-event/insurance rowsとcash/reserve、occupancyは整数assertしない |
| NPC receipt/災害loss（境界採用時） | modules.realEstateCompleteCycle.processRivals/processEvent | rivals整数cash/時価+macro.landIndex=100.13、p.marketValue=10000003.3、既存seed/週で発火 | settled cash spend/sale、gross=recovery+net、realEstateDisasterEvent netのみpost。NPC時価は除外 |
| legacy fractional cap + disposal | JSON保存→engine load/normalize→prepayPropertyMortgage/payPropertyTax→settlePropertyDisposition | cash/debt/mortgage=10.5、book=100.5、CIP=12.5等を整合した旧fixture。sub-cent10.504は別fixture | ロード前後端数保持、cap=10.5、book除却fraction維持、finance.validateとdebt rollforward。strict整数returnとは別枠 |

最後のlegacyケースを通常SCENARIOSのstrict whole-yen row/state loopへそのまま渡してはならない。専用legacyチェックをguardに追加するか、整数チェック対象のrows/stateを空にする場合もrun内で**非空取引件数・端数保存・state/ledger差とfinance.validateを明示assert**し、legacyについてwhole-yen PASSと表示しない。cent保存例とsub-cent tolerance例を分ける。各新規ケースもrowsだけでなくcompanyCash/companyDebt/loan balances/paidCost等のwritten stateを返し、finance.validate/debtRollforwardStatusを呼び、同seed2回の同値を確かめる。今回はいずれも実装/実行していない。

## Claude / Ownerへの未決事項と次作業

1. 推奨境界（9ファイルの共用personal枝・賃貸/修繕・NPC cashもR3a内で移行し、専用R3b/R3c/R4/R8ファイルは触らない）をClaudeの実装PRで明記する。個人generic repay guard:70/75だけはR4上流の実支払精度と照合し、R3aでraw差分へ直すか、pending残留を許すsub-rowにするかを決める。どちらも本書が承認済みとはしない。
2. 遅延売却のdisposalExpectedPriceは保存された見積か約定額か。前者なら銭previewをCの原値にしないようraw見積を保持/再計算、後者ならlist時Cで約定してsettleで元値を使う。どの時点で確定するか、既存ID/日付/値の意味を保って選ぶ。
3. 新規建物floorはR1の新規salvage C conventionを再利用、旧簿価は保持。旧floorを都度新規整数化することで既存資産の償却残高を作り替えないよう実装方針を決める。
4. sellPropertyInvestmentの参考履歴とcanonical売却receiptの不一致、loan満期残債/tiny debt零化は静的リスクであり、実行再現済P1との主張ではない。最小の丸め修正で収まらない場合は別concernへ切り出す。

NEXT TASK: ClaudeがR2d最終mainを取得し、上記境界と原値/決済時点を決めてR3a-1を実装。各sub-sliceでガードscenario/fixture/契約§8と期待値を自身のPRで更新し、必須受入/CI/reviewを実施する。本書PRはOwner確認用にOPENのまま、マージしない。

検証範囲: 全9ファイルの静的読取り、契約・関係assertion・API/ロード上書きの照合。実ゲーム・focused suite・browser・guardの実行はしていない。push前のtext-safety-checkと文書参照/表/差分検査のみ別途PRに実績を記録する。
