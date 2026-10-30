# P3-4: listed subsidiary control action evidence (W-SUB-CONTROL)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`js/listed-subsidiary-control-actions.js` installs two commands, each in one transaction:

- `launchListedSubsidiaryTenderOffer(id)` raises the parent's stake in a listed subsidiary to 90% at the listed
  valuation plus an 18% premium;
- `squeezeOutListedSubsidiary(id)` requires a stake of at least 90%, buys the rest to 100% at an 8% premium and
  delists the subsidiary (`delistingReason: 'squeezeOut'`).

Both price the stake gap as `ceilYen(round(valuation × gap) × (1 + premium))` (R6), pay it from company cash, add it
to the parent's book (`carryingBookValue`), write a `listedSubsidiaryControlHistory` row and post one `assetPurchase`
ledger row (cash −price, asset +price). Either action is refused without enough company cash or when there is no
stake gap.

## Pinned inputs

`tests/fixtures/subsidiary-control-atomicity.js` lists a subsidiary through the production prepared IPO (the
W-SUB-IPO fixture, `balanced` terms, 55% parent stake after the IPO). Variants:

| Variant | Start state | Command |
| --- | --- | --- |
| `tob` | listed, 55% | `launchListedSubsidiaryTenderOffer` (55% → 90%) |
| `squeeze` | after the installed tender offer, 90% | `squeezeOutListedSubsidiary` (90% → 100%, delisted) |

## Faults and oracles

`tests/subsidiary-control-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- per variant, all nine shared faults (the commands emit `notify`, `saved` and `change`), plus queued-predecessor and
  nested `save-false` / `save-throw` on `squeeze`;
- each failure: full live rollback including RNG, unchanged mirror/cache/durable bytes, cancelled failed put,
  production reload and fresh durable-only hydration, a recovery save above every allocated failed sequence, and a
  retry that commits the action once;
- success oracle, computed independently of the module's preview: company cash down by the whole-yen price, founder
  cash unchanged, the stake at the target, the book up by the price, listing status (still listed after the tender
  offer; delisted with week and reason after the squeeze-out), the subsidiary itself unchanged, the full history row,
  exactly one whole-yen `assetPurchase` row with its source and operation IDs, `finance.validate` and standalone
  close;
- the uninterrupted action commits once in `notify -> saved -> change` order; a replay is identical; a v9 critical
  compaction keeps the stake, book and listing status;
- refusals with no change, no save and unchanged durable bytes: a repeated action, a tender offer on the delisted
  subsidiary, a squeeze-out from 55%, and a tender offer without enough company cash;
- three negative controls are rejected: a disabled rollback, company cash off by ¥1 and a book off by ¥1.

Production mutants (not committed) that the test rejects: a floored price, the squeeze-out price not added to the
book, a squeeze-out stopping at 99%.

## Limits

This does not certify follow-on, relisting, raw/helper
bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.

## Native WebKit / IndexedDB counterpart

`tests/subsidiary-control-save-atomicity-webkit-test.js` runs the same pinned `tob` and `squeeze` states in the
installed page (emulated iPhone 13 WebKit, real IndexedDB) through the installed `launchListedSubsidiaryTenderOffer`
and `squeezeOutListedSubsidiary`. A page-side observer requires the actual control payment of the pinned subsidiary
inside the command's transaction. Per variant: success and all nine shared faults; `squeeze` adds queued-predecessor
and nested `save-false` / `save-throw` (24 scenarios).

Each failure must leave live state, mirror, cache and durable IndexedDB bytes exactly as before, with a pending
predecessor intact; the recovery save exceeds every allocated failed sequence; the retried action equals the
uninterrupted one; a fresh context with localStorage removed hydrates that state from IndexedDB alone. After each case
the repeated action (and, after the squeeze-out, a tender offer on the delisted subsidiary) is refused without any
change, and is hydrated durable-only too. The page oracle ports the Node `success()`. Three negative controls are
rejected: disabled rollback, company cash one yen off the price and a book one yen short.

It runs in the M&A `sub-listing-atomicity` job after the secondary-sale evidence. Its logic was exercised locally on
Chromium (24 scenarios plus 3 rejected controls); WebKit evidence is the exact HEAD's CI job. No physical-iPhone claim
is made.
