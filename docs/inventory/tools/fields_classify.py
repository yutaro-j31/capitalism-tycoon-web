import json,re
S=(os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
D=json.load(open(S+'D156.json'));U=json.load(open(S+'U52.json'))
st=json.load(open(S+'fields_static.json'))
BK=re.compile(r'^(JSON\.stringify|eval|\?|.*runTransaction.*|shadowWithout.*|semantic.*|.*[eE]nsure.*|.*Defaults.*|sanitize.*|normalize.*|.*[Nn]ormalize.*|migrate.*|validate.*|.*Proxy\.validate.*|previewStateFor|clone.*|deepClone.*|createInitialState|mergeDefaults|structuredClone|.*stringify.*)$')
def first(sg):
    fr=sg.split(' < ')
    if fr and fr[0].startswith('Object.'):fr=fr[1:]
    return fr[0] if fr else ''
def real(tbl,k):
    out={}
    for sg,n in (tbl.get(k) or {'s':{}})['s'].items():
        f=first(sg)
        if f.startswith('eval@'):continue
        name=f.split('@')[0]
        if BK.match(name.split('.')[-1]) or BK.match(name):continue
        out[f]=out.get(f,0)+n
    return out
res={}
for k in D['gk']:
    rr={};ww={}
    for X in (D,U):
        for f,n in real(X['gt']['reads'],k).items():rr[f]=rr.get(f,0)+n
        for f,n in real(X['gt']['writes'],k).items():ww[f]=ww.get(f,0)+n
    s=st[k]
    res[k]={'dr':rr,'dw':ww,'changed':k in D['changed'],'static':{a:len(b) for a,b in s.items()},'type':D['types'].get(k),'size':D['sizes'].get(k)}
json.dump(res,open(S+'fields_res.json','w'),ensure_ascii=False)
cnt={'act':0,'val':0,'init':0}
cand=[]
for k,v in res.items():
    s=v['static']
    real_read=bool(v['dr']) or s['R']>0
    writer=s['W']>0 or bool(v['dw']) or v['changed']
    v['rr']=real_read;v['wr']=writer
    if real_read:cnt['act']+=1
    else:
        cand.append((k,v))
        cnt['val' if writer else 'init']+=1
print(cnt)
for k,v in cand:
    print(k,v['type'],'W',v['static']['W'],'C',v['static']['C'],'S',v['static']['S'],'RB',v['static']['RB'],'L',v['static']['L'],'O',v['static']['O'],'dw',len(v['dw']),'chg',v['changed'])
