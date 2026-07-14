# Save Migration Audit

監査日: 2026-07-14
対象: `index.html` の `createInitialState`, `mergeDefaults`, `normalize`, 保存/読込処理、既存テスト。

## コード上の事実

### トップレベル項目

`createInitialState()` は、時間・プレイヤー・マクロ・会社財務・個人財務・上場・UI選択・マスターデータ複製・組織・投資・商品・海外/FC/個人資産・CXO/施策・従業員・自動化/ESG・承継・支払予定・レポート/履歴・ミッション/実績・設定を1つの状態オブジェクトとして保存する。

### 配列のトップレベル項目

保存対象として確認した主な配列は次の通り。

- マスター/運用: `businesses`, `areas`, `prefs`, `stores`, `properties`, `tenants`, `rentalOffices`, `market`, `startups`, `executiveMarket`, `competitors`
- 組織/会議: `officeFloors`, `boardAgendas`, `investorOffers`, `cxoExecutives`, `executiveDirectives`, `departmentCampaigns`, `keyPersonnel`
- 投資/M&A: `favoriteStockIds`, `subsidiaries`, `acquisitionTargets`, `maSubsidiaries`, `goodwillRecords`, `tenderOffers`, `personalInvestments`, `luxuryAssets`, `sportsTeams`, `peDeals`, `angelInvestments`, `personalRealEstateHoldings`
- 商品/社内事業: `productVentures`, `productBuyoutOffers`, `productEvents`, `internalVentureProposals`, `internalVentures`
- 研究/供給/市場: `supplierContracts`, `verticalIntegrationAssets`, `rdProjects`, `patentRecords`, `supplyChainEvents`, `productFunnelEventLog`, `stockSplitHistory`, `ownershipHistory`, `activistCampaigns`, `shareholderEventLog`, `ventureForumEvents`
- メディア/承継/補完: `weeklyNewspaper`, `majorBusinessNews`, `luxuryAuctionListings`, `sportsDraftCandidates`, `sportsTradeMarket`, `sportsSaleOffers`, `serialEntrepreneurHistory`, `endingRecords`, `pastCompanyRecords`, `branchOffices`, `employeeComplaintLog`, `transportRebuildProjects`, `transportRebuildLog`, `mediaCampaigns`, `mediaActionLog`, `inboundBuyoutOffers`, `companyBuyoutHistory`, `playerTitles`
- 履歴/ログ: `reports`, `weeklySalesHistory`, `weeklyProfitHistory`, `companyValueHistory`, `personalNetWorthHistory`, `news`, `history`, `competitorEvents`, `activeMissionIDs`, `completedMissionIDs`, `achievements`, `unlockedEndings`, `advisorDismissedActionIDs`, `advisorActionHistory`, `keyPersonnelEventLog`, `earningsEventLog`, `competitorEventLog`, `industryAwards`, `awardEventLog`

### IDとして使われている項目

- 配列要素の主ID: 多くの配列で `id`。
- 店舗: `id`, `businessID`, `prefID`, `tenantID`。
- 物件/テナント/オフィス: `id`, `prefID`, `stableKey`, `occupiedBy`, `contractedOfficeID`。
- 株式保有: `companyStocks` と `personalStocks` は `stockID` をキーにしたオブジェクト。
- 商品/買収: `productID`, `blueprintID`, `projectID`, `subID`, `actionID`。
- 部門/施策: `departmentID`。
- 競合: `areaID`, `businessID`, `industryID`。

### 数値項目

代表例: `week`, `month`, `companyCash`, `personalCash`, `companyDebt`, `personalDebt`, `companyCredit`, `companyReputation`, `policyRate`, `inflation`, `exchangeRate`, `sharesOut`, `founderShares`, `stockPrice`, `dividendPerShare`, `price`, `unitCost`, `demand`, `quality`, `brand`, `condition`, `lastSales`, `lastProfit`, `valuation`, `ownership`, `qty`, `avg`, `salary`, `progress`, `users`, `currentValue`。

