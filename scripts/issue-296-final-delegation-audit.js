'use strict';
const fs=require('node:fs');
const methods=['advanceWeek','updateSubsidiaries','completeTargetAcquisition','normalize'];
const html=fs.readFileSync('index.html','utf8');
const files=[...html.matchAll(/<script src=["']\.\/(js\/[^"']+)["']><\/script>/g)].map(m=>m[1]);
for(const method of methods){
  console.log(`\n=== ${method} ===`);
  for(const [order,file] of files.entries()){
    const source=fs.readFileSync(file,'utf8');
    if(!source.includes(method))continue;
    const lines=source.split(/\r?\n/);
    const hit=lines.findIndex(line=>line.includes(method)&&(/prototype|proto\.|^[ ]*update|^[ ]*normalize|^[ ]*advance/.test(line)));
    if(hit<0)continue;
    const start=Math.max(0,hit-12),end=Math.min(lines.length,hit+30);
    console.log(`\n[${order}] ${file}`);
    console.log(lines.slice(start,end).map((line,i)=>`${start+i+1}: ${line}`).join('\n'));
  }
}
