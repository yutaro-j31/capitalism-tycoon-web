'use strict';

const assert = require('node:assert/strict');
const phase05 = require('../scripts/phase0-5-harness');

const SOURCE_SHA = '89abcdef0123456789abcdef0123456789abcdef';
const SEED = 0x50520021;

function scenario(id = 'persistence-replay') {
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

function fundedRuntime(id = 'persistence-replay') {
  const runtime = phase05.createRuntime(scenario(id), { sourceMainSha: SOURCE_SHA });
  runtime.engine.g.personalCash += 5_000_000;
  assert.equal(runtime.engine.contributeFounderCapital(2_000_000), true, 'founder contribution must use production path');
  assert.equal(runtime.engine.borrow(500_000, 'company'), true, 'company borrowing must use production path');
  for (let i = 0; i < 4; i++) phase05.stepEconomicTick(runtime);
  assert.equal(phase05.assertEconomicInvariants(runtime).ok, true);
  return runtime;
}

// 1. Production save -> fresh TycoonEngineV9.load() fork, then exact replay under different host entropy.
{
  const source = fundedRuntime('production-save-fork');
  const persisted = phase05.persistRuntime(source, {
    mode: 'production-auto',
    savedAt: '2000-01-02T03:04:05.000Z'
  });
  assert.ok(['raw', 'normal', 'emergency', 'critical'].includes(persisted.storageMode));
  assert.ok(persisted.payload.length > 100);

  const left = phase05.loadRuntimeFromPayload(source, persisted.payload, { hostEntropy: 0.11 });
  const right = phase05.loadRuntimeFromPayload(source, persisted.payload, { hostEntropy: 0.91 });
  const comparison = persisted.storageMode === 'raw' ? 'semantic' : 'compacted';

  phase05.assertForkEquivalent(left, right, { comparison, profile: 'normal' });
  const checkpoints = phase05.advanceForkPair(left, right, 4, { comparison, profile: 'normal' });
  assert.equal(checkpoints.length, 4);
  assert.equal(left.engine.g.simulationRng.draws, right.engine.g.simulationRng.draws);
  assert.equal(left.engine.g.simulationRng.nextID, right.engine.g.simulationRng.nextID);
}

// 2. Forced production compaction -> fresh load remains equivalent under the persistence projection.
{
  const source = fundedRuntime('compacted-save-fork');
  const parityBefore = phase05.snapshotLegacyAdapterParity(source);
  const persisted = phase05.persistRuntime(source, {
    mode: 'compacted',
    profile: 'normal',
    savedAt: '2000-02-03T04:05:06.000Z'
  });
  assert.equal(persisted.storageMode, 'compacted-normal');
  assert.ok(persisted.bytes < persisted.originalBytes, 'normal compaction should reduce this production-state payload');

  const reloaded = phase05.loadRuntimeFromPayload(source, persisted.payload, { hostEntropy: 0.73 });
  phase05.assertForkEquivalent(source, reloaded, { comparison: 'compacted', profile: 'normal' });
  assert.deepEqual(
    phase05.snapshotLegacyAdapterParity(reloaded),
    parityBefore,
    'cash, debt, ownership and standalone finance views must survive compaction/load'
  );

  const checkpoints = phase05.advanceForkPair(source, reloaded, 3, { comparison: 'compacted', profile: 'normal' });
  assert.equal(checkpoints.length, 3);
}

// 3. Replaying an operation with the same idempotency key must not mutate state a second time.
{
  const runtime = phase05.createRuntime(scenario('idempotency'), { sourceMainSha: SOURCE_SHA });
  const operation = current => current.loaded.modules.finance.event(current.engine.g, 'otherOperating', 0, {
    cashEffect: 0,
    profitEffect: 0,
    sourceType: 'phase0-5-idempotency-probe',
    sourceID: 'probe',
    operationID: 'phase0-5-idempotency-probe',
    idempotencyKey: 'phase0-5-idempotency-probe',
    description: 'Phase 0.5 idempotency characterization'
  });
  const result = phase05.probeIdempotentOperation(runtime, operation);
  assert.equal(result.ok, true);
  assert.notEqual(result.beforeHash, result.firstHash, 'first execution must create evidence');
  assert.equal(result.firstHash, result.secondHash, 'replay must be a no-op');
}

// 4. Both a false return and a thrown failure restore cash, ledger and RNG/ID allocation exactly.
{
  const falseRuntime = phase05.createRuntime(scenario('rollback-false'), { sourceMainSha: SOURCE_SHA });
  const falseResult = phase05.probeDeterministicRollback(falseRuntime, current => {
    current.engine.g.companyCash += 123_456;
    current.loaded.modules.simulationRng.next(current.engine.g);
    current.loaded.modules.simulationRng.nextID(current.engine.g, 'rollback');
  });
  assert.equal(falseResult.ok, true);
  assert.equal(falseResult.threw, false);
  assert.equal(falseResult.beforeHash, falseResult.afterHash);

  const throwRuntime = phase05.createRuntime(scenario('rollback-throw'), { sourceMainSha: SOURCE_SHA });
  const throwResult = phase05.probeDeterministicRollback(throwRuntime, current => {
    current.engine.g.companyDebt += 987_654;
    current.loaded.modules.simulationRng.next(current.engine.g);
    current.loaded.modules.simulationRng.nextID(current.engine.g, 'rollback');
  }, { throwError: true });
  assert.equal(throwResult.ok, true);
  assert.equal(throwResult.threw, true);
  assert.equal(throwResult.beforeHash, throwResult.afterHash);
}

// 5. Deterministic ID allocation is collision-free and replays identically from the same save.
{
  const source = fundedRuntime('id-allocation');
  const persisted = phase05.persistRuntime(source, { mode: 'production-auto', savedAt: '2000-03-04T05:06:07.000Z' });
  const left = phase05.loadRuntimeFromPayload(source, persisted.payload, { hostEntropy: 0.2 });
  const right = phase05.loadRuntimeFromPayload(source, persisted.payload, { hostEntropy: 0.8 });
  const leftIds = phase05.probeDeterministicIds(left, { prefix: 'phase05', count: 32 });
  const rightIds = phase05.probeDeterministicIds(right, { prefix: 'phase05', count: 32 });
  assert.deepEqual(leftIds, rightIds);
  assert.equal(new Set(leftIds).size, leftIds.length);
}

// 6. A persisted legacy subsystem seed is classified separately and is not silently overwritten.
{
  const source = phase05.createRuntime(scenario('legacy-subsystem-seed'), { sourceMainSha: SOURCE_SHA });
  source.loaded.modules.deterministicEconomicFoundation.ensure(source.engine.g);
  const simulationSeed = source.engine.g.simulationRng.seed;
  let legacySeed = (simulationSeed + 0x12345) >>> 0;
  if (!legacySeed) legacySeed = 1;
  source.engine.g.economicFoundation.seed = legacySeed;
  const payload = JSON.stringify(source.engine.g);
  const reloaded = phase05.loadRuntimeFromPayload(source, payload, { hostEntropy: 0.44 });
  const classification = phase05.classifySeedProvenance(reloaded.loaded, reloaded.engine.g);
  assert.equal(classification.classification, 'legacy-persisted-subsystem-seed');
  assert.equal(reloaded.engine.g.simulationRng.seed, simulationSeed);
  assert.equal(reloaded.engine.g.economicFoundation.seed, legacySeed);
  assert.ok(classification.roots.some(row => row.subsystem === 'economicFoundation' && row.classification === 'legacy-persisted-subsystem-seed'));
}

// 7. Capabilities must advertise only the P0.5-2 evidence now actually implemented.
{
  const runtime = phase05.createRuntime(scenario('capabilities'), { sourceMainSha: SOURCE_SHA });
  const caps = runtime.engineCapabilities;
  assert.equal(caps.saveReloadFork, true);
  assert.equal(caps.compactedSaveReloadFork, true);
  assert.equal(caps.operationReplayProbe, true);
  assert.equal(caps.deterministicRollbackProbe, true);
  assert.equal(caps.deterministicIdProbe, true);
  assert.equal(caps.legacyAdapterParityProbe, true);
  assert.equal(caps.legacySeedClassification, true);
  assert.equal(caps.csvReport, false);
  assert.equal(caps.performanceDistributionReport, false);
}

console.log('Phase 0.5 persistence/replay/failure characterization tests passed');
