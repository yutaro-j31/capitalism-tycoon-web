'use strict';

const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const { ROOT, loadGame } = require('../tests/harness');

const HARNESS_SCHEMA_VERSION = 1;
const REPORT_SCHEMA_VERSION = 2;
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
      'json-report-v2'
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
    saveReloadFork: true,
    compactedSaveReloadFork: true,
    operationReplayProbe: true,
    deterministicRollbackProbe: true,
    deterministicIdProbe: true,
    legacyAdapterParityProbe: true,
    legacySeedClassification: true,
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

function findNonFiniteNumbers(value, path = '$', issues = [], seen = new WeakSet()) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) issues.push({ path, value: String(value) });
    return issues;
  }
  if (!value || typeof value !== 'object') return issues;
  if (seen.has(value)) {
    issues.push({ path, value: 'circular-reference' });
    return issues;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findNonFiniteNumbers(entry, `${path}[${index}]`, issues, seen));
  } else {
    for (const key of Object.keys(value).sort()) {
      findNonFiniteNumbers(value[key], `${path}.${key}`, issues, seen);
    }
  }
  seen.delete(value);
  return issues;
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
    const issues = findNonFiniteNumbers(runtime.engine.g);
    const ok = issues.length === 0;
    checks.push({ id: 'finite-state', ok });
    if (!ok) errors.push(...issues.map(issue => `${issue.path}: ${issue.value}`));
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


function makeMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); }
  };
}

function persistRuntime(runtime, options = {}) {
  const mode = String(options.mode || 'production-auto');
  const savedAt = String(options.savedAt || '2000-01-01T00:00:00.000Z');
  const storage = runtime.loaded.modules.saveStorage;
  if (!storage?.saveWithAdapter || !storage?.storagePayload) throw new Error('Production save-storage adapter is unavailable.');

  if (mode === 'production-auto') {
    const mirror = makeMemoryStorage();
    const result = storage.saveWithAdapter(runtime.engine, {
      backend: false,
      mirrorStorage: mirror,
      savedAt
    });
    if (!result?.ok || typeof result.payload !== 'string') {
      throw new Error(`Production save failed: ${result?.error?.message || result?.mode || 'unknown'}`);
    }
    return Object.freeze({
      payload: result.payload,
      storageMode: result.mode,
      bytes: Number(result.bytes || result.payload.length * 2),
      originalBytes: Number(result.originalBytes || result.payload.length * 2),
      profile: null
    });
  }

  if (mode === 'compacted') {
    const profile = String(options.profile || 'normal');
    const state = cloneJson(runtime.engine.g);
    state.lastSaveDate = savedAt;
    const result = storage.storagePayload(state, profile);
    return Object.freeze({
      payload: result.payload,
      storageMode: `compacted-${profile}`,
      bytes: result.payload.length * 2,
      originalBytes: JSON.stringify(state).length * 2,
      profile
    });
  }

  throw new Error(`Unsupported persistence mode: ${mode}`);
}

function loadRuntimeFromPayload(parentRuntime, payload, options = {}) {
  if (!parentRuntime?.scenario || typeof payload !== 'string') throw new Error('A parent runtime and serialized payload are required.');
  const key = parentRuntime.loaded.engineModule.SAVE_KEY;
  const hostEntropy = Number.isFinite(Number(options.hostEntropy)) ? Number(options.hostEntropy) : 0.25;
  const loaded = loadGame({
    headless: true,
    random: () => hostEntropy,
    localStorageInitial: { [key]: payload }
  });
  const engine = loaded.engineModule.TycoonEngine.load();
  if (!engine?.g?.configured) throw new Error('Persisted Phase 0.5 runtime did not load as a configured game.');
  const runtime = {
    scenario: parentRuntime.scenario,
    loaded,
    engine,
    sourceMainSha: parentRuntime.sourceMainSha,
    engineCapabilities: declareEngineCapabilities(loaded)
  };
  const invariants = assertEconomicInvariants(runtime, runtime.scenario.expectedInvariants);
  if (!invariants.ok) throw new Error(`Reloaded Phase 0.5 invariants failed: ${invariants.errors.join(' / ')}`);
  return runtime;
}

function projectPersistenceComparableState(runtime, profile = 'normal') {
  const storage = runtime.loaded.modules.saveStorage;
  const compacted = storage.compactStateForStorage(runtime.engine.g, profile).state;
  delete compacted.lastSaveDate;
  delete compacted.saveSequence;
  return compacted;
}

