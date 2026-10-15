# P3-5 — External Listed Holdings Read-only Adapter

**DESIGN PROPOSAL — implementation and merge require Owner approval.**

Audited production main: `743d08d1867f453fe09c61e1fd5312c846cfc1eb` (2026-10-15 JST). CODE facts below describe that SHA; proposed APIs/fields are explicitly new, not existing production interfaces. No production implementation, registry adoption, schema change, cutover, Phase 3 Exit or Phase 4 Entry is authorized by this document.

Repository precedence follows the approved Roadmap. Current source establishes observed production facts; approved target contracts establish required future behavior. Discrepancies must be logged, never silently adopted as new policy. Required references: Owner instruction and approved [Entry](PHASE_3_ENTRY_CONTRACT.md), [P3-1](PHASE_3_P3_1_CONTRACT.md), [P3-2](PHASE_3_P3_2_CONTRACT.md), [P3-3](PHASE_3_P3_3_CONTRACT.md), [Roadmap](ECONOMIC_ENGINE_ROADMAP.md) and [dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md). Shared proposed types, identity rules and reason codes are specified in `PHASE_3_CROSS_SLICE_ARCHITECTURE.md` (companion cross-slice PR; dependency must merge first).

## 1. Goal / Scope

Represent external listed stock positions without changing Phase 9 pricing, quotes, fills, fees, dividends or settlement. Return source positions, issuer/class evidence and unresolved bindings, not a complete shareholder register or executable rights.

## 2. Current Production State

CODE: `js/economic-read-model.js::marketHoldings`, `ownershipProjection` and `ownershipReconciliation` currently leave external aliases unresolved. `js/engine.js::stock` looks up `market[].id`; buyStock/sellStock mutate the appropriate holding map. `js/expansion.js::stockSplit` scales `market.issuedShares`, both maps and player buckets for the designated ticker. `engine.listStartup` writes `startups[].ipoStockID`, creates a market row and converts fractions to map quantities. No persistent general issuer-generation/alias registry exists.

## 3. Existing Source-of-truth

| Fact | Production source | Reader treatment |
|---|---|---|
| Personal / company quantity and cost | personalStocks[key].qty/avg; companyStocks[key].qty/avg | separate legal accounts; avg is cost, not votes |
| Market instrument / price | market[].id/price/issuedShares | listing observation, not proof of all rights |
| Player own holding | personalStocks[state.ticker] | P3-2 founder bucket, excluded from external positions |
| VC listing identity | startup.id + ipoStockID → unique market.id | preserve startup issuer identity; class transition explicit |
| Delisting | market privateCompany/suspended and retained row | status observation, never delete holding |
No field `market.issuerEntityId` or `market.treasuryShares` is assumed to exist.

## 4. Dependencies

P3-1/2 stable player IDs and common shared snapshot contract. No runtime dependency on P3-4 cutover: isolated read-only implementation can start after design approval. P3-8 supplies VC source evidence; resolve VC links in the shared identity-index builder so adapters have no circular dependency. P3-6 supplies subsidiary aliases only when an explicit durable link exists.

## 5. Entity / Ownership Data Model

Proposed ListingObservation: `{instrumentAlias, issuerEntityId, securityClassId, listingStatus, issued, treasury, outstanding, rightsStatus, sourceRefs}`. Proposed position has registeredHolderEntityId and beneficialOwnerEntityId: founder for personal map; current player-company reference for company map, subject to generation validity. Quantity is validated finite nonnegative legacy Number, not invented integer shares. Economic fraction is quantity/outstanding only with a proven class/denominator; voting remains null unless explicit rights evidence. Personal and company holdings of the same issuer are distinct positions and cannot be pooled for permissions.

## 6. API / Function Contracts

Proposed `projectExternalListedHoldings(rawState, identityIndex)` → frozen AdapterResult. Identity index must match the exact source snapshot, with an opaque read-time snapshot token; stale index rejects. Iterate sorted holding keys once and indexed market matches. Resolution precedence: designated player binding (route away), unique startup IPO provenance, explicit mapped durable issuer/class binding, otherwise unresolved. A unique raw market.id creates a listing observation but does not by itself prove durable issuer identity across ticker reuse. Duplicate market IDs, multiple startups sharing ipoStockID, conflicting player/VC bindings or uncertain company generation quarantine all affected bindings. Output retains unresolved registered-account quantity even when issuer/class are null. Never match by name, sector, marketCap or price.

## 7. Input / Output Examples

Input: personalStocks.X={qty:20,avg:90}, companyStocks.X={qty:30,avg:95}, market row X. Without issuer provenance: two unresolved account rows, reason `IDENTITY_UNPROVEN`, not one 50-share founder position. With an explicit approved issuer/class binding and outstanding 1,000: economic fractions .02 and .03 separately; votes null without rights evidence. VC startup s1 with unique ipoStockID V1234 and zero old stakes resolves V1234 to startup s1's issuer, while its original share-class identity remains unknown unless conversion evidence proves continuity. Two startups referencing V1234 → ALIAS_CONFLICT.

## 8. Invariants

One source path contributes once. Source lots are evidence only; company-own-ticker positions are unresolved, never treasury. Existing founder personal-own bucket is omitted from this adapter and referenced to P3-2. issued = treasury + outstanding is checked only where each term has evidence; absent treasury for an external issuer is unknown, not zero. Quantity beyond a proven outstanding denominator fails. Ticker/name changes cannot manufacture a new beneficial asset or silently attach an old asset to a new issuer.

