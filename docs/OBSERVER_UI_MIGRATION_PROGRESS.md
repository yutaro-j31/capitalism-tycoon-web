# Stage 3 UI Enhancer Migration Progress

## Purpose

Replace observer-driven UI augmentation with a deterministic one-way enhancement pipeline. The production iPhone white screen was isolated to cumulative app-wide `MutationObserver` redraw chains that schedule additional DOM work.

## Invariants

- Preserve `SAVE_KEY=capitalism_tycoon_web_v1` and effective `saveVersion=9`.
- Do not change accounting, game formulas, deterministic state transitions, or company/personal asset separation.
- Preserve existing renderer output, action logic, and duplicate/render keys.
- Execute enhancers deterministically in static script registration order.
- Isolate enhancer failures and reject recursive pipeline execution.

## Completed stages

### Stage 3-1 / 3-2

Merged and externally validated. `js/ui-enhancer-registry.js` was introduced and `js/d-ui-shell.js` plus `js/d-ui-context-tabs.js` were migrated. The production iPhone still white-screened.

### Observer threshold diagnosis

Physical iPhone results on the pre-Stage-3-3 production tree:

- `observerLimit=37`, `41`, `43`, `44`: starts and operates.
- `observerLimit=45`, `46`, `55`: white screen / startup livelock.

The 45th tracked registration was `real-estate-portfolio-dashboard-ui.js`, but disabling only that observer still produced a white screen. The failure is therefore cumulative and/or multi-observer interaction rather than a sufficient single-module cause.

### Stage 3-3

Merged and externally validated. Twenty observer-driven UI modules were migrated to the registry. Comprehensive residual observer-driven JS files fell from 77 to 57. The normal production iPhone URL still white-screened.

The comprehensive count includes qualified constructors such as `new env.MutationObserver(...)`; the earlier narrow count did not.

## Startup Observer diagnostic after Stage 3-3

A dedicated same-origin diagnostic recorded every external app-wide observer whose `observe()` call actually occurs during initial page load.

Physical iPhone result:

- tracked startup registrations: **56**
- unique startup source files: **56**

A second physical-device threshold test on this Stage-3-3 tree showed:

- `observerLimit=36`: **starts and operates**

This gives Stage 3-4 a concrete target: remove 20 startup registrations while preserving game behavior.

## Stage 3-4 migrated files

Status: implementation complete; external offline validation pending. Do not merge until validation approval.

Exactly 20 startup observer modules are migrated. `app.js` remains unchanged. Every file below was observed by the physical-device startup-source diagnostic during initial page load.

1. `js/capital-allocation-decision-memo.js`
2. `js/capital-allocation-forecast.js`
3. `js/capital-allocation-policy.js`
4. `js/capital-allocation-recovery-funding-outcome.js`
5. `js/capital-allocation-score.js`
6. `js/competitor-dashboard-ui.js`
7. `js/group-capital-allocation-execution.js`
8. `js/group-capital-allocation-plan.js`
9. `js/inter-subsidiary-synergy-performance.js`
10. `js/ma-portfolio-summary-ui.js`
11. `js/new-business-market-analysis.js`
12. `js/player-crisis-creditor-ui.js`
13. `js/player-crisis-ui.js`
14. `js/player-turnaround-plan-ui.js`
15. `js/playtest-report-ui.js`
16. `js/release-diagnostics-ui.js`
17. `js/shareholder-returns.js`
18. `js/subsidiary-mandate-apply.js`
19. `js/treasury-prepayment.js`
20. `js/treasury-refinancing-policy.js`

The batch deliberately avoids `app.js`. It also avoids changing the underlying business/accounting algorithms in these modules; only the UI refresh trigger is moved from observer/microtask scheduling to the registry pipeline.

### Registration before the registry loads

Some Stage 3-4 modules load before `ui-enhancer-registry.js`. Moving the registry to immediately after `runtime.js` was considered, but rejected for this stabilization batch because it would newly wrap `#app.innerHTML` across the entire early boot sequence and broaden the behavioral change beyond the observer migration itself.

Instead, early modules enqueue enhancer definitions in `globalThis.__capitalismTycoonPendingUIEnhancers`. The registry contract is:

1. the pending array is drained with `splice(0)`, so it is empty before definitions are processed;
2. duplicate pre-init enhancer IDs are suppressed and registered exactly once;
3. non-duplicate definitions are processed FIFO, preserving `index.html` script order.

These guarantees are exercised directly by `tests/stage-3-4-startup-observer-migration-test.js` in addition to static checks.

For every Stage 3-4 migrated module:

- observer-driven redraw registration is removed;
- `queueMicrotask` redraw scheduling is removed;
- existing render/enhance and action behavior is retained;
- action-triggered refreshes call the central enhancer pipeline where required.

## Observer counts after Stage 3-4

Expected and contract-tested counts on the Stage 3-4 implementation:

- unqualified `new MutationObserver(...)` files: **36**
- qualified-only observer files: **1** (`physical-iphone-playtest.js`)
- comprehensive residual observer-driven JS files: **37**
- total migrated since Stage 3-2: **42** = 2 + 20 + 20

A post-merge physical-device test is still required because the exact set of 36 startup observers after migration is not identical to the artificial `observerLimit=36` subset.

## Validation required before merge

- `tests/stage-3-4-startup-observer-migration-test.js`
- migrated-file syntax checks
- registration contract and shard registration
- existing static checks
- module boot / dependency guards and unconnected-JS check
- accounting invariants and `finance.validate`
- 208-week simulation with balance-sheet difference 0
- physical iPhone test after merge using a commit-SHA cache-busting query

## Remaining observer policy

After Stage 3-4, approximately 37 observer-driven JS files remain. After the Stage 3-4 physical iPhone check, rerun the startup-source diagnostic and classify the residual set into:

1. observers whose `observe()` runs during initial startup — migrate all of these;
2. observers registered only after a later screen/action — lower priority, but migrate where practical to remove future recurrence risk.

No new feature work should resume until the startup white-screen issue is resolved on the normal production URL.
