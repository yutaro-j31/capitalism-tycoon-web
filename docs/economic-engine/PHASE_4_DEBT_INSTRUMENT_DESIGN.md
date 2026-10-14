# Phase 4 — Canonical Debt Instrument Design

Status: **PROPOSED / OWNER REVIEW PENDING**. Baseline `ee4f37f561fe326545deed96a127d0a032ebcb24`. Phase 4 Entry **NOT AUTHORIZED**. All APIs/fields below are proposed unless explicitly cited as existing. No production change or persistent schema migration is made by this package. [Audit](PHASE_4_PREIMPLEMENTATION_AUDIT.md) and [matrix](PHASE_4_WRITER_AUTHORITY_MATRIX.md) define the actual starting point.

## 1. Authority contract

Six separate concepts:

| Layer | Responsibility | Authority |
|---|---|---|
| Contract | Borrower/lender, pricing, schedule, security, covenants, fees, signed amendments | Immutable revision history; no cash setter |
| Event | Due/accrual/reset/amendment/payment/refinance instructions | Pure validated operation plan using opening committed facts |
| Ledger | Balanced committed EconomicOperation postings, instrument reference, event receipt | Evidence; no second state-mutating replay loop |
| Settlement | Validate and atomically reduce validated operation into cash, instrument state and finance compatibility projection | **Only authoritative economic writer for explicitly adopted family** |
| Instrument state | Principal, accrued/payable/PIK interest, schedule progress, status | Reducer output, never independently edited by UI/weekly legacy service |
| Metrics | Rates, risk, leverage/coverage, maturity ladder | Pure read-only calculation with coverage/provenance; not price/credit writer |

After an approved family cutover, one `settleDebtOperation(engine, plan)` (proposed) owns its cash/principal/accrued-interest changes inside existing runTransaction + storage checkpoint. It validates EconomicOperation and family-required legs, claims durable idempotency receipt, applies deterministic reducer once, writes compatibility projection and ledger evidence, validates, then commits once. `companyDebt`/loan rows become projections for **that family only**. Other families keep their current writer. Journal insertion and finance.event must not themselves rerun cash/principal mutation. Ledger-derived balances are a reconciliation oracle; runtime state is the reducer materialization of committed operations, not a competing independently writable source.

Existing `economic-settlement.js` supports renovation only. Extend its established validation style; do not pretend a generic debt-settlement API already exists. Existing economicShadowJournal offers receipts/checkpoints/retention but its replay horizon is bounded: approved debt event receipts need a compact per-instrument progress/closure watermark to reject repeats after history compaction. Define horizon and archival retirement before cutover; no unbounded receipt array or probabilistic Bloom-filter rejection.

## 2. Proposed model and numeric domains

```text
DebtInstrument {
  debtSchemaVersion: 1
  debtInstrumentId, instrumentFamily, authorityMode
  contract: {
    revision, borrowerEntityId, lenderEntityId, currency: 'JPY'
    originalPrincipal, issueDate, maturityDate
    interestType, referenceRate, spread, fixedCouponRate
    rateFloor, rateCap, effectiveInterestRate, dayCountBasis
    interestResetSchedule, interestPaymentSchedule
    principalRepaymentSchedule, paymentAllocationOrder
    seniority, secured, collateral[], guarantees[]
    covenants[], fees, OID, callable, putable
    unpaidInterestPolicy, recourse, transferRestrictions
  }
  state: {
    contractRevision, outstandingPrincipal, accruedInterest
    dueInterest, overduePrincipal, overdueInterest
    capitalizedInterestPrincipal, carryingAmount
    lastAccruedThroughPeriod, lastSettledEventSequence
    currentCouponRate, nextResetPeriod, nextPaymentPeriod
    lifecycleStatus, defaultStatus, refinancingStatus
    delinquencySincePeriod, covenantBreaches[]
    closedPeriod, replacementInstrumentId, predecessorInstrumentId
  }
  sourceRef, aliasRefs[], sourceConfidence, unknownFields[]
}
```

This is a specification, not a new save field. Production adoption container (e.g. optional `debtRegistry`) and protocol version require separate Entry/cutover approval. Read projection can expose the same structure transiently without adding anything to v9 saves.

