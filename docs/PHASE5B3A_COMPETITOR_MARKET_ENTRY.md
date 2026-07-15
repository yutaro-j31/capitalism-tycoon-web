# Phase 5B-3A: competitor market-entry projects

## Scope

This increment adds deterministic ramen competitor expansion into additional prefectures. It builds on the bounded history and project-lifecycle foundations without changing the save key, save version, player accounting, market demand formulas, supply, workforce, or stock behavior.

Save version 9, credit limits, scheduled debt repayment, and the full distress/turnaround state machine are intentionally deferred to the next increment so this pull request has one responsibility.

## Entry decision

Competitors consider expansion every 13 weeks after week 26, with at least 26 weeks between entry decisions. A competitor may have at most three active or opening market presences.

Candidate prefectures are scored deterministically using public or static information only:

- prefecture traffic;
- ramen fit and competition of the area;
- local rent;
- number of active competitors;
- number of open player ramen stores;
- whether the competitor already operates in the same area;
- the competitor strategy's risk tolerance.

Candidates are sorted by descending score and then ascending `prefID`, so reversing the source arrays cannot change the selected market. Entry is skipped when the candidate score is below the strategy threshold or cash does not cover the committed cost plus the strategy cash buffer.

## Project lifecycle

A selected entry creates:

- one inactive provisional `marketPresence`;
- one `marketEntry` action;
- one linked competitor project.

The project has a six-week lead time. The provisional presence contributes no capacity, revenue, or market offer before completion.

On the effective week, the existing action processor deducts the committed cost exactly once. The entry extension then activates the provisional presence. If cash is insufficient, the action and project fail and the presence remains inactive. Reprocessing the same week cannot deduct the cost or create a second presence.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- `saveVersion` remains 8.
- Existing presences receive additive entry-state defaults through `competitor.ensure()`.
- Existing prices, cash, debt, competitor IDs, presence IDs, histories, projects, and actions are preserved.
- No runtime random-number calls are added.

## Release gates

- candidate order is invariant to source-array order;
- opening markets provide zero capacity before completion;
- entry cost is deducted once at completion;
- insufficient cash produces a failed project without an active market;
- save/restore does not duplicate projects or presences;
- project/action/presence references remain valid;
- all numeric state remains finite;
- validation remains read-only;
- full existing CI remains green.
