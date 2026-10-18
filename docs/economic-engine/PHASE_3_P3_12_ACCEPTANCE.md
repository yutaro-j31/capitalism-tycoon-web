# P3-12 — Permanent Acceptance and Phase 3 Exit Gate

**DESIGN PROPOSAL — implementation and merge require Owner approval.**

Audited production main: `743d08d1867f453fe09c61e1fd5312c846cfc1eb` (2026-10-15 JST). CODE facts below describe that SHA; proposed APIs/fields are explicitly new, not existing production interfaces. No production implementation, registry adoption, schema change, cutover, Phase 3 Exit or Phase 4 Entry is authorized by this document.

Repository precedence follows the approved Roadmap. Current source establishes observed production facts; approved target contracts establish required future behavior. Discrepancies must be logged, never silently adopted as new policy. Required references: Owner instruction and approved [Entry](PHASE_3_ENTRY_CONTRACT.md), [P3-1](PHASE_3_P3_1_CONTRACT.md), [P3-2](PHASE_3_P3_2_CONTRACT.md), [P3-3](PHASE_3_P3_3_CONTRACT.md), [Roadmap](ECONOMIC_ENGINE_ROADMAP.md) and [dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md). Shared proposed types, identity rules and reason codes are specified in `PHASE_3_CROSS_SLICE_ARCHITECTURE.md` (companion cross-slice PR; dependency must merge first).

## Current F/S/Q gate alignment (2026-10-16)

This proposal incorporates the merged [Implementation-First Roadmap v2](ECONOMIC_ENGINE_IMPLEMENTATION_FIRST_ROADMAP.md) and [Phase 3/4 gate alignment](PHASE_3_4_IMPLEMENTATION_FIRST_GATE_ALIGNMENT.md). Verified checkpoint on 2026-10-18 19:02 UTC: main `d6d010f16aa6a66335d2619216e8080f3e8e7037`. The earlier `26a22a97` and CODE/TEST baseline below are historical, not current completion claims. Shared contract #995, design contracts #997–#1002 and partial read-only implementation #1019–#1024 are merged; pending #1025/#1026/#1028/#1030/#1031 are not main. P3-4 remains stopped, #1027/#1029 and known debt P1 remain open, and the new main's post-merge CI is still pending at this checkpoint. These partial deliveries do not satisfy P3-12 or authorize Phase 4 Entry. The current Owner merge grant remains conditional on the individual PR's existing safety/review/CI/dependency gates; it is not automatic Exit or risk acceptance.

Record distinct results: `S_PASS` for focused safety of an implemented slice; Owner-accepted `PHASE_3_F_EXIT` only after every mandatory P3-4–P3-11 capability and relevant S/permanent/cutover/CI evidence exists; `Q_ACCEPTED` only after the later integrated quality campaign. Expanded whole-system A–L audits, broad untouched-writer campaigns, mass seed/century runs, 100/1000-company scale expansion and comprehensive calibration are Stage Q backlog. Targeted independent adopted-writer diff review, complete writer-family closure, conservation/accounting, save-failure/rollback, old-v9/real-IDB hydration, deterministic replay, relevant WebKit and all existing required CI/Permanent Gates remain Stage F obligations. No required test is deleted, disabled, skipped or relabeled by this proposal. P3-4 blocked means F Exit remains blocked; no mandatory scope is silently deferred.

## 1. Goal / Scope

Design an evidence-based permanent gate. Phase3 Exit remains NOT PASS: P3-4..11 are not all implemented/accepted, required scoped safety/adoption evidence is absent and economic decisions remain. Test existence, docs CI and historical green checks cannot clear this gate.

## 2. Current Production State

CODE: existing Test runs canonical A–L, aggregate test and Phase0.5 smoke on PR/push. Headless harness has deterministic seeds, semantic versions1/2, persistence/replay/fault/ID characterization and extended tiers. Main743d08d1 has actual WebKit jobs for D3/D4 and other financial writers, but no P3-5..11 implementation/tests. Track A historically lists incomplete writer/fault/WebKit coverage; its old D3/D4/path-filter statements must be refreshed, not repeated as current defects.

## 3. Existing Source-of-truth

Existing gates/tests remain authoritative evidence within their documented scope. A–L canonical test shards are NOT an independent A–L architecture audit; both must be recorded separately. Existing Phase0.5 invariant names/ECO mappings require semantic coverage audit: a named invariant is not proof all new families are included.

