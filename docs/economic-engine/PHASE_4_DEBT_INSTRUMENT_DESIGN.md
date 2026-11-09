# Phase 4 Canonical Debt Instrument Design

**PROPOSAL — Entry NOT AUTHORIZED; no executable capability introduced.**

Audited main: `ee4f37f561fe326545deed96a127d0a032ebcb24` (2026-10-14 JST). Implementation facts and source anchors are in [Audit](PHASE_4_PREIMPLEMENTATION_AUDIT.md) and [Writer Matrix](PHASE_4_WRITER_AUTHORITY_MATRIX.md). Names in this document are proposed APIs/fields unless explicitly described as existing.

## 1. Scope, authority and six separate layers

Phase 4 establishes entity-scoped debt contracts, Cost of Debt and financing/risk inputs. Full WACC, Cost of Equity, EV/Equity Value and ROIC-versus-WACC integration remain Phase 6+. M&A settlement Phase 10, treasury Phase 11, consolidation Phase 12, PE Phase 13, VC Phase 14, property/SPV settlement Phase 15 and bank balance-sheet authority Phase 16 remain separate. Existing products remain operational behind legacy adapters.

| Layer | Owner / representation | Forbidden behavior |
|---|---|---|
| Contract terms | Immutable versioned terms and amendments | Changing principal/cash because a coupon or date changed |
| Economic event | Complete validated EconomicOperation with principal/interest references | Posting one leg independently; inventing missing historical events |
| Accounting ledger | Journal/projection from that committed operation | Independently rewriting instrument principal from a B/S display total |
| Cash settlement | The operation settlement reducer, scoped legal account | Domain helper also moving the same cash |
| Instrument state | Reducer-derived principal/payable/rate/status plus non-money contractual state | Another principal writer alongside ledger/legacy reducer |
| Metrics / UI | Pure projections of committed state and period books | Retuning credit limits, balance or progression while rendering |

The **single authoritative debt reducer** applies a validated operation once inside the existing outer transaction. It updates the debt backing state, legal cash accounts and legacy finance projection as one atomic result. The ledger records that same operation; it is not a second principal setter. Compatibility aggregates and loan rows become reducer-derived mirrors only for explicitly adopted families. Non-adopted families remain legacy-authoritative. A family is never simultaneously serviced by old and new weekly interest code.

Existing `economic-settlement.js` is store-renovation-specific. Proposed debt settlement is an extension with explicit family validators, not an existing generic API. Pure schema/adapters can be implemented before adopting any writer; production adoption requires the gate and separate Owner decision.

## 2. Proposed normalized records

### Contract (immutable per version)

| Field | Type / constraints / meaning |
|---|---|
| debtInstrumentId | Stable opaque string; unique across legal entity generations; never display name / index alone |
| schemaVersion / contractVersion | Positive integers; separate from game saveVersion=9 |
| borrowerEntityId / lenderEntityId | Approved entity IDs. Founder/company reuse P1 identities; external lender uses approved `external:lender`; unknown lender remains unknown evidence, not invented bank entity |
| currency | `JPY` only initially, as in economic-operation.js; unsupported FX does not convert silently |
| instrumentKind | termLoan / revolvingDraw / mortgage / margin / shareholderLoan / bridge / legacyUnknown; bonds/options are modeledUnsupported until approved |
| facilityId / trancheId | Optional distinct facility/draw identities; facility commitment is not outstanding principal |
| originalPrincipal | Finite nonnegative contractual face at issue; never current carrying value |
| committedLimit / undrawnLimit | Optional facility terms; undrawn computed, not cash; only approved availability is usable |
| interestType | fixed / floating / zero / legacyPool / unknown; stored zero alone cannot prove interest-free |
| referenceRate | Optional {sourceKey, annualDecimalUnit, fixingLagWeeks}; no blind mixing policyRate decimal with economicFoundation percent |
| fixedCoupon / spread / floor / cap | Finite annual decimal rates; ranges explicit per approved product, no arbitrary clamps to fix invalid evidence |
| interestResetSchedule | rule + first/reset weeks + fixing/source/version; unknown for ambiguous legacy rows |
| dayCountBasis / compounding | Initial proposed `game-week/52`, simple; PIK only by explicit term. Real calendar dates not inferred from game weeks |
| interestPaymentSchedule | frequencyWeeks, firstDueWeek, arrears rule, payment ordering |
| principalRepaymentSchedule | manual / bullet / equalPrincipal / annuity / sweep; due rules, final residual, deferral; normalized bounded schedule rather than 5,200 rows per contract |
| issueDate / maturityDate | Game-period {week}; nullable unknown legacy evidence; maturity contractual distinct from repayment due/aggregate refinance policy |
| seniority | senior / subordinated / unknown; lender waterfall unsupported without agreed terms |
| secured / securityStatus | secured / unsecured / unknown; secured boolean allowed only for known evidence |
| collateral | Array of asset/property/security IDs, valuation source, lien priority, coverage, recourse. Collateral is not transfer of title |
| guarantorEntityIds / guaranteeTerms | Distinct obligor and capped/contingent guarantor exposure; no automatic parent cash access |
| covenant | Versioned metric, comparator, threshold, window, grace/cure, consequences, source; lender legal terms separate from player aggregate warning policy |
| fees / OID | Separate upfront fees, financed fees, discount, treatment and amortization schedule evidence; null when unknown |
| callable / putable | unknown / false / modeled option terms including dates/price; absence is not a free early-cancel right |
| modificationTerms / prepaymentTerms | Consent, notice, penalties and treatment; no retroactive contract changes |
| sourceAliases / provenance | Source collection+durable IDs, snapshot/main version, evidence quality and aggregate inclusion; aliases identify one fact, not additional liabilities |
| settlementCapability | legacyReadOnly / shadow / adopted; proposal capability does not enable production |

