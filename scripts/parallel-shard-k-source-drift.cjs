'use strict';
// Metadata and committed-file comparison only; no archive/runtime requalification.
const assert = require('node:assert/strict'), cp = require('node:child_process');
const path = require('node:path');
const { expectedFrom } = require('./parallel-shard-k-evidence-audit.cjs');
function snapshot(root, pin) {
  assert.match(pin, /^[a-f0-9]{40}$/, 'explicit full source SHA required');
  const expected = expectedFrom(root, pin); // clean exact pin; enumeration/contract only
  assert.equal(expected.commands.length, 29, 'full K29 command contract required');
  const raw = cp.execFileSync('git', ['ls-tree', '-rz', '--full-tree', pin], { cwd: root, encoding: 'utf8' });
  const files = new Map(raw.split('\0').filter(Boolean).map(row => {
    const tab = row.indexOf('\t'), [mode, type, oid] = row.slice(0, tab).split(' ');
    assert.ok(tab > 0); assert.match(oid, /^[a-f0-9]{40}$/);
    return [row.slice(tab + 1), { mode, type, oid }];
  }));
  return { expected, files };
}
function compareRoots(baselineRoot, baselinePin, currentRoot, currentPin) {
  const before = snapshot(baselineRoot, baselinePin), after = snapshot(currentRoot, currentPin);
  const direct = new Set(), unresolvedCommands = [];
  for (const [source, snap] of [['baseline', before], ['current', after]]) {
    for (const command of snap.expected.commands) {
      const file = command.args[0];
      if (command.command === 'node' && typeof file === 'string' && !file.startsWith('-') &&
          !path.posix.isAbsolute(file) && path.posix.normalize(file) === file && !file.startsWith('../')) direct.add(file);
      else unresolvedCommands.push({ source, index: command.index, label: command.label });
    }
  }
  const same = (a, b) => Boolean(a && b && a.mode === b.mode && a.type === b.type && a.oid === b.oid);
  const changes = [...new Set([...before.files.keys(), ...after.files.keys()])].sort().flatMap(file => {
    const old = before.files.get(file), next = after.files.get(file);
    return same(old, next) ? [] : [{ path: file, status: !old ? 'added' : !next ? 'deleted' : 'modified',
      baseline: old ?? null, current: next ?? null }];
  });
  const describe = snap => ({ sourceSha: snap.expected.sha, commandCount: snap.expected.commands.length,
    enumerationDigest: snap.expected.digest, registrySeen: snap.expected.seen, runnerSha256: snap.expected.runnerSha256 });
  return { schema: 'k-source-drift-v1', baseline: describe(before), current: describe(after),
    sameKCommandContract: before.expected.digest === after.expected.digest,
    registrySeenMatches: before.expected.seen === after.expected.seen,
    runnerMatches: before.expected.runnerSha256 === after.expected.runnerSha256,
    trackedTreeMatches: changes.length === 0,
    directInputPathCount: direct.size, unresolvedCommands,
    unresolvedDirectFiles: [...direct].sort().filter(file => [before, after].some(s => {
      const entry = s.files.get(file); return !entry || entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode);
    })),
    changedDirectInputs: changes.filter(c => direct.has(c.path)),
    otherTrackedChanges: changes.filter(c => !direct.has(c.path)),
    // All other tracked changes require review; none are declared runtime-irrelevant.
    runtimeExecuted: false, dependencyClosureVerified: false,
    evidenceRequalified: false, productionAuthorized: false };
}
module.exports = { compareRoots };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 6, 'usage: k-source-drift.cjs BASELINE_ROOT BASELINE_SHA CURRENT_ROOT CURRENT_SHA');
    console.log(JSON.stringify(compareRoots(...process.argv.slice(2)), null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
