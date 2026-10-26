# P3-4: weekly turnaround-ratchet transaction evidence

Base main: `68d925aa2df618ef1495a8261ebeeb73e598f7a1`, after #1128.
Browser follow-up base: `bd3cd7fc7f36619ac538555a82351443315fc4aa`, after #1129.
Mode: `F_IMPLEMENT`. These slices extend tests for the existing ratchet;
production JS, save semantics and ownership authority remain unchanged.

## Installed boundary

`playerCrisisTurnaroundFund.settle` can issue additional shares after the base
weekly chain when the turnaround plan fails. The outer installed
`advanceWeek(false)` transaction owns this issuance and its final save. It is
not a separate financing receipt or an independent raw-helper command.

`tests/player-crisis-turnaround-ratchet-week-rollback-test.js` retains its existing
finalize-failure, ownership reconciliation, one-time issuance and v9 critical
compaction checks. It first reaches the pre-ratchet state through the installed
fund acceptance and weekly APIs. Fresh test instances clone that state and use
the installed storage backend with the shared deterministic fake IndexedDB.

## Added proof

- Save rejection, throw before admission, mirror rejection, enqueue rejection or
  throw after admission, post-save throw, saved-event throw and ratchet-specific
  notification throw all reach the actual ratchet issuance before failure.
- Save-false and post-save-throw also cover pending predecessors and nested
  transactions. The shared helper checks exact live state and mirror/cache/
  durable bytes, canceled failed writes, production reload, fresh durable-only
  hydration, allocated failed-sequence high-water, recovery and retry.
- The actual canonical completion event `week` has a separate rollback/retry
  case. A nonexistent canonical `change` completion event is not counted.
- The independent quantity oracle uses `round(pre-week sharesOut * .15 / .85)`
  with the existing minimum of one share. It checks issuer and fund deltas,
  unchanged founder/treasury/existing holdings and no new fund-financing receipt.
- The completion-failure retry must equal an uninterrupted same-seed week in
  complete economic state. Repeating terminal settlement cannot issue again.
- A fresh-fixture mutation disabling rollback must be rejected by the live
  state oracle. No production module is changed for that control.

The test retains its canonical registration and moves from shard E to K. On
#1128, E measured 1,428.586 seconds and K 839.584 seconds; the expanded test
uses K's larger runtime headroom without changing any timeout. Final local
validation and actual new CI timing are recorded in the PR. This document describes the added
Node scope, not a completed ownership-adoption gate.

## Real browser follow-up

`tests/player-crisis-turnaround-ratchet-webkit-test.js` uses real WebKit with
an iPhone 13 viewport and real IndexedDB. A deterministic input reaches the
pre-ratchet boundary through installed fund-acceptance and weekly APIs. The
browser then invokes its own installed `advanceWeek(false)` implementation.

The 14 scenarios cover a successful week, all eight applicable shared faults,
the actual `week` event, plus pending and nested save-false/post-save-throw.
The pending predecessor is queued in the same synchronous task before the
failed week; this is a queued-write case, not a claim of an already-running
blocked native IDB request. Notifications are faulted at the ratchet itself.

Each failed case checks exact live state, mirror/cache and bytes read directly
from the native IDB store. It exports real IndexedDB, removes localStorage from
the export, and checks the complete normalized production-loaded state in a
fresh browser context before retry. Recovery must exceed the actual failed
allocator high-water; retry must commit exactly one issuance and equal the
uninterrupted same-seed week. A second fresh durable-only context checks the
committed state. The independent share/receipt oracle and terminal no-op check
also run in the browser. One deliberately broken rollback fixture must fail
the exact-live-state oracle; this is separate from the 14 positive scenarios.

Only wall-clock `lastSaveDate` and storage-only `saveSequence` are excluded
from full normalized hydration/replay comparisons. Rollback itself compares
exact live state and serialized mirror/cache/durable payloads.

The existing M&A `stock-split-atomicity` job runs this test on PR/main/manual/
scheduled events and retains `turnaround-ratchet-result.json` in its existing
artifact directory. Both workflow path filters include the new test and the
plan source; fund/shared dependencies were already covered. Registry and
workflow contracts verify registration. No timeout or existing test changes.
Actual local execution and final-HEAD CI evidence are recorded in the PR;
registration alone does not certify execution. Emulation is not physical-iPhone
proof.

## Remaining gate

This supplies focused Node and browser fault evidence, not complete runtime
writer-family adoption. Full raw-caller closure and scoped adoption review
remain necessary before a future `S_PASS`.
No P3-4 cutover, P3-10 command permission, Phase 3 Exit or Phase 4 Entry is
authorized or marked complete. Owner-held inventory/specification PRs remain
separate and unmerged. Large unrelated quality campaigns remain in Stage Q.