### State (reduced from a baseline and committed events)

| Field | Meaning / writer |
|---|---|
| outstandingPrincipal | Contractual principal including explicitly capitalized interest; debt reducer only after adoption |
| accruedInterest | Recognized unpaid interest, separate from principal; debt reducer only |
| carryingAmount / unamortizedFees / unamortizedOID | Optional accounting basis; not another contractual principal; unsupported until approved EIR policy |
| effectiveInterestRate | Derived current financing rate with source/fixing/version. EIR yield differs from current coupon; expose `couponRate` and `allInAnnualCost` separately |
| currentRateFixing / nextResetWeek | Applicable annual coupon and schedule cursor; no read-time reset |
| nextInterestDueWeek / nextPrincipalDueWeek | Deterministically derived obligations; each obligation has stable schedule ID |
| overduePrincipal / overdueInterest | Subsets of existing payable/principal, never add them again to total debt |
| lifecycleStatus | originated / active / matured / closed; accrual/payment are event states, not mutually exclusive lifecycle statuses |
| defaultStatus | current / delinquent / covenantBreach / default / restructuring / workout; independent from maturity |
| refinancingStatus | none / proposed / approved / executing / refinanced / rejected; old debt not closed at proposal |
| covenantResults / cureDeadlineWeek | Committed-period evidence; no credit or cash mutation by metric calculation |
| lastAccrualWeek / scheduleCursors | Once-per-interval guard plus durable event identity |
| lastCommittedOperationId / receipts | Replay reference/checkpoint, not reliance on bounded UI histories |
| termsVersion / stateRevision | Optimistic precondition guard; duplicate same key+same digest returns receipt, same key+different digest rejects |

`issueDate`/`maturityDate` are gameplay dates. No `Date.now`, host RNG, locale-dependent ordering or fresh random UUID. Existing legacy IDs are preserved in aliases. Proposed native IDs derive from entity-generation scope + persisted command sequence; counter consumption commits/rolls back with operation. Missing stable legacy identity returns unsupported; a source-array index is diagnostic only. Whole company refounding must not attach old-company debt to a new entity accidentally.

### Read-only return contract

Proposed `projectDebtSnapshot(rawSnapshot)` returns frozen `{instruments, facilities, reconciliation, metricsEligibility, unsupportedEvidence}`. Proposed `reconcileDebtSnapshot` returns per-family/per-obligor principal differences and exact alias conflicts. Extend the existing economic-read-model boundary; do not replace its public shapes silently.

Never call live ensureFinance, bank migration, quote normalizers or buildStatements to obtain a read-only projection. Use immutable raw input, or clone before invoking legacy calculation. Reject accessor/non-JSON/nonfinite records consistently with economic-operation validation. Absent contracts stay null+reason; zero is a measured value, not a substitute for missing data.

## 3. Operations, postings and compatibility

