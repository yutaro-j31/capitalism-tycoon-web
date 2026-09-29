# Economic Engine Phase 0 Contracts

**Status: PROPOSED FOR GATE D APPROVAL — second-review remediation applied**  
**Validated repository baseline: `694bc395df968e9e96fa5c3cc162f81acf797f27`**  
**Implementation permission: NO**

This document turns the Phase 0 items in `ECONOMIC_ENGINE_ROADMAP.md` into explicit contracts. It is a specification only. It does not authorize Phase 1 implementation.

## 1. Scope and non-goals

Phase 0 defines the semantics that later phases must share:

- legal/economic entities
- cash pools and ownership boundaries
- economic terminology
- material operation / multi-leg posting shape
- monetary precision and rounding
- accounting/settlement boundaries
- tick order and action-family timing
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

Entity identity is separated from role/status. `listedCompany`, `subsidiary`, and `portfolioCompany` are **not** mutually exclusive entity types.

Required shape:

```text
EconomicEntity {
  entityId
  legalEntityKind
  legalName
  status
  roles[]
  listingStatus?
  jurisdiction?
  metadata
}
```

An entity is not an account, security, debt instrument, property, or relationship. Those objects have their own stable identities and refer back to entities.

### 2.2 Legal entity kinds

| legalEntityKind | Meaning | Cash boundary |
|---|---|---|
| `person` | Founder/player beneficial owner | personal cash/assets |
| `company` | Operating or holding legal company | that company's cash/assets |
| `fund` | PE/VC or other investment fund vehicle | fund cash/assets |
| `propertyVehicle` | Property SPV where legally separate | vehicle cash/assets |
| `bank` | Modeled bank from Phase 16 onward | bank cash/assets |
| `trustOrEstate` | Trust/estate/family vehicle when beneficial ownership requires it | vehicle cash/assets |

### 2.3 Orthogonal roles and statuses

Roles/statuses may overlap:

- `operatingCompany`
- `holdingCompany`
- `subsidiary`
- `listedIssuer`
- `portfolioCompany`
- `peManager`
- `generalPartner`
- `vcManager`
- `jointVenture`
- `associate`
- `propertyOwner`
- `lender`
- `borrower`

A company may therefore be, for example, an operating company + listed issuer + subsidiary + portfolio company at the same time.

Control/ownership relationships are edges, not entity kinds.

### 2.4 Relationship identity

Economic relationships that may affect settlement or control use stable IDs where needed:

```text
EconomicRelationship {
  relationshipId
  relationshipType
  fromEntityId
  toEntityId
  effectivePeriod
  terms
}
```

Examples include parent/subsidiary control, LP commitment, intercompany loan, management agreement, trust beneficial interest, joint venture and security pledge.

### 2.5 Securities, debt instruments and properties are not entities

The Phase 0 identity model reserves stable IDs for:

- `securityId` / `securityClassId`
- `debtInstrumentId`
- `propertyId`
- `accountId`
- `commitmentId`

These objects always identify their legal owner/issuer/obligor through entity IDs.

### 2.6 PE manager / GP boundary

The PE management business is **not** the PE fund.

The target model distinguishes:

- management company / manager role
- GP entity or GP economic account where required
- PE fund vehicle
- LP aggregate or individual LP entities when economically relevant
- co-invest vehicle/counterparty
- portfolio company

During migration, the current player company may remain the manager adapter: management fees belong to company cash, while carried interest follows the current personal-cash contract until a later approved cutover explicitly changes it.

### 2.7 External/system counterparties

Balanced operations must support deterministic aggregate external counterparties:

- `external:customer-market`
- `external:supplier`
- `external:employee`
- `external:government-tax`
- `external:shareholder`
- `external:lender`
- `external:buyer`
- `external:seller`
- `external:lp-coinvestor`
- `external:clearing-settlement`

They do not need individual NPC persistence. IDs must be deterministic and scoped only as deeply as required to prevent double counting and preserve settlement semantics.

### 2.8 Cash-pool rule

The following pools are mutually exclusive sources of truth:

