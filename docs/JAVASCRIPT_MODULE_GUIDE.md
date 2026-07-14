# JavaScript Module Guide

Date: 2026-07-14

## Files and responsibilities

| File | Responsibility |
|---|---|
| `js/runtime.js` | Initializes the internal module registry only. It must not contain game logic. |
| `js/data.js` | Static master data and data-module exports. |
| `js/engine.js` | Core engine, state defaults, save/load, migrations, transactions, formatting helpers, and `TycoonEngine`. |
| `js/expansion.js` | Expansion-layer constants and `installExpansion()`. |
| `js/completion.js` | Completion-layer constants and `installCompletion()`. |
| `js/parity.js` | Parity-layer constants and `installParity()`. |
| `js/app.js` | Final UI helpers, startup, installer calls, `TycoonEngine.load()`, DOM references, event listeners, chart drawing, and first `render()`. |

## Required loading order

`index.html` must load these classic scripts, synchronously, at the end of `body`:

```html
<script src="./js/runtime.js"></script>
<script src="./js/data.js"></script>
<script src="./js/engine.js"></script>
<script src="./js/expansion.js"></script>
<script src="./js/completion.js"></script>
<script src="./js/parity.js"></script>
<script src="./js/app.js"></script>
```

Do not add `type="module"`, `defer`, or `async` without a separate timing-focused refactor and regression proof.

## Internal registry

The only new intended global is `globalThis.__capitalismTycoonModules`. It stores internal export objects for the classic scripts and is defined as non-enumerable by `js/runtime.js` so it does not appear in ordinary object enumeration or save JSON.

Do not add new globals for individual constants, classes, utility functions, UI functions, or game state. If future browser integration truly needs a public global, document the reason and expose the smallest possible surface in a separate PR.

## Dependencies

- `runtime.js` must be first.
- `data.js` requires the runtime registry.
- `engine.js` requires `data.js`.
- `expansion.js`, `completion.js`, and `parity.js` require the runtime registry and expose installers.
- `app.js` requires all previous module export objects and all three installers.

## Why classic scripts remain

This Phase 0 split preserves the prior browser semantics: body-end execution, shared classic-script timing, and no module loader. ES modules would change scope, strictness details, loading/dependency behavior, and default deferral semantics, so they are intentionally deferred until a later audited migration.

## Prototype extension order

Keep installer calls in `js/app.js` in this order:

1. `installExpansion(TycoonEngine)`
2. `installCompletion(TycoonEngine)`
3. `installParity(TycoonEngine)`
4. `TycoonEngine.load()`

Changing this order can change wrapper nesting around `configure()`, `advanceWeek()`, and weekly subsystem updates.

## Adding a subsystem

1. Decide whether it belongs in one of the existing files; do not create a new file during Phase 0 unless a future plan explicitly permits it.
2. Add data or methods in the current owning module without renaming existing symbols.
3. Preserve random-call order and event-listener order.
4. Add or update tests before changing baseline fixtures.
5. Run all package scripts, including `npm run test:modules`.

## Changing existing modules

Run at least:

- `npm run test:syntax`
- `npm run test:static`
- `npm run test:javascript`
- `npm run test:modules`
- `npm run test:save`
- `npm run test:migration`
- `npm run test:load`
- `npm run test:week`
- `npm run test:long`
- `npm run test:transaction`
- `npm run test:css`

Do not update fixed-seed baselines to hide a behavior change from a physical split.

## GitHub Pages paths

Use project-relative paths such as `./js/app.js`. Do not use root-absolute paths such as `/js/app.js`, because the site is served under `/capitalism-tycoon-web/` on GitHub Pages.

## iPhone Safari manual checks

Verify initial load, save/load, slot save/load, import/export where supported, week advancement, modal actions, chart drawing, result-card generation, hard refresh with cached assets, and no blank screen from script-order failures.

## Future split direction

Further splits should be smaller and subsystem-based only after this module boundary is stable. Recommended future candidates are save/migration, state defaults, weekly engine, rendering screens, actions, charts, and individual business systems.

## market.js
Load order is `runtime.js`, `data.js`, `market.js`, `engine.js`, `expansion.js`, `completion.js`, `parity.js`, `app.js`. The module registers as `__capitalismTycoonModules.market` and does not bulk-publish functions to `window`.
