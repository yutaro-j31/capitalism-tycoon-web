'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','js');
const files=fs.readdirSync(root).filter(name=>name.endsWith('.js')).sort();
const rows=[];
for(const file of files){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const re=/(?:\b(?:p|proto|prototype)\.|\b(?:EngineClass|Engine|TycoonEngine)\.prototype\.)([A-Za-z_$][\w$]*)\s*=\s*function\b/g;
  let match;
  while((match=re.exec(source))){
    const method=match[1],before=source.slice(Math.max(0,match.index-1200),match.index),after=source.slice(match.index,Math.min(source.length,match.index+1200));
    const escaped=method.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const saved=new RegExp(`(?:const|let|var)\\s+[A-Za-z_$][\\w$]*\\s*=\\s*(?:p|proto|prototype|(?:EngineClass|Engine|TycoonEngine)\\.prototype)\\.${escaped}\\b`).test(before);
    const delegates=saved&&new RegExp(`(?:call|apply)\\(this`).test(after);
    rows.push({file,method,index:match.index,saved,delegates,suspect:!saved||!delegates});
  }
}
const suspects=rows.filter(row=>row.suspect);
console.log(`ENGINE_PROTOTYPE_OVERWRITE_AUDIT ${JSON.stringify({total:rows.length,suspects})}`);
fs.mkdirSync(path.resolve(__dirname,'..','artifacts'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'..','artifacts','prototype-overwrite-audit.json'),JSON.stringify({rows,suspects},null,2)+'\n');
console.log(`prototype overwrite audit completed: ${rows.length} overrides, ${suspects.length} suspects`);
