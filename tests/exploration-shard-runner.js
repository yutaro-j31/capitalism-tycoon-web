'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SHARD_COUNT, shardCases } = require('./exploration-case-matrix');
const { writeJSONLine } = require('./exploration-runner');
const { runProcessCase } = require('./exploration-process-runner');

async function main() {
  const shard = Number(process.env.SHARD_INDEX ?? process.argv[2]);
  const shardCount = Number(process.env.SHARD_COUNT || SHARD_COUNT);
  assert.equal(shardCount, SHARD_COUNT, `the checked-in matrix requires ${SHARD_COUNT} shards`);
  const definitions = shardCases(shard, shardCount);
  const outputPath = process.env.EXPLORATION_OUTPUT || path.join('artifacts', `exploration-shard-${shard}.jsonl`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const output = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  try {
    for (const definition of definitions) await writeJSONLine(output, runProcessCase(definition));
  } finally {
    output.end();
    await new Promise((resolve, reject) => output.on('finish', resolve).on('error', reject));
  }
  console.log(`exploration shard ${shard}/${shardCount} completed: ${definitions.length} cases -> ${outputPath}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
