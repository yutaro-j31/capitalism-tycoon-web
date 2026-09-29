# Economic Engine Phase 0 Contracts

**Status: PROPOSED FOR GATE D APPROVAL**  
**Validated repository baseline: `9b8bdc70eecca6e4caa059a3f44863b197b2b8b7`**  
**Implementation permission: NO**

This document turns the Phase 0 items in `ECONOMIC_ENGINE_ROADMAP.md` into explicit contracts. It is a specification only. It does not authorize Phase 1 implementation.

## 1. Scope and non-goals

Phase 0 defines the semantics that later phases must share:

- legal/economic entities
- cash pools and ownership boundaries
- economic terminology
- material transaction shape
- monetary precision and rounding
- accounting/settlement boundaries
- tick order and one-period lag
- invariants
- Control Ladder rights
- founder net-worth treatment
- Deployable Capital
- deterministic state hashing
- retention/save budgets
- migration authority

Phase 0 does **not** replace current production writers. During Strangler migration, existing production state remains authoritative until the phase-specific cutover declared in the dependency graph.

## 2. Entity taxonomy

### 2.1 Stable entity identity

Every Economic Core entity has a deterministic stable ID. IDs are persisted or deterministically migrated; they must never depend on render order, wall-clock time, or host RNG.

Required shape:

```text
EconomicEntity {
  entityId
  entityType
  legalName
  status
  jurisdiction?      // optional gameplay metadata, not a source of randomness
  parentEntityId?    // legal ownership parent when applicable
  metadata
}
```

An entity is not an account. An entity may own multiple accounts/assets. Cash belonging to one entity must never be represented as cash of another entity merely for UI convenience.

### 2.2 Internal entity classes

| Type | Meaning | Cash boundary |
|---|---|---|
| `person` | Founder/player beneficial owner | personal cash/assets |
| `operatingCompany` | Player or AI operating company | company cash/assets |
| `holdingCompany` | Parent holding entity when introduced | own company cash/assets |
| `subsidiary` | Separate legal company controlled by another entity | subsidiary cash/assets |
| `listedCompany` | Company with public security/share class | issuer cash/assets |
| `peFund` | PE investment vehicle | fund cash only |
| `vcVehicle` | VC investment vehicle | vehicle cash only |
| `portfolioCompany` | Company held by PE/VC | portfolio-company cash/assets |
| `propertyVehicle` | Optional SPV for property ownership | vehicle cash/assets |
| `bank` | Modeled bank from Phase 16 onward | bank cash/assets |

The PE management business is **not** the PE fund. Until a separate manager entity is introduced, the current player company may remain the management-company adapter: management fees belong to company cash, while carried interest follows the current personal-cash contract unless a later approved migration changes that rule.

### 2.3 External/system counterparties

Balanced economic transactions must support deterministic aggregate external counterparties:

- `external:customer-market`
- `external:supplier`
- `external:employee`
- `external:government-tax`
- `external:shareholder`
- `external:lender`
- `external:buyer-seller`
- `external:lp-coinvestor`

They do not need individual NPC persistence. IDs must be deterministic and scoped only as deeply as required to avoid double counting.

### 2.4 Cash-pool rule

The following pools are mutually exclusive sources of truth:

- founder/person cash
- player company cash
- subsidiary cash
- PE fund cash
- VC vehicle cash
- portfolio-company cash
- property-vehicle cash
- bank cash

A transfer between pools is a transaction. Reading another entity's cash as "available" is not a transfer.

## 3. Economic glossary

These definitions are normative for later Economic Engine phases.

- **Revenue**: consideration earned from ordinary operating activity in the period.
- **EBITDA**: Revenue minus operating costs excluding depreciation, amortization, interest and tax.
- **EBIT**: EBITDA minus depreciation and amortization.
- **NOPAT**: EBIT after the applicable operating tax charge; financing costs are excluded.
- **Invested Capital**: operating working capital plus net operating fixed/intangible assets required to produce operating earnings, excluding excess cash and financing balances.
- **ROIC**: NOPAT divided by average Invested Capital for the measurement period.
- **Cost of Debt**: expected annualized financing cost of debt before tax; after-tax debt cost is shown separately when used in WACC.
- **Cost of Equity**: required equity return used by the game valuation/allocation model.
- **WACC**: capital-structure-weighted Cost of Equity and after-tax Cost of Debt.
- **Enterprise Value (EV)**: value of operating assets available to all capital providers.
- **Equity Value**: EV minus net debt and other senior claims, plus non-operating assets attributable to equity.
- **Net Debt**: interest-bearing debt minus unrestricted cash that the applicable valuation contract permits to offset debt.
- **Free Cash Flow (FCF)**: NOPAT + depreciation/amortization - CapEx - increase in operating working capital.
- **Deployable Capital**: entity-scoped unrestricted cash remaining after the deductions in §10.

