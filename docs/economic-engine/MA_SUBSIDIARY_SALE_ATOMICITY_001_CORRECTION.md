# MA-SUBSIDIARY-SALE-ATOMICITY-001 — subsidiary disposal commit boundary

Tracker: #922 / #909. Owner correction authorization: 2026-10-09.
Base main: `446ef7cad7314d98cfff08a098bcb6597714ee6d`.
Diagnosis: [PR #925](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/925),
[actual RED and persistence evidence](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/922#issuecomment-6074411676).

The installed `sellMASubsidiary` action mutated company cash, the subsidiary, goodwill,
asset-sale journal, total M&A gain and sale-price RNG before calling an unchecked save.
Save false returned success with those changes still live. A later accepted save persisted
the rejected disposal; a synchronous exception after save acceptance left its cache/mirror/
queued put intact immediately, surviving flush, reload and fresh durable-only hydration.

## Minimum correction

Only this writer's boundary changes. Use existing `runTransaction` and #915's
`checkpointSaveStorage`; the shared commit owns the final save and change event.
Keep existing lookup, one price draw, carrying-value calculation, journal rounding,
goodwill disposal, gain accumulation, removal and notify call unchanged. Successful
standalone sales retain notify → saved → change and exactly one save. Invalid/duplicate
IDs return false without drawing RNG, emitting events or writing a new save.

The transaction restores the full live snapshot, prior mirror/cache and cancels only its
new synchronous queued writes. An earlier accepted pending save continues. No dedicated
sale rollback, compensation save, alternate persistence layer or historical save repair.
The asynchronous #915 contract remains: save true is acceptance/enqueue, not confirmation
of completed durable IDB I/O; rollback is a synchronous boundary, not an async undo API.

## Permanent coverage

- `tests/ma-subsidiary-sale-save-atomicity-test.js`: original #925 save-false RED contract
  first, full installed runtime; mirror rejection; enqueue false/throw after admission;
  accepted-save throw; saved/change/notify exceptions; prior held pending put; nested
  transaction; exact full rollback; later normal save; retry; duplicate and consecutive
  sale; normal price/book/journal and company/personal separation; exact RNG/replay;
  save/reload and fresh durable-only Node VM hydration. Node durable IDB is a transaction
  completion model, not a claim of real browser persistence.
- `tests/ma-subsidiary-sale-save-atomicity-webkit-test.js`: actual WebKit engine with
  iPhone 13 emulation, real localStorage/IndexedDB/cache/put queue, flush, original live
  instance's later save, reload and separate fresh contexts with mirror removed. Fresh
  reads explicitly await hydrate. No physical-iPhone hardware claim.
- Shared fixture acquisitions occur before fault injection, following #925. They do not
  correct or assert acquisition failure atomicity. Fixture seed is explicit and the same
  installed sale is used in both environments.
- Node test is canonical shard H; browser execution is explicit in both M&A PR and main
  gates. Registration and workflow path contracts enforce the new routes without removing
  existing tests or changing skips/timeouts.

Successful accounting validation rebuilds derived finance statements. Reload/replay
comparisons validate both sides before comparing full economic finance state; failed
rollback checks still compare the entire original live JSON and exact stored bytes.

Keep SAVE_KEY `capitalism_tycoon_web_v1`, saveVersion9, old-save compatibility, accounting,
RNG order and company/personal ownership. Other M&A acquisition, VC, PE and stock writers
are outside this concern. Ownership Authority Cutover and Phase9 remain stopped.

The original diagnostic #925 stays unmerged; close it only after its evidence and permanent
regression migration are verified. Final published HEAD audit, applicable CI and post-merge
main evidence belong in #922/#909. Skips are excluded from PASS counts.
