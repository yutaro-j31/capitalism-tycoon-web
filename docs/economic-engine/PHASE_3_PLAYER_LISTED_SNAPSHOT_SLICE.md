# Phase 3 player/listed ownership snapshot integration slice

Status: partial opt-in implementation; dependent on #995, #996 and #1019. Stage F.

This PR composes the existing player ownership reconciliation and external listed
holdings adapter. It does not replace an authoritative writer or an existing UI
consumer. P3-5 and Phase 3 are not functionally complete.

## API and evidence boundary

- `buildOwnershipIdentityIndex(rawState)` returns an opaque, frozen index.
- `projectOwnershipSnapshot(rawState, optionalIndex)` composes evidence once.
- `projectExternalListedHoldings(rawState, commonIndex)` shares the same token.
- Both readers reject forged, foreign-object or stale ownership indexes.
- The transient `sourceSnapshotToken` identifies the index's immutable **selected
  ownership source view**, scoped as `player-and-listed-ownership-v2`. It is not
  persisted and cannot certify a financial snapshot, valuation, cash or debt.
- Selected inputs are ticker, company serial/sold status, market identity/listing
  flags and strict price/issued observations, startup IPO identity/stakes, personal/company stock maps, player names,
  public-company flag, issued/treasury/founder quantities and week. Histories,
  unrelated company operations and financial balances
  are not captured. Stock-map records (including cost evidence) are captured.
- Blank/whitespace ticker and invalid alias inventories produce an explicitly
  invalid composition with no positions/classes/replacements. The standalone
  listed adapter retains its partial source diagnostics; no combined player
  class is claimed from that partial inventory.
- Global `complete`, `commandEligible`, and `wealthComplete` remain false.
  Subsidiary/M&A, PE, VC, control and wealth coverage is explicitly unimplemented.

## Deduplication and generation safety

The listed adapter decides whether the personal own-ticker lot is safely delegated
into P3-2. When delegated, the founder bucket plus personal own lot produce one
position with separate source replacements. Every other stock map key produces
one listed position; P3-1/P3-2 unresolved aliases are replaced, not concatenated.

For an unproven/refounded generation or IPO alias collision, the personal own-ticker
lot remains a separate unresolved listed position. It is excluded from the local
player reconciliation input, preventing it from becoming new-company equity. The
founder subtotal is diagnostic, is labelled unresolved, and has no class/rights
adoption. No source state is edited. Company and personal stock accounts remain
separate. No external share class, issuer rights or denominator is inferred.

## Validation and remaining work

Focused tests cover composition, source deduplication, personal/company separation,
initial and refounded own-ticker handling, malformed-ID alias conflicts, strict
quantities, source-token staleness, getter rejection, frozen owned outputs, source
purity, RNG invariance and v9 JSON reload. Existing adapter and reconciliation
suites remain registered and unchanged.

Price/issued listing observations are added by a separate dependent PR. It does
not implement valuations, full family identity
indexing, financial-snapshot binding, control eligibility or live wealth consumers.
Those require subsequent approved read-only slices. Actual save writers, hydration
and transaction checkpoints are unchanged; their existing permanent gates remain.
Comprehensive long-run/cross-system audits remain Stage Q work.

Merge order: #995 -> #996 -> #1019 -> this PR (base is #1019's branch).
Retarget to main after #1019 merges and verify the final integration again.
No Owner merge approval is inferred for #1019 or this PR.

## Listing observation follow-up (dependent PR)

Snapshot/index version2 extends the selected source view to market price and
issuedShares and adds listingObservations (one per sorted alias, including unheld
listings). This does not adopt a quote/valuation/settlement writer. Strict finite
nonnegative Numbers within MAX_SAFE_INTEGER are retained without coercion or
rounding. Fractional source observations remain diagnostic; they never establish
an integer voting denominator. Missing observations are unknown; invalid values
are invalid/null. Duplicate market aliases quarantine price, issued count and
issuer binding rather than choosing a row. Treasury, outstanding, class and rights
remain unknown. A unique existing IPO-linked position can supply its already
source-scoped issuer; an unheld ticker never fabricates a legal issuer. Private
and suspended observations retain the original holdings. Price/issued mutations
invalidate the common ownership token; financial balances still remain outside
its scope. Legacy standalone adapter output shape remains unchanged.

Merge order extends through #1020 before the observation follow-up. Neither new
PR has Owner merge permission. Full P3-5 completion is not claimed.