| Fields | Meaning / validation |
|---|---|
| IDs | Nonempty stable legal/entity/instrument IDs; no name entropy, array-position ID, host time or random. Aggregate external lender uses existing `external:lender`. Borrower supported/mapped or fail closed. |
| Principal | originalPrincipal is original funded face; outstandingPrincipal is face currently owed incl explicitly capitalized interest. No negative/NaN/Infinity. Repayment cannot exceed due/owed. Separate new draw tranches for facilities. |
| Currency | JPY only as existing economicOperation.MONETARY_CURRENCIES. FX/multicurrency cannot be enabled by adding a string field. |
| Dates | `{period: integerWeek, phase: approvedPhase}` simulation dates; no Date.now/host calendar. Shadow unknown issue/maturity date remains null + reason. |
| Rate | Annual decimal, 0.05 = 5%; negative rate unsupported unless separately approved; retain source units in adapter (economicFoundation.policyRate uses percent, market macro decimal). No rounding rates to money cents. |
| interestType | fixed / floating / legacy-policy / unknown. Contract coupon, effective funding yield and **actual charging policy** must be distinct. EffectiveInterestRate is funding yield incl fee/OID when computable, not a replacement coupon. |
| Reference/reset | Identifier, observed period/rate, spread, cap/floor, reset frequency/lag/effective period. Contract revision is immutable; state currentCouponRate follows approved reset. Unobserved reference means no executable reset. |
| Schedules | Rule version, firstDue, frequency, end, amount rule (bullet/equal principal/annuity/interest-only), moratorium and business phase. No 5200-entry schedule arrays. Partial/due progress tracked in state. |
| accruedInterest | Earned but unpaid total; dueInterest is **subset** of accruedInterest, overdueInterest subset of dueInterest. Never sum all three as separate obligations. OverduePrincipal likewise subset of outstandingPrincipal. |
| capitalizedInterestPrincipal | Subset of outstandingPrincipal arising from explicit PIK event; don't add again to total debt. Excludes unpaid accrued interest before capitalization. |
| Carrying amount | Face principal − unamortized discount/issuance costs (when supported). Phase 4 first adoption excludes amortized-cost/OID products; null carrying amount for unsupported legacy terms. Face is not automatically book amount. |
| Security | Secured is explicit true/false/unknown for shadow; collateral asset/property ID, ownerEntityId, lien rank, allocation limit, pledge relationship; guarantee guarantorEntityId, cap, recourse scope, beneficiary. No automatic parent guarantee. |
| Covenants | Metric definition/version, entity scope, observation window, comparator, threshold, testing period, grace/cure and consequence; undefined consequence rejects execution, not silent acceleration. |
| Default/refinancing | default does not erase debt. Refinancing closes old only when payoff posts; new instrument links predecessor; amendment is not new origination. |
| Fees/OID | Origination/refinance/prepay recurring fees separate from coupon and principal. OID amount/proceeds, amortization rule and effective yield nullable/unsupported until approved. |
| callable/putable | Boolean/unknown plus window/notice/premium; no automatic prepayment right inferred from an existing repay button. Unsupported clauses kept read-only. |
| Confidence | exact-linked / aggregate-only / ambiguous / unsupported; unknown fields do not get fabricated executable defaults. |

New postings use existing roundMoney and cent-exact Number envelope, with integer minor-unit accumulation where valid. Each scheduled accrual rounds once at approved recognition point; keep a bounded deterministic fractional-cent remainder or approved residual allocation at final payment, with its treatment specified in the adoption contract. No silent .1/whole-yen balance forgiveness. Legacy precision and tolerances are preserved only in adapter comparisons, never weakened for canonical settlement. Display rounding does not write back. Retain cents/annual rate precision separately.

## 3. Proposed pure APIs

`validateDebtContract`, `projectLegacyDebt(state)`, `reconcileDebtProjection(state, projection)`, `buildDebtOperation(snapshot, instruction)`, `reduceDebtOperation(snapshot, validatedOperation)`, `deriveDebtMetrics(snapshot, scope, window)`. First four preparation slices have no economic authority. Builders return required monetary legs, state effects, preconditions, expected opening hash/revision and event idempotency key. Unsupported capabilities return a typed unavailable result, never numeric zero for unknown obligations.

Settlement family capability must be allowlisted by borrower + instrumentFamily + operationType + adoption version; a broad global `debtCanonical=true` flag is insufficient. Only an independently approved family may call the reducer against live state. No fund/M&A/VC/stock operation acquires authority through schema support.

## 4. Balanced postings using current account taxonomy

`P` principal, `I` interest, `F` fee, `N` new funding. Dr/Cr are positive JPY amounts; every entity balances independently. instrument reference mandatory on every debt/receivable/interest event. External lender is an approved aggregate entity, not a new simulated bank balance sheet.

