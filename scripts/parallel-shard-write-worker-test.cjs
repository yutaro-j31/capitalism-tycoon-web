'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const cp = require('node:child_process'), { prepare, collect } = require('./parallel-shard-write-observation.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'write-workers-'));
try {
  const workerCode = "const fs=require('node:fs'),{threadId,workerData,parentPort}=require('node:worker_threads');fs.writeFileSync(workerData.file,JSON.stringify({pid:process.pid,threadId}));parentPort.postMessage({pid:process.pid,threadId});";
  const script = sanitized => `const fs=require('node:fs'),{Worker}=require('node:worker_threads');
    const root=${JSON.stringify(root)};const count=${sanitized ? 1 : 2};
    Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{
      let message;const w=new Worker(${JSON.stringify(workerCode)},{eval:true,workerData:{file:root+'/worker-'+i+'.json'}${sanitized ? ",execArgv:[],env:{...process.env,NODE_OPTIONS:'',PSR_WRITE_AUDIT_DIR:''}" : ''}});
      w.on('message',m=>message=m);w.on('error',reject);w.on('exit',code=>code===0&&message?resolve(message):reject(Error('worker failed '+code)));
    }))).then(ids=>{fs.writeFileSync(root+'/ids.json',JSON.stringify(ids));process.stdout.write('worker controls\\n');process.stderr.write('expected worker stderr\\n');}).catch(e=>{console.error(e);process.exitCode=1;});`;
  const env = { ...process.env, NODE_OPTIONS: '' }; delete env.PSR_WRITE_AUDIT_DIR;
  const command = { label:'worker-write-control',command:process.execPath,args:['-e',script(false)],env };
  const run = c => {
    const r=cp.spawnSync(c.command,c.args,{env:c.env,timeout:15000,maxBuffer:1024*1024});
    assert.ifError(r.error);assert.equal(r.signal,null);assert.equal(r.status,0,r.stderr?.toString());return r;
  };
  const baseline=run(command), commands=prepare([command],path.join(root,'audit'));
  const audited=run(commands[0]);
  assert.deepEqual(audited.stdout,baseline.stdout);assert.deepEqual(audited.stderr,baseline.stderr);
  const trace = (c,r)=>[{command:c.command,args:c.args,pid:r.pid}];
  const report=collect(commands,trace(commands[0],audited)), row=report.commands[0];
  const ids=JSON.parse(fs.readFileSync(path.join(root,'ids.json'),'utf8'));
  assert.equal(new Set(ids.map(x=>x.pid)).size,1);assert.equal(ids[0].pid,audited.pid);
  assert.equal(new Set(ids.map(x=>x.threadId)).size,2);
  assert.equal(row.processes.length,1);assert.equal(row.threads.length,2);
  for(const [i,id] of ids.entries()) {
    const context=row.threads.find(t=>t.pid===id.pid&&t.threadId===id.threadId);
    assert.ok(context);assert.equal(context.events[0].operation,'initialized');
    assert.ok(context.events.some(e=>e.operation==='fs.writeFileSync'&&e.target===path.join(root,`worker-${i}.json`)));
  }
  assert.equal(report.ok,false);assert.equal(report.coverage.workerThreadLogs,2);
  assert.equal(report.coverage.pidLogs,1);assert.equal(report.coverage.opaqueWorkerCreations,2);
  assert.equal(report.coverage.workerCoverageComplete,false);
  const file=path.join(commands[0].env.PSR_WRITE_AUDIT_DIR,`${ids[0].pid}.thread-${ids[0].threadId}.jsonl`);
  const original=fs.readFileSync(file,'utf8');
  for(const mutate of [e=>e.threadId++,e=>delete e.threadId,e=>e.pid++]) {
    const lines=original.trimEnd().split('\n').map(JSON.parse);mutate(lines[0]);fs.writeFileSync(file,lines.map(JSON.stringify).join('\n')+'\n');
    assert.throws(()=>collect(commands,trace(commands[0],audited)));fs.writeFileSync(file,original);
  }
  fs.appendFileSync(file,original.split('\n')[0]+'\n');assert.throws(()=>collect(commands,trace(commands[0],audited)),/initialization/);fs.writeFileSync(file,original);
  // Existing PID-only logs remain valid. Do not reinterpret an old log as a worker.
  const mainFile=path.join(commands[0].env.PSR_WRITE_AUDIT_DIR,`${audited.pid}.jsonl`);
  const legacy=fs.readFileSync(mainFile,'utf8').trimEnd().split('\n').map(JSON.parse);
  for(const e of legacy)delete e.threadId;
  fs.writeFileSync(mainFile,legacy.map(JSON.stringify).join('\n')+'\n');
  assert.equal(collect(commands,trace(commands[0],audited)).ok,false);
  const sanitized=prepare([{...command,label:'sanitized-worker',args:['-e',script(true)]}],path.join(root,'sanitized'));
  const hidden=run(sanitized[0]), incomplete=collect(sanitized,trace(sanitized[0],hidden));
  assert.deepEqual(hidden.stdout,baseline.stdout);assert.deepEqual(hidden.stderr,baseline.stderr);
  assert.ok(JSON.parse(fs.readFileSync(path.join(root,'worker-0.json'),'utf8')).threadId>0,'unobserved worker really wrote');
  assert.equal(incomplete.commands[0].threads.length,0);assert.equal(incomplete.coverage.opaqueWorkerCreations,1);
  assert.equal(incomplete.ok,false);assert.equal(incomplete.coverage.workerCoverageComplete,false);
  const hiddenLog=path.join(sanitized[0].env.PSR_WRITE_AUDIT_DIR,`${hidden.pid}.jsonl`);
  const opaqueOnly=fs.readFileSync(hiddenLog,'utf8').trimEnd().split('\n').map(JSON.parse)
    .filter(e=>e.operation==='initialized'||e.operation==='worker_threads.Worker');
  fs.writeFileSync(hiddenLog,opaqueOnly.map(JSON.stringify).join('\n')+'\n');
  const isolated=collect(sanitized,trace(sanitized[0],hidden));
  assert.equal(isolated.commands[0].findings.length,1);assert.equal(isolated.ok,false,'worker creation alone needs review');
  console.log('Write worker contexts: PASS (distinct threads, real writes, sanitized gap, byte parity; no completeness qualification)');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
