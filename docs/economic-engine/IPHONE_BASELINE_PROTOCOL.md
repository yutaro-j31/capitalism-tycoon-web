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

The probe must support at least the following two required scenarios.

### Scenario 1 — Clone of the current production save

Purpose:

- measure the user's actual current game complexity
- compare physical-iPhone behavior against the exact save the user is playing
- preserve live-state safety by benchmarking only a detached clone

Requirements:

- clone/migrate the current save into the benchmark engine
- never benchmark directly on the live authoritative engine
- record the source week, store count, raw save bytes, stored save bytes, and active save-storage mode
- prove the live save/state is unchanged after the run

### Scenario 2 — Growth comparison fixture: approximately week 117 / 40 stores

Purpose:

- provide a stable heavy-save comparison point
- compare the physical-iPhone result with the existing Node reference measurements

Required target characteristics:

- approximately **week 117**
- approximately **40 stores**
- fixture/save shape comparable to the existing Node benchmark
- record the exact actual week, store count, and save bytes used by the physical run

Existing Node reference values to preserve in the comparison report:

- 1-store case: **252 ms**
- ~40-store case: **1,193 ms**
- reported save size: **6.65 MB**

These Node values are comparison references only; they are not iPhone pass/fail thresholds.

The physical-iPhone fixture must record actual bytes rather than assuming the reported 6.65 MB maps to a particular MB/MiB convention.

### Optional Scenario 3 — Fresh/light production game

Purpose:

- startup floor
- low-complexity week-advance floor
- save/load floor

This scenario is optional for Gate C if Scenarios 1 and 2 are completed successfully.

### Scenario versioning

Every benchmark scenario must be versioned and should carry at least:

- `scenarioId`
- `scenarioVersion`
- `sourceWeek`
- `storeCount`
- `rawSaveBytes`
- `storedSaveBytes`
- `expectedInvariants`

---

## 6. Benchmark instrumentation requirements

Manual stopwatch measurements alone are not sufficient for sub-second engine timings.

A measurement-only instrument may be added before Gate C execution, provided it satisfies all of the following:

- no saveVersion change
- no gameplay balance change
- no Economic Engine feature implementation
- no production RNG consumption from benchmark-only work
- no mutation of the player's authoritative live state during detached benchmarks
- benchmark result can be copied/exported as JSON
- benchmark version is recorded
- exact main SHA/build identity is recorded
- benchmark fixture/schema is versioned
- raw samples are retained in the result, not only averages

### Production-equivalent save-path requirement

**Measured week-advance time must include the save work that production performs at the end of a normal committed week.**

This is mandatory because save/serialization/storage work is a material part of the current end-to-end CPU/runtime cost.

A measured week sample therefore includes, as applicable:

1. the normal production simulation/week pipeline
2. finance snapshot rebuild / sanitation performed by the production save path
3. production-equivalent compaction/profile selection
4. JSON serialization
5. the same storage-layer processing used by production
6. the isolated benchmark durable write
7. completion/flush of that isolated durable write when the production storage layer is asynchronous

The benchmark must not report a simulation-only week as the physical Gate C week-advance result.

### Isolated benchmark storage

The benchmark must exercise the real save-processing path against a **separate benchmark storage namespace/location**.

It must never use, overwrite, remove, hydrate from, or otherwise touch:

- production `SAVE_KEY = capitalism_tycoon_web_v1`
- the production save record
- production save slots
- the production IndexedDB save key/record

Preferred design:

- reuse the production serialization/compaction/storage logic through an injectable benchmark storage adapter
- use a benchmark-only IndexedDB database/object store and benchmark-only key/namespace
- if a localStorage mirror is required to reproduce the production path, use a benchmark-only key that is never equal to or derived as a slot of the production `SAVE_KEY`
- clean up benchmark-only records after the measurement session

The benchmark implementation should share production save logic rather than copy/paste a second save algorithm that can drift.

The instrument is infrastructure for Gate C, not an Economic Engine feature.

---

## 7. Detached week-advance benchmark safety contract

If a cloned engine/state is used for week-advance timing:

1. clone/migrate from a known state
2. ensure benchmark state is not the live authoritative engine
3. route benchmark persistence to the isolated benchmark storage adapter
4. suppress public UI events from the detached engine
5. do not alter the production localStorage/IndexedDB authoritative save
6. do not read/write/remove the production `SAVE_KEY` as part of the benchmark
7. do not consume the live simulation RNG stream
8. include the production-equivalent save/serialization/compaction/storage path in measured week time
9. await benchmark durable-write completion/flush before stopping the measured week timer
10. run invariant checks after benchmark advances
11. verify live-state deterministic hash/equivalent snapshot is unchanged before vs after benchmark
12. verify production save bytes/content are unchanged before vs after benchmark
13. discard detached state and clean benchmark-only storage after measurement

A benchmark that changes the player's real game or production save is invalid.

---

## 8. Sample protocol

For each required benchmark scenario:

### Startup

- 5 cold launches where practical
- 10 warm reloads

### Week advance — end-to-end production-equivalent

- 10 warmup detached advances
- 100 measured advances where device stability permits
- each measured advance includes production-equivalent save processing and isolated durable storage completion
- retain every raw sample
- calculate p50 / p95 / p99 / max
- record simulation-only and save/storage sub-timings separately when instrumentation can do so without changing the measured production-equivalent total

The primary comparison number is the **end-to-end week + save total**.

If 100 samples are impractical for a production-state test, use a smaller clearly labelled sample and do not claim a p99 from insufficient data.

### Save

- 20 measured isolated benchmark saves where safe
- use the production-equivalent save-processing path
- retain raw serialization / compaction / storage / flush sub-timings where available
- never write the production save

### Reload/load

- 10 measured benchmark load cycles where practical
- load from the isolated benchmark storage location
- do not hydrate the live engine from benchmark data

### Sustained run

- compare first 20 vs last 20 end-to-end week samples
- note thermal state and any browser reload/crash

### Node comparison report

For Scenario 2, the final baseline artifact must display side-by-side:

- Node reference: 1 store = 252 ms
- Node reference: ~40 stores = 1,193 ms
- Node reference reported save size = 6.65 MB
- Physical iPhone measured week p50/p95/p99/max
- Physical fixture exact week/store count/save bytes
- measurement-method differences, if any

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
