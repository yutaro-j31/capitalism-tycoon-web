# Market Engine Audit (Phase 1A)

## Code facts before replacement
- Weekly store sales are calculated in `TycoonEngine.advanceWeek()` in `js/engine.js`.
- Legacy demand formula: `business.demand * pref.traffic * area.traffic * economy * season * fit(business, area) * quality * brand * dx * localCompetition * random * department * operatingHours * macroCrisis`.
- Legacy store sales: `demand * business.price * inflation`.
- Legacy variable cost: `demand * business.unitCost * inflation * efficiency discount / operations effect`.
- Legacy fixed cost: `(business.fixedCost + pref.rent + business.wage) * inflation * operatingHours * macro crisis cost`.
- Store output fields: `lastSales`, `lastProfit`, and `condition`.
- Company cash receives weekly profit once at the end of `advanceWeek()` after report creation.
- Randomness in the legacy store formula comes from `rand(.88,1.14)` and condition decay `rand(.1,1)`.

## Inputs
Business master fields: `id`, `price`, `unitCost`, `demand`, `quality`, `brand`, `efficiency`, `dx`, `fixedCost`, `wage`, `segmentFit`.
Store fields: `businessID`, `prefID`, `condition`, `operatingHours`, `status`, `openingWeek`.
Regional inputs: `prefs.traffic`, `prefs.rent`, `areas.traffic`, `areas.competition`.
Company inputs: economy, season, inflation, macro crisis, departments, competitors.

## Outputs and order
1. Macro, stock market, property, startup, competitor and campaign updates run first.
2. Product, overseas, subsidiary, franchise and personal asset updates run.
3. Store sales and expenses are accumulated.
4. Rent, payroll, office, interest, dividend and tax are added.
5. `companyCash` changes once by final `profit`.
6. Reports, histories, save and emit occur once outside nested transactions.

## Unused or underused items
Existing `segmentFit`, competitor strategy, customer segment maps, market share maps, supplier quality, vertical integration and R&D fields existed but were not directly connected to the core weekly store calculation.

## Phase 1A replacement scope
Only business ID `ramen` is routed to `js/market.js`. Non-target businesses continue using the legacy formula in the same branch, preserving their random calls except for target ramen replacing the legacy demand random with deterministic market allocation.

## Design inference
The first new-game standard business is `selectedBusiness: "ramen"`; therefore Phase 1A targets ramen stores only. Future phases can add IDs to `TARGET_BUSINESS_IDS` after calibration.
