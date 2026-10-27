'use strict';

const childProcess = require('node:child_process');
const path = require('node:path');
const shardConfig = require('./run-all-shards.json');

const selectedShard = process.env.TEST_SHARD || '';
const contractOnly = process.env.TEST_SHARD_CONTRACT === '1';
const validShards = new Set(['A', ...Object.keys(shardConfig)]);
if (!validShards.has(selectedShard)) {
  console.error(`Unknown TEST_SHARD: ${selectedShard || '(empty)'}`);
  process.exit(2);
}

const heavyOwner = new Map();
for (const [shard, labels] of Object.entries(shardConfig)) {
  if (!Array.isArray(labels)) throw new Error(`Shard ${shard} must be an array`);
  for (const label of labels) {
    if (heavyOwner.has(label)) {
      throw new Error(`Duplicate shard assignment for ${label}: ${heavyOwner.get(label)} and ${shard}`);
    }
    heavyOwner.set(label, shard);
  }
}

const originalSpawnSync = childProcess.spawnSync;
const seen = new Set();
const executed = [];
// Opt-in parallel execution (stage 1): TEST_SHARD_PARALLELISM=N (N >= 2) on a shard enabled in
// scripts/parallel-shard-runner.config.json. Unset, empty, 1, invalid or not enabled -> the serial code below, unchanged.
const parallelism = process.env.TEST_SHARD_PARALLELISM && !contractOnly
  ? require('../scripts/parallel-shard-runner').parseParallelism(process.env.TEST_SHARD_PARALLELISM, selectedShard, require('../scripts/parallel-shard-runner').loadConfig)
  : 1;
const planned = [];

function commandLabel(command, args = []) {
  if (command === 'npm' && args[0] === 'run') return String(args[1] || 'npm-run');
  if (command === 'node' && args[0]) return path.relative(process.cwd(), String(args[0]));
  return [command, ...args].join(' ');
}

function ownerFor(label) {
  return heavyOwner.get(label) || 'A';
}

childProcess.spawnSync = function shardedSpawnSync(command, args, options) {
  const label = commandLabel(command, args);
  seen.add(label);
  if (contractOnly || ownerFor(label) !== selectedShard) {
    return { status: 0, signal: null, stdout: '', stderr: '', pid: 0, output: [null, '', ''] };
  }
  if (parallelism > 1) {
    planned.push({ index: planned.length, label, command, args: [...(args || [])] });
    return { status: 0, signal: null, stdout: '', stderr: '', pid: 0, output: [null, '', ''] };
  }
  const startedAt = process.hrtime.bigint();
  const result = originalSpawnSync.call(this, command, args, options);
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  executed.push({ label, elapsedMs });
  console.log(`::notice title=Shard ${selectedShard} timing::${label} ${(elapsedMs / 1000).toFixed(3)}s`);
  return result;
};

function validateAssignments() {
  const missingConfigured = [...heavyOwner.keys()].filter(label => !seen.has(label));
  if (missingConfigured.length) {
    console.error(`Configured shard entries not found in run-all.js or the execution registry: ${missingConfigured.join(', ')}`);
    process.exitCode = 1;
  }
  for (const label of seen) {
    const owner = ownerFor(label);
    if (!validShards.has(owner)) {
      console.error(`No valid shard owner for ${label}`);
      process.exitCode = 1;
    }
  }
  const assignedCount = [...seen].filter(label => validShards.has(ownerFor(label))).length;
  if (assignedCount !== seen.size) {
    console.error(`Every canonical entry must belong to exactly one shard: assigned=${assignedCount} seen=${seen.size}`);
    process.exitCode = 1;
  }
}

function runRegisteredNodeTest(name, file) {
  const result = childProcess.spawnSync('node', [file], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false
  });
  if (result.status !== 0 || result.signal || result.error) {
    console.error(`::error title=Test suite failed::${name}`);
    if (result.signal || result.error) console.error(`abnormal exit: signal=${result.signal} error=${result.error && (result.error.code || result.error.message)}`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

process.on('exit', () => {
  validateAssignments();
  const totalMs = executed.reduce((sum, item) => sum + item.elapsedMs, 0);
  console.log(`canonical-test-shard-summary: shard=${selectedShard} contractOnly=${contractOnly} executed=${executed.length} seen=${seen.size} total=${(totalMs / 1000).toFixed(3)}s`);
});

runRegisteredNodeTest('product-recall-reachability', 'tests/product-recall-reachability-runner.js');
if (parallelism > 1) {
  // run-all.js only enumerates here (every spawnSync above is a recording stub), so silence its per-command
  // "done in 0.0s" lines and its final "all tests passed" line, which would otherwise print before anything ran.
  const log = console.log;
  console.log = () => {};
  try { require('./run-all'); } finally { console.log = log; }
  require('../scripts/parallel-shard-runner').runShard({ shard: selectedShard, planned, concurrency: parallelism, executed })
    .then(code => { if (code) process.exit(code); }, error => { console.error(error); process.exit(3); });
} else {
  require('./run-all');
}