- founder/person cash
- each company cash pool
- each subsidiary cash pool
- each PE/VC fund cash pool
- each portfolio-company cash pool
- each property-vehicle cash pool
- each bank cash pool
- restricted/escrow cash account owned by its legal entity

Restricted/escrow cash remains owned by the same legal entity but is a separate account and is not unrestricted deployable cash.

A transfer between legal entities or between unrestricted/restricted accounts is an explicit posting. Reading another entity's cash as "available" is not a transfer.

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

## 4. Material operation and posting contract

### 4.1 Operation is the atomic unit

A material economic action is represented by one `EconomicOperation` containing one or more validated postings.

```text
EconomicOperation {
  operationId
  idempotencyKey
  operationType
  decisionPeriod?
  recognitionPeriod?
  duePeriod?
  settlementPeriod?
  effectivePeriod?
  reversalOfOperationId?
  correctionOfOperationId?
  status
  schemaVersion
  postings[]
  metadata
}
```

The operation, not an individual posting, is the atomic/idempotent settlement unit.

A committed operation is immutable. Corrections are new operations linked through `reversalOfOperationId` / `correctionOfOperationId`.

### 4.2 Posting/leg shape

```text
EconomicPosting {
  postingId
  operationId
  postingSequence
  entityId
  accountId
  side                  // debit | credit for monetary/accounting legs
  amount?
  currency?
  debtInstrumentId?
  instrumentId?
  securityClassId?
  propertyId?
  assetId?
  quantityDelta?        // signed position change; + increase, - decrease
  counterpartyEntityId?
  counterpartyRole?
  relationshipId?
  eliminationKey?
  metadata
}
```

Rules:

- `side` is exactly `debit` or `credit` for monetary/accounting postings;
- monetary `amount` is non-negative; debit/credit supplies accounting direction;
- `quantityDelta` is signed and supplies direction for security/unit/position changes;
- an indivisible property may use a deterministic ownership unit such as +1/-1, but the operation must also identify `propertyId`;
- debt principal changes identify `debtInstrumentId`; security changes identify `securityClassId`; property changes identify `propertyId`;
- position/quantity changes are first-class fields and must not be hidden in free-form metadata;
- `postingSequence` is deterministic and stable under replay;
- IDs must be deterministic for replayable commands;
- metadata is JSON-serializable and contains no runtime object references;
- one material economic operation settles exactly once;
- a posting cannot independently commit outside its parent operation.

### 4.3 Balance and conservation rules

For each committed operation:

- for every currency, total monetary debits equal total monetary credits after explicit FX/fee/tax/rounding-residual legs;
- external counterparties are represented by explicit postings rather than by unbalanced internal cash mutation;
- security-class quantity changes reconcile issuer issuance/cancellation, treasury movement, holder movement and any approved external aggregate holder;
- debt-principal movement reconciles borrower liability and lender/internal-or-external counterparty position where modeled;
- property/asset ownership transfer reconciles the former owner/external seller and new owner;
- fund capital-account movements reconcile investor/LP/GP/coinvest interests and fund-side capital accounts;
- any approved residual is deterministic and uses the residual rules in §5.

An operation family may impose stronger invariants but may not weaken these rules.

### 4.4 No hidden authoritative mutation after cutover

For an Economic Core slice/family that has completed cutover:

> Every authoritative cash, account, debt-instrument, security quantity/ownership, property/asset ownership and fund-capital mutation caused by the operation must be derivable from the validated operation and its postings.

The settlement reducer applies validated postings to authoritative state. It must not perform an additional unposted authoritative mutation.

Allowed non-posting updates are limited to deterministic projections, caches, diagnostics or other explicitly non-authoritative derived state.

Before cutover, legacy writers may continue their existing direct mutations behind read-only adapters. This exception ends for that slice when the Economic Core becomes its authoritative writer.

### 4.5 Account and instrument taxonomy

Before Phase 1 cutover, define a versioned account taxonomy sufficient to distinguish at least:

- cash / restricted cash / escrow
- receivable / payable / accrued expense / tax payable
- inventory / fixed assets / intangible assets / goodwill
- debt principal / accrued interest
- share capital / additional paid-in capital / retained earnings / treasury stock
- revenue / operating expense / interest / tax / dividend/distribution
- fund capital accounts / return of capital / preferred return / carry where applicable
- consolidation/elimination-only accounts or tags

