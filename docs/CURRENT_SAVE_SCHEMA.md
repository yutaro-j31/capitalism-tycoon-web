# 現行セーブスキーマ調査

監査日: 2026-07-14
前提: 現在の保存キーは変更しない。

## localStorage 保存キー

- メイン保存キー: `capitalism_tycoon_web_v1`
- セーブスロット: `capitalism_tycoon_web_v1_slot_1`, `capitalism_tycoon_web_v1_slot_2`, `capitalism_tycoon_web_v1_slot_3`
- JSONバックアップ: `JSON.stringify(this.g)` を Blob 化してダウンロードする。読み込み時は JSON をパースして `this.g` にマージする。

## 保存・読込処理

| 処理 | 関数 | 内容 |
|---|---|---|
| 起動読込 | `TycoonEngine.load()` | メインキーを読み、JSON parse。失敗時は新規状態。 |
| 正規化 | `normalize()` + `ensureExpansionDefaults()` + `ensureCompletionDefaults()` + `ensureParityDefaults()` | `saveVersion` 更新、主要配列の切り詰め、欠落トップレベル項目追加。 |
| 保存 | `save(slot=null)` | `lastSaveDate` 更新後、メインキーまたはスロットキーへ `JSON.stringify(this.g)`。 |
| スロット読込 | `loadSlot(slot)` | スロットキーから読み、`mergeDefaults` と `normalize` 後にメインキーへ保存。 |
| JSON書き出し | `exportSave()` | `this.g` を JSON Blob として返す。 |
| JSON読み込み | `importSave(text)` | `week` を持つオブジェクトかだけ検証し、`mergeDefaults` + `normalize` + 保存。 |
| リセット | `reset()` | 新規状態へ戻すが `settings` は引き継ぐ。 |
| 新規開始 | `configure()` | 新規状態を生成し、難易度補正。拡張ラップが創業者/承継初期値も追加。 |

## メインゲーム状態トップレベル項目

`createInitialState` で確認できるトップレベル項目:

- バージョン/時間: `saveVersion`, `week`, `month`, `lastSaveDate`
- プレイヤー/会社: `playerName`, `companyName`, `ticker`, `configured`, `difficulty`, `scenario`
- マクロ: `economy`, `season`, `policyRate`, `realEstateCycle`, `inflation`, `exchangeRate`, `macroCrisis`
- 会社財務: `companyCash`, `companyDebt`, `companyCredit`, `companyReputation`
- 個人財務: `personalCash`, `personalDebt`, `personalFame`
- 上場/株主: `publicCompany`, `sharesOut`, `founderShares`, `stockPrice`, `dividendPerShare`, `treasuryBuybackShares`, `selectedListingMarket`, `externalShareholderRatio`, `founderOwnershipRatio`, `competitorOwnedRatio`
- UI選択: `selectedArea`, `selectedPref`, `selectedBusiness`, `selectedTab`
- マスター複製/運用データ: `businesses`, `areas`, `prefs`, `stores`, `properties`, `tenants`, `rentalOffices`, `market`, `startups`, `competitors`
- 組織: `executives`, `executiveMarket`, `departments`, `departmentStaff`, `officeFloors`, `hasHeadOffice`, `officeLevel`, `officeName`, `officePrestige`, `officeCapacity`, `officeWeeklyCost`, `contractedOfficeID`, `boardEstablished`, `boardAgendas`, `investorOffers`
- 投資: `personalStocks`, `companyStocks`, `favoriteStockIds`, `realizedCompanyStockPL`, `realizedPersonalStockPL`, `subsidiaries`, `acquisitionTargets`, `maSubsidiaries`, `goodwillRecords`, `tenderOffers`, `totalAcquisitions`, `totalMAGain`, `totalImpairmentLoss`
- 商品/新規事業: `productVentures`, `productBuyoutOffers`, `productExitCount`
- FC/海外/資産: `franchiseStoresByBusinessID`, `franchiseRoyaltyRateByBusinessID`, `franchiseQualityByBusinessID`, `franchiseTrustByBusinessID`, `overseasSubsidiaries`, `personalInvestments`, `luxuryAssets`, `sportsTeams`, `peDeals`
- CXO/施策: `cxoExecutives`, `executiveDirectives`, `departmentCampaigns`, `internalVentureProposals`, `internalVentures`
- 従業員/文化: `employeeSatisfaction`, `employeeAbility`, `wageLevel`, `benefitLevel`, `remoteWorkEnabled`, `organizationCulture`
- 自動化/ESG: `autoManage`, `autoManageStyle`, `autoExecutiveManagementEnabled`, `esgScore`, `complianceLevel`, `globalPrestige`
- 創業者/承継基礎: `founderAge`, `founderGeneration`
- 支払予定: `scheduledPayments`
- レポート/履歴: `reports`, `lastReport`, `weeklySalesHistory`, `weeklyProfitHistory`, `companyValueHistory`, `personalNetWorthHistory`, `news`, `history`, `competitorEvents`, `productEvents`, `lastWeeklySummary`
- ミッション/実績/終了: `activeMissionIDs`, `completedMissionIDs`, `achievements`, `unlockedEndings`, `gameOver`, `gameOverReason`, `isCompanySold`, `hasSeenCompanyBuyoutEnding`
- 設定: `settings`

