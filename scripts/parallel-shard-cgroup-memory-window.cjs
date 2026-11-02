'use strict';
// One live Linux directory handle, two read-only points; not a workload gate.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { capture } = require('./parallel-shard-cgroup-memory.cjs');
function events(before, after) {
  if (before.status !== 'observed' || after.status !== 'observed') return { status: 'unavailable', counters: null };
  const counters = Object.fromEntries([...new Set([...Object.keys(before.counters), ...Object.keys(after.counters)])].sort().map(key => {
    const a = before.counters[key], b = after.counters[key];
    if (!Object.hasOwn(before.counters, key)) return [key, { status: 'missing-before', delta: null }];
    if (!Object.hasOwn(after.counters, key)) return [key, { status: 'missing-after', delta: null }];
    return [key, b < a ? { status: 'decreased', delta: null } : { status: 'observed', delta: b - a }];
  }));
  return { status: 'compared', counters };
}
function observe(root, milliseconds, { pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } = {}) {
  assert.equal(process.platform, 'linux', 'live directory-handle observation requires Linux /proc/self/fd');
  assert.ok(typeof root === 'string' && root.trim().length > 0, 'explicit directory required');
  assert.ok(Number.isSafeInteger(milliseconds) && milliseconds >= 1 && milliseconds <= 10000, 'window must be 1..10000 milliseconds');
  const directory = path.resolve(root), fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
  try {
    const stat = fs.fstatSync(fd, { bigint: true }); assert.ok(stat.isDirectory());
    // A reused pathname must not switch the second capture to a replacement.
    const readText = file => fs.readFileSync(`/proc/self/fd/${fd}/${path.basename(file)}`, 'utf8');
    const started = process.hrtime.bigint(), before = capture(directory, { readText });
    pause(milliseconds);
    const after = capture(directory, { readText });
    const elapsedSeconds = Number(process.hrtime.bigint() - started) / 1e9;
    const eventDeltas = Object.fromEntries(['events', 'localEvents'].map(key => [key, events(before.observations[key], after.observations[key])]));
    const limitsChanged = Object.fromEntries(['max', 'high'].map(key => {
      const a = before.observations[key], b = after.observations[key];
      const known = x => ['observed', 'unlimited'].includes(x.status);
      return [key, known(a) && known(b) ? a.status !== b.status || a.bytes !== b.bytes : null];
    }));
    const a = before.observations.current, b = after.observations.current;
    return { schema: 'cgroup-memory-window-v1', directory,
      directoryIdentity: { device: stat.dev.toString(), inode: stat.ino.toString() },
      requestedWindowMs: milliseconds, elapsedSeconds, before, after, eventDeltas, limitsChanged,
      currentChangeBytes: a.status === 'observed' && b.status === 'observed' ? b.bytes - a.bytes : null,
      completeEventDeltas: Object.values(eventDeltas).every(v => v.status === 'compared' && Object.values(v.counters).every(c => c.status === 'observed')),
      directoryHandlePinned: true, atomicSnapshot: false, peakMeasured: false,
      cgroupAssociationVerified: false, workloadCauseEstablished: false,
      parallelExecutionQualified: false, productionAuthorized: false };
  } finally { fs.closeSync(fd); }
}
module.exports = { observe };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 4, 'usage: node parallel-shard-cgroup-memory-window.cjs EXPLICIT_DIRECTORY MILLISECONDS');
    assert.match(process.argv[3], /^\d+$/);
    console.log(JSON.stringify(observe(process.argv[2], Number(process.argv[3])), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