| Event | Borrower postings | Lender postings / constraints |
|---|---|---|
| Origination P | Dr asset:cash P; Cr liability:debt-principal P | Dr asset:debt-receivable P; Cr asset:cash P; external flow identified. Founder lending moves personal cash exactly once. |
| Upfront expensed fee F | Dr expense:operating F; Cr asset:cash F | Recipient Dr asset:cash F; Cr income:other F. Fee category preserves family policy until Owner-approved rule change. |
| Accrue I | Dr expense:interest I; Cr liability:accrued-interest I | Dr asset:accounts-receivable I (metadata receivableKind=interest, debtInstrumentId); Cr income:interest I. Existing taxonomy has no dedicated interest-receivable account. |
| Interest pay I | Dr liability:accrued-interest I; Cr asset:cash I | Dr asset:cash I; Cr asset:accounts-receivable I. **No new interest expense/income.** |
| Principal pay P | Dr liability:debt-principal P; Cr asset:cash P | Dr asset:cash P; Cr asset:debt-receivable P. Zero P&L. |
| PIK capitalization I | Dr liability:accrued-interest I; Cr liability:debt-principal I | Dr asset:debt-receivable I; Cr asset:accounts-receivable I. Expense already accrued; no cash. Disabled unless contract/policy approved. |
| Refinance | New origination N + old principal/interest settlement + fee legs in one operation | Each old/new lender's legs separately; deficiency or duplicate new instrument rejects whole plan. |
| Reset/amend/covenant observation | No monetary postings unless fee/penalty actually modeled | Existing validateOperation requires nonempty postings. Use typed nonmonetary contract-event receipt, **not fake zero-value money rows**. Future operation-schema extension would be separate approved concern. |
| Default/workout | Status change alone has no money; payment uses same due/principal legs | Accrual/nonaccrual/penalty policy explicit. No automatic write-off. |
| Forgiveness/write-off | Not enabled in first adoption | Borrower gain/lender loss & carrying impairment require approved policy/tax/counterparty rules. Debt flag alone cannot zero face principal. |

Compatibility finance projection must separate accrued interest from cash paid. Current P2-DEBT-INTEREST-PRINCIPAL check observes liabilityEffect on `interestExpense`: do **not** pass accrued-interest payable movement as principal liabilityEffect. Required future concern: map accrued interest into accrued-expense-compatible balance or a precisely approved new finance projection, keep principal roll-forward invariant unchanged, and add accrued-interest roll-forward/CF checks. Current finance event categories do not automatically provide that contract. No double recognition through `recordWeekly` and new accrual.

## 5. Lifecycle and event contract

Accrual and payment are events while an instrument is Active; they need not turn status Active→Accrual→Active every week. Lifecycle: proposed/originating → active → matured-unpaid or closed; delinquent/default/workout are orthogonal credit statuses. Refinancing state: none/planned/executing/replaced/rejected.

| Event/state | Preconditions & operation | Cash / state / ledger | Timing, key, validation |
|---|---|---|---|
| Origination→Active | Known parties/cash ownership; credit/collateral/capability; accepted contract, unique ID | P cash+principal; issue contract/revision; postings above | Commitment/effective period explicit; `debt:{borrower}:{id}:originate:{intentId}`; credit and required funding legs all checked |
| Accrual | Active or default with approved continued-accrual policy; opening face and rate fixed | No cash; accruedInterest +I; interest expense/payable | Recognition once per period interval; `debt:{id}:accrue:{from}:{to}:rev{r}`; exact quantum/remainder |
| Due | Approved schedule reached | Mark due subset, no second liability | Before settlement in weekly plan; `debt:{id}:due:{scheduleId}:{index}:rev{r}` |
| Payment | Positive instruction; payer matches borrower/authorized guarantor; balance/cash available | Interest subset reduces then principal; cash debit; individual legs | `debt:{id}:payment:{intentId}`; amount alone is not an ID (two legitimate payments can be same amount/week) |
| Early payment | Callable/prepay permission and penalty quote, notice met | Principal + fee settlement; recompute schedule by contractual rule | instruction ID; deny if unsupported callable terms; no principal expense |
| Amendment | Consent, current revision, no retroactive accrual change | New immutable revision effective future; fee only if approved | contract-event ID; never accrue twice because rate revision changes after period accrual |
| Reset | Floating contract, observed reference, effective reset | state coupon only; no immediate interest/cash | event indexed reset period; old coupon accrues through old interval; no UI rate-trigger writes |
| Refinance | Known new funding, old payoff incl accrued/due amounts; no gap | All new funding/old payoff/fee state changes commit once | old/new instrument links and intent ID; failed funding leaves old untouched |
| Maturity | Due date reached with actual outstanding | Fully paid closes; short cash becomes matured-unpaid/delinquent | settlement pays only available authorized cash, or rejects under atomic full-payment contract; never floor negative starting cash to zero |
| Delinquency/breach | Due shortfall or covenant test at defined close | Principal/interest remain; grace/cure clock | deterministic event/version; full debt remains exposure |
| Default | Approved grace/cure expired | Status, collection mode; penalties only contracted operation | Cannot stop principal exposure or invent lender cash; error/retry not default |
| Workout/restructure | Creditor consent, verified schedule/new contract | Agreed payment/amendment; original owed balance until posting | no automatic principal haircuts; explicit separate write-off authority |
| Closed | Principal=0 AND accrued=0 AND due=0; fees resolved | closed watermark, archive contract & opening/closing hash | Closure replay rejection survives compaction; unsupported positive balance never retired |

