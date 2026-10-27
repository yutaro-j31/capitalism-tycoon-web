# P3-4: subsidiary relisting evidence (W-SUB-RELIST)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`relistSubsidiary(id, strategyID)` (`js/subsidiary-relisting-options.js`) runs in one transaction. It applies to a
wholly owned private subsidiary that meets all of these conditions:

- at least 26 weeks have passed since its delisting;
- it has had two or more integration-synergy rounds;
- it is profitable;
- its growth is at least 20%.

The company pays a fixed ¥15,000,000 preparation cost. Each installed strategy prices its blocks at the private
valuation less its discount, rounded up to whole yen (R6):

| Strategy | Primary (new shares) | Parent secondary | Discount | Lock-up |
| --- | --- | --- | --- | --- |
| `control` | 5% | 5% | 4% | 26 weeks |
| `balanced` | 10% | 10% | 7% | 18 weeks |
| `growth` | 20% | 5% | 11% | 13 weeks |

What the relisting does:

- Primary proceeds go to the subsidiary (`subsidiaryCash`, post-money valuation).
- The parent sells its secondary block for company cash and removes the same share of its book.
- The subsidiary becomes listed again, with relisting offer terms and a market restarted at this week (#966).
- Two ledger rows are posted: the preparation cost, and an `investmentSale` receipt (cash = proceeds, asset = −book
  sold, profit = gain).
- A `relisted` history row is written.

## Pinned inputs

`tests/fixtures/subsidiary-relist-atomicity.js` builds the subsidiary with production writers only. Starting from the
W-SUB-IPO fixture (prepared IPO), it applies, in order:

1. the installed tender offer;
2. the installed squeeze-out (wholly owned, delisted in week 17);
3. two installed `platform` integration-synergy investments;
4. installed weeks until every strategy is executable (week 43).

The variants are the three installed strategies.

## Faults and oracles

`tests/subsidiary-relist-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- per variant, all nine shared faults (the command emits `notify`, `saved` and `change`), plus queued-predecessor and
  nested `save-false` / `save-throw` on `growth`;
- each failure: full live rollback including RNG, unchanged mirror/cache/durable bytes, cancelled failed put,
  production reload and fresh durable-only hydration, a recovery save above every allocated failed sequence, and a
  retry that commits the relisting once;
- success oracle, computed independently of the module's preview:
  - company cash down by the preparation cost and up by the whole-yen secondary proceeds;
  - founder cash unchanged;
  - subsidiary cash up by the whole-yen primary proceeds;
  - the post-money valuation;
  - the parent stake `(1 − secondary) × pre / post`;
  - book down by `round(book × secondary)`;
  - listed again, with relisting counters;
  - the full relisting offer terms and lock-up week;
  - the market restarted at this week;
  - the full history row;
  - one preparation-cost row and one whole-yen secondary receipt, with their operation IDs;
  - relisting news, `finance.validate` and standalone close;
- the uninterrupted relisting commits once in `notify -> saved -> change` order; a replay is identical; a v9 critical
  compaction keeps the stake, book, valuation, subsidiary cash, listing and relisting week;
- refusals with no change and unchanged durable bytes:
  - every strategy on the relisted subsidiary (also with no save);
  - a relisting without the preparation cost in company cash;
- three negative controls are rejected: a disabled rollback, company cash off by ¥1 and subsidiary cash off by ¥1.

Production mutants (not committed) that the test rejects: floored secondary proceeds, sold book kept on the parent,
preparation cost not paid.

## Limits

Node only; a native-WebKit counterpart is the next slice. This does not certify raw/helper bypass closure, S_PASS,
authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
