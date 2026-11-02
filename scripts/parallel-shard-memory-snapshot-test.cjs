'use strict';
const assert = require('node:assert/strict');
const { capture } = require('./parallel-shard-memory-snapshot.cjs');
const GiB = 1024 ** 3;
function fixture() {
  let tick = 0;
  return { host: { totalmem: () => 64 * GiB, freemem: () => 48 * GiB },
    proc: { version: 'test-node', platform: 'linux', arch: 'test', constrainedMemory: () => 8 * GiB,
      availableMemory: () => 3 * GiB, memoryUsage: () => ({ rss: 100 * 1024 ** 2 }) },
    engine: { getHeapStatistics: () => ({ heap_size_limit: 4 * GiB }) },
    clock: () => new Date(tick++).toISOString() };
}
const inputs = fixture(), result = capture(inputs);
assert.equal(result.observations.hostPhysical.bytes, 64 * GiB);
assert.equal(result.observations.hostFree.bytes, 48 * GiB);
assert.equal(result.observations.processConstrained.bytes, 8 * GiB);
assert.equal(result.observations.processAvailable.bytes, 3 * GiB);
assert.equal(result.observations.selfRss.bytes, 100 * 1024 ** 2);
assert.equal(result.observations.v8HeapLimit.bytes, 4 * GiB);
assert.notEqual(result.startedAt, result.completedAt);
for (const flag of ['atomicSnapshot', 'peakMeasured', 'processTreeMeasured', 'parallelExecutionQualified', 'productionAuthorized'])
  assert.equal(result[flag], false);
// Preserve native receiver and call each observation once; probes are separate in time.
let calls = 0;
inputs.proc.constrainedMemory = function() { assert.equal(this, inputs.proc); calls++; return 8 * GiB; };
capture(inputs); assert.equal(calls, 1);
const zero = fixture(); zero.proc.constrainedMemory = () => 0; zero.proc.availableMemory = () => 0;
const unknown = capture(zero);
assert.deepEqual(unknown.observations.processConstrained, { source: 'process.constrainedMemory()', status: 'unknown', bytes: null });
assert.equal(unknown.observations.processAvailable.bytes, 0); // zero available is valid; never replaced by host free
assert.equal(unknown.observations.processAvailable.status, 'observed');
const unsupported = fixture(); delete unsupported.proc.constrainedMemory; delete unsupported.proc.availableMemory;
for (const key of ['processConstrained', 'processAvailable']) {
  const value = capture(unsupported).observations[key]; assert.equal(value.status, 'unsupported'); assert.equal(value.bytes, null);
}
for (const bad of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '42', null, undefined]) {
  const f = fixture(); f.proc.availableMemory = () => bad;
  assert.equal(capture(f).observations.processAvailable.status, 'invalid');
  assert.equal(capture(f).observations.processAvailable.bytes, null);
}
const broken = fixture(); broken.proc.constrainedMemory = () => { throw Object.assign(new Error('probe failure'), { code: 'EACCES' }); };
const failed = capture(broken);
assert.equal(failed.observations.processConstrained.status, 'error');
assert.equal(failed.observations.processConstrained.errorCode, 'EACCES');
assert.equal(failed.observations.processConstrained.bytes, null);
assert.equal(failed.observations.hostPhysical.bytes, 64 * GiB); // other evidence survives probe failure
const live = capture();
assert.equal(live.node, process.version); assert.equal(live.observations.selfRss.status, 'observed');
console.log('memory capacity provenance: PASS (point observations only; no workload or memory qualification)');
require('./parallel-shard-cgroup-memory-test.cjs');
