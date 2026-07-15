# Phase 5B-5B-2: competitor dashboard UI

## Scope

This increment replaces the visible legacy rival list with a read-only dashboard generated from the Phase 5B competitor dashboard view model. It does not change competitor decisions, market demand, finance, supply, workforce, save data, or lifecycle formulas.

The save key remains `capitalism_tycoon_web_v1`, and save version remains 9.

## Displayed information

Each detailed competitor card shows:

- strategy, lifecycle status, risk score, competitive pressure, and strength;
- cash, debt, weekly profit, profit margin, and average market share;
- credit score, credit status, credit limit, leverage, cash runway, missed repayments, and next repayment week;
- pending projects, pending actions, and active turnaround timing;
- each market presence with opening status, price, store count, utilization, market share, revenue, contribution margin, and lost demand;
- four-week and thirteen-week performance summaries;
- the latest structured competitor event.

The screen also retains unlinked legacy competitors for businesses not yet handled by the detailed competitor engine and shows the bounded competitor event log.

## Existing player actions

The dashboard keeps the existing delegated action contract:

- `respond-rival / ads` for advertising defence;
- `respond-rival / quality` for quality defence;
- `respond-rival / acquire` for competitor acquisition.

Advertising and quality actions are disabled for inactive competitors. Acquisition is enabled only for an active competitor in `distressed` or `turnaround` status and remains subject to the existing engine-side cash and eligibility checks.

## App integration

`app.js` remains unchanged. The UI module loads immediately before `app.js`, wraps `TycoonEngine.load()` once to capture the live engine instance, and observes the existing app root.

When the selected tab is `rivals`, the module replaces only the newly rendered `#screen` contents. The existing app-level event delegation continues to handle all buttons. A dataset marker prevents repeated replacement of the same screen.

This avoids rewriting the monolithic app file and keeps the dashboard renderer independently testable.

## Safety gates

- dashboard rendering is read-only;
- all user-controlled names and event text are escaped;
- rendered output contains no `NaN`, `Infinity`, `undefined`, or object stringification;
- button IDs and action kinds remain compatible with the current engine;
- bankrupt, inactive, and acquired competitors cannot be acquired from the dashboard;
- the screen enhancer is idempotent;
- the module adds no enumerable global variables;
- strict classic-script order remains enforced;
- iPhone layout uses the existing responsive card, grid, item, KPI, and button styles;
- all existing save, accounting, market, supply, workforce, competitor, RNG, weekly, and long-run tests remain green.
