# Gate D Validation — Economic Engine Roadmap v2

**Status: IN PROGRESS / FIRST INDEPENDENT CODEX REVIEW REMEDIATED IN THIS BRANCH / SECOND REVIEW REQUIRED**  
**Gate C: COMPLETE / OWNER ACCEPTED**  
**Validation baseline: `9adcbfe3d2da60b60efb4663be478ac3fcc67732`**  
**Tracker: #804**  
**Implementation baseline: NO**

## 1. Purpose

Gate D validates the Economic Engine roadmap against the actual repository before source-of-truth implementation begins.

Required outputs:

1. latest-main validation
2. document conflict resolution
3. Phase 0 contracts
4. dependency graph
5. independent Codex review against the exact documents
6. resolution of review findings
7. second independent review of the corrected exact documents
8. owner approval

## 2. Repository state reviewed

Live GitHub verification against the baseline confirmed:

- main: `9adcbfe3d2da60b60efb4663be478ac3fcc67732`
- open PRs at the verification point: 0
- #804: open
- #745: open
- #805: merged as the baseline SHA
- #799: merged as `9b8bdc70eecca6e4caa059a3f44863b197b2b8b7` and contained in the baseline
- main `Test`: success
- main `Strategy Balance`: success
- main `Pages Deployment Smoke`: success
- pages build/deployment: success
- Release Attestation Sync: success

Repository invariants remain:

- `SAVE_KEY=capitalism_tycoon_web_v1`
- `saveVersion=9`
- deterministic production simulation
- company/personal/fund/entity cash separation
- iPhone Safari priority

The repaired production week boundary provides outer transaction/rollback safety, but that mechanism is not itself the future Economic Operation ledger.

## 3. Current production facts relevant to Gate D

### 3.1 Finance/accounting

`js/finance.js` already provides:

- categorized finance events
- transaction/operation IDs
- snapshots/statements
- bounded legacy transaction compaction
- finance validation
- debt/fixed-asset projections

It is a migration asset, not the final cross-entity kernel.

Current legacy validation tolerances are **not one universal ¥2 tolerance**:

| Check | Current tolerance |
|---|---:|
| BS difference | ¥2 |
| BS cash vs companyCash | ¥0.1 |
| CF identity | ¥10 |
| CF ending cash vs companyCash | ¥0.5 |
| weekly cash difference / weekly roll-forward | ¥10 |
| archived cash roll-forward | ¥10 |
| debt / retained earnings | ¥0.1 |

These values are adapter compatibility behavior only.

### 3.2 Transaction retention

Current `finance.js` compacts detailed legacy transactions above 5,000 rows while preserving aggregate financial totals.

It does **not** prove that 5,000 is the correct Economic Core operation/posting retention limit, and it does not provide a permanent historical idempotency-key index.

Therefore 5,000 is now a Phase 0.5 measurement input, not a normative Economic Core cap.

### 3.3 Ownership

Current ownership remains fragmented across:

- `founderShares` / founder ownership ratios
- personal/company stock holdings
- subsidiaries / listed subsidiaries
- startups / VC ownership
- M&A subsidiaries/targets
- PE fund/deal/portfolio representations
- competitor ownership

Current `personalNetWorth()` does not yet consistently include founder own-company equity. The owner rule remains a future migration requirement, not a description of current behavior.

### 3.4 Saves / #799

Merged #799 establishes:

- optional persisted `saveSequence` transport metadata
- newest-copy selection across IndexedDB/localStorage
- legacy fallback to lastSaveDate then week
- IDB tie preference
- reconciliation/write-back to the other store
- stripping `saveSequence` from loaded/live simulation state
- unchanged SAVE_KEY / saveVersion

Conclusion: `saveSequence` is transport metadata and is excluded from the semantic Economic state hash.

## 4. Document consistency / supersession

### 4.1 Control Ladder

The approved Control Ladder remains:

- 1%
- 3%
- 1/3
- 1/2
- 2/3
- 90%

5% is a disclosure marker and 20% is an accounting/equity-method marker. Neither is a Control Ladder stage.

### 4.2 Capital Allocation Vision

`docs/CAPITAL_ALLOCATION_VISION.md` remains product/UX/long-term design input.

For Economic Engine implementation, the following historical content is explicitly superseded by the Gate D documents:

- the old Allocation-before-Valuation phase ordering
- the old weekly phase ordering
- the historical “integer yen / zero BS difference” target
- old P1/P2 phase numbering and dependency ordering
- historical save/performance targets that are not Phase 0.5 measured budgets

A supersession note is added directly to that document in this remediation branch.

### 4.3 Retired roadmap

`docs/DEVELOPMENT_ROADMAP.md` remains historical saveVersion-8-era context and cannot override Economic Engine Gate D.

### 4.4 Domain documents

PE, Microcap, finance, founding-route and other domain docs remain useful only where they do not conflict with:

1. explicit owner decisions
2. latest main
3. AGENTS.md / CLAUDE.md
4. approved Economic Engine contracts

## 5. First Independent Codex Review

The first independent Codex review examined main `9adcbfe3...` locally and returned:

**Overall verdict: BLOCK**

Its environment could not query live GitHub, so it could not independently verify open PR/CI/#804/#745. ChatGPT subsequently verified those live facts against GitHub.

### 5.1 Resolved environment-only finding

**GD-003** — live repository state unavailable to Codex.

Resolution: live GitHub state was independently checked after the review. No hidden open PRs were present at that point; #804/#745 remained open; #799/#805 were merged; main workflows were green.

GD-003 is therefore not a remaining architecture blocker.

### 5.2 Accepted architecture findings and remediation

