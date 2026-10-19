# P4-AUD-007 (#1014) — company property mortgage liability: Option A design and verification

**Status:** DESIGN / VERIFICATION ONLY.
**Owner instruction:** 2026-10-20. Design and verify Option A, where `finance.loans` is the debt record, as the preferred candidate. This is **not** approval of a production implementation, of automatic legacy-save correction, or of Phase 4 Entry or debt authority cutover.
**Audited main:** `8de12935`.

Evidence levels: **[V]** verified by code reading or a Node probe on that SHA; **[I]** inference.

## 1. Defect on current main [V]

A company `refinancePropertyMortgage()` raises `p.mortgageBalance` and company cash, but:
- `companyDebt` is unchanged;
- no `finance.loans` row is created;
- the proceeds row (`propertyMortgageProceeds` → `debtBorrowing`) carries **`liabilityEffect: 0`**.

`finance.validate` then fails with `P2-CLOSE-BS-IDENTITY`, and the difference always equals `p.mortgageBalance`.

The `companyDebt` vs `Σ loans` check passes, because both are 0. The debt rollforward also passes, because it never sees the borrowing.

Probe (one company property, `fixed` product):

| Step | mortgageBalance | companyDebt | Σ finance.loans | validate |
|---|---|---|---|---|
| after `buyProperty` | 0 | 0 | 0 | ok |
| after refinance | 14,969,500 | 0 | 0 | BS identity diff 14,969,500 |
| after weekly service | 14,940,712.5 | 0 | 0 | diff = balance |
| after 1M prepay | 13,940,712.5 | 0 | 0 | diff = balance |

### Additional defects found while designing (same root cause)

- **D-1 (P1 candidate, accounting contamination) [V].**
  - What happens: `settlePropertyDisposition()` (`js/real-estate-property-disposals.js`) subtracts `min(debt, legacyBalance)` from `companyDebt` when the property is sold, even though the mortgage was never in `companyDebt`.
  - Probe: after an unrelated `engine.borrow(50M)`, selling a property with a 13,940,712.5 mortgage leaves `companyDebt = 36,059,287.5` against `Σ loans = 50,000,000`. `validate` reports `P2-DEBT-INSTRUMENTS` and `companyDebtとローン残高が不一致` in addition to the BS error.
  - Effect: **another loan's recorded debt silently disappears.** The personal owner path reduces `personalDebt` the same way.
- **D-2 [V].**
  - Today a refinance-down or same-product refinance forgives principal with no cash and books a fee with no cash.
  - Open PR #1036 rejects `target < old` and `gross < fee`. That covers both cases once it merges.
- **D-3 [V].** When cash is short, unpaid interest is dropped (no accrual, no delinquency), and `remainingWeeks` still decrements.
- **D-4 [V].** A personal-owned `g.properties` mortgage raises `personalCash`, but `personalDebt` is untouched and `personalNetWorth` overstates by the net proceeds.
- **D-5 [V].**
  - Three independent LTV calculations exist: the mortgage products, the complete-cycle `quote`, and `real-estate.js` `collateralCapacity`.
  - None sees the others, so one property can carry a mortgage, a market loan and a legacy collateral loan beyond any single cap.
- **D-6 [V].** `companyValue` (`engine.js`) is inflated by the net mortgage proceeds, which loosens credit limits. Option A fixes this through `companyDebt`.

## 2. Precedent to follow [V]

`js/real-estate-complete-cycle.js` (`realEstateMarket.loans`, company owner) already does what Option A needs, in one transaction per movement:
- a mirrored `finance.loans` row `{loanID, principal, outstandingPrincipal, interestRate, termWeeks, remainingWeeks, repaymentMethod:'individual', weeklyPrincipalPayment:0, nextPaymentWeek, status, sourceType:'propertySecuredLoan', propertyID}`;
- `companyDebt ±= principal`;
- a ledger row with `liabilityEffect ±principal` and a deterministic `idempotencyKey`;
- `syncFinanceLoan` after each change.

Its source type is listed in `finance.js` `INDIVIDUALLY_SERVICED_SOURCES`, so the engine's generic weekly interest does not charge it twice.

## 3. Option A — target behavior

**Row:** one per company-owned mortgaged property, with these fields:
- `loanID` — see decision Q9
- `sourceType:'propertyMortgage'`, `propertyID`
- `principal`, `outstandingPrincipal = p.mortgageBalance`
- `interestRate = product.annualRate`
- `termWeeks`, `remainingWeeks`
- `repaymentMethod:'individual'`
- `status: 'active' | 'repaid'`

**Required suppression:** add `'propertyMortgage'` to `INDIVIDUALLY_SERVICED_SOURCES`. Otherwise the generic interest at `engine.js` (`companyDebt − individuallyServicedPrincipal`) double-charges what the mortgage `processWeek` already charges.

