# Phase 5B-4: competitor distress, turnaround, and bankruptcy

## Scope

This increment turns the existing competitor loss and distress counters into a complete deterministic lifecycle:

1. distress entry;
2. turnaround plan;
3. recovery or plan failure;
4. retry after a cooling-off period;
5. bankruptcy after a second failed plan or an immediately critical condition.

The implementation is isolated in `js/competitor-distress.js`, loaded after competitor credit and before the market engine. `SAVE_KEY` remains `capitalism_tycoon_web_v1` and save version remains 9.

## Distress assessment

The lifecycle evaluates only saved or calculated competitor information:

- consecutive loss weeks;
- weekly profit;
- cash runway;
- debt relative to credit limit;
- over-limit debt;
- missed principal payments;
- credit status;
- active market presence count.

The score and transition are deterministic. No random-number call is added.

A distress episode receives a sequence number and one bounded event. Reprocessing the same week cannot add a second event or repeat a transition.

## Turnaround plan

An applied `turnaround` action starts an eight-week saved plan. The plan records:

- stable plan and action IDs;
- start and deadline weeks;
- initial cash, debt, credit score, and active-market count;
- recovery streak and required recovery weeks;
- terminal outcome and final financial values.

While a plan is active, ordinary competitor strategic decisions are paused. This prevents duplicate turnaround actions and prevents expansion or discretionary investment during restructuring.

Recovery requires three consecutive weekly reviews with:

- positive weekly profit;
- at least four weeks of cash runway;
- no debt above the credit limit;
- credit score of at least 35;
- at least one active market.

Successful recovery changes the company to `recovering`, clears the current distress episode, resets loss counters, and adds a small credit-score recovery.

## Failure and retry

If the deadline arrives without three healthy weeks, the plan fails. A non-critical first failure returns the competitor to `distressed` and enforces a four-week retry cooldown.

A company becomes bankrupt when any of the following applies:

- the current condition is critical;
- there are no active market presences;
- two turnaround plans have failed.

## Bankruptcy processing

Bankruptcy is applied once and performs all of the following atomically:

- marks the competitor inactive and bankrupt;
- calculates a deterministic liquidation value;
- applies available cash and liquidation proceeds to debt;
- deactivates every market presence and zeroes market capacity;
- cancels all pending actions;
- marks related unfinished projects as failed;
- prevents any further competitor offer from entering the market;
- records bankruptcy week, reason, liquidation value, and creditor recovery;
- records one bounded bankruptcy event.

Residual debt may remain after liquidation. This is intentional and represents creditor loss.

## Saved data

Additive version-9 fields include:

- `turnaroundPlans`, capped at eight records;
- `turnaroundAttempts` and `failedTurnaroundAttempts`;
- distress episode count, active flag, and entry week;
- retry eligibility and last lifecycle review weeks;
- bankruptcy week and reason;
- liquidation value and creditor recovery.

Old version-9 saves receive defaults through `competitor.ensure()` without changing existing IDs, financial values, actions, projects, histories, or presences.

## Release gates

- lifecycle transitions are same-week idempotent;
- successful plans require three consecutive healthy weeks;
- a non-critical first failure does not immediately bankrupt the company;
- a second failed plan or critical condition does bankrupt it;
- bankruptcy removes every offer and active capacity;
- pending actions and unfinished projects cannot execute after bankruptcy;
- plan and event retention is bounded;
- validation is read-only;
- all numeric fields remain finite;
- all existing save, accounting, market, supply, workforce, competitor, RNG, and long-run tests remain green.
