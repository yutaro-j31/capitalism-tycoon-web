'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const phase05 = require('../scripts/phase0-5-harness');

const SOURCE_SHA = '0123456789abcdef0123456789abcdef01234567';
const BASE_SEED = 0x50050011;

const scenario = phase05.createScenario({
  scenarioId: 'core-smoke',
  requestedScenarioSeed: BASE_SEED,
  durationWeeks: 3,
  difficulty: 'normal',
  gameScenario: 'free',
  scenarioIdentityFields: {
    companyName: 'Harness Core Co',
    ticker: 'HCR',
    playerName: 'Harness Founder',
    fixtureLabel: 'core-smoke'
  }
});

assert.equal(scenario.harnessSchemaVersion, 1);
assert.equal(scenario.requestedScenarioSeed, BASE_SEED);
assert.equal(scenario.durationWeeks, 3);
assert.equal(scenario.stateHashVersion, 1);
assert.deepEqual([...scenario.expectedInvariants], [
  'finance.validate',
  'finite-state',
  'serializable-state',
  'scenario-seed-root'
]);

// 1. Explicit harness seed must use the production configure path without host entropy.
{
  let hostDraws = 0;
  const loaded = loadGame({
    headless: true,
    random: () => {
      hostDraws += 1;
      return 0.123456789;
    }
  });
  const Engine = loaded.engineModule.TycoonEngine;

  const explicit = new Engine();
  const beforeExplicit = hostDraws;
  explicit.configure({
    playerName: 'Explicit',
    companyName: 'Explicit Co',
    difficulty: 'normal',
    scenario: 'free',
    simulationSeed: BASE_SEED
  });
  assert.equal(hostDraws, beforeExplicit, 'explicit simulationSeed must bypass configure host entropy');
  assert.equal(explicit.g.simulationRng.seed, BASE_SEED);

  const normal = new Engine();
  const beforeNormal = hostDraws;
  normal.configure({
    playerName: 'Normal',
    companyName: 'Normal Co',
    difficulty: 'normal',
    scenario: 'free'
  });
  assert.equal(hostDraws, beforeNormal + 1, 'normal gameplay must retain exactly one configure host-entropy draw');
}

// 2. Core report contains the mandatory machine-readable provenance and capabilities.
const report = phase05.runScenario(scenario, { sourceMainSha: SOURCE_SHA });
assert.equal(report.reportSchemaVersion, 1);
assert.equal(report.harnessSchemaVersion, 1);
assert.equal(report.sourceMainSha, SOURCE_SHA);
assert.equal(report.requestedScenarioSeed, BASE_SEED);
assert.equal(report.simulationRngSeed, BASE_SEED);
assert.equal(report.runClassification, 'new-game-seed-root');
assert.equal(report.stateHashVersion, 1);
assert.equal(report.semanticProjectionId, 'production-state-v1');
assert.equal(report.tickCount, 3);
assert.equal(report.initialMetrics.week, 1);
assert.equal(report.finalMetrics.week, 4);
assert.equal(report.invariantResult.ok, true);
assert.match(report.initialSemanticStateHash, /^[0-9a-f]{64}$/);
assert.match(report.finalSemanticStateHash, /^[0-9a-f]{64}$/);
assert.match(report.outcomePathSignature, /^[0-9a-f]{64}$/);
assert.equal(report.engineCapabilities.productionFullIndex, true);
assert.equal(report.engineCapabilities.uiFreeProductionWeeklyTick, true);
assert.equal(report.engineCapabilities.canonicalNormalizeBoundary, true);
assert.equal(report.engineCapabilities.explicitSimulationSeedConfigure, true);
assert.equal(report.engineCapabilities.deterministicSimulationRng, true);
assert.equal(report.engineCapabilities.financeValidation, true);
// P0.5-1 owns the core capability contract. Later slices may legitimately promote additional
// capability flags from false to true; keep only still-unimplemented later-phase claims pinned here.
assert.equal(report.engineCapabilities.csvReport, false);
assert.equal(report.engineCapabilities.markdownReport, false);
assert.equal(report.engineCapabilities.multiCompanyScaleMatrix, false);
assert.equal(report.engineCapabilities.performanceDistributionReport, false);
assert.ok(report.subsystemSeedRoots.some(row => row.subsystem === 'simulationRng' && row.seed === BASE_SEED));
assert.ok(report.subsystemSeedRoots.some(row => row.subsystem === 'economicFoundation' && row.seed === BASE_SEED));

