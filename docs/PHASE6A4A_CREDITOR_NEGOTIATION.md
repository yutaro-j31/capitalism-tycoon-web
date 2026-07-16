# Phase 6A-4A: creditor negotiation engine

## Scope

This increment adds player-directed creditor negotiations during `watch`, `distressed`, or `turnaround` liquidity states. It operates on active records in `finance.loans` and does not create, repay, forgive, or convert principal.

Three requests are available:

- principal payment deferral for eight weeks;
- maturity extension for twenty-six weeks;
- interest-rate reduction, subject to a floor.

## Approval model

Each request exposes an approval probability between 12% and 92%. The model uses:

- request type;
- company credit score;
- CFO finance capability;
- completed founder-capital, asset-disposition, and cost-restructuring actions;
- debt relative to enterprise value;
- current cash position and crisis status;
- the latest failed negotiation on the same loan.

The approval roll is derived from the week, loan ID, request type, sequence number, and credit score. It does not use runtime randomness, so reloading the same pre-action save cannot change the result.

## Successful changes

Principal deferral records `principalMoratoriumUntilWeek` and moves an existing next payment beyond the moratorium.

Maturity extension adds twenty-six weeks to both contractual and remaining term values.

Interest reduction updates the loan rate and stores the negotiated discount. The engine's actual weekly company borrowing rate applies the outstanding-principal-weighted discount to the existing dynamic borrowing-rate formula.

No successful negotiation changes current cash or outstanding principal.

## Failure and repeat limits

A failed request reduces company credit by three points. Every attempt starts an eight-week cooldown for that loan, regardless of result. A stale or inactive loan cannot be negotiated.

## History and compatibility

`playerCrisisCreditor` stores:

- the next negotiation sequence;
- last-attempt week by loan ID;
- up to fifty-two normalized history records;
- probability, deterministic roll, result, credit change, term or rate change, and crisis-status transition.

Compatibility constraints:

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`;
- save version remains 9;
- no new runtime randomness;
- no principal write-off or debt-equity swap;
- no UI in this increment;
- existing crisis, borrowing, accounting, market, supply, workforce, competitor, progression, IPO, M&A, and valuation rules remain unchanged except for the explicit negotiated interest discount.

## Deferred work

A later UI increment may expose lender proposals, approval probability, expected benefit, warning text, confirmation, result history, and cooldown status in the mobile crisis-response panel.
