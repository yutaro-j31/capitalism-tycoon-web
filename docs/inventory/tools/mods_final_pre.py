import json,re,glob,os,collections
S=(os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
runs=['D156.json','U52.json','R60.json','R80.json','RU30.json','P30.json']
obs={}
for f in runs:
    j=json.load(open(S+f))
    for t,a in j.get('attrsByTab',{}).items():
        for x in a:obs.setdefault(x,set()).add(f[:3]+':'+t)
order=re.findall(r'src="\./js/([a-z0-9-]+)\.js',open('index.html').read())
def camel2attr(s):return 'data-'+re.sub(r'([A-Z])',lambda m:'-'+m.group(1).lower(),s)
GEN={'data-action','data-id','data-kind','data-tab','data-screen'}
files={n:open(f'js/{n}.js',encoding='utf-8').read() for n in order}
toks={}
for n,t in files.items():
    s=set(re.findall(r'data-[a-z0-9]+(?:-[a-z0-9]+)*',t))
    for m in re.finditer(r'dataset\.([a-zA-Z0-9]+)',t):s.add(camel2attr(m.group(1)))
    toks[n]=s-GEN
freq=collections.Counter()
for s in toks.values():
    for x in s:freq[x]+=1
hit={n:{x:sorted(obs[x])[:2] for x in s if x in obs and freq[x]<=3} for n,s in toks.items()}
json.dump(hit,open(S+'dom_hit3.json','w'))
print(sum(1 for v in hit.values() if v))
