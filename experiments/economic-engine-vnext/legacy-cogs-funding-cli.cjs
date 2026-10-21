'use strict';
const fs=require('node:fs');
const {runAuthenticated}=require('./legacy-cogs-funding.cjs');
if(process.argv.length!==3){
 console.error('Usage: node legacy-cogs-funding-cli.cjs /path/to/genuine-13week-observation.json');
 process.exitCode=2;
}else{
 try{
  const observation=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const result=runAuthenticated(observation);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='SOURCE_COGS_FUNDING_DEPENDENCY_PARTIAL'||
     result.cogsRows!==13||result.cashReceiptRows!==2||
     result.totalCOGSMinor!==512098001||result.totalImmediateCashMinor!==26351317||
     result.openingPhysicalMinor!==13483||result.closingPhysicalMinor!==99645966||
     result.stillHeldSourceRows!==96||result.heldDependencies.length!==15||
     result.weeks.some(w=>w.coreCOGSPosted!==false||w.financeGapMinor!==0)){
   console.error('EVIDENCE_BLOCKED: incomplete physical/finance/PO origin: '+JSON.stringify(result.reasons));
   process.exitCode=1;
  }else{
   console.error('SOURCE_COGS_FUNDING_DEPENDENCY_PARTIAL: 13 true COGS source values and 2 cash inventory purchases accounted for physically; NO new journals or legal cash counterparties created.');
  }
 }catch(e){
  console.error('EVIDENCE_BLOCKED: '+String(e?.message||e));process.exitCode=1;
 }
}