All monetary events use same rollback: rejected validation returns false without mutation; save-false returns false/restores state and storage; save/post-save throw restores and surfaces typed error. Event is not marked processed before a successful commit. Storage cache/pending/durable copy, RNG and ID counters are covered. Previous pending valid save must survive rollback. Reload and fresh hydration reproduce committed state and reject duplicates. Errors (`unknown-entity`, `unsupported-terms`, `revision-conflict`, `funding-shortfall`, `reconciliation-failed`, `save-rejected`) are operation errors, not financial default statuses. Successful UI feedback occurs after admission/commit, never inside a precommit writer.

Proposed weekly phase inside existing outer week transaction: capture opening principal/rates → approved resets effective for interval → accrue elapsed interval → mark due → settle authorized payments → evaluate close-based covenants/credit for next-period decisions → validate standalone close and principal/accrued-interest roll-forward → commit/persist. Need characterize actual wrapper order first. Initial adoption must explicitly disable its legacy interest/service call in the same PR; no extra weekly hook may double-run both models. Same-period origination interest convention must match adopted family's documented baseline or be separately Owner-approved; no silent extra week of interest.

## 6. Cost of Debt and risk metrics

Shared metric result: `{value, unit, asOfPeriod, window, scope, status, coverage, sourceRefs, formulaVersion}`. Missing/ambiguous/nonfinite data → value null with reason, not 0/999/Infinity. Ratios use unrounded inputs; display ratio4 decimals, annual rates6 decimals, money cents. Debt-free weighted rate null (`no-debt`), ratio debt=0 may be zero when denominator valid. Negative/zero EBITDA/equity return `not-meaningful` alongside raw amounts. All monetary inputs same legal entity, currency and window. Current implementation evidence is partial, not canonical certification.

Let D_i=face outstanding, r_i=current contractual/observed-policy coupon, E_i=effective funding yield, Cash_u=unrestricted borrower cash, EBITDA_52/EBIT_52=matched trailing52-week standalone statements, I_52=recognized interest, CFADS_h=approved forward cash available for debt service, P_h/Ipaid_h=scheduled debt service.

