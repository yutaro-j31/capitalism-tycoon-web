# -*- coding: utf-8 -*-
import json, re, sys, os, glob
S = os.path.dirname(os.path.abspath(__file__)) + '/'
sys.path.insert(0, S)
import moddesc

order = re.findall(r'src="\./js/([a-z0-9-]+)\.js', open('index.html').read())
info = json.load(open(S + 'mod_info.json'))
hit = json.load(open(S + 'dom_hit3.json'))
sx = json.load(open(S + 'self_exec.json'))
sk = json.load(open(S + 'script_keys.json'))
sc = json.load(open(S + 'static_cons.json'))
files = {n: open(f'js/{n}.js', encoding='utf-8').read().split('\n') for n in order}

def reg_line(n):
    keys = sk[n]['keys']
    for k in keys:
        pat = re.compile(r'(?:modules|__modules)\.' + re.escape(k) + r'\s*=')
        for i, l in enumerate(files[n], 1):
            if pat.search(l):
                return i
    for i, l in enumerate(files[n], 1):
        if re.search(r'Object\.assign\((?:exports|competitor|engine|modules)', l):
            return i
    return len(files[n])

def first_ref(consumer, keys):
    for k in keys:
        pat = re.compile(r'(?<![A-Za-z0-9_$])' + re.escape(k) + r'(?![A-Za-z0-9_$])')
        for i, l in enumerate(files[consumer], 1):
            if pat.search(l):
                return f'js/{consumer}.js:{i}'
    return None

INFRA = {'boot-recovery', 'runtime', 'data'}
# ---- manual verdicts: name -> (state, basis) ----
UI3NOTE = '?ui=3 を付けたときだけ描画（既定URLでは描画されない）。?ui=3 の計測（RU30）では画面が描画されることを確認'
M = {}
for n in order:
    if n.startswith('ui3-'):
        M[n] = ('不明', f'[要判断・?ui=3限定] {UI3NOTE}。docs/ui-v3/README.md が「cutover まで ?ui=3 の裏」と定める段階的状態であり、本番扱いかは判断事項')

CAPFAM = [n for n in order if n.startswith('capital-allocation-')] + ['shareholder-returns', 'shareholder-activism', 'shareholder-value-destruction']
for n in CAPFAM:
    M[n] = ('不明', '[要判断・条件付き] 上場企業(publicCompany)の「株式」タブ等でのみ描画・実効（例: js/capital-allocation-policy.js:48 の `!instance.g.publicCompany` で空返却）。enhancer/週次ラップは毎回実行されるが、測定した全状態（IPO条件 engine.js ipoMissingReasons を満たせず）で画面出力・状態変化を観測できなかった')
for n in ['real-estate-tenant-renewals-ui', 'real-estate-tenant-collections-ui', 'real-estate-rent-guarantee-ui', 'real-estate-security-deposits-ui', 'real-estate-rent-pricing-ui', 'real-estate-capex-actuals-ui']:
    M[n] = ('不明', '[要判断・条件付き] 賃貸契約成立後の物件カード（資産タブ）にだけ出力する enhancer。物件購入済みの測定状態でも出力を観測できず（enhancer実行191回・DOM変更0）')
for n in ['player-crisis-actions', 'player-crisis-restructuring', 'player-crisis-creditor', 'player-crisis-turnaround-fund', 'player-crisis-creditor-ui', 'player-turnaround-plan', 'player-turnaround-plan-ui', 'player-turnaround-plan-report', 'player-crisis-ui']:
    M[n] = ('不明', '[要判断・条件付き] 資金危機（playerCrisis が発動）状態でのみ画面・状態に出る。測定した全状態で危機は未発生（enhancer実行191回・DOM変更0）。危機の判定本体 js/player-crisis.js は週次で稼働')
for n in ['listed-subsidiary-market', 'listed-subsidiary-portfolio-dashboard', 'listed-subsidiary-control-actions', 'subsidiary-integration-synergy', 'inter-subsidiary-synergy-allocation', 'inter-subsidiary-synergy-performance', 'group-capital-allocation-actions', 'group-restructuring-candidates', 'group-restructuring-progress', 'subsidiary-relisting-options', 'listed-subsidiary-follow-on-offering', 'subsidiary-ipo-preparation', 'subsidiary-ipo-secondary-sale', 'subsidiary-mandate-apply', 'subsidiary-performance-review', 'subsidiary-budget-kpi', 'group-holding-governance', 'group-capital-allocation-plan', 'group-capital-allocation-execution', 'ma-investment-committee', 'pmi-100-day-plan', 'pmi-long-run-guard']:
    M[n] = ('不明', '[要判断・条件付き] 子会社（特に上場子会社）を保有したときだけ VC/M&A タブに出力。測定状態では子会社化(makeSubsidiary: 持分50%以上が必要 engine.js:1664)に到達できず未観測（enhancer実行191回・DOM変更0〜1）')

