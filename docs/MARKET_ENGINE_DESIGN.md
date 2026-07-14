# Market Engine Design

Phase 1A adds `js/market.js` as a classic script registered under `__capitalismTycoonModules.market` between `data.js` and `engine.js`.

## Scope
Target business IDs: `ramen`. Other businesses use the unchanged legacy sales branch.

## Model
Each open target store is converted into an offer with price, quality, brand awareness/trust, convenience, service quality, novelty, capacity, variable cost, satisfaction and repeat rate. Five customer segments evaluate player and competitor offers plus an outside purchase-withhold option.

Utility is transformed with clamped exponentials to avoid overflow. Segment shares are clamped to non-negative ratios and include competitor and outside shares. Capacity is applied after potential demand allocation.

## Unit economics
`unitsSold`, `sales`, `variableCost`, `marginalProfit`, `marginalProfitRate`, `fixedCost`, `repairCost`, `lostDemand`, `capacityUtilization` and market share are stored per store and aggregated by business.

## Determinism
The market module does not call `Math.random()`. Existing weekly random updates outside ramen stores remain unchanged.
