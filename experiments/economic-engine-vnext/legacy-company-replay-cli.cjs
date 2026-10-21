'use strict';
// Read-only disposable legacy observation -> bounded core replay and audit.
const fs=require('node:fs');
const {runAuthenticatedReplay}=require('./legacy-company-replay.cjs');
if(process.argv.length!==3){
 console.error('Usage: node legacy-company-replay-cli.cjs path/to/disposable-legacy-observation.json');
 process.exitCode=2;
}else{
 try{
  const o=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const proof=runAuthenticatedReplay(o);
  console.log(JSON.stringify(proof,null,2));
  if(proof.status!=='SOURCE_LEDGER_PARTIAL'){
   console.error('EVIDENCE_BLOCKED: genuine core replay did not pass: '+JSON.stringify(proof.reasons));
   process.exitCode=1;
  }else{
   console.error('SOURCE_LEDGER_PARTIAL: '+proof.posted+' real credit receipts journalized, '+proof.blocked+' others explicitly blocked; no FULL_PARITY claim.');
  }
 }catch(e){
  console.error('EVIDENCE_BLOCKED: replay parse/execution failed: '+String(e?.message||e));
  process.exitCode=1;
 }
}
