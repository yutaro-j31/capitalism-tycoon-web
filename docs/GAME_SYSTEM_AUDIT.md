# Capitalism TYCOON 現行ゲームシステム監査

監査日: 2026-07-14
対象: `index.html` 単一ファイル実装。HTML/CSS/JS とマスターデータが同一ファイルに含まれる。

## 監査方針

- 「実装済み」は、状態、UI、操作関数、週次計算、保存対象がコード上で確認できたものに限定する。
- 「一部実装」は、UIまたは状態と一部計算はあるが、財務諸表・市場・保存補完・相互作用が未完成なもの。
- 「表示だけ存在」は、画面またはカードはあるが主要計算に反映されないもの。
- 「保存項目だけ存在」は、状態や補完項目はあるが、UI/計算が限定的または未確認なもの。
- 設計上の推測は「推測」欄に分離する。

## 全体構造

- マスターデータ: `MASTER`, `DEPARTMENT_UNLOCKS`, `PRODUCT_BLUEPRINTS`, `LUXURY_OFFERS`, `PERSONAL_INVESTMENT_OFFERS`, `OVERSEAS_COUNTRIES`, `SPORTS_TEAMS`, `MISSION_DEFS`。おおよそ `index.html:19-1834`。
- 基本エンジン: `createInitialState`, `mergeDefaults`, `TycoonEngine`。おおよそ `index.html:1952-2575`。
- 追加拡張: `installExpansion`。おおよそ `index.html:2638-2938` 付近。
- 完成度補完拡張: `installCompletion`。おおよそ `index.html:2960-3152` 付近。
- パリティ/アドバイザー拡張: `installParity`。おおよそ `index.html:3154-3230` 付近。
- UI: `render*`, `action`, イベントリスナー。おおよそ `index.html:3233-3616`。

## 主要システム一覧

