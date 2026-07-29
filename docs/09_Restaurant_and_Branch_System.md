# 09 Restaurant and Branch System

## 1. Purpose

The restaurant system is the first operating business available to the player and the reference implementation for all future operating businesses. It must remain understandable on iPhone while supporting deep simulation, long-term expansion, accounting integrity, and deterministic testing.

## 2. Scope

This specification covers:

- Store creation, acquisition, closure, sale, and relocation
- Location characteristics
- Capacity and operating hours
- Menu composition
- Pricing, quality, service, advertising, and cleanliness
- Weekly demand and sales calculation
- Inventory and waste
- Fixed and variable costs
- Store-level profit and cash flow
- Multi-store management
- Franchise and directly operated stores
- Bankruptcy and forced closure behavior

## 3. Store Identity

Every store must have an immutable stable identifier.

```ts
interface StoreId {
  value: string;
}
```

The identifier must never be reused after closure or sale. Historical statements, achievements, event logs, and save migrations must continue to reference the original identifier.

## 4. Store Lifecycle

A store can be in one of the following states:

```ts
type StoreStatus =
  | 'planning'
  | 'construction'
  | 'open'
  | 'temporarily_closed'
  | 'closing'
  | 'closed'
  | 'sold';
```

State transitions must be explicit and recorded in the event log.

### 4.1 Opening

Opening a store requires:

- Valid location
- Sufficient company cash or committed financing
- Construction and equipment budget
- Initial staffing plan
- At least one active menu item
- Opening date on a future week boundary

The game must not permit an opening action that would create invalid negative cash unless an approved credit facility covers the deficit.

### 4.2 Closure

Closing a store must account for:

- Severance
- Lease cancellation penalties
- Inventory disposal or transfer
- Equipment impairment or sale
- Remaining debt obligations
- Temporary reputation impact

## 5. Location Model

Each location is represented by a stable market cell or district.

```ts
interface LocationProfile {
  id: string;
  regionId: string;
  districtType: 'residential' | 'office' | 'station' | 'suburban' | 'tourism' | 'industrial';
  baseFootTraffic: number;
  lunchDemand: number;
  dinnerDemand: number;
  weekendDemand: number;
  priceSensitivity: number;
  qualitySensitivity: number;
  competitionIntensity: number;
  rentIndex: number;
  laborIndex: number;
  deliveryDemand: number;
}
```

All numeric fields must be normalized or documented with explicit units.

## 6. Capacity

Weekly theoretical capacity is calculated from seats, table turnover, operating sessions, delivery throughput, and closure days.

```text
seatCapacity = seats × turnsPerSession × openSessions × openDays
physicalCapacity = seatCapacity + deliveryCapacity
effectiveCapacity = floor(physicalCapacity × equipmentUptime × staffingCoverage)
```

Demand may exceed capacity. Lost sales must be recorded separately from realized sales.

## 7. Demand Calculation

The demand system must be deterministic given identical save state, seed, and player actions.

```text
baseDemand
× locationFactor
× economicFactor
× seasonFactor
× awarenessFactor
× reputationFactor
× priceFactor
× qualityFactor
× serviceFactor
× cleanlinessFactor
× competitionFactor
× eventFactor
= unconstrainedDemand
```

Realized customers are:

```text
realizedCustomers = min(unconstrainedDemand, effectiveCapacity)
```

The implementation must preserve the intermediate factors for diagnostics and balance testing.

### 7.1 Price Factor

Price response must be bounded and must not permit negative demand.

```text
relativePrice = averageSellingPrice / localReferencePrice
priceFactor = clamp(1 - priceElasticity × (relativePrice - 1), minimumPriceFactor, maximumPriceFactor)
```

### 7.2 Reputation Factor

Reputation should move slowly and represent accumulated customer experience rather than a single-week result.

```text
newReputation = oldReputation × persistence + weeklyExperienceScore × (1 - persistence)
```

