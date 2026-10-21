'use strict';
// Dedicated disposable-game read-only evidence verifier. Never writes game saves.
const fs=require('node:fs');
const {verifyObservation}=require('./legacy-week-bridge.cjs');
if(process.argv.length!==3){
 console.error('Usage: node legacy-week-bridge-cli.cjs PATH_TO_LEGACY_OBSERVATION_JSON');
 process.exitCode=2;
}else{
 try{
  const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const result=verifyObservation(input);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='SOURCE_ALIGNED_PARTIAL'){
   console.error('EVIDENCE_BLOCKED: ledger source-reference mismatch: '+JSON.stringify(result.reasons));
   process.exitCode=1;
  }
 }catch(e){
  console.error('EVIDENCE_BLOCKED: cannot parse or verify source JSON: '+String(e?.message||e));
  process.exitCode=1;
 }
}