function diffPersistenceState(leftRuntime, rightRuntime, profile = 'normal') {
  return firstDiff(
    canonicalize(projectPersistenceComparableState(leftRuntime, profile)),
    canonicalize(projectPersistenceComparableState(rightRuntime, profile))
  );
}

function assertForkEquivalent(leftRuntime, rightRuntime, options = {}) {
  const comparison = String(options.comparison || 'semantic');
  const diff = comparison === 'compacted'
    ? diffPersistenceState(leftRuntime, rightRuntime, options.profile || 'normal')
    : diffSemanticState(leftRuntime.engine.g, rightRuntime.engine.g, leftRuntime.scenario.stateHashVersion);
  if (diff) throw new Error(`Phase 0.5 fork divergence (${comparison}): ${JSON.stringify(diff)}`);
  return Object.freeze({
    ok: true,
    comparison,
    profile: comparison === 'compacted' ? String(options.profile || 'normal') : null,
    leftHash: semanticStateHash(leftRuntime.engine.g, leftRuntime.scenario.stateHashVersion),
    rightHash: semanticStateHash(rightRuntime.engine.g, rightRuntime.scenario.stateHashVersion)
  });
}

function advanceForkPair(leftRuntime, rightRuntime, weeks, options = {}) {
  const count = Math.max(0, Math.floor(Number(weeks)));
  const checkpoints = [];
  for (let step = 1; step <= count; step++) {
    stepEconomicTick(leftRuntime);
    stepEconomicTick(rightRuntime);
    const equivalence = assertForkEquivalent(leftRuntime, rightRuntime, options);
    checkpoints.push({
      step,
      week: Number(leftRuntime.engine.g.week),
      comparison: equivalence.comparison,
      leftHash: equivalence.leftHash,
      rightHash: equivalence.rightHash
    });
  }
  return Object.freeze(checkpoints);
}

function snapshotLegacyAdapterParity(runtime) {
  const state = runtime.engine.g;
  const finance = runtime.loaded.modules.finance;
  const validation = finance.validate(state);
  const statements = finance.buildStatements(state, '52');
  const activeLoanDebt = (state.finance?.loans || [])
    .filter(row => row?.status === 'active')
    .reduce((sum, row) => sum + Number(row.outstandingPrincipal || 0), 0);
  const sharesOut = Number(state.sharesOut || 0);
  const founderShares = Number(state.founderShares || 0);
  const treasuryShares = Number(state.treasuryBuybackShares || 0);
  const marketSelf = (state.market || []).find(row => row?.id === state.ticker);
  const expectedExternalRatio = sharesOut > 0 ? (sharesOut - founderShares) / sharesOut : 0;
  const bsCash = Number(statements.balanceSheet?.assets?.cashAndDeposits ?? 0);
  const cfOpening = Number(statements.cashFlow?.openingCash ?? 0);
  const cfChange = Number(statements.cashFlow?.netCashChange ?? 0);
  const cfEnding = Number(statements.cashFlow?.endingCash ?? 0);

  const invariants = [
    { id:'company-cash-vs-balance-sheet', ok:Math.abs(Number(state.companyCash)-bsCash)<=0.1, authoritative:Number(state.companyCash), adapter:bsCash },
    { id:'company-debt-vs-active-loans', ok:Math.abs(Number(state.companyDebt||0)-activeLoanDebt)<=0.1, authoritative:Number(state.companyDebt||0), adapter:activeLoanDebt },
    { id:'founder-shares-within-outstanding', ok:sharesOut>=0&&founderShares>=0&&founderShares<=sharesOut, authoritative:{sharesOut,founderShares} },
    { id:'treasury-shares-nonnegative', ok:treasuryShares>=0, authoritative:treasuryShares },
    { id:'market-issued-shares-reconcile', ok:!state.publicCompany||!marketSelf||Number(marketSelf.issuedShares)===sharesOut, authoritative:sharesOut, adapter:marketSelf?Number(marketSelf.issuedShares):null },
    { id:'external-ownership-ratio-reconcile', ok:Math.abs(Number(state.externalShareholderRatio||0)-expectedExternalRatio)<=1e-9, authoritative:expectedExternalRatio, adapter:Number(state.externalShareholderRatio||0) },
    { id:'cash-flow-ending-vs-authoritative-cash', ok:Math.abs(cfEnding-Number(state.companyCash))<=0.5, authoritative:Number(state.companyCash), adapter:cfEnding },
    { id:'cash-flow-rollforward', ok:Math.abs((cfOpening+cfChange)-cfEnding)<=0.5, expectedEndingCash:cfOpening+cfChange, actualEndingCash:cfEnding },
    { id:'finance-validate', ok:validation.ok===true, errors:Object.freeze([...(validation.errors||[])]) }
  ];
  const companyCashCheck=invariants.find(row=>row.id==='company-cash-vs-balance-sheet');
  const debtCheck=invariants.find(row=>row.id==='company-debt-vs-active-loans');
  const ownershipChecks=invariants.filter(row=>['founder-shares-within-outstanding','treasury-shares-nonnegative','market-issued-shares-reconcile','external-ownership-ratio-reconcile'].includes(row.id));
  const standaloneChecks=invariants.filter(row=>['cash-flow-ending-vs-authoritative-cash','cash-flow-rollforward','finance-validate'].includes(row.id));
  return Object.freeze({
    ok: invariants.every(row=>row.ok),
    invariants:Object.freeze(invariants),
    companyCash:Object.freeze({ok:companyCashCheck.ok,authoritative:Number(state.companyCash),statement:bsCash}),
    debt:Object.freeze({ok:debtCheck.ok,authoritative:Number(state.companyDebt||0),instruments:activeLoanDebt}),
    ownership:Object.freeze({ok:ownershipChecks.every(row=>row.ok),sharesOut,founderShares,treasuryShares,externalRatio:expectedExternalRatio,checks:Object.freeze(ownershipChecks)}),
    standaloneFinance:Object.freeze({ok:standaloneChecks.every(row=>row.ok),errors:Object.freeze([...(validation.errors||[])]),endingCashDifference:cfEnding-Number(state.companyCash),rollforwardDifference:(cfOpening+cfChange)-cfEnding})
  });
}

