'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psr-write-audit-'));
const preload = path.join(__dirname, 'parallel-shard-write-audit.cjs');
function run(name, code, audit) {
  const work = path.join(root, name), logs = path.join(work, 'logs');
  fs.mkdirSync(work); fs.writeFileSync(path.join(work, 'input'), 'input');
  const env = { ...process.env }; delete env.PSR_WRITE_AUDIT_DIR;
  if (audit) { env.PSR_WRITE_AUDIT_DIR = logs; env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require=${JSON.stringify(preload)}`; }
  const result = cp.spawnSync(process.execPath, ['-e', code, work], { env, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.signal, null);
  const events = audit ? fs.readdirSync(logs).flatMap(file => fs.readFileSync(path.join(logs, file), 'utf8').trim().split('\n').map(JSON.parse)) : [];
  return { result, events };
}
function verifyWorkflow(text) {
  const start = text.indexOf('\n  test-shard-contract:'); assert.ok(start >= 0);
  const tail = text.slice(start + 1), next = tail.slice(1).search(/^  [A-Za-z0-9_-]+:\s*$/m);
  const job = next < 0 ? tail : tail.slice(0, next + 1);
  assert.ok(job.includes('run: node scripts/parallel-shard-write-audit-test.cjs'), 'write-audit controls belong to the shard contract job');
}
try {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/test.yml'), 'utf8');
  verifyWorkflow(workflow);
  assert.throws(() => verifyWorkflow(workflow.replace('run: node scripts/parallel-shard-write-audit-test.cjs', 'run: node unrelated.cjs')));
  const quiet = run('quiet', `const fs=require('node:fs');(async()=>{const h=await fs.promises.open(process.argv[1]+'/input','r');await h.readFile();await h.close();console.log('PASS read');})().catch(e=>{console.error(e);process.exitCode=1});`, true);
  assert.deepEqual(quiet.events.map(e => e.operation), ['initialized'], 'read-only control, including audit logging itself, must not produce write events');
  const code = `
    const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),cp=require('node:child_process'),net=require('node:net'),{promisify}=require('node:util');
    const dir=process.argv[1];
    (async()=>{
      fs.writeFileSync(dir+'/out','a');fs.appendFileSync(dir+'/out','b');
      await new Promise((resolve,reject)=>fs.writeFile(dir+'/callback','c',e=>e?reject(e):resolve()));
      await fsp.writeFile(dir+'/promise','p');
      const h=await fsp.open(dir+'/handle','w+');const r=await h.write('h');assert.equal(r.bytesWritten,1);await h.close();
      const fd=fs.openSync(dir+'/descriptor','w');const written=await promisify(fs.write)(fd,Buffer.from('d'));assert.equal(written.bytesWritten,1);fs.closeSync(fd);
      fs.renameSync(dir+'/out',dir+'/renamed');fs.copyFileSync(dir+'/renamed',dir+'/copy');fs.unlinkSync(dir+'/copy');
      assert.throws(()=>fs.writeFileSync(dir+'/missing/out','x'),{code:'ENOENT'});
      const original=process.cwd();process.chdir(dir);process.chdir(original);
      const child=cp.spawnSync(process.execPath,['-e',"process.stdout.write('child')"],{encoding:'utf8'});assert.equal(child.status,0);assert.equal(child.stdout,'child');
      const server=net.createServer();assert.equal(server.listen(0,'127.0.0.1'),server);await new Promise(resolve=>server.once('listening',resolve));await new Promise(resolve=>server.close(resolve));
      console.log('PASS operations');
    })().catch(e=>{console.error(e);process.exitCode=1});`;
  const plain = run('plain', code, false), audited = run('audited', code, true);
  assert.equal(audited.result.stdout, plain.result.stdout, 'instrumentation retains stdout');
  assert.equal(audited.result.stderr, plain.result.stderr, 'instrumentation retains stderr');
  const denied = cp.spawnSync(process.execPath, ['-e', "console.log('BODY MUST NOT RUN')"], {
    env: { ...process.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}`, PSR_WRITE_AUDIT_DIR: path.join(root, 'quiet/input') }, encoding: 'utf8', timeout: 5000 });
  assert.notEqual(denied.status, 0, 'unavailable audit output must fail closed');
  assert.ok(!denied.stdout.includes('BODY MUST NOT RUN'));
  const ops = new Set(audited.events.map(e => e.operation));
  for (const op of ['fs.writeFileSync', 'fs.appendFileSync', 'fs.writeFile', 'fs.promises.writeFile', 'FileHandle.write',
    'fs.openSync', 'fs.write', 'fs.renameSync', 'fs.copyFileSync', 'fs.unlinkSync', 'process.chdir', 'child_process.spawnSync', 'net.listen'])
    assert.ok(ops.has(op), `negative control must expose ${op}`);
  assert.ok(audited.events.some(e => e.operation === 'fs.renameSync' && e.destination.endsWith('/renamed') && path.isAbsolute(e.cwd)), 'destination and cwd must identify shared-write targets');
  assert.equal(audited.events.filter(e => e.operation === 'initialized').length, 2, 'Node child inherited the preload and records its own PID');
  assert.ok(audited.events.filter(e => e.operation === 'initialized').every(e => Number.isInteger(e.pid)));
  assert.ok(audited.events.some(e => e.operation === 'fs.writeFileSync' && e.target.endsWith('/missing/out')), 'attempted failed writes are retained');
  console.log('parallel-shard-write-audit: PASS (read-only, writes, callbacks, promises, descriptors, child, port, output parity)');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
