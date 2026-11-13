# -*- coding: utf-8 -*-
import json,glob,re,subprocess,os
S=(os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
res=json.load(open(S+'fields_res.json'));st=json.load(open(S+'fields_static.json'))
D=json.load(open(S+'D156.json'))
gk=D['gk']
# semantic hash ROOT_KEYS membership
sh=open('js/semantic-hash-v2.js',encoding='utf-8').read()
m=re.search(r'const ROOT_KEYS=Object\.freeze\(\[(.*?)\]\);',sh,re.S)
root=set(re.findall(r"'([A-Za-z0-9_]+)'",m.group(1)))
rootline={}
for i,l in enumerate(sh.split('\n'),1):
    for k in re.findall(r"'([A-Za-z0-9_]+)'",l):
        if k in root and k not in rootline and i<30:rootline[k]=i
# engine createInitialState / ensure*Defaults line (initial value definition)
def loc(t):return f'js/{t[0]}.js:{t[1]}'
SAVE_TRUNC={'reports','weeklySalesHistory','weeklyProfitHistory','companyValueHistory','personalNetWorthHistory','news','history','properties','market','startups','finance'}
OV={
 'realizedCompanyStockPL':('値だけ','書込は計算キー経由 js/engine.js:1509（`this.g[account===\'company\'?\'realizedCompanyStockPL\':\'realizedPersonalStockPL\']+=profit`）。読み手なし'),
 'selectedArea':('初期値のみ','書込なし（初期値 js/engine.js:283 のみ）。management-context.js:254 が `selectedArea:state?.selectedArea` を別オブジェクトへ複製するだけで、その複製の読み手もなし'),
 'personalFame':('値だけ','js/expansion.js:340,715・completion.js:249・engine.js:1743 が加算。読み手なし（決定論ハッシュ semantic-hash-v2.js:17 のみ）'),
}
rows=[];cnt={'稼働':0,'値だけ':0,'初期値のみ':0}
nonact=[]
for k in gk:
    v=res[k];s=st[k];c=v['static']
    rr=bool(v['dr']) or c['R']>0
    wr=c['W']>0 or bool(v['dw']) or v['changed']
    note=''
    if re.match(r'^next[A-Za-z0-9]+Seq$',k):
        state='稼働';note='ID採番カウンタ（`++` の値で新規IDを生成）'
    elif k in OV:
        state,note=OV[k]
    elif rr:state='稼働'
    elif wr:state='値だけ'
    else:state='初期値のみ'
    # write places
    W=[loc(x) for x in s['W'][:3]]
    wtxt=', '.join(W)+(f' ほか{len(s["W"])-3}件' if len(s['W'])>3 else '')
    if not W:
        Ls=sorted(s['L'],key=lambda t:(t[0] not in ('engine','expansion','completion','parity'),t[0]));init=[loc(x) for x in Ls[:1]]
        dw=[x for x in sorted(v['dw']) if 'native' not in x][:2]
        wtxt='初期値のみ: '+', '.join(init) if init else '—'
        if dw:wtxt+=' / 動的: '+', '.join(dw)
    elif s['L']:
        wtxt+=f' ／初期値 {loc(sorted(s["L"],key=lambda t:(t[0] not in ("engine","expansion","completion","parity"),t[0]))[0])}'
    # read places
    R=[loc(x) for x in s['R'][:3]]
    rtxt=', '.join(R)+(f' ほか{len(s["R"])-3}件' if len(s['R'])>3 else '')
    if not R:
        dr=sorted(v['dr'],key=lambda x:-v['dr'][x])[:2]
        rtxt=('動的: '+', '.join(dr)) if dr else '—'
    extra=[]
    if s['V']:extra.append('検証のみ '+loc(s['V'][0]))
    if s['C']:extra.append('複製のみ '+loc(s['C'][0]))
    if k in root:extra.append(f'ハッシュ semantic-hash-v2.js:{rootline.get(k,"?")}')
    if s['RB']:extra.append('保存/ハッシュ '+loc(s['RB'][0]))
    if extra:
        rtxt=('—（'+' / '.join(extra)+'）') if rtxt=='—' else rtxt+' ／ '+' / '.join(extra)
    if note:rtxt=(rtxt+' ／ '+note) if not rtxt.startswith('—') else rtxt+' ／ '+note
    tier=('動' if v['dr'] else '静') if state=='稼働' else ''
    save='〇（長さ切詰あり: js/save-storage.js:115-129）' if k in SAVE_TRUNC else '〇'
    rows.append((k,v['type'],wtxt,rtxt,save,state+(f'({tier})' if tier else '')))
    cnt[state]+=1
json.dump(rows,open(S+'fields_rows.json','w'),ensure_ascii=False)
print(cnt,len(rows))
sha=subprocess.check_output(['git','rev-parse','--short','main'],text=True).strip()
o=[]
o.append('# 作業2：状態フィールド一覧（ゲーム状態 g の全トップレベルフィールド）\n')
o.append(f'- 基準: `main` @ `{sha}`。調査のみ。対象は新規ゲーム開始後 156 週進めた時点の `engine.g` のトップレベルキー **{len(gk)}個**（新規開始直後は424個、週次処理で12個増える）。')
o.append(f'- 件数: 稼働 {cnt["稼働"]} / 値だけ {cnt["値だけ"]} / 初期値のみ {cnt["初期値のみ"]}（書込も読込もなく初期値だけ存在）')
o.append('- **セーブ**: すべて 〇。`engine.save()` は `JSON.stringify(this.g)`（`js/engine.js` の `save(slot)`）、永続化は `js/save-storage.js` の `compactStateForStorage` が `structuredClone` した全体を保存し、一部の履歴配列のみ長さを切り詰める（js/save-storage.js:115-129）。除外されるトップレベルキーはなし（`saveSequence` のみ `js/save-v9.js:85` で削除されるが、g のキーには存在しない）。')
o.append('')
o.append('## 判定方法\n')
o.append('1. **静的**: `js/*.js` の全出現を、書込（代入・`++`・`.push` 等）／読込／オブジェクトリテラルの初期値／複製（`key: x.key`・`a.key=b.key` の同名コピー）／自己更新（`g.k=clamp(g.k+…)` の右辺）／保存・ハッシュ・検証（`semantic-hash-v2.js`・`save-*.js`・`validate`/`errors.push`）に分類。**複製・自己更新・保存・ハッシュ・検証は「読まれている」に数えない**。')
o.append('2. **動的**: `g` を Proxy で包んで 156 週（既定UI）・52 週（`?ui=3`）を実行し、各フィールドへの読込/書込の呼出元関数をスタックから記録。`JSON.stringify`・トランザクション snapshot・`ensure*`/`normalize*`/`validate*`・`semanticProjection`・`structuredClone` 経由の読込は除外。')
o.append('3. 判定: 実読込がある=**稼働**（`(動)`=実行で観測、`(静)`=コード上のみ）／書込はあるが実読込なし=**値だけ**／書込も読込もない=**初期値のみ**。`next*Seq` は `++` の戻り値で ID を作る採番カウンタなので稼働とした。')
o.append('4. **限界**: 動的キーアクセス（`g[key]`）は `js/engine.js:378-444` などの正規化ループ（全配列を走査して整形するだけ）にしか確認できず、これは読み手に数えていない。ファイル内の長い1行に複数の代入がある箇所は行単位の近似。`値だけ`/`初期値のみ` と判定した全フィールドは出現箇所を目視で確認済み（下表の根拠列の行を参照）。')
o.append('')
o.append('## 前例（PR #397・#542）の現状\n')
o.append('| フィールド | 現状 | 根拠 |')
o.append('|---|---|---|')
o.append('| `founderEnergy` / `founderFocus` / `founderHealth` | **フィールドごと削除済み**（g に存在しない）。`js/` に出現0。tests/ に2ファイルが旧名を残す | PR #542（`5ba87241`）。`grep -l founderHealth js/*.js` → 0件 |')
o.append('| `founderEducationLevel` | **まだ値だけ**（書込: expansion.js:330-332,703,795／読込なし。複製 completion.js:211-212） | 下表 |')
o.append('| `lobbyInfluence` | **まだ値だけ**（書込: expansion.js:703／読込なし。複製 completion.js:211） | 下表 |')
o.append('| `founderNetworkLevel` | **読まれるようになった**（engine.js:2615 でVC案件発生確率に使用） | 下表 |')
o.append('')
o.append('## 値だけ・初期値のみ（削除候補の一次リスト）\n')
o.append('「削除候補」でも **セーブ互換には影響する**（すべて saveVersion=9 の保存データに含まれる）。詳細は README.md の分類を参照。\n')
o.append('| フィールド | 型 | 状態 | 書き込む場所 | 読む場所 |')
o.append('|---|---|---|---|---|')
for r in rows:
    if not r[5].startswith('稼働'):
        o.append(f'| `{r[0]}` | {r[1]} | {r[5]} | {r[2]} | {r[3]} |'.replace('\n',' '))
o.append('')
o.append('## 全フィールド\n')
o.append('| フィールド名 | 型 | 書き込む場所 | 読む場所 | セーブに含まれるか | 状態 |')
o.append('|---|---|---|---|---|---|')
for r in rows:
    o.append(('| `%s` | %s | %s | %s | %s | %s |'%r).replace('\n',' '))
o.append('')
open('docs/inventory/state-fields.md','w',encoding='utf-8').write('\n'.join(o))