Derived metrics are projections; they do not create cash.

## 4. Material transaction contract

### 4.1 Required fields

```text
EconomicTransaction {
  transactionId
  operationId
  idempotencyKey
  decisionPeriod?
  effectivePeriod
  type
  fromEntityId
  fromAccount
  toEntityId
  toAccount
  amount
  metadata
}
```

Rules:

- `amount` is always non-negative.
- Direction is represented by `from*` and `to*`, never by a negative amount.
- IDs must be deterministic for replayable commands.
- `operationId` groups all legs belonging to one economic action.
- `idempotencyKey` prevents double settlement of the same action.
- metadata must be JSON-serializable and must not contain runtime object references.
- one material economic event is posted exactly once.

### 4.2 Minimum transaction families

The kernel must be capable of representing:

- operating receipt/payment
- payroll/rent/supplier/tax payment
- debt borrowing
- principal repayment
- interest
- equity issuance
- dividend/distribution
- buyback
- asset purchase/sale
- intercompany transfer
- M&A consideration and fees
- fund contribution/capital call
- fund distribution/return of capital/carry
- external investment purchase/sale

### 4.3 Atomicity

A material operation follows:

```text
validate all required legs
→ verify balances/constraints
→ verify idempotency
→ mutate all authoritative legs
→ post transaction(s)
→ run required invariant gate
→ commit
→ projection/update
→ save/emit
```

Failure before commit leaves the relevant economic state unchanged.

No public emit or durable save may expose a partially settled operation.

The current production `runTransaction()` mechanism is a useful rollback precedent, but Phase 1 Economic Transactions are a separate semantic contract and must not be treated as implemented merely because `runTransaction()` exists.

### 4.4 External flows

Money entering/leaving the modeled ownership graph must have an external counterparty. "Create cash" or "delete cash" without an explicit approved external-flow type is invalid.

## 5. Monetary, rounding and close contract

### 5.1 Authoritative unit during saveVersion 9 migration

The authoritative gameplay currency remains **JPY represented as finite JavaScript Number values**, quantized to **¥0.01** at new Economic Core material-transaction boundaries.

Rationale:

- current `finance.js` already quantizes accounting values to two decimal places;
- existing saveVersion 9 states may contain fractional-yen values;
- changing the persisted type to BigInt or forcing all existing cash to integer yen would be a separate save migration.

Phase 1 must therefore not silently rewrite existing saves solely to change monetary representation.

### 5.2 Rounding

For a positive transaction amount:

```text
roundMoney(x) = Math.round(x * 100) / 100
```

Amounts are positive; debit/credit direction comes from the transaction legs.

Rounding occurs at the economic settlement/posting boundary, not repeatedly in intermediate calculations unless a subsystem contract explicitly requires it.

Share quantities are integer units unless a future approved security class explicitly supports fractions.

### 5.3 Residuals

No unexplained "reconciliation adjustment" may be inserted to make accounts balance.

When an allocation mathematically produces a residual:

- assign it deterministically to a named residual recipient/leg, or
- persist an explicit rounding residual account/field,
- document the rule,
- test conservation.

### 5.4 Accounting tolerances

During the legacy-adapter period:

- current standalone `finance.validate()` compatibility tolerance remains **¥2**;
- new Economic Core transaction legs themselves must reconcile to the **¥0.01 quantum**.

Phase 2 should reduce authoritative-core reconciliation to the monetary quantum wherever the migrated subsystem no longer depends on legacy tolerance.

Tolerance is a validation allowance, not permission to fabricate cash.

### 5.5 Accrual and cash settlement

Recognition and cash settlement are separate events when economically different.

Examples:

- revenue can be earned before collection;
- tax expense can be recognized before tax payment;
- interest can accrue before payment;
- an approved acquisition can be committed before settlement.

The period contract must record which period recognizes the economic event and which period moves cash.

### 5.6 Period values

Each accounting period has:

- opening balances
- period transactions/accruals
- closing balances

Closing balances of period N become opening balances of N+1 after the period is committed.

## 6. Tick / period contract

The target weekly pipeline is:

