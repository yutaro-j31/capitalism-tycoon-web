# Physical iPhone Economic Engine Baseline Protocol

**Status: DRAFT — Gate C measurement contract**  
**Implementation baseline: NO**  
**Repository baseline for this protocol: `bd5fb9d32be965d0bd3c4d3987633c33a180eb87`**  
**Purpose: define the physical-iPhone baseline required before Economic Engine implementation**

> This document defines how Gate C in `ECONOMIC_ENGINE_ROADMAP.md` is measured.
>
> Passing this protocol does **not** authorize Economic Engine gameplay implementation by itself.
> The roadmap remains `Implementation baseline: NO` until all roadmap gates and owner approval are complete.

---

## 1. Why this baseline exists

The Economic Engine will add accounting, ownership, industry, valuation, capital-allocation, AI, treasury, and later consolidation workloads to a game that is already mobile-first.

Before adding that workload, establish measured physical-iPhone behavior for the current production game.

The baseline is used for two purposes:

1. **Baseline Gate** — record the current production performance before Economic Engine changes.
2. **Regression Gate** — compare each later Economic Engine vertical slice against the accepted baseline.

Synthetic Node/WebKit measurements are useful diagnostics but do not replace this physical-device baseline.

---

## 2. Evidence classification

Every result must be labelled as one of:

### MEASURED — PHYSICAL IPHONE

Measured directly on the physical iPhone running production Safari / WebKit.

### MEASURED — AUTOMATED WEBKIT

Measured in the repository WebKit acceptance environment.

### MEASURED — HEADLESS

Measured in Node/headless simulation.

### ESTIMATED

Derived from code reading, extrapolation, or non-equivalent hardware.

Only **MEASURED — PHYSICAL IPHONE** satisfies Gate C for device-specific performance.

---

## 3. Required device metadata

Record before each baseline session:

- test date
- exact main SHA
- public Pages URL / build identity where available
- iPhone model
- iOS version
- Safari / WebKit version if available
- viewport / orientation
- battery percentage
- Low Power Mode on/off
- charging/not charging
- approximate thermal state:
  - cool
  - warm
  - hot
- network type:
  - Wi-Fi
  - cellular
- browser launch mode:
  - cold launch
  - warm launch
- save used:
  - fresh game
  - benchmark fixture
  - real existing save

Never compare two performance results without retaining this metadata.

---

## 4. Required metrics

Gate C must capture at minimum:

### A. Startup / initial load

Measure:

- navigation start → production UI usable
- cold launch
- warm reload

Report:

- p50 where repeated measurement is available
- p95 where repeated measurement is available
- maximum

### B. Week advance

Measure the user-visible duration from requesting a normal production week advance until:

- simulation commits
- weekly report is usable
- UI is responsive again

Report at minimum:

- warmup runs
- measured run count
- p50
- p95
- p99 when sample size supports it
- maximum
- failed advances
- long-task count or practical responsiveness proxy

### C. Save

Measure a normal production save:

- save request → durable save completion signal

Report:

- p50
- p95
- maximum
- failures

### D. Load / reload

Measure:

- reload/navigation → saved configured game usable

Report:

- p50
- p95
- maximum
- migration/load failures

### E. Save size

Use the existing production save-storage diagnostics where possible.

Record:

- stored save bytes
- original/pre-compaction bytes where exposed
- storage mode
- browser-origin storage usage/quota where supported
- current game week

### F. Memory trend / practical proxy

Mobile Safari does not expose a universally reliable JavaScript heap metric.

Therefore record the strongest available physical-device evidence:

- browser process crash/reload: yes/no
- unexpected page reload: yes/no
- runtime recovery UI: yes/no
- responsiveness degradation after repeated advances
- save-size/history growth
- any supported memory measurement if a reliable device API is available

Do not invent a precise memory number when the platform cannot provide one.

### G. Foreground/background resume

Procedure:

1. keep a configured game open
2. background Safari
3. return to Safari
4. verify UI remains responsive
5. verify the expected week/state remains present
6. perform one week advance
7. perform one save

Record:

- state loss
- forced reload
- runtime recovery
- save failure
- successful/failed resume

### H. Thermal / sustained-load behavior

Run a sustained measurement sequence and compare beginning vs later samples.

Record:

- early week-advance p50
- late week-advance p50
- relative slowdown
- visible thermal state
- crashes/reloads

This is a practical thermal-throttling indicator, not a low-level CPU thermal measurement.

---

## 5. Required benchmark scenarios

Do not use only one arbitrary personal save.

### Scenario 1 — Fresh production game

Purpose:

- startup floor
- baseline UI load
- low-complexity week advance
- save/load floor

Use a newly configured game with deterministic benchmark setup where possible.

### Scenario 2 — Representative operating company

Purpose:

- current normal gameplay cost

Should contain representative current production systems such as:

- multiple stores
- employees/workforce
- inventory/supply where applicable
- finance history
- market/competitor state
- at least one meaningful investment/asset feature

The exact fixture must be versioned once implemented.

### Scenario 3 — Mature/heavy save

Purpose:

- expose save serialization, history, and late-game UI/simulation cost

