# 15 Market Structure and Competition System

## 1. Purpose

This document defines how regions, customer demand, market share, saturation, competitive pressure, entry and exit interact. It connects the economy, restaurant demand and competitor AI systems without allowing any one subsystem to apply duplicate effects.

## 2. Market hierarchy

The simulation uses the following hierarchy:

```text
world
→ country or macro region
→ operating region
→ district
→ location catchment
→ store
```

Demand must be calculated at the lowest practical market level and aggregated upward for reporting.

## 3. Market state

```ts
interface MarketState {
  marketId: string;
  regionId: string;
  categoryId: string;
  addressableCustomers: number;
  categoryPurchaseFrequency: number;
  averageCategorySpend: number;
  growthTrend: number;
  saturation: number;
  concentrationIndex: number;
  priceIndex: number;
  qualityIndex: number;
  activeCompanyIds: string[];
  entryAttractiveness: number;
  vacancyCapacity: number;
}
```

## 4. Addressable demand

```text
addressableDemand
= populationOrTraffic
× categoryParticipation
× purchaseFrequency
× economicDemandFactor
× seasonalFactor
× regionalShockFactor
```

Addressable demand is a market pool, not guaranteed company sales.

## 5. Store attraction

Each store competes for the pool through an attraction score.

```text
storeAttraction
= brandFactor
× locationFactor
× productFitFactor
× priceValueFactor
× qualityFactor
× convenienceFactor
× capacityAvailability
× reputationFactor
× marketingFactor
```

A factor must not be applied both in market allocation and again as a direct sales multiplier unless the distinction is documented.

## 6. Market share allocation

For eligible stores:

```text
expectedShare_i
= attraction_i ^ sensitivity
/ sum(attraction_j ^ sensitivity)
```

The allocation model must retain an outside option representing customers who do not purchase from any simulated company. Therefore, company shares are not required to total 100% of the theoretical population.

## 7. Capacity constraint

Allocated demand is limited by operational capacity. Unserved demand may:

- transfer to another store;
- leave the simulated category;
- be delayed;
- reduce reputation when queues are excessive.

Transfer behavior must be configured by customer segment and cannot create demand from nothing.

## 8. Saturation

Saturation reflects capacity relative to sustainable demand.

```text
saturation
= effectiveMarketCapacity
/ sustainableDemand
```

Interpretation:

- below 0.7: under-served;
- 0.7 to 1.0: healthy competitive market;
- 1.0 to 1.3: crowded;
- above 1.3: severe overcapacity.

Thresholds are balancing defaults and must remain configurable.

Saturation affects expected utilization, entry attractiveness, closure risk and rent pressure. It must not directly reduce every company's sales if market-share allocation already incorporates excess capacity.

## 9. Competitive intensity

Competitive intensity considers:

- number of meaningful competitors;
- concentration;
- product similarity;
- spare capacity;
- pricing aggression;
- customer switching ease;
- demand growth;
- entrant frequency.

A market with many differentiated companies may be less intense than a market with two nearly identical price competitors.

## 10. Concentration

The preferred measure is a normalized Herfindahl-Hirschman-style index based on company market shares.

```text
HHI = sum(companyShare_i ^ 2)
```

Reporting must distinguish store share from company-group share. Subsidiaries controlled by the same parent are consolidated for concentration analysis.

## 11. Entry

A company evaluates entry using:

- expected store economics;
- saturation;
- growth;
- location availability;
- local wage and rent conditions;
- supply access;
- brand portability;
- competitor response risk;
- headquarters capacity;
- capital and liquidity.

Entry requires lead time. No company may open a fully operational store in the same turn as an unplanned decision unless the asset already exists and only reactivation is required.

## 12. Exit

Market exit may occur through:

- individual store closure;
- regional withdrawal;
- category withdrawal;
- sale to another company;
- franchise transfer;
- bankruptcy liquidation.

Exit reduces capacity only when the location actually ceases operating. A sale transfers capacity rather than eliminating it.

## 13. Price competition

