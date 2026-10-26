# P3-4: canonical quarterly dividend-payment evidence

Base main: `a5840623bc3f4e0d0479110c48d20f4910ad3e0a`, after #1137.
Mode: `F_IMPLEMENT`. Scope is the installed canonical `advanceWeek(false)`
from week 12 to 13, including `engine.js` payment/finance recognition and the
`shareholder-returns.js` cap/history wrapper (`W-DIV-PAY`). This is Node/
fake-IDB evidence, not an authority change or native-browser attestation.

## Opening inputs and independent monetary legs

The deterministic fixture seeds a previously declared per-share policy of
¥1.23456789, 100,000 issued shares, 1,000 treasury shares, 60,000 original
founder shares, no company/personal stock lots or debt, and ¥10m personal cash.
The opening policy is an input, not a claim that a new unsafe declaration
would be accepted at low cash. The opening finance book is validated; no
historical receipt or treasury cost is fabricated. Capacity is previewed
before saving, matching the installed statement-cache behavior.

| Variant | Opening company cash | Safe capacity | Paid gross | Founder net | Withholding | External gross |
|---|---:|---:|---:|---:|---:|---:|
| normal | ¥100,000,000 | ¥95,000,000 | ¥122,223 | ¥59,038 | ¥15,036.55 | ¥48,148.45 |
| capped | ¥5,050,000 | ¥50,000 | ¥50,000 | ¥24,152 | ¥6,151.03 | ¥19,696.97 |

Normal gross is `ceil(1.23456789 * 99000) = 122223`. Founder ratio is
`60000 / 99000`; the existing R5c-2 net rule gives the literal net pins above.
The capped case limits payment to ¥50,000 and restores the original declared
policy and market mirror afterwards. Tax/external legs use the existing
receipt's cent precision and are not tracked cash accounts. Both signed
receipt residuals are zero; no rounding or distribution policy changes.
Expected cash legs are not derived from resulting receipts, reports or P&L.

The oracle asserts one `weekly-dividend` receipt with week/operation/
idempotency identity, pinned gross and negative cash effect, zero profit/
asset/liability/equity effects, all distribution legs, independently pinned
payer/holder before-after evidence and `netRounding: ceilYen`. It checks the
founder's actual cash increase, unchanged holdings/share quantities, restored
policy, one payment history row, retained declaration and valid standalone
close, company book and ownership reconciliation. Pending distribution must
be cleared and the reconciliation count must be one.

A separate same-seed control uses the installed `setDividend(0)` cancellation
before advancing the same week. Final company/holder cash differences must
match the gross/net pins, while profit and simulation RNG agree. This accounts
for other normal weekly operations (including progression rewards) instead of
mistaking final company cash for the isolated payment leg.

## Reachability and failure boundaries

`tests/shareholder-dividend-payment-save-atomicity-test.js` uses the actual
installed week, without disabling weekly finance/close validation. A payment
observer delegates to `finance.observeDividendDistribution` and requires the
pinned payment to be reached inside a transaction before a fault counts.

There are 24 fault configurations:

- Seven applicable shared faults for each variant: save-false, pre-admission
  throw, mirror rejection, enqueue false/throw, post-admission throw and saved
  emission (14 cases).
- Queued predecessor/nested normal-week cases for save-false/post-admission
  throw (four cases).
- Actual post-receipt, final-close and terminal-week exceptions for each
  variant (six cases).

The installed payment path has no payment-specific `notify`; its terminal
completion is `week`, not the shared command fault's post-transaction `change`.
Those two command event injections are not presented as applicable proof.
The actual `week` failure is tested separately. The receipt fault delegates to
`finance.recordWeekly` then throws only after the dividend row/book exists;
that module uses its lexical `event`, so replacing the exported `event` would
not prove this boundary. The close fault reaches `finalizeWeekBoundary`'s
snapshot rebuild, after payment. There is no synthetic event translation.

Every failure asserts actual reachability, full live state/RNG rollback, exact
mirror/cache/durable bytes, no failed pending put, production reload and fresh
durable-only fake-IDB hydration. Recovery exceeds the observed maximum failed
save allocation; retry commits one payment and persists a newer sequence.
All six additional-boundary retries equal the full uninterrupted same-seed
week, excluding only save metadata. Normal canonical completion admits one
save; internal deferred save requests are not counted as durable commits.

Critical v9 compaction/reload retains both cash balances, share quantities,
payment count/week and actual-payment metadata. Re-observing the committed
week must reject without state/save mutation. Advancing to week 14 is a valid
new week, not a rejected replay; it must not pay another quarterly dividend.
Two negative controls reject disabled rollback and a corrupted completed-state
founder cash credit, independently of otherwise unchanged receipt evidence.

## Registration and remaining boundary

The Node test is canonical-registered in shard F. Actual #1137 totals were
F 1,415.702s, E 1,400.877s and G 1,492.700s; F has comparable headroom to E and
keeps the shareholder-return suites together. No existing assignment or
timeout changes. Local and exact-HEAD execution results are recorded in the
PR separately from registration-only checks. Existing dividend, declaration,
activism and permanent accounting tests remain unchanged.

The native-WebKit/IndexedDB counterpart is
`tests/shareholder-dividend-payment-save-atomicity-webkit-test.js` (see below).
This fixture does not certify additional personal own-company lots, all
holder classes, captured/raw/helper bypass closure or adopted ownership
authority. There is no S_PASS, cutover, P3-10 permission, Phase 3 Exit or Phase
4 Entry claim. The six Owner-held inventory/spec PRs remain unchanged.

## Native WebKit / IndexedDB counterpart

`tests/shareholder-dividend-payment-save-atomicity-webkit-test.js` runs the same
pinned normal and capped states in the installed page (emulated iPhone 13
WebKit, real IndexedDB) through the canonical `advanceWeek(false)`, week 12 to
13. A page-side observer requires the actual payment inside the week transaction
with the pinned gross and founder net. Per variant it runs the success case, the
seven applicable shared faults (no `change`/`notify`, as in Node) and the three
week boundaries: after the receipt is written, during the final close and at the
terminal `week` event. The normal variant adds queued-predecessor and nested
`save-false`/`save-throw`, 26 scenarios in total.

Every failure must leave the full live state, the localStorage mirror, the
backend cache and the durable IndexedDB bytes exactly as before, with any
pending predecessor intact. A recovery save must exceed every allocated failed
sequence, and the retried week must equal the uninterrupted same-seed week. A
fresh browser context with localStorage removed must hydrate exactly that state
from IndexedDB alone. After each case, re-observing the paid distribution is
rejected without mutation, and week 14 must not pay again; its durable-only
hydration is checked too. Two negative controls reject a disabled rollback and a
corrupted founder cash credit.

The test runs in the M&A `stock-split-atomicity` job next to the declaration
counterpart. Its logic was exercised locally with the same script on Chromium
(26 scenarios plus 2 rejected controls). WebKit execution evidence is the exact
HEAD's CI job, not this local run, and no physical-iPhone claim is made.