Debt, security and property identities are separate from the account taxonomy. A posting that changes one of those positions references the applicable stable ID.

### 4.6 Minimum required operation-family schemas

Before any family becomes executable through the Economic Core, its schema must include at least the following semantic movements.

| Family | Minimum required movements |
|---|---|
| Operating receipt/payment | payer/recipient cash, revenue/expense or receivable/payable settlement as applicable |
| Debt borrowing | borrower cash increase, borrower debt-principal increase, lender/external-lender corresponding position; fees separately posted |
| Interest accrual/payment | interest expense/income, accrued interest payable/receivable, later cash settlement |
| Principal repayment | borrower debt-principal decrease + cash decrease; lender/internal-or-external position + cash increase as applicable |
| Equity issuance | issuer cash/consideration, share-capital/APIC effect, issued quantity increase, holder quantity increase |
| Dividend | declaration/payable where modeled, retained-earnings/equity effect, holder entitlement snapshot, cash payment, withholding/tax, residual |
| Buyback | issuer cash decrease, selling-holder/external-holder quantity decrease, treasury quantity increase; issued quantity unchanged unless a separate cancellation operation follows |
| Share cancellation | treasury quantity decrease and issued quantity decrease with required equity/accounting effect |
| Asset/property purchase/sale | buyer/seller or external cash/consideration, asset/property ownership transfer, book-value/gain-loss/fee effects where applicable |
| Intercompany transfer | both legal entities' cash/accounts plus legal characterization: loan, equity, dividend or service fee; elimination key where applicable |
| M&A | consideration and fees, buyer/seller settlement, ownership/control transfer, target debt treatment, acquired net assets/investment basis and goodwill/bargain-gain treatment required by the approved deal type |
| Fund contribution/capital call | investor/LP/GP/coinvest cash decrease, fund cash increase, matching fund capital-account/interests |
| Fund distribution | fund cash decrease, investor/LP/GP/coinvest cash increase, explicit classification among return of capital/preferred return/profit/carry/tax |
| External investment purchase/sale | purchaser/seller cash, security/instrument/property position movement and realized gain/loss/fee legs where applicable |

These are minimum semantic schemas, not a requirement to implement every family in Phase 1. A later phase can extend its family schema before cutover.

### 4.7 Atomicity

A material operation follows:

```text
construct complete operation
→ validate required family schema / postings / instruments
→ verify balances and constraints
→ verify idempotency
→ validate monetary and position conservation
→ apply postings through the authoritative settlement reducer
→ run required invariant gate
→ commit operation
→ update projections
→ durable save/public emit
```

Failure before commit leaves all authoritative economic state unchanged.

No public emit or durable save may expose a partially settled operation.

The current production `runTransaction()` mechanism is a useful rollback precedent, but Phase 1 Economic Operations are a separate semantic contract and must not be treated as implemented merely because `runTransaction()` exists.

### 4.8 Corrections and reversals

A committed operation is never silently edited in history.

Where correction is required, create a deterministic correcting/reversing operation using the explicit operation linkage fields, then post the corrected operation according to its family contract.

### 4.9 External flows

Money or positions entering/leaving the modeled ownership graph must have an explicit external counterparty and operation family. "Create cash", "delete cash" or silently create/delete a security/property position without an approved external-flow posting is invalid.

## 5. Monetary, rounding and close contract

### 5.1 Numeric domains during saveVersion 9 migration

The current saveVersion 9 representation remains JavaScript `Number`.

Different numeric domains must not be conflated:

- **monetary amounts settled/posting to accounts**: JPY, quantized to ¥0.01 at new Economic Core posting boundaries;
- **share/security quantities**: integer units unless an approved security class explicitly allows fractions;
- **rates/ratios/ownership/voting fractions/FX/internal weights**: finite values using separately defined precision;
- **per-share/internal valuation prices**: precision defined by the relevant security/valuation contract, not automatically rounded to ¥0.01 at every intermediate step.

Existing saveVersion 9 states may contain fractional-yen values. Phase 1 must not silently rewrite existing saves solely to change representation.

