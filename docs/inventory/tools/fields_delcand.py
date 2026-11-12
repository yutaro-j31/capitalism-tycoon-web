# -*- coding: utf-8 -*-
import os, json, glob, re
S = os.environ.get('INVENTORY_WORK', 'work').rstrip('/') + '/'
rows = json.load(open(S + 'fields_rows.json'))
sh = open('js/semantic-hash-v2.js', encoding='utf-8').read()
root = set(re.findall(r"'([A-Za-z0-9_]+)'", re.search(r'const ROOT_KEYS=Object\.freeze\(\[(.*?)\]\);', sh, re.S).group(1)))
fxt = {f: open(f, encoding='utf-8', errors='ignore').read() for f in glob.glob('tests/fixtures/**/*', recursive=True) if os.path.isfile(f) and os.path.getsize(f) < 20_000_000}
tst = {f: open(f, encoding='utf-8', errors='ignore').read() for f in glob.glob('tests/*.js')}
out = {}
for r in rows:
    if r[5].startswith('稼働'): continue
    k = r[0]; pat = re.compile(r'(?<![A-Za-z0-9_$])' + re.escape(k) + r'(?![A-Za-z0-9_$])')
    out[k] = {'hash': k in root, 'fixtures': [os.path.basename(f) for f, t in fxt.items() if pat.search(t)], 'tests': sum(1 for t in tst.values() if pat.search(t)), 'state': r[5]}
json.dump(out, open(S + 'field_delcand.json', 'w'), ensure_ascii=False)