```text
0. Apply previously committed actions
1. Advance calendar / establish period context
2. Macro state update
3. Industry demand and exogenous supply update
4. Operational capacity availability
5. Market clearing / price and volume allocation
6. Operations settlement
7. Debt interest / principal / taxes
8. Standalone accounting close
9. Standalone invariant gate
10. Standalone derived metrics
11. Group consolidation / intercompany eliminations
12. Consolidated invariant gate
13. Consolidated derived metrics
14. Capital-allocation candidate generation
15. Player / AI decisions
16. Schedule next-period CapEx / financing / corporate actions
17. Valuation
18. Public market repricing
19. Progression / reports / diagnostics
20. Normalize → atomic save snapshot → emit
```

Before a phase exists, its slot is an explicit no-op, not an invitation for another subsystem to mutate in that slot.

### 6.1 One-period lag

Capital allocation, buybacks, M&A, CapEx and financing decisions use the latest completed accounting information and pre-action valuation/market price.

They are decided after close and settle in the later execution phase/period defined by the action contract.

No same-period fixed-point iteration is allowed without a separate approved specification.

### 6.2 Weekly subsystem declaration

Every weekly economic mutator must eventually declare:

- phase
- authoritative writer
- adapter/projection
- idempotency guard
- retirement condition

No module/prototype wrapper may become an implicit second writer.

## 7. Invariant catalog

The following IDs are normative targets for the permanent harness.

| ID | Invariant |
|---|---|
| ECO-001 | all authoritative numeric economic values are finite |
| ECO-002 | standalone Assets = Liabilities + Equity within the approved phase tolerance |
| ECO-003 | internal cash transfer outflow equals inflow plus explicitly modeled fee/tax/loss legs |
| ECO-004 | personal/company/subsidiary/fund/vehicle/bank cash boundaries never alias |
| ECO-005 | one operation/idempotency key settles at most once |
| ECO-006 | failed atomic transaction leaves authoritative economic state unchanged |
| ECO-007 | debt principal roll-forward reconciles borrowing, repayment and write-off/default events |
| ECO-008 | dividend payer reduction equals recipient distributions + withholding/tax legs |
| ECO-009 | buyback cash, treasury/outstanding shares and holder ownership reconcile |
| ECO-010 | issued = treasury + outstanding shares for each share class |
| ECO-011 | no share/economic interest is beneficially owned twice |
| ECO-012 | control rights derive deterministically from the approved ownership/control contract |
| ECO-013 | M&A consideration, fees, debt, seller/buyer cash and target ownership commit atomically |
| ECO-014 | intercompany transactions remain in standalone accounts and eliminate only in consolidated views |
| ECO-015 | same state + command sequence + seed produces identical authoritative final state/hash |
| ECO-016 | UI/render/shadow evaluation does not consume production simulation RNG |
| ECO-017 | projections/derived metrics cannot mutate source-of-truth cash, ownership or debt |
| ECO-018 | transaction/history compaction preserves required accounting and idempotency evidence |

## 8. Control Ladder rights contract

These are **gameplay rights thresholds**, not a general legal-advice statement.

The approved Control Ladder is:

| Threshold | Crossing semantics | Gameplay right |
|---|---|---|
| 1% | ≥1% | minority shareholder action/proposal capability; ownership becomes strategically visible in the control UI |
| 3% | ≥3% | enhanced minority rights: request extraordinary governance action / books-and-records style diligence capability |
| 1/3 | >1/3 | block actions requiring the 2/3 special-resolution tier; takeover path becomes a control-critical action |
| 1/2 | >1/2 | ordinary voting control; ability to control ordinary shareholder resolutions and board-control gameplay |
| 2/3 | ≥2/3 | special-resolution control for merger/reorganization/charter-style actions supported by the game |
| 90% | ≥90% | squeeze-out / wholly-owned conversion capability |

Separate non-control markers:

- **5%**: disclosure/large-holding gameplay signal.
- **20%**: equity-method/accounting marker where applicable.

5% and 20% must never appear as Control Ladder stages.

Economic ownership and voting control are separate. A future control resolver may model dispersed ownership or special voting rights, but it must never silently equate economic percentage with every control right.

## 9. Founder net-worth contract

### 9.1 Listed own-company stake

```text
founderOwnCompanyValue = marketPrice × founderBeneficialShares
```

### 9.2 Private own-company stake

```text
founderOwnCompanyValue = EquityValue × founderEconomicOwnership × 0.70
```

