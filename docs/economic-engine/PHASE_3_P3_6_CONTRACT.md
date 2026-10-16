# P3-6 — Subsidiary and M&A Relationship Read-only Adapter

**DESIGN PROPOSAL — implementation and merge require Owner approval.**

Audited production main: `743d08d1867f453fe09c61e1fd5312c846cfc1eb` (2026-10-15 JST). CODE facts below describe that SHA; proposed APIs/fields are explicitly new, not existing production interfaces. No production implementation, registry adoption, schema change, cutover, Phase 3 Exit or Phase 4 Entry is authorized by this document.

Repository precedence follows the approved Roadmap. Current source establishes observed production facts; approved target contracts establish required future behavior. Discrepancies must be logged, never silently adopted as new policy. Required references: Owner instruction and approved [Entry](PHASE_3_ENTRY_CONTRACT.md), [P3-1](PHASE_3_P3_1_CONTRACT.md), [P3-2](PHASE_3_P3_2_CONTRACT.md), [P3-3](PHASE_3_P3_3_CONTRACT.md), [Roadmap](ECONOMIC_ENGINE_ROADMAP.md) and [dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md). Shared proposed types, identity rules and reason codes are specified in `PHASE_3_CROSS_SLICE_ARCHITECTURE.md` (companion cross-slice PR; dependency must merge first).

## 2026-10-16 implementation-first alignment

Current checked main: `2596b7e62e592df759d19bc44ff16c0a428b3917`. The older audited baseline below remains historical evidence. #994 is now merged (`c45b2c9e2dff93a791d9394cee3ec462623fd926`); its ownership-ratio and shadow-atomicity tests exist on current main. Statements about #994 being unmerged describe the older baseline, not a present blocker. The Owner's current instruction authorizes scoped pure/read-only implementation, subject to the shared-contract dependency, focused safety and CI; it does not authorize writer adoption or a Phase Exit. The merged Implementation-First Roadmap v2 and F/S/Q alignment control audit timing: broad integrated/long-run campaigns move to Stage Q, while targeted identity/account separation, malformed input, determinism, compatibility and applicable permanent gates remain Stage F requirements.

## 1. Goal / Scope

Expose direct parent/child and minority economic interests plus provenance. Indirect ownership is a separate explainable graph traversal, never an automatic control grant or Phase 10 M&A settlement migration.

## 2. Current Production State

CODE: `engine.makeSubsidiary` retains startup ownership and adds subsidiaries[].startupID/ownership. `ma-deal-room.completeTargetAcquisition` adds acquired targets to maSubsidiaries and records acquisitionDealID/book/goodwill. Installed close chain outermost: ma-board-approval → ma-acquisition-financing → pe-acquisition → ma-deal-room (each later installer wraps the earlier method). `expansion.syncPESubsidiary` creates a subsidiary mirror of company-owned peDeals. `pePortfolioOperations.acquirePortfolioCompanyByParent` exits a fund deal and adds a sourcePEFundID/sourcePEDealID subsidiary. Listed subsidiary market/control/follow-on/secondary writers modify ownership. Additional actual writer: js/new-business-commercialization.js::act in spinout mode, reached through installed commercializeNewBusiness, unshifts maSubsidiaries rows with derived spinout-* ID, investmentBookValue, enterpriseValue and valuation=1,000,000. It retains no explicit ownership/class/votes or projectID/startWeek on the row. D3/#992 and D4/#993 are merged; #994's M&A financing dilution repair is unmerged at audit base.

## 3. Existing Source-of-truth

