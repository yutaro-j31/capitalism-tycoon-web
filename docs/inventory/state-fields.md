# 作業2：状態フィールド一覧（ゲーム状態 g の全トップレベルフィールド）

- 基準: `main` @ `47217818`。調査のみ。対象は新規ゲーム開始後 156 週進めた時点の `engine.g` のトップレベルキー **436個**（新規開始直後は424個、週次処理で12個増える）。
- 件数: 稼働 355 / 値だけ 69 / 初期値のみ 12（書込も読込もなく初期値だけ存在）
- **セーブ**: すべて 〇。`engine.save()` は `JSON.stringify(this.g)`（`js/engine.js` の `save(slot)`）、永続化は `js/save-storage.js` の `compactStateForStorage` が `structuredClone` した全体を保存し、一部の履歴配列のみ長さを切り詰める（js/save-storage.js:115-129）。除外されるトップレベルキーはなし（`saveSequence` のみ `js/save-v9.js:85` で削除されるが、g のキーには存在しない）。

## 判定方法

1. **静的**: `js/*.js` の全出現を、書込（代入・`++`・`.push` 等）／読込／オブジェクトリテラルの初期値／複製（`key: x.key`・`a.key=b.key` の同名コピー）／自己更新（`g.k=clamp(g.k+…)` の右辺）／保存・ハッシュ・検証（`semantic-hash-v2.js`・`save-*.js`・`validate`/`errors.push`）に分類。**複製・自己更新・保存・ハッシュ・検証は「読まれている」に数えない**。
2. **動的**: `g` を Proxy で包んで 156 週（既定UI）・52 週（`?ui=3`）を実行し、各フィールドへの読込/書込の呼出元関数をスタックから記録。`JSON.stringify`・トランザクション snapshot・`ensure*`/`normalize*`/`validate*`・`semanticProjection`・`structuredClone` 経由の読込は除外。
3. 判定: 実読込がある=**稼働**（`(動)`=実行で観測、`(静)`=コード上のみ）／書込はあるが実読込なし=**値だけ**／書込も読込もない=**初期値のみ**。`next*Seq` は `++` の戻り値で ID を作る採番カウンタなので稼働とした。
4. **限界**: 動的キーアクセス（`g[key]`）は `js/engine.js:378-444` などの正規化ループ（全配列を走査して整形するだけ）にしか確認できず、これは読み手に数えていない。ファイル内の長い1行に複数の代入がある箇所は行単位の近似。`値だけ`/`初期値のみ` と判定した全フィールドは出現箇所を目視で確認済み（下表の根拠列の行を参照）。

## 前例（PR #397・#542）の現状

| フィールド | 現状 | 根拠 |
|---|---|---|
| `founderEnergy` / `founderFocus` / `founderHealth` | **フィールドごと削除済み**（g に存在しない）。`js/` に出現0。tests/ に2ファイルが旧名を残す | PR #542（`5ba87241`）。`grep -l founderHealth js/*.js` → 0件 |
| `founderEducationLevel` | **まだ値だけ**（書込: expansion.js:330-332,703,795／読込なし。複製 completion.js:211-212） | 下表 |
| `lobbyInfluence` | **まだ値だけ**（書込: expansion.js:703／読込なし。複製 completion.js:211） | 下表 |
| `founderNetworkLevel` | **読まれるようになった**（engine.js:2615 でVC案件発生確率に使用） | 下表 |

## 値だけ・初期値のみ（削除候補の一次リスト）

「削除候補」でも **セーブ互換には影響する**（すべて saveVersion=9 の保存データに含まれる）。詳細は README.md の分類を参照。

| フィールド | 型 | 状態 | 書き込む場所 | 読む場所 |
|---|---|---|---|---|
| `personalFame` | number | 値だけ | js/expansion.js:340, js/expansion.js:715, js/completion.js:249 ほか2件 ／初期値 js/engine.js:279 | —（ハッシュ semantic-hash-v2.js:17） ／ js/expansion.js:340,715・completion.js:249・engine.js:1743 が加算。読み手なし（決定論ハッシュ semantic-hash-v2.js:17 のみ） |
| `selectedArea` | string | 初期値のみ | 初期値のみ: js/engine.js:283 | —（複製のみ js/management-context.js:254） ／ 書込なし（初期値 js/engine.js:283 のみ）。management-context.js:254 が `selectedArea:state?.selectedArea` を別オブジェクトへ複製するだけで、その複製の読み手もなし |
| `officeLevel` | number | 初期値のみ | 初期値のみ: js/engine.js:289 | —（ハッシュ semantic-hash-v2.js:14） |
| `officePrestige` | number | 値だけ | js/completion.js:87, js/engine.js:1349 ／初期値 js/engine.js:289 | —（ハッシュ semantic-hash-v2.js:14） |
| `realizedCompanyStockPL` | number | 値だけ | 初期値のみ: js/engine.js:292 | —（ハッシュ semantic-hash-v2.js:11） ／ 書込は計算キー経由 js/engine.js:1509（`this.g[account==='company'?'realizedCompanyStockPL':'realizedPersonalStockPL']+=profit`）。読み手なし |
| `realizedPersonalStockPL` | number | 値だけ | js/engine.js:2021, js/personal-stock-margin.js:173 ／初期値 js/engine.js:292 | —（複製のみ js/engine.js:2021 / ハッシュ semantic-hash-v2.js:11） |
| `tenderOffers` | array | 初期値のみ | 初期値のみ: js/engine.js:293 | —（ハッシュ semantic-hash-v2.js:12） |
| `productExitCount` | number | 値だけ | js/completion.js:140, js/engine.js:1719 ／初期値 js/engine.js:295 | —（ハッシュ semantic-hash-v2.js:14） |
| `cxoExecutives` | array | 初期値のみ | 初期値のみ: js/engine.js:298 | —（ハッシュ semantic-hash-v2.js:13） |
| `autoExecutiveManagementEnabled` | boolean | 初期値のみ | 初期値のみ: js/engine.js:301 | —（ハッシュ semantic-hash-v2.js:17） |
| `complianceLevel` | number | 初期値のみ | 初期値のみ: js/engine.js:302 | —（ハッシュ semantic-hash-v2.js:17） |
| `scheduledPayments` | array | 初期値のみ | 初期値のみ: js/engine.js:303 | —（ハッシュ semantic-hash-v2.js:11） |
| `productEvents` | array | 値だけ | js/engine.js:2355 ／初期値 js/engine.js:305 | —（ハッシュ semantic-hash-v2.js:14） |
| `hasSeenCompanyBuyoutEnding` | boolean | 値だけ | js/completion.js:212, js/engine.js:2025 ／初期値 js/engine.js:307 | — |
| `competitorSettings` | object | 初期値のみ | 初期値のみ: js/engine.js:309 | —（ハッシュ semantic-hash-v2.js:16） |
| `expansionVersion` | number | 初期値のみ | 初期値のみ: js/expansion.js:245 | — |
| `founderOriginCityName` | string | 値だけ | js/expansion.js:305 ／初期値 js/expansion.js:246 | — |
| `founderHomeDeskSlots` | number | 値だけ | js/expansion.js:349 ／初期値 js/expansion.js:247 | — |
| `lastFounderHomeEventWeek` | number | 初期値のみ | 初期値のみ: js/expansion.js:249 | — |
| `lastStoreHuntWeek` | number | 値だけ | js/expansion.js:329 ／初期値 js/expansion.js:249 | — |
| `lobbyInfluence` | number | 値だけ | js/expansion.js:703, js/completion.js:212 ／初期値 js/completion.js:211 | —（複製のみ js/completion.js:211） |
| `patentLicenseIncome` | number | 値だけ | js/expansion.js:816 ／初期値 js/expansion.js:251 | — |
| `productFunnelEventLog` | array | 値だけ | js/expansion.js:843 ／初期値 js/expansion.js:252 | — |
| `ownershipHistory` | array | 値だけ | js/expansion.js:888 ／初期値 js/expansion.js:253 | — |
| `peRealizedPL` | number | 値だけ | js/expansion.js:691, js/expansion.js:693 ／初期値 js/expansion.js:255 | — |
| `successorTrainingWeeks` | number | 値だけ | js/expansion.js:718 ／初期値 js/expansion.js:258 | — |
| `serialEntrepreneurHistory` | array | 値だけ | js/expansion.js:792 ／初期値 js/expansion.js:259 | — |
| `completionVersion` | number | 初期値のみ | 初期値のみ: js/completion.js:52 | — |
| `transportRebuildLog` | array | 値だけ | js/completion.js:247 ／初期値 js/completion.js:54 | — |
| `companyBuyoutHistory` | array | 値だけ | js/completion.js:149, js/completion.js:155 ／初期値 js/completion.js:56 | — |
| `lastNewCompanyFoundingWeek` | number | 値だけ | js/completion.js:212 ／初期値 js/completion.js:57 | — |
| `equippedTitleID` | null | 値だけ | 初期値のみ: js/completion.js:58 | — |
| `parityVersion` | number | 初期値のみ | 初期値のみ: js/parity.js:27 | — |
| `advisorLastGeneratedWeek` | number | 値だけ | js/parity.js:115 ／初期値 js/parity.js:27 | — |
| `awardEventLog` | array | 値だけ | js/parity.js:40, js/parity.js:102 ／初期値 js/parity.js:31 | — |
| `difficultyOpeningBalanceApplied` | boolean | 値だけ | js/difficulty-scenario-balance.js:57 | —（検証のみ js/difficulty-scenario-balance.js:104 / 複製のみ js/difficulty-scenario-balance.js:57） |
| `competitorMigrationV9Applied` | boolean | 値だけ | js/save-v9.js:70 | —（ハッシュ semantic-hash-v2.js:16） |
| `competitorLifecycleSchemaVersion` | number | 値だけ | js/save-v9.js:71 | —（ハッシュ semantic-hash-v2.js:16） |
| `companyRecallCrisisVersion` | number | 値だけ | js/company-recall-crisis.js:22 | — |
| `internalVentureBusinessVersion` | number | 値だけ | js/internal-venture-business.js:29 | —（ハッシュ semantic-hash-v2.js:14） |
| `subsidiaryFundingVersion` | number | 値だけ | js/internal-venture-business.js:30 | —（ハッシュ semantic-hash-v2.js:15） |
| `internalVentureBusinessHistory` | array | 値だけ | js/internal-venture-business.js:31, js/internal-venture-business.js:78 | —（ハッシュ semantic-hash-v2.js:14） |
| `subsidiaryFundingHistory` | array | 値だけ | js/internal-venture-business.js:32, js/internal-venture-business.js:79 | —（ハッシュ semantic-hash-v2.js:15） |
| `maDealHistory` | array | 値だけ | js/ma-deal-room.js:68, js/ma-deal-room.js:82, js/pe-acquisition.js:84 ほか1件 | —（複製のみ js/ma-deal-room.js:68） |
| `productInnovationVersion` | number | 値だけ | js/player-engine-bridge.js:39 | — |
| `productInnovationHistory` | array | 値だけ | js/player-engine-bridge.js:41, js/player-engine-bridge.js:90, js/player-engine-bridge.js:91 | — |
| `shareholderActivismVersion` | number | 値だけ | js/shareholder-activism.js:23 | — |
| `shareholderProposals` | array | 値だけ | js/shareholder-activism.js:23, js/shareholder-activism.js:35, js/shareholder-value-destruction.js:28 ほか1件 | —（ハッシュ semantic-hash-v2.js:12） |
| `boardActivistSeats` | number | 値だけ | js/shareholder-activism.js:23, js/shareholder-activism.js:39 | —（複製のみ js/shareholder-activism.js:23） |
| `shareholderValueDestructionVersion` | number | 値だけ | js/shareholder-value-destruction.js:17 | — |
| `shareholderPortfolioInefficiencyVersion` | number | 値だけ | js/shareholder-value-destruction.js:17 | — |
| `macroCycleVersion` | number | 値だけ | js/macro-cycle.js:25 | — |
| `industrySpecificEventVersion` | number | 値だけ | js/industry-specific-events.js:21 | — |
| `industryEventResponsePlanVersion` | number | 値だけ | js/industry-event-response-plans.js:12 | — |
| `industryEventResponsePlanHistory` | array | 値だけ | js/industry-event-response-plans.js:12, js/industry-event-response-plans.js:15 | —（検証のみ js/industry-event-response-plans.js:22） |
| `productLifecycleVersion` | number | 値だけ | js/product-lifecycle.js:31 | — |
| `productLifecycleHistory` | array | 値だけ | js/product-lifecycle.js:32, js/product-lifecycle.js:56 | — |
| `productRecallVersion` | number | 値だけ | js/product-lifecycle.js:34 | — |
| `productRecallHistory` | array | 値だけ | js/product-lifecycle.js:36, js/product-lifecycle.js:57 | —（検証のみ js/product-lifecycle.js:111） |
| `listedSubsidiaryMarketVersion` | number | 値だけ | js/listed-subsidiary-market.js:49 | — |
| `listedSubsidiaryMarketHistory` | array | 値だけ | js/listed-subsidiary-market.js:24, js/listed-subsidiary-market.js:49 | — |
| `listedSubsidiaryPortfolioVersion` | number | 値だけ | js/listed-subsidiary-portfolio-dashboard.js:14 | — |
| `listedSubsidiaryControlVersion` | number | 値だけ | js/listed-subsidiary-control-actions.js:17 | — |
| `listedSubsidiaryControlHistory` | array | 値だけ | js/listed-subsidiary-control-actions.js:17, js/listed-subsidiary-control-actions.js:19 | — |
| `subsidiaryIntegrationSynergyVersion` | number | 値だけ | js/subsidiary-integration-synergy.js:18 | — |
| `interSubsidiarySynergyVersion` | number | 値だけ | js/inter-subsidiary-synergy-allocation.js:19 | — |
| `groupCapitalAllocationVersion` | number | 値だけ | js/group-capital-allocation-actions.js:12 | — |
| `groupCapitalAllocationHistory` | array | 値だけ | js/group-capital-allocation-actions.js:12, js/group-capital-allocation-actions.js:17 | — |
| `groupRestructuringVersion` | number | 値だけ | js/group-restructuring-candidates.js:14 | — |
| `restructuringProgressVersion` | number | 値だけ | js/group-restructuring-progress.js:47 | — |
| `subsidiaryRelistingVersion` | number | 値だけ | js/subsidiary-relisting-options.js:14 | — |
| `subsidiaryRelistingHistory` | array | 値だけ | js/subsidiary-relisting-options.js:14, js/subsidiary-relisting-options.js:19 | — |
| `listedSubsidiaryFollowOnOfferingVersion` | number | 値だけ | js/listed-subsidiary-follow-on-offering.js:18 | — |
| `listedSubsidiaryFollowOnOfferingHistory` | array | 値だけ | js/listed-subsidiary-follow-on-offering.js:18, js/listed-subsidiary-follow-on-offering.js:22 | — |
| `subsidiaryIPOPreparationVersion` | number | 値だけ | js/subsidiary-ipo-preparation.js:30 | — |
| `subsidiaryIPOPreparationHistory` | array | 値だけ | js/subsidiary-ipo-preparation.js:31, js/subsidiary-ipo-preparation.js:48 | — |
| `subsidiaryIPOSecondarySaleVersion` | number | 値だけ | js/subsidiary-ipo-secondary-sale.js:16 | — |
| `subsidiaryIPOSecondarySaleHistory` | array | 値だけ | js/subsidiary-ipo-secondary-sale.js:16, js/subsidiary-ipo-secondary-sale.js:22 | — |
| `newBusinessCommercializationHistory` | array | 値だけ | js/new-business-commercialization.js:5, js/new-business-commercialization.js:8 | — |
| `executiveModifiers` | object | 値だけ | js/executives-department-assignments.js:14 | — |
| `executiveDismissalDisruptionUntilWeek` | number | 値だけ | js/executive-reviews-succession-board.js:5, js/executive-reviews-succession-board.js:15 | —（複製のみ js/executive-reviews-succession-board.js:5） |

