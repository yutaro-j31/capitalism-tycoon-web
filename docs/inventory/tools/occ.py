import re,glob,os,sys,json
S=(os.environ.get('INVENTORY_WORK','work').rstrip('/')+'/')
files={os.path.basename(f)[:-3]:open(f,encoding='utf-8').read().split('\n') for f in glob.glob('js/*.js')}
tests=0
def occ(f,w=55):
    ids=re.compile(r'(?<![A-Za-z0-9_$])'+re.escape(f)+r'(?![A-Za-z0-9_$])')
    out=[]
    for fn,lines in files.items():
        for i,l in enumerate(lines,1):
            for m in ids.finditer(l):
                out.append(f'{fn}.js:{i}: …{l[max(0,m.start()-w):m.end()+w].strip()}…')
    return out
if __name__=='__main__':
    for f in sys.argv[1:]:
        o=occ(f)
        print('##',f,len(o))
        for x in o[:7]:print('  ',x)
