# 棚卸しまとめ（capitalism-tycoon-web）

- 基準: `main` @ `47217818`（2026-11-12）。**調査のみ。コードの変更はなし**（変更・追加は `docs/inventory/` 配下のみ）。
- 成果物: [features.md](features.md)（作業1）・[state-fields.md](state-fields.md)（作業2）・[ui-actions.md](ui-actions.md)（作業3）・[spec-sources.md](spec-sources.md)（作業4）・本ファイル（作業5）・[tools/](tools/)（再現用スクリプト）。
- 方法の要点: Chromium(Playwright)で本番の `index.html` を**実際に起動**し、モジュール呼出・`Engine.prototype` 差替の実行回数・`g` の読み書き・DOM出力・全ボタン押下を計測し、コードの静的 grep と突き合わせた。詳細と限界は各ファイル冒頭。

## 0. 依頼文との差（先に確認してほしい点）

1. モジュール数: 依頼文は「約170本」だが、`index.html` が読み込むのは **245本**（`ls js | wc -l` も 245）。`docs/GAME_OVERVIEW.md:177` は「203」と書いている（spec-sources.md C1）。
2. 前例の PR 番号: 依頼文は「founderEnergy・founderFocus・founderHealth・founderEducationLevel・founderNetworkLevel・lobbyInfluence は読まれていなかった（PR #397）」。git 履歴では #397 は `refactor: clean up founder profile`（`ca9ec200`）、体力・健康・集中力の廃止は #542（`5ba87241`）。現在の状況は state-fields.md 冒頭の表のとおり（3つは削除済み、`founderEducationLevel`・`lobbyInfluence` は**いまも値だけ**、`founderNetworkLevel` は `js/engine.js:2615` で読まれるようになった）。
3. 状態フィールドの範囲: `g` の**トップレベル436キー**を対象にした。`g.stores[i].xxx` のような入れ子の項目は対象外（量が桁違いのため）。必要なら tools/ のスクリプトを拡張して同じ方法で出せる。

## 1. 各状態の件数

### 1.1 モジュール（245本、features.md）

| 状態 | 件数 | 備考 |
|---|---|---|
| 稼働 | 149 | 根拠の強さ: 動的に観測 134 / 静的+動的 0 / 静的のみ 15 |
| 値だけ | 7 | 全て「画面に出ない・読み手なし」。下の 2.2 参照 |
| 未接続 | 6 | 下の 2.1 参照 |
| 不明 | 83 | 条件付き機能（上場後・子会社保有後・資金危機時・賃貸契約後）と `?ui=3` 限定。理由は各行。下の 3 に集約 |
| 計 | 245 | |

### 1.2 状態フィールド（`g` トップレベル436キー、state-fields.md）

| 状態 | 件数 | 備考 |
|---|---|---|
| 稼働 | 355 | 動(実行で観測) 248 / 静(コード上のみ) 107。`next*Seq` 採番カウンタを含む |
| 値だけ | 69 | 書込はあるが実読込なし（大半は `*Version`・`*History`・`*Log` と創業者/会社の記録系） |
| 初期値のみ | 12 | 書込も読込もなく初期値だけ存在 |
| 計 | 436 | |

### 1.3 画面の操作（ui-actions.md）

| 区分 | 既定UI | ?ui=3 |
|---|---|---|
| 押下対象(種類) | 1240 | 636 |
| タブ遷移ボタン | 1190 | 0 |
| 同種(重複) | 280 | 88 |
| 入力欄 | 71 | 11 |
| └ 〇 状態変化 | 63 | 31 |
| └ △ 確認画面を開くのみ/確定後も変化なし | 9 | 30 |
| └ 画面遷移・選択のみ | 13 | 20 |
| └ × 変化なし | 186 | 10 |
| └ 未実行 | 793 | 507 |
| └ disabled | 88 | 5 |
| └ 測定不能 | 77 | 33 |

「× 変化なし」は「測定した基準状態では無効だった」であって、壊れているとは限らない（トーストの理由が資金不足・前提未達のものが多い）。ui-actions.md に1件ずつ理由を併記。

## 2. 削除候補

