# P3-4: internal venture funding, sale and withdrawal evidence (W-INTERNAL-VENTURE, business)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`js/internal-venture-business.js` installs three commands on a live (developing or commercialised) internal venture.
Each runs in one transaction, posts one ledger row, writes a business history row and emits `notify`, `saved` and
`change`. The venture screen's action buttons call them.

- **`fundInternalVenture(id, amount)`.**
  - Takes ¥1,000,000 to ¥100,000,000, rounded up to whole yen (R6), from company cash.
  - Capitalises the amount in the venture book and invested capital.
  - Lifts the valuation by the amount times a quality/market/risk multiple.
  - Advances a developing venture's progress, commercialising it at 100%.
  - Posts an `assetPurchase` row: cash −amount, asset +amount.
- **`sellInternalVenture(id)`.**
  - The price is the valuation times a quality/market/risk multiple (+8% when commercialised), with a floor of 55% of
    book, rounded up to whole yen.
  - The venture becomes `sold` with its exit price and gain, and its book is removed.
  - Posts an `assetSale` row: cash = price, asset = −book, profit = gain.
- **`withdrawInternalVenture(id)`.** Only a developing venture can be withdrawn.
  - Recovers 5–35% of book, set by progress, quality and risk, rounded up to whole yen.
  - The venture becomes `withdrawn` with its recovery and loss, and its book is removed.
  - Posts an `assetSale` row: cash = recovery, asset = −book, profit = −impairment.

The approved venture book is fractional (the approved budget). The shared ledger keeps effects at ¥0.01 (finance.js
contract §2), so the oracle compares asset and profit effects at that precision. Cash amounts are whole yen.

## Pinned inputs

`tests/fixtures/internal-venture-business-atomicity.js` proposes and approves two ventures with the installed writers,
as in the W-INTERNAL-VENTURE spin-off fixture. It then pins one of two stages: two installed weeks into development
(week 3), or both ventures commercialised with installed weeks (week 26).

| Variant | Stage | Command |
| --- | --- | --- |
| `fundDeveloping` | developing | fund ¥25,000,000 |
| `fundActive` | commercialised | fund ¥10,000,000 |
| `sellActive` | commercialised | sell |
| `sellDeveloping` | developing | sell |
| `withdraw` | developing | withdraw |

## Faults and oracles

`tests/internal-venture-business-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Faults:
  - per variant, all nine shared faults;
  - on `sellActive`, also queued-predecessor and nested `save-false` / `save-throw`.
- Each failure is checked for:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the command once.
- The success oracle is computed independently of the module's previews, from the venture's quality, market potential,
  risk, progress and book:
  - company cash moves by the whole-yen funding, price or recovery;
  - founder cash, the subsidiaries and the other venture are unchanged;
  - funding: book, invested capital, additional funding, valuation lift, rounds, week, progress and status;
  - sale: `sold` status, exit week, price, gain, valuation at exit and a zero book;
  - withdrawal: `withdrawn` status, week, recovery, loss, valuation at exit and a zero book;
  - the full history row;
  - exactly one ledger row with its category, source and operation IDs and effects;
  - `finance.validate` and standalone close pass.
- The uninterrupted command commits once, in `notify -> saved -> change` order.
- A replay is identical.
- After the command, a follow-up is refused with no change, no save and unchanged durable bytes:
  - a second sale or withdrawal of the exited venture;
  - funding below the ¥1,000,000 minimum.
- A v9 critical compaction keeps the venture status, book, valuation, progress, rounds, exit and recovery, and company
  cash.
- Three negative controls are rejected: a disabled rollback, company cash off by ¥1, and a book left on the venture.

The test also rejects three production mutants, which are not committed: funding not capitalised, a floored sale price,
and a floored withdrawal recovery.

## Limits

This does not certify the venture proposal and
approval, spin-off (W-INTERNAL-VENTURE spin-off evidence), subsidiary parent funding or external rounds, raw/helper
bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.

## Native WebKit / IndexedDB counterpart

`tests/internal-venture-business-save-atomicity-webkit-test.js` runs the same five pinned states and commands in the
installed page (emulated iPhone 13 WebKit, real IndexedDB) through the installed `fundInternalVenture`,
`sellInternalVenture` and `withdrawInternalVenture`. A page-side observer requires the actual ledger row of the pinned
venture and command inside the command's transaction. Per variant: success and all nine shared faults; `sellActive`
adds queued-predecessor and nested `save-false` / `save-throw` (54 scenarios).

Each failure must leave live state, mirror, cache and durable IndexedDB bytes exactly as before, with a pending
predecessor intact; the recovery save exceeds every allocated failed sequence; the retried command equals the
uninterrupted one; a fresh context with localStorage removed hydrates that state from IndexedDB alone. After each case
the follow-up command is refused without any change, and is hydrated durable-only too. The page oracle ports the Node
`success()`. Three negative controls are rejected: disabled rollback, company cash one yen over the withdrawal recovery
and a book left on the venture.

It runs in a new M&A `venture-atomicity` job, split from `group-atomicity`, which took 24.5 minutes with six tests on
#1177. Its logic was exercised locally on Chromium (54 scenarios plus 3 rejected controls); WebKit evidence is the exact
HEAD's CI job. No physical-iPhone claim is made.
