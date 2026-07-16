# Phase 6A-3A: crisis operating cost restructuring

## Scope

This increment adds a deterministic operating-cost restructuring API for a player company in `watch`, `distressed`, `turnaround`, or `recovered` status. It extends the existing Phase 6A restructuring module without changing asset-disposition formulas, crisis thresholds, borrowing, insolvency, market, supply, competitor, IPO, M&A, or valuation logic.

The API exposes two player-directed actions:

- pause an active workforce project to stop its remaining weekly budget;
- reduce an under-utilized corporate department team by one person while preserving at least one employee in the department.

No action executes automatically.

## Candidate model

`crisisCostReductionOptions()` returns separate project and headcount lists plus up to five recommendations.

Project candidates are limited to active projects with a positive remaining weekly budget. Their weekly saving is the lower of the configured weekly budget and the remaining total budget.

Headcount candidates are limited to corporate teams that:

- belong to an existing department;
- have more than one employee;
- have no active onboarding headcount;
- have utilization below 100%;
- have a finite positive weekly salary that can be removed.

The candidate model prefers immediately reversible project pauses, then low-utilization teams and higher weekly savings. Runtime randomness is not used.

## Execution contract

`executeCrisisCostReduction(type, id)` re-resolves the current candidate before execution.

Pausing a project calls the existing workforce project-status API and does not change current cash.

Reducing department headcount:

- removes one person from the highest-cost active payroll cohort, or from the team fallback payroll when no cohort exists;
- preserves a minimum team headcount of one;
- charges two weeks of the removed salary as a one-time payroll and severance expense;
- synchronizes `departmentStaff`;
- recomputes workforce capacity, utilization, morale, and payroll;
- re-evaluates the player crisis state;
- validates workforce and finance state before saving.

## History and compatibility

Cost actions are stored in `playerCrisisRestructuring.costHistory` with:

- stable action and operation identifiers;
- week, action type, target, and target name;
- expected weekly savings;
- one-time cost;
- cash before and after execution;
- crisis status transition.

History is normalized and capped at 52 entries. Existing saves receive an empty cost history through normal state normalization.

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`;
- save version remains 9;
- no new randomness is added;
- no UI is added in this increment;
- existing asset-disposition APIs and histories remain unchanged;
- all save, finance, workforce, crisis, long-run, and progression tests remain release gates.

## Deferred work

A later UI increment may expose these cost-reduction recommendations inside the mobile crisis panel with explicit confirmation and clear display of weekly savings versus one-time severance cost. Creditor negotiations, debt maturity extensions, interest concessions, debt-equity swaps, and court-style restructuring remain separate future increments.
