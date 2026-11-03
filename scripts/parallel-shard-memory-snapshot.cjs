'use strict';
// Point-in-time capacity provenance; never a memory/parallelism qualification.
const os = require('node:os');
const v8 = require('node:v8');
function observe(source, probe, zeroUnknown = false) {
  if (typeof probe !== 'function') return { source, status: 'unsupported', bytes: null };
  try {
    const value = probe();
    if (!Number.isSafeInteger(value) || value < 0)
      return { source, status: 'invalid', bytes: null };
    if (zeroUnknown && value === 0) return { source, status: 'unknown', bytes: null };
    return { source, status: 'observed', bytes: value };
  } catch (error) {
    return { source, status: 'error', bytes: null, errorCode: typeof error?.code === 'string' ? error.code : null };
  }
}
function capture({ host = os, proc = process, engine = v8, clock = () => new Date().toISOString() } = {}) {
  const startedAt = clock();
  const observations = {
    hostPhysical: observe('os.totalmem()', () => host.totalmem(), true),
    hostFree: observe('os.freemem()', () => host.freemem()),
    processConstrained: observe('process.constrainedMemory()',
      typeof proc.constrainedMemory === 'function' ? () => proc.constrainedMemory() : null, true),
    processAvailable: observe('process.availableMemory()',
      typeof proc.availableMemory === 'function' ? () => proc.availableMemory() : null),
    selfRss: observe('process.memoryUsage().rss', () => proc.memoryUsage().rss),
    v8HeapLimit: observe('v8.getHeapStatistics().heap_size_limit', () => engine.getHeapStatistics().heap_size_limit, true)
  };
  return { schema: 'memory-capacity-point-v1', startedAt, completedAt: clock(), node: proc.version,
    platform: proc.platform, arch: proc.arch, observations,
    atomicSnapshot: false, peakMeasured: false, processTreeMeasured: false,
    parallelExecutionQualified: false, productionAuthorized: false };
}
module.exports = { capture };
if (require.main === module) {
  if (process.argv.length !== 2) { console.error('usage: node parallel-shard-memory-snapshot.cjs'); process.exitCode = 1; }
  else console.log(JSON.stringify(capture(), null, 2));
}
