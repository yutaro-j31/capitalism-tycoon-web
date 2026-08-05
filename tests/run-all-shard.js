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
    console.error(`Configured shard entries not found in run-all.js: ${missingConfigured.join(', ')}`);
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

process.on('exit', () => {
  validateAssignments();
  const totalMs = executed.reduce((sum, item) => sum + item.elapsedMs, 0);
  console.log(`canonical-test-shard-summary: shard=${selectedShard} contractOnly=${contractOnly} executed=${executed.length} seen=${seen.size} total=${(totalMs / 1000).toFixed(3)}s`);
});

require('./run-all');
