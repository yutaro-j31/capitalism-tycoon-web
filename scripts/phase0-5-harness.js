'use strict';

const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const { ROOT, loadGame, findStateIssues } = require('../tests/harness');

const HARNESS_SCHEMA_VERSION = 1;
const REPORT_SCHEMA_VERSION = 1;
const STATE_HASH_VERSION = 1;
const MAX_CORE_WEEKS = 5200;
const DEFAULT_EXPECTED_INVARIANTS = Object.freeze([
  'finance.validate',
  'finite-state',
  'serializable-state',
  'scenario-seed-root'
]);

const VALID_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const VALID_GAME_SCENARIOS = new Set(['free', 'standard']);

function isUint32(value) {
  return Number.isInteger(value) && value > 0 && value <= 0xffffffff;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
  return out;
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

const SEMANTIC_PROJECTION_REGISTRY = Object.freeze({
  [STATE_HASH_VERSION]: Object.freeze({
    id: 'production-state-v1',
    description: 'Full JSON-safe production simulation state excluding wall-clock save metadata.',
    project(state) {
      const projected = cloneJson(state);
      delete projected.lastSaveDate;
      return projected;
    }
  })
});

function projectionFor(version = STATE_HASH_VERSION) {
  const row = SEMANTIC_PROJECTION_REGISTRY[version];
  if (!row) throw new Error(`Unsupported semantic state hash version: ${version}`);
  return row;
}

function projectSemanticState(state, version = STATE_HASH_VERSION) {
  return projectionFor(version).project(state);
}

function semanticStateHash(state, version = STATE_HASH_VERSION) {
  return sha256(stableStringify(projectSemanticState(state, version)));
}

function firstDiff(left, right, path = '$') {
  if (Object.is(left, right)) return null;
  if (typeof left !== typeof right || left === null || right === null || typeof left !== 'object') {
    return { path, left, right };
  }
  if (Array.isArray(left) !== Array.isArray(right)) return { path, left, right };
  if (Array.isArray(left)) {
    if (left.length !== right.length) return { path: `${path}.length`, left: left.length, right: right.length };
    for (let i = 0; i < left.length; i++) {
      const diff = firstDiff(left[i], right[i], `${path}[${i}]`);
      if (diff) return diff;
    }
    return null;
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    if (!(key in left) || !(key in right)) return { path: `${path}.${key}`, left: left[key], right: right[key] };
    const diff = firstDiff(left[key], right[key], `${path}.${key}`);
    if (diff) return diff;
  }
  return null;
}

function diffSemanticState(leftState, rightState, version = STATE_HASH_VERSION) {
  return firstDiff(projectSemanticState(leftState, version), projectSemanticState(rightState, version));
}

function resolveSourceMainSha(explicitSha = null) {
  const candidate = explicitSha || process.env.GITHUB_SHA || (() => {
    try {
      return childProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {
      return '';
    }
  })();
  if (!/^[0-9a-f]{40}$/i.test(candidate)) throw new Error('Phase 0.5 report requires a 40-character sourceMainSha.');
  return candidate.toLowerCase();
}

function normalizeIdentity(input = {}) {
  return Object.freeze({
    companyName: String(input.companyName || 'Phase 0.5 Company'),
    ticker: String(input.ticker || 'P05'),
    playerName: String(input.playerName || 'Phase 0.5 Founder'),
    fixtureLabel: String(input.fixtureLabel || 'default')
  });
}

function createScenario(input = {}) {
  const requestedScenarioSeed = Number(input.requestedScenarioSeed ?? input.seed);
  if (!isUint32(requestedScenarioSeed)) throw new Error('requestedScenarioSeed must be a non-zero uint32.');

  const durationWeeks = Math.floor(Number(input.durationWeeks ?? input.weeks ?? 4));
  if (!Number.isInteger(durationWeeks) || durationWeeks < 0 || durationWeeks > MAX_CORE_WEEKS) {
    throw new Error(`durationWeeks must be an integer between 0 and ${MAX_CORE_WEEKS}.`);
  }

  const difficulty = String(input.difficulty || 'normal').toLowerCase();
  if (!VALID_DIFFICULTIES.has(difficulty)) throw new Error(`Unsupported difficulty: ${difficulty}`);

  const gameScenario = String(input.gameScenario || 'free').toLowerCase();
  if (!VALID_GAME_SCENARIOS.has(gameScenario)) throw new Error(`Unsupported gameScenario: ${gameScenario}`);

  const playerCompanies = Math.floor(Number(input.playerCompanies ?? 1));
  if (playerCompanies !== 1) {
    throw new Error('Phase 0.5 core currently supports exactly one detailed player company; scale tiers are added by the performance/scale slice.');
  }

  const identity = normalizeIdentity(input.scenarioIdentityFields || input.identity || input);
  const expectedInvariants = Object.freeze([...(input.expectedInvariants || DEFAULT_EXPECTED_INVARIANTS)].map(String));

  return Object.freeze({
    harnessSchemaVersion: HARNESS_SCHEMA_VERSION,
    scenarioId: String(input.scenarioId || input.id || `seed-${requestedScenarioSeed}`),
    durationWeeks,
    difficulty,
    gameScenario,
    requestedScenarioSeed,
    scenarioIdentityFields: identity,
    scenarioFeatures: Object.freeze([
      'production-configure-path',
      'ui-free-production-week',
      'finance-validation',
      'semantic-state-hash-v1',
      'json-report-v1'
    ]),
    scenarioSize: Object.freeze({
      playerCompanies,
      competitorRoster: 'production'
    }),
    expectedInvariants,
    stateHashVersion: STATE_HASH_VERSION
  });
}

function declareEngineCapabilities(loaded) {
  const Engine = loaded.engineModule.TycoonEngine;
  return Object.freeze({
    productionFullIndex: true,
    uiFreeProductionWeeklyTick: typeof Engine.prototype.advanceWeek === 'function',
    canonicalNormalizeBoundary: Boolean(Engine.prototype.advanceWeek?.__canonicalNormalizeBoundary),
    explicitSimulationSeedConfigure: true,
    deterministicSimulationRng: Boolean(loaded.modules.simulationRng?.ensure),
    financeValidation: typeof loaded.modules.finance?.validate === 'function',
    semanticHashVersions: Object.freeze(Object.keys(SEMANTIC_PROJECTION_REGISTRY).map(Number)),
    jsonReport: true,
    saveReloadFork: false,
    compactedSaveReloadFork: false,
    csvReport: false,
    markdownReport: false,
    multiCompanyScaleMatrix: false,
    performanceDistributionReport: false
  });
}

function subsystemSeedRoots(loaded, state) {
  loaded.modules.deterministicEconomicFoundation?.ensure?.(state);
  const roots = [{
    subsystem: 'simulationRng',
    seed: Number(state.simulationRng?.seed),
    classification: 'new-game-seed-root'
  }];
  if (Number.isInteger(state.economicFoundation?.seed)) {
    roots.push({
      subsystem: 'economicFoundation',
      seed: Number(state.economicFoundation.seed),
      classification: state.economicFoundation.seed === state.simulationRng?.seed
        ? 'new-game-seed-root'
        : 'legacy-persisted-subsystem-seed'
    });
  }
  return roots;
}

function snapshotMetrics(runtime) {
  const state = runtime.engine.g;
  return Object.freeze({
    week: Number(state.week),
    companyCash: Number(state.companyCash),
    personalCash: Number(state.personalCash),
    companyDebt: Number(state.companyDebt),
    storeCount: Array.isArray(state.stores) ? state.stores.length : 0,
    financeTransactionCount: Array.isArray(state.finance?.transactions) ? state.finance.transactions.length : 0,
    simulationRngDraws: Number(state.simulationRng?.draws || 0),
    simulationRngNextID: Number(state.simulationRng?.nextID || 0),
    economy: Number(state.economy),
    policyRate: Number(state.policyRate),
    economicPhase: String(state.economicFoundation?.phase || '')
  });
}

function assertEconomicInvariants(runtime, expected = DEFAULT_EXPECTED_INVARIANTS) {
  const checks = [];
  const errors = [];
  const wanted = new Set(expected);

  if (wanted.has('finance.validate')) {
    try {
      const result = runtime.loaded.modules.finance.validate(runtime.engine.g);
      const ok = result?.ok === true;
      checks.push({ id: 'finance.validate', ok });
      if (!ok) errors.push(...(result?.errors || ['finance.validate failed']));
    } catch (error) {
      checks.push({ id: 'finance.validate', ok: false });
      errors.push(`finance.validate threw: ${error.message}`);
    }
  }

  if (wanted.has('finite-state')) {
    const issues = findStateIssues(runtime.engine.g);
    const ok = issues.length === 0;
    checks.push({ id: 'finite-state', ok });
    if (!ok) errors.push(...issues);
  }

  if (wanted.has('serializable-state')) {
    let ok = true;
    try { JSON.stringify(runtime.engine.g); } catch (error) { ok = false; errors.push(`state serialization failed: ${error.message}`); }
    checks.push({ id: 'serializable-state', ok });
  }

  if (wanted.has('scenario-seed-root')) {
    const ok = runtime.engine.g.simulationRng?.seed === runtime.scenario.requestedScenarioSeed;
    checks.push({ id: 'scenario-seed-root', ok });
    if (!ok) errors.push(`requested seed ${runtime.scenario.requestedScenarioSeed} != persisted simulationRng.seed ${runtime.engine.g.simulationRng?.seed}`);
  }

  return Object.freeze({ ok: errors.length === 0, checks: Object.freeze(checks), errors: Object.freeze(errors) });
}

function createRuntime(scenarioInput, options = {}) {
  const scenario = scenarioInput?.harnessSchemaVersion === HARNESS_SCHEMA_VERSION
    ? scenarioInput
    : createScenario(scenarioInput);

  // Host entropy must be irrelevant when an explicit simulationSeed is supplied. Keep it fixed so
  // any accidental host-random dependency is easier to detect in nuisance/replay gates.
  const loaded = loadGame({ headless: true, random: () => 0.5 });
  const Engine = loaded.engineModule.TycoonEngine;
  const engine = new Engine();
  const identity = scenario.scenarioIdentityFields;

  engine.configure({
    playerName: identity.playerName,
    companyName: identity.companyName,
    difficulty: scenario.difficulty,
    scenario: scenario.gameScenario,
    simulationSeed: scenario.requestedScenarioSeed
  });
  engine.g.ticker = identity.ticker;

  if (engine.g.simulationRng?.seed !== scenario.requestedScenarioSeed) {
    throw new Error('Production configure did not persist the requested Phase 0.5 simulation seed.');
  }

  const runtime = {
    scenario,
    loaded,
    engine,
    sourceMainSha: resolveSourceMainSha(options.sourceMainSha),
    engineCapabilities: declareEngineCapabilities(loaded)
  };

  const invariants = assertEconomicInvariants(runtime, scenario.expectedInvariants);
  if (!invariants.ok) throw new Error(`Initial Phase 0.5 invariants failed: ${invariants.errors.join(' / ')}`);

  return runtime;
}

function pathObservation(runtime) {
  const metrics = snapshotMetrics(runtime);
  return Object.freeze({
    week: metrics.week,
    companyCash: metrics.companyCash,
    companyDebt: metrics.companyDebt,
    storeCount: metrics.storeCount,
    simulationRngDraws: metrics.simulationRngDraws,
    simulationRngNextID: metrics.simulationRngNextID,
    economy: metrics.economy,
    policyRate: metrics.policyRate,
    economicPhase: metrics.economicPhase
  });
}

function stepEconomicTick(runtime) {
  const beforeWeek = Number(runtime.engine.g.week);
  const result = runtime.engine.advanceWeek(false);
  if (result === false) throw new Error(`Production weekly tick returned false at week ${beforeWeek}.`);
  if (Number(runtime.engine.g.week) !== beforeWeek + 1) {
    throw new Error(`Production weekly tick must advance exactly one week: ${beforeWeek} -> ${runtime.engine.g.week}`);
  }
  const invariants = assertEconomicInvariants(runtime, runtime.scenario.expectedInvariants);
  if (!invariants.ok) throw new Error(`Phase 0.5 invariants failed after week ${runtime.engine.g.week}: ${invariants.errors.join(' / ')}`);
  return Object.freeze({
    week: Number(runtime.engine.g.week),
    semanticStateHash: semanticStateHash(runtime.engine.g, runtime.scenario.stateHashVersion),
    metrics: snapshotMetrics(runtime),
    pathObservation: pathObservation(runtime),
    invariants
  });
}

function runScenario(scenarioInput, options = {}) {
  const runtime = createRuntime(scenarioInput, options);
  const state = runtime.engine.g;
  const initialSemanticStateHash = semanticStateHash(state, runtime.scenario.stateHashVersion);
  const simulationRngDrawsAtStart = Number(state.simulationRng.draws);
  const initialMetrics = snapshotMetrics(runtime);
  const initialPathObservation = pathObservation(runtime);
  const ticks = [];

  for (let i = 0; i < runtime.scenario.durationWeeks; i++) ticks.push(stepEconomicTick(runtime));

  const finalState = runtime.engine.g;
  const roots = subsystemSeedRoots(runtime.loaded, finalState);
  const pathRows = [
    initialPathObservation,
    ...ticks.map(row => row.pathObservation)
  ];
  const outcomePathSignature = sha256(stableStringify(pathRows));
  const finalInvariantResult = assertEconomicInvariants(runtime, runtime.scenario.expectedInvariants);

  return Object.freeze({
    reportSchemaVersion: REPORT_SCHEMA_VERSION,
    harnessSchemaVersion: runtime.scenario.harnessSchemaVersion,
    scenarioId: runtime.scenario.scenarioId,
    sourceMainSha: runtime.sourceMainSha,
    engineCapabilities: runtime.engineCapabilities,
    scenarioFeatures: runtime.scenario.scenarioFeatures,
    scenarioSize: runtime.scenario.scenarioSize,
    requestedScenarioSeed: runtime.scenario.requestedScenarioSeed,
    simulationRngSeed: Number(finalState.simulationRng.seed),
    simulationRngVersion: Number(finalState.simulationRng.version),
    simulationRngDrawsAtStart,
    simulationRngDrawsAtEnd: Number(finalState.simulationRng.draws),
    subsystemSeedRoots: Object.freeze(roots),
    scenarioIdentityFields: runtime.scenario.scenarioIdentityFields,
    runClassification: roots.some(row => row.classification === 'legacy-persisted-subsystem-seed')
      ? 'legacy-persisted-subsystem-seed'
      : 'new-game-seed-root',
    outcomePathSignature,
    expectedInvariants: runtime.scenario.expectedInvariants,
    invariantResult: finalInvariantResult,
    stateHashVersion: runtime.scenario.stateHashVersion,
    semanticProjectionId: projectionFor(runtime.scenario.stateHashVersion).id,
    initialSemanticStateHash,
    finalSemanticStateHash: semanticStateHash(finalState, runtime.scenario.stateHashVersion),
    initialMetrics,
    finalMetrics: snapshotMetrics(runtime),
    tickCount: ticks.length,
    tickSemanticHashes: Object.freeze(ticks.map(row => row.semanticStateHash))
  });
}

function formatJsonReport(report) {
  return JSON.stringify(canonicalize(report), null, 2);
}

function parseCli(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    args[key] = value;
  }
  if (args.seed == null) throw new Error('CLI requires --seed <non-zero uint32>.');
  return {
    requestedScenarioSeed: Number(args.seed),
    durationWeeks: args.weeks == null ? 4 : Number(args.weeks),
    difficulty: args.difficulty || 'normal',
    gameScenario: args.scenario || 'free',
    scenarioId: args.id || `cli-seed-${args.seed}`,
    scenarioIdentityFields: {
      companyName: args['company-name'] || 'Phase 0.5 Company',
      ticker: args.ticker || 'P05',
      playerName: args['player-name'] || 'Phase 0.5 Founder',
      fixtureLabel: args['fixture-label'] || 'cli'
    }
  };
}

if (require.main === module) {
  try {
    const scenario = parseCli(process.argv.slice(2));
    process.stdout.write(formatJsonReport(runScenario(scenario)) + '\n');
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  HARNESS_SCHEMA_VERSION,
  REPORT_SCHEMA_VERSION,
  STATE_HASH_VERSION,
  MAX_CORE_WEEKS,
  DEFAULT_EXPECTED_INVARIANTS,
  SEMANTIC_PROJECTION_REGISTRY,
  createScenario,
  declareEngineCapabilities,
  projectSemanticState,
  semanticStateHash,
  diffSemanticState,
  snapshotMetrics,
  assertEconomicInvariants,
  createRuntime,
  stepEconomicTick,
  runScenario,
  formatJsonReport,
  resolveSourceMainSha,
  stableStringify
});
