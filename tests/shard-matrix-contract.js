'use strict';

// run-all-shard.js sends any label run-all-shards.json does not name to shard A, and treats
// every key of that file as a valid shard. Nothing checked that the workflow actually runs
// those shards: adding a shard to the JSON without adding it to the test.yml matrix leaves its
// tests unrun while both the shard contract and the canonical gate stay green.
//
// This guards the other direction too -- a matrix shard with no configuration would spin up a
// runner that executes nothing.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const shardConfig = require(path.join(root, 'tests/run-all-shards.json'));
const workflow = fs.readFileSync(path.join(root, '.github/workflows/test.yml'), 'utf8');

const matrixMatch = workflow.match(/^\s*shard:\s*\[([^\]]+)\]\s*$/m);
assert.ok(matrixMatch, 'test.yml must declare the shard matrix as `shard: [A, B, ...]`');
const matrix = matrixMatch[1].split(',').map(entry => entry.trim()).filter(Boolean);
assert.ok(matrix.length > 0, 'shard matrix must not be empty');
assert.equal(new Set(matrix).size, matrix.length, `shard matrix has duplicates: ${matrix.join(',')}`);

// Shard A is the implicit fallback in run-all-shard.js, so it is always required.
const configured = ['A', ...Object.keys(shardConfig)];
assert.equal(new Set(configured).size, configured.length, 'shard A must not also be a key in run-all-shards.json');

const missingFromMatrix = configured.filter(shard => !matrix.includes(shard));
assert.deepEqual(missingFromMatrix, [], `configured shards missing from the test.yml matrix (their tests would never run): ${missingFromMatrix.join(',')}`);

const missingFromConfig = matrix.filter(shard => !configured.includes(shard));
assert.deepEqual(missingFromConfig, [], `matrix shards with no entry in run-all-shards.json (they would run nothing): ${missingFromConfig.join(',')}`);

console.log(`shard matrix contract ok: ${matrix.join(', ')}`);