Existing Core accounts include `asset:cash`, `asset:debt-receivable`, `liability:debt-principal`, `liability:accrued-interest`, `expense:interest`, `income:interest`. A lender accrued-interest-receivable account and fee/OID accounts require a separate approved taxonomy extension; do not disguise them as debt principal. External aggregate position uses existing approved accounts and counterparty IDs without instantiating a bank balance sheet.

Every monetary operation uses the existing strict schema: `schemaVersion`, `operationId`, `idempotencyKey`, `operationType`, `status`, optional `decisionPeriod`, `recognitionPeriod`, `duePeriod`, `settlementPeriod`, `effectivePeriod`, `metadata` and `postings`. Proposed `termsVersion`, `entityGeneration`, contract/event links and immutable source evidence belong inside `metadata`, not new top-level fields. `type` is not an allowed field. The existing validator rejects unknown top-level fields; any future schema extension is separately approved and tested. Every monetary leg uses nonnegative amount and debit/credit direction; principal positions reference debtInstrumentId; accrued-interest legs also require that reference under the new family validator even though the generic taxonomy does not yet enforce it. Balance independently per entity and currency; pair lender postings only when lender is modeled, otherwise explicit aggregate external counterpart.

| Proposed family | Borrower postings | Modeled lender / counterparty | Legacy projection |
|---|---|---|---|
| debt:originate / debt:draw | Dr Cash P; Cr Debt principal P | Dr Debt receivable P; Cr Cash P | debtBorrowing cash+, liability+ |
| debt:accrue-interest | Dr Interest expense I; Cr Accrued interest I | Dr Interest receivable I; Cr Interest income I | interestExpense cash0, profit−; compatibility liability accrual projection must be extended before adoption |
| debt:pay-interest | Dr Accrued interest I; Cr Cash I | Dr Cash I; Cr Interest receivable I | Cash payment with profit0; current interestExpense cash/P&L coupling is insufficient by itself |
| debt:repay-principal | Dr Debt principal P; Cr Cash P | Dr Cash P; Cr Debt receivable P | debtRepayment liability−, cash−, profit0 |
| debt:capitalize-interest | Dr Accrued interest I; Cr Debt principal I | Receivable reclassification | Cash0; principal+; no second interest expense; separate principal increase subtype needed in roll-forward |
| debt:amend / debt:reset-rate | No monetary leg when terms-only | Terms-version receipt; no principal or cash | Contract event; generic validator requires nonempty postings, so dedicated nonmonetary event envelope needed |
| debt:refinance | New borrowing + old payoff + explicit fee legs | Matching counterparty positions | One composite operation, no old interest expense repeated |
| debt:release / correction | Liability reduction with explicitly approved gain/equity/settlement account; no cash unless payment | Matched lender loss/release | Not default itself; account policy not authorized |

The generic validator currently requires postings; do not submit a fictitious zero-value money action to represent a terms-only amendment. Proposed debt contract events have a validated nonmonetary envelope and the same receipt/transaction boundary, or an explicitly approved operation schema extension. That choice is an implementation contract prerequisite.

Borrowing fees expensed immediately versus EIR/discount amortization is an Owner policy choice. Initial compatibility observation preserves existing expensed fees, never silently capitalizes them. Canonical fees must identify amount paid, net proceeds and principal financed. OID face P, proceeds P−OID, carrying value and amortization remain distinct; no production OID before policy/taxonomy tests.

Before accrual adoption, extend Phase 2 B/S/CF/retained-earnings close **and the installed gameplay profit pipeline** to represent interest payable and cash-only interest settlement. `engine.js:2318-2325` currently uses one cash-paid interest value for expenses, profit, cash, tax, credit, reports and histories. The compatibility prerequisite must route accrued interest once into gameplay expenses/profit, quarterly taxable income, cumulative/retained profit, credit observations, reports/history and dividend/coverage inputs, while cash and founder personal receipts move only on actual interest settlement. Payment must not repeat expense/tax recognition, and the old generic interest cash debit must be excluded only for the adopted cohort. The contract must account for directly serviced bank/gym contributions too. This is P4-4b below, completed and tested before live adoption; changes remain prohibited in this docs PR. Current finance interestExpense alone cannot express that split without double P&L. New principal roll-forward includes opening + draws + approved PIK − repayments − approved releases; interest roll-forward opening + accrual − payment − capitalization − approved release. Sum by instrument equals obligor liability account; carrying basis differences reconcile separately, not as unexplained cash.

