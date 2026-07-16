# Phase 6A-5C — Turnaround weekly report integration

## Purpose

Make an active turnaround plan visible in the normal weekly-result flow instead of requiring the player to reopen the crisis screen.

## Runtime flow

1. `player-engine-bridge.js` loads before `app.js` and captures the exact engine instance created by the application.
2. Late-loaded creditor and turnaround UI modules are bound to that live instance.
3. `player-turnaround-plan-report.js` wraps the already-installed turnaround-plan weekly lifecycle.
4. After a successful week, the plan has already been evaluated by Phase 6A-5A.
5. The report module builds a finite read-only snapshot and attaches it to `lastWeeklySummary.turnaroundPlanReport`.
6. The weekly summary modal is augmented through the existing modal root without replacing the base report.

## Report types

- `progress`: ordinary weekly progress; shown in the weekly summary and management history.
- `deadline`: two weeks or less remain; also added to news and shown as a warning toast.
- `completed`: both cash and debt targets were met; added to news and shown as a success toast.
- `failed`: the deadline arrived without both targets; added to news and shown as an error toast.

## Four-week advance

Each hidden week receives its own deterministic report state. The existing four-week action opens the final `lastWeeklySummary`; the scheduled modal enhancer inserts the final week's turnaround report after the loop completes.

## Persistence

The base weekly engine saves before the Phase 6A-5A post-week evaluation. Phase 6A-5C performs one additional save after applying a turnaround report, so plan progress, terminal status, and the report survive an immediate reload.

## Compatibility

- save key remains `capitalism_tycoon_web_v1`
- save version remains 9
- no new top-level persistent state
- only an additive field on the existing `lastWeeklySummary` object
- no cash, debt, interest, crisis, accounting, market, supply, workforce, competitor, IPO, M&A, or valuation formula changes
- no runtime randomness
- ordinary progress does not flood the main news list
- report application is idempotent by `reportID`