> 以下は**候補の列挙であり、削除の提案・実施ではない**。いずれも `tests/` が参照しており、テストの削除・弱体化は禁止（AGENTS.md §2）なので、実際に消すには別途の判断が要る。

### 2.1 「未接続」で、セーブ互換に影響しないもの

保存データ(`g`)に書き込まないため、セーブ形式（`SAVE_KEY=capitalism_tycoon_web_v1`・`saveVersion=9`）に影響しない。

| モジュール | 理由（features.md の根拠） | 参照しているテスト | 備考 |
|---|---|---|---|
| `pmi-100-day-loader` | 193バイト・コメントのみ（実行コードなし） | tests/workflow-path-filter-contract-test.js | index.html の `<script>` 行と、パス名を列挙するテスト/ワークフロー側の整理が要る |
| `economic-shadow-journal` | js/ 内に参照元なし | tests/economic-shadow-journal-test.js | docs/economic-engine/PHASE_1_SHADOW_JOURNAL.md が契約書。Economic Engine の段階導入物なので「将来用」かの判断が要る（要判断） |
| `phase3-indirect-economic-paths` | 診断専用・参照元なし | tests/phase3-indirect-economic-paths-test.js | 同上（Phase 3 の読み取り専用スライス） |
| `phase3-restructuring-lifecycle` | 根拠投影のみ・参照元なし | tests/phase3-restructuring-lifecycle-test.js | 同上 |
| `phase3-control-eligibility` | 実行不可の投影・参照元なし | tests/phase3-control-eligibility-test.js ほか3 | 同上 |
| `phase3-ownership-planner` | 参照元は休眠中の phase3-ownership-apply のみ | tests/phase3-ownership-planner-test.js ほか7 | 静的に `founderShares`/`sharesOut` への書込が検出されるが、呼出元が休眠のため実行されない。`phase3-ownership-apply` と一体で判断 |

### 2.2 「値だけ」のモジュール（セーブ互換に影響する＝別枠）

これらは保存される状態ボックスを書いている（読み手は自分自身か到達不能な画面のみ）。消すと**新規セーブからそのキーが消える**。`semantic-hash-v2.js` の `ROOT_KEYS` には含まれない（決定論ハッシュには影響しない）が、`tests/` のセーブ系テストに触れる可能性がある。

| モジュール | 書く状態 | 補足 |
|---|---|---|
| `corporate-bonds-ratings` | `bondFinancing`（空の箱） | Mode 0＝発行・償還とも `return false`（js/corporate-bonds-ratings.js:9-12） |
| `convertible-bonds-dilution` | `convertibleFinancing`（空の箱） | 同上 |
| `preferred-shares-dividends` | `preferredFinancing`（空の箱） | 同上 |
| `board-governance-resolution` | `boardGovernance` | 画面は到達不能な 'finance' タブ限定 |
| `long-run-guidance` | `longRunGuidance` | 同上 |
| `global-company-ranking-goals` | `globalRanking` | 同上。報酬は記録のみ（コメント #816） |
| `hall-of-fame-generations` | `hallOfFame` | 同上 |

### 2.3 値だけ／初期値のみの状態フィールド（すべてセーブ互換に影響する＝別枠）

`g` のトップレベルのキーは**すべて保存データに含まれる**（features/state-fields.md 参照）ため、「セーブ互換に影響しない削除候補」に該当するフィールドは**ない**。下表は影響の種類で分けたもの。前例: 創業者の体力・健康・集中力の廃止（#542）では「旧セーブに残っていても単純に無視される」扱いで削除された（docs/CURRENT_SAVE_SCHEMA.md）。

**決定論ハッシュに含まれる（`semantic-hash-v2.js` の `ROOT_KEYS`）→ 削除/変更で決定論フィンガープリントと関連 fixture が動く（20件）**

