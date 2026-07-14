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

## PR #9 merge-blocker corrections
- Missing store `capacity` is now `null`/unset, not `0`. Explicit `capacity: 0` remains a valid sales-stop setting.
- Effective capacity is derived only by `market.effectiveCapacity()` from business demand, operating hours, efficiency, and store condition.
- The local market key is `businessID + prefID`. Competitors are connected by resolving `prefID` to `areaID` when competitor records only have `areaID`.
- Competitor filtering is `businessID === target business AND areaID === target area`; if no competitor matches, one deterministic market-average offer is used.
- Same-market player stores are evaluated together with competitors and the outside option, so stores cannibalize one another instead of each receiving a cloned market.
- Business market share is weighted as total target units sold divided by unique local-market potential, with each local market counted once.

## PR #9 merge-blocker corrections
- Missing store `capacity` is now `null`/unset, not `0`. Explicit `capacity: 0` remains a valid sales-stop setting.
- Effective capacity is derived only by `market.effectiveCapacity()` from business demand, operating hours, efficiency, and store condition.
- The local market key is `businessID + prefID`. Competitors are connected by resolving `prefID` to `areaID` when competitor records only have `areaID`.
- Competitor filtering is `businessID === target business AND areaID === target area`; if no competitor matches, one deterministic market-average offer is used.
- Same-market player stores are evaluated together with competitors and the outside option, so stores cannibalize one another instead of each receiving a cloned market.
- Business market share is weighted as total target units sold divided by unique local-market potential, with each local market counted once.
