# P3-4: negotiated subsidiary sale evidence (W-GROUP-NEGOTIATED)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`js/group-restructuring-progress.js` installs the sale-negotiation commands on the engine, each in one transaction.
None of them is called by player UI in this tree; they are reached through the engine API only.

1. `startSubsidiarySaleNegotiation(id, buyerType)` opens a negotiation on one of five deterministic buyer offers.
   - The negotiated block is the whole stake, or the stake above 10% for a listed subsidiary.
   - Each offer has its own close week.
   - The `mbo` and `pe` offers carry a 10% earnout.
2. `actOnSubsidiarySaleNegotiation(id, 'accept')` records the agreement.
3. `closeNegotiatedSubsidiarySale(id)` closes the agreed negotiation from its close week. This is the command under
   test. It:
   - settles the agreed offer in whole yen (R6) less a 2% whole-yen fee, and credits the net to company cash;
   - removes the parent's book pro rata to the sold block, or the whole book on a full exit;
   - lowers the parent stake, and marks the subsidiary `sold` at zero;
   - posts one `negotiatedSubsidiarySale` `assetSale` row: amount = gross, cash = net, asset = −book removed,
     profit = gain;
   - completes the negotiation with its fee, book, gain and net proceeds;
   - records a pending earnout when the offer carries one;
   - stops the subsidiary's other active programmes, negotiations and integrations;
   - writes a `saleCompleted` history row.

The command emits `saved` and `change`. It posts no notice, so the shared `notify` fault does not apply. Closing is not
a weekly step: the installed week only advances programmes, integrations and earnout payments.

## Pinned inputs

`tests/fixtures/group-negotiated-sale-atomicity.js` uses production writers only. It starts a negotiation, accepts it
and advances installed weeks to its close week:

| Variant | Subsidiary | Buyer | Built from |
| --- | --- | --- | --- |
| `partial` | VC subsidiary held at 70% | `competitor` (cash) | the subsidiary quarter fixture |
| `whole` | wholly owned, private | `mbo` (with earnout) | prepared IPO → tender offer → squeeze-out (W-SUB-CONTROL) |
| `listed` | listed at 55%, after lock-up | `strategic` (cash) | the W-SUB-SECONDARY fixture; sold down to 10% |

## Faults and oracles

`tests/group-negotiated-sale-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Faults:
  - per variant, the eight applicable shared faults;
  - on `whole`, also queued-predecessor and nested `save-false` / `save-throw`.
- Each failure is checked for:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the close once.
- The success oracle is computed independently of the module's preview:
  - company cash rises by `ceilYen(offer) − ceilYen(2%)`;
  - founder cash is unchanged;
  - the stake falls by the sold block, capped at the 10% listed floor;
  - the book falls by `round(book × sold / stake)`, or to zero on a full exit;
  - `sold` status only at zero stake;
  - the completed negotiation's fee, book, gain and net proceeds;
  - the full earnout terms on `whole`, and no earnout otherwise;
  - the full history row;
  - exactly one whole-yen receipt, with its source and operation IDs;
  - `finance.validate` and standalone close pass.
- The uninterrupted close commits once, in `saved -> change` order.
- A replay is identical.
- A second close is refused with no change, no save and unchanged durable bytes.
- A v9 critical compaction keeps the stake, book, status, completed negotiation and earnouts.
- Three negative controls are rejected: a disabled rollback, company cash off by ¥1, and a book left on the parent.

The test also rejects three production mutants, which are not committed: a floored fee, a book kept on the parent,
and a dropped earnout.

## Limits

This does not certify the negotiation start,
price/terms/bid/cancel actions or the weekly earnout payment, raw/helper bypass closure, S_PASS, authority cutover,
P3-10, Phase 3 Exit or Phase 4 Entry.

## Native WebKit / IndexedDB counterpart

`tests/group-negotiated-sale-save-atomicity-webkit-test.js` runs the same pinned `partial`, `whole` and `listed` states
in the installed page (emulated iPhone 13 WebKit, real IndexedDB) through the installed
`closeNegotiatedSubsidiarySale`. A page-side observer requires the actual sale receipt of the pinned negotiation inside
the command's transaction. Per variant: success and the eight applicable shared faults; `whole` adds queued-predecessor
and nested `save-false` / `save-throw` (31 scenarios).

Each failure must leave live state, mirror, cache and durable IndexedDB bytes exactly as before, with a pending
predecessor intact; the recovery save exceeds every allocated failed sequence; the retried close equals the
uninterrupted one; a fresh context with localStorage removed hydrates that state from IndexedDB alone. After each case
a second close is refused without any change, and is hydrated durable-only too. The page oracle ports the Node
`success()`, including the earnout terms. Three negative controls are rejected: disabled rollback, company cash one yen
over the net proceeds and a book one yen over what remains on the parent.

It runs in the M&A `group-atomicity` job after the group restructuring merge evidence. Its logic was exercised locally
on Chromium (31 scenarios plus 3 rejected controls); WebKit evidence is the exact HEAD's CI job. No physical-iPhone
claim is made.
