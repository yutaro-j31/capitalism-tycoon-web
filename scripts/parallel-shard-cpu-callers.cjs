'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');

function indexTree(nodes) {
  assert.ok(Array.isArray(nodes) && nodes.length, 'profile nodes required');
  const frames = new Map();
  const parents = new Map();
  for (const { id, callFrame, children = [] } of nodes) {
    assert.ok(Number.isSafeInteger(id) && id > 0 && !frames.has(id), 'unique positive node ID required');
    const { functionName, url, lineNumber, columnNumber } = callFrame;
    assert.ok(typeof functionName === 'string' && typeof url === 'string', 'invalid frame label');
    for (const value of [lineNumber, columnNumber]) {
      assert.ok(Number.isSafeInteger(value) && value >= -1, 'invalid frame location');
    }
    frames.set(id, { functionName, url, lineNumber, columnNumber });
    assert.ok(Array.isArray(children), 'invalid child list');
    for (const child of children) {
      assert.ok(!parents.has(child), 'duplicate child or multiple parents');
      parents.set(child, id);
    }
  }
  for (const id of parents.keys()) assert.ok(frames.has(id), 'unknown child node');
  const roots = nodes.filter(({ id }) => !parents.has(id));
  assert.equal(roots.length, 1, 'expected one profile root');
  const pending = [roots[0]];
  const byId = new Map(nodes.map(node => [node.id, node]));
  let visited = 0;
  while (pending.length) {
    visited++;
    for (const child of pending.pop().children ?? []) pending.push(byId.get(child));
  }
  assert.equal(visited, nodes.length, 'profile contains a disconnected cycle');
  return { frames, parents };
}

function summarizeCallers(profile, target) {
  const { frames, parents } = indexTree(profile.nodes);
  assert.ok(Array.isArray(profile.samples) && profile.samples.length, 'profile samples required');
  assert.ok(typeof target.url === 'string' && typeof target.functionName === 'string' &&
    Number.isSafeInteger(target.lineNumber) && target.lineNumber >= -1, 'invalid target frame');
  const countsByNode = new Map();
  for (const id of profile.samples) {
    const frame = frames.get(id);
    assert.ok(frame, 'sample references unknown node');
    if (frame.url === target.url && frame.functionName === target.functionName && frame.lineNumber === target.lineNumber) {
      countsByNode.set(id, (countsByNode.get(id) ?? 0) + 1);
    }
  }
  assert.ok(countsByNode.size, 'target frame has no samples');

  const groups = new Map();
  let targetSampleCount = 0;
  for (const [id, count] of countsByNode) {
    const callers = [];
    for (let caller = parents.get(id); caller !== undefined; caller = parents.get(caller)) {
      callers.push(frames.get(caller));
    }
    const key = JSON.stringify(callers);
    if (!groups.has(key)) groups.set(key, { callers, sampleCount: 0 });
    groups.get(key).sampleCount += count;
    targetSampleCount += count;
  }
  const paths = [...groups.values()].sort((a, b) => b.sampleCount - a.sampleCount);
  const topPaths = paths.slice(0, 10);
  return {
    schema: 'v8-sampled-caller-paths-v1',
    target,
    profileSampleCount: profile.samples.length,
    targetSampleCount,
    pathCount: paths.length,
    omittedSampleCount: targetSampleCount - topPaths.reduce((total, row) => total + row.sampleCount, 0),
    // Closest caller first, including the root frame. No delta is used for these counts.
    topPaths,
    sourceBindingVerified: false,
    timingUsed: false,
  };
}

function read(bytes, expectedSha256, target) {
  assert.match(expectedSha256, /^[a-f0-9]{64}$/);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedSha256, 'profile SHA256 mismatch');
  return { profileSha256: expectedSha256, ...summarizeCallers(JSON.parse(bytes.toString('utf8')), target) };
}

module.exports = { summarizeCallers, read };

if (require.main === module) {
  try {
    assert.equal(process.argv.length, 7, 'usage: parallel-shard-cpu-callers.cjs PROFILE SHA256 URL FUNCTION ZERO_BASED_LINE');
    const [file, expectedSha256, url, functionName, line] = process.argv.slice(2);
    assert.match(line, /^(?:-1|[0-9]+)$/);
    console.log(JSON.stringify(read(readFileSync(file), expectedSha256, { url, functionName, lineNumber: Number(line) }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
