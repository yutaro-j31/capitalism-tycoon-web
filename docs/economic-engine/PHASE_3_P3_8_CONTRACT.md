# P3-8 — VC Startup and Conversion Ownership Read-only Adapter

**DESIGN PROPOSAL — implementation and merge require Owner approval.**

Audited production main: `743d08d1867f453fe09c61e1fd5312c846cfc1eb` (2026-10-15 JST). CODE facts below describe that SHA; proposed APIs/fields are explicitly new, not existing production interfaces. No production implementation, registry adoption, schema change, cutover, Phase 3 Exit or Phase 4 Entry is authorized by this document.

Repository precedence follows the approved Roadmap. Current source establishes observed production facts; approved target contracts establish required future behavior. Discrepancies must be logged, never silently adopted as new policy. Required references: Owner instruction and approved [Entry](PHASE_3_ENTRY_CONTRACT.md), [P3-1](PHASE_3_P3_1_CONTRACT.md), [P3-2](PHASE_3_P3_2_CONTRACT.md), [P3-3](PHASE_3_P3_3_CONTRACT.md), [Roadmap](ECONOMIC_ENGINE_ROADMAP.md) and [dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md). Shared proposed types, identity rules and reason codes are specified in `PHASE_3_CROSS_SLICE_ARCHITECTURE.md` (companion cross-slice PR; dependency must merge first).

## 1. Goal / Scope

Unify current company/personal startup economic stakes, funding evidence and IPO/subsidiary/exit transitions. Do not invent preferred-share voting/liquidation terms or move Phase 14 funding/exit authority.

## 2. Current Production State

CODE: engine.investStartup writes ownedCompany/ownedPersonal and invested cost; participateStartupFundingRound adds contributedCompany/Personal to activeFundingRound before close. closeStartupFundingRound applies pre-round dilution plus contribution/post-money and clears round. updateStartups can change stakes/die/list. expansion.sellStartupSecondary zeros the selected full stake/cost/DD bucket inside runTransaction. engine.listStartup creates market lots using floor(stake×1M), zeros startup stakes/cost, sets ipoStockID and alive=false. engine.makeSubsidiary retains startup stakes and creates a subsidiary mirror.

## 3. Existing Source-of-truth

Current stakes: startups[].ownedCompany/ownedPersonal. Amount invested: totalInvestedCompany/Personal, not share quantity. DD negotiated stake is a subset of owned stake. Open-round preRoundOwned*/contributed* and startupFundingHistory are lifecycle evidence, not additional current shares. `valuation` is a source economic valuation estimate, not automatically a proven common-share Equity Value. Startup `stage` or fundingRound label does not establish legal share class. `angelInvestments` is a distinct legacy investment family and must not be merged by startup display name.

## 4. Dependencies

P3-1/shared index; P3-5 listing conversion and P3-6 subsidiary aliases. Central identity-index construction reads all raw links once, then independent adapters use it. No P3-4 runtime dependency for an opt-in pure reader. Controls remain unsupported for startups until a separate approved issuer/class adoption contract.

## 5. Entity / Ownership Data Model

Startup entity ID scoped to durable startup.id and provenance. Two distinct beneficial edges for ownedCompany and ownedPersonal; quantity=null, economicFraction from explicit fraction, securityClassId=null/unknown class. Rights fields contain unknown evidence, not `ordinary=true`. RoundObservation stores pre/post-money, contribution and close state with source refs. Realized proceeds histories separate from current holdings. IPO links same issuer to a new listed observation; share-class equivalence remains unknown unless conversion evidence supports it.

## 6. API / Function Contracts

Proposed `projectVCOwnership(rawState,identityIndex)` → AdapterResult + roundObservations + conversionLinks. Validate each fraction 0..1 and combined known stakes <=1, DD subset <= selected stake; no normalization if overallocated. During open round retain current stake and show contributed capital as pending investment evidence, not immediate incremental current equity; valuation coverage reports pending contribution separately to avoid omission or double valuation. At close observe new stakes once. IPO rule: zeroed old stakes plus valid ipoStockID lots → current P3-5 listed position only; nonzero old stake with listed lot → conflict/unresolved affected positions, not “prefer listed” silently. Subsidiary rule: same company stake source/mirror one position; personal startup stake remains personal even after company subsidiary conversion.

## 7. Input / Output Examples

PreMoney=100, targetRaise=25, preRound personal=.10, personal contributes2: before close current stake .10 plus pending2; after close .10×100/125 +2/125=.096. Pending cash has already left personalCash; show its separate recoverability/valuation uncertainty, never current voting equity. IPO old .1 becomes100,000 shares out of1M, old ownedPersonal=0: one listed position. If both remain .1 and100,000, emit conversion conflict; no asset total. Unknown preferred class → economic fraction .096 can be reported, votes/liquidation preference unknown.

## 8. Invariants

0<=sum known economic fractions<=1; no named outsiders created from residual. Round history is not another position. Secondary full sale zeros the current interest; realized proceeds are already cash. DD bucket subset does not add to owned shares. IPO floor residual is reported as conversion precision evidence, not a new share lot or compensation payment. Class preference terms and economic estimate do not imply voting equality.

