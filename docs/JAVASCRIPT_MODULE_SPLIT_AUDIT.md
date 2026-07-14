# JavaScript Module Split Audit

Date: 2026-07-14

## Scope

This audit records the Phase 0 split of the existing internal IIFE modules from `js/app.js` into multiple classic script files. The goal was physical separation only; no game formulas, UI strings, save keys, save migrations, random-call order, prototype wrapper order, or event-listener order were intentionally changed.

## Facts observed before the split

| Internal module | Original boundary in `js/app.js` | IIFE arguments | Reads other modules | Exports / public values | Immediate side effects |
|---|---:|---|---|---|---|
| `data` | Lines 4-1825 of the pre-split file | `exports` | None | `MASTER`, `DEPARTMENT_UNLOCKS`, `PRODUCT_BLUEPRINTS`, `LUXURY_OFFERS`, `PERSONAL_INVESTMENT_OFFERS`, `OVERSEAS_COUNTRIES`, `SPORTS_TEAMS`, `MISSION_DEFS` | Defines static data and assigns exports. |
| `engine` | Lines 1826-2763 of the pre-split file | `exports`, `data` | `data` | `SAVE_KEY`, `SAVE_VERSION`, `clamp`, `finite`, `uuid`, `yen`, `compactYen`, `pct`, `rand`, `pick`, state/migration helpers, `TycoonEngine` | Defines engine class, save/migration logic, transaction behavior, and assigns exports. |
| `expansion` | Lines 2764-3123 of the pre-split file | `exports` | No module argument; receives `TycoonEngine` later through `installExpansion` | `FOUNDER_TRAITS`, `FOUNDER_HOME_PRODUCTS`, `SUPPLIER_OFFERS`, `VERTICAL_INTEGRATION_OFFERS`, `RD_PROJECTS`, `PERSONAL_REAL_ESTATE_OFFERS`, `LUXURY_AUCTION_POOL`, `SUCCESSOR_CANDIDATES`, `installExpansion` | Defines data and installer only; prototype changes happen when `installExpansion(TycoonEngine)` is called by the final app IIFE. |
| `completion` | Lines 3124-3313 of the pre-split file | `exports` | No module argument; receives `TycoonEngine` later through `installCompletion` | `MEDIA_ACTIONS`, `TRANSPORT_REBUILD_ACTIONS`, `ENDING_DEFS`, `installCompletion` | Defines data and installer only; prototype changes happen when installed. |
| `parity` | Lines 3314-3420 of the pre-split file | `exports` | No module argument; receives `TycoonEngine` later through `installParity` | `KEY_PERSON_ROLES`, `installParity` | Defines data and installer only; prototype changes happen when installed. |
| final UI / startup | Lines 3421-3809 of the pre-split file | `engineModule`, `dataModule`, `expansionModule`, `completionModule`, `parityModule` | All prior modules | None; local UI helpers remain private | Calls installers in order, calls `TycoonEngine.load()`, creates UI state, registers event listeners, registers resize listener, then calls `render()`. |

## Dependency facts

- The only shared registry in the original file was the local `__modules` object.
- The `engine` module depends on the `data` module through its second IIFE argument.
- `expansion`, `completion`, and `parity` do not receive the engine module at definition time; they expose installer functions that modify `TycoonEngine.prototype` later.
- The final app IIFE depends on all module export objects and is the only location that calls `installExpansion`, `installCompletion`, `installParity`, and `TycoonEngine.load()`.
- No implicit lexical variables were shared between module IIFEs other than the original `__modules` registry.

## Browser/global dependencies

- `engine` uses `globalThis.crypto`, `localStorage`, `Blob`, and event primitives through `TycoonEngine` methods.
- The final app IIFE uses `window`, `document`, DOM nodes, `URL`, `FormData`, canvas APIs, `requestAnimationFrame`, and `getComputedStyle`.
- `expansion`, `completion`, and `parity` use `Math.random()` inside installed weekly behavior and helper methods.

## Prototype extension order

The original final app IIFE installed prototype extensions in this exact order:

1. `installExpansion(TycoonEngine)`
2. `installCompletion(TycoonEngine)`
3. `installParity(TycoonEngine)`
4. `TycoonEngine.load()`

The split keeps that order in `js/app.js`. This matters because each installer wraps existing prototype methods, including `configure()`, `advanceWeek()`, and value calculation helpers.

## Immediate execution, events, and random calls

- Defining `data`, `engine`, `expansion`, `completion`, and `parity` does not create the game engine instance.
- `TycoonEngine.load()` still runs in the final app script after all prototype installers.
- UI event listener registration remains after DOM reference creation and before `downloadResultCard`, `drawLine`, `drawCharts`, resize registration, and the final `render()` call.
- The split adds module-load validation throws before module bodies execute; normal successful execution does not add random calls.

## Registry decision

- Adopted registry: `globalThis.__capitalismTycoonModules`.
- `js/runtime.js` initializes it once with `Object.defineProperty` as a non-enumerable property.
- Re-loading `runtime.js` preserves the existing registry object.
- Re-loading a module file throws a clear duplicate-registration error before overwriting that module export object.

## Inferences and assumptions

- Because no IIFE referenced variables declared in a previous IIFE except through `__modules`, replacing the local registry with the shared non-enumerable registry is sufficient for classic script separation.
- Because scripts remain classic, synchronous, and loaded at the same body-end location, DOM availability and execution timing remain equivalent to the previous single extracted script.
