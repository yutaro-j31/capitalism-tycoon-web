'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os');
const path = require('node:path'), cp = require('node:child_process');
const { capture } = require('./parallel-shard-cgroup-memory.cjs');
const files = { 'memory.current': '0\n', 'memory.max': 'max\n', 'memory.high': '1048576\n',
  'memory.events': 'oom_kill 3\nhigh 7\noom 4\nfuture_event 2\n', 'memory.events.local': 'oom_kill 0\nhigh 1\n' };
const root = path.resolve('/synthetic-cgroup');
function fixture(changes = {}) {
  let tick = 0; const calls = [];
  return { calls, readText: file => {
    assert.equal(path.dirname(file), root); calls.push(path.basename(file));
    const value = { ...files, ...changes }[path.basename(file)];
    if (value instanceof Error) throw value; return value;
  }, clock: () => new Date(tick++).toISOString() };
}
const source = fixture(), result = capture(root, source);
assert.equal(result.directory, root); assert.notEqual(result.startedAt, result.completedAt);
assert.deepEqual(source.calls.sort(), Object.keys(files).sort(), 'only five requested reads, each once');
assert.equal(result.observationsComplete, true);
assert.equal(result.observations.current.bytes, 0);
assert.equal(result.observations.max.status, 'unlimited'); assert.equal(result.observations.max.bytes, null);
assert.equal(result.observations.high.bytes, 1048576);
assert.deepEqual(result.observations.events.counters, { future_event: 2, high: 7, oom: 4, oom_kill: 3 });
assert.deepEqual(result.observations.localEvents.counters, { high: 1, oom_kill: 0 });
assert.equal(Object.hasOwn(result.observations.events.counters, 'low'), false);
assert.equal(result.observations.events.raw, files['memory.events']);
for (const flag of ['atomicSnapshot', 'cgroupAssociationVerified', 'intervalDeltasMeasured',
  'workloadCauseEstablished', 'parallelExecutionQualified', 'productionAuthorized']) assert.equal(result[flag], false);
for (const code of ['ENOENT', 'ENOTDIR', 'EACCES', 'EIO']) {
  const x = capture(root, fixture({ 'memory.events.local': Object.assign(new Error('fixture'), { code }) }));
  assert.equal(x.observationsComplete, false); assert.equal(x.observations.current.bytes, 0);
  assert.equal(x.observations.localEvents.status, ['ENOENT', 'ENOTDIR'].includes(code) ? 'missing' : 'error');
  assert.equal(x.observations.localEvents.counters, null); assert.equal(x.observations.localEvents.errorCode, code);
}
for (const raw of ['', '-1', '1.5', 'Infinity', '9007199254740992', '1\n2', undefined, 'x'.repeat(65537)]) {
  const x = capture(root, fixture({ 'memory.current': raw }));
  assert.equal(x.observations.current.status, 'invalid'); assert.equal(x.observations.current.bytes, null);
  assert.equal(x.observationsComplete, false);
}
for (const raw of ['', 'oom -1', 'oom 1\noom 2', 'oom 1.5', 'oom 9007199254740992', 'oom 1 extra', '__proto__ 0']) {
  const x = capture(root, fixture({ 'memory.events': raw }));
  assert.equal(x.observations.events.status, 'invalid'); assert.equal(x.observations.events.counters, null);
}
const zeroLimit = capture(root, fixture({ 'memory.max': '0\n' }));
assert.equal(zeroLimit.observations.max.status, 'observed'); assert.equal(zeroLimit.observations.max.bytes, 0);
assert.equal(capture(root, fixture({ 'memory.current': 'max' })).observations.current.status, 'invalid');
assert.throws(() => capture(''), /explicit/);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgroup-memory-'));
try {
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), content);
  const command = path.join(__dirname, 'parallel-shard-cgroup-memory.cjs');
  const out = JSON.parse(cp.execFileSync(process.execPath, [command, dir], { encoding: 'utf8' }));
  assert.equal(out.observationsComplete, true); assert.deepEqual(out.observations, result.observations);
  for (const [file, content] of Object.entries(files)) assert.equal(fs.readFileSync(path.join(dir, file), 'utf8'), content, 'capture never writes');
  fs.unlinkSync(path.join(dir, 'memory.events.local'));
  const partial = JSON.parse(cp.execFileSync(process.execPath, [command, dir], { encoding: 'utf8' }));
  assert.equal(partial.observationsComplete, false); assert.equal(partial.observations.localEvents.counters, null);
  const bad = cp.spawnSync(process.execPath, [command], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0); assert.equal(bad.stdout, '');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log('cgroup memory observations: PASS (synthetic files only; no workload/cgroup association or qualification)');
