# P3-11 — Founder Wealth Read-only Projection

**DESIGN PROPOSAL — implementation and merge require Owner approval.**

Audited production main: `743d08d1867f453fe09c61e1fd5312c846cfc1eb` (2026-10-15 JST). CODE facts below describe that SHA; proposed APIs/fields are explicitly new, not existing production interfaces. No production implementation, registry adoption, schema change, cutover, Phase 3 Exit or Phase 4 Entry is authorized by this document.

Repository precedence follows the approved Roadmap. Current source establishes observed production facts; approved target contracts establish required future behavior. Discrepancies must be logged, never silently adopted as new policy. Required references: Owner instruction and approved [Entry](PHASE_3_ENTRY_CONTRACT.md), [P3-1](PHASE_3_P3_1_CONTRACT.md), [P3-2](PHASE_3_P3_2_CONTRACT.md), [P3-3](PHASE_3_P3_3_CONTRACT.md), [Roadmap](ECONOMIC_ENGINE_ROADMAP.md) and [dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md). Shared proposed types, identity rules and reason codes are specified in `PHASE_3_CROSS_SLICE_ARCHITECTURE.md` (companion cross-slice PR; dependency must merge first).

## 1. Goal / Scope

Provide an explainable founder net-worth estimate without changing personalNetWorth, borrowing limits, progression, achievements, estate/succession or ¥1T ending. Own-company formulas are fixed by Owner. Preserve negative net worth and unknown components.

## 2. Current Production State

CODE: base engine.personalNetWorth sums personalCash−personalDebt, all personalStocks, personally owned properties, personalInvestments, luxuryAssets, sports, startup personal stake and founder loan receivable, then clamps at0. expansion wrapper adds personal legacy PE/angel/personalRealEstateHoldings, subtracts mortgage/margin and adds corpCash/trust, then clamps again. Own-company original founder stake is not simply a separate current row. personalCreditLimit, succession, records, summaries and ending consume the installed method. Do not call it and append founder shares: it already includes personally purchased own shares and has clamped subtotals.

## 3. Existing Source-of-truth

| Component | Raw / existing evidence | Inclusion contract |
|---|---|---|
| Own company | P3-2 founderBeneficialShares; stockPrice/market binding or tagged equity estimate | one own-company row, personal own-ticker excluded elsewhere |
| Other listed assets | P3-5 personal positions + price | no company stocks |
| VC / direct PE | P3-8 ownedPersonal; P3-7 personal legacy PE | converted/aliased positions once |
| Founder loan | finance loans with founder source via existing founderLoanReceivable semantics | principal receivable once; company payable stays in company Equity Value |
| Personal property | properties owner=personal; personalRealEstateHoldings; corp/trust evidence | different collections not aliases by name; explicit links required |
| Debt | personalDebt plus validated outside-aggregate mortgage/margin liabilities | union of liability identities, never blindly sum all mirrors |
| Other personal assets | personalInvestments, luxuryAssets, sportsTeams owner!=company | source-specific legal/economic attribution |
No generic existing `EquityValue`, full fund NAV or trust-beneficiary registry is assumed.

## 4. Dependencies

P3-2+5..8, shared identity/valuation evidence and Phase 4 debt identity interface proposal. Raw personal components may be implemented before P3-4 under separate approval, but full authoritative wealth completeness requires all adapter and liability reconciliation. P3-11 never requires a Phase 6 formula to be invented: unknown Equity Value yields partial projection.

## 5. Entity / Ownership Data Model

Proposed WealthComponent: `{componentId,beneficialOwnerEntityId,assetKey,valuationBasis,amountJPY:null|Number,sourceRefs,includesKeys,excludedKeys,liabilityKey,completeness,reasons}`. Result `{authority:'read-only',components,knownNetWorth,totalNetWorth:null|Number,complete,unvaluedComponents,exclusions,reasons:Reason[]}`. Result-level `reasons` is always present (empty when no input-level failure) and carries structured shared `Reason` values `{code,path,message,evidenceRefs}` even if no component can be constructed. Component-local valuation/coverage reasons remain on their component. Known subtotal is not a guaranteed lower bound (unknown debts may be negative). Signed values supported; no clamp. Valuation evidence includes kind ('equityValue'/'enterpriseValue'/'marketPrice'/'stakeValue'), as-of game week, currency, covered assets/liabilities and source method/version. A numerical value with no semantic basis cannot become Equity Value.

## 6. API / Function Contracts

Proposed `projectFounderWealth(rawState,ownershipSnapshot,valuationEvidence,liabilityEvidence)` pure. First build unique asset/liability claim sets by durable IDs/account/generation; detect aliases and coverage conflicts. Listed own value = valid marketPrice × unique founderBeneficialShares. Private own value = evidence-backed EquityValue × founderEconomicOwnership ×0.70. Reject EV input with `VALUATION_BASIS_UNSUPPORTED`; do not subtract debt twice if supplied number is already Equity Value. Existing companyValue is a legacy mixed estimate, not approved as complete Equity Value without a parity/coverage audit; do not call installed mutating/cache helpers. Listed quote policy: valuationEvidence must identify active-generation price provenance. If stockPrice and the uniquely bound designated market row disagree, are missing/invalid or belong to another generation, return VALUATION_SOURCE_CONFLICT/UNKNOWN for own-company value until an approved canonical price source is established; do not choose the higher or convenient quote. Compute independently known rows with explicit ambiguity; total=null when any material ownership/valuation/liability unresolved. Numeric overflows/nonfinite/precision issues remain unknown, not clamped.

