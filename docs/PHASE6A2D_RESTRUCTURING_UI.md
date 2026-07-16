# Phase 6A-2D: mobile guided restructuring UI

## Scope

This increment exposes the merged Phase 6A-2C restructuring model inside the existing mobile crisis-response panel. It does not change candidate ranking, expected-cash formulas, execution accounting, crisis thresholds, borrowing, insolvency, or save schema.

The panel remains hidden for a stable company. During an eligible `watch`, `distressed`, `turnaround`, or `recovered` state, it displays at most three deterministic restructuring recommendations.

## Candidate display

Each row shows:

- target name;
- disposition type: store closure, company-property sale, or product sale;
- expected cash recovery from the Phase 6A-2C model;
- current weekly profit or loss.

All names and rendered values are escaped and normalized. The list uses the existing responsive card, grid, item, metric, and button classes and adds no external dependency.

## Confirmation and execution

Selecting a candidate never mutates state immediately. The UI resolves the target again from `crisisRestructuringOptions()`, displays the target, disposition type, and expected recovery in a confirmation prompt, and warns that the action cannot be reversed.

Cancellation returns without changing game state. Confirmation calls only `executeCrisisDisposition(type, id)`. Store, property, product, cash, finance, crisis re-evaluation, save, and history updates remain controlled by the merged production API.

Disposed or missing targets cannot be executed again and disappear from subsequent candidate rendering.

## Compatibility and gates

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`;
- save version remains 9;
- no persistent field is added by this UI increment;
- no runtime randomness is added;
- no automatic liquidation is added;
- stable and ineligible states do not expose disposal controls;
- rendering a normalized state is read-only;
- candidate names are HTML-escaped;
- confirmation cancellation is read-only;
- successful execution preserves finance validity and finite state;
- existing player-crisis UI behavior and all full regression suites remain release gates.