### 5.2 Safe monetary envelope

For the temporary Number + ¥0.01 model, cent-quantized amounts must remain inside an approved exact-quantum envelope.

At minimum:

```text
abs(amount * 100) <= Number.MAX_SAFE_INTEGER
```

must hold for authoritative monetary postings that rely on cent-exact integerization.

Phase 0.5 must test reachable values across long-run and large-scale scenarios. If the approved scenario envelope can exceed cent-exact Number range, a dedicated representation decision/migration is required before that scale becomes authoritative.

This is not permission to change `saveVersion=9` automatically.

### 5.3 Rounding

For an in-envelope positive monetary settlement amount:

```text
roundMoney(x) = Math.round(x * 100) / 100
```

Rounding occurs at the defined recognition/settlement/posting boundary, not repeatedly in intermediate formulas.

Family-specific rules must state whether rounding occurs per unit/per holder or on an aggregate before allocation.

### 5.4 Residual allocation

No unexplained "reconciliation adjustment" may be inserted merely to force balance.

When exact allocation creates a residual:

- use a documented deterministic allocation rule;
- use stable entity/security IDs as tie-breakers;
- post the residual to a named recipient/account where economically appropriate;
- test conservation.

Specific future contracts must cover, where applicable, dividend residuals, tax withholding residuals, FX translation reserves, fund waterfall residuals and integer share-allocation residuals.

### 5.5 Current legacy validation tolerances

The current production `finance.validate()` uses multiple compatibility tolerances. Gate D must not summarize all legacy validation as “¥2”.

| Legacy check | Current compatibility tolerance |
|---|---:|
| Balance-sheet difference | ¥2 |
| BS cash vs `companyCash` | ¥0.1 |
| Cash-flow identity | ¥10 |
| Period CF ending cash vs `companyCash` | ¥0.5 |
| Weekly snapshot cash difference | ¥10 |
| Weekly opening/previous ending roll-forward | ¥10 |
| Archived finance opening-cash roll-forward | ¥10 |
| Loan total vs `companyDebt` | ¥0.1 |
| Retained-earnings roll-forward | ¥0.1 |
| Negative balance guard | values below -¥0.1 fail |

These are **legacy adapter tolerances**, not Economic Core posting tolerances.

New Economic Core monetary operations must reconcile to the ¥0.01 posting quantum inside the approved Number envelope. Phase 2 must define separate close/projection/consolidation tolerances rather than inheriting the largest legacy tolerance.

Tolerance is a validation allowance, never permission to fabricate cash.

### 5.6 Recognition, commitment, due date and cash settlement

These are separate concepts:

- `decisionPeriod`: when the decision is made;
- `recognitionPeriod`: when the accounting event is recognized;
- `duePeriod`: when the obligation becomes due;
- `settlementPeriod`: when cash/instrument settlement occurs;
- `effectivePeriod`: when a legal/operational state change becomes effective, if distinct.

Examples:

- revenue may be recognized before collection;
- tax expense may be recognized before tax payment;
- interest may accrue before payment;
- an approved acquisition may create a commitment before legal close/cash settlement.

### 5.7 Period values

Each accounting period has:

- opening balances;
- recognized transactions/accruals;
- due/settled operations;
- closing balances.

Closing balances of period N become opening balances of N+1 after the period is committed.

## 6. Tick / period contract

The target weekly pipeline is:

```text
0. Establish period/calendar context and opening snapshot
1. Apply previously committed actions due in this period
2. Macro state update
3. Industry demand and exogenous supply update
4. Operational capacity availability
5. Market clearing / price and volume allocation
6. Operations settlement
7. Debt interest / principal / taxes: accrual and due settlement
8. Standalone accounting close
9. Standalone invariant gate
10. Standalone derived metrics
11. Group consolidation / intercompany eliminations
12. Consolidated invariant gate
13. Consolidated derived metrics
14. Base/pure valuation snapshot used by decisions
15. Capital-allocation candidate generation and scoring
16. Player / AI decisions
17. Create commitments / schedule future CapEx, financing and corporate actions
18. Post-decision reporting valuation signals and public market repricing
19. Progression / reports / diagnostics
20. Normalize → atomic save snapshot → emit
```

