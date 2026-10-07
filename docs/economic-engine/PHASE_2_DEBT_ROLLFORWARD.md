# Phase 2 Debt Roll-Forward Contract

**Phase:** Phase 2 — Standalone Accounting Hardening  
**Slice:** P2-2  
**Status:** implementation contract  
**Base main:** `2495f4e310f024eafe249a15fa0bf67bcc302679`

## Purpose

P2-2 hardens company debt accounting without replacing the existing debt writers.

The authoritative debt balance remains the production `companyDebt` field plus the existing loan rows maintained by the current borrowing/repayment modules.

The finance layer now keeps a forward-only roll-forward accumulator that observes canonical debt ledger events.

## Core identity

For the active roll-forward window:

`opening debt + borrowings - cash principal repayments - cashless principal reductions = ending companyDebt`

At all times:

`ending companyDebt = sum(finance.loans.outstandingPrincipal)`

Both identities use cent precision.

## Principal and interest separation

Principal movements are sourced from `liabilityEffect` on:

- `debtBorrowing`
- `debtRepayment`

Interest is observed from:

- `interestExpense`

The close contract requires:

- principal rows do not affect P&L;
- interest rows do not change debt principal;
- debt borrowing cannot have a negative liability direction;
- debt repayment cannot have a positive liability/cash direction.

The transaction `amount` field is intentionally not treated as the authoritative principal movement. Some existing debt-like products may use amount as a gross payment while liabilityEffect represents only principal. P2-2 therefore uses liabilityEffect as the principal source of truth.

## Cashless principal reductions

No current production debt-forgiveness or debt-write-off mechanic was found during P2-2.

P2-2 does not invent one.

The accounting contract nevertheless supports a future cashless principal reduction:

- category: `debtRepayment`
- liabilityEffect: negative principal amount
- cashEffect: zero

Such a movement is classified separately from cash principal repayment and participates in the same roll-forward identity.

## Weekly finalization

The existing P2-1 standalone accounting close validates the live debt roll-forward.

Only after that close passes does the weekly boundary call `finance.finalizeDebtRollforward()`.

The finalized snapshot records:

- opening debt
- borrowings
- cash principal repayments
- cashless principal reductions
- interest expense
- expected ending debt
- actual ending companyDebt
- total loan principal
- named invariant checks

Then the next active roll-forward opens from the committed ending companyDebt.

If any later weekly validation fails, the existing outer week transaction rolls back the debt snapshot together with all other state.

## Snapshot retention

Debt snapshots are bounded to the latest 520 finalized windows.

This is evidence/diagnostic state, not a second debt authority.

## Save compatibility

P2-2 keeps:

- `SAVE_KEY = capitalism_tycoon_web_v1`
- effective `saveVersion = 9`

For a save created before P2-2, the first observed state becomes the forward-only opening debt baseline.

P2-2 does not claim to reconstruct pre-adoption debt movements retroactively.

The one-time bank-loan legacy migration explicitly rebases the debt roll-forward after it synchronizes canonical loan principal to companyDebt.

## Production paths covered

The contract applies to the existing finance events emitted by:

- generic company borrowing
- generic company repayment
- founder shareholder loans
- bank-loans-covenants borrowing
- bank-loans-covenants scheduled principal service
- gym startup borrowing
- gym workout repayment
- real-estate-agency credit-line draw/repay
- maturity/refinancing principal repayment
- generic weekly interest
- individually serviced bank/gym interest

## Named checks

- `P2-DEBT-ROLLFORWARD`
- `P2-DEBT-INSTRUMENTS`
- `P2-DEBT-PRINCIPAL-PNL`
- `P2-DEBT-INTEREST-PRINCIPAL`
- `P2-DEBT-DIRECTION`
- `P2-DEBT-PREVIOUS-SNAPSHOT`

## Non-goals

P2-2 does not:

- redesign debt instruments;
- add new lending products;
- add debt forgiveness;
- change borrowing rates;
- change repayment schedules;
- change company credit scoring;
- migrate debt into EconomicOperation settlement;
- change dividends, buybacks or fixed assets;
- change SAVE_KEY/saveVersion;
- change UI.

Canonical debt-instrument redesign remains a later phase.

## Acceptance

P2-2 is complete when:

- forward debt identity closes to cent precision;
- companyDebt and loan principal reconcile to cent precision;
- interest never changes principal;
- principal never changes profit;
- cashless reduction contract is classified correctly;
- active roll-forward survives serialization/reload;
- maturity/refinancing produces deterministic roll-forward evidence across reload branches;
- debt snapshot retention is bounded;
- loan-single-interest regression stays green;
- four-route x 208-week accounting regression stays green;
- Phase 0.5, Phase 1 and P2-1 gates stay green;
- canonical CI is green.
