'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BUSINESSES, DIFFICULTIES, PLAY_STYLES, SEEDS, cases, shardCases, SHARD_COUNT } = require('./exploration-case-matrix');
const { STYLE_LOGIC } = require('./exploration-runner');

const matrix = cases();
assert.equal(matrix.length, 1053);
assert.equal(BUSINESSES.length, 13);
assert.equal(DIFFICULTIES.length, 3);
assert.equal(PLAY_STYLES.length, 9);
assert.deepEqual(SEEDS, [2119631105, 2119631362, 2119631619]);
assert.deepEqual(Object.keys(STYLE_LOGIC), PLAY_STYLES);
assert.equal(new Set(matrix.map(row => row.caseId)).size, 1053);
const shards = Array.from({ length: SHARD_COUNT }, (_, index) => shardCases(index));
assert.equal(shards.flat().length, 1053);
assert.ok(shards.every(rows => rows.length === 27), '1053 cases must be evenly divided into 39 shards');
for (const rows of shards) {
  assert.equal(new Set(rows.map(row => row.businessID)).size, 1);
  assert.equal(new Set(rows.map(row => row.difficulty)).size, 1);
  assert.equal(new Set(rows.map(row => row.playStyle)).size, 9);
  assert.equal(new Set(rows.map(row => row.seed)).size, 3);
}
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'exploration-1000-week.yml'), 'utf8');
assert.match(workflow, /shard:\s*\[0, 1, 2,[\s\S]*38\]/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /fail-fast:\s*false/);
assert.match(workflow, /max-parallel:\s*2/);
assert.match(workflow, /aggregate:/);
console.log('exploration infrastructure checks passed');
