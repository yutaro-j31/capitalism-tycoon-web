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
- Phase 0 now uses `deepNormalizeState()` after top-level `mergeDefaults()` so major saved array entities are backfilled at element level. Arrays that are log-only/string-only or currently not represented by object entities are normalized as arrays but do not receive per-object defaults unless they are listed in `ARRAY_ENTITY_KINDS`.

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

1. Add browser-level smoke testing only if a dependency/runtime such as Playwright is explicitly accepted in a later PR.
2. Continue adding entity defaults and versioned migrations when future phases add market, accounting, inventory, or employee substructures.

## Phase 0 save migration baseline update

- `npm run test:migration`
  - Verified unversioned legacy saves migrate to the current saveVersion.
  - Verified top-level defaults and array-element internals are backfilled without overwriting valid `0`, names, IDs, or unknown properties.
  - Verified current-version saves preserve core game values, array order, and IDs.
  - Verified corrupted structural types and future save versions return explicit errors and do not mutate input fixtures.
  - Verified `migrateSave(migrateSave(state))` is stable and does not grow stores, cash, news, history, or reports.

Fixed-seed transaction baseline note: adding `saveVersion: 3` stock history schema migration is metadata/history-shape only. No game formulas, weekly order, random calls, prices, initial funds, UI, or CSS were intentionally changed.


## Phase 0 save/load integration baseline update

- `npm run test:load`
  - Verified an unversioned legacy SAVE_KEY is adopted through the real `TycoonEngine.load()` path and can then be explicitly re-saved as the current `saveVersion`.
  - Verified corrupted JSON and future-version SAVE_KEY values are not adopted, do not call `localStorage.setItem(SAVE_KEY, ...)`, and remain byte-for-byte unchanged during fallback.
  - Verified fallback engines created after startup load failure block automatic main SAVE_KEY saving until an explicit new game/reset/valid import/valid slot load clears the transient flag.
  - Verified valid legacy slots migrate and save the migrated state to the main SAVE_KEY while leaving the original slot string unchanged.
  - Verified corrupted slots return failure, keep the current game state, keep the slot string, and keep the main SAVE_KEY unchanged.
  - Verified valid legacy JSON import migrates and saves, while corrupted JSON and future-version imports throw to the caller and keep state plus main SAVE_KEY unchanged.
  - Verified missing IDs receive deterministic legacy IDs, valid existing IDs and references are preserved, and duplicate IDs in the same array are explicit migration errors.

## Remaining verification limits

- Real browser rendering and iPhone Safari remain unverified in this Node-only test suite.
- GitHub Actions cannot be observed locally, but `npm test` now includes syntax, static, save compatibility, migration, save/load integration, week, transaction, and long-run checks.

## Phase 0 CSS extraction baseline update

- Static CSS was externalized from the single `index.html` `<style>` element into `css/app.css`.
- The game JavaScript was not intentionally changed for this extraction.
- Game logic, save data compatibility, `SAVE_KEY`, `saveVersion`, weekly processing, random processing, prices, profits, probabilities, and balance values were not intentionally changed.
- `index.html` now references `./css/app.css`, a relative path suitable for GitHub Pages project-site deployment.
- `npm run test:css` was added and is included in `npm test`.
- CSS identity is verified against `tests/fixtures/extracted-css-baseline.css`, captured from the extracted inline stylesheet content.
- Real browser rendering, visual screenshots, and iPhone Safari checks remain outside this Node-only automated verification and should be checked manually after deployment or in a later browser-test PR.

## Phase 0 JavaScript extraction baseline update

- The game JavaScript was externalized from the single executable `index.html` script into `js/app.js`.
- The code execution order and code body were not intentionally changed; only the script tag and an extraction boundary comment were added.
- Game numbers, UI text, HTML body structure, and CSS were not intentionally changed.
- `index.html` now references `./js/app.js`, a relative path suitable for GitHub Pages project-site deployment.
- `npm run test:javascript` was added and is included in `npm test`.
- JavaScript identity is verified against `tests/fixtures/embedded-javascript-baseline.js`, captured from the original embedded script during extraction.
- Fixed-seed and deterministic regression coverage remains provided by the existing week, long-run, save/load, migration, and transaction tests, now loading `js/app.js` through `index.html` script resolution.
- Real browser rendering and iPhone Safari behavior are outside the automated Node.js verification scope and should be checked manually before release.

## Phase 0 JavaScript module split baseline update

- The former internal IIFE modules were physically split into `js/runtime.js`, `js/data.js`, `js/engine.js`, `js/expansion.js`, `js/completion.js`, `js/parity.js`, and `js/app.js`.
- The split preserves the existing classic script order, module boundaries, installer order, `TycoonEngine.load()` timing, and first `render()` timing.
- Game logic, UI text, CSS, prices, revenue formulas, probabilities, initial funds, `SAVE_KEY`, and `saveVersion` were not intentionally changed.
- Fixed-seed transaction regression still matches `tests/fixtures/transaction-baseline-v1.json`, including configure, 1-week, 12-week, and 52-week snapshots and the recorded random-call count.
- Save compatibility tests continue to verify `SAVE_KEY: capitalism_tycoon_web_v1`, current save version handling, unversioned legacy migration, future-version rejection, corrupted-save overwrite prevention, slot loading, and JSON import/export behavior.
- Automated checks include `npm test`, `npm run test:syntax`, `npm run test:static`, `npm run test:javascript`, `npm run test:modules`, `npm run test:css`, `npm run test:save`, `npm run test:migration`, `npm run test:week`, `npm run test:long`, and `npm run test:transaction`.
- Real browser rendering and iPhone Safari remain outside the Node-only automated baseline and require manual verification.

## Stock chart baseline

- `npm run test:stock` verifies stock history rows, v2-to-v3 migration, stock chart UI affordances, and fixed-seed random-call stability for the added history data.
- Fixed-seed transaction regression remains at 6,418 random calls by week 52; gameplay price fields are unchanged except for the added structured `priceHistory` rows.


## Phase 1A baseline
対象業種ramenは市場計算由来の意図的差分を許容。株価、株価履歴、対象外業種、save/emit/render回数は既存回帰で保護。
