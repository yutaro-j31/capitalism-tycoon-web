# P3-9 — Exact Control Ladder Eligibility Projection

**DESIGN PROPOSAL — implementation and merge require Owner approval.**

Audited production main: `743d08d1867f453fe09c61e1fd5312c846cfc1eb` (2026-10-15 JST). CODE facts below describe that SHA; proposed APIs/fields are explicitly new, not existing production interfaces. No production implementation, registry adoption, schema change, cutover, Phase 3 Exit or Phase 4 Entry is authorized by this document.

Repository precedence follows the approved Roadmap. Current source establishes observed production facts; approved target contracts establish required future behavior. Discrepancies must be logged, never silently adopted as new policy. Required references: Owner instruction and approved [Entry](PHASE_3_ENTRY_CONTRACT.md), [P3-1](PHASE_3_P3_1_CONTRACT.md), [P3-2](PHASE_3_P3_2_CONTRACT.md), [P3-3](PHASE_3_P3_3_CONTRACT.md), [Roadmap](ECONOMIC_ENGINE_ROADMAP.md) and [dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md). Shared proposed types, identity rules and reason codes are specified in `PHASE_3_CROSS_SLICE_ARCHITECTURE.md` (companion cross-slice PR; dependency must merge first).

## 1. Goal / Scope

Design a deterministic read-only explanation of the six approved voting thresholds. Eligibility is not executable authorization. Disclosure 5% and equity-method20% are optional labels outside the ladder. No general management command unlock.

## 2. Current Production State

CODE: P3-2 reconciles issued, treasury, founder beneficial quantity and unallocated residual of the player common class. It is not a complete registry. Existing listed-subsidiary-control-actions uses rounded ownershipRatio and legacy acquisition commands; board-governance-resolution uses board-member votes. Neither is the exact shareholder capability API being proposed. No generic Control Ladder projection is assumed present.

## 3. Existing Source-of-truth

Only evidence-backed common-class quantities and per-class voting rules qualify. Reuse P3-2 founder beneficial quantity, never legacy founderOwnershipRatio alone. For external/subsidiary/PE/VC unknown voting, preserve UNKNOWN. Board-member votes, fund management authority, financing participation, ownership percentages and publicCompany flags are not shareholder voting proof.

## 4. Dependencies

Shared adapter result; P3-2 player proof; P3-5..8 coverage for other issuer families. A pure player-only projection can be implemented before P3-4, marked read-only and non-executable. Other family results remain UNKNOWN/unsupported. P3-10 integration requires completed applicable P3-4 adoption and P3-9 tests; future control cannot substitute for missing registry authority.

## 5. Entity / Ownership Data Model

Proposed VotingEvidence: `{issuerEntityId,securityClassId,holderEntityId,beneficialOwnerEntityId,generationEvidence,eligibleVotingUnits,holderVotingUnits,rightsBasis,sourceRefs,classConstraints}`. Non-voting class contributes zero only if explicitly known non-voting; missing class rules are unknown. Denominator is eligible outstanding voting units, excludes treasury and explicitly non-voting units. Economic denominator is separate. Multiple known classes supported for diagnostics only; unknown special veto/weighted votes makes relevant eligibility unknown. Direct actor votes never automatically sum founder/company/fund/trust.

## 6. API / Function Contracts

Proposed `projectControlEligibility(ownershipSnapshot,{issuerEntityId,actingEntityId})` → `{authority:'read-only',executable:false,votingEvidence,capabilities:[{commandId,status:'ELIGIBLE'|'INELIGIBLE'|'UNKNOWN',reasons,threshold,evidenceRefs}]}`. First validate scope, issuer generation, conservation, complete denominator, class and beneficial attribution. Contradictory evidence → UNKNOWN, not INELIGIBLE-zero. Initial supported executable-family policy remains player/common and explicitly proven listed subsidiaries; external ordinary evidence may be displayed but command execution remains issuer-family unsupported.

Exact comparator: accept integer safe voting units (reject fractional legacy voting units as `NUMERIC_DOMAIN_UNSUPPORTED`); convert validated safe integers to local BigInt only for cross-products, never persist BigInt. For n votes / d>0 use `100n>=d`, `100n>=3d`, `3n>d`, `2n>d`, `3n>=2d`, `10n>=9d`. Here n/d are symbols; implementation uses BigInt multiplications, not floating ratios or literals that concatenate with variable names. If quantities/weights cannot be represented as validated safe integer units, return UNKNOWN; no rounding or EPSILON. Deterministic code-unit ordering, no locale sort.

## 7. Input / Output Examples

Boundary fixture d=300: information1% n=2/3/4 gives INELIGIBLE/ELIGIBLE/ELIGIBLE; proposal3% n=8/9/10 → I/E/E; blocking n=99/100/101 → I/I/E; ordinary n=149/150/151 → I/I/E; special n=199/200/201 → I/E/E; squeeze n=269/270/271 → I/E/E. d=0 → UNKNOWN for all. d=1000 issued, treasury100, voting denom900 and actor450: ordinary is INELIGIBLE at exactly1/2, special-block is ELIGIBLE; no command executes. Display “50.00%” cannot override exact quantities.

## 8. Invariants