| フィールド | 状態 | tests/ での参照ファイル数 | fixture |
|---|---|---|---|
| `personalFame` | 値だけ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `officeLevel` | 初期値のみ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `officePrestige` | 値だけ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `realizedCompanyStockPL` | 値だけ | 3 | stock-split-atomicity.js, current-version-save.json, future-version-save.json |
| `realizedPersonalStockPL` | 値だけ | 6 | stock-split-atomicity.js, current-version-save.json, future-version-save.json |
| `tenderOffers` | 初期値のみ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `productExitCount` | 値だけ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `cxoExecutives` | 初期値のみ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `autoExecutiveManagementEnabled` | 初期値のみ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `complianceLevel` | 初期値のみ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `scheduledPayments` | 初期値のみ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `productEvents` | 値だけ | 0 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `competitorSettings` | 初期値のみ | 0 | — |
| `competitorMigrationV9Applied` | 値だけ | 1 | — |
| `competitorLifecycleSchemaVersion` | 値だけ | 1 | — |
| `internalVentureBusinessVersion` | 値だけ | 0 | — |
| `subsidiaryFundingVersion` | 値だけ | 0 | — |
| `internalVentureBusinessHistory` | 値だけ | 5 | — |
| `subsidiaryFundingHistory` | 値だけ | 3 | — |
| `shareholderProposals` | 値だけ | 1 | — |

**ハッシュには含まれないが `tests/fixtures/` に値がある → セーブ/ベースライン系テストの fixture が動く（23件）**

| フィールド | 状態 | tests/ での参照ファイル数 | fixture |
|---|---|---|---|
| `selectedArea` | 初期値のみ | 2 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `hasSeenCompanyBuyoutEnding` | 値だけ | 2 | current-version-save.json, future-version-save.json, embedded-javascript-baseline.js |
| `expansionVersion` | 初期値のみ | 0 | embedded-javascript-baseline.js |
| `founderOriginCityName` | 値だけ | 0 | embedded-javascript-baseline.js |
| `founderHomeDeskSlots` | 値だけ | 1 | embedded-javascript-baseline.js |
| `lastFounderHomeEventWeek` | 初期値のみ | 0 | embedded-javascript-baseline.js |
| `lastStoreHuntWeek` | 値だけ | 0 | embedded-javascript-baseline.js |
| `lobbyInfluence` | 値だけ | 0 | embedded-javascript-baseline.js |
| `patentLicenseIncome` | 値だけ | 0 | embedded-javascript-baseline.js |
| `productFunnelEventLog` | 値だけ | 0 | embedded-javascript-baseline.js |
| `ownershipHistory` | 値だけ | 0 | embedded-javascript-baseline.js |
| `peRealizedPL` | 値だけ | 6 | embedded-javascript-baseline.js |
| `successorTrainingWeeks` | 値だけ | 0 | embedded-javascript-baseline.js |
| `serialEntrepreneurHistory` | 値だけ | 0 | embedded-javascript-baseline.js |
| `completionVersion` | 初期値のみ | 0 | embedded-javascript-baseline.js |
| `transportRebuildLog` | 値だけ | 0 | embedded-javascript-baseline.js |
| `companyBuyoutHistory` | 値だけ | 1 | embedded-javascript-baseline.js |
| `lastNewCompanyFoundingWeek` | 値だけ | 0 | embedded-javascript-baseline.js |
| `equippedTitleID` | 値だけ | 0 | embedded-javascript-baseline.js |
| `parityVersion` | 初期値のみ | 0 | embedded-javascript-baseline.js |
| `advisorLastGeneratedWeek` | 値だけ | 0 | embedded-javascript-baseline.js |
| `awardEventLog` | 値だけ | 0 | embedded-javascript-baseline.js |
| `maDealHistory` | 値だけ | 1 | pe-fund-acquisition-atomicity.js |

**ハッシュにも fixture にも含まれない（38件）**