The valuation input is **Equity Value**, not Enterprise Value, so debt is not counted as founder wealth.

### 9.3 Anti-double-counting

- treasury shares are not founder-owned shares;
- own-company shares purchased personally are merged into founder beneficial ownership and are not also valued as a separate generic `personalStocks` line;
- founder original shares and later purchased shares may retain origin metadata, but valuation occurs once per beneficial share;
- a listed/unlisted transition changes valuation basis, not share identity;
- pledged/margin-financed shares remain gross assets; the corresponding personal liability is deducted separately;
- family/trust holdings count only to the extent the founder is the beneficial owner; spouse/family beneficial holdings are not automatically founder assets.

The future ownership registry is the canonical deduplication layer. Until Phase 3 cutover, adapters must prove that legacy representations reconcile to the canonical read model.

## 10. Deployable Capital contract

Deployable Capital is calculated **per legal entity**.

For an operating company:

```text
unrestricted cash
- tax payable due within 13 weeks
- scheduled debt principal/interest due within 13 weeks
- minimum liquidity reserve
- committed but unsettled economic actions due within 13 weeks
- approved CapEx commitments due within 13 weeks
- legally binding fund/capital commitments attributable to that entity within 13 weeks
= Deployable Capital
```

Rules:

- horizon: **13 weeks**, consistent with the current finance forecast/dividend horizon;
- restricted PE/VC fund cash is never company Deployable Capital;
- subsidiary cash is unavailable to the parent until an allowed upstream/intercompany transfer actually settles;
- borrowing capacity is displayed separately and is not cash;
- approved-but-unpaid commitments are deducted once;
- negative result is reported as a funding gap, not clamped into fictional available cash;
- personal Deployable Capital uses only personal cash/liabilities/commitments.

## 11. Retention, save-size and deterministic-hash contracts

### 11.1 Journal retention

The live detailed Economic Transaction journal is bounded.

Initial compatibility budget:

- no unbounded growth;
- detailed live journal target cap: **5,000 entries per authoritative journal**, matching the current finance transaction guard as the migration baseline;
- before older detail is compacted, required accounting aggregates/checkpoints and idempotency evidence must be retained;
- compaction itself must be deterministic and invariant-preserving.

Phase 0.5 may recommend a different measured cap, but changing it requires evidence and an explicit contract update.

### 11.2 Save-size budget

The accepted physical-iPhone Growth fixture is the benchmark reference.

Rules:

- Phase 0.5 records raw/stored bytes for versioned scenarios.
- A later phase must not increase the same benchmark scenario's stored save size by more than **15%** without explicit review.
- **10 MB stored** for the Gate C-style ~week117/~40-store reference is a warning budget, not a silent truncation threshold.
- history growth must be bounded before raising the budget.

### 11.3 Deterministic state hash

The permanent harness hash must:

- use a canonical JSON projection;
- sort object keys;
- sort unordered economic collections by stable ID;
- preserve ordered collections where order is economically meaningful;
- include authoritative economic state, simulation RNG state and IDs/counters;
- exclude DOM/UI state, wall-clock timestamps, diagnostic timing, caches that are re-derived, benchmark-control metadata, and storage-transport metadata such as `saveSequence`;
- version the projection algorithm as `stateHashVersion`.

A hash mismatch is diagnostic evidence; tests must still be able to produce a first semantic diff.

## 12. Versioned headless scenario contract

Every permanent-harness scenario includes at minimum:

```text
harnessSchemaVersion
scenarioId
scenarioVersion
engineCapabilities
scenarioFeatures
seed
size
duration
expectedInvariants
stateHashVersion
sourceMainSha
```

Required scale controls support at least company counts 10/50/100/250/500/1000 and durations 1/10/50/100 years, with smoke/nightly/deep tiers rather than every Cartesian combination in ordinary CI.

## 13. Migration authority rule

For every subsystem:

```text
Legacy writer
→ Adapter/read model
→ Shadow Economic Core
→ Cutover (exactly one writer)
→ Legacy becomes projection
→ Legacy writer retired
```

During Shadow, the new core must not mutate production state or consume production RNG.

During Cutover, there is exactly one authoritative writer for each economic fact. Reconciliation code must never conceal dual writers.

## 14. Approval boundary

Gate D approval of this file means the above semantics are accepted as the implementation contract.

It does **not** mean Phase 1 may start. Gate E, Phase 0.5, Gate F and the Hard Phase 1 entry gate remain mandatory.
