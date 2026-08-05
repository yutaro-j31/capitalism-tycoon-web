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

const requestedStyle = process.env.ACTIVISM_STYLE || STYLES[0];
const requestedSeed = Number(process.env.ACTIVISM_SEED || SEEDS[0]);
assert(STYLES.includes(requestedStyle), 'known ACTIVISM_STYLE is required');
assert(SEEDS.includes(requestedSeed), 'known ACTIVISM_SEED is required');

const first = runCase(requestedStyle, requestedSeed);
const second = runCase(requestedStyle, requestedSeed);
assert.deepEqual(first, second, `${requestedStyle} seed ${requestedSeed} incidence result is deterministic`);
assert.equal(first.campaignsByPath?.portfolioInefficiency||0,0,'store-operation controls cannot trigger the subsidiary portfolio path');
if(requestedStyle==='balanced-returns')assert.equal(first.campaignCount,0,JSON.stringify(first));
if(requestedStyle==='growth-reinvestment')assert.equal(first.campaignCount,0,JSON.stringify(first));
if(requestedStyle==='cash-hoarder'){
  assert(first.campaignCount>=1,JSON.stringify(first));
  assert((first.campaignsByPath?.capitalStagnation||0)>=1,'cash hoarding remains reachable through capital stagnation');
  assert.equal(first.campaignsByPath?.valueDestruction||0,0,'profitable operations prevent false value-destruction incidence');
}

console.log(`shareholder-activism-incidence: style=${requestedStyle} seed=${requestedSeed} encountered=${first.campaignCount > 0} campaigns=${first.campaignCount} firstWeek=${first.firstCampaignWeek ?? 'none'} maxPressure=${first.maxPressure?.score ?? 'none'} paths=${JSON.stringify(first.campaignsByPath||{})}`);
console.log(`SHAREHOLDER_ACTIVISM_INCIDENCE_MATRIX ${JSON.stringify([first])}`);
console.log('shareholder activism incidence matrix case passed');
