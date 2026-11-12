# -*- coding: utf-8 -*-
import json, glob, re, subprocess, collections, os
S = (os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
feat = json.load(open(S + 'features_rows.json'))
fld = json.load(open(S + 'fields_rows.json'))
dc = json.load(open(S + 'field_delcand.json'))
sha = subprocess.check_output(['git', 'rev-parse', '--short', 'main'], text=True).strip()

fc = collections.Counter(r[2] for r in feat)
tier = collections.Counter()
for r in feat:
    if r[2] == '稼働':
        tier['動的' if r[3].startswith('[動的]') else ('静的+動的' if r[3].startswith('[静的+動的]') else '静的')] += 1
sc = collections.Counter(r[5].split('(')[0] for r in fld)
stier = collections.Counter(r[5] for r in fld if r[5].startswith('稼働'))

# UI counts
def ui_counts(pat):
    rows = []
    for f in sorted(glob.glob(S + pat)):
        for line in open(f):
            rows += json.loads(line)
    c = collections.Counter()
    SEL = {'selectedTab', 'selectedPref', 'selectedArea', 'selectedBusiness', 'lastSaveDate', 'selectedStockId'}
    kinds = collections.Counter()
    seen = set()
    for r in rows:
        if r['tag'] in ('input', 'select', 'textarea'):
            kinds['入力欄'] += 1; continue
        if not (r['tag'] == 'button' or r['action']): continue
        if 'tab=' in r['ds'] and not r['action']: kinds['タブ遷移ボタン'] += 1; continue
        if r.get('dup'): kinds['同種(重複)'] += 1; continue
        m = r.get('measure')
        kinds['押下対象(種類)'] += 1
        if m is None: c['未計測'] += 1
        elif m.get('skipped'): c['未実行'] += 1
        elif m.get('disabled'): c['disabled'] += 1
        elif m.get('found') is False: c['測定不能'] += 1
        elif m.get('error'): c['エラー'] += 1
        else:
            ck = [k for k in m['changedKeys'] if k not in SEL]
            opened = m['modal'] or m['sheet']
            if ck: c['〇 状態変化'] += 1
            elif opened: c['△ 確認画面を開くのみ/確定後も変化なし'] += 1
            elif set(m['changedKeys']) & SEL: c['画面遷移・選択のみ'] += 1
            else: c['× 変化なし'] += 1
    return c, kinds

cd, kd = ui_counts('crawl_d*.jsonl')
cu, ku = ui_counts('crawl_u*.jsonl')

o = []
o.append('# 棚卸しまとめ（capitalism-tycoon-web）\n')
o.append(f'- 基準: `main` @ `{sha}`（2026-11-12）。**調査のみ。コードの変更はなし**（変更・追加は `docs/inventory/` 配下のみ）。')
o.append('- 成果物: [features.md](features.md)（作業1）・[state-fields.md](state-fields.md)（作業2）・[ui-actions.md](ui-actions.md)（作業3）・[spec-sources.md](spec-sources.md)（作業4）・本ファイル（作業5）・[tools/](tools/)（再現用スクリプト）。')
o.append('- 方法の要点: Chromium(Playwright)で本番の `index.html` を**実際に起動**し、モジュール呼出・`Engine.prototype` 差替の実行回数・`g` の読み書き・DOM出力・全ボタン押下を計測し、コードの静的 grep と突き合わせた。詳細と限界は各ファイル冒頭。\n')

o.append('## 0. 依頼文との差（先に確認してほしい点）\n')
o.append('1. モジュール数: 依頼文は「約170本」だが、`index.html` が読み込むのは **245本**（`ls js | wc -l` も 245）。`docs/GAME_OVERVIEW.md:177` は「203」と書いている（spec-sources.md C1）。')
o.append('2. 前例の PR 番号: 依頼文は「founderEnergy・founderFocus・founderHealth・founderEducationLevel・founderNetworkLevel・lobbyInfluence は読まれていなかった（PR #397）」。git 履歴では #397 は `refactor: clean up founder profile`（`ca9ec200`）、体力・健康・集中力の廃止は #542（`5ba87241`）。現在の状況は state-fields.md 冒頭の表のとおり（3つは削除済み、`founderEducationLevel`・`lobbyInfluence` は**いまも値だけ**、`founderNetworkLevel` は `js/engine.js:2615` で読まれるようになった）。')
o.append('3. 状態フィールドの範囲: `g` の**トップレベル436キー**を対象にした。`g.stores[i].xxx` のような入れ子の項目は対象外（量が桁違いのため）。必要なら tools/ のスクリプトを拡張して同じ方法で出せる。\n')

o.append('## 1. 各状態の件数\n')
o.append('### 1.1 モジュール（245本、features.md）\n')
o.append('| 状態 | 件数 | 備考 |')
o.append('|---|---|---|')
o.append(f'| 稼働 | {fc["稼働"]} | 根拠の強さ: 動的に観測 {tier["動的"]} / 静的+動的 {tier["静的+動的"]} / 静的のみ {tier["静的"]} |')
o.append(f'| 値だけ | {fc["値だけ"]} | 全て「画面に出ない・読み手なし」。下の 2.2 参照 |')
o.append(f'| 未接続 | {fc["未接続"]} | 下の 2.1 参照 |')
o.append(f'| 不明 | {fc["不明"]} | 条件付き機能（上場後・子会社保有後・資金危機時・賃貸契約後）と `?ui=3` 限定。理由は各行。下の 3 に集約 |')
o.append(f'| 計 | {sum(fc.values())} | |')
o.append('')
o.append('### 1.2 状態フィールド（`g` トップレベル436キー、state-fields.md）\n')
o.append('| 状態 | 件数 | 備考 |')
o.append('|---|---|---|')
o.append(f'| 稼働 | {sc["稼働"]} | 動(実行で観測) {sum(v for k,v in stier.items() if "動" in k)} / 静(コード上のみ) {sum(v for k,v in stier.items() if "静" in k)}。`next*Seq` 採番カウンタを含む |')
o.append(f'| 値だけ | {sc["値だけ"]} | 書込はあるが実読込なし（大半は `*Version`・`*History`・`*Log` と創業者/会社の記録系） |')
o.append(f'| 初期値のみ | {sc["初期値のみ"]} | 書込も読込もなく初期値だけ存在 |')
o.append(f'| 計 | {sum(sc.values())} | |')
o.append('')
o.append('### 1.3 画面の操作（ui-actions.md）\n')
o.append('| 区分 | 既定UI | ?ui=3 |')
o.append('|---|---|---|')
for k in ['押下対象(種類)', 'タブ遷移ボタン', '同種(重複)', '入力欄']:
    o.append(f'| {k} | {kd[k]} | {ku[k]} |')
for k in ['〇 状態変化', '△ 確認画面を開くのみ/確定後も変化なし', '画面遷移・選択のみ', '× 変化なし', '未実行', 'disabled', '測定不能']:
    o.append(f'| └ {k} | {cd[k]} | {cu[k]} |')
o.append('')
o.append('「× 変化なし」は「測定した基準状態では無効だった」であって、壊れているとは限らない（トーストの理由が資金不足・前提未達のものが多い）。ui-actions.md に1件ずつ理由を併記。\n')

o.append('## 2. 削除候補\n')
o.append('> 以下は**候補の列挙であり、削除の提案・実施ではない**。いずれも `tests/` が参照しており、テストの削除・弱体化は禁止（AGENTS.md §2）なので、実際に消すには別途の判断が要る。\n')
o.append('### 2.1 「未接続」で、セーブ互換に影響しないもの\n')
o.append('保存データ(`g`)に書き込まないため、セーブ形式（`SAVE_KEY=capitalism_tycoon_web_v1`・`saveVersion=9`）に影響しない。\n')
o.append('| モジュール | 理由（features.md の根拠） | 参照しているテスト | 備考 |')
o.append('|---|---|---|---|')
o.append('| `pmi-100-day-loader` | 193バイト・コメントのみ（実行コードなし） | tests/workflow-path-filter-contract-test.js | index.html の `<script>` 行と、パス名を列挙するテスト/ワークフロー側の整理が要る |')
o.append('| `economic-shadow-journal` | js/ 内に参照元なし | tests/economic-shadow-journal-test.js | docs/economic-engine/PHASE_1_SHADOW_JOURNAL.md が契約書。Economic Engine の段階導入物なので「将来用」かの判断が要る（要判断） |')
o.append('| `phase3-indirect-economic-paths` | 診断専用・参照元なし | tests/phase3-indirect-economic-paths-test.js | 同上（Phase 3 の読み取り専用スライス） |')
o.append('| `phase3-restructuring-lifecycle` | 根拠投影のみ・参照元なし | tests/phase3-restructuring-lifecycle-test.js | 同上 |')
o.append('| `phase3-control-eligibility` | 実行不可の投影・参照元なし | tests/phase3-control-eligibility-test.js ほか3 | 同上 |')
o.append('| `phase3-ownership-planner` | 参照元は休眠中の phase3-ownership-apply のみ | tests/phase3-ownership-planner-test.js ほか7 | 静的に `founderShares`/`sharesOut` への書込が検出されるが、呼出元が休眠のため実行されない。`phase3-ownership-apply` と一体で判断 |')
o.append('')
o.append('### 2.2 「値だけ」のモジュール（セーブ互換に影響する＝別枠）\n')
o.append('これらは保存される状態ボックスを書いている（読み手は自分自身か到達不能な画面のみ）。消すと**新規セーブからそのキーが消える**。`semantic-hash-v2.js` の `ROOT_KEYS` には含まれない（決定論ハッシュには影響しない）が、`tests/` のセーブ系テストに触れる可能性がある。\n')
o.append('| モジュール | 書く状態 | 補足 |')
o.append('|---|---|---|')
o.append('| `corporate-bonds-ratings` | `bondFinancing`（空の箱） | Mode 0＝発行・償還とも `return false`（js/corporate-bonds-ratings.js:9-12） |')
o.append('| `convertible-bonds-dilution` | `convertibleFinancing`（空の箱） | 同上 |')
o.append('| `preferred-shares-dividends` | `preferredFinancing`（空の箱） | 同上 |')
o.append('| `board-governance-resolution` | `boardGovernance` | 画面は到達不能な \'finance\' タブ限定 |')
o.append('| `long-run-guidance` | `longRunGuidance` | 同上 |')
o.append('| `global-company-ranking-goals` | `globalRanking` | 同上。報酬は記録のみ（コメント #816） |')
o.append('| `hall-of-fame-generations` | `hallOfFame` | 同上 |')
o.append('')
o.append('### 2.3 値だけ／初期値のみの状態フィールド（すべてセーブ互換に影響する＝別枠）\n')
o.append(f'`g` のトップレベルのキーは**すべて保存データに含まれる**（features/state-fields.md 参照）ため、「セーブ互換に影響しない削除候補」に該当するフィールドは**ない**。下表は影響の種類で分けたもの。前例: 創業者の体力・健康・集中力の廃止（#542）では「旧セーブに残っていても単純に無視される」扱いで削除された（docs/CURRENT_SAVE_SCHEMA.md）。\n')
grp = collections.OrderedDict([('決定論ハッシュに含まれる（`semantic-hash-v2.js` の `ROOT_KEYS`）→ 削除/変更で決定論フィンガープリントと関連 fixture が動く', []),
                               ('ハッシュには含まれないが `tests/fixtures/` に値がある → セーブ/ベースライン系テストの fixture が動く', []),
                               ('ハッシュにも fixture にも含まれない', [])])
keys = list(grp)
for k, v in dc.items():
    if v['hash']: grp[keys[0]].append((k, v))
    elif v['fixtures']: grp[keys[1]].append((k, v))
    else: grp[keys[2]].append((k, v))
for title, items in grp.items():
    o.append(f'**{title}（{len(items)}件）**\n')
    o.append('| フィールド | 状態 | tests/ での参照ファイル数 | fixture |')
    o.append('|---|---|---|---|')
    for k, v in items:
        o.append(f'| `{k}` | {v["state"]} | {v["tests"]} | {", ".join(v["fixtures"][:3]) or "—"} |')
    o.append('')

o.append('## 3. 要判断の一覧（結論を出していないもの）\n')
o.append('| # | 論点 | 内容と根拠 | 影響範囲 |')
o.append('|---|---|---|---|')
ui3 = [r[0] for r in feat if r[0].startswith('ui3-')]
cap = [r[0] for r in feat if r[0].startswith('capital-allocation-')] + ['shareholder-returns', 'shareholder-activism', 'shareholder-value-destruction']
o.append(f'| J1 | `?ui=3` を「本番」に数えるか | ui3-* の {len(ui3)} モジュールは `?ui=3` でだけ描画（既定URLでは `rendersNatively` が偽。js/app.js:102）。docs/ui-v3/README.md は cutover までの段階的状態と定める。「稼働」か「未接続」かは方針次第のため全て「不明」とした | features.md の ui3-* 行 |')
o.append('| J2 | **本番で画面に出ない機能（実害の可能性が高い）** | (a) `bank-loans-covenants`・`board-governance-resolution`: 画面側 `inject()` が `[data-screen="finance"]` を探す（js/bank-loans-covenants.js:86, js/board-governance-resolution.js:459）が、`data-screen` は `selectedTab` の値（js/app.js:115）で、TABS（js/app.js:80-84）と `renderScreen`（:140-146）に \'finance\' はない（銀行は \'bank\'）。`selectedTab` を \'finance\' にする経路もない（`tab:\'finance\'` は店舗シートの内部タブ js/iphone-playtest-fixes.js:123,138 のみ）。(b) 他の9モジュール（convertible-bonds-dilution / corporate-bonds-ratings / preferred-shares-dividends / executive-retirement-succession / executive-reviews-succession-board / executives-department-assignments / global-company-ranking-goals / hall-of-fame-generations / long-run-guidance）: `renderSection` の呼出元が js/ に**ない**（inject/enhancer も無し）。全タブ巡回の実測でも出力ゼロ。一方、8本のテストが `selectedTab:\'finance\'` を直接渡して `renderSection` を呼び合格している（例 tests/bank-loans-covenants-test.js:13）。→ 画面を載せるのか、機能ごと不要なのかは設計判断 | features.md（該当行）・spec-sources.md C14 |')
o.append(f'| J3 | 条件付き機能を「稼働」とみなすか | 上場後（{len(cap)}モジュール: capital-allocation-* 16・shareholder-* 3）、子会社保有後（22）、資金危機時（9）、賃貸契約成立後（6）にだけ出る機能は、計測用に作れた状態では未発火。コード上は到達可能に見えるが未確認。到達条件を満たす専用シナリオ（IPO: `ipoMissingReasons`＝本社・経理部門・取締役会・直近52週利益1,000万円・企業価値1億円／子会社化: 持分50%以上 engine.js:1664）で再計測すれば「稼働」か「未接続」に分けられる | features.md の「不明」行 |')
o.append('| J4 | `phase3-ownership-apply` と Economic Engine の「休眠」物 | 計画適用は休眠、境界判定だけ稼働。economic-shadow-journal・phase3-* 読み取り専用スライスは「将来用の段階導入物」か「不要」か | features.md |')
o.append('| J5 | Mode 0 の3モジュール | 社債・転換社債・優先株は発行・償還が意図的な no-op（GF-002）。画面は「現在利用できません」と説明するだけ（かつ J2 により到達不能）。残すか | features.md |')
o.append('| J6 | executive-* チェーン | executive-retirement-succession は役員を実際に退任させる（計算は稼働）が画面は到達不能。executives-department-assignments は executiveModifiers が読み手なし | features.md |')
o.append(f'| J7 | 値だけフィールドを残す理由 | `*Version`/`*History`/`*Log` は監査・将来用の記録として意図的に持つ可能性（テストが検証関数で長さ上限だけ読む例: js/product-lifecycle.js:111）。消す/残すは方針判断 | state-fields.md（{sc["値だけ"]}件） |')
o.append('| J8 | `founderEducationLevel`・`lobbyInfluence` | 前例の再発。書くだけで読まれない（個人資産/創業者タブの「教育」「ロビー」投資の効果が実際には何も起きない）。効果を実装するか、操作ごと消すか | state-fields.md |')
o.append('| J9 | 文書の矛盾 C1〜C14 | どちらが正しいかは決めていない。実測値を併記した（C1: 245 / C2: B〜L / C3: 36-43 / C4: 9 / C11: 79・164・82） | spec-sources.md |')
o.append('| J10 | UI v3 の画面数 | docs/ui-v3/README.md は「19画面」、実装は 20（`pe-portfolio` が追加）。README を直すのか、画面を19に戻すのか | spec-sources.md C10 |')
o.append('')

o.append('## 4. 発見事項（調査の副産物）\n')
o.append('1. **テストが通るのに本番で動かない画面**: J2 のとおり、テストは `renderSection` を直接呼んで描画を確認しており、本番では呼出元がないか、存在しない \'finance\' 画面を対象にしていて一度も出ない。「テストが通っている＝画面に出ている」とは限らない実例。')
o.append('2. **`engine.js` の `SAVE_VERSION` は 8**（js/engine.js:18）のまま、`js/save-v9.js:18` が 9 を定義して `TycoonEngine` を差し替える二層構造。実行時の `g.saveVersion` は 9。')
o.append('3. **enhancer の登録数**: 実測 registered=82（外部79＋index.html 内蔵3）、実行=164。`tests/startup-runtime-budget-test.js` の上限 79/164 はちょうど上限。同ファイルのコメント（baseline 100 = 50+50）だけが古い（C11）。')
o.append('4. 会計の整合: 計測中に `companyCash` を直接書き換えると `P2-CLOSE-BS-IDENTITY`（貸借一致）で週送りが失敗した（`FinanceValidationBoundaryError`）。これは仕様どおりの防護であり、資金の注入には `contributeFounderCapital` を使った。\n')

o.append('## 5. 限界（何をしていないか）\n')
o.append('- 全体の動的計測は「新規ゲーム・既定シナリオ(free)・難易度 normal」の 1 シードのみ。複数シード・他シナリオ・IPO後/子会社保有後/危機時の状態は作っていない（J3）。')
o.append('- 「稼働(静的のみ)」は、コード上の参照があることしか示さない。')
o.append('- 状態フィールドは `g` のトップレベルのみ（0 の 3）。動的キーアクセスは正規化ループのみ確認。')
o.append('- 文書の矛盾探しは全文照合ではない（spec-sources.md 冒頭）。')
o.append('- UI操作は「基準状態で1種類につき1回」。入力値は既定値のみ。')
o.append('')
open('docs/inventory/README.md', 'w', encoding='utf-8').write('\n'.join(o))
print('ok', len(o))