function characterizeLegacyAdapterParity(runtime) {
  return snapshotLegacyAdapterParity(runtime);
}

function classifySeedProvenance(runtimeOrLoaded, stateMaybe) {
  const loaded = runtimeOrLoaded?.loaded || runtimeOrLoaded;
  const state = runtimeOrLoaded?.engine?.g || stateMaybe;
  const roots = subsystemSeedRoots(loaded, state);
  const classification = roots.some(row => row.classification === 'legacy-persisted-subsystem-seed')
    ? 'legacy-persisted-subsystem-seed'
    : 'new-game-seed-root';
  return Object.freeze({
    classification,
    includeInCalibrationAggregation: classification === 'new-game-seed-root',
    roots:Object.freeze(roots)
  });
}

function probeIdempotentOperation(runtime, operation) {
  if (typeof operation !== 'function') throw new Error('operation callback is required.');
  const beforeHash = semanticStateHash(runtime.engine.g, runtime.scenario.stateHashVersion);
  const firstResult = operation(runtime);
  const firstHash = semanticStateHash(runtime.engine.g, runtime.scenario.stateHashVersion);
  const secondResult = operation(runtime);
  const secondHash = semanticStateHash(runtime.engine.g, runtime.scenario.stateHashVersion);
  const ok = firstHash === secondHash;
  if (!ok) throw new Error(`Operation replay was not idempotent: ${firstHash} != ${secondHash}`);
  return Object.freeze({ ok, beforeHash, firstHash, secondHash, firstResult, secondResult });
}

function probeDeterministicRollback(runtime, mutator, options = {}) {
  if (typeof mutator !== 'function') throw new Error('rollback mutator callback is required.');
  const before = cloneJson(runtime.engine.g);
  const beforeHash = semanticStateHash(before, runtime.scenario.stateHashVersion);
  let threw = false;
  try {
    runtime.engine.runTransaction(() => {
      mutator(runtime);
      if (options.throwError) throw new Error('phase0-5-rollback-probe');
      return false;
    }, 'phase0-5-probe');
  } catch (error) {
    if (!options.throwError || error.message !== 'phase0-5-rollback-probe') throw error;
    threw = true;
  }
  const diff = diffSemanticState(before, runtime.engine.g, runtime.scenario.stateHashVersion);
  if (diff) throw new Error(`Rollback probe left a state mutation: ${JSON.stringify(diff)}`);
  return Object.freeze({ok:true,threw,beforeHash,afterHash:semanticStateHash(runtime.engine.g,runtime.scenario.stateHashVersion)});
}