## 4. Lifecycle/event transition contract

The requested Origination → Active → Accrual → Payment → Amendment/Refinancing → Maturity → Closed is an event flow. An active instrument can accrue, partly pay and breach in the same week; lifecycle, payment and credit statuses therefore remain orthogonal.

| Transition/event | Preconditions | Required event / cash / postings | State / validation / timing | Error state |
|---|---|---|---|---|
| Origination→Active | Known obligor/lender/pool; approved terms/capability; positive principal; capacity; generation valid | originate/draw; cash+net; principal+gross; fee separate | Contract identity unique, terms revision1; borrower/lender conservation; action-time atomic commit | Rejected proposal, no instrument/cash if failed |
| Active→Accrual event | Principal>0; known coupon/basis; interval not processed; accrual capability | accrue-interest; cash0; expense/payable+ | Use opening-period principal and approved fixing; advance accrual cursor only on commit | Missing fixing/invalid terms blocks affected family/tick; never uses zero silently |
| Interest due→Payment | Recognized payable; due authorization; borrower own cash | pay-interest; cash−; payable−; profit0 | Allocate interest by explicit waterfall; partial unpaid remains; recognition interval unchanged | Insufficient cash→delinquency if approved; operational failure rolls back, no false payment |
| Principal due→Payment | Due/prepay permission; principal>0; cash; penalty known | repay-principal; cash−; liability−; profit0 | Cap at principal; final penny residual paid explicitly; lender settlement exact | Partial principal remains due; no expense / no negative balance |
| Amendment | Consent/eligibility; referenced version; no rights shortcut | amend receipt; cash0 unless explicit fee | New immutable terms version/effective week; future schedule only unless correcting operation | Rejected or versionConflict; original contract retained |
| Rate reset | Floating terms; reset due; persisted fixing source; lag rule | reset receipt; cash0 | Snapshot reference+spread/floor/cap; no reset at render; affects approved interval only | Missing reference→unsupported/block, not host rate fetch |
| Refinance→new Active | Both contracts/consents, lender funding, payoff including accrued, fee, recourse | composite originate+old principal payoff+interest payoff+fee | New ID; old contract linked; old closes only at principal/payable0; all legs one transaction | Proposal rejected/financing insufficient; old debt fully retained |
| Maturity→Matured | Contractual date reached | Due event, cash0 unless successful separate payment | All unpaid principal becomes due; no spontaneous liability/cash change; subsequent accrual follows terms | Matured unpaid→delinquent/default after agreed grace |
| Closed | Principal=0, payable=0, no unresolved due/fees/claim | Close receipt; cash0 | Retain stable contract/receipt checkpoint; cannot accrue again | Nonzero claims block closure |
| Covenant breach | Complete committed metric/window; comparator violated | breach event, cash0 | Record evidence+grace; default/premium only contract consequence; missing metrics unknown | Unknown covenant evidence cannot manufacture breach/compliance |
| Delinquency / Default | Due missed and agreed grace/cross-default condition | credit-state event; cash0 | Keep principal and payable; generic default does not forgive; no parent guarantee assumed | Error versus economic default remain separate |
| Restructuring / Workout | Approved consent and terms/accounting treatment | amend/payment; release only separate approved operation | Explicit altered schedule/claim, recovery allocation and credit evidence | No silent waiver; failure preserves original state |
| Write-off | Approved accounting vs legal-release distinction | Lender impairment alone does not extinguish borrower debt; borrower release separately posted | Modeled unsupported until policy/account taxonomy approved | Cannot close debt merely because lender impaired receivable |

### Common execution contract for every row

Idempotency key proposed `debt:{entityGeneration}:{instrumentId}:{family}:{obligationOrCommandId}:{termsVersion}`. Weekly accrual uses interval week, schedule payments use stable obligation ID, repeated legitimate same-week prepayments use distinct admitted command sequence. A repeated command with identical key/digest returns its receipt without moving state; same key/different payload fails. Atomic refinance key links old/new IDs under one operation.

Construct and validate **all** legs and state revisions before mutation. Apply through one reducer in runTransaction; validate instrument/account/finance invariants; record receipt; save admission; emit commit outcome. On throw/false restore state, terms, cursors, journal/projection, ID counter, simulation RNG and newly queued writes. Preserve older pending writes. On durable async failure retain diagnostic/persistence-pending status, do not blindly replay settlement; fresh hydration and retry contract must identify which receipt is durable.

