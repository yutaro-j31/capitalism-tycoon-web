'use strict';
const fs=require('node:fs');
const {runAuthenticated}=require('./legacy-spoilage-replay.cjs');
if(process.argv.length!==3){console.error('Usage: node legacy-spoilage-replay-cli.cjs genuine-legacy-13week.json');process.exitCode=2;}
else{
 try{
  const o=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const r=runAuthenticated(o);
  console.log(JSON.stringify(r,null,2));
  if(r.status!=='SOURCE_LEDGER_STOCK_LOSS_PARTIAL'||r.canonicalJournalCount!==54||
     r.postedSourceRows!==53||r.heldSourceRows!==96||r.postedNonStoreRows!==9||
     r.remainingInventoryMinor!==r.creditInventoryMinor-r.periodSpoilageMinor){
   console.error('EVIDENCE_BLOCKED: original company noncash spoilage evidence invalid: '+JSON.stringify(r.reasons));
   process.exitCode=1;
  }else console.error('SOURCE_LEDGER_STOCK_LOSS_PARTIAL: 31 credit receipts + 13 depreciation + 9 company spoilage = 53 authentic events, 96 held; no cash or full BS claims.');
 }catch(e){console.error('EVIDENCE_BLOCKED: '+String(e?.message||e));process.exitCode=1;}
}