function probeDeterministicIds(runtime, options = {}) {
  const prefix = String(options.prefix || 'phase05');
  const count = Math.max(1, Math.floor(Number(options.count || 16)));
  const ids = Array.from({ length: count }, () => runtime.loaded.modules.simulationRng.nextID(runtime.engine.g, prefix));
  if (new Set(ids).size !== ids.length) throw new Error('Deterministic ID probe generated a collision.');
  return Object.freeze(ids);
}

function createRuntimeFromPersistedState(scenarioInput, payload, options = {}) {
  const scenario = scenarioInput?.harnessSchemaVersion === HARNESS_SCHEMA_VERSION ? scenarioInput : createScenario(scenarioInput);
  if (typeof payload !== 'string') throw new Error('Serialized persisted state is required.');
  const loaded = loadGame({
    headless:true,
    random:()=>Number.isFinite(Number(options.hostEntropy))?Number(options.hostEntropy):0.25,
    localStorageInitial:{ capitalism_tycoon_web_v1:payload }
  });
  const engine = loaded.engineModule.TycoonEngine.load();
  if (!engine?.g?.configured) throw new Error('Persisted Phase 0.5 runtime did not load as a configured game.');
  const runtime={scenario,loaded,engine,sourceMainSha:resolveSourceMainSha(options.sourceMainSha),engineCapabilities:declareEngineCapabilities(loaded)};
  const invariants=assertEconomicInvariants(runtime,scenario.expectedInvariants);
  if(!invariants.ok)throw new Error(`Reloaded Phase 0.5 invariants failed: ${invariants.errors.join(' / ')}`);
  return runtime;
}

function comparePersistenceFork(scenarioInput, options = {}) {
  const scenario = scenarioInput?.harnessSchemaVersion === HARNESS_SCHEMA_VERSION ? scenarioInput : createScenario(scenarioInput);
  const beforeWeeks=Math.max(0,Math.floor(Number(options.beforeWeeks??2)));
  const afterWeeks=Math.max(0,Math.floor(Number(options.afterWeeks??3)));
  const compacted=Boolean(options.compacted);
  const profile=String(options.profile||'normal');
  const source=createRuntime(scenario,options);
  for(let i=0;i<beforeWeeks;i++)stepEconomicTick(source);
  const persisted=persistRuntime(source,compacted?{mode:'compacted',profile,savedAt:'2000-01-01T00:00:00.000Z'}:{mode:'production-auto',savedAt:'2000-01-01T00:00:00.000Z'});
  const reloaded=loadRuntimeFromPayload(source,persisted.payload,{hostEntropy:0.91});
  const comparison=compacted||persisted.storageMode!=='raw'?'compacted':'semantic';
  const immediate=assertForkEquivalent(source,reloaded,{comparison,profile});
  const checkpoints=advanceForkPair(source,reloaded,afterWeeks,{comparison,profile});
  return Object.freeze({
    ok:true,
    compacted,
    profile:compacted?profile:null,
    storageMode:persisted.storageMode,
    bytes:persisted.bytes,
    originalBytes:persisted.originalBytes,
    immediate,
    checkpoints,
    rngParity:stableStringify(source.engine.g.simulationRng)===stableStringify(reloaded.engine.g.simulationRng),
    nextIDParity:source.engine.g.simulationRng.nextID===reloaded.engine.g.simulationRng.nextID,
    finalSemanticDiff:diffSemanticState(source.engine.g,reloaded.engine.g,scenario.stateHashVersion),
    finalPersistenceDiff:comparison==='compacted'?diffPersistenceState(source,reloaded,profile):null
  });
}