| Representation | Ownership fact | Alias treatment |
|---|---|---|
| subsidiaries[].startupID | company relationship from ownedCompany / sub.ownership | same startup issuer; company edge once, personal stake stays separate |
| subsidiaries[].peDealID, peDeals[].subsidiaryID | mirror of company-owned legacy PE position | same economic interest, canonical source P3-7 |
| subsidiaries[].sourcePEFundID/sourcePEDealID | post-fund exit parent asset | P3-7 deal status/lifecycle must reconcile |
| maSubsidiaries commercialization spinout row | missing ownership/class/votes; valuation=1M is not equity evidence | unresolved relationship/economic fraction; never infer100% or regenerate identity from bounded60 history |
| maSubsidiaries[].id/acquisitionDealID | acquired-company provenance | accepted completed deal establishes whole-target acquisition scope when source evidence complete; not valuation / price alone |
| listed subsidiaries[].ownership | economic fraction | voting unknown absent class/denominator proof |
| subsidiaries[].internalVentureID + internalVentures[].spunOffSubsidiaryID | internal-venture spin-off; explicit ownership field on subsidiary | require unique reciprocal links and spun-off source status; operational venture is historical transferred source, not a second legal asset |
| subsidiaries[].sourceCompetitorID | installed competitor-parity acquisition; subsidiary has explicit ownership | unique current sub ID and source competitor provenance only; current competitor need not survive acquisition; never bind by name/domain or replay an acquisition |
| subsidiaries[].id with no retained upstream provenance | legacy parity/respondToCompetitor acquisition and other orphan rows | retain source-scoped standalone subsidiary evidence; do not manufacture a competitor/startup alias or complete parent-generation proof |
| subsidiaries[].restructuredFrom/restructuredWeek | replacement subsidiary created by group restructuring | validate unique replacement/source IDs, no cycles or still-live predecessor duplication; inherited startup/PE/venture fields alone cannot alias the replacement to a predecessor |
| overseasSubsidiaries[].id | separate overseas corporate/operating source family created by openOverseas | include observed/unsupported relationship coverage; no explicit ownership/class/votes on writer row, so economic fraction and rights remain unknown |
Acquisition price, valuation, totalCarryingValue, carryingBookValue and goodwill are different measures, none is a share count.

## 4. Dependencies

P3-1/2 + shared identity index. Source-specific P3-7/8 resolver evidence feeds this adapter, with central composition avoiding recursive adapter calls. Read-only work can run alongside P3-4 without masking blockers. #994 must be reverified before any M&A issuer authority adoption; adapter fixtures must characterize both old and fixed issuance without repairing either.

## 5. Entity / Ownership Data Model

Proposed relationship edge: `{edgeId,parentEntityId,childEntityId,beneficialOwnerEntityId,economicFraction,votingFraction:null,kind:'direct',sourceRefs,aliasOf,status}`. NCI = 1−known complete parent's economic share only for a complete single economic class; otherwise unknown. M&A completed full-target deal can carry `economicFraction:1` with explicit whole-acquisition source evidence and zero unexplained residual; a legacy row alone stays unknown. No `sub.issuedShares`/treasury fields are invented. Parent owns subsidiary; founder owns parent, not subsidiary directly.

## 6. API / Function Contracts

Proposed `projectSubsidiaryRelationships(rawState, identityIndex)` → AdapterResult with direct edges and alias claims. Resolve startupID, reciprocal peDealID/subsidiaryID and reciprocal PE conversion links, then completed acquisitionDealID/targetID. Also inspect internalVentureID/reciprocal spunOffSubsidiaryID, sourceCompetitorID, standalone durable sub IDs and restructuring/overseas families from §3. Apply restructuring lifecycle before generic inherited alias fields: the merger copies one predecessor row, so its retained startupID/peDealID/internalVentureID is not proof the replacement is the same issuer. Preserve each predecessor source as historical only when lifecycle evidence is complete; ambiguous/live duplicates quarantine the claim. Lost bounded history cannot be reconstructed from names, derived-ID syntax or valuations. An overseas row is visible in source coverage/unresolved direct relationship evidence even while ownership remains unsupported. Check all duplicates and lifecycle conflicts before choosing a canonical source. Agreement produces one edge + alias source refs; disagreement yields `ALIAS_CONFLICT` and an unresolved relationship, not max/min or first-row wins. Proposed `traceIndirectEconomicInterest(graph,root,target)` returns paths and products only on a validated acyclic complete graph. Cycles/cross-holdings return unknown with `CYCLE_UNSUPPORTED`; no repeated path addition, matrix inversion or geometric-series ownership. Direct edge remains observable if itself sound.

