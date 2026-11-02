'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {bounds,analyzeArchive}=require('./parallel-shard-k-scheduling-bounds.cjs');
const rows=[10,4,3].map((wallMs,index)=>({index,label:`control-${index}`,wallMs}));
const original=structuredClone(rows),two=bounds(rows,2);
assert.equal(two.totalCommandMs,17);assert.equal(two.workPerSlotMs,8.5);assert.equal(two.lowerBoundMs,10);
assert.deepEqual(two.longestCommands,[{index:0,label:'control-0'}]);
assert.equal(bounds(rows,4).lowerBoundMs,10,'more slots cannot shorten the fixed longest command');
assert.equal(bounds(rows,1).lowerBoundMs,17);assert.deepEqual(rows,original);
for(const c of [0,-1,1.5,NaN,'2'])assert.throws(()=>bounds(rows,c));
for(const change of [r=>r[0].wallMs=-1,r=>r[0].wallMs=NaN,r=>r[1].index=0,r=>r.reverse()]) {
  const copy=structuredClone(rows);change(copy);assert.throws(()=>bounds(copy,2));
}
const root=path.resolve(__dirname,'..'),expected=require('../docs/ci-evidence/k-refresh-source-daa5236d.json');
const bytes=fs.readFileSync(path.join(root,'docs/ci-evidence/k-current-source-hosted-2026-11-02.json.gz'));
const hash='34cb96d26ea87f471dfc0996d8c1cfab35f234bcd62066fd2c46df8f7b223c8c';
const report=analyzeArchive(bytes,hash,expected);
assert.deepEqual(report,require('../docs/ci-evidence/k-scheduling-bounds-2026-11-03.json'),'retained offline analysis replay');
assert.equal(report.nodes.length,2);assert.equal(report.evidenceStatus,'cross-node-output-review-required');
assert.ok(report.crossNodeDifferences.length>0,'known cross-Node byte gap must remain visible');
for(const node of report.nodes){
  assert.equal(node.measuredPasses.length,4);assert.equal(node.fixedSerialDurationScenarios.length,3);
  assert.equal(node.fixedSerialDurationScenarios[0].longestCommands.length>0,true);
  for(const pass of node.measuredPasses)assert.equal(pass.boundExceedsMeasured,false);
}
for(const flag of ['runtimeExecuted','movingMainRequalified','durationsInvariantUnderConcurrencyVerified','memoryCapacityQualified','parallelExecutionQualified','productionAuthorized'])assert.equal(report[flag],false);
assert.throws(()=>analyzeArchive(bytes,'0'.repeat(64),expected),/SHA256/);
console.log('K scheduling bounds: PASS (full retained evidence, fixed-duration floors, unchanged byte gap; no speedup/safety prediction)');
