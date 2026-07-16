# Phase 6B-2: Strategy and regional balance audit

## Purpose

Verify that normal difficulty is not balanced only for the Phase 6B-1 ramen route. The audit covers bootstrap and leveraged strategies across retail, food service, personal services, education, real estate, finance, and software businesses.

## Initial findings

The uncalibrated matrix exposed two opposite balance failures:

- cafe and bakery routes failed all tested seeds before sustainable multi-store expansion
- web agency and app studio routes generated roughly 2.3 to 3.1 billion yen of trailing annual profit, overwhelming the IPO and valuation systems

The cause was the shared interpretation of `demand` across businesses with prices ranging from hundreds of yen to hundreds of thousands of yen. A demand value that was plausible for a cafe became excessive for project-based software, consulting, and brokerage businesses.

## Calibration

`strategy-balance.js` applies a one-time versioned demand calibration when a game is created, configured, reset, or loaded from an older save.

The calibration:

- raises structurally weak low-ticket routes such as cafe, bakery, convenience store, bookstore, and cleaning
- lowers high-ticket service volumes such as software studios, web agencies, real-estate agencies, investment consulting, insurance agencies, and M&A brokerage
- preserves player-earned demand upgrades by applying a ratio rather than replacing the current value
- stores `strategyBalanceVersion: 1` so a calibrated save is never adjusted twice
- adds no runtime randomness

Prices, unit costs, fixed costs, wages, store costs, market formulas, supply rules, workforce rules, financing formulas, accounting, valuation, and IPO proceeds are unchanged.

## Permanent matrix

The regression suite runs 13 strategies with 3 deterministic seeds each:

- ramen bootstrap
- cafe bootstrap
- bakery bootstrap
- leveraged convenience store
- leveraged bookstore
- beauty salon bootstrap
- cleaning bootstrap
- leveraged cram school
- leveraged real-estate agency
- leveraged insurance agency
- leveraged M&A brokerage
- leveraged web agency
- leveraged app studio

Each of the 39 cases must:

- start on normal difficulty with organic state
- use production APIs for borrowing, stores, office, accounting, executives, board, weekly progression, and IPO
- avoid bankruptcy
- produce at least 52 organic reports
- operate at least three stores
- reach IPO within 208 weeks
- meet the 10-million-yen trailing-profit and 100-million-yen valuation gates
- remain below 200 million yen of trailing annual profit and 2 billion yen of company value at IPO
- keep bootstrap strategies debt-free and exercise borrowing in leveraged strategies
- pass finance validation and JSON-serializable finite-state checks

The final calibrated matrix passes all 39 cases. Debt-free routes remain possible, while capital-intensive retail, finance, and software routes require ordinary company borrowing.

## Test architecture

Each matrix case runs in an isolated Node process. Browser VM contexts are therefore released after every case instead of accumulating across the full matrix. This prevents the audit itself from exhausting the Node heap while retaining full per-case state validation.

## Compatibility

- save key remains `capitalism_tycoon_web_v1`
- save version remains 9
- no explicit save migration version bump
- older saves without `strategyBalanceVersion` are calibrated once during normalization
- existing demand improvements are ratio-preserved
- the Phase 6B-1 52-report IPO gate remains unchanged
