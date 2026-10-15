# P3-7 — PE Fund and Portfolio Ownership Read-only Adapter

**DESIGN PROPOSAL — implementation and merge require Owner approval.**

Audited production main: `743d08d1867f453fe09c61e1fd5312c846cfc1eb` (2026-10-15 JST). CODE facts below describe that SHA; proposed APIs/fields are explicitly new, not existing production interfaces. No production implementation, registry adoption, schema change, cutover, Phase 3 Exit or Phase 4 Entry is authorized by this document.

Repository precedence follows the approved Roadmap. Current source establishes observed production facts; approved target contracts establish required future behavior. Discrepancies must be logged, never silently adopted as new policy. Required references: Owner instruction and approved [Entry](PHASE_3_ENTRY_CONTRACT.md), [P3-1](PHASE_3_P3_1_CONTRACT.md), [P3-2](PHASE_3_P3_2_CONTRACT.md), [P3-3](PHASE_3_P3_3_CONTRACT.md), [Roadmap](ECONOMIC_ENGINE_ROADMAP.md) and [dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md). Shared proposed types, identity rules and reason codes are specified in `PHASE_3_CROSS_SLICE_ARCHITECTURE.md` (companion cross-slice PR; dependency must merge first).

## 1. Goal / Scope

Separate fund ownership of assets, investor rights in a fund, management/carry rights, co-investors and legacy direct PE holdings. Do not count all GP-managed assets as founder wealth. Phase 13 fund/deal settlement stays legacy-authoritative.

## 2. Current Production State

CODE: peFirm.funds contains id,size,gpCommit,lpContributed,cash,lps,terms,deals and distribution counters (`pe-fund.js::createFund`, gpShareOfFund, distributeToInvestors, calculateExitSettlement, settleExitProceeds). GP contribution debits personalCash. Fund acquisition stores fundPortion/coinvestPortion, investedAmount, enterpriseValue and portfolioCompany (`pe-acquisition.js`). Legacy peDeals uses ownerAccount/ownershipRatio/currentValuation/ownerCostBasis and a company subsidiary mirror. Parent acquisition moves fund deal to exited and adds a company subsidiary. Stale comments claiming fund acquisition is not wired are contradicted by installed pe-acquisition.js; code wins.

## 3. Existing Source-of-truth

| Layer | Source | Meaning |
|---|---|---|
| Investor capital rights | fund.gpCommit/size and lpContributed/lps | contribution ratio, not target-company share percentage |
| Fund asset economic allocation | deal.fundPortion / (fundPortion+coinvestPortion) | proceeds participation defined by current waterfall, not proof of legal shares |
| External co-invest | coinvestPortion, peFirm.coinvestCapital | external interests/cash, never founder-owned by default |
| GP carry | terms.carry/hurdle + deal.settlement | contingent remuneration until settlement; paid cash already in personalCash |
| Fees | managementFeesPaid and weekly fee code | expense/income flows, not a portfolio ownership edge |
| Legacy direct PE | peDeals ownerAccount/ownershipRatio/currentValuation | currentValuation already the owner's stake value, not whole EV |
Fund NAV is a derived observation; no generic persisted `fund.nav` is assumed.

## 4. Dependencies

Shared identity/types and P3-1. P3-6 dedup policy for PE subsidiary mirrors/conversions. Can implement pure adapter alongside P3-4, provided no installed settlement methods, ensureFund/ensure or mutating previews are invoked. P3-11 uses investor interests and valuation evidence, not gross assets.

## 5. Entity / Ownership Data Model

Fund entity uses durable fund.id, not Fund I/II display ordinal. LP IDs are source-scoped; missing LP identity stays external aggregate evidence, not a named person. Proposed `fundInvestorInterest` includes contributed capital, contributionRatio, distributionsToDate and known waterfall terms. Proposed `portfolioParticipation` includes fund/coinvest economic proceeds fractions, but quantity/class/voting may all be null. `managementRelationship` is a separate non-asset edge. Legacy direct peDeals map to the legal account owner; reciprocal company subsidiary is an alias, not another interest.

## 6. API / Function Contracts

Proposed `projectPEOwnership(rawState, identityIndex)` → `{...AdapterResult,fundInterests,portfolioParticipations,managementRelationships,distributionEvidence}`. No call to gpShareOfFund on live data is needed: validate inputs then derive ratio without clamps. Require size>0 and 0<=gpCommit<=size, compatible LP contributed totals; invalid totals are unknown. Fund asset/co-invest allocation only when investedAmount = fundPortion+coinvestPortion within the source's exact documented Number computation; report discrepancy, do not normalize. Never map financing fraction to legal equity absent whole-target/legal rights evidence. `projectFundValuationEvidence` returns cash plus tagged held-asset observations and liability/coverage gaps, not an unconditional founder NAV entitlement.

## 7. Input / Output Examples

Fund size=100, gpCommit=2, lpContributed=98: founder investor capital share=.02; this is not 100% of fund assets. Deal funded 25 fund + 10 external co-invest: economic proceeds participation 25/35 and 10/35; no founder co-invest position. Paid gpCarry=3 is historical cash flow and cannot be added to personalCash again. Company-owned legacy PE .7 with currentValuation=70 and a sub valuation=100/ownership=.7: one stake worth70, not70+100 or70×.7. Parent conversion with matched exited deal and sourcePEDealID: current company edge replaces fund holding; historical settlement is not a retained asset.

## 8. Invariants

