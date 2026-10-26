# P4-AUD-010 / #1079: mortgage shortfall correction

Base: `a3b7bc72687be5919cd0b894f4862aeb96bc2a6b` (main after #1124).
Owner priority: correct #1079 before continuing Economic Engine Phase 3.

## Defect and correction

The probe in #1011 (`scripts/p4-cand-009-010-audit.cjs`, commit
`3130d299a14edcb35ea44e54c925d080c377bae6`) demonstrated that a personal
mortgage of ¥195,000,000 at 3.2%, with 520 remaining instalments, consumed
an instalment even with no payment. Its ¥120,000 weekly unpaid interest
was discarded. After 520 missed payments, the principal remained but the
schedule had reached zero and no arrears were recorded.

The correction keeps an incomplete instalment outstanding. Interest has
priority over principal, and principal is the remainder of the actual payment.
A fully funded scheduled payment consumes one instalment; a short payment
keeps the remaining count and increments `mortgageDelinquentWeeks`. Full payoff
sets the remaining count to zero. An already-zero schedule with debt has one
overdue instalment while underpaid. This does not introduce foreclosure,
penalty rates, or an automatic acceleration/default workflow.

| Mortgage ownership/accounting | Unpaid interest | Debt and ledger attribution |
| --- | --- | --- |
| Personal | `property.mortgageUnpaidInterest`; no interest on that arrears balance | Only personal cash and property mortgage state; no company ledger and no unrelated `personalDebt` mutation |
| Company, Option A tracked | Existing capitalization into `mortgageBalance` | Existing cashless interest expense + borrowing, `companyDebt` and the `propertyMortgage` finance-loan mirror stay synchronized |
| Company, legacy off book | `property.mortgageUnpaidInterest`; no interest on that arrears balance | Preserve forward-only Option A policy: no new generic debt authority/rebase; recognize interest expense when the arrears are settled |

For personal/legacy mortgages, the payable charge is this week's rounded
interest plus stored unpaid interest. Neither stored principal nor stored
arrears is rounded again. New weekly charges follow `ceilYen`; payments are
capped after rounding by the exact debt and available owner cash. Thus an
existing fractional final payoff remains exact. After 520 zero-cash weeks,
the personal example retains principal ¥195,000,000, interest arrears
¥62,400,000, 520 remaining instalments and delinquency 520 weeks.

## Payoff and visibility

`outstandingBalance(property)` is principal plus separate unpaid interest;
tracked company interest is already in principal and is never added twice.
Refinancing targets must cover that total plus the existing fee funding rule.
Refinancing pays old arrears from the new borrowing and clears the separate
balance; it does not silently forgive the charge. Prepayments settle interest
before principal. Disposal deducts both principal and arrears from owner sale
proceeds, with legacy company interest posted separately from principal.

The existing legacy company S1/S2 disposal quarantine remains based on the
principal-only historical off-book gap. Unpaid interest is not yet expensed,
so adding it to that gap would incorrectly block S1. Settling it produces an
interest expense while principal payoff closes the historical gap. S2 remains
blocked; this change does not rebase or migrate historical company accounts.
Shared-collateral quotes and portfolio debt metrics include separate arrears.
Mortgage controls display unpaid interest and delinquent weeks.

## Persistence and scope

The optional property fields use existing save/transaction infrastructure,
`saveVersion=9` and the unchanged save key. Missing arrears initialize to zero;
there is no reconstruction of unknown interest discarded by an earlier build.
No RNG calls, generic personal-debt writer, finance source of truth, save schema
version, or Phase 3 production authority is introduced. Direct weekly processing
retains its existing wrapper and per-week idempotency; the installed outer
transaction provides rollback and persistence.

## Verification and merge gate

`tests/p4-aud-010-mortgage-shortfall-test.js` turns the exact three original
cash cases (¥120,000 / ¥307,500 / ¥0), plus 520 missed payments, into green
regressions. Against the base implementation it failed with remaining
instalments 519 instead of 520. It covers personal, tracked company and legacy
company state, interest/principal conservation, company debt mirrors, same-week
idempotency, deterministic replay, past-maturity fractional payoff, prepayment,
refinance, disposal and collateral quotes. It also checks save-false,
save-throw and post-save-throw rollback, storage mirror restoration, and reload.
It is registered in the canonical suite and shard L.

`tests/property-mortgage-refinance-webkit-test.js` adds personal/company weekly
shortfall success and the three save faults, then exports real IndexedDB into
a fresh iPhone WebKit context without localStorage and checks hydrated mortgage,
finance and owner balances. This is emulated WebKit, not a physical-iPhone test.
The existing M&A workflow runs that browser test; its trigger contract includes
the new Node regression. Local execution results and final-HEAD CI are reported
in the PR rather than inferred from registration.

This is an authoritative financial writer correction. All applicable final-HEAD
CI/browser checks and scoped financial review must pass before merge. Codex
implementation or a Codex bot review alone does not establish distinct-model
independent review; report that limitation for the Owner's decision. Phase 3
stays paused until #1079 is accepted.