## 7. Input / Output Examples

Startup s1 ownedCompany=.6, ownedPersonal=.1 and sub {startupID:s1,ownership:.6}: one company→s1 edge .6 and separate founder→s1 .1; remaining economic .3 only if cap-table evidence complete, votes unknown. Legacy PE d1 with ownershipRatio=.7 and matching sub mirror .7 → one .7 edge, not 1.4. Parent .8 of A, A .5 of B with complete known edges: diagnostic path .4; no vote delegation. A→B→A → unknown indirect interest. Sold parent/refounded slot with no generation proof → unresolved, not new-company ownership.

## 8. Invariants

One underlying position per issuer/class/holder/generation. Identity aliases do not multiply edges; exited/sold/liquidated relationships are historical, not current assets. Parent-level equity already contains subsidiary value: founder wealth cannot add the look-through asset again. Treasury/non-voting rights never derived from a valuation. Whole-target evidence does not create voting evidence for unknown share classes.

## 9. Unsupported / Unknown Cases

Commercialization spinouts lacking ownership/retained source provenance, duplicate/reused derived IDs or lost bounded history; productVentures/newBusinesses operational assets are not automatically legal issuers; overseasSubsidiaries has no explicit source ownership/class/vote fields; retain observed source coverage and unresolved direct relationship evidence, with authoritative ownership adoption unsupported, never silently drop the family. Legacy M&A rows lacking completed-deal provenance; mismatch between startup.ownedCompany and sub.ownership; duplicate startup IDs; missing reciprocal PE transfer; sold company generations; cross-holdings; listed flag without class rights; minority preference terms. Preserve evidence and reject new control capability. Do not “fix” #979 legacy broken books or choose #976 dividend accounting.

## 10. Save / Transaction / RNG Boundary

The API accepts raw immutable JSON data, never an engine instance. Validate own data descriptors before traversing: accessors, cyclic objects, exotic prototypes, non-finite values and malformed maps return explicit issues; never execute getters. Never call production `ensure`, `normalize`, `save`, `emit`, `finance.event`, stateful preview or settlement helpers. No host/simulation RNG, wall clock, ID counter, source sort, persistence, pending-write flush or source-reference escape. Deep-freeze newly allocated output only. Same input returns deeply equal deterministically ordered output; reading twice is idempotent without receipts. No full-state clone to run a mutating helper.

## 11. Legacy Compatibility

Keep effective saveVersion=9 and SAVE_KEY=capitalism_tycoon_web_v1; `save-v9.js` supplies the installed version despite engine.js's historical base constant. Add no saved root, adoption marker, normalization or repair. Missing optional collections may mean empty only where existing contract explicitly permits; present malformed data is invalid. Preserve original data and issue source paths. Array index may locate a diagnostic, never establish identity. Compaction/load/import cases with lost identity stay unresolved; do not recreate history.

## 12. Integration Points

P3-5 resolves a market instrument to an existing subsidiary issuer only by explicit durable linkage; ticker text is insufficient. P3-7/8 supply canonical underlying interests, P3-6 supplies hierarchy. P3-9 consumes proven direct voting evidence only. Book/EV/equity valuation comes later as a tagged observation, never feeds back into relationship creation. Installed acquisition/finance wrappers remain unchanged.

## 13. UI Contract

Relationship view identifies direct holder, indirect path and unresolved minority/voting status. A hierarchy row is not a second asset card. Do not expose acquisition/disposal commands from this adapter. No automatic founder aggregation of company holdings.

## 14. Tests / CI / WebKit

