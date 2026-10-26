# P3-4: turnaround-fund acceptance transaction evidence

Base main: `1a853a41e40298eed0773ab1dc4d93518d78a954`, after #1132.
Mode: `F_IMPLEMENT`. Scope is the installed `acceptTurnaroundFund()` command
(`W-TURNAROUND-ACCEPT`); the later zero-cash ratchet is separate (#1129/#1130).
No production JS, financial rules, save format or ownership authority changes.

## Independent fixtures and oracle

`tests/fixtures/turnaround-fund-accept-atomicity.js` defines three new-game
inputs, all at week 2 with 10,000 issued shares, -3m company cash, 10m personal
cash and a 3m liquidity reserve. The installed valuation/crisis APIs verify
these preconditions; expected settlement is not inferred from writer outputs.

| Variant | Company property/value | Independent cash/share pins | Recovery-plan input |
|---|---|---|---|
| uncapped | 100m property / 97m company value | 15m cash; round(10,000 * 15m / 24.25m) = 6,186 shares | inactive |
| capped | 10m property / 7m company value | 15m cash; price exceeds existing 60% enlarged-share cap, so 15,000 shares | inactive |
| replace | same as uncapped | same as uncapped | an active voluntary plan, started through the installed module API |

The 15m injection is max(15m, 2 * (3m reserve + 3m shortfall)). Existing pricing
uses 25% of company value and the existing 60% cap; no new rounding or policy
is introduced. Acceptance must create one active fund/receipt and one eight-week
plan, with 12m starting cash and 18m target cash. Fund share metadata is not a
second canonical holding or proof of an identified registered external holder.

## Node and native-browser coverage

`tests/turnaround-fund-accept-save-atomicity-test.js` covers all nine shared
faults for all three variants, pending/nested save-false and post-save-throw,
and complete same-seed recovery/retry comparisons for each variant. The shared
harness checks exact live state, mirror/cache/durable bytes, failed pending-put
cancellation, failed allocated-sequence high-water, recovery, production reload
and fresh durable-only hydration. Normal acceptance saves once; repeated active
fund acceptance cannot save, issue or record another receipt. Critical v9
compaction/reload preserves operational fund/plan/cash/debt/share state.

`tests/turnaround-fund-accept-save-atomicity-webkit-test.js` exercises the same
installed command in real WebKit with iPhone 13 emulation and native IndexedDB.
Its 34 scenarios include success/all nine faults for each input plus four
pending/nested cases. Each failed state is loaded through production hydration
in a fresh context after removing localStorage from the native-IDB export;
recovery/retry is compared with an uninterrupted control for that same input,
then loaded again in a second fresh durable-only context. Native durable
payloads are read directly and compared exactly. The predecessor case queues
the save in the same synchronous task; it does not claim an already-running
blocked native IDB request. `lastSaveDate`/`saveSequence` are excluded only from
normalized hydration/replay comparisons, not exact rollback payloads.

Both runtimes assert independently pinned cash/issued quantities, unchanged
founder/treasury/personal assets/debt/RNG, one financing receipt/capital-surplus
increment, fund/plan identity, no ratchet issuance, and cancellation-history
preservation for the replacement case. Both reject deliberately disabled
rollback and wrong-issued-quantity fixtures. Observer methods delegate to the
installed implementation; injected faults do not modify production source.

## Registration and completion boundary

Node is canonical-registered in shard G. On #1132, G measured 823.571s versus
D 1,430.990s and K 1,495.922s; no existing assignment or timeout is changed.
The existing M&A stock-split-atomicity job executes WebKit on its existing
events and retains turnaround-fund-accept-result.json in its artifact folder.
Both PR/push filters include the new tests and fixture; writer/plan/shared
dependencies were already covered. Registry/workflow contracts verify wiring.
Actual local and final-HEAD CI evidence belongs in the PR; registration alone
does not attest execution, nor does emulation claim physical-iPhone testing.

This is targeted acceptance safety evidence, not a complete writer-family
adoption or S_PASS. Full caller/bypass closure, scoped adoption review,
authority activation, P3-10 execution, Phase 3 Exit and Phase 4 Entry remain
separately gated. Owner-held inventory/specification PRs remain unmerged;
unrelated broad audits and mass seed/long-run campaigns remain in Stage Q.
