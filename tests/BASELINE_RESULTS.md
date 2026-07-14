# Baseline Results

Date: 2026-07-14

## Environment

- Repository: `capitalism-tycoon-web`
- Runtime used by local verification: Node.js v24.15.0
- Test harness dependencies: Node.js standard library only
- Game source policy: `index.html` was not changed for this baseline harness.

## Successful tests

- `npm run test:syntax`
  - Extracted inline `<script>` blocks from `index.html` in document order.
  - Verified JavaScript syntax with `vm.Script`.
  - Checked inline event handler attributes when present.
- `npm run test:static`
  - Confirmed `index.html`, `DOCTYPE`, root elements, duplicate literal IDs, script tag balance, closing body/html tags, and unintended bidirectional Unicode controls.
  - Reports likely missing literal DOM IDs while allowing IDs generated dynamically from templates.
- `npm run test:save`
  - Verified required symbols are present as definitions where practical.
  - Verified `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
  - Verified new state shape, JSON serialization, save round trip, and legacy fixture loading.
- `npm run test:week`
  - Ran a normal-funds 52-week baseline from a new configured game.
  - Final week: 53.
  - Game over: false.
  - Maximum history length observed: 52.
- `npm run test:long`
  - Ran 520 weeks with a one-time stability-only cash injection at test start.
  - No unhandled exception or non-finite numeric state was detected.

## Failed tests

- None in the current baseline run.

## Tests not executed

- Real browser rendering, visual screenshots, and iPhone Safari checks are not covered by this Node-only baseline.
- Full HTML5 parser validation is not performed because no external parser dependency was added.

## Known issues observed

- `configure()` and `advanceWeek()` currently trigger multiple `save`/`emit` calls because the engine is wrapped by multiple extension layers. This PR records the baseline only and does not modify production code.
- Static DOM-ID checking is necessarily conservative without a browser/HTML parser; template-generated IDs are allow-listed when they are intentionally dynamic.
- The legacy fixture confirms top-level default backfill and JSON saveability, but current production `mergeDefaults` does not deeply migrate every array element schema.

## save/emit/render diagnostics

Measured by wrapping one `TycoonEngine` instance during `npm run test:week`:

| Operation | save calls | emit calls | `emit('week')` calls | render/change listener calls |
|---|---:|---:|---:|---:|
| `configure()` once | 5 | 11 | 0 | 5 |
| `advanceWeek(false)` once | 4 | 12 | 4 | 4 |

These counts are baseline diagnostics, not pass/fail thresholds for this PR.

## Normal-funds 52-week result

- Start: new configured game, normal difficulty, no weekly cash injection.
- Result: reached week 53.
- Week increment: exactly +1 per `advanceWeek(false)` call.
- Major numeric state: finite at each checked week.
- Saveability: JSON serialization succeeded during the run.
- History growth: 52 entries, no abnormal growth detected.

## 520-week stability test note

- This is not a balance test.
- The test adds a one-time `1,000,000,000` yen to `companyCash` and `personalCash` immediately after configuration.
- No additional weekly injection is performed.
- It can detect long-run syntax/runtime/non-finite-number failures under a solvent state.
- It cannot prove that normal game balance, bankruptcy frequency, or difficulty tuning is correct.

## Recommended next PR fixes

1. Reduce duplicate `save`, `emit('week')`, and render calls caused by layered prototype wrappers.
2. Add deeper legacy array-element normalization for stores, products, stock holdings, and inventory-like structures.
3. Add a browser-level smoke test only if a dependency/runtime such as Playwright is explicitly accepted in a later PR.
