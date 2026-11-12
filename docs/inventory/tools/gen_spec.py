# -*- coding: utf-8 -*-
import json, glob, re, subprocess, os, collections
S = (os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
rows = json.load(open(S + 'docs.json'))
sha = subprocess.check_output(['git', 'rev-parse', '--short', 'main'], text=True).strip()

# 手で読んで要約したもの（冒頭〜主要部を確認済み）
MAN = {
 'CLAUDE.md': 'プロジェクト固有の設計契約。5本柱・2つの創業ルート・不変条件(SAVE_KEY/saveVersion=9/決定論/会計/会社と個人の分離)・D UI/City Lab地図の契約・既知の落とし穴・検証方針。Codex等も対象（ファイル名は互換のため維持）。',
 'AGENTS.md': 'リポジトリ共通の作業規則（進め方・読む資料の選び方・自律範囲・PR/CIの運用）。Economic Engine の F→Q 開発モード、マージ方針（#1055）もここ。',
 'DESIGN.md': 'D UI v2 のデザイン契約（UI/UX 次工程の設計システムの正本。現行シェル・セーブ・会計・決定論は変えない）。',
 'docs/GAME_OVERVIEW.md': '全体の状態要約（コンセプト・5本柱・PE/小型株の状況・不変条件）。自ら「一次資料と食い違ったら一次資料を信じよ」と明記。',
 'docs/gameplay-systems-roadmap.md': '現行のゲーム深掘りトラッカー（5本柱の状況・各システムの最小コア/拡張候補）。',
 'docs/DEVELOPMENT_ROADMAP.md': '退役済み（2026-08-25）。saveVersion 8 時代の Phase 0〜9 構想。歴史記録。',
 'docs/GAME_SYSTEM_AUDIT.md': '2026-07-14 時点の「index.html 単一ファイル実装」の監査（実装済み/未実装の棚卸し）。CLAUDE.md が退役扱いにしている。',
 'docs/ui-redesign-roadmap.md': 'D UI shell（CI2風リスキン）の計画・進捗記録。',
 'docs/ui-v3/README.md': 'UI v3（画面の作り直し）の確定設計書。オーナー承認 2026-11-10。?ui=3 の裏で進め、cutover まで現行UIは既定のまま。合格基準・タスク表を含む。',
 'docs/ui-v3/migration-ledger.md': 'UI v3 移行台帳（現行画面から消える操作と行き先）。',
 'docs/ui-v3/device-checklist.md': 'UI v3 の実機確認チェックリスト。',
 'docs/feature-requests.md': 'オーナー要望と実装可否調査のメモ。着手前に「現状どこまで実装済みか」を確認するための台帳。',
 'docs/CURRENT_SAVE_SCHEMA.md': '現行セーブスキーマ調査（localStorageキー・保存/読込処理・トップレベル項目一覧）。2026-07-14 監査＋2026-08-26 追記。',
 'docs/TECHNICAL_REFACTOR_PLAN.md': 'index.html 単一ファイルの段階分割計画と、分割実施の記録（Phase 0 JS/CSS抽出）。',
 'docs/FOUNDING_ROUTE_REBALANCE_DESIGN.md': '起業パート（5本柱）リバランス設計書。ジム・コンビニ・不動産仲介の構造修正は完了、成長率の底上げは未着手（本文の状態表記）。',
 'docs/PE_MODE_DESIGN.md': 'PEモード設計書（T1〜T26 実装済み）。',
 'docs/PE_MODE_TASKS.md': 'PEモード実装タスク一覧（T1〜T26 実装済み・コミットSHA付き）。',
 'docs/MICROCAP_MODE_DESIGN.md': '小型株モード設計書（未解決点解消済み・実装タスク作成済み）。',
 'docs/CAPITAL_ALLOCATION_VISION.md': '資本配分構想（Capital Allocation Vision）。1300行超の長期構想書。',
 'docs/REFERENCE_GAMES_RESEARCH.md': '参考ゲーム調査（Wall Street Raider 動画調査まとめと Capitalism Tycoon への示唆）。',
 'docs/MOBILE_MANAGEMENT_SIM_DESIGN_PRINCIPLES.md': 'モバイル経営シミュレーション設計原則（外部参考資料。実装の真実ではない）。',
 'docs/AI_DEV_OPERATING_PRINCIPLES_REFERENCE.md': 'AI開発運用に関する外部参考資料（エージェント指示・承認境界のレビュー用）。',
 'docs/AUTONOMOUS_DEVELOPMENT_PLAYBOOK.md': '「次の開発作業を進めて」への手順書（過去の事故＝未接続ファイル放置・循環依存・push漏れ等を踏まえる）。',
 'docs/QA_AUDIT_2026-08-25.md': 'オーナー依頼のコード全体レビュー＋実ブラウザ試遊の監査記録（項目ごとにステータス更新）。',
 'docs/century-playtest-audit.md': '100年プレイテスト監査（2026-08-25）。',
 'docs/century-playtest-audit-post-health-removal.md': '創業者の体力・健康システム廃止後の100年プレイテスト監査。',
 'docs/city-lab-production-port.md': 'City Lab（3D地図）を本番へ移植する際の描画境界の承認文書。',
 'docs/global-company-ranking-goals.md': '世界企業ランキング・達成目標の仕様。',
 'docs/map-phase1-canvas-foundation.md': 'マップ Phase 1（Canvas+sprite基盤）。',
 'docs/map-phase2-asset-integration-contract.md': 'マップ Phase 2 アセット統合契約（未統合・プレビュー時点の記述）。',
 'docs/map-phase2-production-integration-audit.md': 'Phase 2 マップの本番統合準備監査（歴史記録。1333行）。',
 'docs/map-prefecture-identity.md': '47都道府県の地域性（構造的バリエーション）の設計。',
 'docs/LOCAL_VERIFICATION.md': 'CIを開発ループにしない方針（オーナー決定 2026-10-20）と手元検証の手順。マージ規則は緩めない。',
 'docs/release-readiness.md': 'リリース判定の最小ゲート（`npm run test:release`）。',
 'docs/ci-timing-baseline-2026-10-27.md': 'CI所要時間の実測ベースライン（測定と仮説を分離）。',
 'docs/economic-engine/ECONOMIC_ENGINE_ROADMAP.md': 'Economic Engine 統合ロードマップ（承認済み実装ベースライン。Gate C/D 完了）。1904行。',
 'docs/economic-engine/ECONOMIC_ENGINE_IMPLEMENTATION_FIRST_ROADMAP.md': 'Economic Engine の実装先行ロードマップ v2（機能完成を先、包括品質を後）。ソース・オブ・トゥルース切替や Phase 4 Entry の承認ではない。',
 'docs/economic-engine/ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md': 'Economic Engine のフェーズ依存グラフ。',
 'tests/README.md': 'テストの使い方と各テスト群の説明（npm scripts・JavaScript抽出テスト等）。',
 'tests/BASELINE_RESULTS.md': '2026-07-14 時点のテストベースライン結果（Node v24.15.0）。',
 '.github/codex/README.md': 'Codex Web/Cloud を ChatGPT プランで手動運用する際の説明（API鍵不要・指示ファイルの階層）。',
 '.github/codex/prompts/manual-development.md': 'Codex 手動開発用の再利用プロンプト。',
 'docs/CSS_MAINTENANCE_GUIDE.md': 'CSS保守ガイド（2026-07-14）。',
 'docs/JAVASCRIPT_MODULE_GUIDE.md': 'JavaScriptモジュール構成ガイド（2026-07-14。レジストリ・読込順）。',
 'docs/SAVE_MIGRATION_GUIDE.md': 'セーブ移行ガイド（段階的マイグレーションの規約）。',
 'docs/SAVE_MIGRATION_AUDIT.md': 'セーブ移行の監査（2026-07-14）。',
 'docs/OBSERVER_UI_MIGRATION_PROGRESS.md': 'MutationObserver から UI enhancer registry への移行の進捗。',
 'docs/city-lab-production-port.md ': '',
}
GROUP = [
 (r'^docs/economic-engine/PHASE_3_.*TRANSACTION_EVIDENCE\.md$', 'Economic Engine Phase 3 P3-4: 該当ライタの取引・保存/ロールバック証跡'),
 (r'^docs/economic-engine/PHASE_3_P3_\d+_CONTRACT\.md$', 'Economic Engine Phase 3: 該当スライス(P3-x)の契約書（読み取り専用アダプタ等）'),
 (r'^docs/economic-engine/PHASE_3_.*(SLICE|EVIDENCE)\.md$', 'Economic Engine Phase 3: 部分スライス／証跡'),
 (r'^docs/economic-engine/P3_4_\d+_.*\.md$', 'Economic Engine Phase 3 P3-4: 個別の是正記録（保存原子性など）'),
 (r'^docs/economic-engine/PHASE_[0-2].*\.md$', 'Economic Engine Phase 0〜2: 契約・会計ベースライン・受入レビュー'),
 (r'^docs/economic-engine/.*_ATOMICITY_001.*\.md$', 'Economic Engine: 原子性（atomicity）是正の記録'),
 (r'^docs/economic-engine/', 'Economic Engine の個別設計・監査・判断記録'),
 (r'^docs/parallel-shard-.*\.md$', 'CI シャード並列実行パイロットの観測・診断・手順（read-only 証跡中心）'),
 (r'^docs/phase-6[de].*\.md$', 'Phase 6D/6E: リリース候補・実機iPhone・復旧・診断の契約'),
 (r'^docs/phase-(7|8).*\.md$', 'Phase 7/8: D UI・市場シェア・資金回復の個別設計'),
 (r'^docs/PHASE(1|4|5)[A-Z0-9_]*\.md$', 'Phase 1〜5: 各フェーズの会計照合・バランス報告・競合エンジン契約'),
 (r'^docs/PHASE6[A-B][A-Z0-9_]*\.md$', 'Phase 6A/6B: プレイヤー危機・再建・バランス監査の契約'),
 (r'^docs/audits/', '不動産・テナント会計の不変条件メモ'),
 (r'^docs/(real-estate-.*|.*-invariants)\.md$', '不動産機能の不変条件'),
 (r'^docs/(COMPETITOR|MARKET|SUPPLY|WORKFORCE|FINANCE|ENGINE|ACCOUNTING|WORKING|INVENTORY|STOCK|FINANCIAL)[A-Z_]*\.md$', 'Phase 1〜5 の各エンジン（競合/市場/供給/労務/財務/株価）の設計・監査・ガイド'),
 (r'^docs/(JAVASCRIPT|CSS)_.*\.md$', 'Phase 0 の JS/CSS 分割に関する監査・ガイド（2026-07-14 時点）'),
 (r'^docs/ui-v3/', 'UI v3 関連資料'),
 (r'^assets/', 'アセット説明'),
]
def summarize(r):
    f = r['f']
    if f in MAN and MAN[f]:
        return MAN[f], ''
    for pat, s in GROUP:
        if re.search(pat, f):
            t = r['title'][:80]
            return f'{s}。見出し: 「{t}」', '（群の説明＋見出し。個別の精読はしていない）'
    t = r['title'][:80]
    return f'見出し: 「{t}」', '（見出しのみ）'

# 矛盾 ID と該当ファイル
CONTRA = collections.OrderedDict()
def C(i, title, a, b, extra=''):
    CONTRA[i] = (title, a, b, extra)
C('C1', 'js/ のモジュール数', 'docs/GAME_OVERVIEW.md:177「`js/` currently holds 203 modules」', '`ls js | wc -l` = 245、index.html の `<script src="./js/…">` = 245（実測）。')
C('C2', 'シャードの明示割当範囲', 'docs/GAME_OVERVIEW.md:178「`tests/run-all-shards.json` assigns B-K explicitly」', 'CLAUDE.md:215「explicitly assigns B-L」、tests/run-all-shards.json のキーは B〜L の11個。')
C('C3', 'ENDING_DEFS の行番号', 'docs/GAME_OVERVIEW.md:29「`js/completion.js`'+"'"+'s `ENDING_DEFS` (lines 34-41)」', 'js/completion.js では `const ENDING_DEFS = [` が36行目、`];` が43行目。')
C('C4', '現在の saveVersion', 'docs/CURRENT_SAVE_SCHEMA.md:161「現在の明示的スキーマ版は `saveVersion: 3`」。docs/SAVE_MIGRATION_GUIDE.md:7 も `saveVersion: 3` を現行として記述。docs/CURRENT_SAVE_SCHEMA.md:192・SAVE_MIGRATION_GUIDE.md:125・MARKET_SYSTEM_GUIDE.md:43・JAVASCRIPT_MODULE_GUIDE.md:117・WORKFORCE_AND_ORGANIZATION_GUIDE.md:9 は「saveVersion 8 では…」と現行のように記述', 'CLAUDE.md §2・AGENTS.md §2「saveVersion=9」、js/save-v9.js:18 `SAVE_VERSION=9`、release-candidate.json:15 `"version": 9`。実行時の `g.saveVersion` も 9（計測で確認）。なお js/engine.js:18 の `SAVE_VERSION = 8` は v8→v9 移行の基底値として残っている（js/save-v9.js:17 `LEGACY_SAVE_VERSION=engine.SAVE_VERSION`）。')
C('C5', 'GAME_SYSTEM_AUDIT.md の退役表示', 'CLAUDE.md:32「`docs/GAME_SYSTEM_AUDIT.md` is likewise retired」', 'docs/GAME_SYSTEM_AUDIT.md の冒頭には退役表記がない（先頭は「監査日: 2026-07-14」）。対して docs/DEVELOPMENT_ROADMAP.md:3 には「退役済み（2026-08-25）」の表記がある。')
C('C6', '「現状」の構成', 'docs/TECHNICAL_REFACTOR_PLAN.md:5-10「`index.html` に HTML、CSS、マスターデータ、エンジン…が全て含まれる。物理ファイルは1つ」', '同ファイル:223 以降の追記では js/ 分割済みと記述。実際は 245 本の JS（index.html は 18KB）。計画書の「現状」節は更新されていない。')
C('C7', 'index.html が参照する JS', 'tests/README.md:36「Phase 0 JavaScript files referenced by `index.html`」として runtime/data/engine/expansion/completion/parity/app の7本を列挙', 'index.html は 245 本を読み込む（前行の記述は Phase 0 当時の最小集合）。')
C('C8', 'UIリスキン方針の所在', 'docs/ui-redesign-roadmap.md:5「方針そのものは CLAUDE.md の『UIリスキン（D UI shell拡張）の方針』節を参照」', 'CLAUDE.md にその見出しの節は存在しない（grep 0件）。D UI の記述は CLAUDE.md §3 にある。')
C('C9', '画面（UI）の「正」', 'AGENTS.md:19「D UI or map work: … `docs/ui-redesign-roadmap.md`」／CLAUDE.md §3「D UI is the production visual language」', 'docs/ui-v3/README.md:3「この文書が画面まわりの唯一の基準」。CLAUDE.md §3 の Exception 段落が UI v3 を例外として認めているが、AGENTS.md の読書ルーティングは UI v3 を「新画面は ?ui=3」とだけ記す。')
C('C10', '画面数', 'docs/ui-v3/README.md:20,58「現在の19画面（`g.selectedTab` の値）」', 'js/app.js:140-146 の `renderScreen` は 20 値（TABS の19＋`pe-portfolio`）を扱い、`ui3.registerScreen` も 20 回呼ばれる（計測）。')
C('C11', '起動時 enhancer の基準値', 'tests/startup-runtime-budget-test.js:8-9 のコメント「reviewed startup baseline is 100 … 50 registration hooks + one 50-hook final pass」', '同ファイル:15-16 の上限は 79 / 164。実測は registered=82（外部79＋index.html内蔵3）・hookExecutions=164（82＋82）。CLAUDE.md §3「budget is 79」は上限値と一致。コメントだけが古い。')
C('C12', '旧方針の記述', 'docs/DEVELOPMENT_ROADMAP.md（退役）の方針「約30業種を均等に薄く広げる」', 'CLAUDE.md §1・docs/gameplay-systems-roadmap.md「5本柱を深掘りする」。退役文書が自ら退役を明記しているため意図された差だが、本文は残っている。')
C('C13', 'CURRENT_SAVE_SCHEMA の日付', 'docs/CURRENT_SAVE_SCHEMA.md 冒頭「監査日: 2026-07-14」', '本文に「2026-08-26 に廃止」（創業者の体力・健康・集中力）の追記があり、最終更新は 2026-08-26。')
C('C14', '画面セクションの表示条件', 'tests/bank-loans-covenants-test.js:13 ほか7本（計8本）のテストが `selectedTab:\'finance\'` を渡して各 `renderSection` を直接呼び、HTMLが出ることを確認', 'js/app.js:80-84 の TABS と renderScreen(:140-146) に \'finance\' タブは存在しない（銀行は \'bank\'）。bank-loans-covenants / board-governance-resolution の inject() は `[data-screen="finance"]` を探して出力されず、他9モジュールの renderSection は js/ に呼出元がない。計測では本番でこれらは一度も画面に出なかった（README.md「J2」参照）。')

CONTRA_FILES = {
 'docs/GAME_OVERVIEW.md': ['C1', 'C2', 'C3'], 'CLAUDE.md': ['C2', 'C5', 'C8', 'C9', 'C11', 'C12'],
 'docs/CURRENT_SAVE_SCHEMA.md': ['C4', 'C13'], 'docs/SAVE_MIGRATION_GUIDE.md': ['C4'], 'docs/MARKET_SYSTEM_GUIDE.md': ['C4'],
 'docs/JAVASCRIPT_MODULE_GUIDE.md': ['C4'], 'docs/WORKFORCE_AND_ORGANIZATION_GUIDE.md': ['C4'],
 'docs/GAME_SYSTEM_AUDIT.md': ['C5'], 'docs/DEVELOPMENT_ROADMAP.md': ['C4', 'C5', 'C12'],
 'docs/TECHNICAL_REFACTOR_PLAN.md': ['C6'], 'tests/README.md': ['C7'],
 'docs/ui-redesign-roadmap.md': ['C8', 'C9'], 'AGENTS.md': ['C9'], 'docs/ui-v3/README.md': ['C9', 'C10'],
 'docs/gameplay-systems-roadmap.md': ['C12'],
}

o = []
o.append('# 作業4：仕様の出どころ一覧\n')
o.append(f'- 基準: `main` @ `{sha}`。調査のみ。')
o.append(f'- 対象: リポジトリ内の Markdown/テキスト **{len(rows)}ファイル**（`git ls-files "*.md" "*.txt"`。`docs/economic-engine/` {sum(1 for r in rows if r["f"].startswith("docs/economic-engine/"))}件を含む）＋仕様・検証ログとして働く非Markdown（本ファイル末尾）。')
o.append('- **最終更新**: `git log` の最終コミット日（履歴を完全取得して算出。shallow ではない）。')
o.append('- **要約の作り方（正直に）**: 主要文書は冒頭〜主要部を読んで手で要約した（`手`）。それ以外は群の説明と見出しを機械的に付けただけで精読していない（`群`/`見出し`）。')
o.append('- **矛盾の探し方（正直に）**: 全文書の全文照合はしていない。(1) 数値・行番号・名称などコードで検証できる主張、(2) 文書同士が互いを参照する箇所、(3) 「正」を名乗る文書の重複、に絞って確認した。**見つからなかったことは「矛盾がない」を意味しない**。どちらが正しいかは決めていない（実測値は併記）。\n')
o.append('## 1. 矛盾の一覧（「A では〜、B では〜」）\n')
o.append('| ID | 論点 | A では〜 | B では〜 |')
o.append('|---|---|---|---|')
for i, (t, a, b, e) in CONTRA.items():
    o.append(('| %s | %s | %s | %s |'%(i,t,a,b)).replace('ls js | wc -l','ls js ／ wc -l'))
o.append('')
o.append('## 2. 文書一覧\n')
def sec(title, pred):
    rs = [r for r in rows if pred(r['f'])]
    if not rs: return
    o.append(f'### {title}（{len(rs)}件）\n')
    o.append('| ファイル | 内容の要約 | 要約の種別 | 最終更新 | 行数 | 他の仕様書と矛盾する点 |')
    o.append('|---|---|---|---|---|---|')
    for r in sorted(rs, key=lambda x: x['f']):
        s, kind = summarize(r)
        k = '手' if f"{r['f']}" in MAN and MAN[r['f']] else ('群' if '群の説明' in kind else '見出し')
        c = ', '.join(CONTRA_FILES.get(r['f'], [])) or '—'
        s = s.replace('|', '／').replace('\n', ' ')
        o.append(f'| `{r["f"]}` | {s} | {k} | {r["date"]} | {r["lines"]} | {c} |')
    o.append('')
used = set()
def take(pred):
    def p(f):
        if f in used: return False
        if pred(f):
            used.add(f); return True
        return False
    return p
sec('2.1 方針・規則・設計の正本', take(lambda f: f in ('CLAUDE.md', 'AGENTS.md', 'DESIGN.md', 'docs/GAME_OVERVIEW.md', 'docs/ui-v3/README.md', 'docs/ui-v3/migration-ledger.md', 'docs/ui-v3/device-checklist.md', 'tests/README.md', 'tests/BASELINE_RESULTS.md', '.github/codex/README.md', '.github/codex/prompts/manual-development.md', 'docs/AUTONOMOUS_DEVELOPMENT_PLAYBOOK.md', 'docs/LOCAL_VERIFICATION.md', 'docs/release-readiness.md', 'docs/AI_DEV_OPERATING_PRINCIPLES_REFERENCE.md', 'docs/MOBILE_MANAGEMENT_SIM_DESIGN_PRINCIPLES.md')))
sec('2.2 ロードマップ・計画・要望', take(lambda f: f in ('docs/gameplay-systems-roadmap.md', 'docs/DEVELOPMENT_ROADMAP.md', 'docs/ui-redesign-roadmap.md', 'docs/feature-requests.md', 'docs/TECHNICAL_REFACTOR_PLAN.md', 'docs/CAPITAL_ALLOCATION_VISION.md', 'docs/FOUNDING_ROUTE_REBALANCE_DESIGN.md', 'docs/REFERENCE_GAMES_RESEARCH.md', 'docs/CI_REQUIRED_CHECKS_AND_STRATEGY_BALANCE_PROPOSAL.md', 'docs/global-company-ranking-goals.md') or f.startswith('docs/economic-engine/ECONOMIC_ENGINE_')))
sec('2.3 モード別設計書（PE・小型株）', take(lambda f: f.startswith(('docs/PE_MODE', 'docs/MICROCAP'))))
sec('2.4 監査・調査（時点のスナップショット）', take(lambda f: f in ('docs/GAME_SYSTEM_AUDIT.md', 'docs/CURRENT_SAVE_SCHEMA.md', 'docs/QA_AUDIT_2026-08-25.md', 'docs/century-playtest-audit.md', 'docs/century-playtest-audit-post-health-removal.md') or f.endswith('_AUDIT.md') or f.startswith('docs/audits/')))
sec('2.5 地図（Map）関連', take(lambda f: f.startswith(('docs/map-', 'docs/city-lab', 'assets/'))))
sec('2.6 Economic Engine 関連（個別）', take(lambda f: f.startswith('docs/economic-engine/')))
sec('2.7 CI・シャード並列化の証跡・手順', take(lambda f: f.startswith(('docs/parallel-shard', 'docs/ci-')) or f.startswith('docs/CI')))
sec('2.8 Phase 別の契約・バランス報告・ガイド（Phase 0〜8）', take(lambda f: True))
o.append('## 3. 仕様・検証ログとして働く非Markdown\n')
o.append('| ファイル | 内容 | 最終更新 |')
o.append('|---|---|---|')
def gl(p):
    try: return subprocess.check_output(['git', 'log', '-1', '--format=%cs', '--', p], text=True).strip() or '?'
    except Exception: return '?'
extra = [
 ('release-candidate.json', 'リリース候補メタ（version 2.0.0-rc.1、saveキー・saveVersion=9、配備先 GitHub Pages）'),
 ('tests/run-all-shards.json', '正本テストのシャード割当（B〜L を明示、未割当は A）'),
 ('tests/test-execution-registry.json', 'テスト実行レジストリ'),
 ('scripts/parallel-shard-runner.config.json', '並列シャード実行の設定'),
 ('VALIDATE_STAGE35A.sh', 'Stage 3.5A の検証スクリプト'),
 ('docs/ci-evidence', 'CI計測証跡（JSON/gz 18ファイル。parallel-shard 系文書の根拠データ）'),
 ('docs/ui-v3/evidence', 'UI v3 の画面写真証跡（PNG）'),
 ('docs/ui-v3/mockup.html', 'UI v3 のモックアップ（4画面）'),
 ('artifacts/pe-ui-phase1', 'PE UI Phase1 のスクリーンショット（PNG 5枚）'),
 ('boot-test.html 他 boot-test-stage-*.html（5本）・observer-source-diagnostic.html', '起動/Observer の診断用ページ（本番では読み込まれない）'),
 ('map-phase1-prototype.html / map-phase2-preview.html / prototypes/*.js', '地図プロトタイプ（本番とは別ファイル）'),
]
for p, d in extra:
    o.append(f'| `{p}` | {d} | {gl(p.split(" ")[0]) if os.path.exists(p.split(" ")[0]) else "—"} |')
o.append('')
open('docs/inventory/spec-sources.md', 'w', encoding='utf-8').write('\n'.join(o))
print(len(rows), len(o))
