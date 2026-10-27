# P3-4: listed subsidiary secondary sale evidence (W-SUB-SECONDARY)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`sellSubsidiaryIPOStake(id, ratio)` (`js/subsidiary-ipo-secondary-sale.js`) runs in one transaction once the IPO
lock-up has ended. For an installed ratio (10%, 25% or 50% of the subsidiary) it sells at the listed valuation less a
2% market discount, rounded up to whole yen (R6c), removes the parent's cost basis pro rata to its stake, credits the
gain to cumulative profit, writes a `secondarySale` history row and posts one `investmentSale` ledger row (cash =
proceeds, profit = gain). The parent's book is carried in state (`carryingBookValue`), which the balance sheet reads,
so the row carries no asset effect. A ratio that would leave the parent below its 10% minimum is refused.

## Pinned inputs

`tests/fixtures/subsidiary-secondary-sale-atomicity.js` lists a subsidiary through the production prepared IPO (the
W-SUB-IPO fixture, `balanced` terms, 55% parent stake after the IPO) and advances installed weeks to the end of its
lock-up. Variants: `ten` (10%) and `quarter` (25%).

## Faults and oracles

`tests/subsidiary-secondary-sale-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- per variant, all nine shared faults (the command emits `notify`, `saved` and `change`), plus queued-predecessor and
  nested `save-false` / `save-throw` on `quarter`;
- each failure: full live rollback including RNG, unchanged mirror/cache/durable bytes, cancelled failed put,
  production reload and fresh durable-only hydration, a recovery save above every allocated failed sequence, and a
  retry that commits the sale once;
- success oracle, computed independently of the module's preview: company cash up by
  `ceilYen(round(valuation × ratio) × .98)`, founder cash unchanged, cumulative profit up by the gain, parent stake
  down by the ratio, book down by `round(book × ratio / stake)`, the subsidiary itself unchanged, the full history row
  with its operation ID, exactly one whole-yen receipt (amount and cash = proceeds, profit = gain),
  `finance.validate` and standalone close;
- the uninterrupted sale commits once in `notify -> saved -> change` order; a replay is identical; a v9 critical
  compaction keeps the stake and book; a 50% sale (which would leave 5%) is refused with no change and no save;
- three negative controls are rejected: a disabled rollback, company cash off by ¥1 and a book off by ¥1.

Production mutants (not committed) that the test rejects: fractional proceeds, cost basis not removed from the book,
gain not credited to cumulative profit.

## Limits

Node only; a native-WebKit counterpart is the next slice. This does not certify control actions, follow-on,
relisting, raw/helper bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
