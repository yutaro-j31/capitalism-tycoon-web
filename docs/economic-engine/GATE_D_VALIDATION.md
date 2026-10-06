# Gate D Validation — Economic Engine Roadmap v2

**Status: COMPLETE / OWNER APPROVED**  
**Gate C: COMPLETE / OWNER ACCEPTED**  
**Gate D independent review baseline: `23a4858fa0fb8c28e1c17abfe7f342cb108b6e6a`**  
**Gate D owner-approval baseline: `d2ccba060c18e117afa4ab3c2eee095f81aad311`**  
**Tracker: #804**  
**Later gates: Gate E COMPLETE; Phase 0.5 ACCEPTED; Gate F OWNER APPROVED 2026-10-06**  
**Gate F approval baseline: `1d88be9518ad21ad1e8ec3b88335020bed7d3797`**  
**Implementation baseline: YES — Phase 1 authorized**

## 1. Purpose

Gate D validates the Economic Engine specification against the real repository before any Economic Core source-of-truth migration begins.

Gate D requires:

1. latest-main validation
2. document conflict/supersession resolution
3. coherent Phase 0 contracts
4. coherent dependency graph
5. independent review
6. remediation of review findings
7. final verification against the exact merged documents and fresh repository state
8. owner approval

Gate D approval alone did **not** authorize Phase 1. Phase 1 was subsequently authorized only after Gate E, Phase 0.5, and Gate F owner approval were completed.

## 2. Current repository state

Repository state at this bookkeeping update:

- current main: `f97fe2b041421a81637fea6c333f4e79186ac85b`
- Gate D final independent review baseline: `23a4858fa0fb8c28e1c17abfe7f342cb108b6e6a`
- #808: merged as `7fbfae1eca229ba35fb080fc4607dd7fa2894807`
- #820: merged as `192748568d53186d1db15646cd76f3ea6cfb2dbb`
- #823: merged as `62a9b15be50918bced82e4072d03fc306c0b51da`
- #809: merged as `23a4858fa0fb8c28e1c17abfe7f342cb108b6e6a`
- #824 / #816 world-ranking fix: merged as `f97fe2b041421a81637fea6c333f4e79186ac85b`
- #819: closed as superseded by #820
- #804: open
- #745: open
- open PRs at the bookkeeping point: #827 only

The final Independent Codex review intentionally remains fixed to `23a4858...`. The one commit between that reviewed SHA and current main is #824, whose diff is limited to global-company-ranking code/tests and does not modify the Economic Engine contracts or Gate D documents. Therefore the later unrelated gameplay change does not invalidate the fixed Gate D review baseline.

Repository invariants remain:

- `SAVE_KEY=capitalism_tycoon_web_v1`
- `saveVersion=9`
- deterministic production simulation
- company/personal/fund/entity cash separation
- iPhone Safari priority

## 3. Relevant production changes since the second Codex review

### 3.1 #808 — legacy-save finance reconciliation

#808 repaired legacy saves written before #796–#798 where historical cash movement could exist without matching finance-ledger rows.

Gate D implication:

- legacy finance adapter behavior now includes an explicit reconciliation/normalization path for affected old saves;
- this does not authorize a new Economic Core writer;
- save key/version remain unchanged;
- Phase 0/1 contracts must continue to distinguish compatibility repair from future operation-ledger authority.

The previous Gate D blocker “wait for #808 disposition” is resolved because #808 is merged.

### 3.2 #820 — simulation RNG becomes the new-game macro seed root

#820 corrected two deterministic-randomness defects:

1. keyed weekly macro draws were insufficiently de-correlated;
2. new-game economic-foundation seed had been derived from company identity rather than the persisted simulation RNG seed.

Current new-game rule:

```text
economicFoundation.seed ← state.simulationRng.seed
```

A saved legacy economic-foundation seed remains preserved for backward compatibility.

This matters to Phase 0.5 because a nominal multi-seed experiment can be invalid if changing “test seed” does not actually change the persisted simulation seed/root used by the subsystem under study.

### 3.3 #823 — Phase 0.5 seed-provenance regression gate

#823 added:

- `docs/economic-engine/PHASE_0_5_SEED_VALIDATION.md`
- `tests/phase0-5-seed-provenance-test.js`
- registration in `tests/run-all.js`