Target a save near the upper range already considered healthy by current save-budget rules.

The benchmark fixture must not exceed production-supported save limits simply to manufacture a stress result.

---

## 6. Benchmark instrumentation requirements

Manual stopwatch measurements alone are not sufficient for sub-second engine timings.

A measurement-only instrument may be added before Gate C execution, provided it satisfies all of the following:

- no saveVersion change
- no gameplay balance change
- no Economic Engine feature implementation
- no production RNG consumption from benchmark-only work
- no mutation of the player's authoritative live state during detached benchmarks
- no extra save/emit from detached benchmark state
- benchmark result can be copied/exported as JSON
- benchmark version is recorded
- exact main SHA/build identity is recorded
- benchmark fixture/schema is versioned
- raw samples are retained in the result, not only averages

The instrument is infrastructure for Gate C, not an Economic Engine feature.

---

## 7. Detached week-advance benchmark safety contract

If a cloned engine/state is used for week-advance timing:

1. clone/migrate from a known state
2. ensure benchmark state is not the live authoritative engine
3. suppress or redirect persistence
4. suppress public UI events from the detached engine
5. do not alter localStorage/IndexedDB authoritative save
6. do not consume the live simulation RNG stream
7. run invariant checks after benchmark advances
8. verify live-state deterministic hash/equivalent snapshot is unchanged before vs after benchmark
9. discard detached state after measurement

A benchmark that changes the player's real game is invalid.

---

## 8. Sample protocol

For each benchmark scenario:

### Startup

- 5 cold launches where practical
- 10 warm reloads

### Week advance

- 10 warmup advances on detached benchmark state
- 100 measured advances where device stability permits
- retain every sample
- calculate p50 / p95 / p99 / max

If 100 samples are impractical for a production-state test, use a smaller clearly labelled sample and do not claim a p99 from insufficient data.

### Save

- 20 measured saves where safe
- retain raw samples

### Reload/load

- 10 measured reload/load cycles where practical

### Sustained run

- compare first 20 vs last 20 week-advance samples
- note thermal state and any browser reload/crash

---

## 9. Baseline acceptance rules

Gate C is a **measurement gate**, not an arbitrary optimization gate.

The first objective is to establish a trustworthy baseline.

Gate C fails automatically if any of the following occurs during the validated scenarios:

- reproducible save corruption
- reproducible load failure
- state loss after normal background/foreground cycle
- deterministic replay violation caused by measurement instrumentation
- benchmark mutates live authoritative state
- repeated browser crash/reload under normal current-game workload
- non-finite economic state
- accounting validation failure

Latency thresholds must initially be recorded as observed measurements.

Performance budgets for future Economic Engine phases should then be approved relative to the measured physical-iPhone baseline rather than invented before measurement.

---

## 10. Regression comparison contract

Every later Economic Engine vertical slice should report:

- baseline SHA
- candidate SHA
- same physical device
- same iOS/Safari where practical
- same benchmark fixture version
- same measurement method
- week p50 delta
- week p95 delta
- save p95 delta
- load p95 delta
- save-byte delta
- failures/invariants
- observed thermal/resume behavior

If the device/software environment changes, record the change and establish a new comparison baseline rather than silently mixing results.

---

## 11. Automated WebKit acceptance relationship

The repository's full-screen WebKit acceptance provides automated regression coverage for:

- real production D UI
- primary screens
- iPhone-sized viewports
- overflow/navigation integrity
- save/reload continuity
- PE flow
- M&A Deal Room flow
- browser/runtime errors

It does **not** replace physical iPhone timing, memory, thermal, background-resume, or device-storage measurement.

Both layers are required:

```text
Automated WebKit acceptance
        +
Physical iPhone baseline
        =
Mobile implementation gate evidence
```

---

## 12. Required baseline artifact

A completed baseline should produce a machine-readable JSON artifact with at least:

```json
{
  "schemaVersion": 1,
  "mainSha": "...",
  "measurementClass": "MEASURED_PHYSICAL_IPHONE",
  "device": {
    "model": "...",
    "ios": "...",
    "userAgent": "...",
    "lowPowerMode": false,
    "charging": false,
    "thermal": "cool"
  },
  "scenario": {
    "id": "...",
    "version": 1,
    "week": 1
  },
  "startupMs": [],
  "weekAdvanceMs": [],
  "saveMs": [],
  "loadMs": [],
  "save": {
    "bytes": 0,
    "originalBytes": 0,
    "mode": "..."
  },
  "resume": {
    "passed": true,
    "forcedReload": false,
    "stateLoss": false
  },
  "invariants": {
    "passed": true
  }
}
```

The implementation may add fields, but must not silently remove the core evidence.

---

## 13. Gate C completion

Gate C may be marked complete only when:

1. the measurement method is approved
2. the physical-iPhone measurements are actually executed
3. raw evidence is retained
4. the device/build metadata is retained
5. save/load and determinism checks pass
6. results are reviewed against the Economic Engine roadmap
7. the owner accepts the baseline as the reference point for future regressions

Until then:

`Implementation baseline: NO`

remains unchanged.
