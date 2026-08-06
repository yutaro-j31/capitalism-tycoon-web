'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const STYLES = ['neglected-lean', 'timely-quality', 'healthy-standard'];
const SEEDS = [0x8f300101, 0x8f300202, 0x8f300303];
const TARGETS = Object.freeze({
  'neglected-lean': Object.freeze({ minIncidence: 2 / 3, maxIncidence: 1 }),
  'timely-quality': Object.freeze({ minIncidence: 0, maxIncidence: 1 / 3 }),
  'healthy-standard': Object.freeze({ minIncidence: 0, maxIncidence: 0 })
});
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

function assertCase(row) {
  assert.equal(row.riskHistory, 52, `risk history must remain bounded: ${JSON.stringify(row)}`);
  assert(row.recallHistory <= 52, `recall history must remain bounded: ${JSON.stringify(row)}`);
  assert(row.recallCount <= 4, `52-week cooldown must bound recall count: ${JSON.stringify(row)}`);
  assert.equal(row.finalWeek, 208, `case must complete 208 normal weeks: ${JSON.stringify(row)}`);
  assert(row.minCash > 0, `established-company fixture must remain solvent: ${JSON.stringify(row)}`);
  if (row.style === 'neglected-lean') {
    if (row.recallCount > 0) {
      assert(row.firstRecallWeek !== null && row.firstRecallWeek <= 208, JSON.stringify(row));
      assert(row.cumulativeLostRevenue > 0, JSON.stringify(row));
    }
  } else if (row.style === 'timely-quality') {
    assert(row.maintenanceChangeWeek !== null, JSON.stringify(row));
    assert.equal(row.finalMaintenancePolicy, 'intensive', JSON.stringify(row));
    assert(row.profitableRatio >= 0.8, `timely control must remain genuinely profitable: ${JSON.stringify(row)}`);
    assert(row.finalProfit > 0, `timely control final product must be profitable: ${JSON.stringify(row)}`);
  } else {
    assert.equal(row.finalMaintenancePolicy, 'standard', JSON.stringify(row));
    assert(row.profitableRatio >= 0.8, `healthy control must remain genuinely profitable: ${JSON.stringify(row)}`);
    assert(row.finalProfit > 0, `healthy control final product must be profitable: ${JSON.stringify(row)}`);
  }
}

const rows = [];
for (const style of STYLES) {
  for (const seed of SEEDS) {
    const first = run(style, seed);
    const second = run(style, seed);
    assert.deepEqual(first, second, `${style}-${seed} must be deterministic`);
    assertCase(first);
    rows.push(first);
  }
}

const summary = Object.fromEntries(STYLES.map(style => {
  const cases = rows.filter(row => row.style === style);
  const triggeredCases = cases.filter(row => row.recallCount > 0).length;
  const incidence = triggeredCases / cases.length;
  const target = TARGETS[style];
  assert(
    incidence >= target.minIncidence && incidence <= target.maxIncidence,
    `${style} incidence ${incidence} is outside ${target.minIncidence}-${target.maxIncidence}: ${JSON.stringify(cases)}`
  );
  return [style, {
    triggeredCases,
    totalCases: cases.length,
    incidence: Number(incidence.toFixed(4)),
    targetMin: Number(target.minIncidence.toFixed(4)),
    targetMax: Number(target.maxIncidence.toFixed(4)),
    totalRecalls: cases.reduce((sum, row) => sum + row.recallCount, 0),
    recallCounts: cases.map(row => row.recallCount),
    firstRecallWeeks: cases.map(row => row.firstRecallWeek)
  }];
}));

console.log(`PRODUCT_RECALL_INCIDENCE_MATRIX ${JSON.stringify({ summary, cases: rows })}`);
console.log('product recall incidence matrix passed');