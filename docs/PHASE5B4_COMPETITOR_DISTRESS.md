# Phase 5B-4: competitor distress, turnaround, and bankruptcy lifecycle

## Scope

This increment replaces the previous one-step competitor distress flag with a deterministic, saved lifecycle. It covers financial deterioration, turnaround planning, portfolio contraction, recovery monitoring, inactivity, and terminal bankruptcy.

The persistent save key remains `capitalism_tycoon_web_v1`, and the save version remains 9. Existing version-9 saves receive additive lifecycle defaults through `competitor.ensure()`.

## Lifecycle states

The saved `lifecycleStatus` is one of:

- `active`;
- `growing`;
- `defending`;
- `distressed`;
- `turnaround`;
- `recovered`;
- `withdrawing`;
- `inactive`;
- `bankrupt`.

The existing public `status` field is synchronized to the lifecycle so market offers, decisions, credit restrictions, and UI summaries continue to use the same terminal states.

## Distress evaluation

Each active competitor is evaluated once per week after market finance, projects, market-entry processing, and credit review. The distress score is deterministic and uses only saved or realized values:

- consecutive loss weeks;
- cash runway;
- debt divided by the current credit limit;
- debt above the credit limit;
- missed principal payments;
- the existing core distress signal.

A score of four or more enters distress. Entering distress cancels unapplied growth actions such as brand, quality, capacity, and market entry. Linked projects are synchronized as failed through the existing project lifecycle.

## Turnaround plan

A distress episode that remains severe for four weeks starts a twelve-week turnaround plan. A previously applied `turnaround` action also starts the same saved plan.

The plan:

- reduces marketing and research budgets once;
- blocks duplicate application on same-week processing or save reload;
- cancels remaining growth investments;
- may schedule a zero-cost emergency exit from the weakest market when more than one market is active;
- tracks recovery streak, start week, target end week, initial cash, initial debt, and failure reason.

A competitor recovers after four consecutive weeks with positive profit, at least three weeks of cash runway, leverage no higher than 95% of the credit limit, and no material repayment delinquency. A distressed competitor that stabilizes before a formal plan can recover after three consecutive stable weeks.

## Recovery monitoring

Recovered competitors remain in a four-week monitoring state. A renewed distress score returns them to distress. Completing the monitoring period returns the competitor to normal active or growing operation.

## Bankruptcy

Insolvency accumulates when cash is exhausted while losses and debt remain, or when runway is below one quarter of a week while debt exceeds the credit limit. Bankruptcy occurs after four consecutive insolvent weeks, or earlier when severe repayment delinquency, excess leverage, and insufficient runway occur together.

Bankruptcy is terminal and applied once:

- the competitor becomes inactive and `bankrupt`;
- all market presences stop supplying capacity;
- planned openings fail;
- pending actions are skipped;
- unfinished projects fail without additional spending;
- an active turnaround plan fails;
- the bankruptcy event is recorded once;
- future weekly competitor processing skips the company.

A competitor with no active or opening market becomes `inactive` without being classified as bankrupt.

## Saved data and retention

Each competitor stores additive fields including:

- lifecycle status and reason;
- distress, recovery, insolvency, and monitoring counters;
- distress/recovery/bankruptcy weeks;
- turnaround attempt and episode counts;
- one saved turnaround plan;
- lifecycle history capped at 104 unique weeks.

Lifecycle events share the existing bounded `competitorEvents` collection and are deduplicated by stable operation IDs.

## Release gates

- no random-number calls;
- lifecycle evaluation and terminal events are same-week idempotent;
- turnaround cost reductions apply once;
- emergency exits target the weakest market deterministically;
- bankruptcy cancels all pending actions and unfinished projects;
- bankrupt competitors provide no market offers or capacity;
- history and events remain bounded;
- all numeric lifecycle state remains finite;
- validation remains read-only;
- saveVersion 9 migration and all existing market, finance, supply, workforce, competitor, RNG, and long-run tests remain green.
