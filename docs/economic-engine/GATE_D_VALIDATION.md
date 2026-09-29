# Gate D Validation — Economic Engine Roadmap v2

**Status: IN PROGRESS / NOT YET APPROVED**  
**Gate C: COMPLETE / OWNER ACCEPTED**  
**Validation baseline: `9b8bdc70eecca6e4caa059a3f44863b197b2b8b7`**  
**Tracker: #804**

## 1. Purpose

Gate D validates the Economic Engine roadmap against the actual repository before source-of-truth implementation begins.

Required outputs:

1. latest-main validation
2. document conflict resolution
3. Phase 0 contracts
4. dependency graph
5. independent Codex review against the exact v2/contracts
6. owner approval

## 2. Repository state reviewed

At the baseline:

- Gate C physical-iPhone issue #787 is closed/completed after owner acceptance.
- `SAVE_KEY=capitalism_tycoon_web_v1` and `saveVersion=9` remain repository invariants.
- deterministic production RNG remediation from #731 is part of the baseline.
- weekly production execution has an outer transaction/commit boundary.
- `finance.js` currently rounds finance values to 0.01 and validates the balance sheet with a legacy tolerance of ¥2.
- ownership remains fragmented across founder shares/ratios, listed holdings, subsidiaries, startups, PE and other subsystem state.
- existing capital-allocation, M&A, PE, VC and real-estate features remain production systems and must be migrated by Strangler adapters rather than deleted wholesale.

These facts support, rather than invalidate, the roadmap's One Economic Reality + staged cutover approach.

## 3. Document consistency findings

### 3.1 Control Ladder

`docs/CAPITAL_ALLOCATION_VISION.md` is aligned with the owner decision:

- 1%
- 3%
- 1/3
- 1/2
- 2/3
- 90%

It explicitly states that 5% and 20% are disclosure/accounting markers, not Control Ladder stages.

Occurrences of 5% elsewhere that refer to trade-size caps, disclosure, PE economics, probabilities or other domain mechanics are not Control Ladder conflicts.

### 3.2 Capital Allocation Vision vs Economic Engine Roadmap

`CAPITAL_ALLOCATION_VISION.md` identifies itself as long-term design and explicitly notes that Entity Registry / Ownership / Control Ladder infrastructure is not yet implemented.

Resolution:

- Economic Engine migration sequencing and accounting authority follow `ECONOMIC_ENGINE_ROADMAP.md` + the approved Phase 0 contracts/dependency graph.
- Capital Allocation Vision remains product/UX and long-term system input.
- its current-state audit observations do not override later repaired main.

### 3.3 Retired development roadmap

`CLAUDE.md` explicitly marks `docs/DEVELOPMENT_ROADMAP.md` as retired saveVersion-8-era planning.

Resolution: it is historical context only and cannot override Economic Engine v2.

### 3.4 Domain design docs

PE, Microcap, finance, founding-route and other subsystem documents remain authoritative only for their domain-specific behavior where they do not conflict with:

1. owner decisions
2. latest main
3. repository invariants
4. approved Economic Engine contracts

Example: a 5% stock order-size cap is a liquidity rule, not a control threshold.

### 3.5 Founder own-company stake

The current implementation/audit material notes that founder own-company shares are not consistently included in personal net worth.

Resolution: this is an implementation gap. It does not override the explicit owner decision that founder own-company equity counts in personal net worth exactly once.

## 4. Architecture validation findings

### 4.1 Existing finance is a migration asset, not the final kernel

`js/finance.js` already provides:

- categorized financial events;
- operation/transaction IDs;
- snapshots/statements;
- bounded transaction behavior;
- validation.

It is therefore a useful adapter/projection foundation.

It is **not** yet the Phase 1 cross-entity balanced transaction kernel because many material transfers are represented by direct state mutations plus finance events and because entity identity is not unified.

### 4.2 Existing atomic week boundary is compatible

The repaired production week transaction boundary provides rollback/commit safety.

Gate D conclusion: reuse the mechanism where appropriate, but do not confuse atomic JavaScript state rollback with the EconomicTransaction semantic ledger.

### 4.3 Fragmented ownership validates Phase 3

Current state contains multiple ownership representations across:

- founder shares/ratios;
- listed holdings;
- subsidiaries;
- startup/venture ownership;
- M&A targets/subsidiaries;
- PE deals/funds.

Gate D conclusion: the roadmap's read-model → shadow → cutover ownership migration is required. A single big-bang state rewrite would be higher risk.

### 4.4 Existing deep operating systems remain

Store/market/supply/workforce and other detailed systems already contain production gameplay depth.

Gate D conclusion: Phase 5 must adapt detailed systems into the shared industry layer without double-counting revenue, demand, capacity or cost.

## 5. Save-authority remediation #799 — RESOLVED

PR #799 was merged as main `9b8bdc70eecca6e4caa059a3f44863b197b2b8b7`.

The final Gate D main review includes its save-authority behavior:

- each persisted save copy carries optional transport metadata `saveSequence`;
- IndexedDB and localStorage are compared and the newer copy is selected;
- legacy saves fall back to lastSaveDate then week;
- a full tie keeps IndexedDB;
- the selected copy is reconciled back to the other store;
- `saveSequence` is stripped from loaded/live simulation state;
- `SAVE_KEY` and `saveVersion=9` remain unchanged.

Gate D conclusion: this resolves the earlier stable-main blocker. Storage transport metadata must not become Economic Core state or enter deterministic economic state hashes.

## 6. Gate E remains separate

Issue #745 has individual remediation completion records and checked items, but the owner-required final comment states that those are **not** the required Gate E attestation.

Gate E still requires:

> an explicit full-remediation completion record generated by Claude Code after Gate D and against the repaired latest main.

ChatGPT must not substitute its own conclusion.

## 7. Proposed Phase 0 decisions

The companion `PHASE_0_CONTRACTS.md` proposes final Gate D decisions for:

- entity taxonomy and external counterparties;
- economic glossary;
- EconomicTransaction fields and atomicity;
- JPY/¥0.01 migration precision;
- rounding/residual rules;
- accounting tolerance transition;
- accrual vs cash settlement;
- exact tick order and one-period lag;
- invariant IDs;
- Control Ladder gameplay rights;
- founder own-company anti-double-counting;
- 13-week Deployable Capital;
- bounded 5,000-entry live transaction baseline;
- save-size regression budget;
- deterministic hash contract;
- versioned headless scenario schema;
- Strangler migration authority.

The companion `ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md` defines phase dependencies and cutover authority.

## 8. Gate D completion checklist

- [x] Gate C owner acceptance recorded
- [x] final latest-main architecture reviewed at `9b8bdc70...`
- [x] current document hierarchy/conflicts identified
- [x] Phase 0 contract candidate written
- [x] Economic Engine dependency graph candidate written
- [x] #799 resolved and final main revalidated
- [ ] independent Codex review against exact roadmap + contracts
- [ ] review findings resolved
- [ ] owner approves Phase 0 contracts
- [ ] owner approves dependency graph
- [ ] owner approves Gate D completion

Until all unchecked items are complete:

- Gate D remains open;
- `Implementation baseline: NO` remains unchanged;
- Phase 1 must not begin.

## 9. Next sequence

1. run independent Codex review against:
   - `ECONOMIC_ENGINE_ROADMAP.md`
   - `PHASE_0_CONTRACTS.md`
   - `ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md`
   - latest relevant production implementation;
2. resolve review findings;
3. obtain owner Gate D approval;
4. request Claude Code final #745 remediation attestation (Gate E);
5. implement/accept Phase 0.5;
6. only after remaining gates, consider Gate F / Phase 1.
