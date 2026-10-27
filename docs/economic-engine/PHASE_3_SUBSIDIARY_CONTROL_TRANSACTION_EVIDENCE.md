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

Node only; a native-WebKit counterpart is the next slice. This does not certify follow-on, relisting, raw/helper
bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
