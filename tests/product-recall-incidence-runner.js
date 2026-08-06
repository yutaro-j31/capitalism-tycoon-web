'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const STYLES = ['neglected-lean', 'timely-quality', 'healthy-standard'];
const SEEDS = [0x8f300101, 0x8f300202, 0x8f300303];
const script = path.join(__dirname, 'product-recall-incidence-case.js');

function run(style, seed) {
  const result = spawnSync(process.execPath, [script, style, String(seed)], {
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    assert.fail(`${style}-${seed} failed with status ${result.status}`);
  }
  const line = result.stdout.split(/\r?\n/).find(value => value.startsWith('PRODUCT_RECALL_INCIDENCE_CASE '));
  assert(line, `missing product recall incidence output for ${style}-${seed}`);
  return JSON.parse(line.slice('PRODUCT_RECALL_INCIDENCE_CASE '.length));
}

function assertStyle(row) {
  assert.equal(row.riskHistory, 52, `risk history must remain bounded: ${JSON.stringify(row)}`);
  assert(row.recallHistory <= 52, `recall history must remain bounded: ${JSON.stringify(row)}`);
  assert(row.recallCount <= 4, `52-week cooldown must bound recall count: ${JSON.stringify(row)}`);
  if (row.style === 'neglected-lean') {
    assert(row.recallCount >= 1, `neglected lean maintenance must encounter a recall: ${JSON.stringify(row)}`);
    assert(row.firstRecallWeek !== null && row.firstRecallWeek <= 208, JSON.stringify(row));
    assert(row.cumulativeLostRevenue > 0, JSON.stringify(row));
  } else if (row.style === 'timely-quality') {
    assert.equal(row.recallCount, 0, `timely quality intervention must avoid recall: ${JSON.stringify(row)}`);
    assert(row.maintenanceChangeWeek !== null, JSON.stringify(row));
    assert.equal(row.finalMaintenancePolicy, 'intensive', JSON.stringify(row));
    assert(row.profitableRatio >= 0.8, `timely control must remain genuinely profitable: ${JSON.stringify(row)}`);
    assert(row.finalProfit > 0, `timely control final product must be profitable: ${JSON.stringify(row)}`);
  } else {
    assert.equal(row.recallCount, 0, `healthy standard maintenance must avoid recall: ${JSON.stringify(row)}`);
    assert.equal(row.finalMaintenancePolicy, 'standard', JSON.stringify(row));
    assert(row.profitableRatio >= 0.8, `healthy control must remain genuinely profitable: ${JSON.stringify(row)}`);
    assert(row.finalProfit > 0, `healthy control final product must be profitable: ${JSON.stringify(row)}`);
  }
}

const requestedStyle = String(process.env.PRODUCT_RECALL_STYLE || '');
const requestedSeed = Number(process.env.PRODUCT_RECALL_SEED);
assert(STYLES.includes(requestedStyle), `invalid PRODUCT_RECALL_STYLE: ${requestedStyle}`);
assert(SEEDS.includes(requestedSeed), `invalid PRODUCT_RECALL_SEED: ${process.env.PRODUCT_RECALL_SEED}`);

const first = run(requestedStyle, requestedSeed);
const second = run(requestedStyle, requestedSeed);
assert.deepEqual(first, second, 'product recall incidence case must be deterministic');
assertStyle(first);
console.log(`PRODUCT_RECALL_INCIDENCE_MATRIX ${JSON.stringify([first])}`);
console.log('product recall incidence matrix case passed');
