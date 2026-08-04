'use strict';
const fs=require('node:fs');
const path=require('node:path');
const METHODS=['save','advanceWeek','updateMacro','updateSubsidiaries','completeTargetAcquisition','normalize'];
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\s+src=["']\.\/(js\/[^"']+)["'][^>]*><\/script>/g)].map(m=>m[1]);
const assignmentPatterns=method=>[
 new RegExp(`(?:EngineClass|Engine|TycoonEngine|proto)\\.prototype\\.${method}\\s*=|(?:EngineClass|Engine|TycoonEngine|proto)\\.${method}\\s*=`, 'g'),
 new RegExp(`Object\\.assign\\([^,]+prototype[^)]*\\{[^}]*\\b${method}\\s*:`, 'gs')
];
for(const method of METHODS){
 console.log(`\n=== ${method} ===`);
 let count=0;
 for(const file of scripts){
  if(!fs.existsSync(file))continue;
  const source=fs.readFileSync(file,'utf8');
  if(!assignmentPatterns(method).some(re=>{re.lastIndex=0;return re.test(source)}))continue;
  count++;
  const lines=source.split(/\r?\n/);
  const hits=[];
  for(let i=0;i<lines.length;i++)if(new RegExp(`\\b${method}\\b`).test(lines[i]))hits.push(i);
  const first=hits[0]??0;
  const start=Math.max(0,first-4),end=Math.min(lines.length,first+12);
  const context=lines.slice(start,end).map((line,index)=>`${String(start+index+1).padStart(4)} ${line}`).join('\n');
  const basePatterns=[
   new RegExp(`(?:const|let|var)\\s+\\w*(?:base|original|previous|prior)\\w*\\s*=\\s*[^;]*\\.${method}\\b`,'i'),
   new RegExp(`(?:base|original|previous|prior)\\w*\\.(?:call|apply)\\(`,'i'),
   new RegExp(`(?:base|original|previous|prior)\\w*\\(`,'i')
  ];
  const preserves=basePatterns[0].test(source);
  const delegates=preserves&&(basePatterns[1].test(source)||basePatterns[2].test(source));
  console.log(`\n[${count}] ${file} preserves=${preserves} delegates=${delegates}`);
  console.log(context);
 }
 console.log(`count=${count}`);
}