### Single committed-snapshot boundary

All four arguments must describe one exact immutable committed state revision, not merely the same game week, issuer generation or live state-object identity. Follow the merged [cross-slice snapshot contract](PHASE_3_CROSS_SLICE_ARCHITECTURE.md#2-proposed-common-api-and-types-not-production-exports): the trusted capture/projection context issues an opaque in-memory source token bound to that immutable view. Ownership, valuation (including quotes and cash coverage), and liability evidence must each be derived from and bound to that same view. Capture anew after each successful state-changing operation or hydration/rollback replacement, including multiple transactions in one week. Do not persist a token, consume RNG/time for it, or stamp previously computed evidence with a new token.

Before combining any supplied amounts or quantities, verify token identity and trusted provenance for every input. Missing, foreign or mismatched revision evidence returns `STALE_EVIDENCE`, `complete:false` and `totalNetWorth:null`; none of the rejected inputs may contribute to a subtotal. Independently known rows may remain only if derived directly from the accepted captured view. A caller-supplied string/token field alone is not proof. Existing P3-2 reconciliation and source-scoped adapters without this binding are not implicitly compatible: rederive their evidence inside the same trusted capture or cross-check every consumed source fact against it before binding; otherwise leave the input unsupported. An as-of week remains descriptive valuation metadata, never the freshness check.
Expose each rejected binding through result-level `reasons` with `code:'STALE_EVIDENCE'` and an exact argument-relative `path` (for example `ownershipSnapshot.sourceSnapshotToken` or `liabilityEvidence.sourceSnapshotToken`), even when `components` is empty. Diagnostic `evidenceRefs` contain safe source paths/IDs only, never the token or a live input reference. Sort reasons by code-unit path/code for deterministic output. Invalid raw roots report result-level `INPUT_INVALID` at `rawState` instead of a fictitious zero/complete result.

Pledged assets retain gross value; linked debt deducted once. Founder receivable is personal asset and parent payable is a company liability: both may legitimately affect founder exposure through different legal positions, but never add loan principal twice inside company equity/receivable row. Family/trust economic fraction must be documented; familyTrustShares is not additional founder shares by default.

## 7. Input / Output Examples

Listed issued1000/treasury100, original founder400 + personal own100: founder row500×price20=10,000; generic personal-stock own row excluded. Private EquityValue=100M, founder economic.6 →42M. Passing EV100M instead returns unknown, not42M. Personal cash10/debt30 yields−20 (units arbitrary), no zero clamp. Fund NAV1000 with GP contribution2% does not give founder1000; unknown liabilities/waterfall valuation → component amount unknown. Paid carry10 already in personalCash, add0 historical carry asset. Company holds subsidiary worth50 within supplied parent Equity Value; founder does not add50 again.

## 8. Invariants

No company-owned asset added directly to personal wealth; indirect assets included through parent equity/fund interest OR supported look-through decomposition, never both. personally purchased own shares included once. Outstanding treasury excluded; founder ratio uses beneficial quantities not stale original-founder ratio. Legacy direct PE currentValuation already stake value. Realized proceeds already cash. Asset pledge is not transfer of beneficial title. Negative total remains negative. Unknown total never drives credit/unlocks.

## 9. Unsupported / Unknown Cases

Unknown EV→equity bridge, parent estimate asset coverage, fund NAV/liability/waterfall, preferred startup terms, pending round investment valuation, family/trust fractions, historical issuer generation and duplicated/missing personal mortgage principal. P4-AUD-003–008 are existing external audit dependencies, not resolved by this read model. #976 may affect subsidiary valuation source; #979 broken saves preserve unknown status.

## 10. Save / Transaction / RNG Boundary

The API accepts raw immutable JSON data, never an engine instance. Validate own data descriptors before traversing: accessors, cyclic objects, exotic prototypes, non-finite values and malformed maps return explicit issues; never execute getters. Never call production `ensure`, `normalize`, `save`, `emit`, `finance.event`, stateful preview or settlement helpers. No host/simulation RNG, wall clock, ID counter, source sort, persistence, pending-write flush or source-reference escape. Deep-freeze newly allocated output only. Same input returns deeply equal deterministically ordered output; reading twice is idempotent without receipts. No full-state clone to run a mutating helper.

## 11. Legacy Compatibility

Keep effective saveVersion=9 and SAVE_KEY=capitalism_tycoon_web_v1; `save-v9.js` supplies the installed version despite engine.js's historical base constant. Add no saved root, adoption marker, normalization or repair. Missing optional collections may mean empty only where existing contract explicitly permits; present malformed data is invalid. Preserve original data and issue source paths. Array index may locate a diagnostic, never establish identity. Compaction/load/import cases with lost identity stay unresolved; do not recreate history.

## 12. Integration Points

New opt-in economicReadModel projection only. Trace all existing personalNetWorth consumers using reference search before any later cutover; none switch here. Debt identity contract aligns borrower/lender/company generation with #981 proposal. Phase 6 future Equity Value inputs carry explicit coverage; current display can remain partial. Do not recompute global graph/value on every row or render.

## 13. UI Contract

Show “算定済み項目の合計” and “未評価/未照合” when incomplete; never call partial subtotal complete net worth or a safe borrowing base. Separate original and purchased own-share source explanation under one asset total; show negative values honestly. “評価基準/取得簿価/未実現損益” distinct. Existing credit/progression/ending UI continues using current consumer until separately approved.

## 14. Tests / CI / WebKit

Extend existing `tests/phase3-ownership-projection-test.js` and `tests/phase3-ownership-reconciliation-test.js` for shared purity/identity/conservation fixtures; do not duplicate their harness. Add a focused adapter test only for new family behavior, register it in `tests/run-all.js` and `tests/run-all-shards.json` with shard contract verification. Run immutable input/output, malformed/unknown, insertion-order permutation, cross-account separation and no host/simulation RNG tests. Existing tests are characterization, not proof of an unimplemented API. CI: Test canonical A–L + aggregate `test`, Phase 0.5 Acceptance Smoke and all other applicable workflows. New browser/UI integration needs actual iPhone-emulated WebKit, reload and fresh durable hydration, with tested HEAD and job/artifact recorded; physical iPhone is separate. Docs-only PR CI cannot prove future adapter behavior.
Reuse `tests/economic-read-model-test.js`, P3-2 own-share dedup, `tests/pe-dual-ownership-test.js`, `tests/founder-shareholder-loan-lender-test.js`, personal-real-estate/margin and save tests. Candidate `tests/phase3-founder-wealth-test.js`: own shares listed/private, EV rejection, conflicting/missing own-company quote, debt mirrors, negative wealth, paid carry, personal vs company PE, indirect/subsidiary overlap, trust unknown and partial totals. Candidate WebKit tests repeated detail view purity/reload/44px/overflow.
Required revision cases: capture A, execute a same-week purchase/sale/buyback or repayment, capture B, then mix pre-trade ownership with post-trade cash/quotes/liabilities; reject each mismatched argument with STALE_EVIDENCE and null total, without stale subtotal arithmetic. Also cover absent tokens on legacy reconciliation, forged/copied token fields, in-place live-state changes and hydration/rollback replacement; matching evidence freshly derived from one immutable capture remains deterministic and supported. These are requirements for future implementation, not tests executed by this docs-only PR.
Assert result-level reason code/path/shape for each rejected argument, including the no-components case, deterministic ordering of multiple failures, no token/reference escape, and INPUT_INVALID for an invalid raw root. An ordinary unvalued component must remain distinguishable from an input-level stale snapshot failure.

## 15. Migration and Cutover Restrictions

Separate approval for new display, replacing personalNetWorth consumers and any credit/ending/balance effect. Do not switch even if new estimate differs from legacy. No saved wealth total, no speculative accrual, historical repair or new debt Authority.

## 16. Risks and Findings

R-P311-01: naive legacy total + founder stake duplicates purchased own shares and preserves zero clamp. R-P311-02: GP-managed NAV overclaim; financing cash double counting as debt. R-P311-03: debt sources not fully reconciled means complete total is unavailable. Design resolves hazards by component-level source union, semantic valuation evidence and explicit incomplete total; production debt fixes remain separate.

## 17. Acceptance Criteria

Two mandated own-company formulas exact in scope; unique owned share/asset/loan claims; common exact immutable source revision verified before any cross-input arithmetic; complete total only on fully supported evidence; no EV substitution; negative total preserved; current personalNetWorth and every existing consumer remain byte/behavior unchanged by implementation. New UI read-only tests and source coverage audit required.

## 18. Owner Decisions

Approve pure projection/display implementation. OD-04: choose evidence-backed private Equity Value source/coverage; recommendation tagged legacy estimate only after audit, otherwise partial unknown until Phase 6. OD-05: GP residual carry/fund-interest valuation and family/trust treatment where evidence lacks policy; recommendation disclose unknown. Any consumer cutover separate. Basic own-company formulas are already approved and need no reapproval.

## 19. Implementation Slices

1 pure component projector/test PR after adapters; 1 read-only UI PR; optional valuation coverage/debt reconciliation follow-up after approvals. Keep writer/consumer files untouched until separate authorization.

## 20. Definition of Done

Supported component calculations implemented and tested; completeness honest, no duplicate own/fund assets or debt; UI and negative cases verified; consumers unchanged; outstanding Owner decisions and unsupported totals documented. This is projection DoD, not wealth-consumer cutover.
