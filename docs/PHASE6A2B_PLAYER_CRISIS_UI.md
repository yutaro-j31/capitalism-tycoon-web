# Phase 6A-2B: player crisis response UI

## Scope

This increment exposes the merged Phase 6A-1 crisis state and Phase 6A-2A liquidity actions through a mobile-safe response panel. It does not add or change crisis thresholds, borrowing formulas, accounting rules, store closure, asset sales, creditor negotiations, or automatic restructuring.

The panel appears at the top of the current game screen whenever the company is in `watch`, `distressed`, `turnaround`, `recovered`, or `insolvent` status. It is removed automatically after the company returns to `stable`.

## Information displayed

- current company cash;
- required liquidity reserve and current shortfall;
- crisis status and reason codes;
- remaining insolvency grace weeks;
- consecutive negative-cash weeks;
- recovery-confirmation progress;
- company debt;
- personal cash available for founder support;
- available emergency credit and proposed bridge amount;
- emergency-loan cooldown;
- the three most recent crisis actions.

All rendered text is escaped, numeric output is normalized to finite values, and the panel reuses the existing card, KPI, item, field, grid, and button classes for iPhone Safari.

## Actions

### Founder capital injection

The player enters an amount in a numeric input. The button calls the existing `injectFounderCapital(amount)` production API. The UI does not mutate cash, equity, finance transactions, or crisis state directly.

### Emergency bridge loan

The button calls the existing `requestEmergencyBridgeLoan()` production API. The amount, credit cap, eligibility, cooldown, accounting, loan record, and crisis re-evaluation remain controlled by Phase 6A-2A.

Buttons are disabled when the corresponding production option reports that the action is unavailable.

## Integration

`player-crisis-ui.js` loads immediately before `app.js` and wraps `TycoonEngine.load()` once to capture the live engine instance. The lifecycle and action modules continue to load after `app.js` so they can wrap the fully composed engine.

The UI waits until both crisis modules are registered, then inserts a marked block into `#screen`. A MutationObserver refreshes the panel after normal app renders. A zero-delay fallback covers loading an already-distressed save before the next user action.

The app's existing delegated action switch remains unchanged. The panel uses its own `data-player-crisis-action` contract and one delegated listener on `#app`.

## Release gates

- stable companies show no panel;
- crisis and recovery states show finite, escaped information;
- rendering a normalized state is read-only;
- repeated enhancement creates exactly one panel;
- the panel preserves the underlying screen;
- founder injection and emergency borrowing invoke the production APIs;
- finance remains balanced after UI-triggered actions;
- cooldown and eligibility disable unavailable actions;
- returning to stable removes the panel;
- no enumerable globals or duplicate listeners are added;
- strict classic-script order remains enforced;
- `SAVE_KEY` and save version remain unchanged;
- all existing save, progression, accounting, market, supply, workforce, competitor, RNG, weekly, and long-run tests remain green.
