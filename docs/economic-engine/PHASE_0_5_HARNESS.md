# Phase 0.5 Permanent Headless Harness

**Status: REPORTING / PERFORMANCE / SCALE IMPLEMENTATION — P0.5-3**  
**Tracker: #833**  
**Implementation baseline: NO**  
**Phase 1 authorization: NO**

## Purpose

This harness is permanent validation and benchmarking infrastructure for the Economic Engine migration.

It runs the current production module composition without UI interaction and records deterministic, machine-readable evidence before any Economic Engine source-of-truth cutover.

The core implementation lives at:

- `scripts/phase0-5-harness.js`
- `tests/phase0-5-harness-core-test.js`

The normative seed contract remains:

- `docs/economic-engine/PHASE_0_5_SEED_VALIDATION.md`

## Core API

P0.5-1 provides:

- `createScenario(...)`
- `createRuntime(...)`
- `stepEconomicTick(...)`
- `runScenario(...)`
- `snapshotMetrics(...)`
- `assertEconomicInvariants(...)`
- `semanticStateHash(...)`
- `diffSemanticState(...)`
- `formatJsonReport(...)`

## Versioned contracts

Current versions:

- harness schema: `1`
- report schema: `3`
- semantic state hash/projection: `1` / `production-state-v1` (compatibility default), and explicit
  `2` / `economic-state-v2`

Report schema 2 is additive: all schema-1 core fields retain their meanings, while P0.5-2 adds persistence, replay, rollback, idempotency, deterministic-ID, adapter-parity, and seed-classification evidence through `runPersistenceCharacterization(...)`. State-hash projection v1 is unchanged.

Report schema 3 is additive over schema 2. It adds benchmark tier provenance, tick latency distribution, persistence timings and sizes, persistence checkpoint evidence, a serialized-state memory proxy, and monetary Number-envelope characterization. Semantic projection v1 remains unchanged.

Version 1 semantic projection includes the full JSON-safe production simulation state except `lastSaveDate`, which is wall-clock save metadata rather than deterministic simulation state.

Changing projection semantics requires a new state-hash version. Existing benchmark evidence must not silently change meaning.

GF-009 adds projection v2 as an explicit scenario selection (`stateHashVersion: 2`) without
changing the v1 default. V2 is an allowlisted economic fingerprint: it includes calendar/macro/RNG,
cash and financing, ownership, operating entities and assets, economically active projects and
commitments, economic geography, histories that record realized outcomes, and deterministic ID
counters. It excludes transient selection/panel state, display identity and labels, reports/news,
caches/diagnostics, and save metadata. Entity-set arrays (for example stores, properties,
competitors, and loans) sort non-mutatingly by durable IDs; chronological transactions and other
history/queue arrays preserve order. Its typed canonical serialization distinguishes `NaN`, both
infinities, `null`, and `undefined`, and uses code-unit key/ID comparison rather than locale rules.

P0.5-2 evidence uses isolated fresh runtimes. Rollback cases mutate company and personal cash, finance rows, stores, RNG draws/state, and the deterministic ID counter before both a `false` return and a thrown/rethrown failure. Idempotency evidence calls the production `TycoonEngine.payPropertyTax` action twice for the same property and week, proving that cash, the finance row, and property-tax state move only once.

The deterministic-ID report characterizes only contracts implemented by production:

- the same persisted state yields the same sampled sequence
- a reload continues at the same next ID
- transaction rollback restores the counter
- the sampled sequence contains no duplicate IDs

It does not claim a collision fallback that production does not implement. Legacy adapter parity emits named PASS/FAIL invariants for company cash versus B/S cash, company debt versus active loan principal, ownership/share reconciliation, cash-flow ending cash and cash roll-forward.

## P0.5-3 reporting and measurement contracts

`runBenchmarkScenario(...)` executes the production `advanceWeek` wrapper and measures each tick
with an injectable monotonic clock (default: `performance.now()`). Timing never enters simulation
state, hashes, RNG input, or economic decisions. Percentiles use **nearest rank**: after numeric
ascending sort, percentile `p` is item `ceil(p * count)` (with a minimum rank of one).

`formatCsvReport(...)` uses the frozen `CSV_COLUMNS` order and RFC-style double-quote escaping.
`formatMarkdownReport(...)` emits deterministic Provenance, Determinism, Invariants, Performance,
Persistence, Memory, Classification, and Capability matrix sections. Neither formatter adds a
clock timestamp.

Save sizes follow the production quota convention: JavaScript string code units multiplied by
two, described in reports as `UTF-16-compatible production budget: codeUnits * 2`. Serialization,
normal-profile `compactStateForStorage`, production fresh-runtime load, and `saveWithAdapter` are
measured separately. Measurements are baselines, not performance SLAs; only missing, zero/negative,
or non-finite instrumentation is a correctness failure in P0.5-3.