The executable regression currently proves:

1. requested new-game scenario seed becomes persisted `simulationRng.seed`;
2. new-game `economicFoundation.seed` derives from that persisted seed;
3. multiple seeds with fixed identity produce distinct macro paths;
4. fixed seed with different company/ticker/player labels produces the same macro path;
5. keyed economic-foundation draws do not consume the main simulation RNG stream;
6. exact replay holds for the same explicit seed.

The Phase 0.5 roadmap/contracts now incorporate these rules as permanent harness requirements.

## 4. Production accounting facts retained by Gate D

Current legacy `finance.validate()` uses multiple compatibility tolerances:

| Check | Current tolerance |
|---|---:|
| BS difference | ¥2 |
| BS cash vs companyCash | ¥0.1 |
| CF identity | ¥10 |
| CF ending cash vs companyCash | ¥0.5 |
| weekly cash difference / weekly roll-forward | ¥10 |
| archived cash roll-forward | ¥10 |
| debt / retained earnings | ¥0.1 |

These are legacy-adapter compatibility values, not Economic Core posting tolerances.

Current `finance.js` still uses bounded legacy-history compaction. The legacy threshold is not an Economic Core retention budget; Phase 0.5 must measure operation/posting/idempotency retention separately.

## 5. Historical-document supersession

For Economic Engine implementation, Gate D docs override conflicting historical assumptions in `docs/CAPITAL_ALLOCATION_VISION.md`, including:

- old Allocation → Valuation order
- old weekly phase order
- historical integer-yen / zero-BS-difference target
- old P1/P2 numbering
- historical save/performance thresholds or assumptions

## 6. Independent review history

### First Independent Codex Review

Reviewed main `9adcbfe3...`.

Verdict: **BLOCK**

Major findings included:

- GD-001: single-transfer transaction contract insufficient
- GD-002: Allocation/Valuation dependency cycle
- entity-role ambiguity
- tolerance/precision/retention ambiguities
- timing/ownership/treasury/banking contract gaps

PR #807 remediated those findings and merged as `694bc395...`.

### Second Independent Codex Review

Reviewed exact merged main `694bc395...`.

Verdict: **PASS WITH CHANGES**

Remaining accepted findings:

| ID | Severity | Resolution carried by #809 |
|---|---|---|
| GD2-001 | P1 | signed quantity movement, property/debt/security identity, reversal/correction fields, per-currency balance, minimum family schemas, no-hidden-authoritative-mutation rule |
| GD2-002 | P1 | Phase 0 fixes Control Ladder framework; exact command/UI entitlements become a Phase 3 entry contract |
| GD2-003 | P2 | explicit Phase 6 Cost of Equity → WACC → EV/Equity Value pure DAG |
| GD2-004 | P2 | validation record refresh |
| GD2-005 | P3 | explicit historical save/performance supersession |
| GD2-006 | P3 | roadmap/reference/terminology cleanup |

No new P0 finding was reported.

### Final Focused Independent Codex Closure Review

Reviewed exact post-#809 SHA:

`23a4858fa0fb8c28e1c17abfe7f342cb108b6e6a`

Verdict: **PASS**

Closure result:

- GD2-001: CLOSED
- GD2-002: CLOSED
- GD2-003: CLOSED
- GD2-004: CLOSED
- GD2-005: CLOSED
- GD2-006: CLOSED
- new P0 blockers: none
- new P1 blockers: none
- Phase 0 contracts: internally coherent
- dependency graph: internally coherent
- Gate D architecture: ready for owner approval
- Phase 1 authorization: **NO**

The reviewer checked out the exact SHA in detached-HEAD mode and ran focused local regression checks covering seed provenance, legacy-ledger reconciliation, save boot/migration, finance/accounting invariants, simulation determinism, deterministic economic foundation and transaction regressions; all passed. The reviewer could not independently query live GitHub CI because the review environment had no `origin` remote and HTTPS access was blocked by proxy 403. Separately, the exact SHA's GitHub workflows were verified green before the review: Test, Strategy Balance, Pages Deployment Smoke, pages build/deployment and Release Attestation Sync.