Before a phase exists, its slot is an explicit no-op, not an invitation for another subsystem to mutate in that slot.

The base valuation at step 14 is a pure/read-only decision input. Step 18 may update public market prices/signals after decisions, but may not feed those same-period outputs back into step 15/16.

### 6.1 Action-family timing

There is no universal assumption that every current user action immediately becomes next-period settlement.

For each action family, the migration contract must declare:

| Field | Meaning |
|---|---|
| decision timing | when user/AI can choose |
| commitment timing | when an enforceable commitment is created |
| recognition timing | accounting period |
| settlement timing | when cash/instruments move |
| effective timing | when ownership/capacity/control changes |
| cancellation/expiry | whether/how a commitment may be cancelled |
| legacy behavior | immediate/deferred production behavior before cutover |

The target Economic Engine default for strategic capital-allocation decisions is to use the latest completed accounting information and pre-action/base valuation, then settle according to the action-family contract. Existing immediate production actions remain legacy-authoritative until their explicit cutover.

No same-period fixed-point iteration is allowed without a separate approved specification.

### 6.2 Weekly subsystem declaration

Every weekly economic mutator must eventually declare:

- execution phase;
- authoritative writer;
- adapter/projection;
- idempotency guard;
- input valuation snapshot/version if applicable;
- retirement condition.

No module/prototype wrapper may become an implicit second writer.

### 6.3 Phase-registry characterization

Before changing wrapper order, Phase 0.5 must snapshot the current production order and writer inventory so migration can prove intentional changes rather than accidentally changing load-order semantics.

## 7. Invariant catalog

The following IDs are normative targets for the permanent harness.

| ID | Invariant |
|---|---|
| ECO-001 | all authoritative numeric economic values are finite |
| ECO-002 | standalone Assets = Liabilities + Equity within the approved phase-specific tolerance |
| ECO-003 | internal cash transfer outflow equals inflow plus explicitly modeled fee/tax/loss legs |
| ECO-004 | personal/company/subsidiary/fund/vehicle/bank cash boundaries never alias |
| ECO-005 | one operation/idempotency key settles at most once within its valid replay lifetime |
| ECO-006 | failed atomic operation leaves authoritative economic state unchanged |
| ECO-007 | debt principal roll-forward reconciles borrowing, repayment and write-off/default events |
| ECO-008 | dividend payer reduction equals recipient distributions + withholding/tax/residual legs |
| ECO-009 | buyback cash, treasury/outstanding shares and holder ownership reconcile |
| ECO-010 | issued = treasury + outstanding shares for each share class |
| ECO-011 | no share/economic interest is beneficially owned twice |
| ECO-012 | control rights derive deterministically from the approved ownership/control contract |
| ECO-013 | M&A consideration, fees, debt, seller/buyer cash, acquired net assets, goodwill and target ownership commit atomically |
| ECO-014 | intercompany transactions remain in standalone accounts and eliminate only in consolidated views |
| ECO-015 | same state + command sequence + seed produces identical authoritative final state/hash |
| ECO-016 | UI/render/report/preview/shadow evaluation does not consume production simulation RNG |
| ECO-017 | projections/derived metrics cannot mutate source-of-truth cash, ownership or debt |
| ECO-018 | transaction/history compaction preserves required accounting, replay and idempotency evidence |
| ECO-019 | cent-quantized authoritative monetary postings remain inside the approved exact-quantum Number envelope until another representation is approved |
| ECO-020 | every committed multi-leg operation satisfies its family-specific balance/conservation schema |
| ECO-021 | authoritative security/debt/property IDs and next-ID counters remain unique and deterministic |
| ECO-022 | base valuation used for a decision is immutable for that decision and cannot be rewritten by same-period post-decision repricing |
| ECO-023 | after a slice/family cutover, every authoritative mutation caused by an operation is derivable from its validated postings; hidden direct mutation is forbidden |

## 8. Control Ladder rights contract

These are **gameplay rights thresholds**, not a general legal-advice statement.

The approved Control Ladder is:

