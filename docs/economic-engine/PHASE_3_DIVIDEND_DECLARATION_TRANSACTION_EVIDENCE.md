# P3-4: dividend declaration transaction evidence

Base main: `8baefedd248065123a7b93257faf8f24968d4f3b`, after #1133.
Mode: `F_IMPLEMENT`. Scope is the existing installed `setDividend()` command
(`W-DIV-SET`) from `js/shareholder-returns.js`. This contains targeted Node/
fake-IDB and real-WebKit/native-IDB safety evidence; quarterly cash payment
(`W-DIV-PAY`) is a separate concern.
No production code or economic/ownership/save policy changes.

## Installed setup and independent expectations

The new fixture reuses the deterministic listed-company/storage fixture from
#1134. Actual installed commands establish a 1,000-share treasury position
(cost ¥100,010), then an active ¥2.50 per-share policy. Opening issued quantity
is 100,000; original founder units are 60,000, with a separate personal
5,000-share lot. Company cash is ¥99,899,990 and safe capacity is ¥94,899,990.
The existing capacity preview is explicitly warmed before the baseline save,
matching its installed pre-transaction statement-cache behavior. Cold-preview
purity is not claimed.

| Variant | Starting per-share term | New term | Eligible shares | Planned gross |
|---|---:|---:|---:|---:|
| declare | ¥2.50 | ¥1.25 | 99,000 | ¥123,750 |
| cancel | ¥2.50 | ¥0 | 99,000 | ¥0 |

Both variants pin these inputs before execution. Expected planned totals are
literal fixture values: `1.25 * (100000 - 1000) = 123750`. They are not inferred
from the resulting history. Per-share terms remain fractional under the
existing rounding contract's estimate/per-unit boundary; actual quarterly
cash rounding remains R5c-2 and is not executed or changed in this slice.

The oracle checks the declared term, own-market mirror/yield, retained other
market fields/issuers, unchanged issued/founder/treasury quantities and ratios,
company/personal cash/debt/holdings, property and RNG. It requires one new
history row, correct treasury-excluding total and safe capacity, unchanged
prior buyback/policy history and actual-payment metadata. The entire finance
book excluding shareholder-return metadata must remain unchanged: no new
ledger receipt, cash payment, BS movement or cache drift. Company book and
ownership reconciliation must remain valid.

## Faults, recovery, repeat and compaction

`tests/shareholder-dividend-declaration-save-atomicity-test.js` invokes the
installed command through the existing shared transaction-fault harness.
Both variants cover all nine faults; four additional declaration cases cover
queued predecessors/nested transactions for save-false/post-admission-throw.
Two further retry cases (one per variant) compare full economic state with
uninterrupted same-seed success: 24 fault configurations in total.

The harness asserts actual fault reachability, exact full live state and
mirror/cache/durable bytes, preserved held predecessor, cancellation of the
failed queued put, unchanged RNG draws, production reload and fresh
durable-only fake-IDB hydration. Recovery must exceed the actual sequence
allocated by the failed save; retry must commit once and persist the latest
sequence. Only save metadata is excluded from normalized replay comparisons;
rollback bytes and live snapshots remain exact.

Normal requests save once. Repeating the same valid policy is allowed by this
amount-taking API and adds exactly one history row/save without paying cash.
An unsafe ¥1,000-per-share request (¥99m gross) must reject without changing
state/storage or saving. Critical v9 compaction/reload retains the policy,
market mirror, treasury/founder/personal holdings, cash and declaration/payment
metadata. It is not a weekly dividend-payment test.

Two negative controls must fail: disabling restore trips full-live rollback;
corrupting a completed-state planned total to ¥125,000 (including treasury)
trips the independent total oracle. Neither edits production source.

## Registration and remaining boundary

The Node test is canonical-registered in shard F. On main8baefedd, actual
canonical totals were F 1,340.141s, E 1,388.828s and G 1,456.215s. Placement
uses measured headroom; no existing assignment or timeout changes. Actual
local and final-HEAD execution is recorded in the PR, separately from a
registration-only run. Existing shareholder/activism/split tests remain.

## Real WebKit/native IndexedDB counterpart

Browser follow-up base: `a9e9cf2883cb8bdf61756d2409cef2b5ce98c297`, after
#1136. `tests/shareholder-dividend-declaration-save-atomicity-webkit-test.js`
runs the actual installed command in real WebKit/iPhone 13 emulation, using
the same independently pinned setup. A stock-lookup observer delegates to the
installed lookup and requires the expected policy term to have been reached
inside a transaction. It does not replace declaration or settlement. The
same existing capacity cache is previewed before the baseline save.

Twenty-four scenarios cover success and all nine shared faults for each
variant, plus four queued/nested declaration cases. The queued predecessor is
admitted in the same synchronous task before microtasks start; an already
running blocked native IDB request is not simulated. Every failed case checks
exact full live state and mirror/cache bytes, and reads durable bytes directly
from native IndexedDB. LocalStorage is removed from the exported storage
state; a fresh context hydrates through the production loader and must equal
the complete normalized expected state. Only lastSaveDate/saveSequence are
excluded from normalized comparisons; rollback bytes/live state remain exact.

Recovery must exceed the maximum actually observed failed-save allocation.
Each retry saves once and equals the full uninterrupted same-variant economic
state, followed by fresh durable-only hydration. Every scenario then repeats
the valid policy (one history row/save, no payment) and attempts the unsafe
¥1,000-per-share policy (no mutation or save). The full result must match
uninterrupted repeat behavior and survive another fresh durable-only context.
The same oracle checks finance-book/cash separation, policy/mirror/history and
payment metadata; a successful setting cannot masquerade as a distribution.

Two browser negative controls must fail: disabled restore trips the exact
rollback assertion, and a corrupted completed-state planned total that
includes treasury trips the independent-total assertion. Actual execution,
runtime, artifacts and final-HEAD CI are recorded in the PR. Desktop iPhone
emulation is not physical-iPhone or interactive UI-click evidence.

The existing M&A stock-split-atomicity job runs this test on its normal events
and retains `dividend-declaration-result.json` in its artifact directory. Both
PR/push filters cover the new browser test and reused declaration fixture;
its reused buyback fixture and production/shared dependencies were already
covered. Registry and workflow contracts require that wiring. Existing tests,
timeouts and canonical Node registrations remain unchanged by this browser
follow-up. No production, financial or persistence semantics are changed.

Weekly payment, complete installed caller/bypass closure and independent
authority-adoption review remain separate. This supplies no S_PASS, cutover,
P3-10 permission, Phase 3 Exit or Phase 4 Entry. The six Owner-held
inventory/spec PRs remain unchanged.