| Action | Row | companyDebt | Ledger (existing categories and keys) |
|---|---|---|---|
| Origination / refinance up | create or raise to `target` | `+ (target − old)` | `debtBorrowing`, cash `+net`, **liability `+gross`**; fee `interestExpense`, profit `−fee` |
| Refinance down / same product | — | — | rejected by #1036 (Q5 decides whether to allow a funded payoff or a write-down) |
| Weekly payment | `−principalPaid`, `remainingWeeks−1` | `−principalPaid` | interest: cash `−i`, profit `−i`; principal: `debtRepayment`, cash `−p`, **liability `−p`** |
| Prepayment / payoff | `−paid`; `repaid` at 0 | `−paid` | `debtRepayment`, cash `−paid`, **liability `−paid`** |
| Sale / disposal | settled with market loans, exactly once | `−paid` once; **remove the `legacyBalance` subtraction** (fixes D-1) | existing `property-disposition-debt` row |
| Generic allocators (`engine.repay`, treasury prepayment, maturity, crisis negotiation) | Q7: exclude `sourceType 'propertyMortgage'`, **or** sync through the #990 `settleLoanPrincipal` hook | — | — |
| Personal-owned property | no row, no company event | 0 | Q8 decides whether `personalDebt` starts tracking it |

**Single writer:** only the mortgage module writes `p.mortgageBalance`, and it mirrors the row immediately. A future check can assert `row.outstandingPrincipal === p.mortgageBalance` for company properties.

No new finance category, no new save root, and `saveVersion=9` is unchanged. An optional schema marker (for example `propertyMortgageSchemaVersion`) is enough.

## 4. Legacy saves — states and migration choices [V code; I prevalence]

**States:**

| State | Description |
|---|---|
| S1 | Company property with `mortgageBalance = B > 0`, no row, ledger predates the mortgage. `validate` already fails by exactly `B`. |
| S2 | Same as S1, but `g.finance` was (re)created by `defaultFinanceState` after the mortgage. Equity absorbed `B`, and `validate` passes today. |
| S3 | A mortgaged property was already sold. Another loan's `companyDebt` was consumed by `B` (D-1). |
| S4 | A past refinance-down or same-product refinance already forgave principal or booked a cashless fee (D-2). |
| S5 | Personal-owned mortgage with `personalNetWorth` overstated (D-4). |

**Migration choices:**

| Choice | S1 | S2 | Other effects / risk |
|---|---|---|---|
| Backfill row + `companyDebt += B` + cash-0 `debtBorrowing` (liability `+B`), or `rebaseDebtRollforward`, following `bank-loans-covenants.js` `migrateLegacyLoans` | fixed exactly (probe: BS diff 0, `validate` ok) | **creates** a −B error unless equity is restated (`priorPeriodAdjustments −= B`; probe confirms ok) | S1 and S2 must be told apart. Old proceeds rows can be compressed away after 5,000 transactions, so detection is not always possible. |
| Quarantine (block further mortgage actions and new borrowing while unreconciled) | `validate` failure persists | — | No disappearance risk. Debt stays off book, and value and credit limits stay inflated. |
| Forward-only (Option A for new movements only) | — | — | The first movement on a legacy mortgage posts a liability against a missing row, which leads back to backfill. Disposal keeps consuming other loans' debt. |

**S3 repair:** restoring `companyDebt` to `Σ loans` is a separate decision. It moves debt without cash, so it needs a rebase or an opening-debt adjustment.

## 5. Owner decisions required

1. **Q1 — Legacy approach:** backfill vs quarantine vs forward-only.
2. **Q2 — S1 vs S2 classification**, and whether equity restatement through `priorPeriodAdjustments` is acceptable.
3. **Q3 — Debt rollforward treatment** of the backfill: a cash-0 borrowing row, or a rebase.
4. **Q4 — Repair of S3** (consumed `companyDebt`) and of S4 (past forgiveness).
5. **Q5 — Refinance-down semantics** after #1036: keep the block, add a funded payoff, or allow a cashless write-down.
6. **Q6 — Unpaid interest:** accrue, delinquent/default, or keep dropping it (current behavior).
7. **Q7 — Generic allocators:** exclude the mortgage row, or sync it through the #990 hook.
8. **Q8 — Personal mortgages:** whether they should start touching `personalDebt` (D-4).
9. **Q9 — `loanID`:** one stable ID per property, or a new ID per origination.
10. **Q10 — D-1 interim fix:** whether to fix it first, independently, as a disposal-only fix that never subtracts the mortgage from `companyDebt` while it is off book. That fix stops further loss of other loans' debt without deciding Option A.

## 6. Proposed implementation slices (after Owner decisions)

1. **D-1 disposal fix** (if Q10 = yes): one writer, with Node, save-fault, WebKit and old-save tests.
2. **Option A for new movements:** row, `companyDebt`, liability effects and suppression, with the allocator choice from Q7.
3. **Legacy migration** per Q1–Q4, as a separate PR with old-save fixtures for S1–S4.
4. **Shared per-property encumbrance** for LTV (D-5): separate PR.

Each slice is one concern per PR. It must pass the Stage S gate for a debt writer:
- exact borrower identity;
- no duplicate generic/specialist repayment or interest;
- `DebtClosing = DebtOpening + Borrowings − PrincipalPayments − Writeoffs`;
- `save-false` / throw / mirror / IndexedDB faults, retry, reload, and fresh durable hydration;
- determinism with fractional yen;
- iPhone WebKit.

## 7. Evidence notes

- The probe scripts used here are local, session-scratch only and were not committed. They load the production game through `tests/harness.js` with a deterministic LCG and print the values in §1.
- The production regression tests for the chosen slices will replace them.
- `tests/real-estate-mortgage-refinancing-test.js` stubs `finance.event`, so it never runs `finance.validate`. That is why the existing suite did not catch the liability omission.