| Metric | Formula / required data | Existing evidence | Frequency; Phase boundary |
|---|---|---|---|
| Weighted coupon Cost of Debt | ΣD_i r_i / ΣD_i; explicit eligible scope | Individual rates exist but generic charge differs | On event/weekly close; P4 only for certified coverage; label coupon vs realized |
| Effective Cost of Debt | ΣD_i E_i / ΣD_i; actual fee/OID cashflows, effective yield | No common effective-yield model | P4 output only fee-free/known computable instruments; unsupported null, full products later approved |
| Realized debt cost | I_52 / average face (time-weighted) | finance interest expense/debt snapshots; short histories partial | weekly close; P4 diagnostic, not marginal borrowing quote |
| Fixed/Floating ratio | Sum fixed/floating face / total face; separately unknown-policy bucket | Property products; generic policy rates | event/close; P4; known buckets must sum incl unknown |
| D/E | Gross legal debt / book standalone equity | finance.ratiosFrom:511 deRatio | close; P4 financial input; optimal/market equity structure Phase6+ |
| Debt/EBITDA | Gross debt / EBITDA_52 | finance.plFrom:506, companyDebt; no full instrument scope | close; P4 if positive complete denominator |
| Net Debt/EBITDA | (Gross debt − Cash_u)/EBITDA_52 | cash present; restrictions/group exposure incomplete | close; P4; negative net debt retained (no silent floor) |
| Interest Coverage | EBIT_52 / I_52 | finance interestCoverageRatio; playerDebtService uses weekly approximation | close; P4, not mixture of subsidiary cash flow and parent's P/L |
| DSCR | CFADS_h/(P_h+Ipaid_h); define h=52 forward weeks | property dashboard DSCR proxy, forecast13 heuristic | event/close; P4 only with explicit CFADS definition; historical operatingCF+interest adjustment labelled proxy until Owner approves cash availability policy |
| Available Borrowing Capacity | max(0,min(credit-policy headroom, covenant headroom, collateral headroom, facility undrawn eligible)) | companyCreditLimit, bank quote, mortgage LTV | event/close; P4 input from existing family policies; no new bank underwriting/automatic grant |
| Short-term liquidity | Cash_u + confirmed receipts_h − contractual uses_h; h=13 weeks | finance.forecast13:516 / player runway | event/close; P4 confirmed vs forecast separated; uncertain receipts not guaranteed financing |
| Maturity ladder | Outstanding principal by actual due buckets overdue/0–13/14–52/53–104/>104/unknown | Aggregate debtRefinancing nextMaturity, row remainingWeeks | weekly; P4; aggregate rollover not contractual due date |
| Refinancing exposure | Maturing principal_h + due interest/fees − committed eligible funding_h | aggregate refinancing approximations | event/weekly; P4 descriptive; new funding only if committed and legal |
| Covenant headroom | upper limit−metric, or metric−lower limit; monetary headroom only invertible formula | bank and player covenant models | test dates/close; P4 contract-version-scoped; no unknown threshold default |
| Rate sensitivity | Σ floating-reset eligible D_i × Δr × horizon/52; cap/floor and reset lag applied | policy rates exist, no shared sensitivity engine | quote/close; P4 deterministic scenario, +100/+200bps; not a prediction |
| Internal credit grade | Existing rule outputs with source/version, or Owner-approved deterministic new rule | playerDebtService grade vs corporateBondsRatings different bases | close; P4 input; no score merger or borrowing rule change without approval |
| Tax shield inputs | Deductible interest by entity/period, taxable income, applicable tax/limits | finance taxExpense/tax; no unified debt deductibility | close; P4 exports observations/eligibility unknown; realized usable shield requires tax policy, not unconditional I×tax |
| Cost Equity/WACC/optimal mix/ROIC spread | WACC=Ke E/(D+E)+Kd_aftertax D/(D+E) only once authoritative valuation inputs exist | Legacy valuations are not new core authority | **Phase6+**; P4 supplies versioned inputs, does not choose Ke, EV, optimal target or final WACC |

Do not use market capitalization as book equity, net debt as face principal, LP commitments as bank debt, or personal cash as company liquidity. Group totals include distinct legal borrowers/guarantees and labelled elimination views, never silently offset minority-held subsidiary cash. Banking origination competition/capital/liquidity ratios and lender business remain Phase16.

## 7. Migration strategy (separately authorized later)

1. Pure adapter from baseline raw fields; no `ensure`, normalize, quote or state writes; preserve unknowns and aliases. Legacy IDs remain source references, not newly persisted allocations.
2. Ephemeral shadow contract/state projection + reconcile by borrower/product/account; compare observed vs predicted principal/interest/cash; zero tolerance for new-core postings, existing adapter tolerances explicitly named. Compare drift, don't repair it.
3. After Entry, optional shadow history adoption only under its slice contract; bounded evidence outside save initially. No automatic load-time migration by this design.
4. Separately approved conversion/adoption plan: backup, dry-run completeness, mapping manifest/authority version, opening principal/accrued balance proof, unique stable entities, unsupported instrument quarantine, one family one cutover PR. Snapshot all cash/receivables, prohibit balancing plugs and historic interest invention. Failed adoption restores all state/storage.
5. After family acceptance, live settlement owns its state; legacy service disabled only for that family; legacy display/finance rows derived once. Old saves without adoption remain on compatible old path until explicit approval defines adoption behavior. Feature capability detects ambiguity and rejects debt action rather than choosing a hidden lender.
6. Rollback deployment before any canonical transaction can revert adoption if save representation still provably compatible; after canonical activity requires explicit reverse-adoption/reconciliation design, not toggling legacy writers back on. `SAVE_KEY` unchanged, saveVersion9 retained; optional new state is still a migration/authority change needing approval.

No adoption code, auto-repair, product enablement, fee rule change, or Phase9+ settlement is authorized by these steps.
