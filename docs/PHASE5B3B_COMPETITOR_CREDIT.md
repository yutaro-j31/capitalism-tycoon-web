# Phase 5B-3B: competitor credit and repayment lifecycle

## Scope

This increment adds a deterministic credit model for ramen competitors. It limits borrowing, supports full or partial credit approval, schedules quarterly principal repayment, records missed payments, and updates a bounded credit history.

The save key and save version remain unchanged in this increment. The explicit saveVersion 9 migration is deferred until the credit and distress data model has passed isolated regression and long-run tests.

## Credit limit

Each competitor receives a calculated credit limit based on saved or realized information:

- trailing 13-week revenue and profit;
- weekly operating-cost burden;
- active store count and capacity as a simple asset proxy;
- cash balance;
- credit score;
- strategy debt tolerance;
- current distress status.

The calculation is deterministic and consumes no random numbers. Available credit is the positive difference between the calculated limit and outstanding debt.

## Borrow approval

Before a due `borrow` action reaches the existing action processor, the credit module evaluates it against current available credit.

- Requests inside the limit are approved.
- Requests above the limit are reduced to the available amount.
- Requests below the minimum usable amount are denied.
- Restricted, inactive, bankrupt, or withdrawing competitors cannot borrow.

Approved, partially approved, and denied decisions are stored on the action. The action ID is used as the event operation ID, preventing duplicate approval events during repeated processing.

## Principal repayment and credit score

Every 13 weeks, a competitor with debt attempts to repay the lower of:

- the scheduled principal amount;
- outstanding debt;
- cash available above the strategy's operating buffer.

A payment below half the scheduled amount is recorded as missed. A missed payment lowers the credit score and increments `missedDebtPayments`. Full repayment performance, low leverage, and profitable operations can gradually improve the score. Distress, losses, high leverage, and missed payments lower it.

Same-week reprocessing cannot repeat a principal payment or missed-payment penalty.

## Saved data

Each competitor stores additive fields including:

- `creditLimit` and `availableCredit`;
- `overCreditLimit`;
- `cashRunwayWeeks`;
- `scheduledPrincipalPayment`;
- `creditStatus`;
- `missedDebtPayments`;
- last review, payment, and borrow-attempt weeks;
- `creditHistory`, capped at 104 unique weeks.

Existing version-8 saves receive these fields through `competitor.ensure()` without changing existing debt, cash, actions, presences, histories, or projects.

## Release gates

- borrowing never exceeds current available credit;
- partial approvals and denials are explicit and deterministic;
- debt and cash change exactly once for each approved borrowing or repayment operation;
- same-week processing is idempotent for debt decisions;
- credit history remains capped at 104 unique weeks;
- all credit fields remain finite and non-negative where required;
- validation remains read-only;
- no runtime random-number calls are added;
- all existing market, finance, supply, workforce, competitor, save, and long-run tests remain green.
