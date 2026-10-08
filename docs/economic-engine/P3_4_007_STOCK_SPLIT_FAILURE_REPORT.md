# P3-4-007 — stock split save/rollback boundary (P1)

Investigation base: main `22d546ff7e012d83a6fddc34b180a7a4032ac8ea`, merged #920. This evidence-only branch changes no production implementation. Ownership Authority Cutover remains paused. New P0/P1 findings require an Owner decision under the existing #909 authorization; no stockSplit correction is included here.

## Installed path and reproduction

App `stock-split` dispatch calls `engine.stockSplit(id,2)` directly (`js/app.js`). The sole installed production declaration in `js/expansion.js` changes price/previous/issued shares/history, both account lots and average costs, and player-company issued/founder/treasury/root price. It then notifies, calls `save()` without checking its result, emits change and returns true outside the common transaction boundary. #920 changes only sellStock; this finding is independent of that correction.

Use the full production module load order and a valid listed-company fixture: issued 1,000,000, original founder 600,000, personal purchased lot 20,000 at 100, company lot 3,000 at 100, quote/root price 100, company cash 100,000,000 and personal cash 2,000,000. This deliberately uses numeric price history to isolate the save boundary; no unrelated history-format correction or malformed ratio allegation is made.

| Fault | Return/save | Live result | Flush/fresh hydration |
|---|---|---|---|
| One SAVE_KEY mirror SecurityError | stockSplit returns true; save returns false | Issued 2,000,000; founder 1,200,000; lots 40,000/6,000; averages and price 50; split history retained | Immediate mirror/cache/durable/fresh load retain baseline, but later ordinary save persists the failed split; independent fresh VM recovers doubled quantities |
| Final change emit throws after save | stockSplit throws; save returned true | Same split changes remain; complete live snapshot is not restored | Mirror/cache/durable after flush and immediate independent fresh hydration contain the failed split; later save retains it |

Cash, debt, corporate receipt count, realized personal PL and simulation RNG do not change in this fixture. This is a failed-command atomicity/persistence defect, not a claim that a valid split creates monetary wealth. Treasury is zero in the demonstrated fixture; its multiplication is identified from source, without claiming a nonzero-treasury regression was executed.

Runnable evidence: `node docs/economic-engine/reproductions/p3-4-007-stock-split-save-failure.cjs --assert-defect`. Diagnostic exit 0 establishes the defect, **not command safety**. `--assert-fixed` must fail on this base because complete state and storage rollback are absent. Tests use isolated in-memory IDB completion, production cache/queue/save/hydrate and independent fresh VM contexts; no player storage, real browser or physical iPhone claim.

## Proposed minimal correction for Owner review

Wrap the unchanged installed stockSplit body in the existing shared runTransaction/#915 commit/checkpoint and delegate final save/change. Preserve valid split quantity/average/quote/history/RNG semantics, external-stock behavior, both account ownership and no-cash/no-ledger effect. Do not introduce a private split rollback, registry authority, unrelated numeric/history changes, save migration or old-save repair.

Required proof includes direct/nested save false and post-save exceptions; all affected player roots, nonzero treasury, both lots, quotes/averages/history and full state/storage rollback; older pending writes, sequence/retry/flush/reload/fresh hydration; distinct repeated valid splits, external stocks and invalid/refused controls; normal parity/deterministic replay; retained #915–#920 regressions and actual iPhone WebKit. Final difference audit and all applicable PR/main gates remain required.

PR #920 post-merge CI status is a separate gate recorded on #909. This report does not attest that pending main CI has passed. No correction PR or new ownership capability is opened by this evidence branch.