The remaining `GATE_D_VALIDATION.md` drift identified by the reviewer is bookkeeping-only: #809 merge state and final-review completion could not be reflected inside #809 before it merged. This update resolves that status drift without changing the reviewed architecture.

## 7. Final second-review remediation contract

### 7.1 Economic Operation/posting

The corrected contract requires:

- `EconomicOperation` as the atomic/idempotent unit;
- explicit reversal/correction linkage;
- debit/credit monetary postings;
- signed quantity changes;
- debt/security/property/asset stable identity;
- per-currency monetary balance;
- security/debt/property/fund position conservation;
- minimum semantic schemas for material operation families;
- after cutover, authoritative mutations caused by an operation must be derivable from validated postings;
- hidden direct mutation is forbidden for cut-over facts.

### 7.2 Control Ladder boundary

Fixed thresholds:

- 1%
- 3%
- 1/3
- 1/2
- 2/3
- 90%

5% remains disclosure-only; 20% remains accounting/equity-method-only.

Phase 0 fixes the threshold and denominator/share-class/control framework.

Exact command/UI entitlements are a **Phase 3 entry contract** and must be approved before Phase 3 control capability becomes executable.

### 7.3 Phase 6 valuation DAG

```text
completed accounting / ownership / debt / industry / market observations
→ Cost of Equity
→ after-tax Cost of Debt + capital structure
→ WACC
→ enterprise / asset valuation
→ net debt / senior-claim bridge
→ Equity Value
→ immutable base valuation snapshot
```

The DAG is pure/read-only and does not reintroduce a same-period allocation/valuation fixed point.

### 7.4 Phase 0.5 stochastic validation

For a new-game stochastic scenario:

```text
requestedScenarioSeed
→ persisted state.simulationRng.seed
→ documented subsystem root/substream
→ actual stochastic path
```

must be auditable.

Before aggregate statistics are accepted, the harness must prove:

- seed provenance;
- intended persisted-seed diversity;
- stochastic-path diversity;
- exact replay for fixed persisted state;
- nuisance-input invariance for identity/label fields that should not control randomness;
- legacy persisted-subsystem-seed compatibility is measured separately from new-game calibration.

The normative detail is `PHASE_0_5_SEED_VALIDATION.md`.

## 8. Gate E remains separate

Issue #745 still requires the owner-mandated **Claude Code full-remediation completion attestation after Gate D owner approval**.

Codex reviews, ChatGPT cross-checks, runtime remediation PRs and merged Gate D docs do not substitute for that attestation.

## 9. Gate D completion checklist

- [x] Gate C owner acceptance recorded
- [x] initial Phase 0 contracts/dependency graph
- [x] #799 save boot remediation included
- [x] first Independent Codex review
- [x] first-review remediation merged via #807
- [x] second Independent Codex review against merged #807
- [x] GD2-001..006 remediation authored in #809
- [x] #808 legacy-save finance remediation merged
- [x] #820 RNG/macro seed-root correction merged
- [x] #823 Phase 0.5 seed-provenance regression merged
- [x] #809 docs synchronized conceptually with #808/#820/#823 latest-main behavior
- [x] #809 updated branch included latest-main ancestry and CI was green
- [x] #809 merged as `23a4858fa0fb8c28e1c17abfe7f342cb108b6e6a`
- [x] final focused Independent Codex closure review completed against exact `23a4858fa0fb8c28e1c17abfe7f342cb108b6e6a` — PASS
- [x] owner approves Phase 0 contracts
- [x] owner approves dependency graph
- [x] owner approves Gate D completion

Gate D is complete and owner approved.

This completion does **not** authorize Phase 1:

- `Implementation baseline: NO` remains unchanged;
- Gate E / #745 remains required;
- the full Phase 0.5 Permanent Headless Harness must be completed and accepted;
- Gate F and all remaining Phase 1 entry gates must be satisfied;
- Phase 1 must not begin before those gates are complete.

## 10. Next sequence

1. request Claude Code final #745 full-remediation completion attestation (Gate E);
2. resolve any attestation gap found by Claude Code;
3. complete and accept the full Phase 0.5 Permanent Headless Harness;
4. satisfy Gate F and all remaining Phase 1 entry gates;
5. only then create a fresh Phase 1 implementation branch from the latest stable main.
