# Phase 0.5 Permanent Headless Harness

**Status: CORE IMPLEMENTATION — P0.5-1**  
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
- report schema: `1`
- semantic state hash/projection: `1` / `production-state-v1`

Version 1 semantic projection includes the full JSON-safe production simulation state except `lastSaveDate`, which is wall-clock save metadata rather than deterministic simulation state.

Changing projection semantics requires a new state-hash version. Existing benchmark evidence must not silently change meaning.

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

P0.5-1 declares these as not yet implemented:

- save/reload fork
- compacted-save/reload fork
- CSV report
- Markdown report
- multi-company scale matrix
- performance distribution report

A later phase must not infer those capabilities merely because the core runner exists.

## CLI

Example:

```bash
node scripts/phase0-5-harness.js --seed 83951617 --weeks 52 --difficulty normal
```

An explicit seed is mandatory.

## Remaining tracker slices

### P0.5-2

Persistence, replay, rollback/failure, ID-collision and legacy adapter characterization.

### P0.5-3

CSV/Markdown output, performance timing, persistence sizing, memory proxy, monetary-envelope and scale/tier controls.

### P0.5-4

Permanent pre-statistics acceptance gates, writer/phase characterization, final evidence report and owner acceptance.

Phase 1 remains blocked until #833 is complete and accepted together with the remaining entry gates.
