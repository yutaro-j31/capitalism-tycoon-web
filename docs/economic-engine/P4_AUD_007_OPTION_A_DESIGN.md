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
- **D-4 [V].** A personal-owned `g.properties` mortgage raises `personalCash` by the net proceeds `B − F`, but `personalDebt` is untouched. Against the debt-aware value (`cash + property − B`), `personalNetWorth` is overstated by the **gross outstanding balance `B`**: the fee has already reduced cash, and `B − F` is only the change from the pre-refinance display. A migration (S5/Q8) must recognize the gross `B`.
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
- **Schedule metadata (required):** `weeklyPrincipalPayment` = the mortgage's own scheduled principal, `round(min(B, B / max(1, mortgageRemainingWeeks)))`, and `nextPaymentWeek = week + 1`. The mortgage `processWeek` refreshes both after each payment, and the refinance and prepayment paths refresh them after each balance change.
  - Do **not** copy the precedent's `weeklyPrincipalPayment:0`.
  - `finance.js` `next13LoanPayments` (cash forecast and safe-dividend reserve) and `ma-board-approval.js` `activeLoanWeeklyPayments` (the M&A cash buffer) read this field. A zero would overstate dividend capacity and undersize the M&A buffer for a mortgaged company.
  - The same zero in the `propertySecuredLoan` precedent is an existing gap, out of scope here.
  - **Recurring schedule in the forecast (required):** this metadata alone is not enough. `next13LoanPayments` adds principal only in the week where `nextPaymentWeek === forecastWeek`, and it does not advance the row while building the forecast, so weeks 2–13 would carry no mortgage principal and `dividendInfo` would still release cash needed for the other twelve payments. For `sourceType:'propertyMortgage'` rows, `next13LoanPayments` must therefore project the recurring weekly schedule. Starting from `nextPaymentWeek`, each forecast week takes `p_k = round(min(B_k, B_k / max(1, remainingWeeks − k)))`, the same formula the mortgage `processWeek` applies. That week's interest is `round(B_k × interestRate / 52)` on the pre-payment balance, as in `processWeek`, and the next week starts from `B_{k+1} = B_k − p_k`. The projection stops only when the projected balance reaches 0. `remainingWeeks` never stops it: once it reaches 0 (for example after cash shortages left principal unpaid), the denominator is 1 as in `processWeek`'s `max(1, mortgageRemainingWeeks)`, so the forecast reserves the whole matured balance. The function stays read-only and does not mutate the row.
  - The same one-week limit applies today to other weekly-amortizing rows (bank loans, M&A acquisition financing). That is an existing gap, out of scope here; this design only requires that the new mortgage row not inherit it.
  - Acceptance: a regression asserts that the **13-week total** of forecast mortgage principal equals the sum of the projected schedule. That is 13 payments, or the full balance when fewer weeks remain. Weeks 2–13 must each carry a non-zero principal while the balance is positive. `dividendInfo.safeDistributable` must be reduced by that total, and `activeLoanWeeklyPayments` must include the scheduled weekly principal.

**Required suppression:** add `'propertyMortgage'` to `INDIVIDUALLY_SERVICED_SOURCES`. Otherwise the generic interest at `engine.js` (`companyDebt − individuallyServicedPrincipal`) double-charges what the mortgage `processWeek` already charges.

