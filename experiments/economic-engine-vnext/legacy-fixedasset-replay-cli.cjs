'use strict';
const fs=require('node:fs');
const {runAuthenticated}=require('./legacy-fixedasset-replay.cjs');
if(process.argv.length!==3){
 console.error('Usage: node legacy-fixedasset-replay-cli.cjs /path/to/real-13week-observation.json');
 process.exitCode=2;
}else{
 try{
  const observation=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const result=runAuthenticated(observation);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='SOURCE_LEDGER_FIXED_ASSET_PARTIAL'||result.postedSourceRows!==44||
     result.blockedSourceRows!==94||result.canonicalJournalCount!==45||
     result.sourceDepreciationRows!==13||result.depreciationExpenseMinor!==7650006){
   console.error('EVIDENCE_BLOCKED: 13 source depreciations were not posted exactly: '+JSON.stringify(result.reasons||result));
   process.exitCode=1;
  }else{
   console.error('SOURCE_LEDGER_FIXED_ASSET_PARTIAL: 31 authenticated credits + 13 authenticated depreciations = 44 source rows. 94 held. One scoped opening book journal, NOT whole-company BS or asset purchase cash proof.');
  }
 }catch(e){
  console.error('EVIDENCE_BLOCKED: '+String(e?.message||e));process.exitCode=1;
 }
}
