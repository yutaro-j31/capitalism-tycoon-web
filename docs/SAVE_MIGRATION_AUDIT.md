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

## PR #4 merge前追加調査: 実ロード・保存経路

調査日: 2026-07-14

### 起動時にSAVE_KEYを読む処理

- ブラウザ起動時はスクリプト末尾で `TycoonEngine.load()` を呼び、生成されたエンジンをUIに渡す。
- `TycoonEngine.load()` は `localStorage.getItem(SAVE_KEY)` を読み、文字列があれば `JSON.parse` して `migrateSave()` に渡す。
- `migrateSave()` が失敗した場合は例外化され、`catch` で `console.error('Save load failed', error)` を出したうえで新規状態へフォールバックする。

### TycoonEngineの初期化経路

- `new TycoonEngine(state)` は、明示された `state` があればコンストラクタ内で再度 `migrateSave(state)` を通してから `this.g` に採用する。
- `state` がない場合は `createInitialState({configured:false})` を使う。
- いずれも最後に `normalize()` を実行する。

### load()

- 正常な保存文字列: `getItem -> JSON.parse -> migrateSave -> new TycoonEngine(migrated.state)`。
- 保存なし: `new TycoonEngine(null)`。
- 破損JSON、壊れた型、未来バージョン: エラーを記録してフォールバックエンジンを返す。
- フォールバックエンジンにはゲーム状態JSON外の一時フラグ `_saveBlockedDueToLoadFailure` と `_loadFailureReason` を持たせ、明示的な新規ゲーム/リセット/正常インポート/正常スロット読込までメインSAVE_KEYの保存をブロックする。

### save()

- `save(slot = null)` は、通常時は `lastSaveDate` を更新し、メイン保存なら `SAVE_KEY`、スロットなら `${SAVE_KEY}_slot_${slot}` へ `JSON.stringify(this.g)` を書く。
- 起動ロード失敗フォールバック中のメイン保存は `console.error` を出して `false` を返し、`localStorage.setItem(SAVE_KEY, ...)` を呼ばない。

### loadSlot()

- `loadSlot(slot)` は `${SAVE_KEY}_slot_${slot}` を読み、存在しなければ `false`。
- 存在する場合は `JSON.parse -> migrateSave` を実行し、成功したときだけ `this.g` を差し替え、メインSAVE_KEYへ保存する。
- JSON parse失敗、型不正、未来バージョン、重複IDなどで失敗した場合は `console.error` を出して `false` を返し、現在の `engine.g`、元スロット文字列、メインSAVE_KEYを変更しない。

### saveSlot()

- 独立した `saveSlot()` 関数は存在せず、UIのスロット保存は `engine.save(id)` により `save(slot)` の分岐を使う。

### importSave() / exportSave()

- `exportSave()` は現在の `this.g` をJSON Blob化する。
- `importSave(text)` は `JSON.parse -> migrateSave` が成功した場合だけ `this.g` を差し替え、`normalize()`、`save()`、`emit()` を実行する。
- parseまたはmigration失敗時は例外を呼び出し元へ返し、現在状態とメインSAVE_KEYを変更しない。

### 新規ゲームへのフォールバック処理と自動save到達経路

- 起動ロード失敗時のフォールバックは新規状態をメモリ上で作るだけで、ロード直後には保存しない。
- UI描画の `render()` は保存しない。
- `configure()` と `reset()` はユーザーが明示的に新規ゲーム/初期化を選んだ経路であり、ロード失敗フラグを解除して保存する。
- 通常操作、週送り、設定変更、スロット保存は既存通り `save()` へ到達するが、ロード失敗フォールバック中のメインSAVE_KEY保存はブロックされる。

### 追加で確認した上書きリスク

- 破損SAVE_KEYまたは未来バージョンSAVE_KEYの起動ロード中に `localStorage.setItem(SAVE_KEY, ...)` は呼ばれない。
- フォールバック直後に `engine.save()` が呼ばれてもメインSAVE_KEYは上書きされない。
- 破損スロットの読込失敗時に、現在状態、対象スロット、メインSAVE_KEYは変更されない。
- 破損JSON/未来バージョンのインポート失敗時に、現在状態とメインSAVE_KEYは変更されない。

### コードポイント単位の不可視文字再調査

`docs/*.md` をコードポイント単位で再調査した。対象はBidi制御文字、ゼロ幅文字、BOM、行/段落区切り、C0/C1制御文字である。

- 発見した不要な不可視文字: なし。
- `docs/SAVE_MIGRATION_AUDIT.md`: 該当なし。
- `docs/SAVE_MIGRATION_GUIDE.md`: 該当なし。
- `docs/CURRENT_SAVE_SCHEMA.md`: 該当なし。
- `docs/BASELINE_RESULTS.md` は存在しないため対象外。テスト結果文書は `tests/BASELINE_RESULTS.md`。
- 正当な文字として日本語、ASCII記号、Markdown記号、改行 `U+000A` のみを確認した。