| ID | Severity | Resolution in corrected Gate D docs |
|---|---|---|
| GD-001 | P0 | Replace single from/to transaction row with atomic `EconomicOperation` + multi-leg postings; add account/instrument identity and family-required posting schemas. |
| GD-002 | P0 | Move pure/base shared valuation before allocation scoring: Phase 6 Base Valuation, Phase 7 Allocation; separate post-decision/public repricing. |
| GD-004 | P1 | Separate legal entity kind from orthogonal roles/statuses; add relationship identity and manager/GP semantics. |
| GD-005 | P1 | Record current legacy tolerance by invariant instead of calling all legacy finance “¥2”. |
| GD-006 | P1 | Add Number + ¥0.01 exact-quantum envelope and Phase 0.5 reachability gate. |
| GD-007 | P1 | Define period context first and action-family decision/commitment/recognition/due/settlement/effective timing. |
| GD-008 | P1 | Make journal/idempotency retention evidence-driven; 5,000 becomes provisional measurement input. |
| GD-009 | P1 | Phase 1 fund/subsidiary/later-phase scope is read-only reconciliation until explicit later cutover. |
| GD-010 | P1 | Add minimum security class/holding/beneficial owner/pledge identity and IPO/dedup rules. |
| GD-011 | P2 | 13 weeks remains base liquidity view; add 52-week/maturity-wall and stress views. |
| GD-012 | P2 | +15% save growth and 10 MB become provisional Phase 0.5 review/warning markers, not normative limits. |
| GD-013 | P2 | Split Phase 11 legal-entity Treasury settlement from Phase 12 consolidation-aware group liquidity optimization. |
| GD-014 | P2 | Add Banking-specific entry contract. |
| GD-015 | P2 | Add explicit section-level supersession for historical vision ordering/precision assumptions. |
| GD-016 | P3 | Keep thresholds fixed, but require command-level voting/economic denominator/right matrix before Phase 3 implementation. |

## 6. Corrected architecture decisions

### 6.1 Multi-leg Economic Operation

The atomic unit is now the **operation**, not a one-row transfer.

Required concepts include:

- operation ID / idempotency key
- deterministic posting sequence
- entity + account per posting
- debit/credit or one approved signed-delta convention
- currency where relevant
- instrument/security/property identity
- quantity where relevant
- counterparty/relationship/elimination identity
- recognition/due/settlement/effective periods
- explicit reversal/correction linkage

Debt, equity, dividend, buyback, M&A and fund settlement must each define required posting patterns before execution cutover.

### 6.2 Corrected phase order

The corrected central chain is:

```text
Phase 5 Industry
→ Phase 6 Base Valuation
→ Phase 7 Capital Allocation
→ Phase 8 AI
```

Allocation consumes an immutable base valuation snapshot. Post-decision/public repricing cannot feed back into the same decision.

### 6.3 Debt / WACC split

Phase 4 owns canonical debt instruments and Cost-of-Debt/financing inputs.

Full WACC becomes authoritative only after Phase 6 supplies the Cost-of-Equity / valuation inputs.

### 6.4 Treasury / consolidation split

Phase 11:
- legal-entity transfer settlement only

Phase 12:
- consolidation/eliminations/NCI/equity-method views
- then group liquidity optimization

### 6.5 M&A dependency by subtype

Private/cash M&A does not wait for unrelated public-stock cutover if its operation/ownership/debt/valuation prerequisites are authoritative.

Share-swap/public/hostile/security-dependent paths require the relevant Phase 9 capability.

### 6.6 Monetary representation

Number + ¥0.01 remains a **migration compatibility representation**, not an assertion of unlimited future exactness.

Phase 0.5 must test the reachable monetary envelope. If the intended scale can exceed cent-exact Number range, a dedicated representation migration decision is required before that scale becomes authoritative.

## 7. Phase 0.5 strengthened exit criteria

Before Phase 1, the permanent harness must support:

- production wrapper/phase-order characterization
- writer inventory
- versioned semantic hash projection registry
- semantic first-diff
- save/reload deterministic fork
- compacted-save/reload deterministic fork
- operation replay/idempotency
- rollback mutation tests
- deterministic ID collision tests
- adapter parity for cash/debt/ownership/standalone finance
- capability-aware explicit no-op phases
- Number monetary-envelope reachability
- raw/stored/peak-memory/runtime persistence metrics

## 8. Gate E remains separate

Issue #745 still requires the owner-mandated **Claude Code full-remediation completion attestation after Gate D**.

Individual checkmarks, merged remediation PRs, this Codex review, or ChatGPT's cross-check do not satisfy Gate E.

## 9. Gate D completion checklist

- [x] Gate C owner acceptance recorded
- [x] live repository state validated at `9adcbfe3...`
- [x] current document hierarchy/conflicts identified
- [x] initial Phase 0 contracts written
- [x] initial dependency graph written
- [x] #799 resolved and included
- [x] first independent Codex review completed
- [x] first-review findings triaged against live repository evidence
- [x] accepted GD-001–GD-016 corrections incorporated in this remediation branch
- [ ] corrective docs PR merged to main
- [ ] second independent Codex review against the **corrected merged exact documents**
- [ ] second-review blockers resolved, if any
- [ ] owner approves Phase 0 contracts
- [ ] owner approves dependency graph
- [ ] owner approves Gate D completion

Until every remaining item is complete:

- Gate D remains open;
- `Implementation baseline: NO` remains unchanged;
- Phase 1 must not begin.

## 10. Next sequence

1. merge the corrective Gate D docs PR only after CI/review is green;
2. run a second independent Codex review against the corrected merged documents and fresh latest main;
3. resolve any remaining blocker;
4. obtain owner Gate D approval;
5. request Claude Code final #745 remediation attestation (Gate E);
6. implement/accept Phase 0.5;
7. only after all remaining gates, consider Gate F / Phase 1.
