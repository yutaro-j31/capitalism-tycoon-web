'use strict';
const fs=require('node:fs');
const {runAuthenticated}=require('./legacy-consumption-boundary.cjs');
try{
 if(process.argv.length!==3)throw Error('Usage: node legacy-consumption-boundary-cli.cjs observation.json');
 const result=runAuthenticated(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
 console.log(JSON.stringify(result,null,2));
 if(result.status!=='SOURCE_CONSUMPTION_BOUNDARY_PARTIAL')process.exitCode=1;
}catch(e){console.error('EVIDENCE_BLOCKED: '+e.message);process.exitCode=1;}
