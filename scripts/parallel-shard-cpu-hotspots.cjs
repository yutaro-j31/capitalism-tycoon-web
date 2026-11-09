'use strict';
// Offline V8 sample attribution only. Not a CPU-utilization or speedup measurement.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function summarize(profile,limit=20,{sampleCountsOnly=false}={}) {
  assert.ok(Number.isSafeInteger(limit)&&limit>0&&limit<=1000);
  assert.ok(Number.isFinite(profile.startTime)&&Number.isFinite(profile.endTime)&&profile.endTime>=profile.startTime,'profile chronology');
  assert.ok(Array.isArray(profile.nodes)&&profile.nodes.length);
  assert.ok(Array.isArray(profile.samples)&&profile.samples.length,'sampled profile required');
  assert.ok(Array.isArray(profile.timeDeltas)&&profile.timeDeltas.length===profile.samples.length,'one delta per sample');
  const nodes=new Map(),groups=new Map();
  for(const n of profile.nodes){
    assert.ok(Number.isSafeInteger(n.id)&&n.id>0&&!nodes.has(n.id),'unique node ID');
    const f=n.callFrame;assert.ok(f&&typeof f.functionName==='string'&&typeof f.url==='string');
    for(const k of ['lineNumber','columnNumber'])assert.ok(Number.isSafeInteger(f[k])&&f[k]>=-1);
    nodes.set(n.id,n);
  }
  let sampledMicroseconds=0,negativeDeltaCount=0;
  for(const [i,id] of profile.samples.entries()){
    assert.ok(nodes.has(id),'sample references unknown node');
    const delta=profile.timeDeltas[i];
    assert.ok(Number.isFinite(delta),'finite sample delta required');
    if(delta<0){
      assert.ok(sampleCountsOnly,'nonnegative sample delta required');
      negativeDeltaCount++;
    }
    const weight=sampleCountsOnly ? 0 : delta;
    sampledMicroseconds+=weight;
    const frame=nodes.get(id).callFrame,key=JSON.stringify([frame.functionName,frame.url,frame.lineNumber,frame.columnNumber]);
    if(!groups.has(key))groups.set(key,{functionName:frame.functionName,url:frame.url,lineNumber:frame.lineNumber,columnNumber:frame.columnNumber,selfSamples:0,sampledSelfMicroseconds:0,nodeIds:new Set()});
    const group=groups.get(key);group.selfSamples++;group.sampledSelfMicroseconds+=weight;group.nodeIds.add(id);
  }
  if(!sampleCountsOnly)assert.ok(Number.isFinite(sampledMicroseconds)&&sampledMicroseconds>0,'positive finite sampled interval');
  const rows=[...groups.values()].sort((a,b)=>b.sampledSelfMicroseconds-a.sampledSelfMicroseconds||b.selfSamples-a.selfSamples||a.url.localeCompare(b.url)||a.lineNumber-b.lineNumber);
  const summary={sampleCount:profile.samples.length,nodeCount:nodes.size,
    sampledFunctionCount:rows.length,omittedFunctionCount:Math.max(0,rows.length-limit)};
  const limitations={
    attribution:'sampled-leaf-only-no-inclusive-double-counting',callTreeVerified:false,
    sourceBindingVerified:false,cpuUtilizationMeasured:false,speedupPredicted:false,
    parallelExecutionQualified:false,productionAuthorized:false};
  const hotspots=rows.slice(0,limit).map(r=>({...r,nodeIds:[...r.nodeIds].sort((a,b)=>a-b)}));
  if(sampleCountsOnly){
    return {schema:'v8-self-sample-counts-v1',...summary,negativeDeltaCount,
      hotspots:hotspots.map(({sampledSelfMicroseconds,...r})=>({...r,selfSampleFraction:r.selfSamples/profile.samples.length})),
      ...limitations};
  }
  const span=profile.endTime-profile.startTime;
  return {schema:'v8-self-sample-hotspots-v1',...summary,
    profileSpanMicroseconds:span,sampledMicroseconds,sampledDeltaExceedsProfileSpan:sampledMicroseconds>span,
    hotspots:hotspots.map(r=>({...r,sampledSelfFraction:r.sampledSelfMicroseconds/sampledMicroseconds})),
    ...limitations};
}
function read(bytes,expectedHash,limit=20,options){
  assert.match(expectedHash,/^[a-f0-9]{64}$/);assert.equal(hash(bytes),expectedHash,'profile SHA256 mismatch');
  return {profileSha256:expectedHash,...summarize(JSON.parse(bytes.toString('utf8')),limit,options)};
}
module.exports={summarize,read};
if(require.main===module){
  try{
    const args=process.argv.slice(2);
    const sampleCountsOnly=args[0]==='--sample-counts';
    if(sampleCountsOnly)args.shift();
    assert.equal(args.length,2,'usage: cpu-hotspots.cjs [--sample-counts] PROFILE.cpuprofile EXPECTED_SHA256');
    const [file,expectedHash]=args;
    console.log(JSON.stringify(read(fs.readFileSync(file),expectedHash,20,{sampleCountsOnly}),null,2));
  }catch(error){console.error(error.stack);process.exitCode=1;}
}