| Threshold | Crossing semantics | Gameplay right |
|---|---|---|
| 1% | ≥1% | minority-shareholder capability tier; exact command entitlement defined before Phase 3 |
| 3% | ≥3% | enhanced minority-rights tier; exact command entitlement defined before Phase 3 |
| 1/3 | >1/3 | block actions requiring the 2/3 special-resolution tier; takeover path becomes control-critical |
| 1/2 | >1/2 | ordinary voting control tier |
| 2/3 | ≥2/3 | special-resolution control tier |
| 90% | ≥90% | squeeze-out / wholly-owned conversion capability |

Separate non-control markers:

- **5%**: disclosure/large-holding gameplay signal.
- **20%**: equity-method/accounting marker where applicable.

5% and 20% must never appear as Control Ladder stages.

Economic ownership, voting ownership and control are separate. Before Phase 3, the security/control contract must define for every right:

- denominator: voting rights vs economic interest;
- treatment of treasury/non-voting shares;
- share-class/special-vote treatment;
- joint/acting-in-concert holdings where modeled;
- already-controlled subsidiary behavior;
- exact command precondition and UI entitlement.

The thresholds themselves are fixed owner decisions. Phase 0 fixes the threshold framework and requires the denominator/share-class/control semantics above; the exact command-level rights matrix is a **Phase 3 entry contract** and must be approved before any Phase 3 ownership/control capability becomes executable.

## 9. Founder net-worth and security identity contract

### 9.1 Minimum security identity

The ownership model must support at least:

```text
SecurityClass {
  securityClassId
  issuerEntityId
  classType
  issuedQuantity
  treasuryQuantity
  votingRightsPerUnit
  economicRightsPerUnit
}

SecurityHolding {
  holdingId
  securityClassId
  registeredHolderEntityId
  beneficialOwnerEntityId
  beneficialFraction
  quantity
  sourceLot?
  pledgeId?
}
```

Indirect ownership is represented through entity/ownership edges rather than duplicating the same underlying share into multiple personal-asset rows.

### 9.2 Listed own-company stake

```text
founderOwnCompanyValue = marketPrice × founderBeneficialShares
```

### 9.3 Private own-company stake

```text
founderOwnCompanyValue = EquityValue × founderEconomicOwnership × 0.70
```

The valuation input is **Equity Value**, not Enterprise Value, so debt is not counted as founder wealth.

### 9.4 Anti-double-counting and transitions

- treasury shares are not founder-owned shares;
- issued quantity must reconcile to treasury + uniquely allocated outstanding/external quantity;
- own-company shares purchased personally are merged into founder beneficial ownership and are not also valued as a separate generic `personalStocks` line;
- founder original shares and later purchased shares may retain source-lot metadata, but valuation occurs once per beneficial share;
- IPO/private-public transition preserves security/beneficial ownership identity; only valuation basis and legal/public status change;
- founder sale at IPO and new issuance are distinct operations;
- pledged/margin-financed shares remain gross assets; the linked personal liability is deducted separately through `pledgeId`/liability linkage;
- family/trust holdings count only to the founder's documented beneficial fraction; spouse/family beneficial holdings are not automatically founder assets;
- multiple share classes use class-specific voting/economic rights.

The future ownership registry is the canonical deduplication layer. Until Phase 3 cutover, adapters must prove that legacy `founderShares`, personal holdings and other ownership representations reconcile to one canonical read model.

## 10. Deployable Capital contract

Deployable Capital is calculated **per legal entity** and is a liquidity decision metric, not an accounting asset.

### 10.1 Base 13-week view

For an operating company:

```text
unrestricted cash
- tax payable contractually due within 13 weeks
- scheduled debt principal/interest due within 13 weeks
- minimum liquidity reserve
- committed but unsettled economic actions due within 13 weeks
- approved CapEx commitments due within 13 weeks
- legally binding fund/capital commitments attributable to that entity within 13 weeks
= Base Deployable Capital
```

The 13-week horizon is retained as the compatibility/base liquidity view because current finance forecasting uses that horizon.

### 10.2 Extended and stress views

Phase 0.5 must also characterize at least:

- 52-week/maturity-wall obligations;
- callable/on-demand debt;
- covenant-triggered acceleration/cure needs;
- committed M&A/property/fund closings by contractual due date;
- seasonal or stress minimum liquidity.

