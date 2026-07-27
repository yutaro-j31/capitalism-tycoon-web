'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const { outcomeSignature, runCase } = require('./exploration-runner');
const { runProcessCase } = require('./exploration-process-runner');

const definition = { caseId:'ramen--easy--prudent--2119631105', businessID:'ramen', difficulty:'easy', playStyle:'prudent', seed:2119631105 };
const rssLimit = Number(process.env.CONTINUOUS_RSS_LIMIT || 384 * 1024 * 1024);
const continuous = runCase(definition, { maxRSSBytes: rssLimit });
let segmented = null;
let equivalent = null;
if (continuous.weeksPlayed === 1000) {
  segmented = runProcessCase(definition);
  assert.deepEqual(outcomeSignature(segmented), outcomeSignature(continuous));
  equivalent = true;
}
const report = { rssLimit, continuous, segmented, equivalent, note: equivalent ? '1000-week continuous and 10x100-week outcomes match' : 'continuous run stopped safely at the RSS limit; full equivalence was not asserted' };
fs.mkdirSync('artifacts/exploratory-playtest', { recursive:true });
fs.writeFileSync('artifacts/exploratory-playtest/continuous-equivalence.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
