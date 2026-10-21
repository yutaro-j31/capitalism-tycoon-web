'use strict';
// Authenticated real disposable game observations only; no production save writes.
const fs=require('node:fs');
const {proof}=require('./legacy-inventory-rollforward.cjs');
if(process.argv.length!==3){console.error('Usage: node legacy-inventory-rollforward-cli.cjs legacy-13week.json');process.exitCode=2;}
else{
 try{
  const observation=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const result=proof(observation);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='SOURCE_STOCK_EVIDENCE_PARTIAL'||result.verifiedWeeks<1||result.verifiedWeeks+result.blockedWeeks!==13){
   console.error('EVIDENCE_BLOCKED: lot rollforward cannot be validated: '+JSON.stringify(result.reasons||result.weeks?.filter(w=>w.status!=='SOURCE_STOCK_WEEK_MATCH')));
   process.exitCode=1;
  }else console.error('SOURCE_STOCK_EVIDENCE_PARTIAL: '+result.verifiedWeeks+' verified weeks, '+result.blockedWeeks+' blocked weeks; NO COGS core replay/parity claim.');
 }catch(err){console.error('EVIDENCE_BLOCKED: '+String(err&&err.message||err));process.exitCode=1;}
}
