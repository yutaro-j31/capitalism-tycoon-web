# P3-4: listed subsidiary follow-on offering evidence (W-SUB-FOLLOWON)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`executeListedSubsidiaryFollowOnOffering(id, optionID)` (`js/listed-subsidiary-follow-on-offering.js`) runs in one
transaction once 26 weeks have passed since the listing (or the previous follow-on / relisting). Each installed option
prices its blocks at the listed valuation less its discount, rounded up to whole yen (R6):

| Option | Primary (new shares) | Parent secondary | Discount |
| --- | --- | --- | --- |
| `primary` | 10% | — | 6% |
| `secondary` | — | 10% | 4% |
| `balanced` | 5% | 5% | 5% |

Primary proceeds go to the subsidiary (`subsidiaryCash`, post-money valuation) and dilute the parent. The parent then
sells its secondary block for company cash, with its book removed pro rata. Each block posts one ledger row: a
`listedSubsidiaryPrimaryOffering` equity-financing row with no parent cash, asset or profit effect, and a
`listedSubsidiarySecondaryOffering` `assetSale` row (cash = proceeds, asset = −book sold, profit = gain). The command
also writes a history row and the subsidiary's follow-on counters. An option that would leave the parent below 20%
is refused.

## Pinned inputs

`tests/fixtures/subsidiary-follow-on-atomicity.js` lists a subsidiary through the production prepared IPO (the
W-SUB-IPO fixture, `balanced` terms, 55% parent stake). It then advances installed weeks until every option is
executable (week 43). Variants are the three installed options.

## Faults and oracles

`tests/subsidiary-follow-on-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- per variant, all nine shared faults (the command emits `notify`, `saved` and `change`), plus queued-predecessor and
  nested `save-false` / `save-throw` on `balanced`;
- each failure: full live rollback including RNG, unchanged mirror/cache/durable bytes, cancelled failed put,
  production reload and fresh durable-only hydration, a recovery save above every allocated failed sequence, and a
  retry that commits the offering once;
- success oracle, computed independently of the module's preview:
  - company cash up by the whole-yen secondary proceeds only;
  - founder cash unchanged;
  - subsidiary cash up by the whole-yen primary proceeds, and the post-money valuation;
  - the parent stake diluted at post-money and then reduced by the secondary block;
  - book down by `round(book × secondary / stake)`;
  - follow-on counters and the full history row;
  - one ledger row per non-zero block, with its source and operation IDs and effects;
  - `finance.validate` and standalone close;
- the uninterrupted offering commits once in `notify -> saved -> change` order; a replay is identical; a v9 critical
  compaction keeps the stake, book, valuation, subsidiary cash and cooldown week;
- after an offering, every option is refused inside the restarted cooldown, with no change, no save and unchanged
  durable bytes;
- three negative controls are rejected: a disabled rollback, company cash off by ¥1 and subsidiary cash off by ¥1.

Production mutants (not committed) that the test rejects: floored secondary proceeds, sold book kept on the parent,
primary proceeds not credited to the subsidiary.

## Limits

Node only; a native-WebKit counterpart is the next slice. This does not certify relisting, raw/helper bypass closure,
S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
