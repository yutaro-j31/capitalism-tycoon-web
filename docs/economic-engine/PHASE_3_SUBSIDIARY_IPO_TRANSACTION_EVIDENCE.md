# P3-4: subsidiary IPO evidence (W-SUB-IPO)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`executePreparedSubsidiaryIPO(id)` (the UI entry point) -> the `subsidiary-ipo-preparation.js` wrapper, which runs in
one transaction -> engine `ipoSubsidiary`. The engine lists the subsidiary (ticker, 1,000,000 shares at the pre-money
valuation), sells 15 points of the parent's stake for `ceilYen(valuation × .15)` (contract R6e, #1149) and removes
the sold book pro rata in whole yen. The wrapper then adds the chosen offer term's primary proceeds to the
subsidiary's own cash and valuation, records the offer terms and lock-up, marks the preparation listed, writes the
`listed` history row and starts the listing's market.

## Pinned inputs

`tests/fixtures/subsidiary-ipo-atomicity.js` builds a VC subsidiary with production writers only
(`investStartup` -> `makeSubsidiary`, via the #971 fixture), starts the staged IPO preparation and advances it with
installed weeks to the ready state, then selects the offer term with the installed selector:

| Variant | Offer term |
| --- | --- |
| `balanced` | `balanced` (10% primary, 7% discount, 18-week lock-up) |
| `growth` | `growth` (20% primary, 11% discount, 13-week lock-up) |

## Faults and oracles

`tests/subsidiary-ipo-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- per variant, all nine shared faults (the command emits `notify`, `saved` and `change`), plus queued-predecessor and
  nested `save-false` / `save-throw` on `growth`;
- each failure: full live rollback including RNG, unchanged mirror/cache/durable bytes, cancelled failed put,
  production reload and fresh durable-only hydration, a recovery save above every allocated failed sequence, and a
  retry that commits the listing once;
- success oracle: listed with a `V###` ticker and 1,000,000 shares at the pre-money price; parent stake down 15
  points; sold book `round(book × .15 / stake)` leaves the parent; company cash up by exactly the whole-yen
  proceeds and founder cash unchanged; primary proceeds in the subsidiary's cash and valuation, not the parent's;
  the full recorded offer terms and lock-up week; preparation completed and listed week; the `listed` history row;
  the listing's market started; exactly one whole-yen `ipoSubsidiary` row (amount and cash = proceeds, asset
  `−soldBook`, profit `proceeds − soldBook`); news, `finance.validate` and standalone close;
- the uninterrupted listing commits once in `notify -> saved -> change` order; a replay of the same prepared state
  lists identically; a second listing is refused with no economic change and no save; a v9 critical compaction keeps
  the listing;
- three negative controls are rejected: a disabled rollback, company cash off by ¥1, and primary proceeds missing from
  the subsidiary.

Production mutants (not committed) that the test rejects: fractional secondary proceeds, primary proceeds not paid
to the subsidiary, sold book not pro rata to the stake.

## Limits

This does not certify the IPO secondary sale, control
actions, follow-on or relisting, raw/helper bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4
Entry.

## Native WebKit / IndexedDB counterpart

`tests/subsidiary-ipo-save-atomicity-webkit-test.js` runs the same prepared `balanced` and `growth` states in the
installed page (emulated iPhone 13 WebKit, real IndexedDB) through `executePreparedSubsidiaryIPO`. A page-side
observer requires the engine's actual `ipoSubsidiary` ledger posting inside the listing transaction. Per variant:
success and all nine shared faults (`notify` and `change` included, since the command emits them); `growth` adds
queued-predecessor and nested `save-false` / `save-throw` (24 scenarios).

Each failure must leave live state, mirror, cache and durable IndexedDB bytes exactly as before, with a pending
predecessor intact; the recovery save exceeds every allocated failed sequence; the retried listing equals the
uninterrupted one; a fresh context with localStorage removed hydrates that state from IndexedDB alone. After each case
a second listing is refused with no state change, no save and unchanged durable bytes, and is hydrated durable-only
too. The page oracle ports the Node `success()`. Three negative controls are rejected: disabled rollback, company cash
off by ¥1 and primary proceeds missing from the subsidiary.

It runs in the M&A `sub-listing-atomicity` job (split from `vc-secondary-atomicity` for its job budget). Its logic was exercised
locally on Chromium (24 scenarios plus 3 rejected controls); WebKit evidence is the exact HEAD's CI job. No
physical-iPhone claim is made.
