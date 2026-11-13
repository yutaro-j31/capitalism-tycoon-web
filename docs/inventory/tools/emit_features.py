# -*- coding: utf-8 -*-
import os
import json,glob,re,subprocess
S=(os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
rows=json.load(open(S+'features_rows.json'))
cnt={}
for r in rows:cnt[r[2]]=cnt.get(r[2],0)+1
sha=subprocess.check_output(['git','rev-parse','--short','main'],text=True).strip()
o=[]
o.append('# 作業1：機能一覧（index.html が読み込む全モジュール）\n')
o.append(f'- 基準: `main` @ `{sha}`（2026-11-12 時点）。調査のみ。コードは一切変更していない。')
o.append('- 対象: `index.html` の `<script src="./js/...">` **245本**（依頼文の「約170本」より多い。`ls js | wc -l` も 245 で、全ファイルが読み込まれている。`index.html:` の `data-module-integration-loader` コメントのとおり動的読込はない）。')
o.append('- 並び順は `index.html` の読込順。')
o.append(f'- 件数: 稼働 {cnt.get("稼働",0)} / 値だけ {cnt.get("値だけ",0)} / 未接続 {cnt.get("未接続",0)} / 不明 {cnt.get("不明",0)}（計 {len(rows)}）\n')
o.append('## 判定方法（根拠の読み方）\n')
o.append('1. **実起動の計測**: Chromium(Playwright)で `index.html` を実際に起動し、新規ゲームを開始して 156 週（既定UI）／52 週（`?ui=3`）進め、全タブを巡回した。登録簿 `__capitalismTycoonModules` を Proxy で包み、(a) 各モジュールの関数が他ファイルから何回呼ばれたか、(b) `Engine.prototype` を差し替えたメソッドが何回実行されたか、(c) UI enhancer が何回走り DOM を何件変えたか、(d) DOM に出た固有の `data-*` 属性、を記録した。さらに「不動産6件・個人不動産3件・本社・部門・VC投資・株式・PE案件など資産を持たせた状態」でも同じ計測を行った。')
o.append('2. **静的調査**: `js/` 内の参照元 grep（テストは参照元に数えない）。')
o.append('3. 根拠欄の接頭辞: `[動的]` = 実起動で観測 / `[静的]` = コード参照のみ（動的には未発火）/ `[要判断]` = 結論を出していない / `[静的+動的]` = 両方。末尾の `（登録 js/X.js:N）` はそのモジュールが登録簿へ書く行。')
o.append('4. 状態の使い方（依頼の定義どおり）: **稼働**=本番起動経路から呼ばれ画面または計算結果に影響 / **値だけ**=状態を書くがどこからも読まれない（または出力が到達不能な画面にしか出ない）/ **未接続**=定義はあるが本番起動経路から呼ばれない / **不明**=判断できない（理由を記載）。')
o.append('5. **限界（正直に）**: 「条件付き」機能（上場後・子会社保有後・資金危機時・賃貸契約成立後）は、計測用に作れた状態の範囲では発火しなかった。これらは未接続と断定せず `不明` にした（理由を各行に記載）。「稼働」のうち根拠が `[静的]` のものは、コード上の参照があるだけで実行は観測していない。\n')
o.append('| # | モジュール名 | 担当機能 | 状態 | 根拠 |')
o.append('|---|---|---|---|---|')
for i,(n,d,s,b) in enumerate(rows,1):
    b=b.replace('|','\\|')
    o.append(f'| {i} | `{n}` | {d} | {s} | {b} |')
o.append('')
open('docs/inventory/features.md','w',encoding='utf-8').write('\n'.join(o))
print(len(o))
