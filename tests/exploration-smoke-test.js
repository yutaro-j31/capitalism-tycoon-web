'use strict';

const assert = require('node:assert/strict');
const { outcomeSignature, runSegment } = require('./exploration-runner');
const { runProcessCase } = require('./exploration-process-runner');

const definition = Object.freeze({ caseId: 'ramen--easy--prudent--2119631105', businessID: 'ramen', difficulty: 'easy', playStyle: 'prudent', seed: 2119631105 });
const segments = [];
const segmented = runProcessCase(definition, { segmentWeeks: 100, onSegment: value => segments.push(value) });
const continuous100 = runSegment(definition, null, 100).result;
const segmented100 = runProcessCase(definition, { segmentWeeks: 50, totalWeeks: 100 });

assert.ok(segmented.gameOver || segmented.weeksPlayed === 1000, `segmented run stopped early: ${JSON.stringify(segmented)}`);
if (!segmented.gameOver) assert.equal(segmented.finalGameWeek, 1001);
assert.deepEqual(outcomeSignature(segmented100), outcomeSignature(continuous100));
if (!segmented.gameOver) assert.equal(segments.length, 10, '1000 weeks must execute in ten isolated processes');
assert.ok(segmented.maxRSSBytes > 0);
console.log(`EXPLORATION_1000_WEEK_SMOKE ${JSON.stringify({ segmented, parity: { continuous100, segmented100 }, segments })}`);
