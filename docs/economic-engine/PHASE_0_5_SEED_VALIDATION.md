# Phase 0.5 Seed Provenance and Independence Contract

**Status: Phase 0.5 validation requirement**  
**Baseline lesson: #812 / #820**  
**Implementation permission: validation infrastructure only**

## 1. Why this contract exists

A multi-seed test is not a multi-path test unless the seed being varied is the seed that actually controls the simulation.

Before #820, the economic foundation derived its seed from company name/ticker. Strategy tests held company name fixed, so changing the nominal test seed repeatedly did not vary the macro path. The tests therefore measured the same economy many times and understated scenario risk.

#820 corrected new-game economic-foundation seeding to use the persisted `state.simulationRng.seed`.

Phase 0.5 must make this class of pseudo-replication impossible to miss.

## 2. Seed source of truth

For a new-game Phase 0.5 scenario:

```text
scenario.seed
  == initial persisted state.simulationRng.seed
  == root seed for deterministic stochastic simulation
```

The harness must inject the requested scenario seed explicitly through the production simulation-RNG contract. It must not claim to be testing seed N merely because host `Math.random`, a test-local PRNG, a company name, ticker, player name, scenario label, or fixture ID changed.

New deterministic stochastic subsystems must either:

1. consume the persisted `simulationRng` stream, or
2. derive a keyed/substream seed from the persisted `simulationRng.seed` under an explicitly documented deterministic derivation.

Company identity and other labels are not entropy sources unless a separately approved economic rule explicitly makes the label an economic input.

## 3. Legacy-save exception

Backward compatibility is separate from new-game calibration.

A legacy save may preserve a subsystem seed that was already persisted before the current seed-root contract. Reload must not silently replace that persisted seed merely to make it match a new-game rule.

Phase 0.5 reports must classify runs as:

- `new-game-seed-root`
- `legacy-persisted-subsystem-seed`

Legacy-compatibility runs must not be mixed into new-game multi-seed calibration statistics without an explicit reason.

## 4. Required seed provenance in every scenario report

Every Phase 0.5 scenario result that involves randomness must record at minimum:

```text
requestedScenarioSeed
simulationRng.seed
simulationRng.version
simulationRng.drawsAtScenarioStart
simulationRng.drawsAtScenarioEnd
subsystemSeedRoots[]
scenarioIdentityFields
semanticStateHashVersion
outcomePathSignature or equivalent deterministic path fingerprint
```

For the economic foundation, the report must additionally expose `economicFoundation.seed`.

A report that cannot prove which persisted simulation seed produced the outcome is not valid calibration evidence.

## 5. Mandatory pre-statistics gates

Before calculating medians, hit rates, percentiles, success rates or balance conclusions across a seed sweep, the harness must verify:

### 5.1 Requested-seed provenance

For every new-game case:

```text
requestedScenarioSeed === state.simulationRng.seed
```

If not, fail the scenario before using its result.

### 5.2 Seed diversity

For an intended N-seed sweep:

```text
distinct(state.simulationRng.seed).count === N
```

A duplicate persisted simulation seed invalidates the sweep unless the duplicate is intentional and labeled as a replay case.

### 5.3 Path diversity

With all non-seed scenario inputs held fixed, the harness must confirm that changing `simulationRng.seed` actually changes the stochastic path being studied.

For curated deterministic smoke seeds, the expected path signatures should be distinct. For larger statistical suites, at minimum the harness must detect and report accidental path collapse before computing distribution statistics.

A sweep that changes requested seeds but produces one repeated stochastic path is a failed validation, not a low-variance result.

### 5.4 Replay determinism

Same initial state + same persisted `simulationRng` state + same command sequence must reproduce the same semantic path/hash.

### 5.5 Nuisance-input invariance

Hold `simulationRng.seed` fixed and vary non-economic identity/label fields such as:

- company name
- ticker
- player name
- fixture/scenario display label

The stochastic subsystem under test must keep the same seed root and stochastic path unless that field is explicitly documented as an approved economic input.

For the economic foundation specifically:

```text
same simulationRng.seed + different companyName/ticker
→ same economicFoundation.seed
→ same macro path
```

This check is required because #820 fixed exactly this failure mode.

## 6. Host-entropy separation

Production may read host entropy once when creating a normal new game, then persist the resulting `simulationRng.seed`.

Phase 0.5 calibration must not depend on that host-entropy draw. It must inject explicit scenario seeds so runs are reproducible and auditable.

Changing the test runner's host `Math.random`, clock, UUID source, process order or machine must not change a scenario whose persisted simulation state is fixed.

## 7. Keyed randomness / substreams

A keyed deterministic subsystem may read `simulationRng.seed` without consuming the main stream if its contract requires read-only keyed randomness.

Such a subsystem must satisfy both:

- same root seed + same key → same draw;
- changing unrelated identity labels does not change the draw.

Where weekly keyed draws are intended to behave as independent noise, Phase 0.5 should include correlation/reachability diagnostics appropriate to that subsystem. Passing deterministic replay alone is not evidence that adjacent keyed draws are statistically well mixed.

## 8. Experimental-design rule

A seed-sweep experiment must separate two questions:

### Seed sensitivity

Keep all scenario inputs fixed except `simulationRng.seed`.

Use this for distributions, balance, reachability and tail-risk measurement.

### Nuisance sensitivity

Keep `simulationRng.seed` fixed and vary fields that should not control randomness.

Use this to prove that names, tickers, labels and fixture metadata are not hidden entropy sources.

Do not vary seed and company identity simultaneously when the purpose is to measure seed sensitivity; that confounds the experiment.

## 9. Phase 0.5 acceptance evidence

Before Phase 0.5 is accepted, the permanent harness must demonstrate:

- explicit scenario seed injection into persisted `simulationRng.seed`;
- seed provenance in machine-readable reports;
- unique persisted seeds for intended multi-seed sweeps;
- replay determinism;
- nuisance-input invariance;
- path-diversity guard before statistical aggregation;
- legacy persisted-subsystem-seed compatibility kept separate;
- no new company-name/ticker-derived randomness in new-game simulation paths unless explicitly approved.

## 10. Current executable regression

`tests/phase0-5-seed-provenance-test.js` is the initial executable contract for the #820 lesson.

It verifies on current production code that:

1. an explicit scenario seed becomes the persisted `simulationRng.seed`;
2. the economic foundation derives its new-game seed from that persisted seed;
3. several different simulation seeds with a fixed company identity produce distinct macro paths;
4. a fixed simulation seed produces the same macro path across different company names/tickers/player names;
5. keyed macro draws do not consume the persisted simulation RNG stream.

This test is a precursor to, not a substitute for, the full permanent Phase 0.5 harness.
