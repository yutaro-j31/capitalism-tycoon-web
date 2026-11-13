import json,re,glob,os,sys
S=(os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
d=json.load(open(S+sys.argv[1] if len(sys.argv)>1 else S+'g104.json'))
fields=d['gk']
BOOK={'save-v9','save-storage','save-storage-idb','semantic-hash-v2','save-import-atomic-guard'}
files={os.path.basename(f)[:-3]:open(f,encoding='utf-8').read().split('\n') for f in glob.glob('js/*.js')}
# also inline scripts in index.html ignored
assign=r'\s*(?:=(?!=)|\+=|-=|\*=|/=|%=|\|\|=|&&=|\?\?=|\+\+|--)'
out={}
for f in fields:
    ident=r'(?<![A-Za-z0-9_$])'+re.escape(f)+r'(?![A-Za-z0-9_$])'
    ids=re.compile(ident)
    wa=re.compile(r'(?:\.|\?\.)'+re.escape(f)+r'(?![A-Za-z0-9_$])'+assign)
    wa2=re.compile(r'\[[\'"]'+re.escape(f)+r'[\'"]\]'+assign)
    wm=re.compile(r'(?:\.|\?\.)'+re.escape(f)+r'(?:\?\.|\.)(?:push|unshift|splice|pop|shift|sort|reverse|fill|set|delete|add|clear)\(')
    delp=re.compile(r'delete\s+[\w$.?\[\]\'"]*\.'+re.escape(f)+r'(?![A-Za-z0-9_$])')
    lit=re.compile(r'(?<![A-Za-z0-9_$.])'+re.escape(f)+r'\s*:(?!:)')
    mem=re.compile(r'(?:\.|\?\.)'+re.escape(f)+r'(?![A-Za-z0-9_$])|\[[\'"]'+re.escape(f)+r'[\'"]\]')
    W=[];R=[];L=[];RB=[];C=[];SS=[];V=[];other=[]
    for fn,lines in files.items():
        for i,l in enumerate(lines,1):
            st=l.strip()
            if st.startswith('//') or st.startswith('*'):continue
            if not ids.search(l):continue
            kinds=set();wpos=[]
            for m in ids.finditer(l):
                pos=m.start();end=m.end()
                before=l[max(0,pos-70):pos];after=l[end:end+60]
                ismem=bool(re.search(r'(?:\.|\?\.|\[[\'"])$',before))
                if ismem:
                    # write forms
                    if re.match(r'[\'"]?\]?'+assign,after) or re.match(r'(?:\?\.|\.)(?:push|unshift|splice|pop|shift|sort|reverse|fill|set|delete|add|clear)\(',after):
                        kinds.add('W');wpos.append(pos)
                        # self-update read on rhs handled by occurrence loop (other occurrences)
                        continue
                    if re.search(r'delete\s+[\w$.?\[\]\'"]*[.?]$',before):kinds.add('W');continue
                    # propagation: key: x.f  OR  y.f = x.f
                    if re.search(r'(?:^|[,{;(\s])'+re.escape(f)+r'\s*:\s*(?:[A-Za-z0-9_$]+\()?\s*[A-Za-z0-9_$.?\[\]\'"]*[.?]$',before) and re.match(r'[\'"]?\]?\s*(?:[,}\)]|\|\||\?\?|$)',after):
                        kinds.add('C');continue
                    if re.search(r'[.?]'+re.escape(f)+r'\s*=\s*(?:[A-Za-z0-9_$]+\()?\s*[A-Za-z0-9_$.?\[\]\'"]*[.?]$',before) and re.match(r'[\'"]?\]?\s*(?:[,;\)}]|\|\||\?\?|$)',after):
                        kinds.add('C');continue
                    pw=[x for x in wpos if x<pos]
                    if pw and not re.search(r'[;{}]',l[pw[-1]:pos]):kinds.add('S');continue
                    kinds.add('R');continue
                # not member: object-literal key?
                if re.match(r'\s*:(?!:)',after) and re.search(r'(?:^|[,{(\s])$',before):kinds.add('L');continue
                kinds.add('O')
            if 'W' in kinds:W.append((fn,i))
            if 'R' in kinds:
                if fn in BOOK:RB.append((fn,i))
                elif re.search(r'function validate|errors\.push\(|[^A-Za-z]e\.push\(',l):V.append((fn,i))
                else:R.append((fn,i))
            if 'C' in kinds:C.append((fn,i))
            if 'S' in kinds:SS.append((fn,i))
            if 'L' in kinds:L.append((fn,i))
            if 'O' in kinds:other.append((fn,i))
    out[f]={'W':W,'R':R,'RB':RB,'C':C,'S':SS,'V':V,'L':L,'O':other}
json.dump(out,open(S+'fields_static.json','w'))
print(len(out))