| システム | 関連コード/状態 | 位置 | UI | 計算反映 | 週送り連動 | 保存/ロード | 依存 | 判定 | 不具合・不安定要素 |
|---|---|---:|---|---|---|---|---|---|---|
| 新規ゲーム初期化 | `createInitialState`, `TycoonEngine.load`, `configure`, `reset`, `renderSetup` | 1952-2076, 3299 | あり | 初期現金/難易度/設定 | `configure` 後開始 | 対象 | `mergeDefaults`, 各 `ensure*Defaults` | 実装済み | `configure` が拡張で複数回ラップされ、`save/emit` が複数回走る可能性。未完成状態での `notify` は基本状態作成後なので大事故は低い。 |
| 週送り | `advanceWeek`, `updateMacro`, `recordHistory`, `checkMilestones`, 拡張 `advanceWeek` ラップ | 2510-2563, 2923付近, 3226付近 | ボタンあり | 売上/費用/資産/市場/イベント | 中核 | 対象 | ほぼ全システム | 実装済み | 拡張の二重ラップで `emit('week')` が複数回発生し得る。`lastExpansionUpdateWeek`, `lastParityUpdateWeek` で二重計算を抑制しているが複雑。 |
| 店舗/事業 | `businesses`, `stores`, `openStore`, `closeStore`, `investBusiness`, `changePrice`, `renderBusiness` | 2078, 2122-2163, 3372 | あり | 売上/原価/固定費/需要/品質/ブランド/DX | あり | 対象 | 地域、テナント、競合、部門、供給 | 実装済み | `business(s.businessID)` が見つからない場合の週次計算は一部で未防御。旧セーブで不正IDがあると危険。 |
| テナント/地域 | `areas`, `prefs`, `tenants`, `makeTenants`, `renderMap` | 1862-1931, 3361 | あり | 交通量/賃料/競争度に反映 | 店舗計算経由 | 対象 | 店舗、本社、不動産 | 実装済み | テナント占有状態と店舗状態の不整合は旧セーブ/手動編集で発生し得る。 |
| 商品/プロダクト | `productVentures`, `startProduct`, `investProduct`, `sellProduct`, `updateProducts`, `ensureProductFunnel`, `updateProductFunnelsWeekly`, `renderProductSection` | 2279-2299, 2475-2478, 3383, 3443 | あり | 売上/費用/評価額/ユーザー | あり | 対象 | 部門、R&D、創業者 | 一部実装 | 基本 `updateProducts` と拡張 `updateProductFunnelsWeekly` が同じ `productVentures` の売上/費用を調整するため、計算責務が重複。 |
| 社員/部門 | `departments`, `departmentStaff`, `createDepartment`, `hireDepartmentStaff`, `departmentEffect` | 2106, 2181-2199, 3389 | あり | 部門効果、週次コスト | あり | 対象 | 本社、CXO、商品、R&D | 実装済み | 部門スタッフは数値だけで個人社員モデルはない。能力/疲労/職種は未実装に近い。 |
| CXO/役員 | `executives`, `executiveMarket`, `scoutExecutive`, `hireExecutive`, `fireExecutive`, `executiveDirectives` | 2202-2228, 2426-2433 | あり | 給与、部門効果、指示効果 | 給与/指示が週次 | 対象 | 本社、IPO、部門 | 実装済み | `cxoExecutives` という別状態も存在し、`executives` と責務が混在。 |
| 取締役会 | `boardEstablished`, `boardAgendas`, `establishBoard` | 2228-2231, 2560, 3403 | あり | IPO条件、四半期議題 | 四半期に議題生成 | 対象 | CXO、IPO | 一部実装 | 議題の承認処理は限定的。ガバナンス効果は浅い。 |
| 株式投資 | `market`, `companyStocks`, `personalStocks`, `buyStock`, `sellStock`, `favoriteStockIds`, `updateMarket` | 2233-2254, 2449-2469 | あり | 配当/含み損益/資産価値 | 市場価格・配当 | 対象 | 会社/個人資産、IPO | 実装済み | 保有株の不正数量・平均単価に対する正規化が弱い。 |
| VC/スタートアップ | `startups`, `investStartup`, `convertStartupToSubsidiary`, `startupFundingHistory` | 2257-2272, 2457-2469, 3415 | あり | 評価額、IPO転換、子会社 | あり | 対象 | 株式市場、子会社 | 実装済み | `ownedCompany + ownedPersonal` 前提。欠落時は NaN の恐れがあるが初期/補完あり。 |
| エンジェル/PE | `angelInvestments`, `peDeals`, `updatePersonalExpandedWeekly`, 個人資産UI | 252-255(拡張), 3479 | あり | 個人純資産に反映 | あり | 補完対象 | 個人資産、承継 | 一部実装 | UIと操作はあるが会計・流動性・Exitの詳細は粗い。 |
| M&A/子会社/事業売却 | `acquisitionTargets`, `maSubsidiaries`, `subsidiaries`, `goodwillRecords`, `generateMATargets`, `acquireTarget`, `sellMASubsidiary` | 2378-2400, 2490-2493, 3421 | あり | 収益/評価額/のれん/減損 | あり | 対象 | 投資部門、会社価値 | 一部実装 | デューデリジェンス、PMI、資金調達のモデルは簡略。買収後の統合失敗は確率的に限定。 |
| IPO/配当/自社株買い | `publicCompany`, `sharesOut`, `founderShares`, `dividendPerShare`, `executeIPO`, `setDividend`, `buybackOwnShares` | 2353-2376 | あり | 株価/配当/所有比率 | 四半期配当 | 対象 | 取締役会、株式市場 | 実装済み | `stockPrice` と `market` 内の自社株の同期は複数箇所にまたがる。 |
| 銀行借入/利息/返済 | `companyDebt`, `personalDebt`, `borrow`, `repay`, `companyBorrowRate`, `personalBorrowRate`, `renderBank` | 2341-2350, 2535, 3437 | あり | 利息/信用/現金 | あり | 対象 | 会社価値、個人資産 | 実装済み | 返済額の負値や非有限値への防御は一部のみ。13週資金繰りは未実装。 |
| 不動産 | `properties`, `makeProperties`, `buyProperty`, `sellProperty`, `buildOnLand`, `personalRealEstateHoldings` | 1862-1891, 2302-2315, 2487, 3431 | あり | 賃料/価値/減価償却 | あり | 対象 | 会社/個人資産 | 実装済み | 会社保有と個人保有が同じ `properties` に混在し、拡張の個人不動産は別配列。 |
| 海外進出 | `overseasSubsidiaries`, `expandOverseas`, `investOverseas`, `updateOverseas`, `OVERSEAS_COUNTRIES` | 2402-2411, 2496-2498, 3427 | あり | 売上/費用/評価額/為替 | あり | 対象 | 事業、為替 | 一部実装 | 現地会計、税、為替差損益の詳細はなし。 |
| 競合企業 | `competitors`, `competitorEvents`, `competitorStates`, `updateCompetitors`, `respondToCompetitor`, `renderRivals` | 2471-2473, 3207-3224, 3537 | あり | 競争圧力/市場イベント | あり | 対象 | 店舗、株主、M&A | 一部実装 | 基本競合と拡張競合状態の二層構造。市場シェアと価格競争は限定的。 |
| サプライチェーン/在庫/仕入先 | `inventoryByBusinessID`, `supplierContracts`, `verticalIntegrationAssets`, `updateSupplyChainWeekly` | 2600-2616, 拡張144-154, 224-233, 3487 | あり | 原価補正/欠品/品質/現金 | あり | 補完対象 | 店舗、事業、R&D | 一部実装 | `lastSales` を後から調整するためレポートとの整合が崩れる可能性。負在庫は明示的に発生しにくいが在庫単位モデルは粗い。 |
| R&D/特許 | `rdProjects`, `patentRecords`, `startRDProject`, `licensePatent`, `updateRDWeekly` | 2619-2624, 拡張156-160, 236-239 | あり | 効率/ブランド/ライセンス収入 | あり | 補完対象 | 商品、部門、会社価値 | 一部実装 | 特許効果が毎週事業値を微増させ続けるため累積バランスに注意。 |
| メディア/イベント | `weeklyNewspaper`, `majorBusinessNews`, `ventureForumEvents`, `generateMediaWeekly`, `MEDIA_ACTIONS` | 264-268, 3500 | あり | 景気/評判/イベント | あり | 補完対象 | マクロ、VC、創業者 | 一部実装 | 記事は表示中心。イベント効果は一部だけ。 |
| スポーツ事業 | `sportsTeams`, `SPORTS_TEAMS`, `buySportsTeam`, `sellSportsTeam`, `updateSportsExpandedWeekly` | 1820-1824, 2333-2339, 2503, 260-263, 3527 | あり | 収益/価値/個人資産 | あり | 対象 | 個人/会社資産 | 一部実装 | 基本更新と拡張更新が同じ `sportsTeams` に触る。選手/ドラフトは表示寄り。 |
| 個人資産 | `personalCash`, `personalDebt`, `personalStocks`, `personalInvestments`, `luxuryAssets`, `personalNetWorth` | 2093-2099, 2317-2331, 2501-2503 | あり | 純資産/維持費/利息 | あり | 対象 | 承継、再起業 | 実装済み | 個人/会社の資産境界が一部UI上で近く、会計分離の厳密性は低い。 |
| 承継/再起業/エンディング | `founderAge`, `founderGeneration`, `sellCompany`, `startNewCompany`, `endingRecords`, `hallOfRecords`, `renderLegacy` | 2443-2446, 3070付近, 3513 | あり | 個人資産/記録 | 週次でスコア更新 | 補完対象 | 会社価値、個人資産 | 一部実装 | 新会社作成時の状態引き継ぎが長い手書きコピーで、将来項目の漏れが最大リスク。 |
| 実績/ミッション | `MISSION_DEFS`, `activeMissionIDs`, `completedMissionIDs`, `achievements`, `checkMilestones`, `renderMissions` | 1826-1833, 2555-2557, 3532 | あり | 報酬/ニュース | あり | 対象 | 店舗、IPO、M&A等 | 実装済み | 実績条件はハードコード。拡張実績との重複管理に注意。 |
| 設定/セーブ/JSON | `settings`, `SAVE_KEY`, `save`, `loadSlot`, `exportSave`, `importSave`, `renderSettings` | 1840-1841, 2047-2058, 2567-2572, 3540, 3592-3606 | あり | 表示/モーション等 | 保存時 | 対象 | 全状態 | 実装済み | `mergeDefaults` は配列内部の要素スキーマまでは補完しない。旧セーブの配列要素欠落が危険。 |