Extend existing `tests/phase3-ownership-projection-test.js` and `tests/phase3-ownership-reconciliation-test.js` for shared purity/identity/conservation fixtures; do not duplicate their harness. Add a focused adapter test only for new family behavior, register it in `tests/run-all.js` and `tests/run-all-shards.json` with shard contract verification. Run immutable input/output, malformed/unknown, insertion-order permutation, cross-account separation and no host/simulation RNG tests. Existing tests are characterization, not proof of an unimplemented API. CI: Test canonical A–L + aggregate `test`, Phase 0.5 Acceptance Smoke and all other applicable workflows. New browser/UI integration needs actual iPhone-emulated WebKit, reload and fresh durable hydration, with tested HEAD and job/artifact recorded; physical iPhone is separate. Docs-only PR CI cannot prove future adapter behavior.
Reuse `tests/finance-startup-subsidiary-test.js`, `tests/pe-dual-ownership-test.js`, `tests/ma-share-swap-ownership-ratios-test.js`, `tests/make-subsidiary-save-atomicity-test.js`, `tests/ma-subsidiary-sale-save-atomicity-test.js`; #994's `tests/ma-equity-raise-ownership-ratios-test.js` exists only on that PR, not the audited main. Candidate adapter-specific test: `tests/phase3-subsidiary-relationships-test.js`, covering lifecycle/aliases, two accounts, cyclic graph, M&A orphan, commercialization spinout missing/duplicate IDs/lost history and sold/refounded company. Reuse tests/new-business-commercialization-test.js, tests/new-business-commercialization-accounting-test.js, tests/new-business-spinout-valuation-exploit-test.js, tests/new-business-spinout-finite-state-test.js and tests/new-business-spinout-legacy-backfill-test.js as existing characterization candidates; reader never calls ensure/backfill.

Additional source/lifecycle fixtures: internal venture reciprocal spin-off and transferred source (tests/internal-venture-business-test.js); installed and legacy competitor acquisition with/without retained sourceCompetitorID (tests/competitor-parity-compatibility-test.js); restructuring replacement with copied predecessor aliases, live duplicate predecessor, lost history, sale/liquidation (tests/group-restructuring-candidates-test.js and tests/group-restructuring-progress-test.js); overseas unique/missing/duplicate IDs and unknown ownership (tests/overseas-repatriation-test.js characterizes source family, not the proposed adapter). Every source may be observed or explicitly unresolved; enumeration is not approval to infer ownership or control.

## 15. Migration and Cutover Restrictions

This slice may represent legacy facts before P3-4 completes, only as a pure opt-in read model with no live consumer replacement. New API names do not mean an existing authority moved. Existing trading, acquisition, distributions and financing remain authoritative in their current modules. No new registry, settlement writer, quantity repair, schema/version change or automatic backfill. A later cutover requires its own Owner approval, complete writer inventory and failure evidence.

## 16. Risks and Findings

R-P36-01: aliases across PE/VC and subsidiaries duplicate economic value unless composition chooses one canonical interest. Resolved in proposed shared alias policy; contradictions quarantine. R-P36-02: M&A equity issuance bug in #994 remains a current integration prerequisite, not an adapter fix. #976/#979 retained as accounting/legacy policy dependencies. No new executed P1 claimed.

## 17. Acceptance Criteria

Direct sources fully enumerated with installed wrappers; canonical interests and relationship edges never counted twice; no inferred votes; cyclic/unknown graph explicit; main/#994 difference documented; legacy save untouched. Pure adapter can be READY WITH CONDITIONS independently of stopped P3-4; executable adoption cannot.

## 18. Owner Decisions

Approve pure adapter implementation separately. Unknown historical M&A ownership and #979 repair require explicit decisions before any backfill; conservative unknown has no economic policy effect. #976 remains a separate Owner accounting decision, not resolved by hierarchy design.

## 19. Implementation Slices

1 adapter/alias test PR after shared index; optional later indirect-path diagnostics PR (no control). Listed-subsidiary voting adoption is separate and conditional, not included in these counts. Integration editor serializes economic-read-model.js changes with P3-5/7/8.

## 20. Definition of Done

All twenty-section contract requirements and cross-slice invariants implemented/tested in separately approved PRs; direct and indirect results explainable; P3-4 and Phase 10 boundaries unchanged. Design acceptance does not mark P3-6 implementation complete.