Fund-level cash distinct from portfolioCompany.cash, companyCash and personalCash. GP commitment and carry distinct. LP commitments are not outstanding cash claims until source proves contribution/call status. Closed/exited rows do not remain current portfolio assets; fund/LP paid distributions reduce remaining interest and are not added as receivables. Management authority is not beneficial title or voting authority. Fund I/II cannot share positions just because names match.

## 9. Unsupported / Unknown Cases

Absent legal equity percentage, unknown fund liability completeness/NAV, unknown LP terms, fund-ID collision after bounded history truncation, missing convertedToSubsidiaryID, orphan/mismatched PE mirror, ambiguous GP beneficiary. Emit partial facts; monetary value for affected wealth component is null, never entire fund NAV or zero assumed liability.

## 10. Save / Transaction / RNG Boundary

The API accepts raw immutable JSON data, never an engine instance. Validate own data descriptors before traversing: accessors, cyclic objects, exotic prototypes, non-finite values and malformed maps return explicit issues; never execute getters. Never call production `ensure`, `normalize`, `save`, `emit`, `finance.event`, stateful preview or settlement helpers. No host/simulation RNG, wall clock, ID counter, source sort, persistence, pending-write flush or source-reference escape. Deep-freeze newly allocated output only. Same input returns deeply equal deterministically ordered output; reading twice is idempotent without receipts. No full-state clone to run a mutating helper.

## 11. Legacy Compatibility

Keep effective saveVersion=9 and SAVE_KEY=capitalism_tycoon_web_v1; `save-v9.js` supplies the installed version despite engine.js's historical base constant. Add no saved root, adoption marker, normalization or repair. Missing optional collections may mean empty only where existing contract explicitly permits; present malformed data is invalid. Preserve original data and issue source paths. Array index may locate a diagnostic, never establish identity. Compaction/load/import cases with lost identity stay unresolved; do not recreate history.

## 12. Integration Points

Shared merger owns PE/VC/subsidiary alias arbitration. P3-6 consumes ownership edges without an independent PE asset; P3-11 uses only founder investor capital interest + supported residual carry valuation, excluding company-owned direct holdings and external coinvest. Phase 13 keeps acquisition, fees, cash returns and exit settlement. Parent conversion is a lifecycle observation, not an instruction to execute acquisition.

## 13. UI Contract

Future UI distinguishes “運用資産”, “個人の出資持分”, “共同投資家”, “支払済キャリー” and “未確定評価”. No total managed asset figure is labeled personal net worth. Percentages identify their denominator (fund contribution versus deal proceeds).

## 14. Tests / CI / WebKit

Extend existing `tests/phase3-ownership-projection-test.js` and `tests/phase3-ownership-reconciliation-test.js` for shared purity/identity/conservation fixtures; do not duplicate their harness. Add a focused adapter test only for new family behavior, register it in `tests/run-all.js` and `tests/run-all-shards.json` with shard contract verification. Run immutable input/output, malformed/unknown, insertion-order permutation, cross-account separation and no host/simulation RNG tests. Existing tests are characterization, not proof of an unimplemented API. CI: Test canonical A–L + aggregate `test`, Phase 0.5 Acceptance Smoke and all other applicable workflows. New browser/UI integration needs actual iPhone-emulated WebKit, reload and fresh durable hydration, with tested HEAD and job/artifact recorded; physical iPhone is separate. Docs-only PR CI cannot prove future adapter behavior.
Reuse `tests/pe-fund-test.js`, `tests/pe-fund-coinvest-test.js`, `tests/pe-dual-ownership-test.js`, `tests/pe-fund-acquisition-save-atomicity-test.js`, `tests/pe-portfolio-exit-save-atomicity-test.js` and WebKit equivalents in ma-acquisition-financing.yml. Candidate `tests/phase3-pe-ownership-adapter-test.js`: Fund I/II, 2% GP case, external coinvest, fee/carry paid once, parent transfer alias, duplicate IDs and incomplete NAV evidence.

## 15. Migration and Cutover Restrictions

This slice may represent legacy facts before P3-4 completes, only as a pure opt-in read model with no live consumer replacement. New API names do not mean an existing authority moved. Existing trading, acquisition, distributions and financing remain authoritative in their current modules. No new registry, settlement writer, quantity repair, schema/version change or automatic backfill. A later cutover requires its own Owner approval, complete writer inventory and failure evidence.

## 16. Risks and Findings

R-P37-01: treating fund financing proportions as target legal voting shares overclaims control; design now labels proceeds participation only. R-P37-02: existing fund previews call ensure or simulate settlement; invoking them in a reader violates purity. Required raw calculation contract resolves the design hazard. Production completeness/fault coverage remains Track A work; passing a PE test does not close all PE writers.

## 17. Acceptance Criteria

No false legal/voting share evidence; separated fund/person/company/external accounts; canonical PE mirror once; paid carry/distributions never added twice; no mutation on raw/frozen old saves; fail-closed NAV gaps and fund identity collisions. Relevant existing settlement regression gates maintained.

## 18. Owner Decisions

Separate implementation approval. No economic change needed for raw evidence adapter. Any new GP carry fair value or fund NAV allocation for total personal wealth must be an explicit valuation policy decision; default show unknown and do not enable credit/progression.

## 19. Implementation Slices

1 pure adapter/family tests PR; optional valuation completeness extension after Owner policy. Shared module changes serialized; independent source audit/test fixtures can proceed in parallel with Claude's P3-4 writer corrections.

## 20. Definition of Done

Reviewed raw-source mapping and completed focused/canonical gates; fund investment and portfolio participation remain separate; unknown valuation does not masquerade as a complete personal wealth total. No Phase 13 cutover.
