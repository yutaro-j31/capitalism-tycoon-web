# Phase 6A-5B: Turnaround Plan UI

## Purpose

Expose the Phase 6A-5A player turnaround plan through the existing mobile crisis-response experience.

## Player controls

- Start an eight-week plan while the player company is in `watch`, `distressed`, `turnaround`, or `recovered` status.
- Confirm the projected reserve-cash target and the 10% debt-reduction target before starting.
- Cancel an active plan only after explicit confirmation.
- Starting or cancelling a plan does not automatically borrow, repay debt, sell an asset, reduce staff, or negotiate with a creditor.

## Progress display

An active plan shows:

- current cash and target cash;
- current debt and target debt;
- live cash progress;
- live debt-reduction progress;
- combined progress;
- deadline week and weeks remaining.

The display uses live read-only metrics so actions completed during the current week are visible before the next weekly evaluation. Saved plan progress is still updated only by the Phase 6A-5A lifecycle engine.

## Crisis exit behavior

The ordinary crisis panel remains hidden for stable companies. When a turnaround plan is still active after the crisis lifecycle returns to `stable`, the UI renders a standalone plan card at the top of the current screen. This prevents the player from losing access to plan progress or the cancellation control.

## Results

The latest completed, failed, or cancelled plan displays its start week, end week, ending cash, and ending debt. History storage and its 26-entry bound remain owned by Phase 6A-5A.

## Compatibility

- Save key remains `capitalism_tycoon_web_v1`.
- Save version remains 9.
- No persistent fields or migrations are added.
- No crisis thresholds, target formulas, accounting, market, supply, workforce, competitor, IPO, M&A, or valuation rules are changed.
- No runtime randomness is added.
- Existing responsive card, KPI, meter, progress, badge, and button classes are reused.
