# Phase 5B-1: multi-presence evaluation and bounded history

## Scope

This increment extends the deterministic ramen competitor engine without changing market formulas, player accounting, supply, workforce, stock behavior, or the save key.

## Multi-presence decision rule

Every active `marketPresence` is evaluated before a competitor chooses its single decision target. The evaluation is stable-sorted by:

1. descending decision-priority score;
2. ascending `presenceID` as the deterministic tie breaker.

The score uses only the competitor's own realized public market results and saved history:

- strategic price gap;
- 13-week profit pressure;
- market-share pressure;
- capacity utilization;
- lost-demand rate;
- contribution margin;
- strategy-specific capacity priority.

Only one presence can become the target of a decision cycle. Reordering the source array does not change the selected presence.

## Saved histories

Two additive maps are maintained by `competitor.ensure()`:

- `competitorPerformanceHistoryByID[competitorID]`;
- `competitorPresenceHistoryByID[presenceID]`.

Each series retains the newest 104 unique weeks. Writing the same week again replaces that week's snapshot rather than appending a duplicate. Histories contain only finite numeric values after sanitation.

Company history includes revenue, costs, profit, cash, debt, credit score, runway, share, fulfilled units, lost demand, utilization, and status. Presence history includes price, share, units, lost demand, utilization, revenue, contribution margin, profit, stores, capacity, and active state.

## Compatibility

This is an additive Phase 5B foundation. Existing version-8 saves receive empty history maps through `competitor.ensure()` and retain existing competitor IDs, presence IDs, actions, prices, cash, debt, and market results. A later lifecycle PR will perform the explicit version-9 migration when projects, credit limits, and turnaround plans are introduced.

## Release gates

- all active presences are evaluated;
- selection is invariant to source array order;
- company and presence histories remain capped at 104 weeks;
- same-week writes are idempotent;
- `competitor.validate()` remains read-only;
- save/restore contains no `NaN` or `Infinity`;
- no new runtime random-number consumption is introduced.
