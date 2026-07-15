# Phase 6A-1: player-company crisis foundation

## Scope

This increment replaces the legacy immediate two-week negative-cash game over with a deterministic player-company liquidity crisis lifecycle. It establishes the state machine, grace period, recovery confirmation, bounded history, and weekly-summary snapshot needed by later restructuring actions and UI work.

Emergency loans, asset sales, store closures, cost-reduction actions, creditor negotiation, and crisis-screen UI are intentionally deferred to later Phase 6A pull requests.

## Lifecycle

The lifecycle is stored in `playerCrisis` with the following statuses:

- `stable`: cash is at or above the operating reserve threshold;
- `watch`: cash is non-negative but below the reserve threshold;
- `distressed`: cash is negative and the restructuring grace period is active;
- `turnaround`: cash has returned to non-negative and recovery is being confirmed;
- `recovered`: two consecutive non-negative weeks have been completed;
- `insolvent`: the grace period expired while cash remained negative.

The operating reserve threshold is the larger of 3,000,000 yen or two weeks of the latest reported expenses.

## Grace and recovery rules

The first negative-cash week starts the crisis without ending the game.

- Easy difficulty: four additional grace weeks.
- Normal difficulty: three additional grace weeks.
- Hard difficulty: two additional grace weeks.

A normal-difficulty company therefore reaches insolvency only after four consecutive negative-cash weekly evaluations: the initial crisis week plus three failed grace weeks.

When cash becomes non-negative, the company enters turnaround. Two consecutive non-negative weekly evaluations produce `recovered`; the following evaluation moves the company to `stable` or `watch` according to its operating reserve.

## Weekly integration

`player-crisis.js` loads after `app.js` so it wraps the final composed engine after expansion, completion, parity, and competitor compatibility have installed their weekly layers.

The crisis evaluation therefore uses final company cash after:

- store, supply, workforce, finance, and market processing;
- completion-layer branch-office and related adjustments;
- parity-layer key-person and competitor-response adjustments.

The wrapper encloses the composed weekly advance in one outer transaction. All existing weekly layers run first, the crisis state is evaluated from final cash, and that same transaction performs the single save and single final weekly event expected by the engine contract.

The old engine may still set the legacy reason `会社現金が2週連続でマイナスになりました。` internally. The outer crisis layer clears that result while grace remains and replaces it with the new insolvency reason only when the grace period reaches zero.

## Save compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- Save version remains 9.
- Existing saves do not require an explicit migration.
- `playerCrisis` is added through normalization or before saving.
- The legacy `consecutiveNegativeCashWeeks` field remains synchronized.
- Crisis transition history is capped at 52 entries.
- No random values are used by the lifecycle.
- No cash, profit, asset, liability, supply, workforce, market, or competitor formulas are changed.

## Release gates

- same-week evaluation is idempotent;
- crisis decisions are deterministic;
- the old two-week game over is suppressed only for its exact legacy reason;
- final weekly cash is used after all composed adjustments;
- exactly one save and one weekly event occur per successful advance;
- recovery and insolvency transitions are finite and bounded;
- save round-trip preserves crisis state;
- validation is read-only;
- existing saves, accounting, supply, workforce, market, competitor, RNG, and long-run suites remain green.
