'use strict';
// Offline fixed-duration bounds, not a scheduling or parallel-safety recommendation.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {withArchive,auditPair}=require('./parallel-shard-k-evidence-audit.cjs');
function bounds(rows,concurrency) {
  assert.ok(Array.isArray(rows)&&rows.length);
  assert.ok(Number.isSafeInteger(concurrency)&&concurrency>0);
  assert.equal(new Set(rows.map(r=>r.index)).size,rows.length,'unique invocation indices');
  for(const [i,r] of rows.entries()) {
    assert.equal(r.index,i,'canonical invocation order');
    assert.ok(typeof r.label==='string'&&r.label.length);
    assert.ok(Number.isFinite(r.wallMs)&&r.wallMs>=0);
  }
  const totalCommandMs=rows.reduce((n,r)=>n+r.wallMs,0),longestCommandMs=Math.max(...rows.map(r=>r.wallMs));
  assert.ok(Number.isFinite(totalCommandMs)&&totalCommandMs>0);
  const lowerBoundMs=Math.max(totalCommandMs/concurrency,longestCommandMs);
  return {concurrency,totalCommandMs,longestCommandMs,workPerSlotMs:totalCommandMs/concurrency,lowerBoundMs,
    longestCommands:rows.filter(r=>r.wallMs===longestCommandMs).map(({index,label})=>({index,label})),
    idealFixedDurationSpeedupCeiling:totalCommandMs/lowerBoundMs};
}
function analyzeArchive(bytes,hash,expected) {
  return withArchive(bytes,hash,expected.sha,(reports,roots)=>{
    const audited=auditPair(reports,expected,roots);
    return {schema:'k-fixed-duration-bounds-v1',sourceSha:expected.sha,archiveSha256:hash,
      evidenceStatus:audited.status,crossNodeDifferences:audited.differences,
      nodes:reports.map(report=>{
        const serial=report.runs[0].result;
        return {node:report.node,cpuModel:report.cpuModel,logicalCpus:report.logicalCpus,physicalMemoryBytes:report.physicalMemoryBytes,
          // These scenarios reuse serial durations; contention/overhead can change them.
          fixedSerialDurationScenarios:[1,2,4].map(c=>bounds(serial.results,c)),
          measuredPasses:report.runs.map(pass=>{
            const r=pass.result,bound=bounds(r.results,r.concurrency),gap=r.wallMs-bound.lowerBoundMs;
            return {name:pass.name,measuredWallMs:r.wallMs,concurrency:r.concurrency,
              boundUsingThisPassDurations:bound,measuredMinusBoundMs:gap,boundExceedsMeasured:gap<0};
          })};
      }),runtimeExecuted:false,movingMainRequalified:false,durationsInvariantUnderConcurrencyVerified:false,
      memoryCapacityQualified:false,parallelExecutionQualified:false,productionAuthorized:false};
  });
}
module.exports={bounds,analyzeArchive};
if(require.main===module) {
  try {assert.equal(process.argv.length,5,'usage: k-scheduling-bounds.cjs ARCHIVE_GZ SHA256 EXPECTED_MANIFEST_JSON');
    const result=analyzeArchive(fs.readFileSync(process.argv[2]),process.argv[3],JSON.parse(fs.readFileSync(process.argv[4],'utf8')));
    console.log(JSON.stringify(result,null,2));process.exitCode=result.crossNodeDifferences.length?2:0;
  } catch(error) {console.error(error.stack);process.exitCode=1;}
}