| Action | Row | companyDebt | Ledger (existing categories and keys) |
|---|---|---|---|
| Origination / refinance up | create or raise to `target` | `+ (target − old)` | `debtBorrowing`, cash `+net`, **liability `+gross`**; fee `interestExpense`, profit `−fee` |
| Refinance down / same product | — | — | rejected by #1036 (Q5 decides whether to allow a funded payoff or a write-down) |
| Weekly payment | `−principalPaid`, `remainingWeeks−1` | `−principalPaid` | interest: cash `−i`, profit `−i`; principal: `debtRepayment`, cash `−p`, **liability `−p`** |
| Prepayment / payoff | `−paid`; `repaid` at 0 | `−paid` | `debtRepayment`, cash `−paid`, **liability `−paid`** |
| Sale / disposal | settled with market loans, exactly once | `−paid` once; **remove the `legacyBalance` subtraction** (fixes D-1) | existing `property-disposition-debt` row; its `liabilityEffect` must equal the on-book principal actually settled |
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
| S2s | S2 followed by later off-book mortgage movements: principal payments `P` and/or upward refinance draws `D`. The writers moved cash and `mortgageBalance` to `B = B_open + D − P` without a liability effect, so `validate` already fails by `D − P` before any sale. Neither S1 nor S2 describes it. |
| S3 | A mortgaged property was already sold. Another loan's `companyDebt` was consumed by `B` (D-1). |
| S4 | A past refinance-down or same-product refinance already forgave principal or booked a cashless fee (D-2). |
| S5 | Personal-owned mortgage with `personalNetWorth` overstated (D-4). |

**Migration choices:**

| Choice | S1 | S2 | Other effects / risk |
|---|---|---|---|
| Backfill row + `companyDebt += B` + cash-0 `debtBorrowing` (liability `+B`), or `rebaseDebtRollforward`, following `bank-loans-covenants.js` `migrateLegacyLoans` | fixed exactly (probe: BS diff 0, `validate` ok) | **creates** a −B error unless equity is restated (`priorPeriodAdjustments −= B`; probe confirms ok) | S1 and S2 must be told apart. Old proceeds rows can be compressed away after 5,000 transactions, so detection is not always possible. |
| Quarantine (block further mortgage actions and new borrowing while unreconciled) | `validate` failure persists | — | No disappearance risk. Debt stays off book, and value and credit limits stay inflated. |
| Forward-only (Option A for new movements only) | — | — | The first movement on a legacy mortgage posts a liability against a missing row, which leads back to backfill. Disposal keeps consuming other loans' debt. |

**S2s backfill:** the backfill recipe above covers only S1 and pure S2. For S2s it would leave the save failing: adding `B` to `companyDebt` turns the existing `D − P` difference into `D − P − B = −B_open`, and restating equity by `B` (`priorPeriodAdjustments −= B`) still leaves `D − P`. For S2s, the backfill restates equity by the measured opening balance `B_open = B + P − D`, where `P` and `D` are the sums of every off-book mortgage principal payment and draw (refinance-up, top-up or any other balance change) recorded after the finance state was recreated. The measured `D − P` must also equal the save's existing balance-sheet difference; any mismatch means an unexplained movement, and the property is quarantined. The S2s backfill fixture must show `validate` ok, `P2-DEBT-ROLLFORWARD` ok and the balance-sheet difference at 0 afterwards. When any of these movements cannot be measured exactly from the ledger (for example because rows were compressed away), the property is quarantined and not backfilled. Fixtures cover payments only, a draw only, and a draw followed by payments. Restating equity remains subject to Q2.

**S3 repair:** restoring `companyDebt` to `Σ loans` is a separate decision. It moves debt without cash, so it needs a rebase or an opening-debt adjustment.

## 5. Owner decisions required

