'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SEEDS } = require('./strategy-balance-runner');

const STYLES = Object.freeze(['growth-reinvestment','balanced-returns','cash-hoarder']);
const CASE_SCRIPT = path.join(__dirname, 'shareholder-activism-incidence-case.js');

function runCase(style, seed) {
  const result = spawnSync(process.execPath, [CASE_SCRIPT, style, String(seed)], {
    encoding:'utf8', maxBuffer:64*1024*1024, timeout:10*60*1000
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    assert.fail(`${style} seed ${seed} case failed with status ${result.status}`);
  }
  const line = result.stdout.split(/\r?\n/).find(row => row.startsWith('SHAREHOLDER_ACTIVISM_INCIDENCE_CASE '));
  assert(line, `${style} seed ${seed} emits a case summary`);
  return JSON.parse(line.slice('SHAREHOLDER_ACTIVISM_INCIDENCE_CASE '.length));
}

function runMatrix() {
  const results=[];
  for (const style of STYLES) for (const seed of SEEDS) results.push(runCase(style, seed));
  return results;
}

const first=runMatrix();
const second=runMatrix();
assert.deepEqual(first,second,'full activism incidence matrix is deterministic');

for (const style of STYLES) {
  const rows=first.filter(row=>row.style===style);
  const encounters=rows.filter(row=>row.campaignCount>0).length;
  const campaigns=rows.reduce((sum,row)=>sum+row.campaignCount,0);
  console.log(`shareholder-activism-incidence: style=${style} cases=${rows.length} encounters=${encounters} campaigns=${campaigns} rate=${(encounters/rows.length).toFixed(3)}`);
}
console.log(`SHAREHOLDER_ACTIVISM_INCIDENCE_MATRIX ${JSON.stringify(first)}`);
console.log('shareholder activism incidence matrix passed');