## 4. Dependencies

Requires P3-4 writer adoption, P3-5..8 adapters, P3-9 exact eligibility, approved P3-10 integration scope and P3-11 anti-double-count projection, latest-main CI, fulfilled Owner decisions and independent review. P3-12 test/CI planning can start now; formal execution/Exit verdict follows actual implementation.

## 5. Entity / Ownership Data Model

Proposed acceptance record contains baselineMainSHA, candidateHeadSHA, testedTreeSHA, test command/runtime/exit, event/run/job/artifact IDs, semantic hash version, requested→persisted seed proof, independent-review provenance, unresolved findings and gate verdict. Evidence categories CODE/TEST/WEBKIT/REVIEW/DESIGN. Per-family writer matrix has live/shadow/base/weekly/import/replacement paths and replay/failure coverage, not only a method name.

## 6. API / Function Contracts

Proposed `evaluatePhase3Acceptance(evidence)` is a future fail-closed evidence evaluator, not current runtime API. PASS only if all required entries link to actual executed artifacts on matching candidate tree and applicable main integration evidence. Missing, pending, cancelled, failed, stale-head or merely planned evidence → NOT PASS. A verified equal runtime tree can support characterization reuse with explicit provenance; never relabel old CI as a new HEAD run. Snapshot evidence references immutable SHA; CI URLs identify run attempt and event.

## 7. Input / Output Examples

Existing test green + no P3-7 API = P3-7 missing, Exit NOT PASS. WebKit push-only workflow skipped on PR = no PR WebKit proof; fetch actual main/push job. Twelve green test shards do not establish a targeted independent cutover review; that review remains required for adopted writers. The expanded whole-system independent A–L campaign is separately marked pending Stage Q. Old save with unknown issuer → preservation/explicit unsupported can PASS its fail-closed fixture, not an executable ownership adoption fixture.

## 8. Invariants

Every activated family has one authority, share conservation and unique beneficial interest; account/cash/ledger separation; reader purity; exact thresholds; save9/key; operation replay; no new RNG; deterministic entity IDs; no invented unknown rights or repairs. A phase Gate cannot waive a concrete financial Writer fault to save time.

## 9. Unsupported / Unknown Cases

Unsupported share classes/legacy identities may remain documented fail-closed only if within Owner-approved scope; shrinking required P3-10 scope or declaring missing adapters unnecessary needs explicit Owner decision. Old damaged #979 saves must have an approved unsupported/preservation policy or separate repair; no silent “migration success”.

## 10. Save / Transaction / RNG Boundary

Pure adapter tests snapshot full state plus RNG before/after and spy zero persistence/notifications/ledger writes. Adopted writers use shared fault harness: returnfalse, throw, savefalse/savethrow before/after admission, nested outer rollback, pending predecessor, cache/mirror/durable flush and fresh hydration. Retry commits once; committed replay must not repeat quantity/cash/ledger. Fault at notify is classified pre/post commit per approved delivery policy, not blindly assumed economic rollback.

## 11. Legacy Compatibility

Keep effective saveVersion=9 and SAVE_KEY=capitalism_tycoon_web_v1; `save-v9.js` supplies the installed version despite engine.js's historical base constant. Add no saved root, adoption marker, normalization or repair. Missing optional collections may mean empty only where existing contract explicitly permits; present malformed data is invalid. Preserve original data and issue source paths. Array index may locate a diagnostic, never establish identity. Compaction/load/import cases with lost identity stay unresolved; do not recreate history.

## 12. Integration Points

Reuse existing canonical registration and harness; no parallel acceptance engine or alternate game model. Add family checks to existing permanent gate infrastructure only in separately approved implementation PR. Consumer integrations revalidate at boundary. Preserve all historical Permanent Gates; a new Phase3 pass cannot replace P0.5/P1/P2 checks.

## 13. UI Contract

Future acceptance report displays missing/failed evidence and scope, no generic green badge when rows unverified. Production player UI unchanged by acceptance design. Benchmark labels distinguish Node serialized-memory proxy, real browser metrics and physical-iPhone measurements.

## 14. Tests / CI / WebKit

Detailed Test Coverage / CI / WebKit matrix and exact existing filenames live in `PHASE_3_IMPLEMENTATION_DEPENDENCIES.md` companion PR. Minimum coverage:

| Invariant | Existing reusable evidence | Future missing assertion |
|---|---|---|
| ECO-010 | phase3-ownership-reconciliation-test.js | every supported new class; unknown treasury exclusion |
| ECO-011 | same + economic-read-model-test.js + pe-dual-ownership-test.js | PE/VC/subsidiary/IPO unified beneficial dedup |
| ECO-012 | existing entry policy, no full new projector | all18 boundary cases + unsupported evidence/direct actor |
| ECO-015 | simulation-determinism-contract-test.js; simulation-long-run-reload-fork-test.js | mixed adopted writers/adapters/commands on identical persisted seeds |
| ECO-016 /017 | phase3-ownership-projection-test.js and reconciliation tests | repeated all-family UI/report/preview with full state/RNG/save equality |
| ECO-021 | phase0-5 persistence/replay; deterministic ID tests | cross-family IDs/generations/aliases/rollback/collision fixtures |
| Accounting/separation | accounting-invariants-test.js; phase2-acceptance-gate-test.js; writer atomicity suites | every newly adopted call path and cash/no-cash invariant |
| Save9/hydration | save-compat-test.js; save-v9-migration-test.js; save-storage-commit-atomicity-test.js | nonzero adapter positions through all compaction profiles and ambiguous old generation |

Existing tests characterize legacy behavior; no row above certifies unimplemented adapters. Candidate new tests use slice-specific names; extend reusable existing tests where equivalent assertion already exists. CI minimum: Test A–L+aggregate, P0.5 smoke; full relevant main/push/strategy/real WebKit gates and permanent P1/P2 gates. Stage F retains existing required harness/permanent tiers, focused same-state replay and reload forks. Expanded nightly/deepAudit seed campaigns (explicit simulationRng seeds83951617..24) and new100/1000-company adapter-scale fixtures are scheduled for Stage Q unless needed to diagnose a concrete affected-path defect; do not invent AI entities as authority. Record requested/persisted seed diversity and stochastic-path diversity before combining outcomes. Do not use company name as seed.

## 15. Migration and Cutover Restrictions

No formal Exit in this design PR. No acceptance bypass, CI skip/weakening, schema upgrade or new authority. Physical Gate C historical acceptance does not constitute physical testing of new UI/scale work. Phase4 Entry is an explicit later Owner decision after Owner-accepted PHASE_3_F_EXIT and applicable S/cutover prerequisites, not after a fabricated Q completion.

## 16. Risks and Findings

R-P312-01: coverage by filename falsely treated as executed verification. Resolved by evidence ledger status. R-P312-02: test shards conflated with independent audit; resolved by separate audit evidence. R-P312-03: unknown scopes omitted from gate; required unsupported inventory and Owner-approved scope. Current overall verdict remains NOT PASS.

## 17. Acceptance Criteria

For PHASE_3_F_EXIT, every required implemented capability has relevant ECO/ownership/accounting/failure/determinism/save/WebKit assertions, actual runs and matching candidate evidence; applicable final-head CI succeeds, integration-main is checked, and targeted independent adopted-writer review is complete. A known corrupting P0/P1 cannot be waived for an enabled family or global dependency. Expanded cross-system A–L/scale/long-run campaigns remain explicitly pending Stage Q. Applicable S/cutover review must have zero unresolved findings, including P2. Expanded Q campaign work may remain explicitly pending, without being called reviewed/closed; any exception needs its exact explicit Owner decision. Owner authorizes Exit and Phase4 Entry separately.

## 18. Owner Decisions

No approval needed to complete this planning. Implementation needs its own approval. OD-06: scoped independent writer-review evidence and disposition of #976/#979/known debt dependencies before the relevant F Exit/Entry; external reviewer unavailability must be labeled and escalated only where the exact cutover contract requires it. Owner alone may approve any scope adjustment; do not infer acceptance from urgency.

## 19. Implementation Slices

1 permanent-test coverage extension PR near integration +1 acceptance/evidence docs PR after all implementations. Reuse suites first; only genuinely new contracts get new tests. Full gate runs once per final implementation HEAD; rerun unchanged green jobs only with a new reason, not ritual.

## 20. Definition of Done

A permanent functional/safety gate exists after authorized implementation; all mandatory capabilities and applicable candidate/main S/permanent/cutover/CI evidence are actual; Owner acceptance records PHASE_3_F_EXIT. Until then functional status is NOT PASS and Phase4 is NOT AUTHORIZED. The expanded independent whole-system A–L campaign is Stage Q and cannot be reported complete through F acceptance. Owner Phase4 Entry remains a separate decision.
