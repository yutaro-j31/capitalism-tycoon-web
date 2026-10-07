# P3-1 — Read-only ownership identity projection

Source: conditionally approved [Phase 3 entry contract](PHASE_3_ENTRY_CONTRACT.md) / [#909](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/909). Implementation base: `6ee26ce38793f81f53e75e35bf344c79027b3d1a` (P3-0 #910, post-merge CI green).

## Boundary and API

`economicReadModel.ownershipProjection(state)` is an opt-in, pure read-only API in the existing production module. The existing P1 `snapshot`, `compareLegacyParity` and read-model version remain unchanged. No engine/UI/settlement consumer is cut over.

The projection returns frozen entities, security classes, identified founder source-bucket holdings, unresolved aliases and input issues. It is marked `authority: read-only` and `reconciliationStatus: not-evaluated`. It is source evidence, not a complete shareholder registry, accounting asset list, control eligibility or execution authorization.

- Reuse P1 `entity:company:player`, `entity:person:founder` and `security:player-company:common` IDs. Names and tickers are display/source references, not identity keys.
- The legacy player issuer is modeled as one common class with one voting/economic unit per share. This is explicit evidence from the player model, not an inferred rights profile for other issuers. Issued/treasury quantities come from `sharesOut` / `treasuryBuybackShares` with source paths.
- `founderShares` is the identified founder holding source bucket. The already-adopted P1 player-instrument binding `personalStocks[state.ticker]` supplies a separate personal-acquisition source bucket. Both retain stable holding IDs across renaming/listing/ticker changes. Source buckets are not invented historical purchase lots or settlement receipts.
- Treasury is class evidence only; it does not become a founder holding or a personal asset. No external-holder identities, residual allocation, ownership percentages, wealth valuations or capabilities are manufactured.
- External `companyStocks` / `personalStocks` aliases remain unresolved with source path, known registered-account holder, null issuer/class and explicit reason. Company-account own-ticker aliases are also unresolved: they do not silently become treasury or founder holdings. Same-name market records do not resolve aliases. Other issuer-family adapters are later slices.
- Return a deterministic order independent of holding-map insertion order; no wall-clock, host/simulation RNG, counter or persisted ID allocation. No mutable source references escape in the result.
- Required quantities that are missing, non-numeric, non-finite, negative or outside the safe Number quantity envelope produce null evidence and explicit issues, never clamping/coercion. Finite fractional legacy quantities are retained without rounding. Optional absent/null treasury defaults to zero with an explicit default flag; absent/null holding maps or an absent own holding mean zero source holdings, as in P1. Present malformed maps/rows/quantities remain invalid. Missing designated player ticker leaves own-stock evidence unknown.

## Authority, compatibility and tests

All current issue/sale/buyback/IPO/personal-stock/finance writers and wrappers remain authoritative. This reader makes no writes, accounting recognition, normalization, save/emit calls or command grants; rollback/idempotency behavior therefore remains with existing operations. There is no persisted registry root, SAVE_KEY/saveVersion change, migration, module/UI wiring change or advancement of Phase 9/10/13/14 settlement authority.

P3-2 separately proves issued/treasury/outstanding conservation, beneficial deduplication and complete legacy parity. P3-3 separately defines the complete adoption/writer contract. Do not use a P3-1 source bucket as proof of reconciled control or as an additional asset alongside P1 ownership summary.

Acceptance: production module exposes the API; P1 identity reuse and source paths; stable IDs through private/public/name/ticker changes; deterministic map order; whole-state/RNG unchanged; deep-frozen output; old optional fields/compacted reload without registry persistence; invalid/missing evidence and unresolved aliases explicitly fail closed. Canonical tests register `tests/phase3-ownership-projection-test.js`; prior P1/P2/read-model/save/module gates remain required.