Save/reload must resume from committed cursors and durable receipt/checkpoint. Compaction may prune detailed events only after an authoritative opening checkpoint and replay protection have been verified. Bounded histories alone cannot supply permanent idempotency. No canonical persistent root is added in the read/shadow stage; a later storage design is separately approved.

### Weekly ordering proposal

Preserve current outer canonical week boundary. For adopted families only: read committed rate observations at defined fixing cutoff → compute approved reset → accrue opening principal for interval → settle obligations due at boundary → assess grace/covenants from completed accounting period → finalize finance/standalone close → validate/reconcile → commit/save. Action origination starts accruing at the next defined interval; no retroactive full-week interest. Current macro update order is not silently moved; choosing previous committed fixing versus in-week observation requires Owner acceptance and a characterized order test. Non-adopted writers run exactly as before. Adoption must disable generic/individual legacy servicing for the same principal atomically.

## 5. Cost of Debt and financial input contract

All metrics are entity-scoped, currency-consistent, pure, tagged with asOfWeek/window/source/coverage/quality. Recompute after committed events and weekly close; render computes no event/RNG. Amounts JPY round at posting to ¥0.01; rate math keeps finite annual decimals, display percent 2 decimals; ratios display2, internal comparisons unrounded. Never divide by zero or return arbitrary 99 as canonical infinity. Return `{value:null, reason}` for unavailable/unsupported/zero-denominator; negative EBITDA/equity gets nonMeaningful plus raw values. Negative net debt can be shown as net cash explicitly. Unknown debt rows make totals incomplete; no false precise aggregate.

| Metric / formula | Required data / existing implementation | Refresh / units | Phase disposition / accounting relation |
|---|---|---|---|
| Weighted Average Cost of Debt = Σ(P_i × allInAnnualCost_i)/ΣP_i | Unique principal and current coupon, fees/OID and term basis; generic pool rate known but not equivalent to complete EIR | Commit/weekly; annual decimal | P4 coupon-weighted proxy can be complete for known families; label fee-excluded. All-in debt cost only with approved fee treatment. Not WACC |
| Realized debt cost = interest financing expense(T)/average debt(T) ×52/T | Accrual interest+approved fee amortization, time-weighted exposure; finance PL exists, full exposure history absent | Close; annual decimal | P4 forward-only; distinguish realized versus marginal offered cost |
| Fixed/floating ratio = fixed/floating known principal / total known principal | Rate basis by servicing evidence; no current unified metric | Commit; fractions with unknown bucket | P4; legacyPool not automatically fixed or floating |
| Debt/Equity = interest-bearing principal / standalone book equity | finance.ratiosFrom already deRatio; distinguish book debt and interest-bearing perimeter | Close; x | P4 book leverage; market capital structure / optimal structure Phase6+ |
| Debt/EBITDA = D / TTM EBITDA | finance PL ebitda exists, unique debt, 52-week complete window | Close; x | P4 once data complete; no short window disguised as TTM |
| Net Debt/EBITDA = (D−eligible unrestricted cash)/TTM EBITDA | Entity cash eligibility/restricted exclusions; no full canonical implementation | Close; x | P4 standalone; fund/personal/group cash never netted automatically; valuation net debt policy Phase6 |
| Interest Coverage = TTM EBIT / TTM accrued interest expense | finance.ratiosFrom operatingIncome/interestExpense exists; legacy debt-service uses lastReport proxy | Close; x | P4 book metric; do not replace rating policy without approval |
| DSCR = cashAvailableForDebtService(T)/(cash interest + scheduled principal)(T) | Approved CFADS = operating cash before financing interest after tax and required maintenance CapEx; dedup due schedule | Close/forward13; x | P4 after CFADS inputs approved; property quote DSCR proxy exists, not entity DSCR. Unpaid due included in stressed coverage |
| Available borrowing capacity = max(0,min(committed undrawn facility, credit constraint, collateral/DSCR/covenant limits)) | Existing companyCreditLimit and property quotes are proxies; committed facilities mostly absent | Commit/weekly; JPY | P4 only explicit executable capacity; indicative quotes separate. Bank underwriting/deposit policy Phase16 |
| Short-term liquidity = eligible cash + committed drawable facilities − due13 principal/interest − tax/AP − required operating reserve | Phase0 Deployable Capital deductions; finance.forecast13 exists but incomplete scheduled rows | Commit/weekly; JPY and coverage | P4 forward obligations; no rehypothecation or fungible fund cash |
| Maturity ladder = principal contractually due by [0–13,14–52,53–104,105–260,>260] weeks + unknown + overdue | Instrument schedules/maturity, grace/amendments, no authoritative unified ladder | Commit/weekly; JPY | P4; aggregate debtRefinancing date is policy exposure, not each loan maturity |
| Refinancing exposure = due-horizon principal / total debt; funding gap = due − cash allocated − committed proceeds | True maturity/payable+approved committed refi, unknown bucket | Commit/weekly; fraction/JPY | P4 scenario; proposals not assumed cash |
| Covenant headroom = upper limit−actual or actual−lower limit | Metric scope/window/comparator threshold; legacy bank/aggregate conditions exist | Close per covenant; x/JPY | P4 known terms; relative headroom optional only if nonzero threshold; missing data unknown |
| Rate sensitivity ΔI_annual = Σ floating P_i × (clamped shifted coupon − base coupon) | Reset date, source fixing, floors/caps, schedule; legacy personal variable exists | Snapshot scenarios +100/+300bp; JPY/year | P4 pure shock; 13-week cash scenario uses time-weighted balance/reset, not full-year approximation |
| Internal credit signal | Existing playerDebtService score/grade and companyCredit, covenant status | Weekly; score/grade + evidence | P4 expose source-tagged observation; new PD/rating calibration not silently authoritative, not real agency rating |
| Tax shield inputs | Interest deductibility, statutory rate, taxable-profit capacity, jurisdiction/entity boundary | Close; JPY + annual decimal | P4 provides gross interest/rate/eligibility evidence. Recognized savings require tax contract; interest×taxRate is scenario upper bound, not cash |
| After-tax Cost of Debt = Kd×(1−usable tax benefit fraction) | Complete Kd and effective usable tax evidence | Valuation snapshot | P4 inputs; formal WACC weighting and Cost of Equity Phase6+ |
| ROIC vs cost / optimal capital structure | Accounting, debt inputs, industry and valuation/CoE | Immutable Phase6 snapshot | Phase6/7; P4 does not declare optimum or choose borrowing automatically |

