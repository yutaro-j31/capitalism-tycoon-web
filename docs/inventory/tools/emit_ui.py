# -*- coding: utf-8 -*-
import os
import json,glob,re,collections,subprocess,os
S=(os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
cases=json.load(open(S+'action_cases.json'))
jsfiles={os.path.basename(f)[:-3]:open(f,encoding='utf-8').read().split('\n') for f in glob.glob('js/*.js')}
TABNAME={'home':'ホーム','map':'出店','business':'事業','office':'本社','market':'株式','venture':'VC','ma':'M&A','overseas':'海外','assets':'資産','bank':'銀行','report':'決算','founder':'創業者','strategy':'戦略','media':'メディア','legacy':'承継','missions':'進行','rivals':'競合','news':'ニュース','settings':'設定'}
def kebab(s):return re.sub(r'([A-Z])',lambda m:'-'+m.group(1).lower(),s)
_cache={}
def locate(key):
    if key in _cache:return _cache[key]
    kb='data-'+kebab(key)
    emit=handler=None
    for fn,lines in jsfiles.items():
        for i,l in enumerate(lines,1):
            if kb in l or ('dataset.'+key) in l:
                is_h=bool(re.search(r"closest\(|matches\(|dataset\."+key,l))
                if is_h and not handler:handler=f'js/{fn}.js:{i}'
                if not is_h and not emit:emit=f'js/{fn}.js:{i}'
        if emit and handler:break
    _cache[key]=(emit,handler)
    return _cache[key]
SEL={'selectedTab','selectedPref','selectedArea','selectedBusiness','lastSaveDate','selectedStockId'}
r_action_holder=['']
def effect(m):
    if m is None:return '未計測'
    if m.get('skipped'):return '未実行（破壊的/ファイル操作/画面遷移のため。理由は下の注記）'
    if m.get('disabled'):return '測定時 disabled（押せない状態）'
    if m.get('found') is False:return '測定不能（クリック後に再描画で消えた）'
    if m.get('error'):return '測定エラー'
    ck=[k for k in m['changedKeys'] if k not in SEL]
    s2=m.get('stage2') or {}
    toast=(m['toasts'][0] if m['toasts'] else '')
    toast=toast.replace('|','／')[:48]
    if ck:
        extra=f' 確定:{s2["label"]}' if s2.get('clicked') else ''
        return '〇 状態変化: '+', '.join(ck[:5])+('…' if len(m['changedKeys'])>5 else '')+extra
    opened=m['modal'] or m['sheet']
    if opened:
        if s2.get('clicked'):return f'× 確認画面→確定({s2.get("label")})後も変化なし'+(f'（{toast}）' if toast else '')
        return '△ 確認/入力画面を開くのみ（確定ボタン未検出・未実行）'
    if set(m['changedKeys'])&SEL:return '画面遷移/選択のみ（業務状態は不変）'
    if not toast and not (cases.get(r_action_holder[0],[{'fns':[1]}])[0]['fns']):return '表示切替のみ（UI内部状態。g は不変）'
    return '× 変化なし'+(f'（{toast}）' if toast else '')
def fnlabel(r):
    a=r['action'];m=r.get('measure') or {}
    parts=[]
    if a and a in cases:
        c=cases[a][0]
        parts.append(f'js/app.js:{c["line"]} case \'{a}\' → '+(', '.join(c['fns']) if c['fns'] else '（画面内操作のみ）'))
    elif a:
        parts.append(f'data-action="{a}"（app.js の switch に case なし: 他ハンドラ）')
    else:
        ks=[kv.split('=')[0] for kv in r['ds'].split(';') if '=' in kv]
        for k in ks[:1]:
            e,h=locate(k)
            parts.append(f'data-{kebab(k)}（生成 {e or "—"} / 処理 {h or "—"}）')
        if not ks:parts.append('（data属性なし。DOM直結のリスナー）')
    if m.get('fns'):parts.append('観測: '+', '.join(m['fns'][:5]))
    elif m.get('mods'):parts.append('観測: '+', '.join(m['mods'][:4]))
    return ' ／ '.join(parts)
def label(r):
    l=r['label'];l=re.sub(r'\s+',' ',l)
    return (l[:40] or '（ラベルなし）').replace('|','／')
def build(pat,mode):
    rows=[]
    for f in sorted(glob.glob(S+pat)):
        for line in open(f):rows+=json.loads(line)
    return rows
sha=subprocess.check_output(['git','rev-parse','--short','main'],text=True).strip()
out=[]
def section(mode,rows,title):
    out.append(f'## {title}\n')
    # nav
    nav=collections.OrderedDict()
    for r in rows:
        if r['tag']=='button' and 'tab=' in r['ds'] and not r['action'] or r['action']=='tab':
            t=[kv.split('=')[1] for kv in r['ds'].split(';') if kv.startswith('tab=')]
            nav.setdefault((label(r),t[0] if t else ''),0);nav[(label(r),t[0] if t else '')]+=1
    out.append('### ナビゲーション（全タブ共通・タブ切替のみ）\n')
    out.append('呼ぶ関数（全行共通）: js/app.js:917 `case \'tab\'`（`engine.g.selectedTab` 設定 → `engine.save()` → `render()`）。D UI 側のボタンは index.html の `data-d-ui-nav-proxy` が元のタブボタンの click に中継する。結果に影響するか（全行共通）: 画面遷移のみ（`selectedTab` のみ変化。業務状態は不変）。\n')
    out.append('| 表示名 | 遷移先タブ | 出現数 |')
    out.append('|---|---|---|')
    for (l,t),n in nav.items():
        out.append(f'| {l} | {t} | {n} |')
    out.append('')
    byTab=collections.OrderedDict()
    for r in rows:byTab.setdefault(r['tab'],[]).append(r)
    for tab,rs in byTab.items():
        out.append(f'### タブ: {tab}（{TABNAME.get(tab,tab)}）\n')
        out.append('| 種別 | 表示名 | サブタブ | 呼ぶ関数 | 結果に影響するか | 同種の件数 |')
        out.append('|---|---|---|---|---|---|')
        groups=collections.OrderedDict()
        for r in rs:
            if r['tag']=='button' and ('tab=' in r['ds'] and not r['action'] or r['action']=='tab'):continue
            if r['tag'] not in('button','input','select','textarea') and not r['action']:continue
            norm=re.sub(r'[0-9,.%¥円万億週件人店個x×]+','#',r['label'])
            key=(r['tag'],r['action'],norm,r['sub'] if r['tag']=='button' else '',r['eid'] or r['name'])
            g=groups.setdefault(key,{'r':r,'n':0,'m':None})
            g['n']+=1
            if r.get('measure') and g['m'] is None and r['measure'].get('found') is not None and not r.get('dup'):g['m']=r
        for key,g in groups.items():
            r=g['r'];mr=g['m'] or r
            if r['tag']=='button' or r['action']:
                kind='ボタン' if r['tag']=='button' else f'クリック要素({r["tag"]})'
                r_action_holder[0]=mr['action'];eff=effect(mr.get('measure'))
                fn=fnlabel(mr)
            else:
                kind={'input':'入力','select':'選択','textarea':'テキスト入力'}[r['tag']]
                eff='（入力欄。値は押下する操作の関数が読む）' 
                idn=r['eid'] or r['name']
                where=''
                if idn:
                    hits=[]
                    for fn_,lines in jsfiles.items():
                        for i,l in enumerate(lines,1):
                            if re.search(r"""(?:#|getElementById\(['"]|id=['"]|name=['"]|\[name=['"]|get\(['"])"""+re.escape(idn)+r"""['"\]]?""",l):hits.append(f'js/{fn_}.js:{i}')
                    where='参照: '+', '.join(hits[:3]) if hits else ''
                fn=(f'id/name=`{idn}` ' if idn else '（id/nameなし） ')+where+(f' / data: {r["ds"][:40]}' if r['ds'] else '')
            out.append(f'| {kind} | {label(r)} | {(r["sub"] or "—").replace("|","／")} | {fn.replace("|","／")} | {eff} | {g["n"]} |')
        out.append('')
build_d=build('crawl_d*.jsonl','d');build_u=build('crawl_u*.jsonl','u')
def count(rows):
    c=collections.Counter()
    for r in rows:
        if r['tag']=='button' and 'tab=' in r['ds'] and not r['action']:continue
        if r['tag']=='button' or r['action']:c['ボタン(全要素)']+=1
        elif r['tag'] in('input','select','textarea'):c['入力']+=1
    return c
cd,cu=count(build_d),count(build_u)
head=[]
head.append('# 作業3：画面の操作一覧（全ボタン・入力）\n')
head.append(f'- 基準: `main` @ `{sha}`。調査のみ。')
head.append('- **測定方法**: Chromium(Playwright)で実起動し、新規ゲームを30週進めて「会社資金1,000億円・個人資金100億円」を与えた状態（会計の整合は崩さず `g` を直接設定しただけなので、次の週進行は行わない）を基準にし、各タブ（19タブ＋サブタブ）の全ボタンを**1種類につき1回**押して、(1) `engine.g` のトップレベルの変化（JSON比較）、(2) 出たモーダル/トースト、(3) 呼ばれた Engine メソッド、を記録した。押すたびに基準状態へ巻き戻した。金額入力モーダル（`askMoney`/`askText`）は既定値のまま「実行」を押した。')
head.append('- **「結果に影響するか」の凡例**: 〇=業務状態が変化（変化したトップレベルキーを列挙）／ △=確認・入力画面を開くだけ ／ ×=変化なし（トーストの理由を併記。資金不足・前提未達など）／ 画面遷移のみ=`selectedTab` 等の選択だけ変化。')
head.append('- **限界（正直に）**: (a) × は「その基準状態で無効だった」ことを示すだけで、機能が壊れているとは限らない（例: 売却ボタンは保有物がないと変化しない）。(b) 同じ種類のボタン（株銘柄ごとの「買う」等）は1件だけ押し、件数を右端に記録した。(c) 未実行: `tab`（遷移）・`advance-week`/`advance-4`（週送り。別途 156 週で確認済み）・`reset-game`/`confirm-reset`/`company-buyout`/`confirm-buyout`/`accept-inbound`（不可逆）・`export-save`/`import-save`/`restore-stored-save`（ファイル操作）・`close-modal`。(d) 「呼ぶ関数」の `観測:` は押下前後で実行回数が増えた Engine メソッド（上位5件）。`data-action` を持たない enhancer 系ボタンは `data-*` 属性名から生成箇所・処理箇所を grep で引いた。(e) `?ui=3` は同じ手順で別途測定（下の第2部）。ui3 の金額シートは確定ボタンの検出に失敗したものがあり、その場合は △ とした。')
head.append(f'- 測定数: 既定UI ボタン要素 {cd["ボタン(全要素)"]}（うち種類ごとに1回押下）・入力欄 {cd["入力"]}／?ui=3 ボタン要素 {cu["ボタン(全要素)"]}・入力欄 {cu["入力"]}。')
head.append('')
out_head='\n'.join(head)
section('d',build_d,'第1部：既定UI（D UI。本番の既定URL）')
section('u',build_u,'第2部：?ui=3（UI v3。`?ui=3` を付けたときだけ有効）')
open('docs/inventory/ui-actions.md','w',encoding='utf-8').write(out_head+'\n'+'\n'.join(out)+'\n')
print(len(out))