## 8. Revenue

Store revenue is the sum of dine-in, delivery, takeout, and other operating revenue.

```text
netSales = grossSales - discounts - refunds - salesTaxesCollected
```

Taxes collected on behalf of authorities must not be recorded as company revenue.

## 9. Cost Structure

### 9.1 Variable Costs

- Ingredients
- Packaging
- Delivery commissions
- Payment processing fees
- Utilities linked to volume
- Waste and spoilage

### 9.2 Fixed Costs

- Rent
- Base payroll
- Equipment leases
- Insurance
- Local advertising contracts
- Store administration

### 9.3 Store Contribution

```text
storeContribution = netSales - variableCosts - controllableFixedCosts
storeOperatingProfit = storeContribution - allocatedSharedCosts - depreciation
```

Allocated shared costs must be shown separately so that store managers can distinguish operational performance from headquarters burden.

## 10. Inventory and Waste

Inventory must not be represented only as an expense shortcut. At minimum the simulation must track:

- Beginning inventory
- Purchases
- Consumption
- Waste
- Transfers
- Ending inventory

```text
COGS = beginningInventory + purchases + inboundTransfers - endingInventory - outboundTransfers
```

Waste reduces inventory and must be reported as an operating loss component.

## 11. Staffing Coverage

Store staffing must affect:

- Capacity
- Service speed
- Quality consistency
- Overtime
- Employee fatigue
- Accident and hygiene risk

Understaffing must not create free cost savings without operational consequences.

## 12. Multi-Store Management

The player must be able to:

- Compare stores using normalized KPIs
- Apply policies to one store, selected stores, or all stores
- Delegate routine decisions to managers
- Override delegated decisions
- Identify exceptional stores and persistent underperformers

Required store KPIs:

- Weekly sales
- Customer count
- Average ticket
- Gross margin
- Labor cost ratio
- Rent ratio
- Store contribution
- Operating margin
- Capacity utilization
- Lost sales
- Waste ratio
- Reputation
- Employee turnover

## 13. Franchise Stores

Franchised stores are legally and economically distinct from directly operated stores.

The company may receive:

- Initial franchise fees
- Royalties
- Advertising fund contributions
- Supply margin

Franchisee sales must not be consolidated as company sales unless required by the chosen accounting model. Royalty revenue and franchise support costs must be separately identifiable.

## 14. Automation and Delegation

Delegation policies must have explicit rules, such as:

```ts
interface StorePolicy {
  targetFoodCostRatio: number;
  targetLaborCostRatio: number;
  minimumCashBufferWeeks: number;
  priceAdjustmentLimit: number;
  promotionBudgetLimit: number;
  closureReviewThresholdWeeks: number;
}
```

The player must be able to inspect why an automated decision occurred.

## 15. Failure Conditions

A store may enter distress due to:

- Persistent operating losses
- Lease burden
- Severe reputation decline
- Labor shortage
- Equipment failure
- Hygiene incidents
- Local demand collapse

Store distress must feed into company-level liquidity without instantly forcing company bankruptcy unless legal and financial conditions require it.

## 16. Required Tests

- Identical seed and actions produce identical weekly store results
- Revenue never exceeds realizable customer capacity without a documented channel
- Inventory roll-forward balances
- Taxes collected are excluded from revenue
- Closed stores generate no ordinary sales
- Store sale removes future operating results but preserves history
- Negative customer counts and negative inventory are impossible
- Bulk policy changes produce the same result as equivalent individual changes
- A 1,200-week simulation remains numerically stable

## 17. Open Implementation Questions

The following must be resolved against the current codebase before implementation changes:

- Exact location taxonomy already in use
- Existing menu data shape
- Current demand factor names
- Whether inventory is item-level or aggregate
- Existing franchise support
- Existing store manager automation

Until verified, this document defines the target model and not an assertion that every field is already implemented.
