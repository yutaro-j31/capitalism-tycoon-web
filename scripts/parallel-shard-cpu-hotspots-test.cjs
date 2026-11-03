'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {summarize,read}=require('./parallel-shard-cpu-hotspots.cjs');
const frame=(functionName,url='index.html')=>({functionName,url,lineNumber:1,columnNumber:0});
const profile={startTime:0,endTime:100,nodes:[{id:1,callFrame:frame('root')},{id:2,callFrame:frame('hot')},{id:3,callFrame:frame('hot')}],samples:[1,2,3],timeDeltas:[10,30,50]};
const before=structuredClone(profile),r=summarize(profile,1);
assert.equal(r.hotspots.length,1);assert.equal(r.hotspots[0].functionName,'hot');assert.equal(r.hotspots[0].sampledSelfMicroseconds,80);
assert.equal(r.hotspots[0].selfSamples,2);assert.deepEqual(r.hotspots[0].nodeIds,[2,3]);assert.equal(r.omittedFunctionCount,1);
assert.equal(r.sampledMicroseconds,90);assert.deepEqual(profile,before);
for(const flag of ['sourceBindingVerified','cpuUtilizationMeasured','speedupPredicted','parallelExecutionQualified','productionAuthorized'])assert.equal(r[flag],false);
for(const change of [p=>p.nodes[1].id=1,p=>p.samples[0]=99,p=>p.timeDeltas.pop(),p=>p.timeDeltas[0]=-1,p=>p.endTime=-1,p=>p.samples=[],p=>p.nodes[0].callFrame.url=null]){
  const bad=structuredClone(profile);change(bad);assert.throws(()=>summarize(bad));
}
const inconsistent=structuredClone(profile);inconsistent.endTime=50;
assert.equal(summarize(inconsistent).sampledDeltaExceedsProfileSpan,true,'do not turn inconsistent sampled time into CPU utilization');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'cpu-hotspots-'));
try{
  const file=path.join(root,'fixture.cjs'),output=path.join(root,'fixture.cpuprofile');
  fs.writeFileSync(file,"function busyControl(){let x=1;for(let i=0;i<80000000;i++)x=Math.imul(x^i,1664525);return x;}process.stdout.write('PASS cpu fixture '+busyControl()+'\\n');process.stderr.write('expected stderr\\n');");
  const run=args=>{const r=cp.spawnSync(process.execPath,args,{timeout:10000,maxBuffer:4194304});assert.ifError(r.error);assert.equal(r.status,0,r.stderr?.toString());assert.equal(r.signal,null);return r;};
  const baseline=run([file]),measured=run(['--cpu-prof',`--cpu-prof-dir=${root}`,'--cpu-prof-name=fixture.cpuprofile',file]);
  assert.deepEqual(measured.stdout,baseline.stdout);assert.deepEqual(measured.stderr,baseline.stderr);
  const bytes=fs.readFileSync(output),digest=crypto.createHash('sha256').update(bytes).digest('hex'),real=read(bytes,digest,1000);
  assert.ok(real.sampleCount>0);assert.ok(real.hotspots.some(f=>f.url.endsWith('/fixture.cjs')),'real fixture source sampled');
  assert.equal(real.sourceBindingVerified,false);assert.throws(()=>read(bytes,'0'.repeat(64)),/SHA256/);
  const cli=run([path.join(__dirname,'parallel-shard-cpu-hotspots.cjs'),output,digest]);
  assert.deepEqual(JSON.parse(cli.stdout),read(bytes,digest));
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('CPU hotspots: PASS (real V8 fixture, byte output parity, strict references/hash, leaf-only samples; not K profiling evidence)');
