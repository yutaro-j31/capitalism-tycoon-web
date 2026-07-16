# Phase 6A-3B: mobile operating-cost restructuring UI

## Scope

This increment exposes the merged Phase 6A-3A operating-cost restructuring model inside the existing mobile crisis-response panel. It does not change cost-reduction formulas, workforce accounting, crisis thresholds, asset disposition, borrowing, insolvency, market, supply, competitor, progression, IPO, M&A, or valuation logic.

The panel remains hidden for a stable company. During an eligible `watch`, `distressed`, `turnaround`, or `recovered` state, it displays at most three deterministic cost-reduction recommendations.

## Candidate display

Each row shows:

- target name;
- action type: project pause or one-person department headcount reduction;
- expected weekly saving;
- one-time cost;
- current utilization for headcount candidates.

The section also displays the total potential weekly saving returned by the production model. All names, identifiers, labels, and rendered numeric values are escaped or normalized before insertion into HTML.

## Confirmation and execution

Selecting a recommendation does not mutate state immediately. The UI resolves the current candidate again through `crisisCostReductionOptions()` before confirmation.

Project-pause confirmation states that the project may be resumed later. Headcount-reduction confirmation states that the action cannot be reversed and may reduce department capacity and morale. Both confirmations display weekly savings and one-time cost.

Cancellation returns without changing game state. Confirmation calls only `executeCrisisCostReduction(type, id)`. Payroll, severance, project state, workforce recomputation, crisis re-evaluation, finance validation, save, and history updates remain controlled by the merged production API.

Stale, missing, paused, or no-longer-reducible targets cannot execute and disappear from subsequent rendering.

## Compatibility and gates

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`;
- save version remains 9;
- no additional persistent field is introduced by the UI;
- no runtime randomness is added;
- no automatic restructuring is added;
- stable and ineligible states do not expose cost-reduction controls;
- rendering a normalized state is read-only;
- project and department names are HTML-escaped;
- confirmation cancellation is state-neutral;
- successful execution preserves finance and workforce validity;
- existing liquidity and asset-disposition controls remain available;
- all save, crisis, accounting, market, supply, workforce, competitor, progression, and long-run tests remain release gates.
