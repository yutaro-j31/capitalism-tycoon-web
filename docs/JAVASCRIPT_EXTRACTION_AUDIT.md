# JavaScript Extraction Audit

## Scope

This audit records the Phase 0 extraction of the game JavaScript from `index.html` into `js/app.js`. It separates direct code facts from implementation inferences used to keep runtime behavior unchanged.

## Facts observed before extraction

- `index.html` contained exactly **1** `<script>` element.
- The script had no `type`, `src`, `defer`, or `async` attributes, so it executed as a classic inline script.
- The script appeared at the end of the document immediately before `</body></html>`.
- The script content was a single immediately invoked wrapper: `(()=>{'use strict'; ... })();`.
- No `DOMContentLoaded` listener was used.
- No `load` listener was used.
- A `resize` listener was registered with `window.addEventListener('resize', ...)` near the end of the script.
- No `document.currentScript` usage was present.
- No `import` or `export` statements were present.
- No dynamic script creation via `document.createElement('script')` was present.
- No literal nested `<script` text was present in the JavaScript source.
- There were no JavaScript-non-executable script types such as `application/ld+json`, `application/json`, `importmap`, or template scripts.
- There were no HTML inline event handler attributes such as `onclick`, `onchange`, or `onsubmit` in the static HTML markup.
- Game UI actions are wired by delegated event listeners that look for `[data-action]` elements.

## Script execution order

1. Classic script starts when the parser reaches the script tag at the end of `body`.
2. The top-level IIFE creates `__modules`.
3. Internal module functions are invoked in source order.
4. Master data, helper functions, save migration helpers, `TycoonEngine`, prototype wrappers, UI helpers, delegated event listeners, and engine event listeners are defined in that same source order.
5. `const engine = TycoonEngine.load();` creates the game engine after prototype wrappers have been installed.
6. `render();` is called at the end of the script after listeners have been registered.

## Global and exposed names

- The classic script is wrapped in an IIFE, so its `const`, `let`, `class`, and function declarations are not intentionally exported to `window`.
- No `window.someName = ...` assignments were found.
- Browser globals used by the script include `window`, `document`, `localStorage`, `URL`, `Blob`, `FormData`, `CustomEvent`, `EventTarget`, `crypto`, `Math`, `setTimeout`, `requestAnimationFrame`, and canvas APIs.
- Because static HTML has no inline handler attributes, no extra global function exposure is required for handler compatibility.

## Prototype wrapping and dependency notes

- `TycoonEngine` is declared before prototype extensions and wrappers.
- Expansion, completion, and parity installers wrap methods such as `normalize`, `configure`, `advanceWeek`, `companyValue`, and `personalNetWorth` after `TycoonEngine` is defined.
- Multiple wrappers depend on the previous wrapper being installed first, so physical source order must not change.
- Transaction wrapping around `configure()` and `advanceWeek()` is part of the existing source and was moved without editing.

## Scripts moved

- The single classic executable script from `index.html` was moved to `js/app.js`.
- A boundary comment was added at the top of `js/app.js` to identify the original script boundary. The JavaScript identity test ignores only this boundary comment and outer whitespace.

## Scripts left in index.html

- No non-game, JSON, manifest, import map, template, structured data, or embedded-document script elements existed.
- Therefore no script elements were intentionally left inline.

## Facts after extraction

- `index.html` now references `./js/app.js` with `<script src="./js/app.js"></script>`.
- The external script remains a classic script: no `type="module"`, `defer`, or `async` attributes were added.
- The script tag remains at the same end-of-body location, preserving parser timing as closely as possible for GitHub Pages.
- `js/app.js` is loaded through a relative `./js/app.js` path suitable for `/capitalism-tycoon-web/` project-site deployment.

## Inferences and verification rationale

- Moving the code to a classic external script at the same document location preserves top-level classic-script execution semantics for this source because it was already IIFE-wrapped and does not depend on `document.currentScript`.
- Since no static inline handlers exist, keeping the code as a classic script is sufficient for compatibility; no additional `window` assignments were needed.
- Since no service worker or cache manifest was found, no cache asset list required an `app.js` update.
- Runtime equivalence is protected by comparing `js/app.js` against `tests/fixtures/embedded-javascript-baseline.js` and by running the existing fixed-seed, save, migration, week, long-run, and transaction tests against the production script path.
