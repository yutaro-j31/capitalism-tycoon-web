# Market System Guide

## Target and non-target industries
Phase 1A targets `ramen` only. Non-target industries continue through the legacy weekly store formula.

## Customer segments
Segments are low-price, standard, quality-focused, convenience-focused, and brand/trend-focused. Each has distinct price, quality, brand, convenience, novelty and loyalty sensitivities.

## Market size and elasticity
Market size starts from the old calibrated demand baseline and applies regional traffic, economy, season and macro crisis effects. Price elasticity compares the player offer to competitor benchmark prices and an outside option.

## Market share and competitors
Player stores compete against existing competitors transformed into low-price, quality, brand, convenience, or balanced offers. Competitor and outside shares prevent automatic 100% share.

## Capacity and unit economics
Demand is capped by capacity. Lost demand is opportunity loss. Unit economics are sales, variable cost, marginal profit and marginal profit rate.

## Weekly order
`advanceWeek()` updates macro and other systems, then target stores call `market.calculateStoreMarket()`, then report totals and company cash are updated once.

## Save fields and migration
saveVersion 4 adds `marketResultsByStoreID`, `marketResultsByBusinessID`, `lastMarketSummary`, and safe store defaults for satisfaction, repeat rate, capacity and market metrics. `SAVE_KEY` remains `capitalism_tycoon_web_v1`.

## Adding target industries
Add a stable business ID to `TARGET_BUSINESS_IDS`, calibrate against legacy sales, add scenarios to the balance report, and add regression tests proving non-target industries still match legacy behavior.
