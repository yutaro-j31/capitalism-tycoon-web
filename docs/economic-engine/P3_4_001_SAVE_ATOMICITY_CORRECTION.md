# P3-4-001 — Synchronous save acceptance and rollback

Tracker: #909. Owner correction authorization: 2026-10-08 15:08 JST. Base: `c574a7a42e9ffc302cf63a622f8023c132d8b3d0`.

The existing financed-M&A command could return false and restore live/localStorage state while
its rejected acquisition, issuance and loan remained in the IDB cache/queue and survived fresh
hydration. This correction changes only persistence acceptance/rollback. Ownership Authority
Cutover remains stopped until this PR passes, merges and its main CI is verified.

## Commit boundary

- Decide the localStorage mirror write before IDB cache/queue mutation. Non-quota mirror failures
  reject the save without admitting its candidate. Quota failures retain the existing IDB fallback.
- A synchronous storage checkpoint captures exact previous mirror bytes/cache presence and the
  earlier queued writes. Rollback restores that cache/mirror and cancels only new puts/deletes from the
  same synchronous boundary, before their IDB transactions can start. Earlier accepted pending
  saves continue in order. It does not enqueue a compensating old save or rewrite durable history.
- The adapter also checkpoints each candidate: synchronous enqueue rejection/throw restores an
  already-written mirror and cancels a partially enqueued candidate before returning failed save.
- Inaccessible mirror reads are captured without throwing at transaction entry; a save rejects
  before replacing bytes when it cannot snapshot the mirror. IDB checkpoints still exist. If a
  later read fails during rollback, restoration uses the known entry bytes directly.
- `checkpointSaveStorage()` selects the engine's persistence boundary. Production uses the
  main adapter; detached benchmark engines checkpoint their isolated namespace, and the
  memory-only growth fixture has no storage boundary. The benchmark never reads player saves.
- Outermost engine transactions cover final save and emit. Failed save returns false and restores
  live state, journals, quantities, RNG and storage. The canonical weekly boundary carries the
  same rollback closure through deferred final normalization/save/emit. Financed M&A and import
  use this common storage checkpoint alongside their existing live-state rollback.
- Checkpoints are for synchronous boundaries, not an API for undoing a completed asynchronous
  transaction after yielding to the event loop. No persistent checkpoint/registry/adoption root.

## Preserved asynchronous contract

`save() === true` continues to mean synchronous acceptance/enqueue, not confirmation that an
asynchronous IDB transaction has completed. `flush()` still waits for the queue, and IDB errors
still surface in `status().lastWriteError`; an asynchronous put failure does not retroactively
reject an already accepted economic command. The accepted state remains in live/cache/mirror
when the mirror succeeded; fresh boot selects its newer sequence and reconciles the older IDB
replica through the existing recovery rule. A later successful save clears the write error.

As before, when the mirror is quota-blocked, durability depends on successful IDB completion.
Simultaneous failure of both storage media cannot guarantee persistence; this correction does
not claim cross-store distributed transactions or change the synchronous API to await IDB.
The rejected-command bug is removed by preventing rejected candidates from entering its queue,
including when a subsequent synchronous command failure rolls back an accepted enqueue.

Failed attempts may leave sequence gaps; never reuse or rewind an observed saveSequence. Keep
authoritative boot/newest-copy selection, old-save normalization, quota compaction and recovery,
SAVE_KEY, saveVersion 9, accounting/receipt scopes and RNG order. Do not repair old inconsistent
saves, delete user saves or migrate ownership/stock-market/M&A settlement authority.

## Evidence required

`tests/save-storage-commit-atomicity-test.js` exercises the final installed financed-M&A command,
one-shot mirror failure, synchronous backend reject/throw, post-save rollback, an earlier IDB
put still in flight, consecutive saves/sequence gaps, async IDB transaction abort, quota fallback,
save/reload/fresh-context hydration and successful recovery saves. It also exercises actual P2
buyback, canonical weekly persistence and import rollback through the shared boundary. Exact
live snapshots and stored bytes cover rejected quantities, cash, journals and RNG; accepted
reload comparisons use existing load normalization for optional subsidiary defaults.

The continuation also covers denied mirror method/property reads and a read denied during
rollback, plus isolated backend cancellation/byte restoration. The pre-existing critical-money
guard now requires a failed final save to reject its transaction and restore the entire live
snapshot; it still requires exact old durable bytes and the same error reason. The original
assertion that a corrupt transaction returned success contradicted the approved failure boundary.
The unchanged iPhone baseline probe regression enforces zero production mirror access.

Run existing M&A accounting/determinism/save/atomicity, transaction/week rollback, IDB boot,
quota/compaction/import/save compatibility and P0.5/P1/P2 acceptance checks. Verify canonical,
Strategy and actual iPhone WebKit CI, independent origin/main...HEAD A–L audit and no unresolved
findings before Gate PASS/merge. Main/push WebKit and post-merge CI must finish before resuming
P3-4. No physical iPhone test is implied by the VM fault tests or CI WebKit.
