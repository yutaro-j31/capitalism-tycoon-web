# Gate D Validation — Economic Engine Roadmap v2

**Status: IN PROGRESS / SECOND INDEPENDENT REVIEW REMEDIATION IN PROGRESS**  
**Gate C: COMPLETE / OWNER ACCEPTED**  
**Current reviewed main: `694bc395df968e9e96fa5c3cc162f81acf797f27` (#807 merged)**  
**Tracker: #804**  
**Implementation baseline: NO**

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

Gate D approval still does **not** authorize Phase 1.

## 2. Live repository state after #807

ChatGPT live GitHub verification after the second Codex review confirmed:

- main: `694bc395df968e9e96fa5c3cc162f81acf797f27`
- #807: merged/closed as that SHA
- #805: ancestor
- #799: ancestor
- #804: open
- #745: open
- main Test: success
- main Strategy Balance: success
- main Pages Deployment Smoke: success
- pages build/deployment: success
- Release Attestation Sync: success

Repository invariants remain:

- `SAVE_KEY=capitalism_tycoon_web_v1`
- `saveVersion=9`
- deterministic production simulation
- company/personal/fund/entity cash separation
- iPhone Safari priority

### 2.1 Open PR #808

At this verification point, PR #808 is open:

`fix(finance): reconcile the ledger gap in saves written before #796-#798`

Its current Test and Strategy Balance runs are green.

#808 changes legacy-save finance reconciliation/normalization behavior, including opening-cash restatement and prior-period adjustment for saves that contain historical cash movements without ledger rows.

It does **not** change the Economic Engine docs, SAVE_KEY or saveVersion, but it is directly relevant to the legacy finance adapter behavior described by Gate D.

Therefore:

- Gate D documentation remediation may proceed in parallel;
- **final latest-main Gate D validation/owner approval must wait until #808 is either merged or intentionally closed/declined**, followed by a fresh main recheck.

This is an operational validation dependency, not a new Economic Engine architecture defect.

## 3. Production facts retained by Gate D

### 3.1 Finance/accounting

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

### 3.2 Legacy retention

Current `finance.js` compacts legacy finance rows above 5,000 while preserving selected financial aggregates.

This does not establish an Economic Core operation/posting retention budget or permanent idempotency index.

Therefore 5,000 remains a provisional Phase 0.5 measurement input.

### 3.3 Ownership

Current ownership remains fragmented across founder shares/ratios, generic stock holdings, subsidiaries, startups/VC, M&A, PE and competitor state.

The Phase 3 canonical ownership/security registry remains necessary.

### 3.4 Save authority

Merged #799 keeps `saveSequence` as storage transport metadata and removes it from loaded/live simulation state.

`saveSequence` therefore remains excluded from the semantic Economic state hash.

## 4. Historical-document supersession

For Economic Engine implementation, Gate D docs override conflicting historical design assumptions in `docs/CAPITAL_ALLOCATION_VISION.md`, including:

- old Allocation → Valuation order
- old weekly phase order
- historical integer-yen / zero-BS-difference target
- old P1/P2 numbering
- historical save/performance thresholds or assumptions

The vision document now carries this supersession note directly.

## 5. First Independent Codex Review

The first independent review returned **BLOCK** and findings GD-001..GD-016.

PR #807 remediated the accepted findings, including:

- operation + multi-leg posting architecture
- legal entity kind vs roles/statuses
- Base Valuation before Allocation
- action-family timing
- correct legacy tolerance table
- Number exact-quantum envelope
- provisional retention/save markers
- read-only adapters before later cutovers
- security/beneficial ownership identity
- 13-week base plus longer/stress liquidity views
- Treasury/Consolidation split
- Banking entry contract
- Phase 0.5 strengthening
- historical supersession

## 6. Second Independent Codex Review

The second independent review examined exact merged main `694bc395...` and returned:

**Overall verdict: PASS WITH CHANGES**

### 6.1 First-review closure result

- GD-002: CLOSED
- GD-003: invalidated as an environment limitation, not architecture
- GD-004 through GD-014: CLOSED
- GD-001: PARTIALLY CLOSED
- GD-015: PARTIALLY CLOSED
- GD-016: PARTIALLY CLOSED

The second review also stated that all first-review **P1** findings GD-004..GD-010 were closed.

### 6.2 New second-review findings

| ID | Severity | Accepted resolution |
|---|---|---|
| GD2-001 | P1 | Define quantity direction/property identity, explicit reversal fields, per-currency balance rules, minimum family posting schemas and a no-hidden-authoritative-mutation rule after cutover. |
| GD2-002 | P1 | Resolve Control Ladder completion-timing conflict: Phase 0 fixes thresholds/framework; exact command/UI entitlements are a Phase 3 entry contract. |
| GD2-003 | P2 | Add explicit Phase 6 pure DAG: observations → Cost of Equity → after-tax debt/capital structure → WACC → EV → Equity Value → immutable snapshot. |
| GD2-004 | P2 | Refresh this validation record to #807 merged / second review state. |
| GD2-005 | P3 | Add old save/performance assumptions directly to the Capital Allocation Vision supersession note. |
| GD2-006 | P3 | Fix broken roadmap section reference and stale operation terminology/editorial duplication. |

No new P0 finding was reported.

## 7. Second-review remediation decisions

### 7.1 Operation/posting closure

The corrected Phase 0 contract now requires:

- explicit `reversalOfOperationId` / `correctionOfOperationId`
- debit/credit monetary side
- signed `quantityDelta`
- debt/security/property/asset identity
- per-currency monetary balance
- security/debt/property/fund position conservation
- family-level minimum semantic posting schemas
- post-cutover authoritative settlement through validated postings
- no hidden direct mutation of cash/accounts/debt/security/property/fund capital for a cut-over slice

This is intended to close the remaining substance of GD-001/GD2-001.

### 7.2 Control Ladder completion boundary

Fixed owner thresholds remain:

- 1%
- 3%
- 1/3
- 1/2
- 2/3
- 90%

Phase 0 fixes the threshold and denominator/share-class/control framework.

The exact command/UI entitlement matrix is a **Phase 3 entry contract**, and Phase 3 control capabilities cannot become executable before that matrix is approved.

5% and 20% remain non-Control-Ladder disclosure/accounting markers.

### 7.3 Phase 6 valuation DAG

Phase 6 now explicitly computes:

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

This clarifies the remaining intra-phase ordering without reintroducing a cross-phase cycle.

## 8. Gate E remains separate

Issue #745 still requires the owner-mandated **Claude Code full-remediation completion attestation after Gate D**.

Neither Codex review, ChatGPT's cross-check, merged docs PRs nor individual #745 checkmarks satisfy Gate E.

## 9. Gate D completion checklist

- [x] Gate C owner acceptance recorded
- [x] initial latest-main architecture validation
- [x] initial Phase 0 contracts/dependency graph
- [x] #799 included
- [x] first independent Codex review completed
- [x] first-review findings remediated by #807
- [x] #807 merged to main
- [x] second independent Codex review completed against merged #807 main
- [x] second-review findings GD2-001..006 accepted and remediated in the current docs branch
- [ ] second-review remediation PR merged
- [ ] #808 resolved or intentionally deferred/closed
- [ ] fresh latest-main Gate D validation after #808 resolution
- [ ] final focused Codex closure check against the exact merged final documents
- [ ] owner approves Phase 0 contracts
- [ ] owner approves dependency graph
- [ ] owner approves Gate D completion

Until all remaining items are complete:

- Gate D remains open;
- `Implementation baseline: NO` remains unchanged;
- Phase 1 must not begin.

## 10. Next sequence

1. merge the second-review remediation docs PR only after CI/review is green;
2. resolve #808 separately through its normal runtime review/merge decision;
3. revalidate Gate D against the resulting latest main;
4. run one final focused Codex closure check;
5. obtain owner Gate D approval;
6. request Claude Code final #745 remediation attestation (Gate E);
7. implement and accept Phase 0.5;
8. satisfy Gate F and the remaining hard entry gates before Phase 1.