## 全フィールド

| フィールド名 | 型 | 書き込む場所 | 読む場所 | セーブに含まれるか | 状態 |
|---|---|---|---|---|---|
| `saveVersion` | number | js/workforce.js:48, js/save-v9.js:69, js/save-v9.js:95 ほか12件 ／初期値 js/engine.js:273 | js/app.js:835, js/release-diagnostics-ui.js:93, js/engine.js:323 ほか2件 ／ 複製のみ js/save-storage-ui.js:25 / ハッシュ semantic-hash-v2.js:10 / 保存/ハッシュ js/save-v9.js:61 | 〇 | 稼働(動) |
| `week` | number | js/pe-portfolio-operations.js:854, js/pe-portfolio-operations.js:860, js/completion.js:212 ほか5件 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:174, js/capital-allocation-decision-memo.js:24, js/capital-allocation-decision-memo.js:28 ほか971件 ／ 検証のみ js/workforce.js:111 / 複製のみ js/inter-subsidiary-synergy-allocation.js:23 / ハッシュ semantic-hash-v2.js:10 / 保存/ハッシュ js/save-storage-idb.js:130 | 〇 | 稼働(動) |
| `month` | number | js/completion.js:212, js/engine.js:2514, js/engine.js:2521 ／初期値 js/completion.js:211 | js/store-equipment.js:70 ／ 複製のみ js/completion.js:211 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(静) |
| `playerName` | string | js/expansion.js:304, js/expansion.js:792, js/completion.js:212 ／初期値 js/completion.js:211 | js/expansion.js:246, js/expansion.js:294, js/expansion.js:304 ほか9件 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `companyName` | string | js/completion.js:212 ／初期値 js/completion.js:159 | js/group-holding-governance.js:14, js/expansion.js:879, js/deterministic-economic-foundation.js:11 ほか45件 ／ 複製のみ js/expansion.js:766 | 〇 | 稼働(動) |
| `ticker` | string | js/economic-read-model.js:881, js/engine.js:1675, js/engine.js:1868 ／初期値 js/engine.js:275 | js/phase3-founder-wealth.js:179, js/phase3-founder-wealth.js:259, js/phase3-founder-wealth.js:513 ほか55件 ／ 複製のみ js/phase3-founder-wealth.js:179 | 〇 | 稼働(動) |
| `configured` | boolean | js/completion.js:212 ／初期値 js/engine.js:276 | js/capital-allocation-decision-memo.js:28, js/inter-subsidiary-synergy-allocation.js:25, js/capital-allocation-stress-test.js:34 ほか65件 ／ 複製のみ js/engine.js:276 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `difficulty` | string | js/difficulty-scenario-balance.js:34 ／初期値 js/engine.js:276 | js/bank-loans-covenants.js:22, js/engine.js:2254, js/player-crisis.js:53 ほか6件 ／ 検証のみ js/difficulty-scenario-balance.js:104 / 複製のみ js/engine.js:276 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `scenario` | string | js/completion.js:212, js/difficulty-scenario-balance.js:34, js/difficulty-scenario-balance.js:36 ほか1件 ／初期値 js/engine.js:276 | js/difficulty-scenario-balance.js:35, js/difficulty-scenario-balance.js:94, js/difficulty-scenario-balance.js:97 ほか3件 ／ 検証のみ js/difficulty-scenario-balance.js:104 / 複製のみ js/engine.js:276 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(静) |
| `economy` | number | js/expansion.js:880, js/deterministic-economic-foundation.js:13, js/macro-cycle.js:30 ほか1件 ／初期値 js/engine.js:277 | js/management-context.js:267, js/expansion.js:700, js/expansion.js:860 ほか19件 ／ 検証のみ js/macro-cycle.js:31 / 複製のみ js/management-context.js:121 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `season` | number | js/deterministic-economic-foundation.js:13, js/engine.js:2437 ／初期値 js/engine.js:277 | js/management-context.js:267, js/app.js:381, js/app.js:709 ほか5件 ／ 複製のみ js/management-context.js:121 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `policyRate` | number | js/deterministic-economic-foundation.js:13, js/macro-cycle.js:30, js/engine.js:2437 ほか1件 ／初期値 js/engine.js:277 | js/personal-real-estate-mortgage.js:64, js/expansion.js:879, js/deterministic-economic-foundation.js:15 ほか12件 ／ 複製のみ js/deterministic-economic-foundation.js:13 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `realEstateCycle` | number | js/deterministic-economic-foundation.js:13, js/macro-cycle.js:30, js/engine.js:2437 ほか2件 ／初期値 js/engine.js:277 | js/real-estate-agency-pipeline.js:48, js/expansion.js:860, js/engine.js:2366 ほか4件 ／ 複製のみ js/management-context.js:417 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `inflation` | number | js/deterministic-economic-foundation.js:13, js/macro-cycle.js:29, js/macro-cycle.js:30 ほか2件 ／初期値 js/engine.js:277 | js/management-context.js:145, js/management-context.js:236, js/app.js:318 ほか16件 ／ 複製のみ js/management-context.js:130 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `exchangeRate` | number | js/deterministic-economic-foundation.js:13, js/macro-cycle.js:30, js/engine.js:2437 ／初期値 js/engine.js:277 | js/deterministic-economic-foundation.js:15, js/app.js:552, js/engine.js:814 ほか2件 ／ 複製のみ js/deterministic-economic-foundation.js:13 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `companyCash` | number | js/workforce.js:93, js/workforce.js:94, js/inter-subsidiary-synergy-allocation.js:23 ほか140件 ／初期値 js/completion.js:265 | js/ui3-business.js:136, js/ui3-business.js:169, js/ui3-business.js:202 ほか268件 ／ 検証のみ js/finance.js:603 / 複製のみ js/player-crisis-turnaround-fund.js:139 / ハッシュ semantic-hash-v2.js:11 / 保存/ハッシュ js/save-v9.js:23 | 〇 | 稼働(動) |
| `companyDebt` | number | js/player-crisis-actions.js:56, js/player-debt-service.js:26, js/real-estate.js:42 ほか23件 ／初期値 js/engine.js:278 | js/player-crisis-creditor.js:93, js/player-crisis-ui.js:127, js/capital-allocation-score.js:31 ほか66件 ／ 検証のみ js/finance.js:603 / 複製のみ js/real-estate.js:52 / ハッシュ semantic-hash-v2.js:11 | 〇 | 稼働(動) |
| `companyCredit` | number | js/player-crisis-creditor.js:193, js/expansion.js:337, js/parity.js:109 ほか15件 ／初期値 js/engine.js:278 | js/player-crisis-creditor.js:90, js/player-crisis-creditor.js:189, js/player-crisis-creditor.js:198 ほか9件 ／ ハッシュ semantic-hash-v2.js:11 | 〇 | 稼働(動) |
| `companyReputation` | number | js/expansion.js:679, js/expansion.js:714, js/capital-allocation-score.js:33 ほか17件 ／初期値 js/engine.js:278 | js/app.js:715, js/ui3-media.js:24, js/ma-deal-room.js:88 ほか3件 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `personalCash` | number | js/personal-real-estate-mortgage.js:153, js/personal-real-estate-mortgage.js:179, js/personal-real-estate-mortgage.js:220 ほか53件 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:253, js/personal-real-estate-mortgage.js:176, js/personal-real-estate-mortgage.js:242 ほか70件 ／ 複製のみ js/personal-real-estate-mortgage.js:153 / ハッシュ semantic-hash-v2.js:11 | 〇 | 稼働(動) |
| `personalDebt` | number | js/personal-real-estate-mortgage.js:209, js/real-estate.js:42, js/real-estate.js:52 ほか10件 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:373, js/phase3-founder-wealth.js:389, js/app.js:578 ほか11件 ／ 複製のみ js/personal-real-estate-mortgage.js:209 / ハッシュ semantic-hash-v2.js:11 | 〇 | 稼働(動) |
| `personalFame` | number | js/expansion.js:340, js/expansion.js:715, js/completion.js:249 ほか2件 ／初期値 js/engine.js:279 | —（ハッシュ semantic-hash-v2.js:17） ／ js/expansion.js:340,715・completion.js:249・engine.js:1743 が加算。読み手なし（決定論ハッシュ semantic-hash-v2.js:17 のみ） | 〇 | 値だけ |
| `publicCompany` | boolean | js/engine.js:1675, js/engine.js:1859, js/listed-subsidiary-control-actions.js:22 ほか1件 ／初期値 js/engine.js:280 | js/phase3-founder-wealth.js:179, js/phase3-founder-wealth.js:258, js/phase3-founder-wealth.js:477 ほか151件 ／ 検証のみ js/ma-acquisition-financing.js:275 / 複製のみ js/economic-read-model.js:167 / ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(動) |
| `sharesOut` | number | js/phase3-ownership-apply.js:41, js/expansion.js:402, js/phase3-ownership-planner.js:193 ほか4件 ／初期値 js/engine.js:280 | js/player-crisis-turnaround-fund.js:95, js/player-crisis-turnaround-fund.js:176, js/phase3-ownership-apply.js:13 ほか42件 ／ 複製のみ js/phase3-ownership-planner.js:193 / ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(動) |
| `founderShares` | number | js/phase3-ownership-apply.js:43, js/expansion.js:402, js/expansion.js:418 ほか2件 ／初期値 js/engine.js:280 | js/phase3-ownership-apply.js:12, js/expansion.js:393, js/expansion.js:414 ほか18件 ／ 複製のみ js/phase3-ownership-planner.js:193 / ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(動) |
| `stockPrice` | number | js/expansion.js:402, js/shareholder-returns.js:34, js/capital-allocation-score.js:33 ほか4件 ／初期値 js/engine.js:280 | js/phase3-founder-wealth.js:260, js/expansion.js:392, js/expansion.js:418 ほか27件 ／ 検証のみ js/ma-acquisition-financing.js:275 / 複製のみ js/finance.js:289 / ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(静) |
| `dividendPerShare` | number | js/expansion.js:400, js/expansion.js:402, js/expansion.js:405 ほか3件 ／初期値 js/engine.js:281 | js/expansion.js:400, js/expansion.js:402, js/expansion.js:405 ほか16件 ／ 複製のみ js/engine.js:1874 / ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(動) |
| `treasuryBuybackShares` | number | js/phase3-ownership-apply.js:42, js/expansion.js:402, js/shareholder-returns.js:34 ／初期値 js/engine.js:281 | js/phase3-ownership-apply.js:13, js/expansion.js:393, js/shareholder-returns.js:30 ほか23件 ／ ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(動) |
| `selectedListingMarket` | string | js/engine.js:1859 ／初期値 js/engine.js:281 | js/app.js:429, js/completion.js:114 | 〇 | 稼働(静) |
| `externalShareholderRatio` | number | js/engine.js:2056, js/ma-acquisition-financing.js:345 ／初期値 js/engine.js:282 | js/expansion.js:888, js/shareholder-returns.js:34, js/app.js:596 ほか4件 ／ ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(静) |
| `founderOwnershipRatio` | number | js/engine.js:2056, js/ma-acquisition-financing.js:345 ／初期値 js/engine.js:282 | js/expansion.js:888, js/shareholder-returns.js:34, js/app.js:429 ほか11件 | 〇 | 稼働(動) |
| `competitorOwnedRatio` | number | js/expansion.js:676, js/completion.js:155, js/engine.js:2050 ほか2件 ／初期値 js/engine.js:282 | js/expansion.js:888, js/shareholder-returns.js:34, js/app.js:596 ほか7件 ／ ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(動) |
| `selectedArea` | string | 初期値のみ: js/engine.js:283 | —（複製のみ js/management-context.js:254） ／ 書込なし（初期値 js/engine.js:283 のみ）。management-context.js:254 が `selectedArea:state?.selectedArea` を別オブジェクトへ複製するだけで、その複製の読み手もなし | 〇 | 初期値のみ |
| `selectedPref` | string | js/app.js:981 ／初期値 js/engine.js:268 | js/expansion.js:294, js/simulation-rng.js:26, js/d-ui-shell.js:183 ほか6件 ／ 複製のみ js/management-context.js:254 | 〇 | 稼働(動) |
| `selectedBusiness` | string | js/app.js:981 ／初期値 js/engine.js:283 | js/d-ui-shell.js:189, js/app.js:232, js/app.js:349 ほか2件 ／ 複製のみ js/app.js:50 | 〇 | 稼働(静) |
| `selectedTab` | string | js/app.js:917, js/app.js:960, js/completion.js:212 ほか1件 ／初期値 js/engine.js:283 | js/capital-allocation-decision-memo.js:28, js/inter-subsidiary-synergy-allocation.js:25, js/capital-allocation-stress-test.js:34 ほか65件 | 〇 | 稼働(動) |
| `companyHQPrefID` | string | js/expansion.js:304, js/save-v9.js:89, js/engine.js:543 ／初期値 js/engine.js:283 | js/pe-network-sourcing.js:59, js/expansion.js:243, js/d-ui-shell.js:186 ほか3件 ／ ハッシュ semantic-hash-v2.js:13 / 保存/ハッシュ js/save-v9.js:89 | 〇 | 稼働(静) |
| `businesses` | array | js/save-v9.js:76, js/engine.js:799 ／初期値 js/engine.js:284 | js/workforce.js:46, js/workforce.js:50, js/workforce.js:65 ほか52件 ／ 検証のみ js/engine.js:519 / 複製のみ js/engine.js:284 / ハッシュ semantic-hash-v2.js:13 / 保存/ハッシュ js/semantic-hash-v2.js:23 | 〇 | 稼働(動) |
| `areas` | array | 初期値のみ: js/engine.js:284 | js/management-context.js:93, js/management-context.js:187, js/management-context.js:295 ほか8件 ／ 複製のみ js/pe-portfolio-operations.js:138 | 〇 | 稼働(動) |
| `prefs` | array | 初期値のみ: js/engine.js:284 | js/ui3-setup.js:12, js/management-context.js:93, js/management-context.js:187 ほか27件 ／ 複製のみ js/management-context.js:255 | 〇 | 稼働(動) |
| `stores` | array | js/engine.js:496, js/engine.js:800, js/engine.js:1101 ほか5件 ／初期値 js/completion.js:235 | js/ui3-business.js:43, js/ui3-business.js:120, js/ui3-business.js:131 ほか160件 ／ 検証のみ js/workforce.js:111 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `properties` | array | js/real-estate-property-disposals.js:39, js/save-storage.js:141 ／初期値 js/engine.js:285 | js/phase3-founder-wealth.js:295, js/real-estate-rent-performance.js:8, js/real-estate-rent-pricing.js:10 ほか101件 ／ 複製のみ js/capital-allocation-recovery-funding.js:111 / ハッシュ semantic-hash-v2.js:14 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `tenants` | array | 初期値のみ: js/engine.js:285 | js/pe-network-sourcing.js:115, js/expansion.js:328, js/app.js:229 ほか16件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `rentalOffices` | array | 初期値のみ: js/engine.js:285 | js/app.js:229, js/finance.js:99, js/completion.js:83 ほか4件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `market` | array | js/real-estate-rent-performance.js:8, js/microcap-listings.js:45, js/completion.js:212 ほか7件 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:259, js/real-estate-rent-performance.js:8, js/microcap-listings.js:45 ほか68件 ／ 複製のみ js/completion.js:212 / ハッシュ semantic-hash-v2.js:17 / 保存/ハッシュ js/save-storage.js:140 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `startups` | array | js/expansion.js:511, js/completion.js:217, js/completion.js:218 ／初期値 js/engine.js:286 | js/workforce.js:50, js/microcap-listings.js:18, js/expansion.js:281 ほか40件 ／ 複製のみ js/engine.js:286 / ハッシュ semantic-hash-v2.js:15 / 保存/ハッシュ js/save-storage.js:143 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `microcapMarket` | object | js/microcap-listings.js:32 ／初期値 js/engine.js:286 | js/microcap-listings.js:24, js/microcap-listings.js:27, js/microcap-listings.js:32 ／ ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `executives` | object | js/executive-reviews-succession-board.js:15, js/executives-department-assignments.js:8, js/executives-department-assignments.js:12 ほか2件 ／初期値 js/engine.js:287 | js/workforce.js:50, js/player-crisis-creditor.js:91, js/pe-network-sourcing.js:136 ほか40件 ／ ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `executiveMarket` | array | js/engine.js:1421, js/engine.js:1437 ／初期値 js/engine.js:287 | js/pe-network-sourcing.js:133, js/app.js:427, js/app.js:929 ほか2件 ／ ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(静) |
| `competitors` | array | 初期値のみ: js/engine.js:287 | js/microcap-listings.js:19, js/management-context.js:113, js/management-context.js:200 ほか22件 ／ 複製のみ js/management-context.js:255 / ハッシュ semantic-hash-v2.js:16 | 〇 | 稼働(動) |
| `departments` | object | js/engine.js:1410 ／初期値 js/engine.js:288 | js/ui3-business.js:215, js/workforce.js:38, js/workforce.js:43 ほか76件 ／ 検証のみ js/workforce.js:111 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `departmentStaff` | object | js/workforce.js:47, js/engine.js:1410 ／初期値 js/engine.js:288 | js/workforce.js:45, js/workforce.js:48, js/ui3-office.js:68 ほか10件 ／ 検証のみ js/workforce.js:111 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `officeFloors` | array | js/engine.js:1380, js/engine.js:1411 ／初期値 js/engine.js:288 | js/engine.js:1380 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(静) |
| `hasHeadOffice` | boolean | js/engine.js:1348, js/engine.js:1355 ／初期値 js/engine.js:289 | js/ui3-office.js:29, js/ui3-office.js:43, js/ui3-office.js:56 ほか26件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `officeLevel` | number | 初期値のみ: js/engine.js:289 | —（ハッシュ semantic-hash-v2.js:14） | 〇 | 初期値のみ |
| `officeName` | string | js/engine.js:1349, js/engine.js:1355 ／初期値 js/engine.js:289 | js/ui3-office.js:29, js/app.js:416, js/app.js:421 ほか1件 | 〇 | 稼働(静) |
| `officePrestige` | number | js/completion.js:87, js/engine.js:1349 ／初期値 js/engine.js:289 | —（ハッシュ semantic-hash-v2.js:14） | 〇 | 値だけ |
| `officeCapacity` | number | js/completion.js:87, js/completion.js:92, js/engine.js:1349 ほか1件 ／初期値 js/engine.js:290 | js/workforce.js:49, js/workforce.js:93, js/ui3-office.js:63 ほか8件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `officeWeeklyCost` | number | js/engine.js:1349, js/engine.js:1355 ／初期値 js/engine.js:290 | js/ui3-office.js:31, js/app.js:421, js/completion.js:79 ほか1件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `contractedOfficeID` | null | js/engine.js:1348, js/engine.js:1355 ／初期値 js/engine.js:290 | js/app.js:233, js/finance.js:99, js/completion.js:84 ほか1件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(静) |
| `boardEstablished` | boolean | js/engine.js:1472 ／初期値 js/engine.js:291 | js/app.js:429, js/engine.js:1470, js/engine.js:1829 ほか1件 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `boardAgendas` | array | js/engine.js:2610 ／初期値 js/engine.js:291 | js/app.js:429 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(静) |
| `investorOffers` | array | js/expansion.js:441, js/expansion.js:443 ／初期値 js/engine.js:291 | js/expansion.js:450, js/expansion.js:473, js/app.js:429 ほか2件 ／ ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(動) |
| `personalStocks` | object | js/economic-read-model.js:881, js/completion.js:212, js/personal-stock-margin.js:172 ／初期値 js/completion.js:211 | js/phase3-ownership-apply.js:36, js/phase3-ownership-apply.js:44, js/expansion.js:393 ほか22件 ／ 複製のみ js/completion.js:211 / ハッシュ semantic-hash-v2.js:11 | 〇 | 稼働(動) |
| `companyStocks` | object | 初期値のみ: js/engine.js:292 | js/phase3-founder-wealth.js:473, js/expansion.js:393, js/expansion.js:401 ほか19件 ／ ハッシュ semantic-hash-v2.js:11 | 〇 | 稼働(動) |
| `favoriteStockIds` | array | 初期値のみ: js/engine.js:292 | js/app.js:436, js/app.js:438, js/app.js:456 ほか4件 | 〇 | 稼働(動) |
| `realizedCompanyStockPL` | number | 初期値のみ: js/engine.js:292 | —（ハッシュ semantic-hash-v2.js:11） ／ 書込は計算キー経由 js/engine.js:1509（`this.g[account==='company'?'realizedCompanyStockPL':'realizedPersonalStockPL']+=profit`）。読み手なし | 〇 | 値だけ |
| `realizedPersonalStockPL` | number | js/engine.js:2021, js/personal-stock-margin.js:173 ／初期値 js/engine.js:292 | —（複製のみ js/engine.js:2021 / ハッシュ semantic-hash-v2.js:11） | 〇 | 値だけ |
| `subsidiaries` | array | js/inter-subsidiary-synergy-allocation.js:19, js/expansion.js:683, js/expansion.js:693 ほか17件 ／初期値 js/completion.js:235 | js/inter-subsidiary-synergy-allocation.js:19, js/inter-subsidiary-synergy-allocation.js:20, js/inter-subsidiary-synergy-allocation.js:24 ほか86件 ／ 複製のみ js/group-holding-governance.js:15 / ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `acquisitionTargets` | array | js/ma-deal-room.js:68, js/ma-deal-room.js:122, js/engine.js:1887 ほか8件 ／初期値 js/engine.js:293 | js/workforce.js:50, js/ui3-ma.js:30, js/ui3-ma.js:54 ほか40件 ／ 複製のみ js/ma-deal-room.js:68 / ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `maSubsidiaries` | array | js/ma-integration.js:24, js/new-business-commercialization.js:8, js/pmi-100-day-plan.js:16 ほか3件 ／初期値 js/engine.js:293 | js/group-holding-governance.js:10, js/ui3-ma.js:30, js/ui3-ma.js:80 ほか47件 ／ 複製のみ js/ma-integration.js:24 / ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `goodwillRecords` | array | js/ma-deal-room.js:122, js/engine.js:1909 ／初期値 js/engine.js:293 | js/ma-portfolio-summary.js:14, js/finance.js:100, js/ma-exit-readiness.js:15 ほか2件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `tenderOffers` | array | 初期値のみ: js/engine.js:293 | —（ハッシュ semantic-hash-v2.js:12） | 〇 | 初期値のみ |
| `totalAcquisitions` | number | js/pe-portfolio-operations.js:953, js/ma-deal-room.js:122, js/engine.js:1910 ／初期値 js/engine.js:294 | js/app.js:510, js/app.js:761, js/founding-tutorial.js:21 ほか2件 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `totalMAGain` | number | js/engine.js:1915 ／初期値 js/engine.js:294 | js/app.js:510 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `totalImpairmentLoss` | number | js/engine.js:2375 ／初期値 js/engine.js:294 | js/app.js:510 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `productVentures` | array | js/completion.js:140, js/engine.js:1684, js/engine.js:1719 ／初期値 js/engine.js:295 | js/workforce.js:50, js/ui3-office.js:57, js/expansion.js:285 ほか40件 ／ 検証のみ js/product-lifecycle.js:111 / ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `productBuyoutOffers` | array | js/completion.js:64, js/completion.js:252 ／初期値 js/engine.js:295 | js/app.js:407, js/completion.js:140, js/completion.js:142 ほか1件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `productExitCount` | number | js/completion.js:140, js/engine.js:1719 ／初期値 js/engine.js:295 | —（ハッシュ semantic-hash-v2.js:14） | 〇 | 値だけ |
| `formalProductLaunchCount` | number | js/engine.js:828, js/engine.js:1686 ／初期値 js/engine.js:295 | js/engine.js:827, js/engine.js:1693 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `franchiseStoresByBusinessID` | object | 初期値のみ: js/engine.js:296 | js/ui3-business.js:198, js/app.js:410, js/engine.js:1970 ほか3件 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `franchiseRoyaltyRateByBusinessID` | object | 初期値のみ: js/engine.js:296 | js/app.js:410, js/engine.js:1972, js/engine.js:2434 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(静) |
| `franchiseQualityByBusinessID` | object | 初期値のみ: js/engine.js:296 | js/app.js:410, js/engine.js:1972, js/engine.js:2434 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(静) |
| `franchiseTrustByBusinessID` | object | 初期値のみ: js/engine.js:296 | js/engine.js:1972 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(静) |
| `overseasSubsidiaries` | array | js/engine.js:812, js/engine.js:1959 ／初期値 js/engine.js:297 | js/app.js:554, js/parity.js:102, js/founding-tutorial.js:21 ほか10件 ／ ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `personalInvestments` | array | js/completion.js:212, js/engine.js:1751, js/engine.js:1763 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:295, js/app.js:574, js/engine.js:1013 ほか2件 ／ 複製のみ js/completion.js:211 / ハッシュ semantic-hash-v2.js:11 | 〇 | 稼働(動) |
| `luxuryAssets` | array | js/expansion.js:715, js/completion.js:212, js/engine.js:1743 ほか1件 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:295, js/app.js:575, js/engine.js:1014 ほか2件 ／ 複製のみ js/completion.js:211 / ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `sportsTeams` | array | js/expansion.js:712, js/completion.js:212, js/engine.js:1768 ほか1件 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:295, js/expansion.js:708, js/expansion.js:709 ほか15件 ／ 複製のみ js/completion.js:212 / ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `peDeals` | array | js/expansion.js:689, js/completion.js:212 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:221, js/phase3-founder-wealth.js:225, js/phase3-founder-wealth.js:284 ほか12件 ／ 複製のみ js/completion.js:212 / ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `peRivals` | array | js/pe-rivals.js:67, js/pe-rivals.js:102 ／初期値 js/engine.js:297 | js/pe-portfolio-operations.js:22, js/pe-rivals.js:18, js/pe-rivals.js:67 ほか3件 ／ ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(静) |
| `cxoExecutives` | array | 初期値のみ: js/engine.js:298 | —（ハッシュ semantic-hash-v2.js:13） | 〇 | 初期値のみ |
| `executiveDirectives` | array | js/engine.js:1982 ／初期値 js/engine.js:298 | js/engine.js:2360 ／ ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `departmentCampaigns` | array | js/engine.js:1987 ／初期値 js/engine.js:298 | js/engine.js:1398, js/engine.js:1409, js/engine.js:2361 ／ ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `internalVentureProposals` | array | js/engine.js:1991, js/engine.js:1995, js/engine.js:2363 ／初期値 js/engine.js:298 | js/app.js:430, js/engine.js:1994, js/engine.js:2612 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `internalVentures` | array | js/internal-venture-business.js:33, js/engine.js:1995 ／初期値 js/engine.js:298 | js/app.js:430, js/finance.js:99, js/internal-venture-business.js:35 ほか4件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `employeeSatisfaction` | number | js/workforce.js:55, js/app.js:936, js/executive-reviews-succession-board.js:15 ほか3件 ／初期値 js/engine.js:299 | js/workforce.js:41, js/workforce.js:42, js/workforce.js:44 ほか14件 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `employeeAbility` | number | js/workforce.js:55 ／初期値 js/engine.js:299 | js/workforce.js:41, js/workforce.js:42, js/workforce.js:44 ほか3件 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `wageLevel` | number | js/pe-portfolio-operations.js:123, js/pe-portfolio-operations.js:637 ／初期値 js/engine.js:299 | js/pe-portfolio-operations.js:279, js/pe-portfolio-operations.js:287, js/pe-portfolio-operations.js:534 ほか8件 ／ 複製のみ js/management-context.js:135 / ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(静) |
| `benefitLevel` | number | js/app.js:936 ／初期値 js/engine.js:299 | js/workforce.js:85 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(静) |
| `remoteWorkEnabled` | boolean | js/app.js:937 ／初期値 js/engine.js:299 | js/workforce.js:49, js/workforce.js:85, js/ui3-office.js:42 ほか5件 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `organizationCulture` | object | js/workforce.js:55, js/engine.js:792 ／初期値 js/engine.js:300 | js/workforce.js:41, js/workforce.js:42, js/workforce.js:44 ほか9件 ／ 複製のみ js/workforce.js:55 / ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `autoManage` | boolean | 初期値のみ: js/engine.js:301 | js/app.js:834, js/ui3-settings.js:27, js/engine.js:2520 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `autoManageStyle` | string | 初期値のみ: js/engine.js:301 | js/app.js:834, js/ui3-settings.js:27, js/engine.js:2441 ほか2件 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `autoExecutiveManagementEnabled` | boolean | 初期値のみ: js/engine.js:301 | —（ハッシュ semantic-hash-v2.js:17） | 〇 | 初期値のみ |
| `esgScore` | number | 初期値のみ: js/engine.js:302 | js/parity.js:102 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `complianceLevel` | number | 初期値のみ: js/engine.js:302 | —（ハッシュ semantic-hash-v2.js:17） | 〇 | 初期値のみ |
| `globalPrestige` | number | js/parity.js:102 ／初期値 js/engine.js:302 | js/app.js:552 ／ 複製のみ js/parity.js:102 / ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `founderAge` | number | js/expansion.js:792, js/completion.js:212, js/engine.js:2521 ／初期値 js/completion.js:211 | js/expansion.js:745, js/app.js:740, js/ui3-legacy.js:29 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `founderGeneration` | number | js/expansion.js:792, js/completion.js:212 ／初期値 js/completion.js:211 | js/expansion.js:747, js/expansion.js:765, js/expansion.js:787 ほか4件 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `macroCrisis` | null | js/deterministic-economic-foundation.js:13, js/engine.js:2438 ／初期値 js/engine.js:303 | js/management-context.js:118, js/management-context.js:204, js/management-context.js:268 ほか13件 ／ ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `scheduledPayments` | array | 初期値のみ: js/engine.js:303 | —（ハッシュ semantic-hash-v2.js:11） | 〇 | 初期値のみ |
| `currentCompanyFoundedInvestment` | number | js/pe-fund.js:133, js/pe-fund.js:1115, js/pe-fund.js:1122 ／初期値 js/engine.js:303 | js/pe-fund.js:133, js/pe-fund.js:243 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(静) |
| `reports` | array | js/engine.js:811, js/engine.js:2572, js/save-storage.js:133 ほか1件 ／初期値 js/engine.js:215 | js/progression-balance.js:12, js/expansion.js:904, js/d-ui-shell.js:46 ほか12件 ／ 複製のみ js/save-storage.js:133 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `lastReport` | object | js/engine.js:2572, js/ma-acquisition-financing.js:214 ／初期値 js/engine.js:304 | js/expansion.js:879, js/expansion.js:892, js/expansion.js:904 ほか37件 | 〇 | 稼働(動) |
| `weeklySalesHistory` | array | js/engine.js:2600, js/save-storage.js:134 ／初期値 js/engine.js:304 | js/expansion.js:908, js/app.js:997, js/engine.js:2601 ／ 複製のみ js/save-storage.js:134 / ハッシュ semantic-hash-v2.js:18 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `weeklyProfitHistory` | array | js/engine.js:2600, js/save-storage.js:135 ／初期値 js/engine.js:304 | js/expansion.js:908, js/app.js:997, js/parity.js:119 ほか2件 ／ 複製のみ js/save-storage.js:135 / ハッシュ semantic-hash-v2.js:18 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `companyValueHistory` | array | js/engine.js:2600, js/save-storage.js:136 ／初期値 js/engine.js:304 | js/expansion.js:908, js/app.js:584, js/app.js:997 ほか3件 ／ 複製のみ js/save-storage.js:136 / ハッシュ semantic-hash-v2.js:18 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `personalNetWorthHistory` | array | js/engine.js:2600, js/save-storage.js:137 ／初期値 js/engine.js:304 | js/expansion.js:908, js/app.js:997 ／ 複製のみ js/save-storage.js:137 / ハッシュ semantic-hash-v2.js:18 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `news` | array | js/player-crisis-turnaround-fund.js:121, js/expansion.js:341, js/expansion.js:780 ほか77件 ／初期値 js/completion.js:211 | js/workforce.js:84, js/player-crisis-turnaround-fund.js:121, js/expansion.js:905 ほか31件 ／ 複製のみ js/ma-integration.js:23 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `history` | array | js/player-crisis-creditor.js:63, js/player-crisis-creditor.js:199, js/player-crisis-creditor.js:200 ほか110件 ／初期値 js/completion.js:211 | js/player-crisis-creditor.js:79, js/player-crisis-creditor.js:81, js/player-crisis-creditor.js:85 ほか29件 ／ 検証のみ js/player-crisis-creditor.js:215 / 複製のみ js/player-crisis-creditor.js:63 / ハッシュ semantic-hash-v2.js:18 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `competitorEvents` | array | js/competitor-distress.js:50, js/competitor-distress.js:51, js/competitor-distress.js:77 ほか13件 ／初期値 js/engine.js:305 | js/competitor-distress.js:50, js/competitor-distress.js:77, js/competitor-distress.js:78 ほか18件 ／ ハッシュ semantic-hash-v2.js:16 | 〇 | 稼働(動) |
| `productEvents` | array | js/engine.js:2355 ／初期値 js/engine.js:305 | —（ハッシュ semantic-hash-v2.js:14） | 〇 | 値だけ |
| `activeMissionIDs` | array | js/engine.js:2605 ／初期値 js/engine.js:306 | js/app.js:761, js/executive-secretary.js:68, js/ui3-missions.js:13 ほか1件 | 〇 | 稼働(動) |
| `completedMissionIDs` | array | js/engine.js:2605 ／初期値 js/engine.js:306 | js/app.js:761, js/founding-tutorial.js:78, js/founding-tutorial.js:85 ほか4件 | 〇 | 稼働(動) |
| `achievements` | array | js/completion.js:212, js/engine.js:2607, js/hall-of-fame-generations.js:5 ほか1件 ／初期値 js/completion.js:211 | js/app.js:761, js/ui3-missions.js:19, js/engine.js:2607 ほか2件 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `unlockedEndings` | array | js/expansion.js:778, js/completion.js:212, js/completion.js:235 ／初期値 js/completion.js:211 | js/expansion.js:778, js/completion.js:235 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(静) |
| `gameOver` | boolean | js/completion.js:212, js/engine.js:2574, js/player-crisis.js:129 ほか3件 ／初期値 js/engine.js:307 | js/player-crisis-creditor.js:133, js/player-crisis-creditor.js:148, js/player-crisis-creditor.js:180 ほか27件 ／ 検証のみ js/player-crisis.js:101 / ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `gameOverReason` | string | js/completion.js:212, js/engine.js:2574, js/player-crisis.js:130 ほか2件 ／初期値 js/engine.js:307 | js/app.js:837, js/player-crisis.js:164, js/player-crisis.js:204 ほか1件 ／ 検証のみ js/player-crisis.js:101 | 〇 | 稼働(静) |
| `isCompanySold` | boolean | js/completion.js:212, js/engine.js:2024 ／初期値 js/engine.js:307 | js/player-crisis-creditor.js:133, js/player-crisis-creditor.js:148, js/player-crisis-creditor.js:180 ほか45件 ／ ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `hasSeenCompanyBuyoutEnding` | boolean | js/completion.js:212, js/engine.js:2025 ／初期値 js/engine.js:307 | — | 〇 | 値だけ |
| `lastSaveDate` | string | js/engine.js:943, js/save-storage.js:175, js/iphone-baseline-probe.js:52 ほか2件 ／初期値 js/engine.js:308 | js/app.js:835 ／ 保存/ハッシュ js/save-storage-idb.js:129 | 〇 | 稼働(動) |
| `settings` | object | js/save-v9.js:177, js/completion.js:212, js/engine.js:969 ほか1件 ／初期値 js/completion.js:211 | js/d-ui-shell.js:16, js/d-ui-shell.js:21, js/app.js:83 ほか7件 ／ 検証のみ js/engine.js:520 / 複製のみ js/completion.js:211 / 保存/ハッシュ js/save-v9.js:175 | 〇 | 稼働(動) |
| `lastWeeklySummary` | object | js/expansion.js:905, js/parity.js:119, js/completion.js:265 ほか1件 ／初期値 js/engine.js:309 | js/expansion.js:906, js/player-turnaround-plan-report.js:40, js/player-turnaround-plan-report.js:60 ほか19件 | 〇 | 稼働(動) |
| `marketResultsByStoreID` | object | js/engine.js:493, js/engine.js:807, js/engine.js:2526 ほか1件 ／初期値 js/engine.js:309 | js/app.js:380, js/app.js:401, js/competitor-projects.js:163 ほか3件 ／ 複製のみ js/engine.js:493 / ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(静) |
| `marketResultsByBusinessID` | object | js/engine.js:494, js/engine.js:808, js/engine.js:2526 ／初期値 js/engine.js:309 | js/workforce.js:50, js/app.js:401, js/competitor-projects.js:165 ほか1件 ／ 複製のみ js/engine.js:494 / ハッシュ semantic-hash-v2.js:17 | 〇 | 稼働(動) |
| `lastMarketCalculationCount` | number | js/engine.js:495, js/engine.js:2526 ／初期値 js/engine.js:309 | js/app.js:401 ／ 複製のみ js/engine.js:495 | 〇 | 稼働(静) |
| `inventoryByStoreID` | object | js/supply.js:25, js/supply.js:62 ／初期値 js/engine.js:309 | js/ui3-business.js:99, js/app.js:698, js/iphone-playtest-fixes.js:117 ほか11件 ／ 検証のみ js/supply.js:67 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `purchaseOrders` | array | js/engine.js:437, js/supply.js:25, js/supply.js:41 ほか1件 ／初期値 js/engine.js:309 | js/workforce.js:50, js/app.js:698, js/engine.js:437 ほか7件 ／ 検証のみ js/supply.js:67 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `supplySettingsByStoreID` | object | js/supply.js:25, js/supply.js:62 ／初期値 js/engine.js:309 | js/ui3-business.js:89, js/ui3-business.js:122, js/app.js:698 ほか9件 ／ ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(静) |
| `supplyResultsByStoreID` | object | js/supply.js:25, js/supply.js:62 ／初期値 js/engine.js:309 | js/app.js:698, js/iphone-playtest-fixes.js:117, js/supply.js:25 ほか3件 ／ ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(静) |
| `supplyResultsByBusinessID` | object | js/supply.js:25 ／初期値 js/engine.js:309 | js/supply.js:25, js/supply.js:59 ／ ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `nextPurchaseOrderSeq` | number | js/supply.js:25, js/supply.js:41 ／初期値 js/engine.js:309 | js/supply.js:25, js/supply.js:41, js/supply.js:48 ／ ハッシュ semantic-hash-v2.js:19 ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `nextInventoryLotSeq` | number | js/supply.js:25, js/supply.js:30 ／初期値 js/engine.js:309 | js/supply.js:25 ／ ハッシュ semantic-hash-v2.js:19 ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `nextSupplyEventSeq` | number | js/supply.js:25, js/supply.js:35 ／初期値 js/engine.js:309 | js/supply.js:25 ／ ハッシュ semantic-hash-v2.js:19 ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `finance` | object | js/capital-allocation-score.js:29, js/treasury-refinancing-policy.js:28, js/player-debt-service.js:18 ほか11件 ／初期値 js/engine.js:309 | js/phase3-founder-wealth.js:6, js/phase3-founder-wealth.js:9, js/phase3-founder-wealth.js:353 ほか229件 ／ 検証のみ js/difficulty-scenario-balance.js:104 / 複製のみ js/capital-allocation-score.js:29 / ハッシュ semantic-hash-v2.js:11 / 保存/ハッシュ js/save-v9.js:6 | 〇（長さ切詰あり: js/save-storage.js:115-129） | 稼働(動) |
| `workforceTeams` | array | js/workforce.js:40, js/workforce.js:44, js/workforce.js:46 ／初期値 js/engine.js:309 | js/workforce.js:40, js/workforce.js:44, js/workforce.js:45 ほか29件 ／ 検証のみ js/workforce.js:111 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `workforceCandidates` | array | js/workforce.js:40, js/workforce.js:87 ／初期値 js/engine.js:309 | js/workforce.js:40, js/workforce.js:50, js/workforce.js:87 ほか4件 ／ 検証のみ js/workforce.js:111 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `workforceTrainings` | array | js/workforce.js:40, js/workforce.js:94 ／初期値 js/engine.js:309 | js/workforce.js:40, js/workforce.js:51, js/workforce.js:84 ほか4件 ／ 検証のみ js/workforce.js:111 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `workforceProjects` | array | js/workforce.js:40, js/workforce.js:95 ／初期値 js/engine.js:309 | js/workforce.js:40, js/workforce.js:95, js/workforce.js:96 ほか5件 ／ 検証のみ js/workforce.js:111 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(動) |
| `workforceResultsByDepartmentID` | object | js/workforce.js:40, js/workforce.js:54, js/workforce.js:110 ／初期値 js/engine.js:309 | js/workforce.js:40, js/workforce.js:82, js/workforce.js:98 ほか5件 ／ ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(静) |
| `workforceResultsByStoreID` | object | js/workforce.js:40, js/workforce.js:100 ／初期値 js/engine.js:309 | js/workforce.js:40, js/workforce.js:83, js/workforce.js:100 ほか2件 ／ ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(静) |
| `workforceSettings` | object | js/workforce.js:40, js/workforce.js:99 ／初期値 js/engine.js:309 | js/workforce.js:40, js/workforce.js:50, js/workforce.js:83 ほか1件 ／ 検証のみ js/workforce.js:111 / 複製のみ js/workforce.js:99 / ハッシュ semantic-hash-v2.js:13 | 〇 | 稼働(静) |
| `nextWorkforceTeamSeq` | number | js/workforce.js:40, js/workforce.js:42 ／初期値 js/engine.js:309 | —（検証のみ js/workforce.js:111 / ハッシュ semantic-hash-v2.js:19） ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `nextCandidateSeq` | number | js/workforce.js:40, js/workforce.js:87 ／初期値 js/engine.js:309 | —（ハッシュ semantic-hash-v2.js:19） ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `nextTrainingSeq` | number | js/workforce.js:40, js/workforce.js:94 ／初期値 js/engine.js:309 | —（ハッシュ semantic-hash-v2.js:19） ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `nextProjectSeq` | number | js/workforce.js:40, js/workforce.js:95 ／初期値 js/engine.js:309 | —（ハッシュ semantic-hash-v2.js:19） ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `nextWorkforceEventSeq` | number | js/workforce.js:40, js/workforce.js:88, js/workforce.js:91 ほか1件 ／初期値 js/engine.js:309 | —（ハッシュ semantic-hash-v2.js:19） ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `competitorStates` | array | js/parity.js:97, js/parity.js:99, js/competitor-parity.js:66 ほか6件 ／初期値 js/engine.js:309 | js/competitor-media.js:79, js/competitor-media.js:93, js/competitor-media.js:95 ほか59件 ／ 複製のみ js/management-context.js:256 / ハッシュ semantic-hash-v2.js:16 | 〇 | 稼働(動) |
| `competitorActions` | array | js/competitor-media.js:109, js/competitor-distress.js:117, js/competitor-entry.js:73 ほか5件 ／初期値 js/engine.js:309 | js/competitor-media.js:108, js/competitor-distress.js:107, js/competitor-distress.js:115 ほか18件 ／ 検証のみ js/competitor-distress.js:190 / 複製のみ js/management-context.js:256 / ハッシュ semantic-hash-v2.js:16 | 〇 | 稼働(動) |
| `competitorMarketResultsByPresenceID` | object | js/competitor.js:46, js/competitor.js:70 ／初期値 js/engine.js:309 | js/competitor-dashboard.js:61, js/app.js:389, js/competitor.js:73 ／ 複製のみ js/management-context.js:257 | 〇 | 稼働(動) |
| `competitorMarketResultsByCompetitorID` | object | js/competitor.js:47, js/competitor.js:70 ／初期値 js/engine.js:309 | js/competitor.js:74 ／ 複製のみ js/management-context.js:258 | 〇 | 稼働(静) |
| `competitorSettings` | object | 初期値のみ: js/engine.js:309 | —（ハッシュ semantic-hash-v2.js:16） | 〇 | 初期値のみ |
| `nextCompetitorStateSeq` | number | js/competitor.js:50, js/competitor.js:63 ／初期値 js/engine.js:309 | —（複製のみ js/management-context.js:261 / ハッシュ semantic-hash-v2.js:19） ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `nextCompetitorPresenceSeq` | number | js/competitor-entry.js:59, js/competitor.js:51, js/competitor.js:63 ／初期値 js/engine.js:309 | —（複製のみ js/management-context.js:261 / ハッシュ semantic-hash-v2.js:19） ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `nextCompetitorActionSeq` | number | js/competitor-media.js:109, js/competitor-distress.js:116, js/competitor-entry.js:72 ほか3件 ／初期値 js/engine.js:309 | 動的: addAction@competitor ／ 複製のみ js/management-context.js:262 / ハッシュ semantic-hash-v2.js:19 ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(動) |
| `nextCompetitorInvestmentSeq` | number | js/competitor.js:53 ／初期値 js/engine.js:309 | js/competitor-projects.js:87 ／ 複製のみ js/management-context.js:262 / ハッシュ semantic-hash-v2.js:19 ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `competitorMigrationV8Applied` | boolean | js/competitor.js:56, js/competitor.js:66 ／初期値 js/engine.js:309 | js/competitor.js:56 ／ 複製のみ js/management-context.js:263 / ハッシュ semantic-hash-v2.js:16 | 〇 | 稼働(静) |
| `simulationRng` | object | js/simulation-rng.js:38, js/simulation-rng.js:69, js/engine.js:312 | js/microcap-listings.js:21, js/competitor-media.js:6, js/competitor-media.js:102 ほか31件 ／ 複製のみ js/engine.js:312 / ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `expansionVersion` | number | 初期値のみ: js/expansion.js:245 | — | 〇 | 初期値のみ |
| `founderName` | string | js/expansion.js:304, js/expansion.js:792, js/completion.js:212 ／初期値 js/completion.js:211 | js/expansion.js:304, js/expansion.js:780, js/app.js:610 ほか3件 ／ 複製のみ js/expansion.js:765 | 〇 | 稼働(動) |
| `founderHomePrefID` | string | js/expansion.js:271, js/expansion.js:305, js/completion.js:212 ／初期値 js/completion.js:211 | js/ui3-setup.js:12, js/pe-network-sourcing.js:59, js/pe-network-sourcing.js:85 ほか13件 ／ 複製のみ js/completion.js:211 / ハッシュ semantic-hash-v2.js:13 / 保存/ハッシュ js/save-v9.js:89 | 〇 | 稼働(動) |
| `founderHomePrefName` | string | js/expansion.js:305, js/completion.js:212 ／初期値 js/completion.js:211 | js/app.js:610, js/completion.js:107 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(静) |
| `founderOriginCityName` | string | js/expansion.js:305 ／初期値 js/expansion.js:246 | — | 〇 | 値だけ |
| `founderTraitID` | string | js/expansion.js:305, js/completion.js:212 ／初期値 js/completion.js:211 | js/expansion.js:270, js/expansion.js:294, js/expansion.js:298 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(静) |
| `currentFounderHomeRank` | string | js/expansion.js:349, js/expansion.js:797, js/completion.js:212 ／初期値 js/completion.js:211 | js/expansion.js:299, js/expansion.js:300, js/expansion.js:350 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `founderHomeLevel` | number | js/expansion.js:349, js/completion.js:212 ／初期値 js/completion.js:211 | js/expansion.js:348, js/ui3-founder.js:26, js/completion.js:107 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `founderHomeDeskSlots` | number | js/expansion.js:349 ／初期値 js/expansion.js:247 | — | 〇 | 値だけ |
| `founderHomeUsedSlots` | number | js/expansion.js:316 ／初期値 js/expansion.js:247 | js/expansion.js:317 | 〇 | 稼働(動) |
| `founderHomeMonthlyCost` | number | js/expansion.js:349 ／初期値 js/expansion.js:247 | js/expansion.js:796, js/app.js:612 | 〇 | 稼働(動) |
| `founderSkillBusiness` | number | js/expansion.js:306, js/expansion.js:330, js/expansion.js:339 ほか1件 ／初期値 js/completion.js:211 | js/app.js:610, js/ui3-founder.js:32 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `founderSkillTech` | number | js/expansion.js:306, js/expansion.js:331, js/expansion.js:338 ほか1件 ／初期値 js/completion.js:211 | js/expansion.js:814, js/expansion.js:839, js/app.js:610 ほか2件 ／ 複製のみ js/expansion.js:829 | 〇 | 稼働(動) |
| `founderSkillFinance` | number | js/expansion.js:306, js/expansion.js:332, js/completion.js:212 ／初期値 js/completion.js:211 | js/app.js:610, js/ui3-founder.js:32 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `founderSkillNegotiation` | number | js/expansion.js:306, js/expansion.js:333, js/expansion.js:339 ほか1件 ／初期値 js/completion.js:211 | js/app.js:610, js/ui3-founder.js:32 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `founderHomeActionLog` | array | js/expansion.js:308, js/expansion.js:326 ／初期値 js/expansion.js:249 | js/app.js:617, js/ui3-founder.js:47 | 〇 | 稼働(動) |
| `localReputationByPref` | object | 初期値のみ: js/expansion.js:249 | js/expansion.js:271, js/expansion.js:307, js/expansion.js:329 ほか3件 | 〇 | 稼働(動) |
| `recommendedTenantIDsFromHomeSearch` | array | js/expansion.js:329 ／初期値 js/expansion.js:249 | js/app.js:609, js/ui3-founder.js:42 | 〇 | 稼働(静) |
| `lastFounderHomeEventWeek` | number | 初期値のみ: js/expansion.js:249 | — | 〇 | 初期値のみ |
| `lastStoreHuntWeek` | number | js/expansion.js:329 ／初期値 js/expansion.js:249 | — | 〇 | 値だけ |
| `founderEducationLevel` | number | js/expansion.js:330, js/expansion.js:331, js/expansion.js:332 ほか3件 ／初期値 js/completion.js:211 | 動的: TycoonEngine.updateFounderExpandedWeekly@expansion ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `founderNetworkLevel` | number | js/expansion.js:333, js/expansion.js:703, js/expansion.js:714 ほか2件 ／初期値 js/completion.js:211 | js/engine.js:2615 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `successorReadiness` | number | js/expansion.js:703, js/expansion.js:717, js/expansion.js:718 ほか2件 ／初期値 js/expansion.js:250 | js/ui3-founder.js:27 | 〇 | 稼働(動) |
| `foundationEndowment` | number | js/expansion.js:703, js/completion.js:212 ／初期値 js/completion.js:211 | js/completion.js:41 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(静) |
| `foundationReputation` | number | js/expansion.js:703, js/completion.js:212 ／初期値 js/completion.js:211 | js/expansion.js:891, js/app.js:616, js/completion.js:41 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `lobbyInfluence` | number | js/expansion.js:703, js/completion.js:212 ／初期値 js/completion.js:211 | —（複製のみ js/completion.js:211） | 〇 | 値だけ |
| `supplierContracts` | array | js/expansion.js:356, js/supply.js:25, js/supply.js:35 ／初期値 js/expansion.js:251 | js/ui3-business.js:85, js/expansion.js:356, js/expansion.js:359 ほか5件 | 〇 | 稼働(静) |
| `inventoryByBusinessID` | object | js/supply.js:25 ／初期値 js/expansion.js:251 | js/expansion.js:273, js/expansion.js:802, js/supply.js:25 ほか1件 | 〇 | 稼働(動) |
| `supplyChainEvents` | array | js/expansion.js:810, js/supply.js:25, js/supply.js:60 ／初期値 js/expansion.js:251 | js/workforce.js:50, js/expansion.js:810, js/app.js:701 ほか3件 | 〇 | 稼働(動) |
| `autoSpotProcurement` | boolean | 初期値のみ: js/expansion.js:251 | js/expansion.js:804 | 〇 | 稼働(静) |
| `verticalIntegrationAssets` | array | js/expansion.js:364 ／初期値 js/expansion.js:251 | js/expansion.js:363, js/expansion.js:809, js/expansion.js:895 ほか2件 | 〇 | 稼働(動) |
| `rdProjects` | array | js/expansion.js:369 ／初期値 js/expansion.js:251 | js/expansion.js:368, js/expansion.js:814, js/app.js:709 ほか2件 | 〇 | 稼働(動) |
| `patentRecords` | array | js/expansion.js:814 ／初期値 js/expansion.js:251 | js/expansion.js:368, js/expansion.js:371, js/expansion.js:815 ほか8件 | 〇 | 稼働(動) |
| `patentLicenseIncome` | number | js/expansion.js:816 ／初期値 js/expansion.js:251 | — | 〇 | 値だけ |
| `customerSegmentsByBusinessID` | object | 初期値のみ: js/expansion.js:252 | js/expansion.js:274, js/app.js:710, js/ui3-strategy.js:45 | 〇 | 稼働(静) |
| `marketShareByBusinessID` | object | 初期値のみ: js/expansion.js:252 | js/expansion.js:275, js/expansion.js:807, js/app.js:710 ほか1件 | 〇 | 稼働(静) |
| `productFunnels` | object | js/expansion.js:374, js/player-engine-bridge.js:131 ／初期値 js/expansion.js:252 | js/expansion.js:374, js/app.js:588, js/player-engine-bridge.js:132 ほか1件 ／ 複製のみ js/expansion.js:374 | 〇 | 稼働(静) |
| `productFunnelEventLog` | array | js/expansion.js:843 ／初期値 js/expansion.js:252 | — | 〇 | 値だけ |
| `quarterlyStockResults` | object | 初期値のみ: js/expansion.js:253 | js/microcap-listings.js:45, js/expansion.js:278, js/expansion.js:886 ほか1件 | 〇 | 稼働(動) |
| `shareholderEventLog` | array | js/expansion.js:679, js/expansion.js:888 ／初期値 js/engine.js:422 | js/app.js:597, js/d-ui-context-tabs.js:82 | 〇 | 稼働(動) |
| `activistCampaigns` | array | js/expansion.js:888 ／初期値 js/expansion.js:253 | js/expansion.js:888, js/app.js:597 | 〇 | 稼働(動) |
| `ownershipHistory` | array | js/expansion.js:888 ／初期値 js/expansion.js:253 | — | 〇 | 値だけ |
| `stockSplitHistory` | array | js/expansion.js:408 ／初期値 js/expansion.js:253 | js/expansion.js:397 | 〇 | 稼働(静) |
| `founderShareSaleHistory` | array | js/expansion.js:418 ／初期値 js/expansion.js:253 | js/expansion.js:417 | 〇 | 稼働(静) |
| `startupFundingHistory` | object | 初期値のみ: js/expansion.js:254 | js/expansion.js:282, js/expansion.js:887, js/app.js:603 ほか10件 | 〇 | 稼働(動) |
| `startupQuarterlyReports` | object | 初期値のみ: js/expansion.js:254 | js/expansion.js:283, js/expansion.js:886, js/app.js:604 | 〇 | 稼働(動) |
| `ventureForumEvents` | array | js/expansion.js:881 ／初期値 js/engine.js:425 | js/expansion.js:714, js/expansion.js:881, js/app.js:721 ほか2件 | 〇 | 稼働(動) |
| `peRealizedPL` | number | js/expansion.js:691, js/expansion.js:693 ／初期値 js/expansion.js:255 | — | 〇 | 値だけ |
| `angelInvestments` | array | js/expansion.js:695, js/completion.js:212 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:244, js/expansion.js:696, js/expansion.js:859 ほか3件 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `personalRealEstateHoldings` | array | js/expansion.js:697, js/completion.js:212 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:295, js/phase3-founder-wealth.js:333, js/personal-real-estate-mortgage.js:84 ほか21件 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `sportsDraftCandidates` | array | js/expansion.js:706, js/expansion.js:708 ／初期値 js/expansion.js:256 | js/expansion.js:708, js/expansion.js:875, js/app.js:756 | 〇 | 稼働(静) |
| `sportsTradeMarket` | array | js/expansion.js:706, js/expansion.js:709 ／初期値 js/expansion.js:256 | js/expansion.js:709, js/app.js:756 | 〇 | 稼働(静) |
| `sportsSaleOffers` | array | js/expansion.js:875 ／初期値 js/expansion.js:256 | js/expansion.js:712, js/expansion.js:875, js/app.js:756 ほか1件 | 〇 | 稼働(動) |
| `lastSportsMarketWeek` | number | js/expansion.js:706 ／初期値 js/expansion.js:256 | js/expansion.js:875 | 〇 | 稼働(動) |
| `weeklyNewspaper` | array | js/competitor-media.js:25, js/expansion.js:879 ／初期値 js/expansion.js:257 | js/competitor-media.js:25, js/competitor-media.js:26, js/competitor-media.js:36 ほか3件 | 〇 | 稼働(動) |
| `majorBusinessNews` | array | js/expansion.js:880 ／初期値 js/expansion.js:257 | js/app.js:718, js/ui3-media.js:36 | 〇 | 稼働(動) |
| `luxuryAuctionListings` | array | js/expansion.js:882 ／初期値 js/expansion.js:257 | js/expansion.js:715, js/app.js:722, js/ui3-media.js:29 ほか1件 | 〇 | 稼働(動) |
| `lastNewspaperWeek` | number | js/expansion.js:879 ／初期値 js/expansion.js:257 | js/expansion.js:879 | 〇 | 稼働(動) |
| `lastAuctionWeek` | number | js/expansion.js:882 ／初期値 js/expansion.js:257 | js/expansion.js:882 | 〇 | 稼働(動) |
| `successorCandidate` | null | js/expansion.js:717, js/expansion.js:792 ／初期値 js/expansion.js:258 | js/expansion.js:718, js/expansion.js:741, js/expansion.js:742 ほか5件 | 〇 | 稼働(動) |
| `successorTrainingWeeks` | number | js/expansion.js:718 ／初期値 js/expansion.js:258 | — | 〇 | 値だけ |
| `familyTrustEstablished` | boolean | js/expansion.js:719, js/completion.js:212 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:346, js/expansion.js:719, js/expansion.js:720 ほか3件 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `familyTrustCash` | number | js/expansion.js:719, js/expansion.js:720, js/expansion.js:870 ほか1件 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:343, js/phase3-founder-wealth.js:554, js/expansion.js:870 ほか3件 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `familyTrustShares` | number | js/completion.js:212 ／初期値 js/completion.js:211 | js/phase3-founder-wealth.js:343, js/app.js:745, js/ui3-legacy.js:38 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(静) |
| `legacyScore` | number | js/expansion.js:891 ／初期値 js/expansion.js:258 | js/expansion.js:783, js/expansion.js:891, js/app.js:729 ほか3件 | 〇 | 稼働(動) |
| `generationLegacyScore` | number | js/expansion.js:784, js/expansion.js:891 ／初期値 js/expansion.js:258 | js/expansion.js:746, js/expansion.js:754, js/expansion.js:755 ほか2件 | 〇 | 稼働(動) |
| `inheritedLegacyScore` | number | js/expansion.js:783 ／初期値 js/expansion.js:258 | js/expansion.js:891 | 〇 | 稼働(動) |
| `retirementRecords` | array | js/expansion.js:770 ／初期値 js/expansion.js:258 | js/expansion.js:771, js/app.js:729 | 〇 | 稼働(動) |
| `lastSuccessionWeek` | number | js/expansion.js:785 ／初期値 js/expansion.js:258 | js/expansion.js:743 | 〇 | 稼働(動) |
| `serialEntrepreneurHistory` | array | js/expansion.js:792 ／初期値 js/expansion.js:259 | — | 〇 | 値だけ |
| `hallOfRecords` | object | js/completion.js:212 ／初期値 js/completion.js:211 | js/expansion.js:892, js/app.js:740, js/completion.js:140 ほか1件 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `expandedWeeklyAdjustments` | object | js/expansion.js:903 ／初期値 js/expansion.js:260 | js/expansion.js:905 | 〇 | 稼働(静) |
| `lastExpansionUpdateWeek` | number | js/expansion.js:901 ／初期値 js/expansion.js:260 | js/expansion.js:901 | 〇 | 稼働(静) |
| `completionVersion` | number | 初期値のみ: js/completion.js:52 | — | 〇 | 初期値のみ |
| `branchOffices` | array | js/completion.js:62, js/completion.js:86, js/completion.js:92 ／初期値 js/completion.js:53 | js/workforce.js:49, js/workforce.js:93, js/app.js:233 ほか8件 | 〇 | 稼働(動) |
| `employeeComplaintLog` | array | js/completion.js:63, js/completion.js:244 ／初期値 js/completion.js:53 | js/workforce.js:85, js/app.js:422, js/completion.js:98 ほか3件 | 〇 | 稼働(動) |
| `overtimeRisk` | number | js/workforce.js:55, js/completion.js:103, js/completion.js:242 ほか1件 ／初期値 js/completion.js:53 | js/app.js:412, js/app.js:421, js/app.js:433 ほか8件 ／ 複製のみ js/completion.js:98 | 〇 | 稼働(動) |
| `lastEmployeeComplaintWeek` | number | js/completion.js:244 ／初期値 js/completion.js:53 | js/completion.js:244 | 〇 | 稼働(静) |
| `lastWorkforceUpdateWeek` | number | js/workforce.js:85 ／初期値 js/completion.js:53 | js/workforce.js:85 | 〇 | 稼働(動) |
| `campusMilestoneIDs` | array | js/completion.js:256 ／初期値 js/completion.js:54 | js/completion.js:256 | 〇 | 稼働(動) |
| `transportRebuildProjects` | array | js/completion.js:131 ／初期値 js/completion.js:54 | js/app.js:510, js/completion.js:130, js/completion.js:247 | 〇 | 稼働(動) |
| `transportRebuildLog` | array | js/completion.js:247 ／初期値 js/completion.js:54 | — | 〇 | 値だけ |
| `mediaCampaigns` | array | js/completion.js:136 ／初期値 js/completion.js:55 | js/completion.js:249 | 〇 | 稼働(動) |
| `mediaActionLog` | array | js/completion.js:136, js/completion.js:249 ／初期値 js/completion.js:55 | js/app.js:719, js/ui3-media.js:37, js/d-ui-context-tabs.js:78 | 〇 | 稼働(動) |
| `socialMediaReputation` | number | js/completion.js:249, js/completion.js:250 ／初期値 js/completion.js:55 | js/app.js:715, js/ui3-media.js:25 | 〇 | 稼働(動) |
| `socialMediaHeat` | number | js/completion.js:249 ／初期値 js/completion.js:55 | js/app.js:715, js/ui3-media.js:26, js/completion.js:250 | 〇 | 稼働(動) |
| `shareholderTrust` | number | js/parity.js:87, js/completion.js:155 ／初期値 js/completion.js:55 | js/app.js:205, js/app.js:206, js/app.js:715 ほか1件 ／ 複製のみ js/parity.js:95 | 〇 | 稼働(動) |
| `inboundBuyoutOffers` | array | js/completion.js:65, js/completion.js:254 ／初期値 js/completion.js:56 | js/app.js:959, js/completion.js:144, js/completion.js:147 ほか2件 | 〇 | 稼働(動) |
| `lastInboundBuyoutOfferWeek` | number | js/completion.js:254 ／初期値 js/completion.js:56 | js/completion.js:254 | 〇 | 稼働(動) |
| `companyBuyoutHistory` | array | js/completion.js:149, js/completion.js:155 ／初期値 js/completion.js:56 | — | 〇 | 値だけ |
| `pastCompanyRecords` | array | js/completion.js:159, js/completion.js:212 ／初期値 js/completion.js:57 | js/phase3-ownership-planner.js:12, js/app.js:751, js/economic-read-model.js:600 ほか2件 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `serialCompanyCount` | number | js/completion.js:75, js/completion.js:212 ／初期値 js/completion.js:57 | js/completion.js:211, js/completion.js:212 ／ 複製のみ js/completion.js:212 | 〇 | 稼働(静) |
| `currentCompanySerial` | number | js/completion.js:75, js/completion.js:212 ／初期値 js/completion.js:57 | js/phase3-ownership-planner.js:9, js/phase3-ownership-planner.js:101, js/phase3-ownership-planner.js:106 ほか12件 ／ 複製のみ js/phase3-ownership-apply.js:66 | 〇 | 稼働(動) |
| `currentCompanyFoundedWeek` | number | js/completion.js:66, js/completion.js:75, js/completion.js:212 ／初期値 js/completion.js:57 | js/pe-fund.js:241, js/completion.js:66, js/completion.js:159 | 〇 | 稼働(静) |
| `lastNewCompanyFoundingWeek` | number | js/completion.js:212 ／初期値 js/completion.js:57 | — | 〇 | 値だけ |
| `endingRecords` | array | js/expansion.js:772, js/completion.js:212, js/completion.js:235 ／初期値 js/completion.js:58 | js/app.js:748, js/app.js:994, js/completion.js:235 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(動) |
| `playerTitles` | array | js/expansion.js:779, js/completion.js:212, js/completion.js:235 ／初期値 js/completion.js:58 | js/expansion.js:779, js/completion.js:235 ／ 複製のみ js/completion.js:211 | 〇 | 稼働(静) |
| `equippedTitleID` | null | 初期値のみ: js/completion.js:58 | — | 〇 | 値だけ |
| `lastCompletionUpdateWeek` | number | js/completion.js:263 ／初期値 js/completion.js:59 | js/completion.js:263 | 〇 | 稼働(静) |
| `lastProductOfferGenerationWeek` | number | js/completion.js:252 ／初期値 js/completion.js:59 | js/completion.js:252 | 〇 | 稼働(動) |
| `parityVersion` | number | 初期値のみ: js/parity.js:27 | — | 〇 | 初期値のみ |
| `advisorDismissedActionIDs` | array | js/parity.js:35, js/parity.js:79 ／初期値 js/parity.js:27 | js/parity.js:65, js/parity.js:79 | 〇 | 稼働(動) |
| `advisorLastGeneratedWeek` | number | js/parity.js:115 ／初期値 js/parity.js:27 | — | 〇 | 値だけ |
| `advisorActionHistory` | array | js/parity.js:36, js/parity.js:115 ／初期値 js/parity.js:27 | 動的: TycoonEngine.updateParityWeekly@parity | 〇 | 稼働(動) |
| `keyPersonnel` | array | js/parity.js:34, js/parity.js:58, js/parity.js:107 ／初期値 js/engine.js:371 | js/app.js:199, js/parity.js:56, js/parity.js:58 ほか9件 | 〇 | 稼働(動) |
| `keyPersonnelEventLog` | array | js/parity.js:37, js/parity.js:58, js/parity.js:107 ほか1件 ／初期値 js/parity.js:28 | js/app.js:199, js/d-ui-context-tabs.js:78 | 〇 | 稼働(動) |
| `lastKeyPersonnelEventWeek` | number | js/parity.js:107, js/parity.js:110 ／初期値 js/parity.js:28 | js/parity.js:107, js/parity.js:110 | 〇 | 稼働(動) |
| `earningsGuidanceRevenue` | number | js/parity.js:41, js/parity.js:87 ／初期値 js/parity.js:29 | js/app.js:206, js/parity.js:41, js/parity.js:87 ほか1件 | 〇 | 稼働(静) |
| `earningsGuidanceProfit` | number | js/parity.js:42, js/parity.js:87 ／初期値 js/parity.js:29 | js/app.js:206, js/parity.js:42, js/parity.js:87 ほか1件 | 〇 | 稼働(静) |
| `lastEarningsAnnouncementWeek` | number | js/parity.js:87 ／初期値 js/parity.js:29 | js/parity.js:81, js/parity.js:87, js/parity.js:94 | 〇 | 稼働(静) |
| `activistPressure` | number | js/parity.js:87 ／初期値 js/parity.js:29 | js/app.js:205, js/app.js:206 ／ 複製のみ js/parity.js:95 | 〇 | 稼働(静) |
| `earningsEventLog` | array | js/parity.js:38, js/parity.js:87 ／初期値 js/parity.js:29 | js/app.js:206, js/parity.js:93, js/d-ui-context-tabs.js:82 | 〇 | 稼働(静) |
| `competitorEventLog` | array | js/parity.js:39, js/parity.js:112, js/competitor-parity.js:58 ほか2件 ／初期値 js/parity.js:30 | js/app.js:779, js/parity.js:75, js/competitor-dashboard-ui.js:72 ほか4件 | 〇 | 稼働(動) |
| `lastCompetitorActionWeek` | number | js/parity.js:112 ／初期値 js/parity.js:30 | js/parity.js:112 | 〇 | 稼働(動) |
| `industryAwards` | array | js/parity.js:102 ／初期値 js/engine.js:424 | js/app.js:208, js/ui3-missions.js:18 | 〇 | 稼働(動) |
| `awardEventLog` | array | js/parity.js:40, js/parity.js:102 ／初期値 js/parity.js:31 | — | 〇 | 値だけ |
| `lastAwardWeek` | number | js/parity.js:102 ／初期値 js/parity.js:31 | js/parity.js:102 | 〇 | 稼働(動) |
| `lastParityUpdateWeek` | number | js/parity.js:119 ／初期値 js/parity.js:31 | js/parity.js:119 | 〇 | 稼働(静) |
| `competitorCounterStates` | array | js/competitor-parity.js:67, js/competitor-parity.js:86, js/competitor-parity.js:123 | js/ui3-rivals.js:20, js/competitor-dashboard.js:30, js/competitor-parity.js:67 ほか4件 ／ 検証のみ js/competitor-parity.js:147 / ハッシュ semantic-hash-v2.js:16 | 〇 | 稼働(動) |
| `rivalResponseHistory` | array | js/competitor-parity.js:68, js/competitor-parity.js:87, js/competitor-parity.js:96 ほか1件 | js/ui3-rivals.js:22, js/competitor-parity.js:68, js/competitor-parity.js:94 ほか1件 ／ 検証のみ js/competitor-parity.js:163 / ハッシュ semantic-hash-v2.js:18 | 〇 | 稼働(静) |
| `difficultyOpeningBalanceApplied` | boolean | js/difficulty-scenario-balance.js:57 | —（検証のみ js/difficulty-scenario-balance.js:104 / 複製のみ js/difficulty-scenario-balance.js:57） | 〇 | 値だけ |
| `difficultyScenarioBalanceVersion` | number | js/difficulty-scenario-balance.js:58 | js/difficulty-scenario-balance.js:47 ／ 検証のみ js/difficulty-scenario-balance.js:104 | 〇 | 稼働(静) |
| `scenarioProgress` | object | js/difficulty-scenario-balance.js:41 | js/difficulty-scenario-balance.js:35, js/difficulty-scenario-balance.js:108 ／ 検証のみ js/difficulty-scenario-balance.js:104 | 〇 | 稼働(静) |
| `strategyBalanceVersion` | number | js/strategy-balance.js:48 | js/strategy-balance.js:40 | 〇 | 稼働(静) |
| `peFirm` | object | js/pe-fund.js:109 ／初期値 js/phase3-founder-wealth.js:91 | js/ui3-ma.js:40, js/management-context.js:40, js/pe-portfolio-operations.js:175 ほか80件 ／ ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `supplyAccountsPayableBalance` | number | js/supply.js:25, js/supply.js:42, js/supply.js:47 | js/supply.js:25 ／ 検証のみ js/supply.js:67 / 複製のみ js/supply.js:42 | 〇 | 稼働(静) |
| `supplyAccountsPayableOpeningBaseline` | number | js/supply.js:25 | js/supply.js:25 ／ 検証のみ js/supply.js:67 | 〇 | 稼働(静) |
| `competitorPerformanceHistoryByID` | object | js/competitor.js:48, js/competitor.js:130 ／初期値 js/management-context.js:259 | js/competitor-dashboard.js:34, js/competitor-credit.js:24, js/competitor-credit.js:95 ほか2件 ／ 複製のみ js/management-context.js:259 / ハッシュ semantic-hash-v2.js:18 | 〇 | 稼働(動) |
| `competitorPresenceHistoryByID` | object | js/competitor.js:49, js/competitor.js:130 ／初期値 js/management-context.js:260 | js/competitor.js:31, js/competitor.js:89, js/competitor.js:92 ほか1件 ／ 複製のみ js/management-context.js:260 / ハッシュ semantic-hash-v2.js:18 | 〇 | 稼働(動) |
| `competitorProjects` | array | js/competitor-projects.js:71, js/competitor-projects.js:86, js/competitor-projects.js:89 | js/competitor-distress.js:143, js/competitor-dashboard.js:112, js/competitor-projects.js:50 ほか6件 ／ 検証のみ js/competitor-projects.js:94 / ハッシュ semantic-hash-v2.js:16 | 〇 | 稼働(動) |
| `nextCompetitorProjectSeq` | number | js/competitor-projects.js:53, js/competitor-projects.js:87 | —（ハッシュ semantic-hash-v2.js:19） ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `competitorMarketStrategy` | object | js/competitor-media.js:79 | js/competitor-media.js:79, js/competitor-media.js:117 ／ ハッシュ semantic-hash-v2.js:16 | 〇 | 稼働(静) |
| `workforceOfficeMetrics` | object | js/workforce.js:54 | js/app.js:412 | 〇 | 稼働(静) |
| `workforceKPI` | object | js/workforce.js:55 | js/app.js:412 | 〇 | 稼働(静) |
| `mediaAdvertisingCampaigns` | array | js/player-media-advertising.js:14, js/player-media-advertising.js:20 | js/player-media-advertising.js:13, js/player-media-advertising.js:14 | 〇 | 稼働(静) |
| `realEstate` | object | js/real-estate-capex-roi.js:12, js/real-estate.js:29, js/real-estate.js:31 ほか3件 ／初期値 js/macro-cycle.js:19 | js/phase3-founder-wealth.js:374, js/real-estate-rent-performance.js:7, js/real-estate-rent-pricing.js:12 ほか55件 ／ 保存/ハッシュ js/save-storage.js:109 | 〇 | 稼働(動) |
| `competitorMigrationV9Applied` | boolean | js/save-v9.js:70 | —（ハッシュ semantic-hash-v2.js:16） | 〇 | 値だけ |
| `competitorLifecycleSchemaVersion` | number | js/save-v9.js:71 | —（ハッシュ semantic-hash-v2.js:16） | 〇 | 値だけ |
| `personalMarginLoan` | object | js/personal-stock-margin.js:64 ／初期値 js/phase3-founder-wealth.js:85 | js/phase3-founder-wealth.js:392, js/phase3-founder-wealth.js:393, js/phase3-founder-wealth.js:395 ほか3件 | 〇 | 稼働(動) |
| `personalRealEstateCorp` | object | js/personal-real-estate-corp.js:33, js/personal-real-estate-corp.js:125 ／初期値 js/phase3-founder-wealth.js:82 | js/phase3-founder-wealth.js:332, js/phase3-founder-wealth.js:548, js/expansion.js:698 ほか7件 | 〇 | 稼働(動) |
| `companyRecallCrisisVersion` | number | js/company-recall-crisis.js:22 | — | 〇 | 値だけ |
| `recallCrisisHistory` | array | js/company-recall-crisis.js:23, js/company-recall-crisis.js:38 | js/company-recall-crisis.js:39 ／ 検証のみ js/company-recall-crisis.js:110 / 複製のみ js/company-recall-crisis.js:23 | 〇 | 稼働(動) |
| `activeRecallCrisis` | null | js/company-recall-crisis.js:25, js/company-recall-crisis.js:50, js/company-recall-crisis.js:70 | js/company-recall-crisis.js:24, js/company-recall-crisis.js:39, js/company-recall-crisis.js:65 ほか8件 ／ 検証のみ js/company-recall-crisis.js:111 | 〇 | 稼働(動) |
| `peNetwork` | object | js/pe-network.js:66, js/pe-network.js:181 | js/pe-network-sourcing.js:25, js/pe-network-sourcing.js:28, js/pe-network-sourcing.js:56 ほか23件 ／ ハッシュ semantic-hash-v2.js:15 | 〇 | 稼働(動) |
| `boardGovernance` | object | js/board-governance-resolution.js:200 | js/board-governance-resolution.js:173, js/board-governance-resolution.js:174, js/board-governance-resolution.js:299 ほか4件 | 〇 | 稼働(静) |
| `internalVentureBusinessVersion` | number | js/internal-venture-business.js:29 | —（ハッシュ semantic-hash-v2.js:14） | 〇 | 値だけ |
| `subsidiaryFundingVersion` | number | js/internal-venture-business.js:30 | —（ハッシュ semantic-hash-v2.js:15） | 〇 | 値だけ |
| `internalVentureBusinessHistory` | array | js/internal-venture-business.js:31, js/internal-venture-business.js:78 | —（ハッシュ semantic-hash-v2.js:14） | 〇 | 値だけ |
| `subsidiaryFundingHistory` | array | js/internal-venture-business.js:32, js/internal-venture-business.js:79 | —（ハッシュ semantic-hash-v2.js:15） | 〇 | 値だけ |
| `maDealRooms` | array | js/ma-deal-room.js:68, js/ma-deal-room.js:108 ／初期値 js/economic-read-model.js:642 | js/ui3-ma.js:23, js/ui3-ma.js:24, js/ui3-ma.js:67 ほか31件 ／ 複製のみ js/ma-deal-room.js:68 | 〇 | 稼働(動) |
| `maTargetTruthByID` | object | js/ma-deal-room.js:68 | js/ma-deal-room.js:74 | 〇 | 稼働(静) |
| `maDealHistory` | array | js/ma-deal-room.js:68, js/ma-deal-room.js:82, js/pe-acquisition.js:84 ほか1件 | —（複製のみ js/ma-deal-room.js:68） | 〇 | 値だけ |
| `nextMADealSeq` | number | js/ma-deal-room.js:68, js/ma-deal-room.js:108 | — ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `lastMADealProcessWeek` | number | js/ma-deal-room.js:68, js/ma-deal-room.js:105, js/ma-deal-room.js:108 | js/ma-deal-room.js:68, js/ma-deal-room.js:126 | 〇 | 稼働(静) |
| `productInnovationVersion` | number | js/player-engine-bridge.js:39 | — | 〇 | 値だけ |
| `productRoadmaps` | array | js/player-engine-bridge.js:40, js/player-engine-bridge.js:66, js/player-engine-bridge.js:235 | js/player-engine-bridge.js:53, js/player-engine-bridge.js:63, js/player-engine-bridge.js:64 ほか8件 | 〇 | 稼働(動) |
| `productInnovationHistory` | array | js/player-engine-bridge.js:41, js/player-engine-bridge.js:90, js/player-engine-bridge.js:91 | — | 〇 | 値だけ |
| `productPatentAssignments` | object | js/player-engine-bridge.js:42 | js/player-engine-bridge.js:245, js/player-engine-bridge.js:250, js/player-engine-bridge.js:281 | 〇 | 稼働(静) |
| `nextProductRoadmapSeq` | number | js/player-engine-bridge.js:43, js/player-engine-bridge.js:54, js/player-engine-bridge.js:231 | — ／ ID採番カウンタ（`++` の値で新規IDを生成） | 〇 | 稼働(静) |
| `lastProductInnovationWeek` | number | js/player-engine-bridge.js:44, js/player-engine-bridge.js:255 | js/player-engine-bridge.js:254 | 〇 | 稼働(動) |
| `productInnovationFocusID` | null | js/player-engine-bridge.js:52, js/player-engine-bridge.js:226 | js/player-engine-bridge.js:51, js/player-engine-bridge.js:77, js/player-engine-bridge.js:226 ほか1件 | 〇 | 稼働(静) |
| `playerCrisis` | object | js/player-crisis.js:55, js/player-crisis.js:214 | js/player-crisis-creditor.js:5, js/player-crisis-creditor.js:13, js/player-crisis-turnaround-fund.js:25 ほか28件 | 〇 | 稼働(動) |
| `consecutiveNegativeCashWeeks` | number | js/engine.js:2574, js/player-crisis.js:56, js/player-crisis.js:115 ほか1件 | js/engine.js:2574, js/player-crisis.js:114 ／ 複製のみ js/engine.js:2574 | 〇 | 稼働(静) |
| `playerCrisisActions` | object | js/player-crisis-actions.js:30, js/player-crisis-actions.js:61 | js/player-crisis-creditor.js:6, js/player-crisis-creditor.js:81, js/player-crisis-turnaround-fund.js:26 ほか6件 ／ 検証のみ js/player-crisis-actions.js:53 | 〇 | 稼働(静) |
| `playerCrisisRestructuring` | object | js/player-crisis-restructuring.js:80, js/player-crisis-restructuring.js:264 | js/player-crisis-creditor.js:7, js/player-crisis-creditor.js:79, js/player-crisis-creditor.js:80 ほか3件 | 〇 | 稼働(静) |
| `playerCrisisCreditor` | object | js/player-crisis-creditor.js:64, js/player-crisis-creditor.js:244 | js/player-crisis-creditor-ui.js:16, js/player-crisis-creditor.js:9, js/player-crisis-creditor.js:59 ほか2件 | 〇 | 稼働(静) |
| `playerTurnaroundPlan` | object | js/player-turnaround-plan.js:28, js/player-turnaround-plan.js:61 | js/player-crisis-turnaround-fund.js:27, js/player-crisis-turnaround-fund.js:31, js/player-turnaround-plan-report.js:7 ほか18件 ／ 検証のみ js/player-turnaround-plan.js:53 | 〇 | 稼働(動) |
| `playerTurnaroundFund` | object | js/player-crisis-turnaround-fund.js:81 | js/player-crisis-turnaround-fund.js:71, js/player-crisis-turnaround-fund.js:222 | 〇 | 稼働(静) |
| `shareholderActivismVersion` | number | js/shareholder-activism.js:23 | — | 〇 | 値だけ |
| `activeActivistCampaign` | null | js/shareholder-activism.js:23, js/shareholder-activism.js:35, js/shareholder-activism.js:36 ほか2件 | js/expansion.js:405, js/shareholder-activism.js:35, js/shareholder-activism.js:36 ほか7件 | 〇 | 稼働(動) |
| `shareholderProposals` | array | js/shareholder-activism.js:23, js/shareholder-activism.js:35, js/shareholder-value-destruction.js:28 ほか1件 | —（ハッシュ semantic-hash-v2.js:12） | 〇 | 値だけ |
| `activistCampaignHistory` | array | js/shareholder-activism.js:23, js/shareholder-activism.js:34, js/shareholder-value-destruction.js:28 ほか1件 | js/shareholder-activism.js:41 | 〇 | 稼働(静) |
| `governanceCommitments` | array | js/shareholder-activism.js:23, js/shareholder-activism.js:38 | js/expansion.js:406, js/shareholder-activism.js:41, js/shareholder-value-destruction.js:20 | 〇 | 稼働(動) |
| `activistCapitalUseHistory` | array | js/shareholder-activism.js:23, js/shareholder-activism.js:29 | js/shareholder-activism.js:27, js/shareholder-activism.js:29 ／ ハッシュ semantic-hash-v2.js:12 | 〇 | 稼働(静) |
| `boardActivistSeats` | number | js/shareholder-activism.js:23, js/shareholder-activism.js:39 | —（複製のみ js/shareholder-activism.js:23） | 〇 | 値だけ |
| `founderControlPressure` | number | js/shareholder-activism.js:23, js/shareholder-activism.js:37, js/shareholder-activism.js:39 ほか1件 | js/shareholder-activism.js:31 ／ 複製のみ js/shareholder-activism.js:23 | 〇 | 稼働(静) |
| `lastActivistCampaignWeek` | number | js/shareholder-activism.js:23, js/shareholder-activism.js:35, js/shareholder-value-destruction.js:28 ほか1件 | js/shareholder-activism.js:35, js/shareholder-value-destruction.js:28, js/shareholder-value-destruction.js:36 ／ 複製のみ js/shareholder-activism.js:23 | 〇 | 稼働(静) |
| `shareholderValueDestructionVersion` | number | js/shareholder-value-destruction.js:17 | — | 〇 | 値だけ |
| `activistMarketPerformanceHistory` | array | js/shareholder-value-destruction.js:17, js/shareholder-value-destruction.js:21 | js/shareholder-value-destruction.js:21, js/shareholder-value-destruction.js:22 | 〇 | 稼働(動) |
| `shareholderPortfolioInefficiencyVersion` | number | js/shareholder-value-destruction.js:17 | — | 〇 | 値だけ |
| `activistPortfolioEfficiencyHistory` | array | js/shareholder-value-destruction.js:17, js/shareholder-value-destruction.js:34 | js/shareholder-value-destruction.js:34, js/shareholder-value-destruction.js:35 | 〇 | 稼働(動) |
| `macroCycleVersion` | number | js/macro-cycle.js:25 | — | 〇 | 値だけ |
| `macroHistory` | array | js/macro-cycle.js:25, js/macro-cycle.js:26 | js/d-ui-context-tabs.js:86 ／ 検証のみ js/macro-cycle.js:31 | 〇 | 稼働(動) |
| `lastMacroCycleWeek` | number | js/macro-cycle.js:25, js/macro-cycle.js:30 | js/macro-cycle.js:30 | 〇 | 稼働(動) |
| `macroRegime` | string | js/macro-cycle.js:25, js/macro-cycle.js:30 | js/macro-cycle.js:30, js/d-ui-context-tabs.js:87 ／ 検証のみ js/macro-cycle.js:31 | 〇 | 稼働(動) |
| `industryClimate` | object | js/macro-cycle.js:25, js/macro-cycle.js:30 | js/macro-cycle.js:29 | 〇 | 稼働(動) |
| `industryEventHistory` | array | js/macro-cycle.js:25, js/macro-cycle.js:29 | js/d-ui-context-tabs.js:88 ／ 検証のみ js/macro-cycle.js:31 | 〇 | 稼働(動) |
| `activeIndustryEvent` | object | js/macro-cycle.js:25, js/macro-cycle.js:29 | js/macro-cycle.js:25, js/macro-cycle.js:29, js/industry-event-response-plans.js:13 ほか2件 ／ 検証のみ js/macro-cycle.js:31 | 〇 | 稼働(動) |
| `industrySpecificEventVersion` | number | js/industry-specific-events.js:21 | — | 〇 | 値だけ |
| `industrySpecificModifiers` | object | js/industry-specific-events.js:21, js/industry-specific-events.js:25 | js/industry-specific-events.js:33 ／ 検証のみ js/industry-specific-events.js:27 | 〇 | 稼働(静) |
| `industrySpecificEventHistory` | array | js/industry-specific-events.js:21, js/industry-specific-events.js:25 | 動的: refresh@industry-specific-events ／ 検証のみ js/industry-specific-events.js:27 | 〇 | 稼働(動) |
| `industryEventResponsePlanVersion` | number | js/industry-event-response-plans.js:12 | — | 〇 | 値だけ |
| `activeIndustryEventResponsePlan` | null | js/industry-event-response-plans.js:12, js/industry-event-response-plans.js:16, js/industry-event-response-plans.js:17 | js/industry-event-response-plans-ui.js:11, js/industry-event-response-plans.js:16, js/industry-event-response-plans.js:17 ほか2件 ／ 検証のみ js/industry-event-response-plans.js:22 | 〇 | 稼働(動) |
| `industryEventResponsePlanHistory` | array | js/industry-event-response-plans.js:12, js/industry-event-response-plans.js:15 | —（検証のみ js/industry-event-response-plans.js:22） | 〇 | 値だけ |
| `productLifecycleVersion` | number | js/product-lifecycle.js:31 | — | 〇 | 値だけ |
| `productLifecycleHistory` | array | js/product-lifecycle.js:32, js/product-lifecycle.js:56 | — | 〇 | 値だけ |
| `lastProductLifecycleWeek` | number | js/product-lifecycle.js:33, js/product-lifecycle.js:121 | js/product-lifecycle.js:121 | 〇 | 稼働(動) |
| `productRecallVersion` | number | js/product-lifecycle.js:34 | — | 〇 | 値だけ |
| `productRecallRiskHistory` | array | js/product-lifecycle.js:35, js/product-lifecycle.js:99 | js/product-lifecycle.js:99, js/product-lifecycle.js:100 ／ 検証のみ js/product-lifecycle.js:111 | 〇 | 稼働(動) |
| `productRecallHistory` | array | js/product-lifecycle.js:36, js/product-lifecycle.js:57 | —（検証のみ js/product-lifecycle.js:111） | 〇 | 値だけ |
| `lastProductRecallWeek` | number | js/product-lifecycle.js:37, js/product-lifecycle.js:103 | js/product-lifecycle.js:103 | 〇 | 稼働(動) |
| `activeProductRecall` | null | js/product-lifecycle.js:38, js/product-lifecycle.js:103, js/product-lifecycle.js:108 | js/product-lifecycle.js:103, js/product-lifecycle.js:104, js/product-lifecycle.js:108 ほか3件 ／ 検証のみ js/product-lifecycle.js:111 / 複製のみ js/product-lifecycle.js:38 | 〇 | 稼働(動) |
| `realEstateDevelopment` | object | js/real-estate-development.js:8, js/real-estate-development.js:36 | js/real-estate-rent-performance.js:6, js/real-estate-portfolio-dashboard.js:3, js/real-estate-portfolio-dashboard.js:6 ほか19件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `realEstateMarket` | object | js/real-estate-complete-cycle.js:29, js/real-estate-complete-cycle.js:33 ／初期値 js/phase3-founder-wealth.js:87 | js/phase3-founder-wealth.js:374, js/finance.js:71, js/real-estate-mortgage-refinancing.js:31 ほか6件 | 〇 | 稼働(静) |
| `listedSubsidiaryMarketVersion` | number | js/listed-subsidiary-market.js:49 | — | 〇 | 値だけ |
| `listedSubsidiaryMarketHistory` | array | js/listed-subsidiary-market.js:24, js/listed-subsidiary-market.js:49 | — | 〇 | 値だけ |
| `listedSubsidiaryPortfolioVersion` | number | js/listed-subsidiary-portfolio-dashboard.js:14 | — | 〇 | 値だけ |
| `listedSubsidiaryControlVersion` | number | js/listed-subsidiary-control-actions.js:17 | — | 〇 | 値だけ |
| `listedSubsidiaryControlHistory` | array | js/listed-subsidiary-control-actions.js:17, js/listed-subsidiary-control-actions.js:19 | — | 〇 | 値だけ |
| `subsidiaryIntegrationSynergyVersion` | number | js/subsidiary-integration-synergy.js:18 | — | 〇 | 値だけ |
| `subsidiaryIntegrationSynergyHistory` | array | js/subsidiary-integration-synergy.js:18, js/subsidiary-integration-synergy.js:22 | js/group-restructuring-candidates.js:37 | 〇 | 稼働(静) |
| `interSubsidiarySynergyVersion` | number | js/inter-subsidiary-synergy-allocation.js:19 | — | 〇 | 値だけ |
| `interSubsidiarySynergyHistory` | array | js/inter-subsidiary-synergy-allocation.js:19, js/inter-subsidiary-synergy-allocation.js:23 | js/inter-subsidiary-synergy-performance.js:17 | 〇 | 稼働(動) |
| `interSubsidiarySynergyPairs` | object | js/inter-subsidiary-synergy-allocation.js:19 | js/inter-subsidiary-synergy-allocation.js:21, js/inter-subsidiary-synergy-allocation.js:23 | 〇 | 稼働(静) |
| `groupCapitalAllocationVersion` | number | js/group-capital-allocation-actions.js:12 | — | 〇 | 値だけ |
| `groupCapitalAllocationPolicy` | object | js/group-capital-allocation-actions.js:12, js/group-capital-allocation-actions.js:17 | js/group-capital-allocation-actions.js:12, js/group-capital-allocation-actions.js:13, js/group-capital-allocation-actions.js:14 ほか1件 | 〇 | 稼働(動) |
| `groupCapitalAllocationHistory` | array | js/group-capital-allocation-actions.js:12, js/group-capital-allocation-actions.js:17 | — | 〇 | 値だけ |
| `groupRestructuringVersion` | number | js/group-restructuring-candidates.js:14 | — | 〇 | 値だけ |
| `groupRestructuringHistory` | array | js/group-restructuring-candidates.js:14, js/group-restructuring-candidates.js:38 | js/shareholder-value-destruction.js:33 | 〇 | 稼働(静) |
| `restructuringProgressVersion` | number | js/group-restructuring-progress.js:47 | — | 〇 | 値だけ |
| `restructuringPrograms` | array | js/group-restructuring-progress.js:47, js/group-restructuring-progress.js:53 | js/group-restructuring-progress.js:51, js/group-restructuring-progress.js:53, js/group-restructuring-progress.js:54 ほか4件 | 〇 | 稼働(動) |
| `integrationProjects` | array | js/group-restructuring-progress.js:47, js/group-restructuring-progress.js:68 | js/group-restructuring-progress.js:50, js/group-restructuring-progress.js:51, js/group-restructuring-progress.js:75 ほか2件 | 〇 | 稼働(動) |
| `saleNegotiations` | array | js/group-restructuring-progress.js:47, js/group-restructuring-progress.js:59 | js/group-restructuring-progress.js:47, js/group-restructuring-progress.js:51, js/group-restructuring-progress.js:59 ほか5件 | 〇 | 稼働(動) |
| `earnoutAgreements` | array | js/group-restructuring-progress.js:47, js/group-restructuring-progress.js:67 | js/group-restructuring-progress.js:74 | 〇 | 稼働(動) |
| `groupRestructuringProgressHistory` | array | js/group-restructuring-progress.js:47, js/group-restructuring-progress.js:48 | js/group-restructuring-progress.js:77, js/shareholder-value-destruction.js:33 | 〇 | 稼働(動) |
| `subsidiaryRelistingVersion` | number | js/subsidiary-relisting-options.js:14 | — | 〇 | 値だけ |
| `subsidiaryRelistingHistory` | array | js/subsidiary-relisting-options.js:14, js/subsidiary-relisting-options.js:19 | — | 〇 | 値だけ |
| `listedSubsidiaryFollowOnOfferingVersion` | number | js/listed-subsidiary-follow-on-offering.js:18 | — | 〇 | 値だけ |
| `listedSubsidiaryFollowOnOfferingHistory` | array | js/listed-subsidiary-follow-on-offering.js:18, js/listed-subsidiary-follow-on-offering.js:22 | — | 〇 | 値だけ |
| `subsidiaryIPOPreparationVersion` | number | js/subsidiary-ipo-preparation.js:30 | — | 〇 | 値だけ |
| `subsidiaryIPOPreparationHistory` | array | js/subsidiary-ipo-preparation.js:31, js/subsidiary-ipo-preparation.js:48 | — | 〇 | 値だけ |
| `subsidiaryIPOSecondarySaleVersion` | number | js/subsidiary-ipo-secondary-sale.js:16 | — | 〇 | 値だけ |
| `subsidiaryIPOSecondarySaleHistory` | array | js/subsidiary-ipo-secondary-sale.js:16, js/subsidiary-ipo-secondary-sale.js:22 | — | 〇 | 値だけ |
| `groupHoldingGovernance` | object | js/group-holding-governance.js:11, js/group-holding-governance.js:21 | js/group-holding-governance.js:6, js/group-holding-governance.js:11, js/group-holding-governance.js:14 ほか3件 | 〇 | 稼働(動) |
| `subsidiaryBudgetKpi` | object | js/subsidiary-budget-kpi.js:11, js/subsidiary-budget-kpi.js:21 | js/subsidiary-budget-kpi.js:7, js/subsidiary-budget-kpi.js:11, js/subsidiary-budget-kpi.js:14 ほか2件 | 〇 | 稼働(動) |
| `subsidiaryPerformanceReview` | object | js/subsidiary-performance-review.js:11, js/subsidiary-performance-review.js:20 | js/subsidiary-mandate-apply.js:16, js/subsidiary-performance-review.js:7, js/subsidiary-performance-review.js:11 ほか2件 | 〇 | 稼働(動) |
| `subsidiaryMandateApply` | object | js/subsidiary-mandate-apply.js:21, js/subsidiary-mandate-apply.js:27 | js/subsidiary-mandate-apply.js:17, js/subsidiary-mandate-apply.js:21, js/subsidiary-mandate-apply.js:22 ほか2件 | 〇 | 稼働(動) |
| `groupCapitalAllocation` | object | js/group-capital-allocation-plan.js:21 | js/group-capital-allocation-execution.js:22, js/group-capital-allocation-execution.js:29, js/group-capital-allocation-execution.js:30 ほか4件 | 〇 | 稼働(動) |
| `economicFoundation` | object | js/deterministic-economic-foundation.js:11 | js/deterministic-economic-foundation.js:11, js/deterministic-economic-foundation.js:13, js/deterministic-economic-foundation.js:15 ほか6件 ／ ハッシュ semantic-hash-v2.js:10 | 〇 | 稼働(動) |
| `newBusinessAnalysis` | object | js/new-business-market-analysis.js:20 | js/new-business-research-projects.js:24, js/new-business-research-projects.js:29, js/new-business-research-projects.js:30 ほか3件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `newBusinessResearch` | object | js/new-business-research-projects.js:19 | js/new-business-commercialization.js:10, js/new-business-research-projects.js:14, js/new-business-research-projects.js:19 ほか6件 ／ ハッシュ semantic-hash-v2.js:14 | 〇 | 稼働(動) |
| `newBusinesses` | array | js/new-business-commercialization.js:5, js/new-business-commercialization.js:8 | js/new-business-commercialization.js:7, js/new-business-commercialization.js:8, js/finance.js:99 | 〇 | 稼働(動) |
| `newBusinessCommercializationHistory` | array | js/new-business-commercialization.js:5, js/new-business-commercialization.js:8 | — | 〇 | 値だけ |
| `bankFinancing` | object | js/bank-loans-covenants.js:33 | js/bank-loans-covenants.js:33, js/bank-loans-covenants.js:36, js/bank-loans-covenants.js:44 ほか4件 ／ ハッシュ semantic-hash-v2.js:11 | 〇 | 稼働(動) |
| `bankDebt` | number | js/bank-loans-covenants.js:32 | js/bank-loans-covenants.js:32, js/bank-loans-covenants.js:38, js/bank-loans-covenants.js:41 ほか1件 | 〇 | 稼働(動) |
| `bondFinancing` | object | js/corporate-bonds-ratings.js:5 | js/corporate-bonds-ratings.js:5, js/corporate-bonds-ratings.js:7, js/corporate-bonds-ratings.js:15 | 〇 | 稼働(静) |
| `convertibleFinancing` | object | js/convertible-bonds-dilution.js:5 | js/convertible-bonds-dilution.js:5, js/convertible-bonds-dilution.js:12 | 〇 | 稼働(静) |
| `preferredFinancing` | object | js/preferred-shares-dividends.js:5 | js/preferred-shares-dividends.js:5, js/preferred-shares-dividends.js:11 | 〇 | 稼働(静) |
| `executiveManagement` | object | js/executive-reviews-succession-board.js:15, js/executives-department-assignments.js:8, js/executives-department-assignments.js:13 ほか1件 | js/executive-reviews-succession-board.js:6, js/executive-reviews-succession-board.js:12, js/executive-reviews-succession-board.js:15 ほか11件 | 〇 | 稼働(動) |
| `executiveModifiers` | object | js/executives-department-assignments.js:14 | — | 〇 | 値だけ |
| `executiveGovernance` | object | js/executive-reviews-succession-board.js:5 | js/executive-reviews-succession-board.js:5, js/executive-reviews-succession-board.js:7, js/executive-reviews-succession-board.js:12 ほか9件 | 〇 | 稼働(静) |
| `executiveDismissalDisruptionUntilWeek` | number | js/executive-reviews-succession-board.js:5, js/executive-reviews-succession-board.js:15 | —（複製のみ js/executive-reviews-succession-board.js:5） | 〇 | 値だけ |
| `executiveLifecycle` | object | js/executive-retirement-succession.js:5 | js/executive-retirement-succession.js:5, js/executive-retirement-succession.js:9, js/executive-retirement-succession.js:10 ほか1件 | 〇 | 稼働(動) |
| `globalRanking` | object | js/global-company-ranking-goals.js:10 | js/long-run-guidance.js:5, js/global-company-ranking-goals.js:10, js/global-company-ranking-goals.js:21 ほか3件 | 〇 | 稼働(動) |
| `hallOfFame` | object | js/hall-of-fame-generations.js:5 | js/long-run-guidance.js:5, js/hall-of-fame-generations.js:5, js/hall-of-fame-generations.js:6 ほか3件 | 〇 | 稼働(動) |
| `longRunGuidance` | object | js/long-run-guidance.js:7, js/long-run-guidance.js:11 | js/long-run-guidance.js:3, js/long-run-guidance.js:7, js/long-run-guidance.js:8 ほか2件 | 〇 | 稼働(動) |
| `industrySpecificActiveEventId` | string | js/industry-specific-events.js:25 | js/industry-specific-events.js:25 | 〇 | 稼働(動) |
| `menuResearch` | object | js/menu-research.js:43, js/menu-research.js:137 | js/store-equipment.js:294, js/store-equipment.js:301, js/engine.js:2522 ほか3件 | 〇 | 稼働(静) |
| `conveniMerchandising` | object | js/convenience-merchandising.js:65 ／初期値 js/management-context.js:169 | js/management-context.js:242, js/management-context.js:243, js/convenience-merchandising.js:52 ほか2件 | 〇 | 稼働(静) |
| `competitorGroups` | array | js/engine.js:2262, js/engine.js:2272, js/engine.js:2277 | js/engine.js:2262, js/engine.js:2271, js/engine.js:2304 | 〇 | 稼働(動) |
| `competitorProducts` | array | js/engine.js:2195, js/engine.js:2212 | js/engine.js:2195, js/engine.js:2213, js/engine.js:2231 | 〇 | 稼働(動) |
| `counterCampaigns` | array | js/engine.js:2139, js/engine.js:2196 | js/engine.js:2116, js/engine.js:2140, js/engine.js:2196 | 〇 | 稼働(動) |
| `lastCompetitorProductWeek` | number | js/engine.js:2197, js/engine.js:2214 | js/engine.js:2197, js/engine.js:2240 | 〇 | 稼働(動) |
| `playerFrontShares` | object | js/engine.js:2526 | js/engine.js:2289 | 〇 | 稼働(動) |
| `workforceUpdateCountForWeek` | number | js/workforce.js:85 | 動的: Proxy.updateEndOfWeek@workforce ／ 複製のみ js/workforce.js:85 | 〇 | 稼働(動) |
| `lastWorkforceUpdateResult` | object | js/workforce.js:85 | js/workforce.js:85 | 〇 | 稼働(静) |
| `archivedPurchaseOrderCount` | number | js/supply.js:58 | js/supply.js:58 | 〇 | 稼働(動) |
| `quarterlyPretaxProfit` | number | js/pe-fund.js:685, js/pe-fund.js:696, js/engine.js:2567 | js/engine.js:2567 ／ 複製のみ js/pe-fund.js:685 | 〇 | 稼働(動) |