No rights grant from rounded percentages, unknown evidence, residual external class units, family surname or trust association. SpecialResolution eligibility and another holder's veto are distinct: local capability output does not decide a particular contested resolution's outcome. Board thresholds untouched. More than50%/at least2/3 does not authorize asset sales, cash transfers, existing engine commands or later-phase settlements.

## 9. Unsupported / Unknown Cases

Fractional quantities supported by P3-2 read diagnostic remain non-executable/UNKNOWN for P3-9 until an exact quantity-domain policy is separately approved. Unknown weighted/non-voting/veto classes, contradictory registry, joint-control/acting-in-concert claims, indirect company-owned votes with no delegation mandate and uncertain founder generation are UNKNOWN. Ownership graph products never establish votes automatically.

## 10. Save / Transaction / RNG Boundary

The API accepts raw immutable JSON data, never an engine instance. Validate own data descriptors before traversing: accessors, cyclic objects, exotic prototypes, non-finite values and malformed maps return explicit issues; never execute getters. Never call production `ensure`, `normalize`, `save`, `emit`, `finance.event`, stateful preview or settlement helpers. No host/simulation RNG, wall clock, ID counter, source sort, persistence, pending-write flush or source-reference escape. Deep-freeze newly allocated output only. Same input returns deeply equal deterministically ordered output; reading twice is idempotent without receipts. No full-state clone to run a mutating helper.

## 11. Legacy Compatibility

Keep effective saveVersion=9 and SAVE_KEY=capitalism_tycoon_web_v1; `save-v9.js` supplies the installed version despite engine.js's historical base constant. Add no saved root, adoption marker, normalization or repair. Missing optional collections may mean empty only where existing contract explicitly permits; present malformed data is invalid. Preserve original data and issue source paths. Array index may locate a diagnostic, never establish identity. Compaction/load/import cases with lost identity stay unresolved; do not recreate history.

## 12. Integration Points

Build one immutable ownership snapshot per UI update, then evaluate selected issuer/actor. P3-10 consumes evidence IDs and rechecks at command entry, never trusts cached eligibility. Existing legacy controls remain unchanged; a future explicit family adoption decides their guard integration. Phase 4 collateral metrics consume ownership/pledge evidence without adding voting units.

## 13. UI Contract

UI exposes exact numerator/denominator, source/unknown reason, threshold operator and separate “実行条件未承認/非対応”. ELIGIBLE badge never wires a button directly to a management writer. Unknown and ineligible have different text; accessibly explain disabled buttons without hover. No per-row full-world recalculation.

## 14. Tests / CI / WebKit

Extend existing `tests/phase3-ownership-projection-test.js` and `tests/phase3-ownership-reconciliation-test.js` for shared purity/identity/conservation fixtures; do not duplicate their harness. Add a focused adapter test only for new family behavior, register it in `tests/run-all.js` and `tests/run-all-shards.json` with shard contract verification. Run immutable input/output, malformed/unknown, insertion-order permutation, cross-account separation and no host/simulation RNG tests. Existing tests are characterization, not proof of an unimplemented API. CI: Test canonical A–L + aggregate `test`, Phase 0.5 Acceptance Smoke and all other applicable workflows. New browser/UI integration needs actual iPhone-emulated WebKit, reload and fresh durable hydration, with tested HEAD and job/artifact recorded; physical iPhone is separate. Docs-only PR CI cannot prove future adapter behavior.
Candidate `tests/phase3-control-eligibility-test.js`: all18 boundary cases above, coprime denominators, safe-integer maximum cross-products, fractional rejection, treasury/non-voting, unknown weighted class, dedup/legal-account separation, direct/indirect evidence, zero denominator and insertion order. Reuse existing projection/reconciliation fixtures, not a second arithmetic oracle using the same implementation. WebKit candidate `tests/phase3-control-eligibility-webkit-test.js` for explanation/purity when UI arrives.

## 15. Migration and Cutover Restrictions

Read-only computation may precede P3-4 with Owner implementation approval; authority and executable flags remain disabled. Do not replace existing listed subsidiary controls or board votes, create adoption metadata or expand issuer-family execution scope. Phase 9+ trading/TOB settlement remains legacy.

## 16. Risks and Findings

R-P39-01: Number cross-products can cross thresholds incorrectly near the quantity envelope; design uses validated safe integers and local exact products. R-P39-02: P3-2 conservation alone cannot certify unknown outsiders or class constraints; evidence gates must precede comparator. Unsupported legacy fractions limit coverage rather than round them.

## 17. Acceptance Criteria

Exact operator tests and independent expected outcomes; no shadow permission grant, no RNG/state writes; eligibility explanations reproducible; initial scope and direct-call guard contract explicit. No claim that a real shareholder resolution carried solely because this projector says ELIGIBLE.

## 18. Owner Decisions

Read-only implementation approval. No decision needed for exact integer comparator/fail-closed fractional cases. Any extension to fractional executable voting, weighted classes, joint control or delegation is a new Owner policy decision. Existing six thresholds are fixed.

## 19. Implementation Slices

1 pure eligibility PR after shared snapshot; 1 explanation/UI-only PR optional before command integration. Control projector editor separate from P3-4 Writer editor. Command family activation remains later and gated.

## 20. Definition of Done

All supported exact cases covered, unknowns explicit, UI tested if present, P3-4 adoption prerequisite preserved and no existing management method exposed. P3-9 readiness is separate from command production readiness.