const parsedJson = JSON.parse(phase05.formatJsonReport(report));
assert.equal(parsedJson.requestedScenarioSeed, BASE_SEED);
assert.equal(parsedJson.outcomePathSignature, report.outcomePathSignature);

// 3. Exact replay: same schema + seed + inputs produces the same report evidence.
{
  const replay = phase05.runScenario(scenario, { sourceMainSha: SOURCE_SHA });
  assert.equal(replay.initialSemanticStateHash, report.initialSemanticStateHash);
  assert.equal(replay.finalSemanticStateHash, report.finalSemanticStateHash);
  assert.equal(replay.outcomePathSignature, report.outcomePathSignature);
  assert.deepEqual(replay.finalMetrics, report.finalMetrics);
  assert.deepEqual(replay.subsystemSeedRoots, report.subsystemSeedRoots);
}

// 4. Nuisance labels may differ, but the economic path fingerprint must not.
{
  const nuisance = phase05.runScenario({
    ...scenario,
    scenarioIdentityFields: {
      companyName: '完全に別の会社名',
      ticker: 'ZZZZ',
      playerName: '別の創業者',
      fixtureLabel: 'different-display-label'
    }
  }, { sourceMainSha: SOURCE_SHA });

  assert.equal(nuisance.simulationRngSeed, BASE_SEED);
  assert.equal(
    nuisance.outcomePathSignature,
    report.outcomePathSignature,
    'identity/display labels must not change the economic path fingerprint'
  );
  assert.deepEqual(nuisance.finalMetrics, report.finalMetrics);
  assert.notEqual(
    nuisance.finalSemanticStateHash,
    report.finalSemanticStateHash,
    'authoritative state hash intentionally retains identity fields'
  );
}

// 5. Seed sensitivity: another persisted simulation root must be able to choose another path.
{
  const other = phase05.runScenario({
    ...scenario,
    requestedScenarioSeed: BASE_SEED + 1,
    scenarioId: 'core-smoke-other-seed'
  }, { sourceMainSha: SOURCE_SHA });
  assert.equal(other.simulationRngSeed, BASE_SEED + 1);
  assert.notEqual(other.outcomePathSignature, report.outcomePathSignature);
}

// 6. Semantic first-diff is versioned and points at the first authoritative difference.
{
  const left = phase05.createRuntime(scenario, { sourceMainSha: SOURCE_SHA });
  const right = phase05.createRuntime(scenario, { sourceMainSha: SOURCE_SHA });
  right.engine.g.companyCash += 1;
  const diff = phase05.diffSemanticState(left.engine.g, right.engine.g, 1);
  assert(diff);
  assert.equal(diff.path, '$.companyCash');
  assert.equal(Number(diff.right) - Number(diff.left), 1);
}

// 7. Core schema rejects pseudo-replication / unsupported scale inputs early.
assert.throws(() => phase05.createScenario({ requestedScenarioSeed: 0 }), /non-zero uint32/);
assert.throws(() => phase05.createScenario({ requestedScenarioSeed: BASE_SEED, durationWeeks: -1 }), /durationWeeks/);
assert.throws(() => phase05.createScenario({ requestedScenarioSeed: BASE_SEED, playerCompanies: 10 }), /exactly one detailed player company/);

console.log('Phase 0.5 permanent harness core tests passed');
