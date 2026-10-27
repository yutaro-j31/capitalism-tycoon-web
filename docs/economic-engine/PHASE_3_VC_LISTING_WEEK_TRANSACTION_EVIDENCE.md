# P3-4: startup listing week evidence (W-VC-LIST / W-WEEK-STARTUPS)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

A held Pre-IPO startup valued above ¥1,000,000,000 lists inside the canonical week:
`advanceWeek(false)` -> `updateStartups` -> (simulation draw `< .025`) -> `listStartup(s)`. The listing adds one
market row of 1,000,000 shares at the listing-week valuation, converts each holder's stake into a listed lot of
`floor(stake * shares)` at that holder's own cost basis, zeroes the venture's stakes and bases and retires it from the
private book. The company's basis moves from the venture holding to listed shares through two cashless, profitless
rows (`listStartup` / `listStartupShares`). The founder's lot stays off the company ledger.

[`listStartup`](../../js/engine.js) is not a command; it is only reached from the weekly hook, so the evidence drives
the actual installed week rather than calling the writer directly.

## Pinned inputs

`tests/fixtures/vc-listing-week-atomicity.js` builds both holdings with the installed `investStartup` command, so the
company's investment is recognised on its books, then sets a qualifying Pre-IPO (¥2,000,000,000, ample runway, no
open round):

| Variant | Company cost basis | Founder cost basis |
| --- | --- | --- |
| `company` | ¥20,000,000 | none |
| `mixed` | ¥20,000,000 | ¥10,000,000 |

Week 20 -> 21. The listing is reached through the deterministic simulation RNG of seed `2` (the first seed whose
week-21 draw lists the pinned startup; found by search and pinned), never by stubbing the draw. A delegating observer
requires the actual listing of the pinned startup inside the week transaction.

## Faults and oracles

`tests/vc-listing-week-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- per variant, the 7 applicable shared faults (no `change` / `notify`: the canonical week has no listing notice and
  its terminal event is `week`), plus queued-predecessor and nested `save-false` / `save-throw` on `mixed`;
- each failure: full live rollback including RNG, unchanged mirror/cache/durable bytes, cancelled failed put,
  production reload and fresh durable-only hydration, a recovery save above every allocated failed sequence, and a
  retry that commits the week once;
- success oracle: retired startup with a fresh `V####` ticker, all six stake/basis fields zero, one market row at the
  listing-week valuation (price, previous, cap, shares, market, one-point history), each holder's lot equal to
  `floor(stake * shares)` at its pinned basis (no founder lot for `company`), exactly the transfer pair with pinned
  identity (`list-startup-<id>`, `list-startup-shares-<id>`, `<id>-21`), `∓¥20,000,000` asset effect and zero cash
  and profit effect, listing news, `finance.validate` and standalone close;
- a further week cannot list again or change the lots; a v9 critical compaction keeps the retired startup, both lots
  and the market row;
- three negative controls are rejected: a disabled rollback, a founder lot off by one share and a listing row that
  books a gain.

Production mutants (not committed) that the test rejects: founder lot rounded up, startup left alive, a listing loss
booked on the transfer-out row.

## Limits

Node only; a native-WebKit counterpart is the next slice. This does not certify raw/helper bypass closure, S_PASS,
authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