# modules that are certainly dead / test-only
M['pmi-100-day-loader'] = ('未接続', '[静的] js/pmi-100-day-loader.js は193バイト・コメントのみ（「旧ブックマーク/キャッシュ向けの互換境界」, 1-2行目）。実行コードなし')
M['economic-shadow-journal'] = ('未接続', '[静的] registry登録のみ(js/economic-shadow-journal.js 末尾)。js/ 内に参照元なし(grep `economicShadowJournal` は自ファイルのみ)。参照は tests/ のみ')
M['phase3-indirect-economic-paths'] = ('未接続', '[静的] 読み取り専用の診断。js/ 内に参照元なし(grep `phase3IndirectEconomicPaths` は自ファイルのみ)。docs/economic-engine/PHASE_3_INDIRECT_ECONOMIC_PATHS_SLICE.md の診断用。参照は tests/ のみ')
M['phase3-restructuring-lifecycle'] = ('未接続', '[静的] 読み取り専用の根拠投影。js/ 内に参照元なし(grep `phase3RestructuringLifecycle`)。参照は tests/ のみ')
M['phase3-control-eligibility'] = ('未接続', '[静的] 読み取り専用・実行不可の投影（js/phase3-control-eligibility.js 1行目コメント）。js/ 内に参照元なし。参照は tests/ のみ')
M['phase3-ownership-planner'] = ('未接続', '[静的] 参照元は phase3-ownership-apply.js のみ。その apply 側は「dormant」（docs/economic-engine/PHASE_3_P3_4_OWNERSHIP_APPLY.md）で本番の書込経路に未接続')
M['phase3-ownership-apply'] = ('不明', '[要判断] 計画適用 applyOwnershipPlan は休眠。ただし insideOwnershipBoundary は engine.js(executeIPO, engine.js:1841付近)から本番で呼ばれる境界判定。休眠機能と稼働の判定部が同居')
M['phase3-vc-source-interests'] = ('稼働', '[静的] 読み取り専用投影。phase3-founder-wealth と economic-read-model が参照。創業者タブの「資産内訳」ボタン(app.js `founder-wealth-capture`)経由でのみ実行。画面出力は操作起点')
M['phase3-pe-fund-interests'] = ('稼働', '[静的] 読み取り専用投影。phase3-founder-wealth と economic-read-model が参照。創業者タブの「資産内訳」ボタン経由でのみ実行。画面出力は操作起点')
M['phase3-founder-wealth'] = ('稼働', '[静的] 参照元 js/app.js（captureFounderWealthBreakdown / case \'founder-wealth-capture\'）。操作起点の読み取り専用表示')
M['economic-read-model'] = ('稼働', '[動的] 他モジュールから参照（registry読込 54回・engine/expansion/phase3-* 等）')
M['economic-settlement'] = ('稼働', '[静的] 参照元 js/store-equipment.js:191,198（店舗設備投資の決済に buildStoreRenovationOperation / commitCompanyCashOperation を使用）。操作起点（設備投資ボタン）')
M['sports-management'] = ('稼働', '[静的] 参照元 js/app.js（資産タブ「スポーツ」サブタブ app.js:576,756）・expansion.js・engine.js・d-ui-context-tabs.js。チーム未保有の測定状態では動的未発火')
M['personal-real-estate-short-term'] = ('稼働', '[静的] Engine.prototype.switchPersonalRealEstateRentalMode を提供。参照元 app.js の case \'switch-rental-mode\'。個人不動産保有時の操作起点')
M['personal-real-estate-redevelopment'] = ('稼働', '[静的] Engine.prototype.startPersonalRealEstateRedevelopment 等を提供。参照元 app.js。個人不動産保有時の操作起点')
M['pe-industry-tiers'] = ('稼働', '[動的] pe-fund / pe-deal-supply / pe-portfolio-operations が参照（registry読込 6回）')
M['pe-acquisition'] = ('稼働', '[静的] 参照元 expansion.js / ma-deal-room.js（PE買収の資金検証・実行）。PE案件取得時の操作起点')
M['management-context'] = ('稼働', '[静的] Engine.prototype.openPEPortfolioManagement 等を提供。参照元 pe-portfolio-operations / pe-ui-adapter。PE投資先画面の操作起点')
M['competitor-dashboard'] = ('稼働', '[動的] competitor-dashboard-ui と -status が参照（registry読込 18回）。「競合」タブで #screen を置換し data-competitor-dashboard-ui="1" を付与するのをDOMで確認')
M['runtime-recovery-ui'] = ('稼働', '[静的] boot-recovery.js が参照（registry読込 3回）。未捕捉エラー時の復旧画面（障害時のみ画面に出る保険）')
M['boot-recovery'] = ('稼働', '[静的] index.html 先頭で読込（js/boot-recovery.js:1-12 の起動前ハンドラ）。障害時のみ画面に出る保険。通常起動では画面に現れない')
M['runtime'] = ('稼働', '[動的] モジュール登録簿 __capitalismTycoonModules を定義（全モジュールが依存）')
M['data'] = ('稼働', '[動的] マスターデータ。他モジュールからの参照 registry読込 140回')
M['save-import-atomic-guard'] = ('稼働', '[静的] Engine.prototype.importSave をラップ（保存JSON読込の保護）。設定>JSON読込の操作起点。測定ではJSON読込を実行していない')
M['real-estate-price-negotiation'] = ('稼働', '[静的+操作] 参照元 js/app.js（confirmPropertyNegotiation）。クロールで「会社/個人で価格交渉」ボタン→価格交渉モーダルが開くことを確認')
M['progression-balance'] = ('稼働', '[動的] Engine.ipoMissingReasons をラップし992回実行（home/秘書の「次にやること」計算に使用）')
M['pe-rivals'] = ('稼働', '[静的] peRivals を ma-deal-room / pe-portfolio-operations / pe-ui-adapter が読む')
M['personal-real-estate-corp'] = ('稼働', '[静的] personalRealEstateCorp を app / expansion / personal-real-estate-taxes / phase3-founder-wealth が読む')
M['macro-cycle'] = ('稼働', '[動的] updateMacroCycleWeekly を毎週実行（408回）。economy/industryClimate/macroHistory が毎週変化し、d-ui-context-tabs が macroHistory・industryEventHistory を読む')
M['industry-specific-events'] = ('稼働', '[動的] advanceWeek ラップ毎週実行（408回）。industrySpecificModifiers / EventHistory が毎週変化。modifiers は自モジュール内で需要・コストに適用（外部読み手なし）')
M['product-lifecycle'] = ('稼働', '[動的] updateProductLifecycleWeekly を毎週実行（408回）。IT事業(productVentures)保有時に実効')
M['strategy-balance'] = ('稼働', '[動的] configure ラップ6回・毎週 updateProductFunnelsWeekly ラップ。strategyBalanceVersion を適用済み判定に読む(strategy-balance.js:40)')
# Mode 0 / UI-unreachable group
M['bank-loans-covenants'] = ('稼働', '[動的] Engine 3メソッドをラップし420回実行、finance.js/engine.js が参照（ext 6回）、finance.ensureFinance 等を2088回呼出。計算は稼働。ただし画面側 inject() は `[data-screen="finance"]`(js/bank-loans-covenants.js:86) を探すが、data-screen は selectedTab の値(js/app.js:115)で "finance" の画面は存在せず出力されない（enhancer実行191回・DOM変更0）')
M['corporate-bonds-ratings'] = ('値だけ', "[静的+動的] issue()/service() は `return false` の意図的 no-op（js/corporate-bonds-ratings.js:9-12, 「GF-002 Mode 0」）。ensure が空の bondFinancing を書くだけで読み手なし。画面関数 renderSection は js/ 内に呼出元なし（grep結果: 定義とテストのみ。inject/enhancer も無い）＝本番では画面に出ない（renderSection は :15 で selectedTab==='finance' 限定でもある）")
M['convertible-bonds-dilution'] = ('値だけ', '[静的+動的] Mode 0 = 発行・償還とも no-op（js/convertible-bonds-dilution.js:12, tests/gf-002-financing-mode0-test.js）。ensure が空の convertibleFinancing を書くだけ。画面関数 renderSection は js/ 内に呼出元なし（grep結果: 定義とテストのみ。inject/enhancer も無い）＝本番では画面に出ない')
M['preferred-shares-dividends'] = ('値だけ', '[静的+動的] Mode 0 = 発行・配当とも no-op（js/preferred-shares-dividends.js:11, tests/gf-002-financing-mode0-test.js）。ensure が空の preferredFinancing を書くだけ。画面関数 renderSection は js/ 内に呼出元なし（grep結果: 定義とテストのみ。inject/enhancer も無い）＝本番では画面に出ない')
M['board-governance-resolution'] = ('値だけ', '[静的+動的] 書込先は boardGovernance のみ（週次 normalize ラップ18回）で、読み手は自モジュールのみ。画面側 inject() は `[data-screen="finance"]`(js/board-governance-resolution.js:459) を探すが存在せず、selectedTab===\'finance\'(:442) 限定でもあり、本番では画面に出ない')
M['long-run-guidance'] = ('値だけ', '[静的+動的] longRunGuidance を毎週更新(420回)するが、読み手は自モジュールの renderSection のみ。画面関数 renderSection は js/ 内に呼出元なし（grep結果: 定義とテストのみ。inject/enhancer も無い）＝本番では画面に出ない')
M['global-company-ranking-goals'] = ('値だけ', '[静的+動的] globalRanking を毎週更新(420回)。読み手は hall-of-fame-generations / long-run-guidance（いずれも画面に出ない）のみ。報酬は記録のみでスコアに反映しない（コメント #816）。画面関数 renderSection は js/ 内に呼出元なし（grep結果: 定義とテストのみ。inject/enhancer も無い）＝本番では画面に出ない')
M['hall-of-fame-generations'] = ('値だけ', '[静的+動的] hallOfFame を毎週更新(420回)。読み手は自モジュールと long-run-guidance のみ。画面関数 renderSection は js/ 内に呼出元なし（grep結果: 定義とテストのみ。inject/enhancer も無い）＝本番では画面に出ない')
M['executives-department-assignments'] = ('不明', '[要判断] executiveModifiers を計算して書く（js/executives-department-assignments.js:14）が読み手なし（grep結果: 書込のみ）＝この部分は値だけ。一方 hireExecutive をラップして9回実行され executives/companyCash/history も書くため、モジュール全体を「値だけ」とは断定できない。画面関数 renderSection は js/ 内に呼出元なし（grep結果: 定義とテストのみ。inject/enhancer も無い）＝本番では画面に出ない')
M['executive-retirement-succession'] = ('不明', '[要判断] 毎週 process(420回)で役員を退任させる(removeExecutive, js/executive-retirement-succession.js:10) = executives（app が読む）を変える計算経路は稼働。一方、画面関数 renderSection は js/ 内に呼出元なし（grep結果: 定義とテストのみ。inject/enhancer も無い）＝本番では画面に出ない。後任昇格・評価は同チェーンの別モジュール')
M['executive-reviews-succession-board'] = ('不明', '[要判断] normalize ラップ12回のみ観測。executiveGovernance の読み手は退任モジュールのみ。employeeSatisfaction/companyReputation も書くため「値だけ」と断定できない。画面関数 renderSection は js/ 内に呼出元なし（grep結果: 定義とテストのみ。inject/enhancer も無い）＝本番では画面に出ない')

