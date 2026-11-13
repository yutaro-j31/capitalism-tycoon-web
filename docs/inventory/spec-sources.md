# 作業4：仕様の出どころ一覧

- 基準: `main` @ `47217818`。調査のみ。
- 対象: リポジトリ内の Markdown/テキスト **293ファイル**（`git ls-files "*.md" "*.txt"`。`docs/economic-engine/` 121件を含む）＋仕様・検証ログとして働く非Markdown（本ファイル末尾）。
- **最終更新**: `git log` の最終コミット日（履歴を完全取得して算出。shallow ではない）。
- **要約の作り方（正直に）**: 主要文書は冒頭〜主要部を読んで手で要約した（`手`）。それ以外は群の説明と見出しを機械的に付けただけで精読していない（`群`/`見出し`）。
- **矛盾の探し方（正直に）**: 全文書の全文照合はしていない。(1) 数値・行番号・名称などコードで検証できる主張、(2) 文書同士が互いを参照する箇所、(3) 「正」を名乗る文書の重複、に絞って確認した。**見つからなかったことは「矛盾がない」を意味しない**。どちらが正しいかは決めていない（実測値は併記）。

## 1. 矛盾の一覧（「A では〜、B では〜」）

| ID | 論点 | A では〜 | B では〜 |
|---|---|---|---|
| C1 | js/ のモジュール数 | docs/GAME_OVERVIEW.md:177「`js/` currently holds 203 modules」 | `ls js ／ wc -l` = 245、index.html の `<script src="./js/…">` = 245（実測）。 |
| C2 | シャードの明示割当範囲 | docs/GAME_OVERVIEW.md:178「`tests/run-all-shards.json` assigns B-K explicitly」 | CLAUDE.md:215「explicitly assigns B-L」、tests/run-all-shards.json のキーは B〜L の11個。 |
| C3 | ENDING_DEFS の行番号 | docs/GAME_OVERVIEW.md:29「`js/completion.js`'s `ENDING_DEFS` (lines 34-41)」 | js/completion.js では `const ENDING_DEFS = [` が36行目、`];` が43行目。 |
| C4 | 現在の saveVersion | docs/CURRENT_SAVE_SCHEMA.md:161「現在の明示的スキーマ版は `saveVersion: 3`」。docs/SAVE_MIGRATION_GUIDE.md:7 も `saveVersion: 3` を現行として記述。docs/CURRENT_SAVE_SCHEMA.md:192・SAVE_MIGRATION_GUIDE.md:125・MARKET_SYSTEM_GUIDE.md:43・JAVASCRIPT_MODULE_GUIDE.md:117・WORKFORCE_AND_ORGANIZATION_GUIDE.md:9 は「saveVersion 8 では…」と現行のように記述 | CLAUDE.md §2・AGENTS.md §2「saveVersion=9」、js/save-v9.js:18 `SAVE_VERSION=9`、release-candidate.json:15 `"version": 9`。実行時の `g.saveVersion` も 9（計測で確認）。なお js/engine.js:18 の `SAVE_VERSION = 8` は v8→v9 移行の基底値として残っている（js/save-v9.js:17 `LEGACY_SAVE_VERSION=engine.SAVE_VERSION`）。 |
| C5 | GAME_SYSTEM_AUDIT.md の退役表示 | CLAUDE.md:32「`docs/GAME_SYSTEM_AUDIT.md` is likewise retired」 | docs/GAME_SYSTEM_AUDIT.md の冒頭には退役表記がない（先頭は「監査日: 2026-07-14」）。対して docs/DEVELOPMENT_ROADMAP.md:3 には「退役済み（2026-08-25）」の表記がある。 |
| C6 | 「現状」の構成 | docs/TECHNICAL_REFACTOR_PLAN.md:5-10「`index.html` に HTML、CSS、マスターデータ、エンジン…が全て含まれる。物理ファイルは1つ」 | 同ファイル:223 以降の追記では js/ 分割済みと記述。実際は 245 本の JS（index.html は 18KB）。計画書の「現状」節は更新されていない。 |
| C7 | index.html が参照する JS | tests/README.md:36「Phase 0 JavaScript files referenced by `index.html`」として runtime/data/engine/expansion/completion/parity/app の7本を列挙 | index.html は 245 本を読み込む（前行の記述は Phase 0 当時の最小集合）。 |
| C8 | UIリスキン方針の所在 | docs/ui-redesign-roadmap.md:5「方針そのものは CLAUDE.md の『UIリスキン（D UI shell拡張）の方針』節を参照」 | CLAUDE.md にその見出しの節は存在しない（grep 0件）。D UI の記述は CLAUDE.md §3 にある。 |
| C9 | 画面（UI）の「正」 | AGENTS.md:19「D UI or map work: … `docs/ui-redesign-roadmap.md`」／CLAUDE.md §3「D UI is the production visual language」 | docs/ui-v3/README.md:3「この文書が画面まわりの唯一の基準」。CLAUDE.md §3 の Exception 段落が UI v3 を例外として認めているが、AGENTS.md の読書ルーティングは UI v3 を「新画面は ?ui=3」とだけ記す。 |
| C10 | 画面数 | docs/ui-v3/README.md:20,58「現在の19画面（`g.selectedTab` の値）」 | js/app.js:140-146 の `renderScreen` は 20 値（TABS の19＋`pe-portfolio`）を扱い、`ui3.registerScreen` も 20 回呼ばれる（計測）。 |
| C11 | 起動時 enhancer の基準値 | tests/startup-runtime-budget-test.js:8-9 のコメント「reviewed startup baseline is 100 … 50 registration hooks + one 50-hook final pass」 | 同ファイル:15-16 の上限は 79 / 164。実測は registered=82（外部79＋index.html内蔵3）・hookExecutions=164（82＋82）。CLAUDE.md §3「budget is 79」は上限値と一致。コメントだけが古い。 |
| C12 | 旧方針の記述 | docs/DEVELOPMENT_ROADMAP.md（退役）の方針「約30業種を均等に薄く広げる」 | CLAUDE.md §1・docs/gameplay-systems-roadmap.md「5本柱を深掘りする」。退役文書が自ら退役を明記しているため意図された差だが、本文は残っている。 |
| C13 | CURRENT_SAVE_SCHEMA の日付 | docs/CURRENT_SAVE_SCHEMA.md 冒頭「監査日: 2026-07-14」 | 本文に「2026-08-26 に廃止」（創業者の体力・健康・集中力）の追記があり、最終更新は 2026-08-26。 |
| C14 | 画面セクションの表示条件 | tests/bank-loans-covenants-test.js:13 ほか7本（計8本）のテストが `selectedTab:'finance'` を渡して各 `renderSection` を直接呼び、HTMLが出ることを確認 | js/app.js:80-84 の TABS と renderScreen(:140-146) に 'finance' タブは存在しない（銀行は 'bank'）。bank-loans-covenants / board-governance-resolution の inject() は `[data-screen="finance"]` を探して出力されず、他9モジュールの renderSection は js/ に呼出元がない。計測では本番でこれらは一度も画面に出なかった（README.md「J2」参照）。 |

## 2. 文書一覧

### 2.1 方針・規則・設計の正本（16件）