## 9. Unsupported / Unknown Cases

Missing round IDs, duplicate startup IDs, malformed cap tables, wrong account DD subsets, startup IPO alias collisions, negative/unknown conversion residual, open-round contribution with no receipt/valuation certainty, unsupported M&A cash exit, unknown liquidation preference. `alive=false` alone is not enough to decide liquidation recovery versus IPO: inspect lifecycle fields, never guess zero-value assets.

## 10. Save / Transaction / RNG Boundary

The API accepts raw immutable JSON data, never an engine instance. Validate own data descriptors before traversing: accessors, cyclic objects, exotic prototypes, non-finite values and malformed maps return explicit issues; never execute getters. Never call production `ensure`, `normalize`, `save`, `emit`, `finance.event`, stateful preview or settlement helpers. No host/simulation RNG, wall clock, ID counter, source sort, persistence, pending-write flush or source-reference escape. Deep-freeze newly allocated output only. Same input returns deeply equal deterministically ordered output; reading twice is idempotent without receipts. No full-state clone to run a mutating helper.

## 11. Legacy Compatibility

Keep effective saveVersion=9 and SAVE_KEY=capitalism_tycoon_web_v1; `save-v9.js` supplies the installed version despite engine.js's historical base constant. Add no saved root, adoption marker, normalization or repair. Missing optional collections may mean empty only where existing contract explicitly permits; present malformed data is invalid. Preserve original data and issue source paths. Array index may locate a diagnostic, never establish identity. Compaction/load/import cases with lost identity stay unresolved; do not recreate history.

## 12. Integration Points

Keep installed invest/follow-on/secondary/makeSubsidiary/listStartup and weekly wrappers intact; no replay of funding histories to reconstruct a full historical cap table. P3-5 and P3-8 publish shared ownership keys so composer chooses listed/current versus startup history once. P3-11 receives tagged valuation and completeness flags. Acquisition exit missing from current concrete writer evidence remains an unsupported transition, not a fabricated API.

## 13. UI Contract

Show company/personal stake separately, pending round contribution, dilution source, listed conversion and unknown preference/votes. A stage label is not a voting-right badge. No new funding/exit buttons in this slice.

## 14. Tests / CI / WebKit

Extend existing `tests/phase3-ownership-projection-test.js` and `tests/phase3-ownership-reconciliation-test.js` for shared purity/identity/conservation fixtures; do not duplicate their harness. Add a focused adapter test only for new family behavior, register it in `tests/run-all.js` and `tests/run-all-shards.json` with shard contract verification. Run immutable input/output, malformed/unknown, insertion-order permutation, cross-account separation and no host/simulation RNG tests. Existing tests are characterization, not proof of an unimplemented API. CI: Test canonical A–L + aggregate `test`, Phase 0.5 Acceptance Smoke and all other applicable workflows. New browser/UI integration needs actual iPhone-emulated WebKit, reload and fresh durable hydration, with tested HEAD and job/artifact recorded; physical iPhone is separate. Docs-only PR CI cannot prove future adapter behavior.
Reuse `tests/startup-funding-round-test.js`, VC initial/follow-on/secondary atomicity suites and corresponding real WebKit jobs; `tests/make-subsidiary-save-atomicity-test.js`. Candidate `tests/phase3-vc-ownership-adapter-test.js`: before/during/after round, IPO floor conversion, partial sold/zeroed stake, subsidiary mirror with residual personal investment, missing preferred rights and overallocated cap table. These future assertions are not claimed to exist today.

## 15. Migration and Cutover Restrictions

This slice may represent legacy facts before P3-4 completes, only as a pure opt-in read model with no live consumer replacement. New API names do not mean an existing authority moved. Existing trading, acquisition, distributions and financing remain authoritative in their current modules. No new registry, settlement writer, quantity repair, schema/version change or automatic backfill. A later cutover requires its own Owner approval, complete writer inventory and failure evidence.

## 16. Risks and Findings

R-P38-01: open-round cash contribution is paid before current ownership changes; naive fraction-only wealth would omit it, while treating it as current equity grants unsupported rights. Contract now carries pending-investment evidence with completeness flags. R-P38-02: IPO/dormant startup versus subsidiary duplicate needs lifecycle-aware composer. Existing tests do not certify complete legal cap tables.

## 17. Acceptance Criteria

Correct current fractions and pending lifecycle evidence; no inferred preferred rights; no IPO/subsidiary duplication; both accounts separate; frozen pure output and explicit unknowns. Cap-table consistency refers to known modeled stakes only, never a claim to a complete shareholder register.

## 18. Owner Decisions

Approve read-only implementation. New preferred terms, acquisition exit settlement or treatment of ambiguous historical pending contributions requires separate Owner approval. Conservative unknown permits adapter delivery while those features stay unsupported.

## 19. Implementation Slices

1 adapter/round/conversion test PR; optional separately approved pending-investment valuation PR. Do not edit installed VC writers to make tests easier. Shared identity/index integration serialized after P3-5 contracts.

## 20. Definition of Done

Actual adapter and conversion tests pass; source fields and unavailable evidence documented; no Phase 14 authority change. Node/WebKit evidence identifies exact implemented cases and remaining gaps.