def evidence(n):
    i = info[n]
    parts = []
    pc = {k: v for k, v in i['pcalls'].items() if v}
    if pc:
        top = sorted(pc.items(), key=lambda x: -x[1])[:2]
        parts.append('Engineメソッドをラップし実行: ' + ', '.join(f'{k}×{v}' for k, v in top))
    if i['ext_calls']:
        parts.append(f'他モジュールから関数呼出 {i["ext_calls"]}回')
    s = {k: c for k, c in sx.get(n, {}).items() if not k.startswith(('uiEnhancerRegistry.', 'playerEngineBridge.getEngine', 'ui3.register'))}
    if s:
        top = sorted(s.items(), key=lambda x: -x[1])[:2]
        parts.append('自コードが実行: ' + ', '.join(f'{k}×{v}' for k, v in top))
    if i['ext_reads'] and not i['ext_calls']:
        parts.append(f'他モジュールから参照 {i["ext_reads"]}回')
    em = [(k, e['mut']) for k, e in i['enh'].items() if e['mut'] > 0]
    if em:
        parts.append('UI enhancer がDOMを変更(' + ', '.join(f'{k}:{m}件' for k, m in em[:2]) + ')')
    h = hit.get(n) or {}
    if h:
        parts.append('DOMに固有属性を確認: ' + ', '.join(list(h)[:2]))
    return parts

rows = []
for n in order:
    desc = moddesc.desc(n)
    rl = reg_line(n)
    if n in M:
        st, basis = M[n]
    else:
        parts = evidence(n)
        if parts:
            st = '稼働'
            basis = '[動的] ' + '; '.join(parts)
        else:
            cons = [c for c in sc[n]['cons'] if c != n]
            if cons:
                st = '稼働'
                basis = f'[静的] 参照元 {first_ref(cons[0], sk[n]["keys"])} ほか{len(cons)-1}件。動的未発火'
            else:
                st = '不明'
                basis = '[要判断] 動的・静的とも根拠を得られず'
    # attach registration line
    basis = f'{basis}（登録 js/{n}.js:{rl}）'
    rows.append((n, desc, st, basis))

json.dump(rows, open(S + 'features_rows.json', 'w'), ensure_ascii=False)
cnt = {}
for r in rows:
    cnt[r[2]] = cnt.get(r[2], 0) + 1
print(len(rows), cnt)
for r in rows:
    if r[2] != '稼働':
        pass
