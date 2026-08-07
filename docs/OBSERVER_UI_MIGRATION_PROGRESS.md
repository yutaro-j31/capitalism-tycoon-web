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

## Remaining migration

- Baseline observer-driven UI files: 76.
- Migrated in Stage 3-2: 2.
- Remaining: 74.

Do not begin the next migration batch until the observer threshold/source diagnostic below is recorded and the Stage 3-3 priority list is selected.

## Stage 3-2 iPhone result

Status: white screen remained after the first two migrations.

This was treated as an expected result because 74 app-wide observer modules remained.

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

Conclusion: the first reproducible failure boundary is exactly between observer registrations 44 and 45. The 45th app-wide external-JS observer is the primary trigger candidate and must be identified before choosing the Stage 3-3 batch.

A separate `observerReport=1` diagnostic displays the captured source ordering around the threshold on a working `observerLimit=44` page, including the first blocked observer (`#45`).

## Stage 3-3 next action

1. Identify observer source `#45` from the physical iPhone source report.
2. Prioritize that module plus nearby/high-impact startup UI observer modules.
3. Migrate 20 audited files to `registerUIEnhancer` without changing what they render.
4. Update this file to `22 migrated / 54 remaining`.
5. Re-run full external validation and physical iPhone startup/operation checks.

## Validation required before each migration merge

- Focused UI contracts for modified modules.
- Syntax checks for all modified JavaScript.
- Registry reentry, exception isolation, and registration-order contracts.
- Module boot and dependency guards.
- Existing static, registration, accounting, and 208-week validations.
- GitHub Pages iPhone test after merge, using a commit-SHA cache-busting query.