function replayScenario(scenarioInput, options = {}) {
  const scenario=scenarioInput?.harnessSchemaVersion===HARNESS_SCHEMA_VERSION?scenarioInput:createScenario(scenarioInput);
  const seedRuntime=createRuntime(scenario,options);
  const persisted=persistRuntime(seedRuntime,{mode:'production-auto',savedAt:'2000-01-01T00:00:00.000Z'});
  const left=loadRuntimeFromPayload(seedRuntime,persisted.payload,{hostEntropy:0.13});
  const right=loadRuntimeFromPayload(seedRuntime,persisted.payload,{hostEntropy:0.87});
  const comparison=persisted.storageMode==='raw'?'semantic':'compacted';
  const checkpoints=advanceForkPair(left,right,Math.max(1,Math.floor(Number(options.replayWeeks??3))),{comparison,profile:'normal'});
  const finalDiff=comparison==='compacted'?diffPersistenceState(left,right,'normal'):diffSemanticState(left.engine.g,right.engine.g,scenario.stateHashVersion);
  const leftInvariantResult=assertEconomicInvariants(left,scenario.expectedInvariants);
  const rightInvariantResult=assertEconomicInvariants(right,scenario.expectedInvariants);
  const leftPathSignature=sha256(stableStringify(checkpoints.map(row=>({week:row.week,hash:row.leftHash}))));
  const rightPathSignature=sha256(stableStringify(checkpoints.map(row=>({week:row.week,hash:row.rightHash}))));
  return Object.freeze({
    ok:finalDiff===null&&leftInvariantResult.ok&&rightInvariantResult.ok&&leftPathSignature===rightPathSignature,
    storageMode:persisted.storageMode,
    comparison,
    finalDiff,
    leftHash:semanticStateHash(left.engine.g,scenario.stateHashVersion),
    rightHash:semanticStateHash(right.engine.g,scenario.stateHashVersion),
    leftPathSignature,
    rightPathSignature,
    pathSignatureMatch:leftPathSignature===rightPathSignature,
    leftInvariantResult,
    rightInvariantResult,
    rngParity:stableStringify(left.engine.g.simulationRng)===stableStringify(right.engine.g.simulationRng),
    nextIDParity:left.engine.g.simulationRng.nextID===right.engine.g.simulationRng.nextID,
    checkpoints
  });
}

function characterizeRollback(runtime) {
  const rng=runtime.loaded.modules.simulationRng;
  const finance=runtime.loaded.modules.finance;
  const cases=[];
  const execute=(id,throws)=>{
    const before=semanticStateHash(runtime.engine.g);
    const beforeComponents={
      companyCash:runtime.engine.g.companyCash,
      personalCash:runtime.engine.g.personalCash,
      companyDebt:runtime.engine.g.companyDebt,
      financeTransactions:runtime.engine.g.finance.transactions.length,
      stores:stableStringify(runtime.engine.g.stores),
      simulationRng:stableStringify(runtime.engine.g.simulationRng),
      draws:runtime.engine.g.simulationRng.draws,
      nextID:runtime.engine.g.simulationRng.nextID
    };
    let rethrown=false;
    const work=()=>{
      runtime.engine.g.companyCash-=111;
      runtime.engine.g.personalCash-=222;
      runtime.engine.g.companyDebt+=333;
      finance.event(runtime.engine.g,'otherOperating',111,{cashEffect:-111,profitEffect:-111,sourceType:'phase05Rollback',idempotencyKey:`phase05-rollback-${id}`,operationID:`phase05-rollback-${id}`});
      runtime.engine.g.stores.push({id:`phase05-partial-${id}`,businessID:'ramen'});
      rng.next(runtime.engine.g);
      rng.nextID(runtime.engine.g,'rollback');
      if(throws)throw new Error(`injected-${id}`);
      return false;
    };
    try{runtime.engine.runTransaction(work);}catch(error){rethrown=error.message===`injected-${id}`;}
    const after=semanticStateHash(runtime.engine.g);
    const components={
      companyCash:runtime.engine.g.companyCash===beforeComponents.companyCash,
      personalCash:runtime.engine.g.personalCash===beforeComponents.personalCash,
      companyDebt:runtime.engine.g.companyDebt===beforeComponents.companyDebt,
      financeTransactions:runtime.engine.g.finance.transactions.length===beforeComponents.financeTransactions,
      storesOrAssets:stableStringify(runtime.engine.g.stores)===beforeComponents.stores,
      simulationRng:stableStringify(runtime.engine.g.simulationRng)===beforeComponents.simulationRng,
      rngDraws:runtime.engine.g.simulationRng.draws===beforeComponents.draws,
      deterministicIDCounter:runtime.engine.g.simulationRng.nextID===beforeComponents.nextID
    };
    cases.push({id,ok:before===after&&rethrown===throws&&Object.values(components).every(Boolean),rethrown,semanticStateRestored:before===after,components});
  };
  execute('full-mutation-return-false',false);
  execute('full-mutation-throw-rethrow',true);
  return Object.freeze({ok:cases.every(row=>row.ok),cases:Object.freeze(cases)});
}

