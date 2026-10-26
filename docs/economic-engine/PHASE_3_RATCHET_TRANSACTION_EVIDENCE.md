# P3-4: weekly turnaround-ratchet Node fault evidence

Base main: `68d925aa2df618ef1495a8261ebeeb73e598f7a1`, after #1128.
Mode: `F_IMPLEMENT`. This slice extends the existing canonical ratchet test;
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

## Remaining gate

These are Node/fake-IDB cases. There is no ratchet-specific real WebKit or real
IndexedDB execution claim from this slice. Browser evidence, complete raw-caller
closure and scoped adoption review remain necessary before a future `S_PASS`.
No P3-4 cutover, P3-10 command permission, Phase 3 Exit or Phase 4 Entry is
authorized or marked complete. Owner-held inventory/specification PRs remain
separate and unmerged. Large unrelated quality campaigns remain in Stage Q.
