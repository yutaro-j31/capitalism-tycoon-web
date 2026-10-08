# Phase 3 P3-2 — Read-only ownership reconciliation

**Tracker:** #909 / P3-2

**Base main:** `b86f0b52c79ab9384c5919ae584a1fe068d40512` (#911)

**Dependency:** [P3-1 source projection](PHASE_3_P3_1_CONTRACT.md); [conditionally approved entry contract](PHASE_3_ENTRY_CONTRACT.md).

## Scope and authority

`economicReadModel.ownershipReconciliation(state)` is an opt-in pure diagnostic of the one legacy player common class and its identified founder source buckets. It consumes P3-1 source evidence, reuses the Phase 1 issuer/person/class IDs and adds no persisted root, writer, UI consumer or settlement. Existing `snapshot`, `compareLegacyParity`, `ownershipProjection`, their versions, legacy ownership ratios and all engine commands retain their behavior. No control capability, valuation or accounting event is created.

The result's `ok` means only the stated read-only scope reconciles. It is not a complete shareholder registry, evidence of external beneficial identity, eligibility or execution permission. Valid unresolved company/external aliases retain null issuer/class and legal-account attribution; they are never added to founder shares or adopted as treasury. Malformed aliases remain explicit source issues and make the diagnostic fail closed. The unallocated residual is a class-level quantity, not a fabricated named holder/transaction or permission to aggregate another legal account.

## Quantity and deduplication contract

- Issued quantity is `sharesOut`; treasury quantity is `treasuryBuybackShares` (old missing/null optional field defaults to zero only in the projection); outstanding is issued minus treasury. ECO-010 requires finite nonnegative in-envelope quantities and exact Number equality `issued = treasury + outstanding`.
- `founderShares` and the P1-designated `personalStocks[state.ticker].qty` source buckets are aggregated once into one stable `beneficial:player-company:founder` row. Source rows/IDs remain evidence, not additional beneficial assets. Treasury is excluded. Company-account aliases and other personally held instruments do not join the founder row.
- ECO-011 checks distinct source IDs/paths, known class/founder bindings, founder quantity at most outstanding, and `founder + unallocated = outstanding`. The unallocated quantity is outstanding minus identified founder quantity. This does not certify unidentified external ownership or infer joint/family/trust control.
- P3-1 required-row/quantity validation is retained. Derived negative/non-finite/out-of-envelope quantities return null + issues. An error-free TwoSum residual detects precision loss in each addition/subtraction (including a small fractional source next to a large quantity); a nonzero residual returns null + explicit precision-loss issue. Unknown source quantities cannot be summed as zero. Source values are never coerced, clamped, rounded or repaired. Legacy fractional source evidence is retained for this read-only Number diagnostic; non-exact arithmetic/negative residuals fail instead of receiving EPSILON forgiveness. This does not authorize fractional settlement or threshold comparisons.
- Zero issued/outstanding with zero holdings can reconcile arithmetically; it grants no voting/control entitlement. Later eligibility contracts must require their own denominator/status/rights evidence.
- Output records, arrays and nested source metadata are frozen and deterministically ordered. Reads of fully frozen state preserve whole state, ledger, both host/simulation RNG and save v9/key. Private/public/renaming transitions retain identity; the approved designated player slot remains the only personal-own-share binding.

## Existing writer and save investigation

The observed legacy sources remain in engine initial/normalize/load, IPO, stock buy/sell and share-swap issuance; expansion founder sale/stock split/equity-offer acceptance; shareholder-returns buyback; M&A acquisition financing and player crisis/sponsor/turnaround issuance. Personal-stock-margin forced settlement can change the personal source bucket. App stock/founder/split actions call those installed methods. P2 buyback reconciliation/receipts and dividend distribution retain their approved legacy scope. Convertible-bond dilution uses its distinct sharesOutstanding/totalShares fields, not this player sharesOut source. The Phase 0.5 inventory is an index, not a complete adoption proof.

P1 already combines personally acquired own-company shares into its founder summary and excludes them from generic personal market holdings; P3-2 tests quantity parity against that independent public API. Legacy gameplay `founderOwnershipRatio` is not silently replaced by beneficial ownership. Save-v9, holding-map normalization, storage compaction/import/load and existing wrapper/transaction boundaries remain authoritative. Missing old optional fields are read without writing defaults; present malformed evidence fails diagnostics. Nonzero personally acquired holdings survive compacted reload.

P3-3 separately supplies a complete writer/call-site/adoption and old-save/rollback/idempotency contract before P3-4 authority migration. Phase 9/10/13/14 settlement, command entitlement, credit/progression/wealth consumers and other issuer-family adapters remain outside this slice.

## Acceptance evidence required

Production-module targeted tests cover known quantities and one beneficial row, source/legal-account separation, treasury exclusion, independent P1 parity/generic-own-share dedup, invalid/impossible/overflow/precision states, frozen-state/output and whole-state/RNG purity, map ordering and stable identity, actual buy/sell/split observation, old-v9 optional fields and nonzero compacted reload. Canonical registration/shard checks, save compatibility, P1/P2 Permanent Gates and appropriate full CI/WebKit must pass. Independent actual-diff A–L audit, final main/CI review, Gate PASS and post-merge CI are required before completion is recorded.
