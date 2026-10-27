# P3-4: startup write-off week evidence (W-VC-WRITEOFF / W-WEEK-STARTUPS)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

A held startup whose runway is spent is stopped inside the canonical week:
`advanceWeek(false)` -> `updateStartups` -> (`runwayWeeks <= 0` and a simulation draw `< .25`) ->
`writeOffStartup(s, '資金枯渇')`. The write-off zeroes both owners' stakes and cost bases and posts one
cashless `investmentSale` row for the company's cost basis (asset and profit effect `-book`). The founder's own
stake is lost off the company ledger.

[`writeOffStartup`](../../js/engine.js) is not a command; it is only reached from the weekly hook, so the evidence
drives the actual installed week rather than calling the writer directly.

## Pinned inputs

`tests/fixtures/vc-writeoff-week-atomicity.js` builds both holdings with the installed `investStartup` command,
so the company's investment is recognised on its books:

| Variant | Company cost basis | Founder cost basis |
| --- | --- | --- |
| `company` | ¥20,000,000 | none |
| `mixed` | ¥20,000,000 | ¥10,000,000 |

Week 20 -> 21 with `runwayWeeks = 0`. The stop is reached through the deterministic simulation RNG of seed `1`
(the first seed whose week-21 draw stops the startup; found by search and pinned), never by stubbing the draw. A
delegating observer requires the actual write-off of the pinned startup inside the week transaction, with the
pinned company cost basis.

## Faults and oracles

`tests/vc-writeoff-week-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- per variant, the 7 applicable shared faults (no `change` / `notify`: the canonical week has no write-off notice
  and its terminal event is `week`), plus queued-predecessor and nested `save-false` / `save-throw` on `mixed`;
- each failure: full live rollback including RNG, unchanged mirror/cache/durable bytes, cancelled failed put,
  production reload and fresh durable-only hydration, a recovery save above every allocated failed sequence, and a
  retry that commits the week once;
- success oracle: stopped startup, all six stake/basis fields zero, no open round, exactly one write-off receipt
  with pinned identity (`startup-writeoff-<id>`, `<id>-21`), zero amount and cash, `-¥20,000,000` asset and profit
  effect, `finance.validate` and standalone close;
- a same-seed control with runway shows no write-off and identical company and founder cash, so the write-off moves
  no cash;
- a further week cannot write off again; a v9 critical compaction keeps the stopped, zeroed startup;
- two negative controls are rejected: a disabled rollback, and a write-off receipt off by ¥1.

## Limits

Node only; a native-WebKit counterpart is the next slice. This does not certify listing (`listStartup`) or round
close (`closeStartupFundingRound`), raw/helper bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or
Phase 4 Entry.
