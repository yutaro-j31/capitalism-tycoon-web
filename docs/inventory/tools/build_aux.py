# -*- coding: utf-8 -*-
"""Build the auxiliary JSON tables the other scripts read.
Run from the repository root after harness.js/crawl.js produced D156.json etc. in $INVENTORY_WORK.
  INVENTORY_WORK=work python3 docs/inventory/tools/build_aux.py
"""
import json, re, glob, os, subprocess
S = os.environ.get('INVENTORY_WORK', 'work').rstrip('/') + '/'
order = re.findall(r'src="\./js/([a-z0-9-]+)\.js', open('index.html').read())
D = json.load(open(S + 'D156.json'))
h = D['h']
# 1. which registry keys / Engine.prototype members each script added
m = {}; prev = 0
for s in h['snaps']:
    keys = h['sets'][prev:s['setIdx']]; prev = s['setIdx']
    m[s['name']] = {'keys': keys, 'proto': s['changed']}
json.dump(m, open(S + 'script_keys.json', 'w'), ensure_ascii=False)
# 2. static consumers (js/ only; tests counted separately)
js = {os.path.basename(f)[:-3]: open(f, encoding='utf-8').read() for f in glob.glob('js/*.js')}
tests = {}
for f in glob.glob('tests/**/*', recursive=True):
    if os.path.isfile(f) and f.endswith(('.js', '.cjs', '.mjs', '.html')):
        try: tests[f] = open(f, encoding='utf-8').read()
        except Exception: pass
res = {}
for n in order:
    keys = m[n]['keys']; cons = {}
    for k in keys:
        pat = re.compile(r'(?<![A-Za-z0-9_$])' + re.escape(k) + r'(?![A-Za-z0-9_$])')
        for m2, src in js.items():
            if m2 != n and pat.search(src): cons.setdefault(m2, []).append(k)
    tref = [f for f, src in tests.items() if (n + '.js') in src or any(re.search(r'(?<![A-Za-z0-9_$])' + re.escape(k) + r'(?![A-Za-z0-9_$])', src) for k in keys)]
    res[n] = {'keys': keys, 'cons': cons, 'tests': len(tref), 'testfiles': tref[:3]}
json.dump(res, open(S + 'static_cons.json', 'w'), ensure_ascii=False)
# 3. per-script executed-call table (who called which registry function)
runs = ['D156.json', 'U52.json', 'R60.json', 'R80.json', 'RU30.json', 'P30.json']
selfx = {}
for f in runs:
    if not os.path.exists(S + f): continue
    for k, v in json.load(open(S + f))['h']['calls'].items():
        for who, c in v['by'].items():
            selfx.setdefault(who, {}).setdefault(k, 0); selfx[who][k] += c
json.dump(selfx, open(S + 'self_exec.json', 'w'))
# 4. action() switch table in js/app.js
src = open('js/app.js', encoding='utf-8').read()
start = src.index('function action(name,el)'); body = src[start:]; lb = src[:start].count('\n') + 1
cases = [(mm.start(), mm.group(1)) for mm in re.finditer(r"case '([a-zA-Z0-9_-]+)':", body)]
out = {}
for i, (pos, name) in enumerate(cases):
    end = cases[i + 1][0] if i + 1 < len(cases) else pos + 600
    seg = body[pos:end]; ln = lb + body[:pos].count('\n'); fns = []
    for mm in re.finditer(r"(?:engine|this)\.([A-Za-z0-9_]+)\??\.?\(", seg): fns.append('engine.' + mm.group(1))
    for mm in re.finditer(r"(?:supplyModule|workforceModule|financeModule|marketModule|completionModule|expansionModule|dashboardModule|secretaryModule|foundingTutorialModule)\.([A-Za-z0-9_]+)\(", seg): fns.append(mm.group(0)[:-1])
    for mm in re.finditer(r"__capitalismTycoonModules\??\.([A-Za-z0-9_]+)\??\.([A-Za-z0-9_]+)", seg): fns.append(mm.group(1) + '.' + mm.group(2))
    for mm in re.finditer(r"(?:ops|__modules\.[A-Za-z0-9_]+|pePortfolioOperations)\?*\.([A-Za-z]+)\(", seg): fns.append('ops.' + mm.group(1))
    for mm in re.finditer(r"\b(confirm[A-Za-z]+|ask(?:Money|Text)|modal|showWeeklySummary|captureFounderWealthBreakdown|exportSaveFile)\(", seg): fns.append(mm.group(1))
    seen = []; [seen.append(x) for x in fns if x not in seen]
    out.setdefault(name, []).append({'line': ln, 'fns': seen[:6]})
json.dump(out, open(S + 'action_cases.json', 'w'), ensure_ascii=False)
# 5. docs table (git last-commit date per file)
files = [f for f in subprocess.check_output(['git', 'ls-files', '*.md', '*.txt'], text=True).split('\n') if f]
log = subprocess.check_output(['git', 'log', '--format=@@%cs', '--name-only', '--diff-filter=AMR'], text=True)
last = {}; cur = None
for l in log.split('\n'):
    if l.startswith('@@'): cur = l[2:]
    elif l and l not in last: last[l] = cur
rows = []
for f in files:
    try: t = open(f, encoding='utf-8').read()
    except Exception: continue
    lines = t.split('\n')
    title = next((l.lstrip('# ').strip() for l in lines if l.startswith('#')), '')
    rows.append({'f': f, 'title': title, 'status': [], 'first': '', 'date': last.get(f, '?'), 'lines': len(lines)})
json.dump(rows, open(S + 'docs.json', 'w'), ensure_ascii=False)
print('aux tables written to', S)
