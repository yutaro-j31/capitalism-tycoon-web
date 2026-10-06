'use strict';

const assert = require('node:assert/strict');
const phase05 = require('../scripts/phase0-5-harness');

const SOURCE_SHA = '89abcdef0123456789abcdef0123456789abcdef';
const SEED = 0x50520021;

function scenario(id = 'persistence-characterization') {
  return phase05.createScenario({
    scenarioId: id,
    requestedScenarioSeed: SEED,
    durationWeeks: 0,
    difficulty: 'normal',
    gameScenario: 'free',
    scenarioIdentityFields: {
      companyName: 'Persistence Harness Co',
      ticker: 'PERS',
      playerName: 'Persistence Founder',
      fixtureLabel: id
    }
  });
}

// 0. Finite-state probe is deterministic and domain-neutral.
assert.deepEqual(phase05.findNonFiniteNumbers({ currentRatio: 21, quickRatio: 21 }), []);
assert.deepEqual(
  phase05.findNonFiniteNumbers({ finite: 1, nested: [2, Number.POSITIVE_INFINITY] }),
  [{ path: '$.nested[1]', value: 'Infinity' }]
);

// 1. P0.5-2 emits one machine-readable characterization report.
const report = phase05.runPersistenceCharacterization(scenario(), { sourceMainSha: SOURCE_SHA });
assert.equal(report.reportSchemaVersion, 3);
assert.equal(report.harnessSchemaVersion, 1);
assert.equal(report.sourceMainSha, SOURCE_SHA);
assert.equal(report.requestedScenarioSeed, SEED);
assert.equal(report.simulationRngSeed, SEED);
assert.equal(report.ok, true, JSON.stringify(report));

assert.equal(report.engineCapabilities.saveReloadFork, true);
assert.equal(report.engineCapabilities.compactedSaveReloadFork, true);
assert.equal(report.engineCapabilities.operationReplayProbe, true);
assert.equal(report.engineCapabilities.deterministicRollbackProbe, true);
assert.equal(report.engineCapabilities.deterministicIdProbe, true);
assert.equal(report.engineCapabilities.legacyAdapterParityProbe, true);
assert.equal(report.engineCapabilities.entityAwareLegacyReadModel, true);
assert.equal(report.engineCapabilities.legacySeedClassification, true);
assert.equal(report.engineCapabilities.csvReport, true);
assert.equal(report.engineCapabilities.markdownReport, true);
assert.equal(report.engineCapabilities.multiCompanyScaleMatrix, false);
assert.equal(report.engineCapabilities.performanceDistributionReport, true);
assert.equal(report.engineCapabilities.scenarioTierControl, true);
assert.equal(report.engineCapabilities.multiSeedMatrix, true);

for (const evidence of [
  report.replayEvidence,
  report.persistenceEvidence.saveReloadFork,
  report.persistenceEvidence.compactedSaveReloadFork,
  report.rollbackEvidence,
  report.idempotencyEvidence,
  report.idAllocationEvidence,
  report.legacyAdapterParity
]) {
  assert.equal(evidence.ok, true, JSON.stringify(evidence));
}

// 2. Persistence/replay keeps RNG and deterministic ID position aligned.
assert.equal(report.replayEvidence.rngParity, true);
assert.equal(report.replayEvidence.nextIDParity, true);
assert.equal(report.replayEvidence.pathSignatureMatch, true);
assert.equal(report.replayEvidence.leftInvariantResult.ok, true);
assert.equal(report.replayEvidence.rightInvariantResult.ok, true);
assert.equal(report.persistenceEvidence.saveReloadFork.rngParity, true);
assert.equal(report.persistenceEvidence.saveReloadFork.nextIDParity, true);
assert.equal(report.persistenceEvidence.compactedSaveReloadFork.rngParity, true);
assert.equal(report.persistenceEvidence.compactedSaveReloadFork.nextIDParity, true);
assert.equal(report.persistenceEvidence.saveReloadFork.finalSemanticDiff, null);
assert.equal(report.persistenceEvidence.compactedSaveReloadFork.finalPersistenceDiff, null);

// 3. False-return and throw/rethrow roll back every material component.
assert.deepEqual(
  report.rollbackEvidence.cases.map(row => [row.id, row.rethrown]),
  [['full-mutation-return-false', false], ['full-mutation-throw-rethrow', true]]
);
for (const rollbackCase of report.rollbackEvidence.cases) {
  assert.equal(rollbackCase.semanticStateRestored, true);
  assert(Object.values(rollbackCase.components).every(Boolean), JSON.stringify(rollbackCase));
}

// 4. Production property-tax action proves material idempotency.
assert.equal(report.idempotencyEvidence.cases.length, 1);
assert.equal(report.idempotencyEvidence.duplicateCashMovementPrevented, true);
const taxEvidence = report.idempotencyEvidence.cases[0];
assert.equal(taxEvidence.productionAction, 'TycoonEngine.payPropertyTax');
assert.equal(taxEvidence.firstAccepted, true);
assert.equal(taxEvidence.replayRejected, true);
assert.equal(taxEvidence.cashMovedOnce, true);
assert.equal(taxEvidence.financeRowCreatedOnce, true);
assert.equal(taxEvidence.economicStateUpdatedOnce, true);
assert.equal(taxEvidence.cashDelta, -50_000);
assert.equal(taxEvidence.rowsAdded, 1);

