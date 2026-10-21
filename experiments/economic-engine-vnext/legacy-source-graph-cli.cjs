'use strict';
const fs=require('node:fs');
const {verifySourceGraph}=require('./legacy-source-graph.cjs');
if(process.argv.length!==3){
 console.error('Usage: node legacy-source-graph-cli.cjs /path/to/real-legacy-observation.json');
 process.exitCode=2;
}else{
 try{
  const evidence=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const result=verifySourceGraph(evidence);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='SOURCE_GRAPH_PARTIAL'){
   console.error('EVIDENCE_BLOCKED: '+JSON.stringify(result.reasons));
   process.exitCode=1;
  }
 }catch(e){
  console.error('EVIDENCE_BLOCKED: '+String(e?.message||e));
  process.exitCode=1;
 }
}
