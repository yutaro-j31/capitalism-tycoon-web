import json,re,sys,os,glob
S=(os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
runs=[json.load(open(S+f))['h'] for f in sys.argv[1:]]
sk=json.load(open(S+'script_keys.json'));sc=json.load(open(S+'static_cons.json'))
order=re.findall(r'src="\./js/([a-z0-9-]+)\.js',open('index.html').read())
def agg(field):
    o={}
    for h in runs:
        for k,v in h.get(field,{}).items():
            if isinstance(v,int):o[k]=o.get(k,0)+v
            else:
                e=o.setdefault(k,{'n':0,'by':{}});e['n']+=v['n']
                for c,n in v['by'].items():e['by'][c]=e['by'].get(c,0)+n
    return o
calls=agg('calls');reads=agg('reads');pw=agg('protoWrapCalls')
enh={}
for h in runs:
    for k,v in h.get('enhRun',{}).items():
        e=enh.setdefault(k,{'n':0,'mut':0,'caller':v['caller']});e['n']+=v['n'];e['mut']+=v['mut']
info={}
for n in order:
    keys=sk[n]['keys'];proto=[p for p in sk[n]['proto'] if not p.startswith('__')]
    pc={p:pw.get(f'{n}::{p.replace("(accessor)","")}',0) for p in proto}
    ec=0;er=0
    for k in keys:
        for key,v in calls.items():
            if key.startswith(k+'.'):
                ec+=sum(c for who,c in v['by'].items() if who!=n)
        for key,v in reads.items():
            if key.startswith(k+'.'):
                er+=sum(c for who,c in v['by'].items() if who!=n)
    ens={i:e for i,e in enh.items() if e['caller']==n or i==n or i.startswith(n+'-')}
    info[n]={'keys':keys,'proto':proto,'pcalls':pc,'ext_calls':ec,'ext_reads':er,'enh':ens,'cons':list(sc[n]['cons'].keys()),'tests':sc[n]['tests']}
json.dump(info,open(S+'mod_info.json','w'),ensure_ascii=False)
# quick summary
cnt={}
for n,i in info.items():
    dyn=sum(i['pcalls'].values())>0 or i['ext_calls']>0 or any(e['mut']>0 for e in i['enh'].values())
    cnt[n]=dyn
print(sum(cnt.values()),'dyn-active of',len(cnt))
print([n for n,v in cnt.items() if not v])
