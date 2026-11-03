'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {begin,observeOperation}=require('./parallel-shard-cgroup-memory-window.cjs');
async function run() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cgroup-operation-'));
  const write=(file,text)=>fs.writeFileSync(path.join(root,file),text);
  try {
    write('memory.current','100');write('memory.max','max');write('memory.high','max');
    write('memory.events','oom_kill 0\n');write('memory.events.local','oom_kill 0\n');
    const result=await observeOperation(root,()=>new Promise((resolve,reject)=>{
      cp.execFile(process.execPath,['-e',`require('node:fs').writeFileSync(${JSON.stringify(path.join(root,'memory.events'))},'oom_kill 1\\n');process.stdout.write('control');`],
        {timeout:5000,maxBuffer:1048576},(error,stdout)=>error?reject(error):resolve(stdout));
    }));
    assert.deepEqual(result.outcome,{status:'fulfilled',value:'control'});
    assert.equal(result.observation.requestedWindowMs,null,'operation duration is not the fixed sampling pause');
    assert.equal(result.observation.eventDeltas.events.counters.oom_kill.delta,1);
    assert.equal(result.observation.directoryHandlePinned,true);
    for(const flag of ['peakMeasured','cgroupAssociationVerified','workloadCauseEstablished','parallelExecutionQualified','productionAuthorized'])assert.equal(result.observation[flag],false);
    const failure=new Error('original workload failure');
    const failed=await observeOperation(root,async()=>{write('memory.events','oom_kill 2\n');throw failure;});
    assert.equal(failed.outcome.status,'rejected');assert.equal(failed.outcome.reason,failure);
    assert.equal(failed.observation.eventDeltas.events.counters.oom_kill.delta,1);
    const unsuccessful=await observeOperation(root,async()=>({ok:false}));
    assert.equal(unsuccessful.outcome.value.ok,false,'callback fulfillment must not rewrite a failed runner result');
    const partial=await observeOperation(root,async()=>{fs.unlinkSync(path.join(root,'memory.events.local'));return 0;});
    assert.equal(partial.outcome.value,0);assert.equal(partial.observation.completeEventDeltas,false);
    const window=begin(root);window.finish();assert.throws(()=>window.finish(),/closed/);window.close();
    const closed=begin(root);closed.close();assert.throws(()=>closed.finish(),/closed/);
    await assert.rejects(observeOperation(path.join(root,'missing'),()=>{throw Error('must not start');}),/ENOENT/);
    const script=path.join(__dirname,'parallel-shard-runner-process-diagnostic.js');
    for(const args of [['--memory-cgroup-dir'],['--full-shard','I','--plan-only','--memory-cgroup-dir',root],['--self-test','--memory-cgroup-dir',root]]){
      const p=cp.spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:5000});
      assert.notEqual(p.status,0);assert.match(p.stderr,/memory-cgroup-dir requires/);
    }
  } finally {fs.rmSync(root,{recursive:true,force:true});}
  console.log('Cgroup operation window: PASS (bounded child fixture, original rejection retained, partial counters; synthetic only)');
}
module.exports={run};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
