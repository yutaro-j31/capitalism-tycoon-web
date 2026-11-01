'use strict';
// Read-only metadata audit. Never executes a phase or qualifies parallel H.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto'), cp = require('node:child_process');
const runner = require('./parallel-shard-runner');
const catalog = [
  { label: 'tests/map-phase2-lazy-load-recovery-test.js', sha256: '5e0d3090fd12b2a8e8e37bf4baa7ca195dc0ec17476eff1063307208a8214910',
    targets: ['js/_scratch-lazy-load-negtest.js'] },
  { label: 'tests/static-asset-cache-coherence-test.js', sha256: '36ef79dbc628b975e28b55fa0aef7473388fa4ddb7ee4ce1013f65b4ab9a2c39',
    targets: ['css/d-ui-map-phase2-markers.css', 'prototypes/map-world-preview.js'] }
];
function manifest(root, pinnedSha) {
  root = path.resolve(root); assert.match(pinnedSha, /^[a-f0-9]{40}$/, 'full source SHA required');
  const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(git(['rev-parse', 'HEAD']), pinnedSha, 'source must match the explicit pin');
  assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '', 'tracked source must be clean');
  assert.equal(fs.lstatSync(path.join(root, 'js/_scratch-lazy-load-negtest.js'), { throwIfNoEntry: false }),
    undefined, 'known scratch target must be absent, including dangling links');
  const commands = runner.enumerateShard('H', { root });
  const knownWriters = catalog.flatMap(entry => {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, entry.label))).digest('hex'),
      entry.sha256, 'known writer source changed: review the catalog');
    const matches = commands.filter(c => c.label === entry.label);
    assert.ok(matches.length, `known writer invocation missing: ${entry.label}`);
    return matches.map(c => ({ index: c.index, label: c.label, sourceSha256: entry.sha256, targets: entry.targets.slice() }));
  });
  return { shard: 'H', sourceSha: pinnedSha, enumerationDigest: runner.digestOf(commands), commands, knownWriters,
    catalogExhaustive: false, parallelExecutionQualified: false, productionAuthorized: false };
}
function candidatePlan(expected) {
  const writers = new Set(expected.knownWriters.map(w => w.index));
  const phases = [...writers].sort((a,b) => a-b).map(index => [index]);
  const others = expected.commands.map(c => c.index).filter(index => !writers.has(index));
  if (others.length) phases.push(others);
  return { sourceSha: expected.sourceSha, enumerationDigest: expected.enumerationDigest, phases };
}
function auditDeclaredPhases(expected, plan) {
  assert.deepEqual(expected.commands.map(c => c.index), expected.commands.map((_, i) => i), 'canonical invocation indices required');
  assert.equal(runner.digestOf(expected.commands), expected.enumerationDigest, 'manifest enumeration mismatch');
  assert.equal(plan.sourceSha, expected.sourceSha, 'plan source pin mismatch');
  assert.equal(plan.enumerationDigest, expected.enumerationDigest, 'plan enumeration mismatch');
  assert.ok(Array.isArray(plan.phases) && plan.phases.length, 'nonempty declared phases required');
  const seen = new Set(), writers = new Set(expected.knownWriters.map(w => w.index));
  for (const phase of plan.phases) {
    assert.ok(Array.isArray(phase) && phase.length, 'nonempty phase required');
    for (const index of phase) {
      assert.ok(Number.isSafeInteger(index) && index >= 0 && index < expected.commands.length, 'unknown invocation index');
      assert.ok(!seen.has(index), 'duplicate invocation'); seen.add(index);
      if (writers.has(index)) assert.equal(phase.length, 1, 'known writer must occupy a singleton phase');
    }
  }
  assert.equal(seen.size, expected.commands.length, 'all invocations must be preserved');
  return { status: 'known-writer-boundaries-verified', sourceSha: expected.sourceSha,
    enumerationDigest: expected.enumerationDigest, commandCount: seen.size, phaseSizes: plan.phases.map(p => p.length),
    isolatedWriterInvocations: writers.size, otherCommandsUnqualified: seen.size - writers.size,
    catalogExhaustive: false, parallelExecutionQualified: false, productionAuthorized: false };
}
module.exports = { manifest, candidatePlan, auditDeclaredPhases };
if (require.main === module) {
  try {
    const [mode, root, pin, file] = process.argv.slice(2);
    assert.ok((mode === 'manifest' && process.argv.length === 5) || (mode === 'audit' && process.argv.length === 6),
      'usage: h-boundaries.cjs manifest ROOT SHA | audit ROOT SHA PLAN_JSON');
    const expected = manifest(root, pin);
    console.log(JSON.stringify(mode === 'manifest' ? { manifest: expected, candidatePlan: candidatePlan(expected) }
      : auditDeclaredPhases(expected, JSON.parse(fs.readFileSync(file, 'utf8'))), null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
