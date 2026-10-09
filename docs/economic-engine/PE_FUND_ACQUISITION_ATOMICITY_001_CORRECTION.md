# PE-FUND-ACQUISITION-ATOMICITY-001 — PE acquisition commit boundary

Trackers: #922 / #909. Owner production correction approval: 2026-10-09.
Base main: `e16ad610b8fb2a3261bab46b0176c9886283caf7`.
Diagnostic Draft #927 is not merged into this correction.

The installed PE target dispatch bypassed the ordinary company acquisition's transaction.
`closeFundAcquisition` changed fund cash, co-investment contributions/payment, holdings, LP
outcomes and target/deal/history/news, ignored a false final save, and retained accepted writes
when save or saved/change listeners threw. The original diagnostic returned true after savefalse,
debited fund cash by 10,941,687,176 and retained an acquired deal. Further Node and real WebKit
diagnostics proved that subsequent saving resurrected rejected live changes, or that an accepted
candidate survived flush/reload/fresh hydration after an exception.

## Minimal production change

Only the PE branch of `completeTargetAcquisition` enters existing `runTransaction`, before
`ds.ensure` and final validation. Its existing closing calculations, fund/coinvest settlement,
portfolio production-site construction, LP refresh and histories execute inside that boundary.
The common commit performs final save/change; the closing helper no longer saves/emits directly.
This reuses #915 storage checkpoint/queue cancellation and the existing live-state snapshot.
PE history append also uses a new global array and detaches flat deal-history rows before
trimming. Native history rows are shared between oppositely ordered arrays; mutating/shift-trimming
them made the common snapshot's index reconciliation overwrite earlier rows. This PE-only
copy-on-write preserves successful saved values/order/caps and lets the same checkpoint restore
failure state. There is no custom rollback, compensation write or new persistence mechanism.

Non-PE dispatch to the existing base method and other PE/VC/M&A writers remain unchanged.
Normal closing retains notify → saved → change, one accepted save, the same financing plan,
portfolio economics and deterministic derivation/RNG consumption. Company/personal cash and
company accounting do not pay the fund's acquisition price.

SAVE_KEY remains `capitalism_tycoon_web_v1`, saveVersion remains 9, and old-save normalization
is unchanged. Sequence gaps from rejected attempts remain valid; sequences are not rewound.
Save success still means synchronous admission, not asynchronous IDB durability confirmation.
Ownership Authority Cutover and Phase 9 remain stopped; no old inconsistent-save repair.

## Permanent evidence

- `pe-fund-acquisition-save-atomicity-test.js`: actual full-runtime fund formation, supply, DD
  and accepted offers for fund-only and positive co-investment cases. Company endowment uses
  matching default finance state before weekly processing. Canonical shard J owns execution.
- Full snapshots and exact mirror/cache bytes cover savefalse, mirror SecurityError, enqueue
  reject/throw after admission, post-save throw, saved/change/notify throws, an earlier put held
  in flight, recovery saving, nested transaction, native shared history rows at both history caps, and LP outcome rollback.
- Normal fund-only/coinvest and LP cases assert financing/holding values, account separation,
  finance/RNG equality, one save, event order, duplicate rejection, deterministic replay and
  complete production reload/fresh durable-only hydration after existing normalization.
- `pe-fund-acquisition-save-atomicity-webkit-test.js`: real WebKit, iPhone13 emulation, real
  IndexedDB puts/flush, predecessor queue preservation, recovery saving, actual page reload and
  fresh context with localStorage removed and explicit hydrate. Both PR/main M&A gates run it.
- LP restriction fixtures use actual addLPCommitment and a controlled largeCap tier marker to
  witness outcome mutation. They do not claim natural largeCap/LP-fundraising reachability.
- Existing PE acquisition/multi-fund, coinvest ledger, corporate M&A closing/accounting,
  common save checkpoint and Phase0.5/1/2 Acceptance are related regressions.

The exact permanent false-save assertion is RED on pristine base and GREEN after the boundary
change. Separate base/fix runs compare the complete successful economic state and stored state
for fund-only/coinvest, with/without LP, including event order/save count. The original #927
probe is also executed unchanged against the fixed production path.

Final published-HEAD independent diff audit, all applicable PR CI and post-merge main CI/real
WebKit are recorded in #922/#909 after execution. Scope skips are not PASS. No physical iPhone,
retroactive old-save repair or synchronous rejection of later asynchronous IDB abort is claimed.
