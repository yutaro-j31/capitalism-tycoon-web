# Stage 3 UI Enhancer Migration Progress

## Purpose

Replace observer-driven UI augmentation with a deterministic, one-way render pipeline. The production white screen was reproduced on iPhone and isolated to the `MutationObserver` / `queueMicrotask` UI enhancer chain. The core-only `boot-test.html` rendered the setup screen successfully.

## Invariants

- Preserve `SAVE_KEY=capitalism_tycoon_web_v1` and effective `saveVersion=9`.
- Do not change accounting, game formulas, deterministic state transitions, or company/personal asset separation.
- Preserve each module's existing render content and duplicate-application keys.
- Execute enhancers in registration order, matching static `index.html` script order.
- Isolate each enhancer failure so later enhancers still run.
- Reject recursive `runUIEnhancers()` calls while a pipeline pass is active.

## Stage 3-1

Status: merged and externally validated.

- Registry location: `js/ui-enhancer-registry.js` (`modules.uiEnhancerRegistry`).
- The registry loads statically immediately before `app.js`.
- It binds the `#app.innerHTML` write boundary before `app.js` starts, so `runUIEnhancers()` executes synchronously after each core `render()` DOM replacement.
- `registerUIEnhancer({ id, enhance })` appends hooks in deterministic registration order.
- Registration also applies a newly loaded enhancer to the already-rendered DOM.
- A reentry flag prevents recursive pipeline execution.
- Every hook has an independent `try/catch`; failures log the hook ID and do not stop later hooks.
- `index.html` connects the registry between `founding-tutorial.js` and `app.js` without reordering any existing script.

## Stage 3-2 migrated files

1. `js/d-ui-shell.js`
2. `js/d-ui-context-tabs.js`

Both modules retain their existing render functions and duplicate-application guards. Their `MutationObserver`, `queueMicrotask`, and scheduling loops were removed and replaced with registry registration.

## Stage 3-2 iPhone result

Status: white screen remained after the first two migrations.

This was treated as an expected result because the original narrow scan still found 74 files containing unqualified `new MutationObserver(...)` after Stage 3-2.

## Observer threshold diagnostic

A query-gated diagnostic in `js/boot-recovery.js` limits only external-JS `MutationObserver` registrations that watch `#app`, `document`, `body`, or `documentElement` with `subtree:true`. Normal URLs do not change `MutationObserver` behavior.

Physical iPhone results:

- `observerLimit=37`: starts and operates.
- `observerLimit=41`: starts and operates.
- `observerLimit=43`: starts and operates.
- `observerLimit=44`: starts and operates.
- `observerLimit=45`: white screen / startup livelock.
- `observerLimit=46`: white screen / startup livelock.
- `observerLimit=55`: white screen / startup livelock.

The source report on a working `observerLimit=44` page identified the first blocked registration as:

- `#45 real-estate-portfolio-dashboard-ui.js`

A second physical-device diagnostic disabled only the app-wide observer registered by `real-estate-portfolio-dashboard-ui.js` while leaving every other observer unrestricted. The page still white-screened. Therefore #45 is not a sufficient single-cause explanation; the failure requires cumulative observer count and/or interaction among multiple observer-driven UI modules.

The #45 module itself is still a high-risk participant: each render removes its existing dashboard, creates a replacement section, prepends it to `#app`, and its former app-wide observer scheduled another render from that DOM mutation. It did not have a same-DOM-generation application key. Stage 3-3 therefore migrates it together with the surrounding observer cluster rather than treating it as a standalone fix.

Nearby registrations were the dense real-estate UI chain (`real-estate-mortgage-refinancing-ui.js` through `real-estate-complete-cycle-ui.js`). The Stage 3-3 batch targets that cluster plus two earlier startup UI observers.

## Stage 3-3 migrated files

Status: implemented in the active PR; external validation and physical iPhone test pending.

The batch removes observer-driven redraw scheduling from exactly 20 startup UI files while preserving their rendering and action logic:

1. `js/industry-event-response-plans-ui.js`
2. `js/save-storage-ui.js`
3. `js/real-estate-tenant-renewals-ui.js`
4. `js/real-estate-tenant-collections-ui.js`
5. `js/real-estate-rent-guarantee-ui.js`
6. `js/real-estate-security-deposits-ui.js`
7. `js/real-estate-property-insurance-ui.js`
8. `js/real-estate-maintenance-reserves-ui.js`
9. `js/real-estate-property-taxes-ui.js`
10. `js/real-estate-mortgage-refinancing-ui.js`
11. `js/real-estate-property-disposals-ui.js`
12. `js/real-estate-redevelopment-projects-ui.js`
13. `js/real-estate-property-management-ui.js`
14. `js/real-estate-property-maintenance-ui.js`
15. `js/real-estate-portfolio-dashboard-ui.js` — physical threshold trigger candidate #45
16. `js/real-estate-rent-pricing-ui.js`
17. `js/real-estate-rent-performance-ui.js`
18. `js/real-estate-capex-roi-ui.js`
19. `js/real-estate-capex-actuals-ui.js`
20. `js/real-estate-complete-cycle-ui.js`

`js/real-estate-ui.js` remains observer-driven for a later audited batch because it is the large base renderer for the assets screen, unlike the smaller satellite UI modules above. Keeping it out of this batch reduces regression risk while still removing the full observer cluster surrounding #45.

For migrated modules:

- `MutationObserver` redraw hooks are removed.
- `queueMicrotask` redraw scheduling is removed.
- existing `render`/`enhance` output is retained.
- action-triggered refreshes route through `modules.uiEnhancerRegistry.runUIEnhancers()` where applicable.
- each module registers once via `registerUIEnhancer`, preserving static script order.

## Observer count reconciliation

The earlier migration notes used a narrow scan for unqualified `new MutationObserver(...)`. That scan missed constructor calls written through an environment object.

At the Stage 3-3 base there were three qualified-only observer files:

- `js/save-storage-ui.js` — `new env.MutationObserver(...)`; migrated in Stage 3-3.
- `js/physical-iphone-playtest.js` — `new env.MutationObserver(...)`; still pending.
- `js/playtest-report-ui.js` — `new env.MutationObserver(...)`; still pending.

Therefore the counts reconcile as follows:

- Narrow Stage 3-2 residual: 74 unqualified observer files.
- Comprehensive Stage 3-2 residual: 77 files = 74 unqualified + 3 qualified-only.
- Stage 3-3 migrated: 20 files = 19 unqualified + `save-storage-ui.js` qualified-only.
- Narrow Stage 3-3 residual: 55 unqualified observer files.
- Comprehensive Stage 3-3 residual: 57 files = 55 unqualified + 2 qualified-only.

The original pre-Stage-3-2 comprehensive baseline was therefore 79 observer-driven JS files, not 76. The 20-file Stage 3-3 migration itself was complete; the previous `54 remaining` figure was a counting-method error, not a migration omission.

## Migration count

- Comprehensive observer-driven JS baseline before Stage 3-2: 79.
- Stage 3-2 migrated: 2.
- Stage 3-3 migrated: 20.
- Total migrated: 22.
- Remaining observer-driven JS files: 57.

Do not begin the next migration batch until Stage 3-3 external validation is complete and the physical iPhone result is recorded below.

## Stage 3-3 iPhone result

Status: pending.

Decision after physical-device test:

- Starts and operates: continue the remaining 57 in controlled 10-20 file batches.
- Starts but is heavy or partially unresponsive: migration is effective; continue with a larger high-impact batch.
- Still white: 20 removed observers were insufficient; identify the new first-blocked threshold/source and migrate the next high-impact cluster.

## Validation required before each migration merge

- `tests/stage-3-3-observer-migration-test.js` for this batch.
- Focused UI contracts for modified modules.
- Syntax checks for all modified JavaScript.
- Registry reentry, exception isolation, and registration-order contracts.
- Module boot and dependency guards.
- Existing static, registration, accounting, capital-allocation production wiring, and 208-week validations.
- GitHub Pages iPhone test after merge, using a commit-SHA cache-busting query.
