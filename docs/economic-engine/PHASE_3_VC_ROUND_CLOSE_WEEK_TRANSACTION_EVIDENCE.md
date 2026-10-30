# P3-4: startup funding round close week evidence (W-VC-CLOSE / W-WEEK-STARTUPS)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

An open startup funding round closes inside the canonical week:
`advanceWeek(false)` -> `updateStartups` -> (`week >= activeFundingRound.closesWeek`) ->
`closeStartupFundingRound(s)`. The close checks the round's ownership and payment evidence, then dilutes both
holders' stakes (and negotiated due-diligence fractions) by `pre / post`, adds each holder's contribution at the
post-money price, moves the startup to the new stage and valuation, extends runway, records a `closed` history row
and clears the round. Contributions were already paid and posted by `participateStartupFundingRound`; closing moves
no cash and posts no ledger row.

[`closeStartupFundingRound`](../../js/engine.js) is not a command; it is only reached from the weekly hook, so the
evidence drives the actual installed week rather than calling the writer directly.

## Pinned inputs

`tests/fixtures/vc-round-close-week-atomicity.js` builds both holdings with the installed `investStartup` command,
opens the round with the installed `openStartupFundingRound` and pays with the installed
`participateStartupFundingRound`. Round terms: a Series A at a ¥300,000,000 pre-money opens a Series B raising
¥60,000,000 (post-money ¥360,000,000), opened in week 20 and closing in week 24. Half of each stake carries
negotiated due-diligence terms.

| Variant | Company cost basis | Founder cost basis | Company pays | Founder pays |
| --- | --- | --- | --- | --- |
| `company` | ¥20,000,000 | none | half its pro-rata share | — |
| `mixed` | ¥20,000,000 | ¥10,000,000 | its full pro-rata share | nothing (diluted) |

The receipts are dated inside the round window; the fixture then moves to week 23, so the next installed week is
the closing week. A delegating observer requires the actual successful close of the pinned round inside the week
transaction.

## Faults and oracles

`tests/vc-round-close-week-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- per variant, the 7 applicable shared faults (no `change` / `notify`: the canonical week has no close-specific
  notice and its terminal event is `week`), plus queued-predecessor and nested `save-false` / `save-throw` on `mixed`;
- each failure: full live rollback including RNG, unchanged mirror/cache/durable bytes, cancelled failed put,
  production reload and fresh durable-only hydration, a recovery save above every allocated failed sequence, and a
  retry that commits the week once;
- success oracle: both stakes and due-diligence fractions equal the dilution formula at the pinned terms (the
  non-participating founder is diluted), pinned valuation/stage/runway/close week, no open round, unchanged cost
  bases, exactly one `closed` history row with pinned identity and before/after ownership, the opened row marked
  closed, no ledger movement for the round, close news, `finance.validate` and standalone close;
- a same-seed control whose round is still open shows identical company and founder cash, so the close moves no
  cash;
- a further week cannot close again or re-dilute; a v9 critical compaction keeps the closed round's ownership;
- three negative controls are rejected: a disabled rollback, an undiluted founder stake, and an extra round
  ledger row.

Production mutants (not committed) that the test rejects: due-diligence fraction not diluted, close week off by
one, founder stake not diluted.

## Limits

This does not certify listing (`listStartup`), raw/helper
bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.

## Native WebKit / IndexedDB counterpart

`tests/vc-round-close-week-save-atomicity-webkit-test.js` runs the same pinned `company` and `mixed` states in the
installed page (emulated iPhone 13 WebKit, real IndexedDB) through the canonical `advanceWeek(false)`, week 23 to
24. A page-side observer requires the actual successful close of the pinned round inside the week transaction. Per
variant: success, the seven applicable shared faults and the final-close and terminal `week` boundaries; `mixed`
adds queued-predecessor and nested `save-false` / `save-throw` (24 scenarios).

Each failure must leave live state, mirror, cache and durable IndexedDB bytes exactly as before, with a pending
predecessor intact; the recovery save exceeds every allocated failed sequence; the retried week equals the
uninterrupted same-seed week; a fresh context with localStorage removed hydrates that state from IndexedDB alone.
After each case, week 25 neither closes again nor re-dilutes, and is hydrated durable-only too. The page oracle ports
the Node `success()`. Live-state rollback is compared with sorted object keys, as Node's deep equality does (as in
the follow-on WebKit test): a rollback may re-order the keys of funding history rows without changing any value.
Mirror, cache and durable bytes are still compared exactly. Three negative controls are rejected: disabled
rollback, an undiluted founder stake and an extra round ledger row.

It runs in the M&A `vc-week-atomicity` job with the write-off week evidence. Its logic was exercised locally on
Chromium (24 scenarios plus 3 rejected controls); WebKit evidence is the exact HEAD's CI job. No physical-iPhone
claim is made.
