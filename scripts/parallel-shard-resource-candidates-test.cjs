'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {summarize}=require('./parallel-shard-resource-candidates.cjs'),{prepare,collect}=require('./parallel-shard-write-observation.cjs');
const event=(operation,target,cwd='/work',extra={})=>({pid:123,cwd,operation,target,...extra});
const a={label:'repeated-label',findings:[event('fs.renameSync','source','/work',{destination:'shared'}),event('net.listen',8123),event('dgram.bind',8123),event('fs.writeFileSync','only-a')]};
const b={label:'repeated-label',findings:[event('fs.writeFileSync','./shared','/work',{threadId:2}),event('net.listen',8123),event('fs.writeFileSync','only-a','/other'),event('net.listen',0),event('net.listen','[options omitted]'),event('fs.write',7),event('worker_threads.Worker','[omitted]')]};
const observation={ok:false,commands:[a,b]},before=structuredClone(observation),r=summarize(observation);
assert.deepEqual(observation,before);
assert.equal(r.candidateSharedResources.length,2);
const shared=r.candidateSharedResources.find(x=>x.value==='/work/shared');
assert.deepEqual(shared.participants.map(x=>x.index),[0,1],'same labels preserve separate invocations');
assert.equal(shared.participants[0].observations[0].role,'destination');
assert.equal(shared.participants[1].observations[0].witness.threadId,2);
assert.ok(r.candidateSharedResources.some(x=>x.kind==='tcp-port'&&x.value===8123));
assert.equal(r.unresolved.length,4);
const opaquePath=summarize({commands:[{label:'opaque',findings:[event('fs.writeFileSync','file:///tmp/a'),event('fs.writeFileSync','[object Object]')]}]});
assert.equal(opaquePath.observedResourceCount,0);assert.equal(opaquePath.unresolved.length,2);
const spoofed=structuredClone(observation);Object.assign(spoofed.commands[1].findings[0],{index:99,label:'wrong',findingIndex:99});
const witness=summarize(spoofed).candidateSharedResources[0].participants[1].observations[0].witness;
assert.equal(witness.index,1);assert.equal(witness.label,'repeated-label');assert.equal(witness.findingIndex,0);
assert.equal(r.sharedWriteSafetyQualified,false);assert.equal(r.parallelExecutionQualified,false);
assert.equal(r.simultaneousExecutionVerified,false);assert.equal(r.productionAuthorized,false);
assert.equal(summarize({commands:[a]}).candidateSharedResources.length,0,'same-invocation events do not imply cross-command sharing');
assert.equal(summarize({commands:[]}).sharedWriteSafetyQualified,false,'empty evidence is not safety');
for(const mutate of [e=>e.pid=0,e=>e.cwd='relative',e=>e.threadId=-1,e=>e.operation=null]) {
  const bad=structuredClone(observation);mutate(bad.commands[0].findings[0]);assert.throws(()=>summarize(bad));
}
const root=fs.mkdtempSync(path.join(os.tmpdir(),'resource-candidates-'));
try {
  const target=path.join(root,'shared'),commands=prepare([0,1].map(i=>({label:`control-${i}`,command:process.execPath,
    args:['-e',`require('node:fs').writeFileSync(${JSON.stringify(target)},'fixture');console.log('PASS owned write')`]})),path.join(root,'audit'));
  const trace=commands.map(c=>{const p=cp.spawnSync(c.command,c.args,{env:{...process.env,...c.env},timeout:5000,maxBuffer:1048576});
    assert.ifError(p.error);assert.equal(p.status,0);assert.equal(p.stdout.toString(),'PASS owned write\n');assert.equal(p.stderr.length,0);return {command:c.command,args:c.args,pid:p.pid};});
  // Collect identical sequential commands separately; the existing strict collector
  // deliberately rejects an ambiguous multi-command trace of identical identities.
  const collected=commands.map((c,i)=>collect([c],[trace[i]]).commands[0]);
  const real=summarize({commands:collected});
  assert.equal(real.candidateSharedResources.length,1);assert.equal(real.candidateSharedResources[0].value,target);
  assert.equal(real.simultaneousExecutionVerified,false,'sequential controls must not be called actual contention');
  const input=path.join(root,'input.json');fs.writeFileSync(input,JSON.stringify({commands:collected}));
  const cli=cp.spawnSync(process.execPath,[path.join(__dirname,'parallel-shard-resource-candidates.cjs'),input],{encoding:'utf8',timeout:5000,maxBuffer:1048576});
  assert.equal(cli.status,0,cli.stderr);assert.deepEqual(JSON.parse(cli.stdout),real);
} finally {fs.rmSync(root,{recursive:true,force:true});}
console.log('Observed resource candidates: PASS (shared paths/ports, unresolved/worker/FD, real sequential writes; no safety qualification)');