// 5. Deterministic IDs characterize the actual monotonic persisted-counter contract.
assert.equal(report.idAllocationEvidence.unique, true);
assert.equal(report.idAllocationEvidence.samePersistedStateSameSequence, true);
assert.equal(report.idAllocationEvidence.reloadContinuity, true);
assert.equal(report.idAllocationEvidence.rollbackPreservedCounter, true);
assert.equal(new Set(report.idAllocationEvidence.sequence).size, report.idAllocationEvidence.sequence.length);

// 6. Legacy adapter parity is a named PASS/FAIL invariant registry.
assert.equal(report.legacyAdapterParity.companyCash.ok, true);
assert.equal(report.legacyAdapterParity.debt.ok, true);
assert.equal(report.legacyAdapterParity.ownership.ok, true);
assert.equal(report.legacyAdapterParity.standaloneFinance.ok, true);
assert.equal(report.legacyAdapterParity.entityAwareReadModel.ok, true);
assert.equal(report.legacyAdapterParity.entityAwareReadModel.readModelVersion, 1);
assert.deepEqual([...report.legacyAdapterParity.entityAwareReadModel.entityIds], ['entity:company:player', 'entity:person:founder']);
assert(report.legacyAdapterParity.invariants.every(row => row.ok), JSON.stringify(report.legacyAdapterParity.invariants));
for (const id of [
  'company-cash-vs-balance-sheet',
  'company-debt-vs-active-loans',
  'founder-shares-within-outstanding',
  'treasury-shares-nonnegative',
  'market-issued-shares-reconcile',
  'external-ownership-ratio-reconcile',
  'cash-flow-ending-vs-authoritative-cash',
  'cash-flow-rollforward',
  'finance-validate',
  'entity-read-company-cash',
  'entity-read-personal-cash',
  'entity-read-company-debt',
  'entity-read-personal-debt',
  'entity-read-company-debt-instrument-bindings',
  'entity-read-company-debt-instruments',
  'entity-read-company-loan-principal',
  'entity-read-founder-debt-receivable-bindings',
  'entity-read-founder-debt-receivable-instruments',
  'entity-read-founder-loan-receivable',
  'entity-read-ownership-bindings',
  'entity-read-public-company-status',
  'entity-read-shares-out',
  'entity-read-founder-shares',
  'entity-read-treasury-shares',
  'entity-read-external-shareholder-ratio',
  'entity-read-company-market-holdings',
  'entity-read-personal-market-holdings'
]) assert(report.legacyAdapterParity.invariants.some(row => row.id === id), `missing parity invariant ${id}`);

// 7. New-game runs remain eligible for calibration aggregation.
assert.equal(report.runClassification, 'new-game-seed-root');
assert.equal(report.includeInCalibrationAggregation, true);

// 8. Persisted subsystem seeds stay distinct and are excluded from new-game calibration.
{
  const runtime = phase05.createRuntime(scenario('legacy-subsystem-seed'), { sourceMainSha: SOURCE_SHA });
  runtime.loaded.modules.deterministicEconomicFoundation.ensure(runtime.engine.g);
  const simulationSeed = runtime.engine.g.simulationRng.seed;
  let legacySeed = (simulationSeed + 0x12345) >>> 0;
  if (!legacySeed) legacySeed = 1;
  runtime.engine.g.economicFoundation.seed = legacySeed;
  const payload = JSON.stringify(runtime.engine.g);
  const reloaded = phase05.createRuntimeFromPersistedState(runtime.scenario, payload, {
    sourceMainSha: SOURCE_SHA,
    hostEntropy: 0.44
  });
  const classification = phase05.classifySeedProvenance(reloaded);
  assert.equal(classification.classification, 'legacy-persisted-subsystem-seed');
  assert.equal(classification.includeInCalibrationAggregation, false);
  assert.equal(reloaded.engine.g.simulationRng.seed, simulationSeed);
  assert.equal(reloaded.engine.g.economicFoundation.seed, legacySeed);
}

// 9. Evidence probes used as reads do not mutate authoritative state.
{
  const runtime = phase05.createRuntime(scenario('read-only-probes'), { sourceMainSha: SOURCE_SHA });
  runtime.loaded.modules.deterministicEconomicFoundation.ensure(runtime.engine.g);
  const before = JSON.stringify(runtime.engine.g);
  phase05.snapshotMetrics(runtime);
  phase05.semanticStateHash(runtime.engine.g);
  phase05.classifySeedProvenance(runtime);
  phase05.snapshotLegacyAdapterParity(runtime);
  assert.equal(JSON.stringify(runtime.engine.g), before, 'read-only evidence probes must not mutate production state');

  const divergent = JSON.parse(before);
  divergent.companyCash += 1;
  assert.equal(phase05.diffSemanticState(runtime.engine.g, divergent).path, '$.companyCash');
}

console.log('Phase 0.5 persistence/replay/failure characterization tests passed');