### 真偽値項目

代表例: `configured`, `publicCompany`, `hasHeadOffice`, `boardEstablished`, `remoteWorkEnabled`, `autoManage`, `autoExecutiveManagementEnabled`, `gameOver`, `isCompanySold`, `hasSeenCompanyBuyoutEnding`, `hired`, `negotiated`, `alive`, `subsidiary`, `contracted`, `canBuildHQ`, `hqBuilt`, `familyTrustEstablished`, `saleListed`, `isDistressed`。

### 入れ子オブジェクト

代表例: `settings`, `organizationCulture`, `departments`, `departmentStaff`, `companyStocks`, `personalStocks`, `inventoryByBusinessID`, `customerSegmentsByBusinessID`, `marketShareByBusinessID`, `productFunnels`, `quarterlyStockResults`, `startupFundingHistory`, `startupQuarterlyReports`, `localReputationByPref`, `hallOfRecords`, `expandedWeeklyAdjustments`, 各銘柄の `shareholders`。

### 履歴配列

`news`, `history`, `reports`, `weeklySalesHistory`, `weeklyProfitHistory`, `companyValueHistory`, `personalNetWorthHistory`, `competitorEvents`, `productEvents`, `supplyChainEvents`, `productFunnelEventLog`, `stockSplitHistory`, `ownershipHistory`, `shareholderEventLog`, `founderHomeActionLog`, `serialEntrepreneurHistory`, `pastCompanyRecords`, `companyBuyoutHistory`, `advisorActionHistory` など。

### UI専用の一時状態

`selectedArea`, `selectedPref`, `selectedBusiness`, `selectedTab`, `lastWeeklySummary`, `advisorDismissedActionIDs`, `advisorLastGeneratedWeek` は表示/選択の状態としても使われる。現在はゲーム状態と同じオブジェクトに含まれ、保存対象になっている。

### 保存対象外にすべき項目

現時点のコード上、`TycoonEngine` インスタンスのイベントリスナー、DOM、トースト、モーダル、`_transactionDepth` は `this.g` 外にあり保存対象外。`lastWeeklySummary` や選択タブは本来UI一時状態だが、現行実装では保存されているため今回削除しない。

### 旧セーブで欠落し得る項目

拡張レイヤーで後から追加された `supplierContracts`, `inventoryByBusinessID`, `rdProjects`, `patentRecords`, `angelInvestments`, `personalRealEstateHoldings`, `successorCandidate`, `branchOffices`, `keyPersonnel`, `competitorStates` などは旧セーブで欠落し得る。

### `mergeDefaults` だけでは補完できなかった項目

`mergeDefaults` は配列の場合、対象が配列なら配列そのものをそのまま返す。そのため `stores[]`, `productVentures[]`, `subsidiaries[]`, `peDeals[]`, `keyPersonnel[]` などの要素内部に後から追加されたプロパティは補完されなかった。

## 推測と判断

- `saveVersion: 1` は既に存在したが、実質的には `normalize()` で現行値を代入するだけで、明示的な段階マイグレーションはなかった。
- 今回は初めて配列要素内部の補完をセーブ復元の正式工程に入れるため、現在版を `saveVersion: 2` とした。
- UI一時状態を保存対象外へ移す設計は将来の分離PRで行うべきで、今回は互換性優先で維持した。

## 発見した問題

1. 配列要素内部の欠落補完が一部の `normalize()` 実装に散在し、対象外の配列が残っていた。
2. 未来バージョンのセーブを明示的に拒否する経路がなかった。
3. `loadSlot()` と `importSave()` が直接 `mergeDefaults` へ進み、失敗時の安全性が起動ロードと統一されていなかった。
4. 旧セーブで配列項目がオブジェクト化している場合など、白画面につながる型不整合を復元段階で検出しにくかった。