function characterizeIdempotency(runtime) {
  const state=runtime.engine.g;
  const property=state.properties.find(row=>row&&!row.owner);
  if(!property||typeof runtime.engine.payPropertyTax!=='function')throw new Error('Property-tax production action is unavailable.');
  property.owner='company';
  property.propertyTaxAccrued=50_000;
  property.propertyTaxPaidTotal=0;
  property.lastPropertyTaxPaymentWeek=0;
  const cashBefore=state.companyCash;
  const rowsBefore=state.finance.transactions.length;
  const firstResult=runtime.engine.payPropertyTax(property.id);
  const afterFirst={companyCash:state.companyCash,financeTransactions:state.finance.transactions.length,propertyTaxAccrued:property.propertyTaxAccrued,propertyTaxPaidTotal:property.propertyTaxPaidTotal,lastPropertyTaxPaymentWeek:property.lastPropertyTaxPaymentWeek};
  const replayResult=runtime.engine.payPropertyTax(property.id);
  const afterReplay={companyCash:state.companyCash,financeTransactions:state.finance.transactions.length,propertyTaxAccrued:property.propertyTaxAccrued,propertyTaxPaidTotal:property.propertyTaxPaidTotal,lastPropertyTaxPaymentWeek:property.lastPropertyTaxPaymentWeek};
  const expectedKey=`property-tax-payment-${property.id}-w${state.week}`;
  const matchingRows=state.finance.transactions.filter(row=>row.idempotencyKey===expectedKey);
  const round2=value=>Math.round(Number(value)*100)/100;
  const expectedCashAfter=round2(cashBefore-50_000);
  const cashMovedOnce=round2(afterFirst.companyCash)===expectedCashAfter&&afterReplay.companyCash===afterFirst.companyCash;
  const financeRowCreatedOnce=afterFirst.financeTransactions===rowsBefore+1&&afterReplay.financeTransactions===afterFirst.financeTransactions&&matchingRows.length===1;
  const economicStateUpdatedOnce=afterFirst.propertyTaxAccrued===0&&afterFirst.propertyTaxPaidTotal===50_000&&stableStringify(afterReplay)===stableStringify(afterFirst);
  const row=Object.freeze({id:'company-property-tax-same-week-replay',productionAction:'TycoonEngine.payPropertyTax',operationIdentity:expectedKey,firstAccepted:Number(firstResult)===50_000,replayRejected:replayResult===false,cashMovedOnce,financeRowCreatedOnce,economicStateUpdatedOnce,cashDelta:round2(afterReplay.companyCash-cashBefore),rowsAdded:afterReplay.financeTransactions-rowsBefore});
  return Object.freeze({ok:Object.values(row).filter(value=>typeof value==='boolean').every(Boolean),cases:Object.freeze([row]),duplicateCashMovementPrevented:cashMovedOnce});
}

function characterizeIdAllocation(runtime) {
  const rng=runtime.loaded.modules.simulationRng;
  const payload=JSON.stringify(runtime.engine.g);
  const twin=createRuntimeFromPersistedState(runtime.scenario,payload,{sourceMainSha:runtime.sourceMainSha,hostEntropy:0.8});
  const left=Array.from({length:32},()=>rng.nextID(runtime.engine.g,'entity'));
  const rightRng=twin.loaded.modules.simulationRng;
  const right=Array.from({length:32},()=>rightRng.nextID(twin.engine.g,'entity'));
  const reloaded=createRuntimeFromPersistedState(runtime.scenario,JSON.stringify(runtime.engine.g),{sourceMainSha:runtime.sourceMainSha,hostEntropy:0.4});
  const continuousNext=rng.nextID(runtime.engine.g,'entity');
  const reloadNext=reloaded.loaded.modules.simulationRng.nextID(reloaded.engine.g,'entity');
  const beforeRollback=runtime.engine.g.simulationRng.nextID;
  runtime.engine.runTransaction(()=>{rng.nextID(runtime.engine.g,'entity');return false;});
  return Object.freeze({
    ok:stableStringify(left)===stableStringify(right)&&continuousNext===reloadNext&&new Set(left).size===left.length&&runtime.engine.g.simulationRng.nextID===beforeRollback,
    sequence:Object.freeze(left),
    replaySequence:Object.freeze(right),
    unique:new Set(left).size===left.length,
    samePersistedStateSameSequence:stableStringify(left)===stableStringify(right),
    reloadContinuity:continuousNext===reloadNext,
    rollbackPreservedCounter:runtime.engine.g.simulationRng.nextID===beforeRollback
  });
}