1. **Q1 — Legacy approach:** backfill vs quarantine vs forward-only.
2. **Q2 — S1 vs S2 classification**, and whether equity restatement through `priorPeriodAdjustments` is acceptable.
3. **Q3 — Debt rollforward treatment** of the backfill: a cash-0 borrowing row, or a rebase.
4. **Q4 — Repair of S3** (consumed `companyDebt`) and of S4 (past forgiveness).
5. **Q5 — Refinance-down semantics** after #1036: keep the block, add a funded payoff, or allow a cashless write-down.
6. **Q6 — Unpaid interest:** accrue, delinquent/default, or keep dropping it (current behavior).
7. **Q7 — Generic allocators:** exclude the mortgage row, or sync it through the #990 hook.
8. **Q8 — Personal mortgages:** whether they should start touching `personalDebt` (D-4), and if so whether tracked mortgage principal counts towards the `personalBorrowRate()` tier. Generic repayment reservation and generic-interest suppression are required either way (§6 slice 4).
9. **Q9 — `loanID`:** one stable ID per property, or a new ID per origination.
10. **Q10 — D-1 interim fix:** whether to fix it first, independently, as a disposal-only fix. The fix stops further loss of other loans' debt without deciding Option A. While the mortgage is off book, it must satisfy all of the following:
    - (a) Never subtract the off-book `legacyBalance` from `companyDebt`.
    - (b) Never subtract it from `personalDebt` on the personal-owned path either, until Q8 tracking has migrated that balance. Today the disposal writer subtracts it from whichever aggregate the owner uses, so a personal mortgage consumes unrelated personal borrowing in the same way.
    - (c) Exclude the off-book balance from the `property-disposition-debt` row's `liabilityEffect` (today `−debt.total`), while keeping the cash payoff. Otherwise `P2-DEBT-ROLLFORWARD` fails by the mortgage balance after the sale.
    - (d) The ledger treatment of that cash payoff depends on the S1/S2 classification (Q2) and must not be applied universally. In S2 the ledger balances today because equity absorbed `B`. Paying `B` in cash with a zero liability effect then leaves no offset, and `finance.validate` turns from valid to `P2-CLOSE-BS-IDENTITY` by `B`. So S2 must either carry an equity offset on the payoff, or be quarantined until classified. The offset must equal the actual historical accounting gap, not the current balance: `B` for a pure S2, but `B_open = B + P − D` for S2s, where the later payments `P` and draws `D` already left a `D − P` difference. When that gap cannot be measured exactly from the ledger, the property is quarantined. Any equity restatement through `priorPeriodAdjustments` is subject to Q2. The fix's tests must cover S1, S2 and S2s, and show per state that a save which validates before the sale still validates after it, and that S2s is either brought to a validating state or quarantined.

## 6. Proposed implementation slices (after Owner decisions)

1. **D-1 disposal fix** (if Q10 = yes): one writer, with Node, save-fault, WebKit and old-save tests.
2. **Option A for new movements:** row, `companyDebt`, liability effects and suppression, with the allocator choice from Q7.
3. **Legacy migration** per Q1–Q4, as a separate PR with old-save fixtures for S1–S4.
4. **Personal mortgage tracking** (only if Q8 = yes), as its own PR:
   - Migrate S5 by adding each personal mortgage's gross outstanding `B` to `personalDebt` once, with an old-save fixture.
   - The personal writers must decrement `personalDebt` only for balances that were migrated or originated as tracked, so a repayment never consumes unrelated personal debt. This follows the same `accountingTracked` rule that #1015 applies to property-secured loans.
   - **Generic repayment:** `engine.repay(amount,'personal')` (`js/engine.js` `repay`) lowers `personalDebt` without touching `p.mortgageBalance`. A later scheduled payment, prepayment or disposal would then decrement `personalDebt` for the same principal a second time. The slice must reserve tracked mortgage principal from generic personal repayment, the same way #1015 reserves tracked property-secured loans, so mortgage principal is only ever settled by the mortgage writers.
   - **Generic interest suppression:** the weekly personal interest (`js/engine.js` `personalCash -= personalDebt * personalBorrowRate() / 52`) would charge the tracked mortgage balance on top of the mortgage's own interest in `real-estate-mortgage-refinancing.js`. The slice must charge generic personal interest on `personalDebt − tracked mortgage principal` only. This is the personal counterpart of the company rule that adds `'propertyMortgage'` to `INDIVIDUALLY_SERVICED_SOURCES` (§3). Whether tracked mortgages should still raise the `personalBorrowRate()` tier, which reads `personalDebt`, is part of Q8.
5. **Shared per-property encumbrance** for LTV (D-5): separate PR.

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
