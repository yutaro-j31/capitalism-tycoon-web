# JavaScript Maintenance Guide

## Loading location

`index.html` loads the game JavaScript at the end of `body` with:

```html
<script src="./js/app.js"></script>
```

Keep this location unless a dedicated initialization refactor is being performed and tested.

## Keep a classic script

`js/app.js` must remain a classic browser script. Do not add `type="module"`, `defer`, or `async` during Phase 0 maintenance because those attributes change scope and/or timing.

## Execution order matters

The current file is intentionally a physical extraction, not a logical refactor. Preserve the order of:

1. constants and master data,
2. helper functions,
3. `TycoonEngine`,
4. prototype extensions and wrappers,
5. transaction wrappers,
6. save migration helpers,
7. UI helpers,
8. delegated event listeners,
9. engine creation through `TycoonEngine.load()`,
10. final `render()`.

Prototype wrappers around methods such as `configure()` and `advanceWeek()` are order-sensitive. Reordering wrappers can change gameplay even if each wrapper still looks correct in isolation.

## Inline handlers and globals

The static HTML currently does not use inline `onclick`/`onchange`/`onsubmit` handlers. UI actions are delegated through `[data-action]`. If inline handlers are added later, remember that `js/app.js` is IIFE-wrapped and internal names are not automatically available as `window` properties.

## Global variables

Do not add new `window` exports casually. If a future change needs browser-global compatibility, document the exact handler or integration that requires it and add the smallest possible public surface.

## Where to add new code

Until the planned module split, add code in the same logical area that currently owns the behavior. Avoid moving unrelated blocks, deduplicating helpers, renaming symbols, or changing random-number call order in the same PR.

## Future module split direction

Future PRs can split `js/app.js` into areas such as state, save, engine, transactions, UI, and rendering. Each split should be small, should preserve classic-script or explicitly tested loading semantics, and should include before/after fixed-seed regression checks.

## GitHub Pages relative path

Use relative paths such as `./js/app.js`. Do not use root-absolute paths such as `/js/app.js`, because the game is published under the project subpath `/capitalism-tycoon-web/`.

## Cache update conditions

If a service worker, app shell cache, or explicit asset manifest is introduced later, add `./js/app.js` to the asset list at the same time. Update cache versions only when the existing cache strategy requires it.

## iPhone Safari checks

Manual mobile verification should cover initial load, save/load, week advancement, modals, delegated `[data-action]` buttons, chart drawing, result-card generation, file import/export where supported, and behavior after a hard refresh with cached assets.
