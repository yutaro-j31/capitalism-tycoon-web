'use strict';

const assert = require('node:assert/strict');
const phase05 = require('../scripts/phase0-5-harness');
const SOURCE_SHA = '0123456789abcdef0123456789abcdef01234567';

assert.equal(phase05.REPORT_SCHEMA_VERSION, 3);
assert.deepEqual(Object.keys(phase05.HARNESS_TIERS), ['smoke', 'nightly', 'deepAudit']);
assert.equal(phase05.resolveTier('smoke').executionSurface, 'pull-request');
assert.throws(() => phase05.resolveTier('unknown'), /Unknown/);

const distribution = phase05.summarizeDistribution([1, 2, 3, 4, 100]);
assert.deepEqual(distribution, {
  count: 5,
  p50Ms: 3,
  p95Ms: 100,
  p99Ms: 100,
  maxMs: 100,
  meanMs: 22,
  percentileAlgorithm: 'nearest-rank'
});
assert.throws(() => phase05.summarizeDistribution([]), /at least one/);
assert.throws(() => phase05.summarizeDistribution([1, 0]), /positive/);

let now = 0;
const clock = () => { now += 0.25; return now; };
const benchmarkInput = {
  tier: 'smoke',
  requestedScenarioSeed: 0x50530001,
  durationWeeks: 2,
  scenarioId: 'report,"escape"'
};
const report = phase05.runBenchmarkScenario(benchmarkInput, { sourceMainSha: SOURCE_SHA, clock });

assert.equal(report.reportSchemaVersion, 3);
assert(report.scenarioFeatures.includes('json-report-v3'));
assert.equal(report.stateHashVersion, 1);
assert.equal(report.simulationRngVersion > 0, true);
assert.equal(report.simulationRngDrawsAtStart <= report.simulationRngDrawsAtEnd, true);
assert(report.subsystemSeedRoots.some(row => row.subsystem === 'simulationRng'));
assert.equal(report.tickPerformance.count, 2);
assert.deepEqual(report.persistenceCheckpoints.map(row => row.week), [2]);
for (const value of Object.values(report.tickPerformance).filter(value => typeof value === 'number')) {
  assert(Number.isFinite(value) && value >= 0);
}
assert(report.tickPerformance.p50Ms <= report.tickPerformance.p95Ms);
assert(report.tickPerformance.p95Ms <= report.tickPerformance.p99Ms);
assert(report.tickPerformance.p99Ms <= report.tickPerformance.maxMs);
for (const key of ['serializationMs', 'compactionMs', 'loadMs']) {
  assert(Number.isFinite(report.persistencePerformance[key]) && report.persistencePerformance[key] >= 0);
}
for (const key of ['rawSaveBytes', 'compactedSaveBytes', 'storedSaveBytes']) {
  assert(report.persistencePerformance[key] > 0);
}
assert(Number.isFinite(report.persistencePerformance.compactionRatio) && report.persistencePerformance.compactionRatio > 0);
for (const key of ['startBytes', 'peakBytes', 'endBytes']) {
  assert(Number.isFinite(report.memoryProxy[key]) && report.memoryProxy[key] >= 0);
}
assert.equal(report.engineCapabilities.csvReport, true);
assert.equal(report.engineCapabilities.markdownReport, true);
assert.equal(report.engineCapabilities.performanceDistributionReport, true);
assert.equal(report.engineCapabilities.scenarioTierControl, true);
assert.equal(report.engineCapabilities.multiSeedMatrix, true);
assert.equal(report.engineCapabilities.multiCompanyScaleMatrix, false);

// Benchmark instrumentation must not change the economic path/state relative to the normal production runner.
const plain = phase05.runScenario(phase05.createScenario(benchmarkInput), { sourceMainSha: SOURCE_SHA });
assert.equal(report.finalSemanticStateHash, plain.finalSemanticStateHash);
assert.equal(report.outcomePathSignature, plain.outcomePathSignature);

const jsonA = phase05.formatJsonReport(report);
const reportBeforeFormatting = JSON.stringify(report);
assert.equal(jsonA, phase05.formatJsonReport(report));
const csv = phase05.formatCsvReport(report);
assert.equal(csv.split('\n')[0], phase05.CSV_COLUMNS.join(','));
assert(csv.includes('"report,""escape"""'));
assert.equal(csv, phase05.formatCsvReport(report));
const markdown = phase05.formatMarkdownReport(report);
assert.equal(markdown, phase05.formatMarkdownReport(report));
for (const heading of ['Provenance', 'Determinism', 'Invariants', 'Performance', 'Persistence', 'Memory', 'Classification', 'Capability matrix']) {
  assert(markdown.includes(`## ${heading}`));
}
phase05.memoryProxy(report);
assert.equal(JSON.stringify(report), reportBeforeFormatting, 'formatters and memory probes are read-only');

const stateBefore = JSON.stringify({
  companyCash: 1e6,
  nested: { debt: Number.MAX_SAFE_INTEGER + 1 },
  simulationRng: { draws: 4 }
});
const state = JSON.parse(stateBefore);
const envelope = phase05.scanMonetaryEnvelope(state);
assert.equal(JSON.stringify(state), stateBefore);
assert.equal(envelope.safeIntegerCeiling, Number.MAX_SAFE_INTEGER);
assert.equal(envelope.observedUnsafeIntegerCount, 1);
assert.equal(envelope.observedNonFiniteCount, 0);
assert(envelope.observedMaximumAbsoluteMonetaryValue > 0);

const matrix = phase05.runScenarioMatrix(
  { tier: 'smoke', durationWeeks: 1, seeds: [0x50530003, 0x50530002] },
  { sourceMainSha: SOURCE_SHA, clock }
);
assert.deepEqual(matrix.runs.map(row => row.requestedScenarioSeed), [0x50530002, 0x50530003]);
assert.equal(matrix.aggregate.runCount, 2);
assert.equal(matrix.aggregate.uniqueSeedCount, 2);
assert.equal(matrix.aggregate.eligibleCalibrationRuns, 2);
assert(matrix.aggregate.uniquePathSignatureCount >= 1);
assert(matrix.aggregate.uniqueFinalHashCount >= 1);
const excluded = phase05.aggregateBenchmarkReports([
  { ...matrix.runs[0], runClassification: 'legacy-persisted-subsystem-seed', includeInCalibrationAggregation: false },
  matrix.runs[1]
]);
assert.equal(excluded.aggregate.eligibleCalibrationRuns, 1);
assert.equal(excluded.aggregate.excludedLegacyRuns, 1);

console.log(JSON.stringify({
  reporting: 'passed',
  tickPerformance: report.tickPerformance,
  persistencePerformance: report.persistencePerformance,
  memoryProxy: report.memoryProxy,
  monetaryEnvelope: report.monetaryEnvelope,
  matrix: matrix.aggregate
}, null, 2));
