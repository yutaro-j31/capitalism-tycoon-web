'use strict';
const assert = require('node:assert/strict'), runner = require('./parallel-shard-runner');
const { candidatePlan, auditDeclaredPhases } = require('./parallel-shard-h-boundaries.cjs');
// Enumeration records metadata without running H workloads. Synthetic source pin:
// these controls do not constitute current-source or runtime safety qualification.
const commands = runner.enumerateShard('H');
const labels = new Set(['tests/map-phase2-lazy-load-recovery-test.js', 'tests/static-asset-cache-coherence-test.js']);
const knownWriters = commands.filter(c => labels.has(c.label));
assert.ok(knownWriters.length >= 2);
const expected = { sourceSha: 'a'.repeat(40), enumerationDigest: runner.digestOf(commands), commands, knownWriters };
const plan = candidatePlan(expected), original = structuredClone(plan), report = auditDeclaredPhases(expected, plan);
assert.deepEqual(plan, original, 'read-only plan audit');
assert.equal(report.commandCount, commands.length);
assert.equal(report.isolatedWriterInvocations, knownWriters.length);
assert.equal(report.otherCommandsUnqualified, commands.length - knownWriters.length);
assert.equal(report.parallelExecutionQualified, false); assert.equal(report.productionAuthorized, false);
for (const mutate of [
  p => p.phases[0].push(p.phases.at(-1).shift()),
  p => p.phases[0].push(p.phases[1].shift()),
  p => p.phases.at(-1).pop(),
  p => p.phases.at(-1).push(p.phases.at(-1)[0]),
  p => p.phases.at(-1).push(commands.length),
  p => p.phases.at(-1).push('0'),
  p => p.phases.push([]),
  p => p.sourceSha = 'b'.repeat(40),
  p => p.enumerationDigest = 'wrong',
  p => p.phases = []
]) { const bad = structuredClone(plan); mutate(bad); assert.throws(() => auditDeclaredPhases(expected, bad)); }
// Invocation indices preserve even deliberately repeated command identities.
const repeated = commands.find(c => !labels.has(c.label));
const duplicated = { ...expected, commands: [...commands, { ...repeated, index: commands.length }] };
duplicated.enumerationDigest = runner.digestOf(duplicated.commands);
assert.equal(auditDeclaredPhases(duplicated, candidatePlan(duplicated)).commandCount, commands.length + 1);
const recorded = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,
  '../docs/ci-evidence/h-declared-boundaries-3e183996.json'), 'utf8'));
assert.deepEqual(auditDeclaredPhases(recorded.manifest, recorded.candidatePlan), recorded.audit);
console.log('H declared writer boundaries: PASS (metadata only; parallel execution NOT qualified)');
