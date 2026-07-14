# Baseline Results

Date: 2026-07-14

## Environment

- Repository: `capitalism-tycoon-web`
- Runtime used by local verification: Node.js v24.15.0
- Test harness dependencies: Node.js standard library only
- Game source policy: `index.html` now includes Phase 0 transaction consolidation for `configure()` and `advanceWeek()`.

## Successful tests

- `npm run test:syntax`
  - Extracted inline `<script>` blocks from `index.html` in document order.
  - Verified JavaScript syntax with `vm.Script`.
  - Checked inline event handler attributes when present.
- `npm run test:static`
  - Confirmed `index.html`, `DOCTYPE`, root elements, duplicate literal IDs, script tag balance, closing body/html tags, and unintended bidirectional Unicode controls.
  - Scanned repository text files (`*.html`, `*.js`, `*.json`, `*.yml`, `*.yaml`, `*.md`, `*.css`) for forbidden invisible/control characters, UTF-8 BOM, and CR/CRLF line endings.
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
- `npm run test:transaction`
  - Compared current transaction behavior against `tests/fixtures/transaction-baseline-v1.json`, generated from the pre-transaction main implementation.
  - Verified configure, 1-week, 12-week, and 52-week snapshots plus random call counts; week 52 used 6,418 random calls.

## Failed tests

- None in the current baseline run.

## Tests not executed

- Real browser rendering, visual screenshots, and iPhone Safari checks are not covered by this Node-only baseline.
- Full HTML5 parser validation is not performed because no external parser dependency was added.

## Text normalization check

- PR #3 changes `index.html` transaction handling for `configure()` and `advanceWeek()`.
- Game numbers, prices, revenue formulas, probabilities, initial funds, UI markup, and CSS were not intentionally changed.
- A pre-existing emoji ZWJ sequence in `index.html` remains allow-listed by the repository-wide text safety check; only its line number changed because transaction code was added above it.

## Known issues observed

- Static DOM-ID checking is necessarily conservative without a browser/HTML parser; template-generated IDs are allow-listed when they are intentionally dynamic.
- The legacy fixture confirms top-level default backfill and JSON saveability, but current production `mergeDefaults` does not deeply migrate every array element schema.

## save/emit/render diagnostics

Measured by wrapping one `TycoonEngine` instance during `npm run test:week`:

| Operation | save calls | emit calls | `emit('week')` calls | render/change listener calls |
|---|---:|---:|---:|---:|
| `configure()` once | 1 | 3 | 0 | 1 |
| `advanceWeek(false)` once | 1 | 2 | 1 | 1 |

These counts are now enforced by `tests/week-test.js` for the transaction-critical save/week/render counts. Remaining emits are `notify`/`saved` plus the final public event. Exception-safety checks also verify that failed Expansion, Completion, and Parity weekly operations rethrow the original error, restore transaction depth to zero, do not perform final save/week/change events, and can recover on the next operation.

## Deterministic transaction regression result

- Baseline fixture: `tests/fixtures/transaction-baseline-v1.json`.
- Scenario: configured normal game with seeded PRNG, snapshots after configure, 1 week, 12 weeks, and 52 weeks.
- Result: current code matches the pre-transaction main baseline for game state snapshots.
- Random call count: 6,418 by week 52, matching the fixture.

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

1. Add deeper legacy array-element normalization for stores, products, stock holdings, and inventory-like structures.
2. Add a browser-level smoke test only if a dependency/runtime such as Playwright is explicitly accepted in a later PR.

## Phase 0 save migration baseline update

- `npm run test:migration`
  - Verified unversioned legacy saves migrate to the current saveVersion.
  - Verified top-level defaults and array-element internals are backfilled without overwriting valid `0`, names, IDs, or unknown properties.
  - Verified current-version saves preserve core game values, array order, and IDs.
  - Verified corrupted structural types and future save versions return explicit errors and do not mutate input fixtures.
  - Verified `migrateSave(migrateSave(state))` is stable and does not grow stores, cash, news, history, or reports.

Fixed-seed transaction baseline note: adding `saveVersion: 2` is metadata/schema migration only. No game formulas, weekly order, random calls, prices, initial funds, UI, or CSS were intentionally changed.