| フィールド | 状態 | tests/ での参照ファイル数 | fixture |
|---|---|---|---|
| `difficultyOpeningBalanceApplied` | 値だけ | 1 | — |
| `companyRecallCrisisVersion` | 値だけ | 1 | — |
| `productInnovationVersion` | 値だけ | 1 | — |
| `productInnovationHistory` | 値だけ | 1 | — |
| `shareholderActivismVersion` | 値だけ | 0 | — |
| `boardActivistSeats` | 値だけ | 1 | — |
| `shareholderValueDestructionVersion` | 値だけ | 0 | — |
| `shareholderPortfolioInefficiencyVersion` | 値だけ | 0 | — |
| `macroCycleVersion` | 値だけ | 1 | — |
| `industrySpecificEventVersion` | 値だけ | 0 | — |
| `industryEventResponsePlanVersion` | 値だけ | 0 | — |
| `industryEventResponsePlanHistory` | 値だけ | 2 | — |
| `productLifecycleVersion` | 値だけ | 2 | — |
| `productLifecycleHistory` | 値だけ | 3 | — |
| `productRecallVersion` | 値だけ | 0 | — |
| `productRecallHistory` | 値だけ | 3 | — |
| `listedSubsidiaryMarketVersion` | 値だけ | 0 | — |
| `listedSubsidiaryMarketHistory` | 値だけ | 3 | — |
| `listedSubsidiaryPortfolioVersion` | 値だけ | 0 | — |
| `listedSubsidiaryControlVersion` | 値だけ | 0 | — |
| `listedSubsidiaryControlHistory` | 値だけ | 2 | — |
| `subsidiaryIntegrationSynergyVersion` | 値だけ | 0 | — |
| `interSubsidiarySynergyVersion` | 値だけ | 0 | — |
| `groupCapitalAllocationVersion` | 値だけ | 0 | — |
| `groupCapitalAllocationHistory` | 値だけ | 1 | — |
| `groupRestructuringVersion` | 値だけ | 0 | — |
| `restructuringProgressVersion` | 値だけ | 0 | — |
| `subsidiaryRelistingVersion` | 値だけ | 0 | — |
| `subsidiaryRelistingHistory` | 値だけ | 3 | — |
| `listedSubsidiaryFollowOnOfferingVersion` | 値だけ | 0 | — |
| `listedSubsidiaryFollowOnOfferingHistory` | 値だけ | 3 | — |
| `subsidiaryIPOPreparationVersion` | 値だけ | 0 | — |
| `subsidiaryIPOPreparationHistory` | 値だけ | 3 | — |
| `subsidiaryIPOSecondarySaleVersion` | 値だけ | 0 | — |
| `subsidiaryIPOSecondarySaleHistory` | 値だけ | 3 | — |
| `newBusinessCommercializationHistory` | 値だけ | 4 | — |
| `executiveModifiers` | 値だけ | 3 | — |
| `executiveDismissalDisruptionUntilWeek` | 値だけ | 2 | — |

## 3. 要判断の一覧（結論を出していないもの）