## 拡張により補完される主な項目

`ensureExpansionDefaults`, `ensureCompletionDefaults`, `ensureParityDefaults` で補完される主な項目:

- 創業者: `founderName`, `founderHomePrefID`, `founderHomePrefName`, `founderOriginCityName`, `founderTraitID`, `founderFocus`, `founderEnergy`, `founderSkillBusiness`, `founderSkillTech`, `founderSkillFinance`, `founderSkillNegotiation`, `founderHealth`, `founderEducationLevel`, `founderNetworkLevel`, `founderHomeLevel`, `founderHomeDeskSlots`, `founderHomeUsedSlots`, `founderHomeActionLog`, `localReputationByPref`, `recommendedTenantIDsFromHomeSearch`
- サプライチェーン: `supplierContracts`, `verticalIntegrationAssets`, `inventoryByBusinessID`, `supplyChainEvents`, `autoSpotProcurement`, `marketShareByBusinessID`, `customerSegmentsByBusinessID`
- R&D/商品: `rdProjects`, `patentRecords`, `patentLicenseIncome`, `productFunnels`, `productFunnelEventLog`
- 資本市場: `stockSplitHistory`, `ownershipHistory`, `activistCampaigns`, `shareholderTrust`, `shareholderEventLog`, `quarterlyStockResults`, `startupFundingHistory`, `startupQuarterlyReports`
- 個人拡張資産: `angelInvestments`, `personalRealEstateHoldings`, `familyTrustEstablished`, `familyTrustCash`, `familyTrustShares`, `foundationEndowment`, `foundationReputation`, `lobbyInfluence`
- メディア/イベント: `weeklyNewspaper`, `majorBusinessNews`, `ventureForumEvents`, `luxuryAuctionListings`
- 承継/記録: `successorCandidate`, `successorReadiness`, `legacyScore`, `endingRecords`, `hallOfRecords`, `pastCompanyRecords`, `currentCompanySerial`, `serialCompanyCount`, `currentCompanyFoundedWeek`, `lastNewCompanyFoundingWeek`
- 完成度補完: `branchOffices`, `employeeComplaintLog`, `inboundBuyoutOffers`, `transportRebuildPlans`, `sportsDraftCandidates`, `sportsSaleOffers`, `lastSportsMarketWeek`
- パリティ/助言: `keyPersonnel`, `advisorDismissedActionIDs`, `advisorLastGeneratedWeek`, `advisorActionHistory`, `competitorStates`, `lastParityUpdateWeek`

## 主要配列/オブジェクト構造

