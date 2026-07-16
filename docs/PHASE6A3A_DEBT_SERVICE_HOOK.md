# Phase 6A-3A: weekly debt-service extension point

## Scope

This increment creates a behavior-preserving extension point for player-company weekly interest expense. It does not add creditor negotiations, payment holidays, rate reductions, principal schedules, debt forgiveness, or UI.

The legacy weekly formula remains:

`company debt × company borrowing rate ÷ 52`

The existing engine continues to calculate interest through `companyBorrowRate()`. The new module activates a private weekly context only while `advanceWeek()` is executing. Inside that context, `companyBorrowRate()` delegates to `companyWeeklyBorrowRate()`. Outside that context, the original borrowing-rate implementation is used without modification.

## Public extension surface

The engine prototype gains:

- `companyWeeklyBorrowRate()` — defaults exactly to the existing company borrowing rate;
- `companyWeeklyInterest()` — returns company debt multiplied by the bounded weekly rate and divided by 52.

The module registry exposes pure helpers:

- `baseRate(instance)`;
- `weeklyRate(instance)`;
- `weeklyInterest(instance)`;
- `inWeeklyContext(instance)`.

A later creditor-negotiation module may override `companyWeeklyBorrowRate()` for an eligible, bounded period. It does not need to modify the core engine or the normal quote used by new borrowing and emergency bridge loans.

## Safety properties

- weekly context is held in a `WeakSet`, not persisted state;
- normal borrowing quotes remain unchanged before and after weekly processing;
- emergency-loan pricing outside weekly processing is unaffected;
- a non-finite hook falls back to the legacy rate;
- weekly rates are bounded between 0% and 18%;
- context is removed in `finally`, including after exceptions;
- no enumerable global is added;
- no save field or migration is added;
- no runtime randomness is added.

## Compatibility and release gates

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`;
- save version remains 9;
- default weekly interest, report values, finance transactions, and cash effects remain exactly equal to the legacy formula;
- runtime hook overrides do not survive JSON save/reload;
- finance validation and finite-state validation remain mandatory;
- strict classic-script order and every existing long-run and progression test remain release gates.
