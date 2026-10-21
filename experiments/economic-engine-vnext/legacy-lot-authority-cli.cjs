'use strict';
const fs=require('node:fs');
const {runAuthenticated}=require('./legacy-lot-authority.cjs');
if(process.argv.length!==3){
 console.error('Usage: node legacy-lot-authority-cli.cjs real-legacy-13week-observation.json');
 process.exitCode=2;
}else{
 try{
  const observation=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const result=runAuthenticated(observation);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='SOURCE_LOT_AUTHORITY_GAPS_PARTIAL'||
     result.sourceWeeks!==13||result.previousSourceRowsPosted!==53||
     result.previousSourceRowsHeld!==96||result.newlyPostedCOGS!==0||
     result.newlyPostedCashPurchases!==0||
     result.opening.physicalBookMinor!==13483||
     result.cashPurchasePOs.length!==2||
     result.weeks.some(w=>w.individualCOGSEventIDs!==0)){
   console.error('EVIDENCE_BLOCKED: actual original material source authority incomplete: '+JSON.stringify(result.reasons));
   process.exitCode=1;
  }else{
   console.error('SOURCE_LOT_AUTHORITY_GAPS_PARTIAL: 14 source snapshots/13 stock weeks inspected, two supplier catalogue cash orders, original lot ancestry classified. No legal cash payees or individual COGS event provenance proved.');
  }
 }catch(e){console.error('EVIDENCE_BLOCKED: '+String(e?.message||e));process.exitCode=1;}
}