- `stores[]`: `id`, `businessID`, `prefID`, `tenantID`, `name`, `openedWeek/openingWeek`, `status`, `weeksToOpen`, `lastSales`, `lastProfit`, `condition`, `operatingHours`。
- `businesses[]`: `id`, `name`, `price`, `unitCost`, `demand`, `quality`, `brand`, `efficiency`, `dx`, `storeCost`, `fixedCost`, `wage`, `segmentFit`。
- `market[]`: `id`, `name`, `sector`, `price`, `previous`, `priceHistory`, `issuedShares`, `dividendYield`, `dividendPerShare` など。
- `companyStocks` / `personalStocks`: `{ [stockID]: { qty, avg } }`。
- `productVentures[]`: `id`, `blueprintID`, `name`, `category`, `status`, `progress`, `weeksToLaunch`, `quality`, `brand`, `users`, `paidUsers`, `price`, `serverCost`, `market`, `risk`, `valuation`, `revenue`, `cost`, `profit`, `origin`。
- `productFunnels`: `{ [productID]: { productID, awareness, registeredUsers, monthlyActiveUsers, paidUsers, conversionRate, churnRate, arpu, serverLoad, supportBurden, b2bContracts, lastUpdatedWeek } }`。
- `subsidiaries[]`: スタートアップ子会社。`id`, `name`, `valuation`, `ownership`, `weeklyProfit`, `retainedEarnings`, `status`, `publicCompany` など。
- `maSubsidiaries[]`: M&A子会社。`id`, `name`, `industry/domain`, `valuation`, `sales`, `operatingProfit`, `growth`, `risk`, `acquisitionPrice`, `retainedEarnings`, `status`。
- `properties[]`: `id`, `prefID`, `name`, `kind`, `basePrice/value/price`, `rentIncome`, `depreciationPerWeek`, `owner`, `constructionWeeksRemaining`, `buildingType`。
- `supplierContracts[]`: 契約テンプレート + `contractID`, `businessID`, `active`, `startedWeek`。
- `inventoryByBusinessID`: `{ [businessID]: { units, targetWeeks, lastDemandUnits, lastProcurementCost, disruptionWeeks } }`。
- `rdProjects[]`: 研究テンプレート + `projectID`, `progress`, `status`, `startedWeek`。
- `patentRecords[]`: `id`, `projectID`, `name`, `field`, `effect`, `strength`, `licenseIncome`, `licensed`, `completedWeek`。
- `reports[]`: `week`, `sales`, `expenses`, `rentIncome`, `stockIncome`, `interest`, `dividend`, `officeCost`, `profit`, `investmentPL`, `companyStockUnrealizedPL`, `propertyDepreciation`, `tax`。

## 初期値と必須項目

必須とみなすべき項目:

- 時間: `week`, `month`
- 会社/個人現金: `companyCash`, `personalCash`
- 基礎配列: `businesses`, `areas`, `prefs`, `stores`, `market`, `news`, `history`, `reports`
- 設定: `settings`
- UI: `selectedTab`, `selectedPref`, `selectedBusiness`

`importSave` は `week` の存在しか形式チェックしないため、実運用では上記が欠落しても `mergeDefaults` と `normalize` に依存する。

## 欠落しても補完される項目

- トップレベルの欠落は `mergeDefaults(parsed, createInitialState())` で補完される。
- 主要履歴配列は `normalize` で配列化または切り詰めされる。
- 拡張項目は各 `ensure*Defaults` で補完される。
- `stores` の基本フィールドは `normalize` の map で補完される。
- `businesses` と `market` の一部数値は `finite` で補正される。

## 補完されにくい項目

- 配列要素内部の詳細スキーマ。例: 古い `productVentures[]` の要素に `serverCapacity`, `origin`, `risk` がない場合。
- `companyStocks[stockID]` の `qty`, `avg`。
- `properties[]` の `owner`, `depreciationPerWeek`, `constructionWeeksRemaining`。
- M&A/子会社/スポーツ/個人拡張資産の要素内部。

## 保存対象外の一時状態

- UI用の `ui` オブジェクト: `officeTab`, `assetTab`, `strategyTab`, `reportMetric`, `showSetup` など。
- DOM、モーダル、トースト状態。
- チャート描画状態。
- ダウンロード用 Object URL。

