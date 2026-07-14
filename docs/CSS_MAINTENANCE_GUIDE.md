# CSS Maintenance Guide

Date: 2026-07-14

## File location and loading

- Static application CSS is stored in `css/app.css`.
- `index.html` loads it from the document head with `<link rel="stylesheet" href="./css/app.css">`.
- The `./` relative path is required for GitHub Pages project-site deployment under `/capitalism-tycoon-web/`. Do not change it to a root-absolute `/css/app.css` path.

## Ordering policy

- Preserve the existing rule order in `css/app.css`.
- Do not sort selectors, merge duplicate selectors, remove apparently unused rules, or move media queries unless a separate behavior-changing PR explicitly justifies it.
- Rule order matters because the app renders many classes from JavaScript templates, and later rules/media queries may intentionally override earlier base rules.

## Mobile and safe-area styles

- Mobile rules are currently grouped in the existing `@media(max-width:1050px)` and `@media(max-width:720px)` blocks in `css/app.css`.
- iPhone safe-area support uses `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)`, and `env(safe-area-inset-right)` in the base layout and mobile modal/tab rules.
- When editing mobile styles, verify bottom navigation, modal bottom sheets, toast position, and top spacing on iPhone Safari.

## Adding or changing CSS

- Add new CSS near the related existing component rule while preserving cascade intent.
- Prefer extending the current single-file `css/app.css` structure until a later approved refactor splits CSS by feature.
- Do not add external CSS frameworks, CDN CSS, or new dependencies.
- Do not move JavaScript-generated inline width/style values into CSS unless a later PR changes rendering logic intentionally.

## Required tests after CSS changes

Run at least:

- `npm run test:css`
- `npm run test:static`
- `npm test`

`npm run test:css` verifies that `index.html` references `./css/app.css`, the file exists and is non-empty, line endings are LF without BOM, braces are balanced, local CSS assets exist, no CDN reference was introduced, and `css/app.css` still matches the extraction baseline fixture unless the baseline is intentionally updated in the same PR.

## Service worker updates

- Do not create a service worker only for CSS changes.
- If a future service worker or explicit cache asset list is added, include `./css/app.css` or the equivalent relative asset entry when the cache list is maintained manually.
- Change cache names only when required by the existing cache strategy to avoid stale `index.html` loading a missing stylesheet.

## iPhone Safari manual checklist

Automated tests do not cover real browser rendering. After CSS changes, manually verify:

- First load on GitHub Pages project URL under `/capitalism-tycoon-web/`.
- Bottom tab bar remains visible above the home indicator.
- Modal bottom sheets fit within the viewport and respect safe-area padding.
- Toasts do not overlap the bottom navigation.
- Horizontal tables and tabs scroll correctly.
- Canvas charts render with the expected accent color.
