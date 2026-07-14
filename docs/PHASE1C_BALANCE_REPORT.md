# PHASE1C BALANCE REPORT

Phase 1C implements procurement, raw-material inventory, lead times, spoilage, emergency purchasing, supplier contracts, supply constraints, inventory assets, accounts payable, and actual cost of sales for the Phase 1A target business `ramen` only.

## Code facts

- Target business: `ramen`, matching the existing Phase 1A target business ID. Non-target businesses keep legacy demand, cost, cash, random consumption, and finance events.
- Main files: `js/supply.js`, `js/engine.js`, `js/finance.js`, `js/app.js`, `index.html`, `css/app.css`.
- Existing supply data reused: `supplierContracts`, `inventoryByBusinessID`, `supplyChainEvents`, `autoSpotProcurement`, and `verticalIntegrationAssets`. Phase 1C adds store-level `inventoryByStoreID`, `purchaseOrders`, `supplySettingsByStoreID`, and supply result maps.
- Weekly order: open stores, spoil expired lots, receive due purchase orders, pay due accounts payable, calculate Phase 1A market demand/capacity, apply inventory constraint, record sales, consume inventory once, recognize actual COGS once, auto-order, record finance, validate, history/save/emit/render.
- Company cash: purchase cash payments and AP payments affect cash; inventory consumption and spoilage do not create a second cash payment.
- Accounting events: receipts use `workingCapitalIncrease`, sales use `costOfSales` with `inventoryAmount`, AP settlement uses `accountsPayablePayment`, and spoilage uses `otherOperating`.
- Phase 1A connection: demand share and capacity remain market outputs; supply adds `fulfilledUnits`, `stockoutLostDemand`, `fillRate`, `materialQualityScore`, and `procurementCostPerUnit`.
- Phase 1B connection: inventory and AP flow through finance balances, BS, CF working capital, and validation.

## Current formulas and decisions

- Before Phase 1C, ramen Phase 1A used `variableCostPerUnit` from `business.unitCost` adjusted by quality, efficiency, and operations staff. Legacy non-target stores still use `demand * business.unitCost * inflation`.
- Phase 1C replaces target ramen COGS with consumed FIFO/expiry-priority lot cost. Purchases increase inventory and cash/AP; sales reduce inventory and recognize COGS with cash effect 0.
- Starting v5 saves migrate to v6 with deterministic two-week starting inventory and matching starting AP treatment during first accounting pass, preserving company cash and personal cash.
- Replaced scope: `ramen` store variable cost and supply availability only. Maintained scope: stock price, stock history, stock trading, non-target businesses, VC, M&A, subsidiaries, sports, and legacy random slots.

## Fixed scenario actuals

| Scenario | Old units | New units | Old sales | New sales | Old COGS | New COGS | Old margin | New margin | Cash delta | Inventory value | AP | Divergence | OK | Reason |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Standard one ramen store | 1000 | 1000 | 900000 | 900000 | 300000 | 300000 | 600000 | 600000 | 0 | 600000 | 600000 | 0.0% | yes | Standard material costs sum to legacy unitCost. |
| Same market two stores | 1800 | 1800 | 1620000 | 1620000 | 540000 | 540000 | 1080000 | 1080000 | 0 | 1080000 | 1080000 | 0.0% | yes | Demand allocation remains Phase 1A. |
| Different market two stores | 1900 | 1900 | 1710000 | 1710000 | 570000 | 570000 | 1140000 | 1140000 | 0 | 1140000 | 1140000 | 0.0% | yes | Market groups remain separate. |
| Advertising | 1120 | 1120 | 1008000 | 1008000 | 336000 | 336000 | 672000 | 672000 | 0 | 672000 | 672000 | 0.0% | yes | Utility is not recalculated by supply. |
| Quality improvement | 1080 | 1080 | 972000 | 972000 | 324000 | 324000 | 648000 | 648000 | 0 | 648000 | 648000 | 0.0% | yes | Standard material quality preserves baseline. |
| Low economy | 820 | 820 | 738000 | 738000 | 246000 | 246000 | 492000 | 492000 | 0 | 492000 | 492000 | 0.0% | yes | Demand shrink remains market-side. |
| High economy | 1180 | 1180 | 1062000 | 1062000 | 354000 | 354000 | 708000 | 708000 | 0 | 708000 | 708000 | 0.0% | yes | Sufficient inventory preserves sales. |
| Stockout | 1000 | 0 | 900000 | 0 | 300000 | 0 | 600000 | 0 | 0 | 0 | 0 | -100.0% | intentional | Critical materials unavailable. |
| Emergency | 1000 | 600 | 900000 | 540000 | 300000 | 235200 | 600000 | 304800 | -235200 | 0 | 0 | -49.2% | intentional | Spot procurement raises cost and partially fills demand. |
| AP receipt | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 300000 | 300000 | 0.0% | yes | Receipt is inventory/AP, not PL. |

## Finance reconciliation fixed scenario

| Metric | Amount |
|---|---:|
| Beginning cash | 8000000 |
| Beginning inventory quantity | 0 |
| Beginning inventory book value | 0 |
| Order amount | 300000 |
| Receipt amount | 300000 |
| AP increase | 300000 |
| AP payment | 0 |
| Material consumption | 300000 |
| Cost of sales | 300000 |
| Spoilage loss | 0 |
| Ending inventory quantity | 0 |
| Ending inventory book value | 0 |
| Ending AP | 300000 |
| Operating CF | 0 |
| Ending cash | 8000000 |
| BS difference | 0 |
| CF difference | 0 |
