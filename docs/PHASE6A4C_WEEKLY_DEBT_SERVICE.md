# Phase 6A-4C: weekly-only negotiated debt service

## Purpose

Creditor-negotiated interest concessions must reduce the interest expense of existing debt without lowering the quote for a new company loan or emergency bridge loan.

## Runtime behavior

`player-crisis-creditor.js` still owns negotiation approval, the loan-level rate discount, cooldowns, and history. `player-debt-service.js` separates two rates:

- `ordinaryRate(instance)` removes negotiated loan discounts and returns the normal company borrowing quote;
- `negotiatedRate(instance)` preserves the approved weighted loan discount;
- `weeklyRate(instance)` is used only while `advanceWeek()` is calculating the weekly company interest expense.

The module activates a private `WeakSet` context around `advanceWeek()`. During that context, the existing `companyBorrowRate()` call at the weekly interest line resolves to the negotiated rate. Outside it, the method resolves to the ordinary quote.

The ordinary rate is obtained by calling the pre-existing creditor rate implementation against a detached shadow state whose loan discounts are zero. The live save state is never temporarily modified.

## Safety properties

- new borrowing quotes remain unchanged;
- emergency bridge pricing outside weekly processing remains unchanged;
- approved interest relief remains weighted by active loan principal;
- weekly context is not persisted;
- context is released in `finally`, including after exceptions;
- invalid custom weekly-rate hooks fall back to the negotiated weekly rate;
- weekly rates are bounded to 0.5%–18%;
- save key remains `capitalism_tycoon_web_v1`;
- save version remains 9;
- no new state field, migration, cash mutation, debt mutation, or randomness is introduced.

## Release gates

The focused test verifies ordinary quote parity, negotiated weekly interest, finance transaction parity, exception cleanup, finite bounds, and save/reload behavior. The full save, accounting, market, supply, workforce, competitor, progression, and long-run suites remain required before merge.