| # | 論点 | 内容と根拠 | 影響範囲 |
|---|---|---|---|
| J1 | `?ui=3` を「本番」に数えるか | ui3-* の 25 モジュールは `?ui=3` でだけ描画（既定URLでは `rendersNatively` が偽。js/app.js:102）。docs/ui-v3/README.md は cutover までの段階的状態と定める。「稼働」か「未接続」かは方針次第のため全て「不明」とした | features.md の ui3-* 行 |
| J2 | **本番で画面に出ない機能（実害の可能性が高い）** | (a) `bank-loans-covenants`・`board-governance-resolution`: 画面側 `inject()` が `[data-screen="finance"]` を探す（js/bank-loans-covenants.js:86, js/board-governance-resolution.js:459）が、`data-screen` は `selectedTab` の値（js/app.js:115）で、TABS（js/app.js:80-84）と `renderScreen`（:140-146）に 'finance' はない（銀行は 'bank'）。`selectedTab` を 'finance' にする経路もない（`tab:'finance'` は店舗シートの内部タブ js/iphone-playtest-fixes.js:123,138 のみ）。(b) 他の9モジュール（convertible-bonds-dilution / corporate-bonds-ratings / preferred-shares-dividends / executive-retirement-succession / executive-reviews-succession-board / executives-department-assignments / global-company-ranking-goals / hall-of-fame-generations / long-run-guidance）: `renderSection` の呼出元が js/ に**ない**（inject/enhancer も無し）。全タブ巡回の実測でも出力ゼロ。一方、8本のテストが `selectedTab:'finance'` を直接渡して `renderSection` を呼び合格している（例 tests/bank-loans-covenants-test.js:13）。→ 画面を載せるのか、機能ごと不要なのかは設計判断 | features.md（該当行）・spec-sources.md C14 |
| J3 | 条件付き機能を「稼働」とみなすか | 上場後（17モジュール: capital-allocation-* 16・shareholder-* 3）、子会社保有後（22）、資金危機時（9）、賃貸契約成立後（6）にだけ出る機能は、計測用に作れた状態では未発火。コード上は到達可能に見えるが未確認。到達条件を満たす専用シナリオ（IPO: `ipoMissingReasons`＝本社・経理部門・取締役会・直近52週利益1,000万円・企業価値1億円／子会社化: 持分50%以上 engine.js:1664）で再計測すれば「稼働」か「未接続」に分けられる | features.md の「不明」行 |
| J4 | `phase3-ownership-apply` と Economic Engine の「休眠」物 | 計画適用は休眠、境界判定だけ稼働。economic-shadow-journal・phase3-* 読み取り専用スライスは「将来用の段階導入物」か「不要」か | features.md |
| J5 | Mode 0 の3モジュール | 社債・転換社債・優先株は発行・償還が意図的な no-op（GF-002）。画面は「現在利用できません」と説明するだけ（かつ J2 により到達不能）。残すか | features.md |
| J6 | executive-* チェーン | executive-retirement-succession は役員を実際に退任させる（計算は稼働）が画面は到達不能。executives-department-assignments は executiveModifiers が読み手なし | features.md |
| J7 | 値だけフィールドを残す理由 | `*Version`/`*History`/`*Log` は監査・将来用の記録として意図的に持つ可能性（テストが検証関数で長さ上限だけ読む例: js/product-lifecycle.js:111）。消す/残すは方針判断 | state-fields.md（69件） |
| J8 | `founderEducationLevel`・`lobbyInfluence` | 前例の再発。書くだけで読まれない（個人資産/創業者タブの「教育」「ロビー」投資の効果が実際には何も起きない）。効果を実装するか、操作ごと消すか | state-fields.md |
| J9 | 文書の矛盾 C1〜C14 | どちらが正しいかは決めていない。実測値を併記した（C1: 245 / C2: B〜L / C3: 36-43 / C4: 9 / C11: 79・164・82） | spec-sources.md |
| J10 | UI v3 の画面数 | docs/ui-v3/README.md は「19画面」、実装は 20（`pe-portfolio` が追加）。README を直すのか、画面を19に戻すのか | spec-sources.md C10 |

## 4. 発見事項（調査の副産物）

1. **テストが通るのに本番で動かない画面**: J2 のとおり、テストは `renderSection` を直接呼んで描画を確認しており、本番では呼出元がないか、存在しない 'finance' 画面を対象にしていて一度も出ない。「テストが通っている＝画面に出ている」とは限らない実例。
2. **`engine.js` の `SAVE_VERSION` は 8**（js/engine.js:18）のまま、`js/save-v9.js:18` が 9 を定義して `TycoonEngine` を差し替える二層構造。実行時の `g.saveVersion` は 9。
3. **enhancer の登録数**: 実測 registered=82（外部79＋index.html 内蔵3）、実行=164。`tests/startup-runtime-budget-test.js` の上限 79/164 はちょうど上限。同ファイルのコメント（baseline 100 = 50+50）だけが古い（C11）。
4. 会計の整合: 計測中に `companyCash` を直接書き換えると `P2-CLOSE-BS-IDENTITY`（貸借一致）で週送りが失敗した（`FinanceValidationBoundaryError`）。これは仕様どおりの防護であり、資金の注入には `contributeFounderCapital` を使った。

## 5. 限界（何をしていないか）

- 全体の動的計測は「新規ゲーム・既定シナリオ(free)・難易度 normal」の 1 シードのみ。複数シード・他シナリオ・IPO後/子会社保有後/危機時の状態は作っていない（J3）。
- 「稼働(静的のみ)」は、コード上の参照があることしか示さない。
- 状態フィールドは `g` のトップレベルのみ（0 の 3）。動的キーアクセスは正規化ループのみ確認。
- 文書の矛盾探しは全文照合ではない（spec-sources.md 冒頭）。
- UI操作は「基準状態で1種類につき1回」。入力値は既定値のみ。
