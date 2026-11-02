'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),cp=require('node:child_process');
const {readArchive,auditPair}=require('./parallel-shard-i-evidence-audit.cjs');
const archive=path.join(__dirname,'../docs/ci-evidence/i-serial-hosted-2026-11-02.json.gz');
const manifest=path.join(__dirname,'../docs/ci-evidence/i-serial-source-555ca404.json');
const expected=JSON.parse(fs.readFileSync(manifest));
const hash='dd5cad52a591da4727642fc3de65327324b0c82a347c221099974bc54bd5592b';
const bytes=fs.readFileSync(archive), original=readArchive(bytes,hash,expected);
assert.equal(original.audit.status,'serial-evidence-verified'); assert.deepEqual(original.audit.differences,[]);
assert.equal(original.audit.parallelExecutionQualified,false);assert.equal(original.audit.productionAuthorized,false);
assert.deepEqual(original.audit.nodes.map(n=>n.wallMs),[1332817,1633568]);
assert.deepEqual(original.audit.nodes.map(n=>n.sampledPeakMiB),[4680,4889]);
const before=JSON.stringify(original.nodes);
assert.deepEqual(auditPair(original.nodes,expected,original.pack.diagnosticMergeSha),original.audit);
assert.equal(JSON.stringify(original.nodes),before,'offline audit never changes evidence');
for(const mutate of [
 n=>n.pop(),n=>n[1]=structuredClone(n[0]),n=>n[0].full.targetSourceSha='a'.repeat(40),
 n=>n[0].full.identity.consistent=false,n=>n[0].full.identity.numbered.pid++,n=>n[0].plan.sourceSha='b'.repeat(40),
 n=>n[0].plan.planValidated=false,n=>n[0].plan.iSerialPlan.runtimeExecuted=true,
 n=>n[0].full.runs.push(n[0].full.runs[0]),n=>n[0].full.runs[0].result.concurrency=2,
 n=>n[0].full.runs[0].result.counts.failed++,n=>n[0].full.runs[0].result.results.pop(),
 n=>n[0].full.runs[0].result.results[0].signal='SIGKILL',n=>n[0].full.runs[0].result.results[0].reason='ENOBUFS',
 n=>n[0].full.runs[0].result.results[0].reason='timeout',n=>n[0].full.runs[0].result.results[0].leftoverProcesses=true,
 n=>n[0].full.runs[0].result.results[0].stdoutBytes++,n=>n[0].full.runs[0].outputs.pop(),
 n=>n[0].full.runs[0].outputs[0].stdoutBase64+='!',n=>n[0].full.runs[0].result.peakSystemMemInUseMb=20000,
 n=>n[0].full.runs[0].result.cpuSecondsSampled=null,n=>n[0].full.runs[0].trace.pop(),
 n=>n[0].full.runs[0].trace[0].snapshots.pop(),n=>n[0].full.runs[0].trace[0].snapshots[0].target.pgrp++,
 n=>n[0].full.runs[0].after.at(-1).groups.pop(),n=>n[0].full.runs[0].after.at(-1).groups[0].members.push({state:'Z'}),
 n=>n[0].full.trackedSourceCleanAfter=false,n=>n[0].full.outputParity=true,n=>n[0].full.iSerialSummary.wallMs++,
 n=>n[0].controls.runs[2].result.results[0].leftoverProcesses=false,
 n=>n[0].controls.runs[0].result.results[0].signal='SIGKILL',n=>n[0].controls.runs.pop()
]){const n=structuredClone(original.nodes);mutate(n);assert.throws(()=>auditPair(n,expected,original.pack.diagnosticMergeSha));}
// A valid-but-different retained stream is review-required, never normalized.
const mismatch=structuredClone(original.nodes),out=mismatch[1].full.runs[0].outputs[0],item=mismatch[1].full.runs[0].result.results[0];
const changed=Buffer.from('intentional diagnostic mismatch\n');out.stderrBase64=changed.toString('base64');item.stderrBytes=changed.length;item.stderrSha256=crypto.createHash('sha256').update(changed).digest('hex');
const review=auditPair(mismatch,expected,original.pack.diagnosticMergeSha);
assert.equal(review.status,'cross-node-output-review-required');assert.equal(review.differences.length,1);
assert.equal(review.productionAuthorized,false);
assert.throws(()=>readArchive(bytes,'0'.repeat(64),expected));
for(const mutate of [p=>p.artifacts[0].files.pop(),p=>p.artifacts[0].files[0].sha256='0'.repeat(64),p=>p.artifacts[0].files[0].base64+='!',p=>p.artifacts[0].major=99]){
 const pack=structuredClone(original.pack);mutate(pack);const raw=zlib.gzipSync(JSON.stringify(pack));const pin=crypto.createHash('sha256').update(raw).digest('hex');assert.throws(()=>readArchive(raw,pin,expected));
}
// Both Node versions still exist in this corrupted pack. Swapped artifact labels
// and filenames must not pass merely because pair-wide Node coverage is intact.
const packMutations = [
 p=>{for(const a of p.artifacts){const old=a.major;a.major=old===22?24:22;for(const f of a.files)f.name=f.name.replace(String(old),String(a.major));}},
 p=>p.artifacts[1].artifactId=p.artifacts[0].artifactId,
 p=>p.artifacts[1].jobId=p.artifacts[0].jobId,
 p=>p.artifacts[1].zipSha256=p.artifacts[0].zipSha256,
 p=>p.artifacts[0].artifactId=0, p=>p.artifacts[0].jobId='125119496622',
 p=>p.artifacts[0].artifactId=Number.MAX_SAFE_INTEGER+1,
 p=>delete p.runId, p=>p.runId=0, p=>p.attempt=0, p=>p.attempt=1.5,
 p=>delete p.headSha, p=>p.headSha='main', p=>delete p.diagnosticMergeSha
];
for(const mutate of packMutations){
 const pack=structuredClone(original.pack);mutate(pack);
 const raw=zlib.gzipSync(JSON.stringify(pack)),pin=crypto.createHash('sha256').update(raw).digest('hex');
 assert.throws(()=>readArchive(raw,pin,expected),'bad artifact/provenance rejected even with a matching outer hash');
}
const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'i-evidence-cli-'));
try {
 const pack=structuredClone(original.pack), record=pack.artifacts[1].files.find(f=>f.name==='full-i-node-24.json');
 const raw=Buffer.from(JSON.stringify(mismatch[1].full));record.base64=raw.toString('base64');record.sha256=crypto.createHash('sha256').update(raw).digest('hex');
 const fixture=zlib.gzipSync(JSON.stringify(pack)), file=path.join(temp,'mismatch.gz');fs.writeFileSync(file,fixture);
 const pin=crypto.createHash('sha256').update(fixture).digest('hex');
 const changedCli=cp.spawnSync(process.execPath,[path.join(__dirname,'parallel-shard-i-evidence-audit.cjs'),file,pin,manifest],{encoding:'utf8'});
 assert.equal(changedCli.status,2,changedCli.stderr);assert.equal(JSON.parse(changedCli.stdout).status,'cross-node-output-review-required');
 const swapped=structuredClone(original.pack);packMutations[0](swapped);
 const invalidBytes=zlib.gzipSync(JSON.stringify(swapped));fs.writeFileSync(file,invalidBytes);
 const invalidHash=crypto.createHash('sha256').update(invalidBytes).digest('hex');
 const rejected=cp.spawnSync(process.execPath,[path.join(__dirname,'parallel-shard-i-evidence-audit.cjs'),file,invalidHash,manifest],{encoding:'utf8'});
 assert.equal(rejected.status,1);assert.equal(rejected.stdout,'');assert.match(rejected.stderr,/artifact Node label\/report mismatch/);
} finally {fs.rmSync(temp,{recursive:true,force:true});}
const cli=cp.spawnSync(process.execPath,[path.join(__dirname,'parallel-shard-i-evidence-audit.cjs'),archive,hash,manifest],{encoding:'utf8'});
assert.equal(cli.status,0,cli.stderr);assert.deepEqual(JSON.parse(cli.stdout),original.audit);
console.log('I serial retained evidence: PASS (both hosted reports, raw bytes, control/trace/resource corruption; no parallel qualification)');