The memory measurement is a deterministic practical proxy: serialized authoritative-state bytes
plus retained benchmark-result bytes. It is **not** Node RSS, browser heap, or physical-iPhone
memory use and is not a hard resource budget.

The monetary envelope scans monetary-looking production fields without mutation and reports the
maximum absolute observed value, unsafe integer count, non-finite count, and fixed probes from
`1e6` through the `Number.MAX_SAFE_INTEGER` boundary. It characterizes the current Number and
two-decimal rounding behavior; it does not introduce Decimal/int64 behavior.

## Benchmark tiers and CI placement

| Tier | Weeks | Seeds | Persistence interval | Intended surface |
|---|---:|---:|---:|---|
| `smoke` | 12 | 2 | 6 weeks | pull-request canonical tests |
| `nightly` | 520 | 4 | 52 weeks | scheduled or manual npm script |
| `deepAudit` | 2600 | 8 | 104 weeks | manual-only npm script |

The engine still supports one detailed player company. Tiers scale only production-safe duration,
seed count, and persistence cadence; `runBenchmarkScenario(...)` executes isolated production persistence
checkpoints at that cadence and always captures the final week. `multiCompanyScaleMatrix` remains false. Canonical PR shards
run only small smoke fixtures. `npm run harness:phase0-5:nightly` and
`npm run harness:phase0-5:deep-audit` expose the heavier tiers without adding them to PR CI.

## Deterministic scenario seed injection

Normal gameplay remains unchanged:

`TycoonEngine.configure(...)`

continues to draw host entropy once when no explicit seed is provided.

The Phase 0.5 harness uses:

`TycoonEngine.configure({ ..., simulationSeed })`

so the requested scenario seed is present before production initial-state generation consumes the simulation RNG.

The harness fails if:

`requestedScenarioSeed !== state.simulationRng.seed`

This avoids the invalid pattern of generating a game under one random root and reseeding only after stochastic initial state has already been created.

## Required report provenance

The JSON core report records:

- `harnessSchemaVersion`
- `reportSchemaVersion`
- `sourceMainSha`
- `engineCapabilities`
- `scenarioFeatures`
- `scenarioSize`
- `requestedScenarioSeed`
- `simulationRngSeed`
- `simulationRngVersion`
- `simulationRngDrawsAtStart`
- `simulationRngDrawsAtEnd`
- `subsystemSeedRoots`
- `scenarioIdentityFields`
- `runClassification`
- `outcomePathSignature`
- `expectedInvariants`
- `stateHashVersion`
- initial/final semantic hashes
- initial/final metric probes

## Current invariant gate

P0.5-1 checks:

- production `finance.validate`
- finite-state traversal
- JSON serializability
- requested seed = persisted simulation root

Later Phase 0.5 slices add replay/persistence/failure/adapter-specific gates without weakening these checks.

## Outcome path fingerprint

`outcomePathSignature` is separate from the authoritative semantic state hash.

The authoritative state hash intentionally retains identity fields such as company name and ticker.

The path signature fingerprints economic observations across ticks and is therefore suitable for seed-diversity and nuisance-input experiments where display identity is intentionally varied.

## Capability declaration

Reports explicitly declare what the harness can and cannot yet prove.

P0.5-2 now implements and advertises:

- production save/reload fork
- compacted-save/reload fork through a production compaction-equivalence projection
- operation replay/idempotency probe
- deterministic rollback/failure probe
- deterministic ID-allocation probe
- legacy adapter parity probe
- legacy persisted-subsystem-seed classification

P0.5-3 now additionally implements and advertises:

- CSV report
- Markdown report
- performance distribution report
- scenario tier control
- multi-seed matrix

Still not implemented:

- multi-company scale matrix

A later phase must not infer that capability merely because the benchmark tiers exist.

## CLI

Example:

```bash
node scripts/phase0-5-harness.js --seed 83951617 --weeks 52 --difficulty normal
```

An explicit seed is mandatory.

## Remaining tracker slices

### P0.5-2

Implemented in the persistence/replay slice:
- `persistRuntime(...)`
- `loadRuntimeFromPayload(...)`
- `assertForkEquivalent(...)`
- `advanceForkPair(...)`
- `snapshotLegacyAdapterParity(...)`
- `classifySeedProvenance(...)`
- `probeIdempotentOperation(...)`
- `probeDeterministicRollback(...)`
- `probeDeterministicIds(...)`

Raw/production-auto saves use `saveStorage.saveWithAdapter()` and fresh `TycoonEngineV9.load()`.
Forced compacted forks use `saveStorage.storagePayload()` / `compactStateForStorage()` on both sides for persistence-equivalence comparison, so intentional archival compaction is not misclassified as simulation nondeterminism.

### P0.5-3

CSV/Markdown output, performance timing, persistence sizing, memory proxy, monetary-envelope and scale/tier controls.

### P0.5-4

Permanent pre-statistics acceptance gates, writer/phase characterization, final evidence report and owner acceptance.

Phase 1 remains blocked until #833 is complete and accepted together with the remaining entry gates.
