'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os');
const path = require('node:path'), cp = require('node:child_process');
const { observe } = require('./parallel-shard-cgroup-memory-window.cjs');
const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cgroup-window-')), root = path.join(parent, 'group');
const write = (name, value) => fs.writeFileSync(path.join(root, name), value);
function reset() {
  fs.mkdirSync(root, { recursive: true });
  for (const [name, value] of Object.entries({ 'memory.current': '100', 'memory.max': 'max', 'memory.high': '80',
    'memory.events': 'high 7\noom_kill 2\n', 'memory.events.local': 'high 3\noom_kill 0\n' })) write(name, value);
}
try {
  reset();
  let calls = 0;
  const result = observe(root, 1, { pause: ms => {
    assert.equal(ms, 1); calls++;
    write('memory.events', 'high 10\noom_kill 3\n'); write('memory.events.local', 'high 4\noom_kill 0\n');
    write('memory.current', '60'); write('memory.high', 'max');
  } });
  assert.equal(calls, 1); assert.equal(result.elapsedSeconds >= 0, true);
  assert.deepEqual(result.eventDeltas.events.counters, { high: { status: 'observed', delta: 3 }, oom_kill: { status: 'observed', delta: 1 } });
  assert.deepEqual(result.eventDeltas.localEvents.counters, { high: { status: 'observed', delta: 1 }, oom_kill: { status: 'observed', delta: 0 } });
  assert.equal(result.currentChangeBytes, -40); assert.equal(result.completeEventDeltas, true);
  assert.deepEqual(result.limitsChanged, { max: false, high: true });
  assert.equal(result.before.observations.events.counters.oom_kill, 2);
  assert.equal(result.after.observations.events.counters.oom_kill, 3);
  for (const flag of ['atomicSnapshot', 'peakMeasured', 'cgroupAssociationVerified', 'workloadCauseEstablished', 'parallelExecutionQualified', 'productionAuthorized']) assert.equal(result[flag], false);
  assert.equal(result.directoryHandlePinned, true);
  reset();
  const partial = observe(root, 1, { pause: () => {
    write('memory.events', 'high 6\nnew_key 1\n'); fs.unlinkSync(path.join(root, 'memory.events.local'));
    write('memory.max', 'invalid'); write('memory.current', 'invalid');
  } });
  assert.deepEqual(partial.eventDeltas.events.counters, { high: { status: 'decreased', delta: null }, new_key: { status: 'missing-before', delta: null }, oom_kill: { status: 'missing-after', delta: null } });
  assert.deepEqual(partial.eventDeltas.localEvents, { status: 'unavailable', counters: null });
  assert.equal(partial.completeEventDeltas, false); assert.equal(partial.currentChangeBytes, null); assert.equal(partial.limitsChanged.max, null);
  // Critical identity regression: the same path now names an unrelated group.
  reset(); const old = path.join(parent, 'original');
  const pinned = observe(root, 1, { pause: () => {
    fs.renameSync(root, old); reset(); write('memory.events', 'high 999\noom_kill 999');
  } });
  assert.equal(pinned.after.observations.events.counters.high, 7);
  assert.equal(pinned.eventDeltas.events.counters.high.delta, 0);
  assert.equal(pinned.directoryIdentity.inode, fs.statSync(old, { bigint: true }).ino.toString());
  assert.notEqual(pinned.directoryIdentity.inode, fs.statSync(root, { bigint: true }).ino.toString());
  assert.throws(() => observe(root, 1, { pause: () => { throw new Error('interrupted'); } }), /interrupted/);
  for (const ms of [0, -1, 1.5, 10001, NaN, '1']) assert.throws(() => observe(root, ms));
  const command = path.join(__dirname, 'parallel-shard-cgroup-memory-window.cjs');
  const beforeFiles = fs.readdirSync(root).map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]);
  const cli = JSON.parse(cp.execFileSync(process.execPath, [command, root, '1'], { encoding: 'utf8' }));
  assert.equal(cli.completeEventDeltas, true); assert.equal(cli.eventDeltas.events.counters.high.delta, 0);
  for (const [name, content] of beforeFiles) assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), content);
  const invalid = cp.spawnSync(process.execPath, [command, root, '0'], { encoding: 'utf8' });
  assert.notEqual(invalid.status, 0); assert.equal(invalid.stdout, '');
} finally { fs.rmSync(parent, { recursive: true, force: true }); }
console.log('cgroup memory window: PASS (pinned-directory replacement, partial/reset counters, CLI; synthetic only)');