| ファイル | 内容の要約 | 要約の種別 | 最終更新 | 行数 | 他の仕様書と矛盾する点 |
|---|---|---|---|---|---|
| `.github/codex/README.md` | Codex Web/Cloud を ChatGPT プランで手動運用する際の説明（API鍵不要・指示ファイルの階層）。 | 手 | 2026-10-21 | 38 | — |
| `.github/codex/prompts/manual-development.md` | Codex 手動開発用の再利用プロンプト。 | 手 | 2026-10-21 | 18 | — |
| `AGENTS.md` | リポジトリ共通の作業規則（進め方・読む資料の選び方・自律範囲・PR/CIの運用）。Economic Engine の F→Q 開発モード、マージ方針（#1055）もここ。 | 手 | 2026-11-10 | 219 | C9 |
| `CLAUDE.md` | プロジェクト固有の設計契約。5本柱・2つの創業ルート・不変条件(SAVE_KEY/saveVersion=9/決定論/会計/会社と個人の分離)・D UI/City Lab地図の契約・既知の落とし穴・検証方針。Codex等も対象（ファイル名は互換のため維持）。 | 手 | 2026-11-10 | 245 | C2, C5, C8, C9, C11, C12 |
| `DESIGN.md` | D UI v2 のデザイン契約（UI/UX 次工程の設計システムの正本。現行シェル・セーブ・会計・決定論は変えない）。 | 手 | 2026-08-31 | 439 | — |
| `docs/AI_DEV_OPERATING_PRINCIPLES_REFERENCE.md` | AI開発運用に関する外部参考資料（エージェント指示・承認境界のレビュー用）。 | 手 | 2026-09-22 | 99 | — |
| `docs/AUTONOMOUS_DEVELOPMENT_PLAYBOOK.md` | 「次の開発作業を進めて」への手順書（過去の事故＝未接続ファイル放置・循環依存・push漏れ等を踏まえる）。 | 手 | 2026-08-06 | 201 | — |
| `docs/GAME_OVERVIEW.md` | 全体の状態要約（コンセプト・5本柱・PE/小型株の状況・不変条件）。自ら「一次資料と食い違ったら一次資料を信じよ」と明記。 | 手 | 2026-09-29 | 250 | C1, C2, C3 |
| `docs/LOCAL_VERIFICATION.md` | CIを開発ループにしない方針（オーナー決定 2026-10-20）と手元検証の手順。マージ規則は緩めない。 | 手 | 2026-10-20 | 61 | — |
| `docs/MOBILE_MANAGEMENT_SIM_DESIGN_PRINCIPLES.md` | モバイル経営シミュレーション設計原則（外部参考資料。実装の真実ではない）。 | 手 | 2026-09-22 | 381 | — |
| `docs/release-readiness.md` | リリース判定の最小ゲート（`npm run test:release`）。 | 手 | 2026-07-17 | 62 | — |
| `docs/ui-v3/README.md` | UI v3（画面の作り直し）の確定設計書。オーナー承認 2026-11-10。?ui=3 の裏で進め、cutover まで現行UIは既定のまま。合格基準・タスク表を含む。 | 手 | 2026-11-12 | 754 | C9, C10 |
| `docs/ui-v3/device-checklist.md` | UI v3 の実機確認チェックリスト。 | 手 | 2026-11-12 | 57 | — |
| `docs/ui-v3/migration-ledger.md` | UI v3 移行台帳（現行画面から消える操作と行き先）。 | 手 | 2026-11-12 | 531 | — |
| `tests/BASELINE_RESULTS.md` | 2026-07-14 時点のテストベースライン結果（Node v24.15.0）。 | 手 | 2026-07-15 | 180 | — |
| `tests/README.md` | テストの使い方と各テスト群の説明（npm scripts・JavaScript抽出テスト等）。 | 手 | 2026-07-15 | 68 | C7 |

### 2.2 ロードマップ・計画・要望（13件）

| ファイル | 内容の要約 | 要約の種別 | 最終更新 | 行数 | 他の仕様書と矛盾する点 |
|---|---|---|---|---|---|
| `docs/CAPITAL_ALLOCATION_VISION.md` | 資本配分構想（Capital Allocation Vision）。1300行超の長期構想書。 | 手 | 2026-10-01 | 1304 | — |
| `docs/CI_REQUIRED_CHECKS_AND_STRATEGY_BALANCE_PROPOSAL.md` | 見出し: 「CI required checks and Strategy Balance de-duplication — proposal (design only)」 | 見出し | 2026-10-11 | 56 | — |
| `docs/DEVELOPMENT_ROADMAP.md` | 退役済み（2026-08-25）。saveVersion 8 時代の Phase 0〜9 構想。歴史記録。 | 手 | 2026-08-25 | 202 | C4, C5, C12 |
| `docs/FOUNDING_ROUTE_REBALANCE_DESIGN.md` | 起業パート（5本柱）リバランス設計書。ジム・コンビニ・不動産仲介の構造修正は完了、成長率の底上げは未着手（本文の状態表記）。 | 手 | 2026-09-30 | 406 | — |
| `docs/REFERENCE_GAMES_RESEARCH.md` | 参考ゲーム調査（Wall Street Raider 動画調査まとめと Capitalism Tycoon への示唆）。 | 手 | 2026-09-29 | 1748 | — |
| `docs/TECHNICAL_REFACTOR_PLAN.md` | index.html 単一ファイルの段階分割計画と、分割実施の記録（Phase 0 JS/CSS抽出）。 | 手 | 2026-07-14 | 228 | C6 |
| `docs/economic-engine/ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md` | Economic Engine のフェーズ依存グラフ。 | 手 | 2026-10-06 | 257 | — |
| `docs/economic-engine/ECONOMIC_ENGINE_IMPLEMENTATION_FIRST_ROADMAP.md` | Economic Engine の実装先行ロードマップ v2（機能完成を先、包括品質を後）。ソース・オブ・トゥルース切替や Phase 4 Entry の承認ではない。 | 手 | 2026-10-22 | 196 | — |
| `docs/economic-engine/ECONOMIC_ENGINE_ROADMAP.md` | Economic Engine 統合ロードマップ（承認済み実装ベースライン。Gate C/D 完了）。1904行。 | 手 | 2026-10-16 | 1904 | — |
| `docs/feature-requests.md` | オーナー要望と実装可否調査のメモ。着手前に「現状どこまで実装済みか」を確認するための台帳。 | 手 | 2026-08-27 | 631 | — |
| `docs/gameplay-systems-roadmap.md` | 現行のゲーム深掘りトラッカー（5本柱の状況・各システムの最小コア/拡張候補）。 | 手 | 2026-11-04 | 210 | C12 |
| `docs/global-company-ranking-goals.md` | 世界企業ランキング・達成目標の仕様。 | 手 | 2026-07-29 | 8 | — |
| `docs/ui-redesign-roadmap.md` | D UI shell（CI2風リスキン）の計画・進捗記録。 | 手 | 2026-09-01 | 161 | C8, C9 |

### 2.3 モード別設計書（PE・小型株）（3件）

| ファイル | 内容の要約 | 要約の種別 | 最終更新 | 行数 | 他の仕様書と矛盾する点 |
|---|---|---|---|---|---|
| `docs/MICROCAP_MODE_DESIGN.md` | 小型株モード設計書（未解決点解消済み・実装タスク作成済み）。 | 手 | 2026-09-30 | 435 | — |
| `docs/PE_MODE_DESIGN.md` | PEモード設計書（T1〜T26 実装済み）。 | 手 | 2026-09-23 | 1548 | — |
| `docs/PE_MODE_TASKS.md` | PEモード実装タスク一覧（T1〜T26 実装済み・コミットSHA付き）。 | 手 | 2026-09-23 | 609 | — |

### 2.4 監査・調査（時点のスナップショット）（26件）

