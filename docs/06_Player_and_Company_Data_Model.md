# 06 Player and Company Data Model

## 1. Purpose

This document defines the authoritative domain boundaries between the player, companies, operating assets, personal assets, ownership interests, and simulation entities.

The central rule is strict separation between company property and personal property.

A company bank account is not the player's wallet. A player may receive value from a company only through a recorded legal transfer such as salary, dividend, loan repayment, asset sale, or liquidation distribution.

## 2. Aggregate Roots

The minimum persistent aggregate roots are:

```ts
interface GameState {
  metadata: SaveMetadata
  clock: SimulationClock
  rng: RandomState
  player: PlayerState
  companies: Record<CompanyId, CompanyState>
  markets: MarketState
  economy: EconomyState
  scheduledEvents: ScheduledEvent[]
  history: HistoryState
  achievements: AchievementState
}
```

The `GameState` is the serialized save boundary. Individual systems may operate on narrower views but must not create hidden state outside this boundary.

## 3. Stable Identifiers

Persistent entities require stable IDs.

Recommended format:

```text
player_...
company_...
store_...
employee_...
security_...
property_...
loan_...
transaction_...
event_...
```

Requirements:

- IDs never depend on array indexes.
- IDs survive sorting, filtering, save/load, and migration.
- Deleting an entity does not permit immediate ID reuse.
- Random ID generation must be deterministic or isolated from simulation outcomes.

## 4. Player State

```ts
interface PlayerState {
  id: PlayerId
  identity: PlayerIdentity
  personalFinance: PersonalFinanceState
  holdings: PlayerHoldings
  career: PlayerCareerState
  progression: PlayerProgressionState
  preferences: PlayerPreferences
}
```

### 4.1 Player Identity

```ts
interface PlayerIdentity {
  displayName: string
  age: number
  birthWeek?: number
  reputation: number
  legacyScore: number
}
```

Identity data must not be used as an implicit financial account.

### 4.2 Personal Finance

```ts
interface PersonalFinanceState {
  cash: Money
  receivables: PersonalReceivable[]
  liabilities: PersonalLiability[]
  ledgerAccountId: AccountId
  taxState: PersonalTaxState
}
```

The player may not spend company cash on personal investments unless a transfer is first posted.

### 4.3 Player Holdings

```ts
interface PlayerHoldings {
  companyShares: Shareholding[]
  publicSecurities: SecurityPosition[]
  ventureInvestments: VenturePosition[]
  realEstate: PropertyId[]
  otherAssets: PersonalAsset[]
}
```

Ownership must be represented as an asset or position, not inferred from company control flags.

## 5. Company State

```ts
interface CompanyState {
  id: CompanyId
  identity: CompanyIdentity
  governance: GovernanceState
  ownership: CapitalizationTable
  finance: CompanyFinanceState
  operations: CompanyOperationsState
  organization: OrganizationState
  strategy: CompanyStrategyState
  progression: CompanyProgressionState
  status: CompanyStatus
}
```

### 5.1 Company Identity

```ts
interface CompanyIdentity {
  legalName: string
  brandName: string
  foundedWeek: number
  headquartersRegionId: string
  industryIds: string[]
}
```

### 5.2 Company Status

```ts
type CompanyStatus =
  | 'active'
  | 'distressed'
  | 'insolvent'
  | 'bankrupt'
  | 'acquired'
  | 'liquidated'
  | 'inactive'
```

Status transitions require explicit events. UI code must not independently infer and persist a contradictory status.

## 6. Ownership and Control

```ts
interface CapitalizationTable {
  shareClasses: ShareClass[]
  shareholders: ShareholderPosition[]
  treasuryShares: number
  authorizedShares?: number
}
```

### 6.1 Ownership Invariants

- Issued shares equal shareholder shares plus treasury shares.
- No shareholder position is negative.
- Ownership percentage is derived from share count, not stored as the sole source of truth.
- Voting control and economic ownership may differ by share class.
- Dilution must modify share counts and be recorded as a financing event.

### 6.2 Player Control

A player may control a company through:

- Majority voting rights.
- Board control.
- Contractual control.
- Founder-control share class.

Control does not transfer company assets into personal ownership.

## 7. Company Finance

```ts
interface CompanyFinanceState {
  accounts: ChartOfAccounts
  ledger: LedgerState
  cashAccounts: CashAccount[]
  debt: DebtInstrument[]
  equity: EquityState
  taxes: CompanyTaxState
  statements: FinancialStatementHistory
  policies: FinancePolicyState
}
```

Company cash displayed in the UI must reconcile to company cash-account balances.

## 8. Operations

```ts
interface CompanyOperationsState {
  stores: Record<StoreId, StoreState>
  products: Record<ProductId, ProductState>
  facilities: Record<FacilityId, FacilityState>
  supplyContracts: SupplyContract[]
  regions: RegionPresence[]
}
```