function preparePersistenceSeedRuntime(scenarioInput,options={}) {
  const runtime=createRuntime(scenarioInput,options);
  runtime.engine.g.personalCash+=5_000_000;
  if(!runtime.engine.contributeFounderCapital(2_000_000))throw new Error('Phase 0.5 founder contribution fixture failed.');
  if(!runtime.engine.borrow(500_000,'company'))throw new Error('Phase 0.5 debt fixture failed.');
  for(let i=0;i<2;i++)stepEconomicTick(runtime);
  const invariants=assertEconomicInvariants(runtime);
  if(!invariants.ok)throw new Error(`Phase 0.5 persistence fixture invalid: ${invariants.errors.join(' / ')}`);
  return runtime;
}

function runPersistenceCharacterization(scenarioInput, options = {}) {
  const scenario=scenarioInput?.harnessSchemaVersion===HARNESS_SCHEMA_VERSION?scenarioInput:createScenario(scenarioInput);
  const runtime=preparePersistenceSeedRuntime(scenario,options);
  const seedState=JSON.stringify(runtime.engine.g);
  const isolated=()=>createRuntimeFromPersistedState(scenario,seedState,{...options,sourceMainSha:runtime.sourceMainSha});
  const replayEvidence=replayScenario(scenario,{...options,replayWeeks:3});
  const persistenceEvidence=Object.freeze({
    saveReloadFork:comparePersistenceFork(scenario,{...options,compacted:false}),
    compactedSaveReloadFork:comparePersistenceFork(scenario,{...options,compacted:true})
  });
  const rollbackEvidence=characterizeRollback(isolated());
  const idempotencyEvidence=characterizeIdempotency(isolated());
  const idAllocationEvidence=characterizeIdAllocation(isolated());
  const legacyAdapterParity=characterizeLegacyAdapterParity(isolated());
  const provenance=classifySeedProvenance(runtime);
  return Object.freeze({
    reportSchemaVersion:REPORT_SCHEMA_VERSION,
    harnessSchemaVersion:scenario.harnessSchemaVersion,
    scenarioId:scenario.scenarioId,
    sourceMainSha:runtime.sourceMainSha,
    engineCapabilities:runtime.engineCapabilities,
    requestedScenarioSeed:scenario.requestedScenarioSeed,
    simulationRngSeed:Number(runtime.engine.g.simulationRng.seed),
    subsystemSeedRoots:provenance.roots,
    runClassification:provenance.classification,
    includeInCalibrationAggregation:provenance.includeInCalibrationAggregation,
    replayEvidence,
    persistenceEvidence,
    rollbackEvidence,
    idempotencyEvidence,
    idAllocationEvidence,
    legacyAdapterParity,
    ok:replayEvidence.ok&&persistenceEvidence.saveReloadFork.ok&&persistenceEvidence.compactedSaveReloadFork.ok&&rollbackEvidence.ok&&idempotencyEvidence.ok&&idAllocationEvidence.ok&&legacyAdapterParity.ok
  });
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
  findNonFiniteNumbers,
  assertEconomicInvariants,
  createRuntime,
  createRuntimeFromPersistedState,
  persistRuntime,
  loadRuntimeFromPayload,
  projectPersistenceComparableState,
  diffPersistenceState,
  assertForkEquivalent,
  advanceForkPair,
  replayScenario,
  comparePersistenceFork,
  snapshotLegacyAdapterParity,
  characterizeLegacyAdapterParity,
  classifySeedProvenance,
  probeIdempotentOperation,
  probeDeterministicRollback,
  probeDeterministicIds,
  characterizeRollback,
  characterizeIdempotency,
  characterizeIdAllocation,
  runPersistenceCharacterization,
  stepEconomicTick,
  runScenario,
  formatJsonReport,
  resolveSourceMainSha,
  stableStringify
});