## 破損しやすい項目

1. `productVentures` と `productFunnels` の同期。
2. `stores` と `tenants.occupiedBy` の同期。
3. `companyStocks/personalStocks` と `market` の銘柄ID同期。
4. `subsidiaries`, `maSubsidiaries`, `goodwillRecords` の整合。
5. `currentCompanySerial` など再起業引き継ぎ項目。
6. `lastReport` と `reports[]` の後段拡張による上書き。
7. `sportsTeams` の基本更新と拡張更新の二重責務。

## NaN / Infinity / 循環参照

- 循環参照: 現状はプレーンオブジェクト中心で発生しにくい。
- 非有限数値: `finite()` を使う箇所はあるが、全項目ではない。株数、平均単価、持分、評価額、手入力金額、旧セーブ要素で NaN/Infinity が入り得る。
- `JSON.stringify` は `NaN`/`Infinity` を `null` にするため、次回読込時の補完対象外項目では不具合化する可能性がある。

## セーブデータ肥大化の原因

- `reports`, `news`, `history`, 各種イベントログ、株価履歴、四半期履歴、商品ファネル履歴。
- 多数店舗、全都道府県プロパティ、テナント、マーケット配列を丸ごと保存している点。
- マスターデータに近い `businesses`, `areas`, `prefs`, `market`, `startups`, `rentalOffices`, `tenants`, `properties` も保存対象であり、差分保存ではない。

## 既存セーブ互換性を維持する注意事項

- `SAVE_KEY` は絶対に変更しない。
- 新機能はトップレベルに安全な初期値を追加し、`ensure*Defaults` で補完する。
- 配列要素のスキーマ変更時は、要素単位マイグレーションを追加する。
- 保存値の意味を変えない。例: `companyCash` を現金以外に使わない。
- 旧セーブ、新規ゲーム、スロット読込、JSON読込を必ず個別に確認する。
- 大型リファクタでは、保存前後の JSON deep diff を取り、意図しない消失がないことを確認する。

## saveVersion / マイグレーション方針

- 現在は `SAVE_VERSION = 2`。
- `migrateSave(rawState)` が `unversioned -> v1 -> v2` の段階変換、トップレベル補完、配列要素内部補完、検証を担当する。
- 将来は `SAVE_VERSION` を1ずつ増やし、`migrateV2ToV3` のような関数を順番に追加する。
- `normalize()` は既存の最終補正として維持し、保存値の意味を変える変更はバージョン付きマイグレーションへ分離する。
  5. マイグレーションは冪等にし、途中失敗時は元JSONを破壊しない。
- 推奨マイグレーション単位:
  - v2: 配列要素スキーマ補完。
  - v3: マスターデータ差分保存への準備。
  - v4: 財務諸表導入に伴う会計項目追加。

## Phase 0 save migration update (2026-07-14)

- 現在の明示的スキーマ版は `saveVersion: 2`。
- `saveVersion` 未設定のセーブは `unversioned legacy` として扱い、`unversioned -> v1 -> v2` の順で変換する。
- `SAVE_KEY` は引き続き `capitalism_tycoon_web_v1`。
- 復元は `migrateSave()` が担当し、トップレベルの `mergeDefaults()` 後に `deepNormalizeState()` で主要配列の要素内部を補完する。
- 対象配列には `stores`, `businesses`, `properties`, `tenants`, `rentalOffices`, `market`, `startups`, `executiveMarket`, `competitors`, `subsidiaries`, `acquisitionTargets`, `maSubsidiaries`, `goodwillRecords`, `productVentures`, `personalInvestments`, `luxuryAssets`, `sportsTeams`, `peDeals`, `angelInvestments`, `personalRealEstateHoldings`, `branchOffices`, `keyPersonnel`, `competitorStates` などを含む。
- `companyStocks` と `personalStocks` は銘柄IDキーの保有オブジェクトとして `qty` と `avg` を補完する。
- 未来バージョンは読み込まず、元セーブを上書きしない。
