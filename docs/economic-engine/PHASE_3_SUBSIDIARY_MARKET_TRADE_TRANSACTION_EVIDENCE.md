# P3-4: listed subsidiary market trade evidence (W-SUB-MARKET)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`js/listed-subsidiary-market.js` installs two commands for the parent's stake in a listed subsidiary, each in one
transaction:

- `sellListedSubsidiaryStake(id, ratio)` sells part of the stake on the market. It is refused during the IPO lock-up,
  and the sale is capped so the parent keeps 10%. The price is the listed valuation less a 2% market discount. The
  parent's book is removed pro rata. One `assetSale` row is posted (cash = price, asset = −book sold, profit = gain).
- `buyListedSubsidiaryStake(id, ratio)` buys shares back from the market. It is capped at 100% and refused without
  enough company cash. The price is the listed valuation plus a 3% premium. The price is capitalised in the parent's
  book. One `assetPurchase` row is posted (cash −price, asset +price).

Both commands round the price up to whole yen (R6), add to the subsidiary's sold or repurchased counter and write a
`listedSubsidiaryMarketHistory` row.

## Pinned inputs

`tests/fixtures/subsidiary-market-trade-atomicity.js` reuses the W-SUB-SECONDARY state: a subsidiary listed through
the production prepared IPO, at a 55% parent stake, advanced with installed weeks to the end of its lock-up. The
variants are the installed trade sizes on each side: `sell5`, `sell10`, `buy5` and `buy10`.

## Faults and oracles

`tests/subsidiary-market-trade-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Fault cases:
  - all nine shared faults per variant (the commands emit `notify`, `saved` and `change`);
  - queued-predecessor and nested `save-false` / `save-throw` on `sell10` and `buy10`.
- Each failure must show:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the trade once.
- The success oracle is computed independently of the module's preview:
  - company cash moves by `ceilYen(round(valuation × ratio) × (1 ∓ 2% / 3%))`;
  - founder cash is unchanged;
  - the parent stake moves by the block;
  - a sale reduces the book by `round(book × ratio / stake)`, and a repurchase adds the price to it;
  - the subsidiary itself is unchanged;
  - the trade counter, the full history row, and exactly one whole-yen row with its source and operation IDs;
  - `finance.validate` and standalone close pass.
- The uninterrupted trade commits once in `notify -> saved -> change` order, and a replay is identical.
- A v9 critical compaction keeps the stake, book and counters. The ownership ratio is compared within 1e-12, because a
  normalising reload stores, for example, 0.45 for 0.55 − 0.1.
- These are refused with no change, no save and unchanged durable bytes:
  - a sale inside the IPO lock-up;
  - a repurchase without enough company cash.
- Three negative controls are rejected: a disabled rollback, company cash off by ¥1 and a book off by ¥1.

Production mutants (not committed) that the test rejects: a floored price, a sale that leaves the book on the parent,
and a repurchase that is not capitalised.

## Limits

This is Node-only evidence; a native-WebKit counterpart is the next slice. This does not certify the listed
subsidiary dividend policy or weekly market, raw/helper bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit
or Phase 4 Entry.
