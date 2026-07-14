# Engine Transaction Audit

Date: 2026-07-14
Target: `index.html` single-file engine implementation.

## Original definitions

- `TycoonEngine.prototype.configure` is the base class method in the core engine. It creates a fresh initial state, preserves settings, applies difficulty cash/credit adjustments, records the founding notification, then previously called `save()` and `emit()` immediately.
- `TycoonEngine.prototype.advanceWeek` is the base class method in the core engine. It advances the week/month/age, runs automation, macro/market/property/startup/competitor/directive updates, product/overseas/subsidiary/franchise/personal asset updates, store sales and costs, rents, dividends, tax, reports, history, milestones, recurring events, game-over checks, weekly summary creation, then previously called `save()`, `emit('week')`, and `emit()` immediately.

## Wrapper and reassignment locations

### `configure`

1. Expansion wrapper in `installExpansion`.
   - Calls previous `configure`.
   - Ensures expansion defaults.
   - Calls `setFounderOrigin(...)` to initialize founder profile and home-origin log.
   - Previously called `save()` and `emit()` after the wrapper.
   - `setFounderOrigin` itself also previously called `save()` and `emit()` even when used by `configure` with `notify=false`.
2. Completion wrapper in `installCompletion`.
   - Calls previous `configure`.
   - Ensures completion defaults.
   - Sets `currentCompanyFoundedWeek`, `currentCompanySerial`, and `serialCompanyCount`.
   - Previously called `save()` and `emit()`.
3. Parity wrapper in `installParity`.
   - Calls previous `configure`.
   - Ensures parity defaults.
   - Previously called `save()` and `emit()`.

### `advanceWeek`

1. Expansion wrapper in `installExpansion`.
   - Calls previous `advanceWeek(false)`.
   - Ensures expansion defaults.
   - Uses `lastExpansionUpdateWeek` to avoid duplicate expansion calculations for the same week.
   - Runs, in order: `updateFounderExpandedWeekly`, `updateSupplyChainWeekly`, `updateRDWeekly`, `updateProductFunnelsWeekly`, `updatePersonalExpandedWeekly`, `updateSportsExpandedWeekly`, `generateMediaWeekly`, `updateCapitalMarketsExpandedWeekly`, `updateSuccessionWeekly`, `updateHallOfRecords`, report adjustment, and `recordExpandedHistory`.
   - Previously called `save()`, `emit('week')`, and `emit()`.
2. Completion wrapper in `installCompletion`.
   - Calls previous `advanceWeek(false)`.
   - Ensures completion defaults.
   - Uses `lastCompletionUpdateWeek` to avoid duplicate completion calculations for the same week.
   - Runs `updateCompletionWeekly`, applies report/profit-history adjustments, and rebuilds the summary.
   - Previously called `save()`, `emit('week')`, and `emit()`.
3. Parity wrapper in `installParity`.
   - Calls previous `advanceWeek(false)`.
   - Ensures parity defaults.
   - Uses `lastParityUpdateWeek` to avoid duplicate parity calculations for the same week.
   - Runs `updateParityWeekly`, applies report/profit-history adjustments, and rebuilds the summary.
   - Previously called `save()`, `emit('week')`, and `emit()`.

## Save, emit, and render paths

- `save(slot)` writes `JSON.stringify(this.g)` to `localStorage` and emits `saved`.
- `notify(message, severity)` appends to `news` and emits `notify`.
- The UI renders on `engine.addEventListener('change', render)`.
- The UI also renders on `engine.addEventListener('week', ...)`, then optionally opens the weekly summary.
- `emit('notify')` only shows a toast and is not a full render path.
- `emit('saved')` has no production UI render listener.

## Weekly extension execution order

The installed order is `installExpansion`, then `installCompletion`, then `installParity`. Because each wrapper captures the previous prototype method, runtime weekly order is:

1. Parity wrapper enters.
2. Completion wrapper enters.
3. Expansion wrapper enters.
4. Base core `advanceWeek` runs.
5. Expansion weekly systems run once.
6. Completion weekly systems run once.
7. Parity weekly systems run once.
8. The outer transaction saves and emits the final event.

This preserves the existing calculation order while delaying persistence and public render notification until the final state is complete.

## Duplicate-execution risk found

- Weekly calculations had guard fields (`lastExpansionUpdateWeek`, `lastCompletionUpdateWeek`, `lastParityUpdateWeek`) to avoid rerunning extension calculations, but those guards did not prevent duplicate `save`, duplicate `emit('week')`, or duplicate `change` emissions.
- `configure` had no equivalent guard need because each wrapper intentionally contributes different initialization, but every layer saved/emitted the intermediate state.
- `setFounderOrigin` caused an additional save/emit during `configure` despite `notify=false`.

## `emit('week')` listeners

- Production listener: `engine.addEventListener('week', e => { render(); if (e.detail.summary) showWeeklySummary(e.detail.summary); });`
- Test listener: `tests/week-test.js` attaches a `week` listener to count render-equivalent notifications.
- No other `emit('week')` listeners were found.

## Transaction design implemented

- `beginTransaction()`, `finishTransaction(...)`, and `inTransaction()` were added to the engine.
- `configure` and `advanceWeek` wrappers now join the same transaction instead of independently saving and emitting.
- Core `configure`, core `advanceWeek`, and `setFounderOrigin` suppress their immediate save/render side effects while a transaction is active.
- The outermost wrapper normalizes the final state, saves once, and emits either one `change` event for `configure` or one `week` event for `advanceWeek`.
- Intermediate `notify` events are not suppressed because they are user-facing toasts/news and do not trigger full render.
- No midway save was found to be required: all affected operations are synchronous and operate on the same in-memory state; saving only the final state preserves the intended game result while removing incomplete intermediate persistence.