The player/AI may therefore see a base deployable value plus extended/stress warnings rather than one supposedly complete 13-week number.

Rules:

- restricted PE/VC/escrow cash is never company unrestricted Deployable Capital;
- subsidiary cash is unavailable to the parent until an allowed upstream/intercompany transfer actually settles;
- borrowing capacity is displayed separately and is not cash;
- approved-but-unpaid commitments are deducted once according to due date;
- negative result is reported as a funding gap, not clamped into fictional available cash;
- personal Deployable Capital uses only personal cash/liabilities/commitments.

## 11. Retention, save-size and deterministic-hash contracts

### 11.1 Journal/idempotency retention — provisional until Phase 0.5

The Economic Operation journal must be bounded, but **5,000 is not yet an approved Economic Core normative cap**.

Current production evidence:

- `finance.js` begins compaction above 5,000 legacy finance rows;
- that compaction preserves financial aggregates;
- it does not prove the correct retention period for future operation-level idempotency/replay evidence.

Phase 0.5 must measure operations and postings separately and propose:

- live operation cap;
- live posting cap;
- retention by period/command lifetime;
- deterministic compact checkpoint/watermark;
- how idempotency/replay evidence survives detail compaction;
- any probabilistic structure only if its false-positive behavior is explicitly acceptable.

No unbounded idempotency-key set is allowed merely to avoid designing compaction.

### 11.2 Save-size/performance targets — provisional measurement targets

The accepted physical-iPhone Gate C fixtures are reference measurements, not universal Economic Engine limits.

Until Phase 0.5 calibrates scenario tiers:

- **+15% stored-save growth** for the same benchmark scenario is a provisional review trigger, not an approved ceiling;
- **10 MB stored** for the Gate C-style ~week117/~40-store reference is a provisional warning marker, not a device-safe guarantee or truncation threshold.

Phase 0.5 records separately:

- canonical/raw serialized bytes;
- durable stored bytes;
- localStorage mirror/fallback behavior;
- JS string/structured-clone peak-memory proxy where measurable;
- serialization/compaction/write/flush/load runtime;
- scenario scale and history age.

Final budgets must be scenario-tier-specific and evidence-based.

### 11.3 Deterministic semantic state hash

The permanent harness hash uses a **versioned authoritative allowlist/section registry**, not only an exclusion denylist.

It must:

- use canonical serialization;
- sort object keys;
- sort unordered economic collections by stable ID;
- preserve ordered collections where order is economically meaningful;
- include authoritative economic state, pending/committed actions, simulation RNG state/call position, economically relevant market state, debt/tax accruals, compaction checkpoints, IDs and next-ID counters;
- explicitly declare every included authoritative section for each `stateHashVersion`;
- exclude DOM/UI state, wall-clock timestamps, diagnostic timing, benchmark-control metadata, re-derived caches and storage-transport metadata such as `saveSequence`;
- forbid future game logic from depending on excluded wall-clock/storage metadata unless the hash contract is intentionally revised.

A hash mismatch is diagnostic evidence; tests must also produce a first semantic diff.

Required #799 parity cases include:

- payloads differing only in `saveSequence` hash to the same economic state;
- IndexedDB-newer and localStorage-newer boot paths converge to the same semantic hash when economic content is equal;
- reconciliation write-back consumes no simulation RNG and changes no economic IDs/state;
- legacy fallback metadata does not survive as authoritative economic state.

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

Before Phase 1 acceptance, the permanent harness must additionally support:

- current production weekly wrapper/phase-order characterization;
- authoritative-writer inventory;
- versioned semantic state projection registry;
- semantic first-diff reporting;
- save/reload deterministic fork;
- compacted-save/reload deterministic fork;
- operation replay/idempotency tests;
- deterministic failure/rollback mutation tests;
- deterministic ID-allocation collision tests;
- legacy adapter parity for cash, debt, ownership and standalone finance projections;
- capability-aware explicit no-op phases;
- Number monetary-envelope reachability probes;
- raw/stored/peak-memory/runtime save metrics by scenario tier.

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