## 9. Unsupported / Unknown Cases

Unknown external rights/classes, missing issuer-generation history, reused ticker with no lifecycle evidence, delisted missing market row, duplicate market IDs, negative/string/nonfinite quantities and company-own ticker. `market.issuedShares` alone is insufficient to infer treasury=0, ordinary voting or outstanding. Unsupported positions remain visible as unvalued/unresolved evidence; no removal or guessed zero value.

## 10. Save / Transaction / RNG Boundary

The API accepts raw immutable JSON data, never an engine instance. Validate own data descriptors before traversing: accessors, cyclic objects, exotic prototypes, non-finite values and malformed maps return explicit issues; never execute getters. Never call production `ensure`, `normalize`, `save`, `emit`, `finance.event`, stateful preview or settlement helpers. No host/simulation RNG, wall clock, ID counter, source sort, persistence, pending-write flush or source-reference escape. Deep-freeze newly allocated output only. Same input returns deeply equal deterministically ordered output; reading twice is idempotent without receipts. No full-state clone to run a mutating helper.

## 11. Legacy Compatibility

Keep effective saveVersion=9 and SAVE_KEY=capitalism_tycoon_web_v1; `save-v9.js` supplies the installed version despite engine.js's historical base constant. Add no saved root, adoption marker, normalization or repair. Missing optional collections may mean empty only where existing contract explicitly permits; present malformed data is invalid. Preserve original data and issue source paths. Array index may locate a diagnostic, never establish identity. Compaction/load/import cases with lost identity stay unresolved; do not recreate history.

## 12. Integration Points

Opt-in extension of the existing economicReadModel module preferred; internal listing-index builder feeds P3-5 and P3-8. Existing public snapshot/version and P3-1/2 outputs unchanged. A combined snapshot contains explicit `resolvedByAdapter` links so the legacy unresolved row is replaced in a view, never summed beside its resolved position. P3-11 consumes only deduplicated beneficial positions.

## 13. UI Contract

Future position view shows account, quantity, issuer resolution, price source and rights evidence separately. Unknown percentage displays “不明”, not 0%. No new trade/control buttons. Ticker is a label; UI keys use position ID, never ticker alone.

## 14. Tests / CI / WebKit

Extend existing `tests/phase3-ownership-projection-test.js` and `tests/phase3-ownership-reconciliation-test.js` for shared purity/identity/conservation fixtures; do not duplicate their harness. Add a focused adapter test only for new family behavior, register it in `tests/run-all.js` and `tests/run-all-shards.json` with shard contract verification. Run immutable input/output, malformed/unknown, insertion-order permutation, cross-account separation and no host/simulation RNG tests. Existing tests are characterization, not proof of an unimplemented API. CI: Test canonical A–L + aggregate `test`, Phase 0.5 Acceptance Smoke and all other applicable workflows. New browser/UI integration needs actual iPhone-emulated WebKit, reload and fresh durable hydration, with tested HEAD and job/artifact recorded; physical iPhone is separate. Docs-only PR CI cannot prove future adapter behavior.
Reuse `tests/stock-split-price-history-test.js`, `tests/stock-purchase-save-atomicity-test.js`, `tests/stock-sale-save-atomicity-test.js` for unchanged installed writers. Candidate new `tests/phase3-listed-holdings-adapter-test.js`: orphan market row; ticker collision/reuse; IPO floor conversion; split/delist; own alias; conflicting source adapters; old save with no treasury. These new tests are DESIGN, not present or executed.

## 15. Migration and Cutover Restrictions

This slice may represent legacy facts before P3-4 completes, only as a pure opt-in read model with no live consumer replacement. New API names do not mean an existing authority moved. Existing trading, acquisition, distributions and financing remain authoritative in their current modules. No new registry, settlement writer, quantity repair, schema/version change or automatic backfill. A later cutover requires its own Owner approval, complete writer inventory and failure evidence.

## 16. Risks and Findings

R-P35-01 (P2 design risk): market ID is a listing alias, not demonstrated permanent legal identity. Conservative unresolved output prevents false voting grants but limits coverage. R-P35-02: enriching old unresolved rows without replacement metadata would double count. Required shared ownership-key dedup resolves it in design. Neither is a newly reproduced P1 writer defect.

## 17. Acceptance Criteria

No state/save/RNG changes on all fixtures; separate account attribution; every positive source quantity appears exactly once as resolved or unresolved; evidence-backed identity and class continuity; no inferred votes/treasury; preserved P1/P2 API shapes; successful canonical and relevant writer gates. Coverage is reported with unresolved counts; no claim that all external issuers now support control.

## 18. Owner Decisions

Owner implementation approval for this pure adapter is still required. No new economic decision needed to ship conservative unresolved evidence. Improving external ordinary-class voting coverage or persisted alias history requires a separate evidence/adoption contract; do not silently decide it here.

## 19. Implementation Slices

1 implementation PR for listing index + adapter + family tests, after shared identity/types approval. Prefer one editor for economic-read-model.js. UI display may be a separate optional PR. Refresh main, #994 and P3-4 before integration; no settlement change included.

## 20. Definition of Done

Contract accepted; adapter and test implementation reviewed separately; planned tests actually executed; latest-head applicable CI terminal success; evidence ledger complete and independent reviewer findings disposed. This document alone is design readiness, not implementation DoD.

