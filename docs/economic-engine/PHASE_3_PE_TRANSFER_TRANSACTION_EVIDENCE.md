# P3-4: personal PE deal transfer to the company evidence (W-PE-TRANSFER)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`transferPEDealToCompany(id)` (`js/expansion.js`) moves an active personal PE deal into the company group at fair
value. `js/pe-value-creation.js` wraps it with a guard that refuses a deal with a pending initiative; that guard is
covered by `tests/pe-pending-initiative-transfer-lifecycle-test.js`. The PE screen's 移管 button calls the wrapped
command. In one transaction it:

- pays the deal's `currentValuation` from company cash to personal cash;
- adds the gain over the founder's cost basis to `peRealizedPL`;
- sets the deal's owner to the company, with the fair value as cost basis and company acquisition cost;
- posts one `acquisition` row (`pe-transfer-<deal id>`): cash −price, asset +price;
- creates the PE subsidiary through `syncPESubsidiary`, booked at the fair value;
- emits `notify`, `saved` and `change`.

A deal that is already the company's returns `false` without a write.

## Pinned inputs

`tests/fixtures/pe-transfer-atomicity.js` forms one personal deal (¥120,000,000) and one company deal (¥80,000,000)
with the installed `createPEDeal`. The only hand-set inputs are cash buffers and the investment department unlock.

| Variant | State | Command |
| --- | --- | --- |
| `fresh` | right after formation (week 1) | transfer the personal deal |
| `aged` | three installed weeks later, with a moved valuation | transfer the personal deal |

## Faults and oracles

`tests/pe-transfer-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Faults:
  - per variant, all nine shared faults;
  - on `aged`, also queued-predecessor and nested `save-false` / `save-throw`.
- Each failure is checked for:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the command once.
- The success oracle is computed from the deal's own fair value and cost basis:
  - company cash down and personal cash up by the fair value;
  - `peRealizedPL` up by the fair value minus the founder's cost basis;
  - the deal changes only its owner, cost basis, company acquisition cost and subsidiary link;
  - the full PE subsidiary record: ownership, valuation, book, invested cost and acquisition week;
  - the other deal and subsidiary unchanged;
  - exactly one ledger row, the `acquisition` row with its operation and idempotency keys, at ¥0.01;
  - `finance.validate` and standalone close pass.
- The uninterrupted command commits once, in `notify -> saved -> change` order.
- A replay is identical.
- A second transfer of the same deal is refused with no change, no save and unchanged durable bytes.
- A v9 critical compaction keeps the deal owner, cost basis, acquisition cost, subsidiary link, the subsidiary and both
  cash balances.
- Three negative controls are rejected:
  - a disabled rollback;
  - personal cash off by ¥1;
  - a subsidiary book that is not the fair value.

The test also rejects a production mutant, which is not committed: a ledger row rounded to whole yen.

## Observation

The fair value is fractional (`createPEDeal` draws it as amount × rand). The command moves both cash balances by the
unrounded value, while the ledger row keeps it at ¥0.01. This PR records that behaviour and does not change it; whether
the transfer joins the whole-yen rounding table is a separate decision.

## Limits

This does not certify the other PE writers (W-PE-FORM,
W-PE-PARENT, W-WEEK-PE), raw/helper bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.

## Native WebKit / IndexedDB counterpart

`tests/pe-transfer-save-atomicity-webkit-test.js` runs the same two pinned deals through the installed
`transferPEDealToCompany` in the installed page. The page is emulated iPhone 13 WebKit with real IndexedDB. A page-side
observer requires the actual `peTransfer` ledger row of the pinned deal inside the command's transaction. Per variant it
runs success and all nine shared faults; `aged` adds queued-predecessor and nested `save-false` / `save-throw`, for 24
scenarios.

Each failure is checked for:

- live state, mirror, cache and durable IndexedDB bytes exactly as before, with a pending predecessor intact;
- a recovery save above every allocated failed sequence;
- a retried transfer equal to the uninterrupted one;
- a fresh context with localStorage removed that hydrates that state from IndexedDB alone.

After each case, a second transfer of the same deal is refused without any change and is hydrated durable-only too. The
page oracle ports the Node `success()`. Three negative controls are rejected:

- a disabled rollback;
- personal cash off by ¥1;
- a subsidiary book that is not the fair value.

It runs in the M&A `pe-acquisition-atomicity` job. Its logic was exercised locally on Chromium (24 scenarios plus 3
rejected controls); WebKit evidence is the exact HEAD's CI job. No physical-iPhone claim is made.
