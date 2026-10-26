# P3-4: installed shareholder-buyback transaction evidence

Base main: `1a853a41e40298eed0773ab1dc4d93518d78a954`, after #1132.
Mode: `F_IMPLEMENT`. Scope is targeted Node/fake-IDB evidence for the existing
`W-BUYBACK` installed writer. #1133 concerns turnaround acceptance, not this
writer; its CI is green but its review remains pending at this document's
creation. This document does not certify that PR or any whole writer family.

## Installed command and independent settlement

The test calls the final installed `buybackOwnShares()` from
`js/shareholder-returns.js`, not the inactive engine fallback. The input is a
listed company with 100,000 issued shares, no treasury shares, a personal
5,000-share lot, ¥100m company cash and a ¥100.01 execution price. Both variants
request ¥1,000,050 and independently pin settlement:

| Variant | Original founder units | Outside float | Purchased units | Company cost |
|---|---:|---:|---:|---:|
| ordinary | 60,000 | 35,000 | 9,999 | ¥1,000,000 |
| capped | 94,993 | 7 | 7 | ¥701 |

`floor(1,000,050 / 100.01) = 9,999`; `ceil(9,999 * 100.01) = 1,000,000`.
The capped case cannot repurchase the original founder units or the personal
lot: `100,000 - 94,993 - 5,000 = 7`. Expected settlement is literal fixture
evidence, not derived from the resulting treasury balance, history or receipt.
The price estimate remains fractional; only the settled money is whole yen.

The existing capacity preflight fills `finance.lastStatements` before opening
its transaction. Fixtures explicitly call that preview, assert ¥95m safe
capacity, then save the initial state. Exact rollback is measured from this
previewed state, matching the existing conservation regression. This is not a
claim that the cold preflight has no derived-cache side effect. No production
code or behavior is changed to satisfy the test.

## Faults, conservation and persistence

`tests/shareholder-buyback-save-atomicity-test.js` uses the existing shared
transaction fault harness and deterministic fake IndexedDB adapter. Both
variants cover all nine shared faults: save false, throw before admission,
mirror rejection, enqueue false/throw, throw after admission, saved/change
emission and notify. Four additional cases cover pending predecessors and
nested transactions for save-false/post-admission-throw. Two further cases
compare full failure/recovery/retry state with uninterrupted same-seed success
(one per variant). These are 24 fault configurations, plus normal paths.

The harness requires actual fault reachability, exact full live rollback and
unchanged RNG draws, exact mirror/cache/durable bytes, preservation of a held
predecessor, cancellation of the failed queued put, production reload and
fresh durable-only hydration. Recovery must exceed the observed maximum
sequence actually allocated by the failed save; retry commits once and its
latest sequence must reach the durable payload. Node fake-IDB hydration is
not native browser IndexedDB evidence.

The independent oracle checks treasury quantity/book, cash, issued shares,
founder/personal/company account separation, price and own-market mirror,
unchanged other issuers and price history, ownership ratios, outside float,
one financing receipt and one return-history row. Receipt quantity/cost and
before/after balances must agree with the pinned inputs. Finance validation,
buyback reconciliation and ownership reconciliation must all succeed.

Normal success saves once. This API takes an order amount, not an operation ID:
a second valid order is deliberately allowed. The ordinary case buys one more
share for ¥109, with a distinct receipt and exactly one additional save; full
hydration follows it. The capped case exhausts outside float and a second
request must reject without any state/save change. The test does not invent
an idempotent-order rejection policy. Critical v9 compaction/reload must retain
cash, both founder ownership buckets, treasury book and valid reconciliation.

Two negative controls must fail: disabling transaction restore must trip the
full rollback oracle; corrupting treasury quantity in a completed-state
snapshot must trip the pinned quantity oracle. Neither edits production source.

## Registration, evidence and remaining boundary

The new test is canonical-registered in shard F. At #1133 HEAD `12215de4`,
measured canonical totals were F 1,243.605s, I 1,376.031s, E 1,418.798s,
G 1,433.367s and H 1,468.936s. Placement uses this measured headroom without
changing an existing assignment or timeout. Local commands and exact-HEAD CI
results are recorded in the PR; a registration-only run is not full execution.

A dedicated real-WebKit/native-IDB counterpart remains the next evidence
slice. Existing activism/split browser tests do not prove all direct-buyback
faults. The raw engine fallback, installed caller/bypass closure, adoption and
scoped independent authority review remain separate. There is no S_PASS,
cutover, P3-10 permission, Phase 3 Exit or Phase 4 Entry claim. The six
Owner-held inventory/spec PRs remain unchanged and unmerged.
