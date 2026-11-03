'use strict';
// Explicit-directory, read-only cgroup-v2 observations, never a workload gate.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const fields = [
  ['current', 'memory.current', 'bytes'], ['max', 'memory.max', 'limit'],
  ['high', 'memory.high', 'limit'], ['events', 'memory.events', 'events'],
  ['localEvents', 'memory.events.local', 'events']
];
function integer(text) {
  assert.match(text, /^\d+$/);
  const value = Number(text); assert.ok(Number.isSafeInteger(value) && value >= 0);
  return value;
}
function parse(raw, kind) {
  assert.ok(typeof raw === 'string' && Buffer.byteLength(raw) <= 65536, 'bounded text required');
  const text = raw.trim(); assert.ok(text.length > 0, 'empty observation');
  if (kind !== 'events') {
    if (kind === 'limit' && text === 'max') return { status: 'unlimited', bytes: null };
    return { status: 'observed', bytes: integer(text) };
  }
  const counters = new Map();
  for (const line of text.split('\n')) {
    const match = /^([a-z][a-z0-9_]*)\s+(\d+)$/.exec(line.trim());
    assert.ok(match, 'malformed event counter'); assert.ok(!counters.has(match[1]), 'duplicate event counter');
    counters.set(match[1], integer(match[2]));
  }
  // Unknown future keys are retained, absent keys are never invented as zero.
  return { status: 'observed', counters: Object.fromEntries([...counters].sort(([a], [b]) => a.localeCompare(b))) };
}
function capture(root, { readText = file => fs.readFileSync(file, 'utf8'), clock = () => new Date().toISOString() } = {}) {
  assert.ok(typeof root === 'string' && root.trim().length > 0, 'explicit cgroup directory required');
  const directory = path.resolve(root), startedAt = clock(), observations = {};
  for (const [key, file, kind] of fields) {
    const empty = kind === 'events' ? { counters: null } : { bytes: null };
    let raw;
    try { raw = readText(path.join(directory, file)); }
    catch (error) {
      observations[key] = { file, status: ['ENOENT', 'ENOTDIR'].includes(error?.code) ? 'missing' : 'error',
        raw: null, ...empty, errorCode: typeof error?.code === 'string' ? error.code : null };
      continue;
    }
    try { observations[key] = { file, raw, ...parse(raw, kind) }; }
    catch {
      observations[key] = { file, status: 'invalid', raw: typeof raw === 'string' && Buffer.byteLength(raw) <= 65536 ? raw : null, ...empty };
    }
  }
  return { schema: 'cgroup-memory-observation-v1', directory, startedAt, completedAt: clock(), observations,
    observationsComplete: Object.values(observations).every(o => ['observed', 'unlimited'].includes(o.status)),
    atomicSnapshot: false, cgroupAssociationVerified: false, intervalDeltasMeasured: false,
    workloadCauseEstablished: false, parallelExecutionQualified: false, productionAuthorized: false };
}
module.exports = { capture };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 3, 'usage: node parallel-shard-cgroup-memory.cjs EXPLICIT_CGROUP_DIRECTORY');
    console.log(JSON.stringify(capture(process.argv[2]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