Operating entities belong to the company identified by their `companyId`. Ownership must not be inferred from nesting alone when entities can be transferred through M&A.

## 9. Store State

```ts
interface StoreState {
  id: StoreId
  companyId: CompanyId
  name: string
  regionId: string
  openedWeek: number
  status: 'planned' | 'opening' | 'active' | 'paused' | 'closed'
  capacity: number
  condition: number
  reputation: number
  staffingPlan: StaffingPlan
  pricingPolicy: PricingPolicy
  marketingPolicy: MarketingPolicy
  weeklyHistory: StoreWeeklyRecord[]
}
```

Store history may be compacted, but financial facts must remain recoverable through the ledger and reporting archive.

## 10. Organization and People

```ts
interface OrganizationState {
  employees: Record<EmployeeId, EmployeeState>
  departments: DepartmentState[]
  executiveTeam: ExecutiveAssignment[]
  board: BoardState
  successionPlans: SuccessionPlan[]
}
```

Employees and executives are entities with stable identity, age, tenure, capability, compensation, and status.

Retirement, resignation, dismissal, death if ever modeled, and succession must be explicit transitions.

## 11. Transfers Between Player and Company

Allowed transfer categories include:

### Company to Player

- Salary.
- Bonus.
- Dividend.
- Loan repayment.
- Reimbursement of valid company expense.
- Purchase of an asset from the player at a supported value.
- Liquidation distribution.

### Player to Company

- Equity contribution.
- Share subscription.
- Shareholder loan.
- Asset sale to company.
- Debt forgiveness.

Every transfer requires:

- Source account.
- Destination account.
- Amount.
- Date/week.
- Legal/economic category.
- Counterparty IDs.
- Journal references.

A direct assignment such as `player.cash += company.cash` is prohibited.

## 12. Personal Net Worth

Personal net worth is derived as:

```text
personal cash
+ market value of public securities
+ estimated value of private-company shares
+ venture positions
+ real-estate equity
+ other personal assets
- personal liabilities
```

Company gross assets must not be added directly. Only the value of the player's equity or debt claim is included.

Private-company valuation must identify its methodology and valuation week.

## 13. Company Enterprise and Equity Value

Where required:

```text
Enterprise Value = Equity Value + Interest-Bearing Debt - Excess Cash
```

The game must distinguish:

- Book equity.
- Market equity value.
- Enterprise value.
- Liquidation value.
- Transaction value.

These are not interchangeable.

## 14. M&A Transfer Rules

An acquisition must specify whether it is:

- Share purchase.
- Asset purchase.
- Merger.
- Tender offer.
- Management buyout.

A share purchase changes ownership of the target company. An asset purchase transfers selected assets and liabilities between company aggregates. The data model must preserve this distinction.

## 15. Bankruptcy and Liquidation

Bankruptcy does not automatically erase all entities.

Recommended sequence:

1. Mark insolvency condition.
2. Freeze prohibited discretionary transactions.
3. Determine restructuring, rescue finance, sale, or liquidation.
4. Resolve creditor priority.
5. Transfer or dispose of assets.
6. Determine shareholder recovery.
7. Preserve historical company record.

A bankrupt company may remain in historical rankings but must not continue normal operations.

## 16. History and Archival Data

History is divided into:

- Operational rolling history.
- Financial-statement history.
- Immutable major-event history.
- Achievement and legacy history.
- Hall-of-fame records.

Long-duration saves may compact detailed weekly records while preserving quarter/year aggregates and major events.

## 17. Serialization Rules

- Use explicit field names.
- Avoid serializing functions, class prototypes, DOM objects, or browser handles.
- Optional fields require documented defaults.
- Maps and sets require stable JSON representation.
- Monetary values must use the project's canonical `Money` representation.
- Entity references serialize as IDs, not duplicated object graphs.

## 18. Invariants

After every committed week:

- Every entity reference resolves or is explicitly tombstoned.
- Company assets point to exactly one current owner.
- Personal and company cash ledgers are separate.
- Share counts reconcile.
- No ownership position is negative.
- Acquired or closed entities retain historical identity.
- Player net worth can be recalculated from positions.
- No duplicate IDs exist.

## 19. Test Requirements

Minimum tests:

1. Salary transfer posts to both ledgers.
2. Dividend is limited by policy and available distributable resources.
3. Player investment cannot spend company cash.
4. Capital contribution increases company resources and player investment basis.
5. Dilution changes percentages from share counts.
6. Share acquisition changes control without transferring target assets to the player.
7. Asset acquisition transfers only specified assets and liabilities.
8. Bankruptcy preserves historical records.
9. Save/load preserves references and IDs.
10. Net-worth calculation excludes gross company assets.

## 20. Change Control

Any pull request that changes ownership, cash-transfer, entity-identity, bankruptcy, or serialization rules must update this document and include migration analysis.
