'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { read, summarizeCallers } = require('./parallel-shard-cpu-callers.cjs');

const node = (id, functionName, children) => ({
  id, callFrame: { functionName, url: 'index.html', lineNumber: 3, columnNumber: 0 }, children,
});
const profile = {
  nodes: [
    node(3, 'hot'), node(1, '(root)', [2, 5]), node(2, 'hash', [3, 4]),
    node(4, 'hot'), node(5, 'save', [6]), node(6, 'hot'),
  ],
  samples: [3, 4, 3, 6, 2],
  timeDeltas: [1, -1, 2, 3, 4],
};
const target = { functionName: 'hot', url: 'index.html', lineNumber: 3 };
const report = summarizeCallers(profile, target);
assert.equal(report.profileSampleCount, 5);
assert.equal(report.targetSampleCount, 4);
assert.deepEqual(report.topPaths.map(row => [row.sampleCount, row.callers.map(frame => frame.functionName)]), [
  [3, ['hash', '(root)']],
  [1, ['save', '(root)']],
]);
assert.equal(report.omittedSampleCount, 0);
assert.equal(report.timingUsed, false);
assert.equal(report.sourceBindingVerified, false);
assert.throws(() => summarizeCallers(profile, { ...target, lineNumber: 2 }), /no samples/);
assert.throws(() => summarizeCallers({ ...profile, samples: [3, 42] }, target), /unknown node/);
assert.throws(() => summarizeCallers({ ...profile, nodes: [...profile.nodes, node(3, 'again')] }, target), /unique positive/);
assert.throws(() => summarizeCallers({ ...profile, nodes: [...profile.nodes, node(7, 'other root')] }, target), /one profile root/);
assert.throws(() => summarizeCallers({ ...profile, nodes: [...profile.nodes, node(7, 'cycle', [7])] }, target), /disconnected cycle/);
for (const [children, error] of [[[6, 42], /unknown child/], [[6, 3], /multiple parents/]]) {
  const invalid = structuredClone(profile);
  invalid.nodes.find(n => n.id === 5).children = children;
  assert.throws(() => summarizeCallers(invalid, target), error);
}

const bytes = Buffer.from(JSON.stringify(profile));
const sha = createHash('sha256').update(bytes).digest('hex');
assert.deepEqual(read(bytes, sha, target), { profileSha256: sha, ...report });
assert.throws(() => read(bytes, '0'.repeat(64), target), /SHA256 mismatch/);

const manyPaths = {
  nodes: [node(1, '(root)', Array.from({ length: 11 }, (_, i) => 2 + i * 2))],
  samples: [],
};
for (let i = 0; i < 11; i++) {
  const parent = 2 + i * 2;
  manyPaths.nodes.push(node(parent, `caller-${i}`, [parent + 1]), node(parent + 1, 'hot'));
  manyPaths.samples.push(parent + 1);
}
const limited = summarizeCallers(manyPaths, target);
assert.equal(limited.pathCount, 11);
assert.equal(limited.topPaths.length, 10);
assert.equal(limited.omittedSampleCount, 1);
console.log('CPU caller paths: PASS');