| ファイル | 内容の要約 | 要約の種別 | 最終更新 | 行数 | 他の仕様書と矛盾する点 |
|---|---|---|---|---|---|
| `docs/ACCOUNTING_ROUNDING_AUDIT.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「週次現金丸め補正の監査方針」 | 群 | 2026-08-04 | 17 | — |
| `docs/COMPETITOR_ENGINE_AUDIT.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Phase 5A 競合エンジン監査」 | 群 | 2026-07-15 | 32 | — |
| `docs/CSS_EXTRACTION_AUDIT.md` | Phase 0 の JS/CSS 分割に関する監査・ガイド（2026-07-14 時点）。見出し: 「CSS Extraction Audit」 | 群 | 2026-07-14 | 52 | — |
| `docs/CURRENT_SAVE_SCHEMA.md` | 現行セーブスキーマ調査（localStorageキー・保存/読込処理・トップレベル項目一覧）。2026-07-14 監査＋2026-08-26 追記。 | 手 | 2026-08-26 | 218 | C4, C13 |
| `docs/ENGINE_TRANSACTION_AUDIT.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Engine Transaction Audit」 | 群 | 2026-07-14 | 99 | — |
| `docs/FINANCE_ENGINE_AUDIT.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Phase 1B 財務エンジン監査」 | 群 | 2026-07-14 | 96 | — |
| `docs/GAME_SYSTEM_AUDIT.md` | 2026-07-14 時点の「index.html 単一ファイル実装」の監査（実装済み/未実装の棚卸し）。CLAUDE.md が退役扱いにしている。 | 手 | 2026-07-14 | 97 | C5 |
| `docs/JAVASCRIPT_EXTRACTION_AUDIT.md` | Phase 0 の JS/CSS 分割に関する監査・ガイド（2026-07-14 時点）。見出し: 「JavaScript Extraction Audit」 | 群 | 2026-07-14 | 70 | — |
| `docs/JAVASCRIPT_MODULE_SPLIT_AUDIT.md` | Phase 0 の JS/CSS 分割に関する監査・ガイド（2026-07-14 時点）。見出し: 「JavaScript Module Split Audit」 | 群 | 2026-07-14 | 63 | — |
| `docs/MARKET_ENGINE_AUDIT.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「MARKET_ENGINE_AUDIT」 | 群 | 2026-07-14 | 22 | — |
| `docs/PHASE6B1_NORMAL_IPO_BALANCE_AUDIT.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6B-1: Normal-start IPO balance audit」 | 群 | 2026-07-16 | 46 | — |
| `docs/QA_AUDIT_2026-08-25.md` | オーナー依頼のコード全体レビュー＋実ブラウザ試遊の監査記録（項目ごとにステータス更新）。 | 手 | 2026-08-26 | 201 | — |
| `docs/SAVE_MIGRATION_AUDIT.md` | セーブ移行の監査（2026-07-14）。 | 手 | 2026-07-14 | 147 | — |
| `docs/STOCK_CHART_AUDIT.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Stock chart audit」 | 群 | 2026-07-14 | 21 | — |
| `docs/SUPPLY_CHAIN_AUDIT.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「SUPPLY CHAIN AUDIT」 | 群 | 2026-07-15 | 65 | — |
| `docs/WORKFORCE_ENGINE_AUDIT.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Phase 4A Workforce Engine Audit」 | 群 | 2026-07-15 | 59 | — |
| `docs/audits/property-insurance-loss-claim-model.md` | 不動産・テナント会計の不変条件メモ。見出し: 「Property insurance loss and claim invariants」 | 群 | 2026-07-31 | 12 | — |
| `docs/audits/real-estate-capex-roi-invariants.md` | 不動産・テナント会計の不変条件メモ。見出し: 「Real Estate Capex ROI Invariants」 | 群 | 2026-07-31 | 12 | — |
| `docs/audits/real-estate-portfolio-dashboard-model.md` | 不動産・テナント会計の不変条件メモ。見出し: 「不動産ポートフォリオ本部モデル」 | 群 | 2026-07-31 | 11 | — |
| `docs/audits/real-estate-rent-performance-invariants.md` | 不動産・テナント会計の不変条件メモ。見出し: 「Real Estate Rent Performance Invariants」 | 群 | 2026-07-31 | 11 | — |
| `docs/audits/real-estate-rent-pricing-model.md` | 不動産・テナント会計の不変条件メモ。見出し: 「Real-estate rent pricing invariants」 | 群 | 2026-07-31 | 12 | — |
| `docs/audits/tenant-rent-accounting-invariants.md` | 不動産・テナント会計の不変条件メモ。見出し: 「Tenant rent accounting invariants」 | 群 | 2026-07-31 | 10 | — |
| `docs/century-playtest-audit-post-health-removal.md` | 創業者の体力・健康システム廃止後の100年プレイテスト監査。 | 手 | 2026-08-26 | 142 | — |
| `docs/century-playtest-audit.md` | 100年プレイテスト監査（2026-08-25）。 | 手 | 2026-08-26 | 45 | — |
| `docs/economic-engine/PHASE_3_INDEPENDENT_AUDIT.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 Design Audit and Evidence Ledger」 | 群 | 2026-10-15 | 115 | — |
| `docs/economic-engine/TRACK_A_WRITER_AUTHORITY_AUDIT.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Track A — Writer Authority audit: shares, ownership, dividends (#922)」 | 群 | 2026-10-15 | 470 | — |

### 2.5 地図（Map）関連（7件）

| ファイル | 内容の要約 | 要約の種別 | 最終更新 | 行数 | 他の仕様書と矛盾する点 |
|---|---|---|---|---|---|
| `assets/map-sprites/phase1/README.md` | アセット説明。見出し: 「Phase 1 Daytime Map Assets」 | 群 | 2026-09-02 | 23 | — |
| `assets/vendor/THREE-LICENSE.txt` | アセット説明。見出し: 「」 | 群 | 2026-10-07 | 22 | — |
| `docs/city-lab-production-port.md` | City Lab（3D地図）を本番へ移植する際の描画境界の承認文書。 | 手 | 2026-10-07 | 72 | — |
| `docs/map-phase1-canvas-foundation.md` | マップ Phase 1（Canvas+sprite基盤）。 | 手 | 2026-09-02 | 230 | — |
| `docs/map-phase2-asset-integration-contract.md` | マップ Phase 2 アセット統合契約（未統合・プレビュー時点の記述）。 | 手 | 2026-09-03 | 497 | — |
| `docs/map-phase2-production-integration-audit.md` | Phase 2 マップの本番統合準備監査（歴史記録。1333行）。 | 手 | 2026-09-06 | 1333 | — |
| `docs/map-prefecture-identity.md` | 47都道府県の地域性（構造的バリエーション）の設計。 | 手 | 2026-09-04 | 257 | — |

### 2.6 Economic Engine 関連（個別）（116件）

| ファイル | 内容の要約 | 要約の種別 | 最終更新 | 行数 | 他の仕様書と矛盾する点 |
|---|---|---|---|---|---|
| `docs/economic-engine/GATE_D_VALIDATION.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Gate D Validation — Economic Engine Roadmap v2」 | 群 | 2026-10-06 | 314 | — |
| `docs/economic-engine/IPHONE_BASELINE_PROTOCOL.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Physical iPhone Economic Engine Baseline Protocol」 | 群 | 2026-09-29 | 566 | — |
| `docs/economic-engine/IPO_ATOMICITY_001_CORRECTION.md` | Economic Engine: 原子性（atomicity）是正の記録。見出し: 「IPO-ATOMICITY-001 — parent IPO final wrapper atomicity」 | 群 | 2026-10-09 | 63 | — |
| `docs/economic-engine/MA_SUBSIDIARY_SALE_ATOMICITY_001_CORRECTION.md` | Economic Engine: 原子性（atomicity）是正の記録。見出し: 「MA-SUBSIDIARY-SALE-ATOMICITY-001 — subsidiary disposal commit boundary」 | 群 | 2026-10-09 | 60 | — |
| `docs/economic-engine/P3_3_001_OWN_SHARE_CORRECTION.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P3-3-001 — Own-share acquisition quantity correction」 | 群 | 2026-10-08 | 35 | — |
| `docs/economic-engine/P3_4_001_SAVE_ATOMICITY_CORRECTION.md` | Economic Engine Phase 3 P3-4: 個別の是正記録（保存原子性など）。見出し: 「P3-4-001 — Synchronous save acceptance and rollback」 | 群 | 2026-10-08 | 75 | — |
| `docs/economic-engine/P3_4_002_SHARE_SWAP_FAILURE_REPORT.md` | Economic Engine Phase 3 P3-4: 個別の是正記録（保存原子性など）。見出し: 「P3-4-002 — Share-swap closing lacks the outer rollback boundary」 | 群 | 2026-10-08 | 118 | — |
| `docs/economic-engine/P3_4_003_INVESTOR_SAVE_CORRECTION.md` | Economic Engine Phase 3 P3-4: 個別の是正記録（保存原子性など）。見出し: 「P3-4-003 — Investor acceptance save/rollback correction」 | 群 | 2026-10-08 | 28 | — |
| `docs/economic-engine/P3_4_004_FOUNDER_SALE_SAVE_CORRECTION.md` | Economic Engine Phase 3 P3-4: 個別の是正記録（保存原子性など）。見出し: 「P3-4-004 — Founder secondary sale save/rollback correction」 | 群 | 2026-10-09 | 24 | — |
| `docs/economic-engine/P3_4_005_STOCK_PURCHASE_SAVE_CORRECTION.md` | Economic Engine Phase 3 P3-4: 個別の是正記録（保存原子性など）。見出し: 「P3-4-005 — stock purchase save boundary」 | 群 | 2026-10-09 | 22 | — |
| `docs/economic-engine/P3_4_006_STOCK_SALE_SAVE_CORRECTION.md` | Economic Engine Phase 3 P3-4: 個別の是正記録（保存原子性など）。見出し: 「P3-4-006 — stock sale save boundary」 | 群 | 2026-10-09 | 20 | — |
| `docs/economic-engine/P3_4_007_STOCK_SPLIT_ATOMICITY_FIX.md` | Economic Engine Phase 3 P3-4: 個別の是正記録（保存原子性など）。見出し: 「P3-4-007 stockSplit save atomicity correction」 | 群 | 2026-10-10 | 30 | — |
| `docs/economic-engine/P3_4_008_STOCK_SPLIT_HISTORY_CORRECTION.md` | Economic Engine Phase 3 P3-4: 個別の是正記録（保存原子性など）。見出し: 「P3-4-008 — preserve stockSplit price history」 | 群 | 2026-10-09 | 18 | — |
| `docs/economic-engine/P3_4_FC_G30_PE_MIRROR_CALLER_BOUNDARY.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P3-4 FC-G30-01 — PE subsidiary mirror caller and normalization boundary」 | 群 | 2026-11-01 | 43 | — |
| `docs/economic-engine/P3_4_G1_GENERATION_BINDING_DECISION.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P3-4 G1 — generation binding: Owner decision record」 | 群 | 2026-11-10 | 81 | — |
| `docs/economic-engine/P3_4_G40_BROWSER_FAULT_APPLICABILITY.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P3-4 G40 — browser fault-applicability matrix (read-only)」 | 群 | 2026-11-05 | 82 | — |
| `docs/economic-engine/P3_4_GAP_RECONCILIATION.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 P3-4 — family-closure gap reconciliation (G7)」 | 群 | 2026-11-05 | 180 | — |
| `docs/economic-engine/P3_4_MBO_WEBKIT_COVERAGE.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P3-4 — installed MBO writer WebKit coverage」 | 群 | 2026-10-16 | 67 | — |
| `docs/economic-engine/P4_AUD_007_OPTION_A_DESIGN.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P4-AUD-007 (#1014) — company property mortgage liability: Option A design and ve」 | 群 | 2026-10-22 | 167 | — |
| `docs/economic-engine/P4_AUD_010_MORTGAGE_SHORTFALL_CORRECTION.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P4-AUD-010 / #1079: mortgage shortfall correction」 | 群 | 2026-10-27 | 120 | — |
| `docs/economic-engine/PE_FUND_ACQUISITION_ATOMICITY_001_CORRECTION.md` | Economic Engine: 原子性（atomicity）是正の記録。見出し: 「PE-FUND-ACQUISITION-ATOMICITY-001 — PE acquisition commit boundary」 | 群 | 2026-10-09 | 65 | — |
| `docs/economic-engine/PHASE_0_5_HARNESS.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 0.5 Permanent Headless Harness」 | 群 | 2026-10-06 | 303 | — |
| `docs/economic-engine/PHASE_0_5_SEED_VALIDATION.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 0.5 Seed Provenance and Independence Contract」 | 群 | 2026-10-01 | 189 | — |
| `docs/economic-engine/PHASE_0_CONTRACTS.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Economic Engine Phase 0 Contracts」 | 群 | 2026-10-25 | 850 | — |
| `docs/economic-engine/PHASE_1_ACCEPTANCE.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 1 Acceptance / Exit Review」 | 群 | 2026-10-07 | 179 | — |
| `docs/economic-engine/PHASE_1_FIRST_CUTOVER.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 1 First Limited Cutover — Store Renovation」 | 群 | 2026-10-07 | 109 | — |
| `docs/economic-engine/PHASE_1_SHADOW_JOURNAL.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 1 Shadow Operation Journal Contract」 | 群 | 2026-10-07 | 113 | — |
| `docs/economic-engine/PHASE_2_ACCEPTANCE.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 2 Accounting Acceptance」 | 群 | 2026-10-08 | 64 | — |
| `docs/economic-engine/PHASE_2_ACCOUNTING_BASELINE.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 2 Standalone Accounting Baseline」 | 群 | 2026-10-08 | 97 | — |
| `docs/economic-engine/PHASE_2_BUYBACK_RECONCILIATION.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 2 Buyback Reconciliation」 | 群 | 2026-10-07 | 120 | — |
| `docs/economic-engine/PHASE_2_DEBT_ROLLFORWARD.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 2 Debt Roll-Forward Contract」 | 群 | 2026-10-07 | 161 | — |
| `docs/economic-engine/PHASE_2_DIVIDEND_RECONCILIATION.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 2 Dividend Reconciliation」 | 群 | 2026-10-07 | 79 | — |
| `docs/economic-engine/PHASE_2_FIXED_ASSET_RECONCILIATION.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 2 Fixed-Asset Reconciliation」 | 群 | 2026-10-07 | 132 | — |
| `docs/economic-engine/PHASE_2_STANDALONE_CLOSE.md` | Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー。見出し: 「Phase 2 Standalone Close Contract」 | 群 | 2026-10-07 | 126 | — |
| `docs/economic-engine/PHASE_3_4_IMPLEMENTATION_FIRST_GATE_ALIGNMENT.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Economic Engine — Phase 3 / Phase 4 implementation-first contract and gate align」 | 群 | 2026-10-16 | 87 | — |
| `docs/economic-engine/PHASE_3_ACQUIRE_COMPAT_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial captured acquireTarget evidence」 | 群 | 2026-11-03 | 44 | — |
| `docs/economic-engine/PHASE_3_BUYBACK_BASE_REJECTION_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial captured buyback base rejection evidence」 | 群 | 2026-11-03 | 49 | — |
| `docs/economic-engine/PHASE_3_BUYBACK_EXPORT_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial buyback direct-export evidence」 | 群 | 2026-10-30 | 27 | — |
| `docs/economic-engine/PHASE_3_BUYBACK_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: installed shareholder-buyback transaction evidence」 | 群 | 2026-10-26 | 129 | — |
| `docs/economic-engine/PHASE_3_CAPTURED_IPO_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial captured IPO base evidence」 | 群 | 2026-10-31 | 37 | — |
| `docs/economic-engine/PHASE_3_COMMAND_EXPLANATION_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-10 inspect-only command explanation preparation」 | 群 | 2026-10-31 | 67 | — |
| `docs/economic-engine/PHASE_3_CONTROL_ELIGIBILITY_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-9 slice — player common-class Control Ladder eligibility (read-only)」 | 群 | 2026-10-21 | 79 | — |
| `docs/economic-engine/PHASE_3_CROSS_SLICE_ARCHITECTURE.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 Cross-slice Ownership Architecture」 | 群 | 2026-10-15 | 140 | — |
| `docs/economic-engine/PHASE_3_DIVIDEND_DECLARATION_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: dividend declaration transaction evidence」 | 群 | 2026-10-27 | 124 | — |
| `docs/economic-engine/PHASE_3_DIVIDEND_PAYMENT_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: canonical quarterly dividend-payment evidence」 | 群 | 2026-10-26 | 134 | — |
| `docs/economic-engine/PHASE_3_ENTRY_CONTRACT.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 Entry Contract」 | 群 | 2026-10-16 | 115 | — |
| `docs/economic-engine/PHASE_3_FOUNDER_WEALTH_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-11 — Founder wealth read-only projection (first component slice)」 | 群 | 2026-11-03 | 348 | — |
| `docs/economic-engine/PHASE_3_G5_COMPETITOR_DILUTION.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 P3-4 — competitor dilution on every external issuance (G5)」 | 群 | 2026-11-03 | 54 | — |
| `docs/economic-engine/PHASE_3_GROUP_NEGOTIATED_SALE_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: negotiated subsidiary sale evidence (W-GROUP-NEGOTIATED)」 | 群 | 2026-10-28 | 99 | — |
| `docs/economic-engine/PHASE_3_GROUP_RESTRUCTURING_MERGE_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: group restructuring merge evidence (W-GROUP-DISPOSAL, merge)」 | 群 | 2026-10-28 | 100 | — |
| `docs/economic-engine/PHASE_3_GROUP_RESTRUCTURING_SALE_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: group restructuring sale evidence (W-GROUP-DISPOSAL, sale)」 | 群 | 2026-10-28 | 83 | — |
| `docs/economic-engine/PHASE_3_IMPLEMENTATION_DEPENDENCIES.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 Implementation Dependencies, Test and CI Plan」 | 群 | 2026-10-15 | 131 | — |
| `docs/economic-engine/PHASE_3_IMPLEMENTATION_READINESS.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 Advanced Implementation Readiness」 | 群 | 2026-10-15 | 64 | — |
| `docs/economic-engine/PHASE_3_INDIRECT_ECONOMIC_PATHS_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「Phase 3 P3-6 — indirect economic path diagnostic (dependent slice)」 | 群 | 2026-10-19 | 40 | — |
| `docs/economic-engine/PHASE_3_INTERNAL_VENTURE_BUSINESS_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: internal venture funding, sale and withdrawal evidence (W-INTERNAL-VENTURE」 | 群 | 2026-10-28 | 104 | — |
| `docs/economic-engine/PHASE_3_INTERNAL_VENTURE_SPINOFF_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: internal venture spin-off evidence (W-INTERNAL-VENTURE, spin-off)」 | 群 | 2026-10-28 | 96 | — |
| `docs/economic-engine/PHASE_3_INVESTOR_OFFER_AUX_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: investor-offer auxiliary commands transaction fix and evidence (W-INVESTOR」 | 群 | 2026-10-29 | 100 | — |
| `docs/economic-engine/PHASE_3_INVESTOR_REPLAY_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial investor-offer replay evidence」 | 群 | 2026-10-30 | 40 | — |
| `docs/economic-engine/PHASE_3_LP_COMMITMENT_EVIDENCE_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-7 LP commitment source evidence — partial read-only slice」 | 群 | 2026-10-18 | 29 | — |
| `docs/economic-engine/PHASE_3_MARGIN_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: margin liquidation transaction evidence」 | 群 | 2026-10-26 | 101 | — |
| `docs/economic-engine/PHASE_3_NEW_BUSINESS_COMMERCIALIZATION_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: new-business commercialization evidence (W-COMMERCIAL-SPINOUT)」 | 群 | 2026-10-28 | 107 | — |
| `docs/economic-engine/PHASE_3_OWNERSHIP_REPLACEMENT_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial ownership replacement-boundary evidence」 | 群 | 2026-10-30 | 38 | — |
| `docs/economic-engine/PHASE_3_P3_10_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「P3-10 — Command and UI Integration Contract」 | 群 | 2026-10-15 | 109 | — |
| `docs/economic-engine/PHASE_3_P3_11_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「P3-11 — Founder Wealth Read-only Projection」 | 群 | 2026-10-19 | 112 | — |
| `docs/economic-engine/PHASE_3_P3_12_ACCEPTANCE.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P3-12 — Permanent Acceptance and Phase 3 Exit Gate」 | 群 | 2026-10-15 | 107 | — |
| `docs/economic-engine/PHASE_3_P3_1_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「P3-1 — Read-only ownership identity projection」 | 群 | 2026-10-08 | 26 | — |
| `docs/economic-engine/PHASE_3_P3_2_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「Phase 3 P3-2 — Read-only ownership reconciliation」 | 群 | 2026-10-21 | 37 | — |
| `docs/economic-engine/PHASE_3_P3_3_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「Phase 3 P3-3 — Issuer-family adoption and writer contract」 | 群 | 2026-10-08 | 73 | — |
| `docs/economic-engine/PHASE_3_P3_4_ACTIVATION_READINESS.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 P3-4 — player-common activation readiness」 | 群 | 2026-11-03 | 105 | — |
| `docs/economic-engine/PHASE_3_P3_4_NEW_GAME_GENERATION_REFOUNDING_SPEC.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P3-4 new-game generation isolation and refounding scenario specification」 | 群 | 2026-10-22 | 106 | — |
| `docs/economic-engine/PHASE_3_P3_4_OWNERSHIP_APPLY.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P3-4 dormant ownership plan application」 | 群 | 2026-11-03 | 285 | — |
| `docs/economic-engine/PHASE_3_P3_4_PREFLIGHT_AND_DESIGN.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 P3-4 preflight and controlled writer adoption design」 | 群 | 2026-10-22 | 306 | — |
| `docs/economic-engine/PHASE_3_P3_4_PURE_PLANNER_API.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「P3-4 pure ownership planner API」 | 群 | 2026-10-23 | 110 | — |
| `docs/economic-engine/PHASE_3_P3_4_REMAINING_WRITER_ROUTING_DESIGN.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 P3-4 — routing design for the remaining player-common writers」 | 群 | 2026-10-29 | 138 | — |
| `docs/economic-engine/PHASE_3_P3_4_WRITER_FAILURE_WEBKIT_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 writer failure-test and WebKit evidence inventory」 | 群 | 2026-10-22 | 232 | — |
| `docs/economic-engine/PHASE_3_P3_5_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「P3-5 — External Listed Holdings Read-only Adapter」 | 群 | 2026-10-15 | 100 | — |
| `docs/economic-engine/PHASE_3_P3_6_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「P3-6 — Subsidiary and M&A Relationship Read-only Adapter」 | 群 | 2026-10-15 | 108 | — |
| `docs/economic-engine/PHASE_3_P3_6_DIRECT_SOURCE_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-6 first slice — direct subsidiary relationship evidence」 | 群 | 2026-10-16 | 75 | — |
| `docs/economic-engine/PHASE_3_P3_7_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「P3-7 — PE Fund and Portfolio Ownership Read-only Adapter」 | 群 | 2026-10-15 | 97 | — |
| `docs/economic-engine/PHASE_3_P3_8_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「P3-8 — VC Startup and Conversion Ownership Read-only Adapter」 | 群 | 2026-10-18 | 99 | — |
| `docs/economic-engine/PHASE_3_P3_9_CONTRACT.md` | Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）。見出し: 「P3-9 — Exact Control Ladder Eligibility Projection」 | 群 | 2026-10-15 | 91 | — |
| `docs/economic-engine/PHASE_3_PARTIAL_CAPABILITY_CHECKPOINT.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Phase 3 partial capability checkpoint — 2026-10-31」 | 群 | 2026-11-05 | 88 | — |
| `docs/economic-engine/PHASE_3_PE_DIRECT_OWNERSHIP_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-7 legacy direct PE ownership evidence slice」 | 群 | 2026-10-16 | 54 | — |
| `docs/economic-engine/PHASE_3_PE_FUND_FORMATION_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: PE fund formation transaction fix and evidence (W-PE-FORM)」 | 群 | 2026-10-29 | 98 | — |
| `docs/economic-engine/PHASE_3_PE_FUND_INTERESTS_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-7 — recovered fund capital and proceeds evidence」 | 群 | 2026-11-02 | 128 | — |
| `docs/economic-engine/PHASE_3_PE_PARENT_ACQUISITION_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: PE portfolio company acquisition into the group evidence (W-PE-PARENT)」 | 群 | 2026-10-28 | 112 | — |
| `docs/economic-engine/PHASE_3_PE_TRANSFER_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: personal PE deal transfer to the company evidence (W-PE-TRANSFER)」 | 群 | 2026-10-29 | 102 | — |
| `docs/economic-engine/PHASE_3_PLAYER_LISTED_SNAPSHOT_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「Phase 3 player/listed ownership snapshot integration slice」 | 群 | 2026-11-01 | 114 | — |
| `docs/economic-engine/PHASE_3_RATCHET_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: weekly turnaround-ratchet transaction evidence」 | 群 | 2026-11-03 | 119 | — |
| `docs/economic-engine/PHASE_3_RAW_ISSUANCE_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial raw external-issuance helper evidence」 | 群 | 2026-10-30 | 25 | — |
| `docs/economic-engine/PHASE_3_REFOUNDING_IDENTITY_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial current-generation refounding evidence」 | 群 | 2026-10-30 | 32 | — |
| `docs/economic-engine/PHASE_3_RESTRUCTURING_LIFECYCLE_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-6 — subsidiary restructuring lifecycle source evidence」 | 群 | 2026-10-19 | 20 | — |
| `docs/economic-engine/PHASE_3_SPLIT_INDEX_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial same-week stock-split index evidence」 | 群 | 2026-10-31 | 22 | — |
| `docs/economic-engine/PHASE_3_SPONSOR_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: sponsor-injection transaction evidence」 | 群 | 2026-10-26 | 87 | — |
| `docs/economic-engine/PHASE_3_SUBSIDIARY_COMPOSITION_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-6 — bounded direct PE/subsidiary composition」 | 群 | 2026-10-16 | 50 | — |
| `docs/economic-engine/PHASE_3_SUBSIDIARY_CONTROL_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: listed subsidiary control action evidence (W-SUB-CONTROL)」 | 群 | 2026-10-27 | 75 | — |
| `docs/economic-engine/PHASE_3_SUBSIDIARY_FOLLOW_ON_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: listed subsidiary follow-on offering evidence (W-SUB-FOLLOWON)」 | 群 | 2026-10-28 | 81 | — |
| `docs/economic-engine/PHASE_3_SUBSIDIARY_FUNDING_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: unlisted subsidiary parent funding and external round evidence (W-INTERNAL」 | 群 | 2026-10-28 | 111 | — |
| `docs/economic-engine/PHASE_3_SUBSIDIARY_IPO_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: subsidiary IPO evidence (W-SUB-IPO)」 | 群 | 2026-10-27 | 73 | — |
| `docs/economic-engine/PHASE_3_SUBSIDIARY_MARKET_TRADE_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: listed subsidiary market trade evidence (W-SUB-MARKET)」 | 群 | 2026-10-28 | 83 | — |
| `docs/economic-engine/PHASE_3_SUBSIDIARY_RELIST_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: subsidiary relisting evidence (W-SUB-RELIST)」 | 群 | 2026-10-28 | 103 | — |
| `docs/economic-engine/PHASE_3_SUBSIDIARY_SECONDARY_SALE_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: listed subsidiary secondary sale evidence (W-SUB-SECONDARY)」 | 群 | 2026-10-27 | 62 | — |
| `docs/economic-engine/PHASE_3_TURNAROUND_ACCEPT_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: turnaround-fund acceptance transaction evidence」 | 群 | 2026-10-26 | 73 | — |
| `docs/economic-engine/PHASE_3_VC_LISTING_WEEK_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: startup listing week evidence (W-VC-LIST / W-WEEK-STARTUPS)」 | 群 | 2026-10-27 | 77 | — |
| `docs/economic-engine/PHASE_3_VC_ROUND_CLOSE_WEEK_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: startup funding round close week evidence (W-VC-CLOSE / W-WEEK-STARTUPS)」 | 群 | 2026-10-27 | 82 | — |
| `docs/economic-engine/PHASE_3_VC_SOURCE_INTERESTS_SLICE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-8 — Startup source-fraction evidence (partial read-only slice)」 | 群 | 2026-11-03 | 146 | — |
| `docs/economic-engine/PHASE_3_VC_WRITEOFF_WEEK_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: startup write-off week evidence (W-VC-WRITEOFF / W-WEEK-STARTUPS)」 | 群 | 2026-10-27 | 72 | — |
| `docs/economic-engine/PHASE_3_WEEKLY_COMPETITOR_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial weekly competitor purchase evidence」 | 群 | 2026-10-31 | 43 | — |
| `docs/economic-engine/PHASE_3_WEEKLY_MARKET_EVIDENCE.md` | Economic Engine Phase 3: 部分スライス／証跡。見出し: 「P3-4 partial public weekly market evidence」 | 群 | 2026-10-31 | 38 | — |
| `docs/economic-engine/PHASE_3_WEEK_COMPETITOR_STAKE_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: weekly competitor stake purchase save-fault evidence (W-WEEK-COMPETITOR)」 | 群 | 2026-10-29 | 80 | — |
| `docs/economic-engine/PHASE_3_WEEK_PE_FUND_TRANSACTION_EVIDENCE.md` | Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡。見出し: 「P3-4: weekly PE fund lifecycle save-fault evidence (W-WEEK-PE)」 | 群 | 2026-10-29 | 95 | — |
| `docs/economic-engine/TRACK_B_CASH_LEDGER_COMMIT.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Track B / B2 — Company cash + ledger commit boundary」 | 群 | 2026-10-19 | 74 | — |
| `docs/economic-engine/VC_ROUND_LEGACY_RESCUE_DESIGN.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「VC funding round — legacy truncated-history rescue: design and verification」 | 群 | 2026-10-21 | 136 | — |
| `docs/economic-engine/VC_SECONDARY_SALE_ATOMICITY_001.md` | Economic Engine: 原子性（atomicity）是正の記録。見出し: 「VC-SECONDARY-SALE-ATOMICITY-001 remediation evidence」 | 群 | 2026-10-10 | 49 | — |
| `docs/economic-engine/YEN_CEILING_ROUNDING_CONTRACT.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Whole-Yen Ceiling Rounding Contract (Phase 0 §5 vNext)」 | 群 | 2026-10-29 | 202 | — |
| `docs/economic-engine/handoffs/P3_5_LISTED_ADAPTER_20261016.md` | Economic Engine の個別設計・監査・判断記録。見出し: 「Capitalism Tycoon Web — Development Handoff」 | 群 | 2026-10-16 | 41 | — |

### 2.7 CI・シャード並列化の証跡・手順（41件）

| ファイル | 内容の要約 | 要約の種別 | 最終更新 | 行数 | 他の仕様書と矛盾する点 |
|---|---|---|---|---|---|
| `docs/ci-timing-baseline-2026-10-27.md` | CI所要時間の実測ベースライン（測定と仮説を分離）。 | 手 | 2026-10-27 | 155 | — |
| `docs/parallel-shard-bottleneck.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Offline shard bottleneck observation (H/I/K)」 | 群 | 2026-11-02 | 27 | — |
| `docs/parallel-shard-c-process-evidence.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「C final-process evidence diagnosis」 | 群 | 2026-10-31 | 24 | — |
| `docs/parallel-shard-c-process-results-2026-10-31.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「C hosted final-process evidence — 2026-10-31 JST」 | 群 | 2026-10-31 | 66 | — |
| `docs/parallel-shard-cgroup-memory.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Explicit cgroup memory observations」 | 群 | 2026-11-02 | 76 | — |
| `docs/parallel-shard-ci-timing.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Read-only CI timing analysis」 | 群 | 2026-11-02 | 197 | — |
| `docs/parallel-shard-cpu-hotspots.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Offline CPU sample hotspots — 2026-11-03」 | 群 | 2026-11-09 | 44 | — |
| `docs/parallel-shard-h-boundaries.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「H declared shared-write boundaries (read-only)」 | 群 | 2026-11-02 | 47 | — |
| `docs/parallel-shard-hi-readonly-2026-10-31.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「H/I read-only follow-up — 2026-10-31 JST」 | 群 | 2026-10-31 | 40 | — |
| `docs/parallel-shard-i-hosted-serial-2026-11-02.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「I serial baseline: isolated hosted Node22/24 evidence」 | 群 | 2026-11-02 | 48 | — |
| `docs/parallel-shard-i-index-inputs.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「I dynamic harness input inventory — 2026-11-02」 | 群 | 2026-11-02 | 39 | — |
| `docs/parallel-shard-i-results-2026-11-02.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Retained I serial evidence — 2026-11-02」 | 群 | 2026-11-02 | 72 | — |
| `docs/parallel-shard-i-serial-profile.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Optional I serial resource profile」 | 群 | 2026-11-02 | 50 | — |
| `docs/parallel-shard-i-source-boundaries.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「I source boundary inventory — 2026-11-02」 | 群 | 2026-11-02 | 48 | — |
| `docs/parallel-shard-k-archive-builder.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Offline K evidence archive builder」 | 群 | 2026-11-02 | 14 | — |
| `docs/parallel-shard-k-current-source-refresh-2026-11-02.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K current-source hosted refresh — 2026-11-02 JST」 | 群 | 2026-11-02 | 22 | — |
| `docs/parallel-shard-k-diagnostic.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K parallel diagnostic — production remains serial」 | 群 | 2026-10-30 | 22 | — |
| `docs/parallel-shard-k-evidence-audit.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Offline K write-evidence audit」 | 群 | 2026-11-01 | 73 | — |
| `docs/parallel-shard-k-hosted-results-2026-10-30.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K hosted comparison — 2026-10-30 JST」 | 群 | 2026-10-30 | 48 | — |
| `docs/parallel-shard-k-refresh-results-2026-10-31.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K changed-source Linux evidence — 2026-10-31 JST」 | 群 | 2026-10-31 | 70 | — |
| `docs/parallel-shard-k-results-2026-11-02.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K fixed-source evidence — 2026-11-02 JST」 | 群 | 2026-11-02 | 28 | — |
| `docs/parallel-shard-k-scheduling-bounds.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K fixed-duration scheduling bounds — 2026-11-03」 | 群 | 2026-11-03 | 46 | — |
| `docs/parallel-shard-k-source-drift.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K historical evidence source drift」 | 群 | 2026-11-02 | 24 | — |
| `docs/parallel-shard-k-source-refresh-2026-10-31.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K source refresh diagnosis — 2026-10-31 JST」 | 群 | 2026-10-31 | 35 | — |
| `docs/parallel-shard-k-write-observation.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K runtime write observation — diagnostic only」 | 群 | 2026-11-01 | 50 | — |
| `docs/parallel-shard-k-write-results-2026-10-30.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「K hosted write observation — 2026-10-30」 | 群 | 2026-10-31 | 34 | — |
| `docs/parallel-shard-memory-capacity.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Memory capacity provenance for CI diagnostics」 | 群 | 2026-11-02 | 25 | — |
| `docs/parallel-shard-output-retention.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Byte-exact diagnostic output retention」 | 群 | 2026-10-30 | 16 | — |
| `docs/parallel-shard-process-diagnostic.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「E residue diagnosis (Owner decision, 2026-10-29)」 | 群 | 2026-10-30 | 87 | — |
| `docs/parallel-shard-queue-series.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Offline multi-run CI queue observations」 | 群 | 2026-11-02 | 33 | — |
| `docs/parallel-shard-resource-candidates.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Observed shared-resource candidates — 2026-11-03」 | 群 | 2026-11-03 | 36 | — |
| `docs/parallel-shard-rollback.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「シャードJ・C・E・L・A・K・I・D 並列実行パイロット — 有効化とロールバック手順（Stage 2A / Stage 3）」 | 群 | 2026-11-05 | 26 | — |
| `docs/parallel-shard-runner.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Parallel shard runner — stage 0」 | 群 | 2026-10-27 | 64 | — |
| `docs/parallel-shard-scoped-memory-window.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Operation-scoped cgroup observations — 2026-11-03」 | 群 | 2026-11-03 | 42 | — |
| `docs/parallel-shard-stage1-design.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「ステージ1 詳細設計 — `run-all-shard.js` への並列実行の opt-in 接続（シャードJのみ）」 | 群 | 2026-10-27 | 160 | — |
| `docs/parallel-shard-stage3-final-gates.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Stage 3 C/E gates — 2026-10-30 JST」 | 群 | 2026-10-30 | 60 | — |
| `docs/parallel-shard-work-b-2026-10-29.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Work B takeover — C activation gate / E preparation」 | 群 | 2026-11-03 | 75 | — |
| `docs/parallel-shard-work-b-2026-10-30.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Work B CI evidence — 2026-10-30 JST」 | 群 | 2026-10-30 | 47 | — |
| `docs/parallel-shard-write-audit.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Optional Node write/port audit」 | 群 | 2026-10-30 | 41 | — |
| `docs/parallel-shard-write-worker-contexts.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Worker write-observation contexts — 2026-11-03」 | 群 | 2026-11-03 | 37 | — |
| `docs/parallel-shard-write-wrapper-controls.md` | CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）。見出し: 「Node write-observation wrapper controls」 | 群 | 2026-11-02 | 34 | — |

### 2.8 Phase 別の契約・バランス報告・ガイド（Phase 0〜8）（71件）

| ファイル | 内容の要約 | 要約の種別 | 最終更新 | 行数 | 他の仕様書と矛盾する点 |
|---|---|---|---|---|---|
| `docs/COMPETITOR_ENGINE_DESIGN.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Phase 5A Competitor Guide」 | 群 | 2026-07-15 | 8 | — |
| `docs/COMPETITOR_ENTRY_EXIT_GUIDE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Phase 5A Competitor Guide」 | 群 | 2026-07-15 | 8 | — |
| `docs/COMPETITOR_FINANCE_GUIDE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Phase 5A Competitor Guide」 | 群 | 2026-07-15 | 8 | — |
| `docs/COMPETITOR_HISTORY_RETENTION_GATE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Competitor history retention gate」 | 群 | 2026-07-16 | 17 | — |
| `docs/COMPETITOR_STRATEGY_GUIDE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Phase 5A Competitor Guide」 | 群 | 2026-07-15 | 8 | — |
| `docs/CSS_MAINTENANCE_GUIDE.md` | CSS保守ガイド（2026-07-14）。 | 手 | 2026-07-14 | 56 | — |
| `docs/FAULT_HARNESS_AND_STOCK_SPLIT_ANALYSIS.md` | 見出し: 「Shared transaction fault harness contract and stock-split analysis (design only,」 | 見出し | 2026-10-11 | 62 | — |
| `docs/FINANCE_ENGINE_DESIGN.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Phase 1B 財務エンジン設計」 | 群 | 2026-07-14 | 22 | — |
| `docs/FINANCIAL_STATEMENTS_GUIDE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「財務諸表ガイド」 | 群 | 2026-07-15 | 33 | — |
| `docs/INVENTORY_AND_PROCUREMENT_GUIDE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「INVENTORY AND PROCUREMENT GUIDE」 | 群 | 2026-07-15 | 68 | — |
| `docs/JAVASCRIPT_MAINTENANCE_GUIDE.md` | Phase 0 の JS/CSS 分割に関する監査・ガイド（2026-07-14 時点）。見出し: 「JavaScript Maintenance Guide」 | 群 | 2026-07-14 | 69 | — |
| `docs/JAVASCRIPT_MODULE_GUIDE.md` | JavaScriptモジュール構成ガイド（2026-07-14。レジストリ・読込順）。 | 手 | 2026-07-15 | 118 | C4 |
| `docs/MARKET_ENGINE_DESIGN.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「MARKET_ENGINE_DESIGN」 | 群 | 2026-07-14 | 20 | — |
| `docs/MARKET_SYSTEM_GUIDE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「MARKET_SYSTEM_GUIDE」 | 群 | 2026-07-15 | 44 | C4 |
| `docs/OBSERVER_UI_MIGRATION_PROGRESS.md` | MutationObserver から UI enhancer registry への移行の進捗。 | 手 | 2026-08-07 | 129 | — |
| `docs/PHASE1A_BALANCE_REPORT.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「PHASE1A_BALANCE_REPORT」 | 群 | 2026-07-15 | 23 | — |
| `docs/PHASE1B_ACCOUNTING_RECONCILIATION.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 1B 会計照合」 | 群 | 2026-07-14 | 33 | — |
| `docs/PHASE1C_BALANCE_REPORT.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 1C Balance Report」 | 群 | 2026-07-15 | 32 | — |
| `docs/PHASE4A_BALANCE_REPORT.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 4A Balance Report」 | 群 | 2026-07-15 | 18 | — |
| `docs/PHASE5A_BALANCE_REPORT.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5A Balance Report」 | 群 | 2026-07-15 | 15 | — |
| `docs/PHASE5B1_MULTI_PRESENCE_HISTORY.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-1: multi-presence evaluation and bounded history」 | 群 | 2026-07-16 | 50 | — |
| `docs/PHASE5B2_COMPETITOR_PROJECTS.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-2: competitor project lifecycle foundation」 | 群 | 2026-07-16 | 46 | — |
| `docs/PHASE5B3A_COMPETITOR_MARKET_ENTRY.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-3A: competitor market-entry projects」 | 群 | 2026-07-16 | 56 | — |
| `docs/PHASE5B3B_COMPETITOR_CREDIT.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-3B: competitor credit and repayment lifecycle」 | 群 | 2026-07-16 | 72 | — |
| `docs/PHASE5B3C_SAVE_VERSION_9.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-3C: explicit saveVersion 9 migration」 | 群 | 2026-07-16 | 61 | — |
| `docs/PHASE5B4_COMPETITOR_DISTRESS.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-4: competitor distress, turnaround, and bankruptcy lifecycle」 | 群 | 2026-07-16 | 98 | — |
| `docs/PHASE5B4_TERMINAL_COMPATIBILITY.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-4 terminal competitor compatibility」 | 群 | 2026-07-16 | 44 | — |
| `docs/PHASE5B5A_RIVAL_COMPATIBILITY.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-5A: rival-counterattack compatibility」 | 群 | 2026-07-16 | 103 | — |
| `docs/PHASE5B5B1_COMPETITOR_DASHBOARD_MODEL.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-5B-1: competitor dashboard view model」 | 群 | 2026-07-16 | 95 | — |
| `docs/PHASE5B5B2_COMPETITOR_DASHBOARD_UI.md` | Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約。見出し: 「Phase 5B-5B-2: competitor dashboard UI」 | 群 | 2026-07-16 | 53 | — |
| `docs/PHASE6A1_PLAYER_CRISIS_FOUNDATION.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-1: player-company crisis foundation」 | 群 | 2026-07-16 | 70 | — |
| `docs/PHASE6A2A_PLAYER_CRISIS_LIQUIDITY_ACTIONS.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-2A: player crisis liquidity actions」 | 群 | 2026-07-16 | 58 | — |
| `docs/PHASE6A2B_PLAYER_CRISIS_UI.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-2B: player crisis response UI」 | 群 | 2026-07-16 | 60 | — |
| `docs/PHASE6A2C_GUIDED_RESTRUCTURING.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-2C: guided crisis asset disposition」 | 群 | 2026-07-16 | 56 | — |
| `docs/PHASE6A2D_RESTRUCTURING_UI.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-2D: mobile guided restructuring UI」 | 群 | 2026-07-16 | 41 | — |
| `docs/PHASE6A3A_COST_RESTRUCTURING.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-3A: crisis operating cost restructuring」 | 群 | 2026-07-16 | 69 | — |
| `docs/PHASE6A3B_COST_RESTRUCTURING_UI.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-3B: mobile operating-cost restructuring UI」 | 群 | 2026-07-16 | 45 | — |
| `docs/PHASE6A4A_CREDITOR_NEGOTIATION.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-4A: creditor negotiation engine」 | 群 | 2026-07-16 | 62 | — |
| `docs/PHASE6A4B_CREDITOR_UI.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-4B: creditor negotiation mobile UI」 | 群 | 2026-07-16 | 12 | — |
| `docs/PHASE6A4C_WEEKLY_DEBT_SERVICE.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-4C: weekly-only negotiated debt service」 | 群 | 2026-07-16 | 35 | — |
| `docs/PHASE6A5B_TURNAROUND_PLAN_UI.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-5B: Turnaround Plan UI」 | 群 | 2026-07-16 | 43 | — |
| `docs/PHASE6A5C_TURNAROUND_WEEKLY_REPORT.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A-5C — Turnaround weekly report integration」 | 群 | 2026-07-16 | 41 | — |
| `docs/PHASE6A_V1_PROGRESSION_GATE.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6A: provisional v1 progression gate」 | 群 | 2026-07-16 | 75 | — |
| `docs/PHASE6B2_STRATEGY_BALANCE.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6B-2: Strategy and regional balance audit」 | 群 | 2026-07-16 | 75 | — |
| `docs/PHASE6B3_DIFFICULTY_SCENARIO_BALANCE.md` | Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約。見出し: 「Phase 6B-3: Difficulty and Scenario Balance」 | 群 | 2026-07-16 | 76 | — |
| `docs/PROJECT_EXECUTION_GUIDE.md` | 見出し: 「Project Execution Guide」 | 見出し | 2026-07-15 | 4 | — |
| `docs/SAVE_MIGRATION_GUIDE.md` | セーブ移行ガイド（段階的マイグレーションの規約）。 | 手 | 2026-07-15 | 126 | C4 |
| `docs/STOCK_CHART_GUIDE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Stock chart guide」 | 群 | 2026-07-14 | 46 | — |
| `docs/SUPPLY_CHAIN_DESIGN.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「SUPPLY CHAIN DESIGN」 | 群 | 2026-07-15 | 72 | — |
| `docs/SUPPLY_FINANCE_RECONCILIATION.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Supply Finance Reconciliation」 | 群 | 2026-07-15 | 51 | — |
| `docs/WORKFORCE_AND_ORGANIZATION_GUIDE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Workforce and Organization Guide」 | 群 | 2026-07-15 | 10 | C4 |
| `docs/WORKFORCE_ENGINE_DESIGN.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Workforce Engine Design」 | 群 | 2026-07-15 | 22 | — |
| `docs/WORKFORCE_FINANCE_RECONCILIATION.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「Workforce Finance Reconciliation」 | 群 | 2026-07-15 | 9 | — |
| `docs/WORKING_CAPITAL_GUIDE.md` | Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド。見出し: 「運転資本ガイド」 | 群 | 2026-07-15 | 10 | — |
| `docs/phase-6d-1-release-candidate.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6D-1: Release Candidate Contract」 | 群 | 2026-07-17 | 63 | — |
| `docs/phase-6d-4-iphone-webkit-smoke.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6D-4: iPhone WebKit automated smoke」 | 群 | 2026-07-17 | 60 | — |
| `docs/phase-6d-5-published-webkit-smoke.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6D-5: published iPhone WebKit smoke」 | 群 | 2026-07-17 | 53 | — |
| `docs/phase-6d-6-release-attestation-sync.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6D-6: release attestation synchronization」 | 群 | 2026-07-17 | 49 | — |
| `docs/phase-6d2-pages-deployment-attestation.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6D-2: GitHub Pages Deployment Attestation」 | 群 | 2026-07-17 | 49 | — |
| `docs/phase-6d3-release-candidate-tag-gate.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6D-3: Release Candidate Tag Gate」 | 群 | 2026-07-17 | 46 | — |
| `docs/phase-6e1-release-diagnostics.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6E-1: release diagnostics and safe restart」 | 群 | 2026-07-17 | 57 | — |
| `docs/phase-6e2-runtime-recovery.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6E-2: runtime recovery」 | 群 | 2026-07-17 | 38 | — |
| `docs/phase-6e3-boot-recovery.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6E-3: boot recovery」 | 群 | 2026-07-17 | 37 | — |
| `docs/phase-6e4-playtest-report.md` | Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約。見出し: 「Phase 6E-4: privacy-safe playtest report」 | 群 | 2026-07-17 | 47 | — |
| `docs/phase-7a1-d-ui-shell.md` | Phase 7/8: D UI・市場シェア・資金回復の個別設計。見出し: 「Phase 7A-1: D UI game shell」 | 群 | 2026-07-17 | 45 | — |
| `docs/phase-7a2-reference-fidelity.md` | Phase 7/8: D UI・市場シェア・資金回復の個別設計。見出し: 「Phase 7A-2 — Reference fidelity pass」 | 群 | 2026-07-18 | 28 | — |
| `docs/phase-8a2-market-share-strategy.md` | Phase 7/8: D UI・市場シェア・資金回復の個別設計。見出し: 「Phase 8A-2: Persistent market-share strategy」 | 群 | 2026-07-19 | 47 | — |
| `docs/phase-8d-15-16-funding-options.md` | Phase 7/8: D UI・市場シェア・資金回復の個別設計。見出し: 「Phase 8D-15/16 回復資金の代替案比較」 | 群 | 2026-07-22 | 32 | — |
| `docs/real-estate-capex-actuals-invariants.md` | 不動産機能の不変条件。見出し: 「Real Estate CAPEX Actuals Invariants」 | 群 | 2026-07-31 | 13 | — |
| `docs/real-estate-complete-cycle-invariants.md` | 不動産機能の不変条件。見出し: 「Real Estate Complete Cycle Invariants」 | 群 | 2026-07-31 | 44 | — |
| `docs/refero-ui-research-protocol.md` | 見出し: 「Refero UI Research Protocol」 | 見出し | 2026-08-31 | 255 | — |

## 3. 仕様・検証ログとして働く非Markdown

| ファイル | 内容 | 最終更新 |
|---|---|---|
| `release-candidate.json` | リリース候補メタ（version 2.0.0-rc.1、saveキー・saveVersion=9、配備先 GitHub Pages） | 2026-07-26 |
| `tests/run-all-shards.json` | 正本テストのシャード割当（B〜L を明示、未割当は A） | 2026-10-29 |
| `tests/test-execution-registry.json` | テスト実行レジストリ | 2026-11-12 |
| `scripts/parallel-shard-runner.config.json` | 並列シャード実行の設定 | 2026-11-05 |
| `VALIDATE_STAGE35A.sh` | Stage 3.5A の検証スクリプト | 2026-08-09 |
| `docs/ci-evidence` | CI計測証跡（JSON/gz 18ファイル。parallel-shard 系文書の根拠データ） | 2026-11-03 |
| `docs/ui-v3/evidence` | UI v3 の画面写真証跡（PNG） | 2026-11-12 |
| `docs/ui-v3/mockup.html` | UI v3 のモックアップ（4画面） | 2026-11-10 |
| `artifacts/pe-ui-phase1` | PE UI Phase1 のスクリーンショット（PNG 5枚） | 2026-09-11 |
| `boot-test.html 他 boot-test-stage-*.html（5本）・observer-source-diagnostic.html` | 起動/Observer の診断用ページ（本番では読み込まれない） | 2026-08-07 |
| `map-phase1-prototype.html / map-phase2-preview.html / prototypes/*.js` | 地図プロトタイプ（本番とは別ファイル） | 2026-09-02 |