Price changes affect value perception and contribution margin. Competitor response includes observation and planning delays.

The system must prevent unstable price oscillation by using:

- review intervals;
- materiality thresholds;
- bounded adjustments;
- profile-dependent response delay;
- campaign duration rules.

Predatory or loss-leading pricing may exist as a strategy but requires a budget, duration and expected strategic benefit.

## 14. Differentiation

Companies can reduce direct competitive pressure through:

- product quality;
- menu uniqueness;
- service speed;
- location convenience;
- brand prestige;
- customer loyalty;
- niche targeting;
- digital or delivery capability.

Differentiation changes cross-price sensitivity and attraction. It does not grant immunity from poor economics.

## 15. Cannibalization

New stores and products may take demand from existing operations of the same company.

Cannibalization depends on:

- catchment overlap;
- customer segment overlap;
- product similarity;
- capacity constraints at the existing store;
- brand expansion effects.

Gross new-store sales must not be treated as wholly incremental when overlap exists.

## 16. Brand spillover

Opening a strong flagship may increase regional awareness. Scandals, poor quality or mass closures may reduce it. Spillover is gradual and bounded.

Brand effects must be stored at appropriate levels:

- global brand;
- regional brand;
- category brand;
- store reputation.

## 17. Location supply

Locations are finite market resources with:

- foot traffic;
- rent;
- size;
- capacity potential;
- district demographics;
- lease terms;
- opening cost;
- competitive proximity.

Prime locations may become unavailable or more expensive when demand is high. Availability must be deterministic for a seed and saved state.

## 18. Supplier and labor competition

Market competition also affects inputs.

- rapid regional expansion may raise wages;
- limited suppliers may increase procurement cost;
- high-quality managers may command higher compensation;
- logistics capacity may constrain store growth.

These effects must flow through labor and procurement systems rather than arbitrary profit penalties.

## 19. Market events

Supported events include:

- district redevelopment;
- transport improvement;
- anchor tenant closure;
- tourism boom;
- demographic decline;
- regulatory restriction;
- major competitor failure;
- supplier disruption;
- property oversupply.

Events must specify scope, duration, observability and decay.

## 20. Reporting

The player should be able to view:

- estimated market size;
- company market share;
- growth trend;
- saturation;
- average price and quality position;
- major competitors;
- recent entries and exits;
- forecast confidence.

Estimated values must be labeled when they are not exact.

## 21. Anti-double-counting rules

1. Macroeconomic confidence modifies the market pool once.
2. Store attraction allocates the pool; it does not recreate it.
3. Capacity limits realized sales after allocation.
4. Saturation is an input to entry and utilization, not an additional universal sales penalty.
5. Marketing affects attraction or awareness according to campaign type, not both without specification.
6. Brand spillover and store reputation are separate levels.
7. Cannibalization is accounted for during allocation, not deducted again from company totals.

## 22. Required tests

1. Market shares are finite and non-negative.
2. Allocated demand does not exceed the market pool before defined transfer rules.
3. Realized store sales do not exceed capacity.
4. Company-group market share consolidates subsidiaries correctly.
5. Opening an overlapping store produces measurable cannibalization.
6. Closing a store releases or removes capacity according to the transaction type.
7. Save/load preserves location availability and market allocation.
8. Same seed and actions produce identical entry, exit and share paths.
9. Price responses respect observation delays and adjustment bounds.
10. Economic demand effects are applied exactly once.
11. Long simulations avoid negative market size and unbounded saturation.
12. Market concentration updates correctly after M&A and bankruptcy.

## 23. Balance metrics

Automated runs must report:

- market size by region and category;
- concentration;
- entry and exit rate;
- average store utilization;
- share volatility;
- price dispersion;
- quality dispersion;
- location rent burden;
- cannibalization rate;
- survival by entrant cohort.

## 24. Implementation rule

Market calculations must be pure or reproducibly staged functions. Configuration changes affecting allocation, saturation or competitive response require updated deterministic fixtures and documentation.