No current metric is marked implemented merely because a similarly named UI number exists. P4 must not substitute derived financial ratios for an approved credit-limit writer.

## 6. Owner decisions before executable adoption

1. Initial adopted perimeter: recommended standalone company generic/external and founder shareholder instruments, only after **all** mutators touching those rows are closed over. Personal, property, M&A, fund and NPC observations remain legacy until approved families/phases.
2. Weekly rate fixing cutoff, origination accrual start, simple game-week/52 and explicit fixed-versus-floating classification. Preserve current game behavior until approved.
3. Fee expense/EIR/OID, interest payable compatibility and account taxonomy; no retrospective reconstruction.
4. Cash insufficiency, grace/default rate, interest-first allocation, PIK permitted products and write-off/legal release policy.
5. Durable receipt retention/checkpoint budget and entity-generation identity after company sale/refounding.
6. CFADS, cash eligibility and covenant consequences; observations can be delivered before formulas become executable policy.

These decisions are surfaced for future approval; this advance design does not pause for them and does not enact them.

## Review completion prerequisites (2026-10-14)

- P4-4a is a mandatory prerequisite implementation slice for the selected interest-receivable taxonomy and validator, before P4-5 accrual builders. This design chooses a dedicated receivable account under explicit Owner approval; it cannot call the absent account an optional follow-up. A later choice to use existing `asset:accounts-receivable` would require its own approved metadata/projection contract and revised dependency proof.
- P4-4b is the separate gameplay/accounting compatibility slice before live adoption. RED/GREEN must prove cash-zero accrued interest changes profit/tax/report/retained earnings once, later payment changes cash/payable only, founder receivable/income/cash align, and mixed legacy/canonical pools each charge once. Test configured tax/dividend weeks and save/reload/fresh hydration; no historic accrued-interest invention.
- Preserve all existing operation-schema requirements including nonempty monetary postings, per-entity balance, optional debtInstrumentId on each relevant leg, and family validation. Terms-only events use the separately designed event envelope, not forged zero-value postings.
