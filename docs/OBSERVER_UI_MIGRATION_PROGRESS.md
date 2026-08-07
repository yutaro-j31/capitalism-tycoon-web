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

Status: implemented in the active PR; external validation pending.

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

The remaining list must be migrated in audited batches after the Stage 3-2 iPhone result. Do not begin the next batch until that result is recorded here.

## Stage 3-2 iPhone result

Status: pending.

Decision after physical-device test:

- Starts and operates: continue remaining 74 in controlled batches.
- Starts but remains slow or partially unresponsive: continue with a larger audited batch and remeasure.
- Still white: migrate 10-20 additional observer modules before the next measurement.

## Validation required before merge

- Focused D UI shell and context-tab contracts.
- Syntax checks for all modified JavaScript.
- Registry reentry, exception isolation, and registration-order contracts.
- Module boot and dependency guards.
- Existing static, registration, accounting, and 208-week validations.
- GitHub Pages iPhone test after merge, using a commit-SHA cache-busting query.