## 重点確認結果

### 新規ゲーム初期化

確認できた事実:
- `createInitialState` がトップレベル初期値を返す。
- `TycoonEngine.load()` はメインキーから JSON を読み、失敗時は新規状態にフォールバックする。
- `configure()` は `createInitialState({ configured:true })` で再初期化し、設定を引き継ぐ。
- `installExpansion`, `installCompletion`, `installParity` が `normalize`, `configure`, `advanceWeek` をプロトタイプラップする。

不安定要素:
- ラップの順番が実行順に依存する。
- `configure` の各ラップが `save()` と `emit()` を呼ぶため、新規ゲーム開始時に複数回描画される可能性がある。

### 週送り処理

確認できた事実:
- 基本 `advanceWeek` は、週/月/年齢更新、マクロ、商品、海外、子会社、個人資産、店舗、家賃、株式配当、税、履歴、ミッション、保存、イベント発火を行う。
- 拡張 `advanceWeek` は基本処理後にサプライチェーン、R&D、ファネル、個人拡張資産、スポーツ、メディア、資本市場、承継、記録を更新する。
- パリティ `advanceWeek` はさらに決算、競合反撃などを更新する。

不安定要素:
- 週送り1回で複数の `save` と `emit` が発生し得る。
- 後段の拡張計算が `lastReport` を後から書き換える。

### undefined に対する map/filter/find の可能性

確認できた危険箇所:
- 多くの UI は `g.stores.filter`, `g.productVentures.map`, `g.news.map` などを直接呼ぶ。
- `mergeDefaults` によりトップレベル欠落は補完されるが、配列そのものが不正型の場合は一部 `normalize` でしか補正されない。
- 拡張系は `ensure*Defaults` で多くを補完するが、配列要素の内部項目欠落は残りやすい。

### 保存配列の肥大化

確認できた制限:
- `news` 300件、`history` 500件、`reports` 520件、価格履歴260件など一部は制限あり。

残る懸念:
- 拡張ログや履歴の一部は slice されているが、全配列に統一方針がない。

## 設計上の推測

- 現在の実装は、Swift Playgrounds 由来の基本移植に、未移植機能をプロトタイプ拡張で後付けしている構成と推測される。
- 今後の安全開発では、まず保存スキーマと週次更新順序を固定化し、次に UI と計算を分離する必要がある。
