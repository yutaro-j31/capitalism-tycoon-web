# Phase 6A: provisional v1 progression gate

## Purpose

This release gate proves that the main management route can be completed through the production engine APIs without changing balance formulas or persistent save fields.

The covered route is:

1. initial company setup;
2. opening ramen, cafe, and convenience-store businesses;
3. waiting for all three stores to reach active operation;
4. contracting a head office;
5. establishing accounting and investment departments;
6. investing in a startup and converting it into a consolidated subsidiary;
7. completing a friendly M&A transaction;
8. establishing a board with a CEO and CFO;
9. satisfying every parent-company IPO condition;
10. executing the parent-company IPO;
11. saving and reloading the completed state.

## Audit scenario

The test uses a capitalized release-audit scenario. Company cash is raised before the route starts and the finance ledger is reset to the same opening balance. This avoids hundreds of simulated weeks while preserving all production action methods and their actual unlock conditions.

Direct state fixtures are limited to:

- deterministic CEO and CFO records, because executive negotiation intentionally contains randomness;
- one deterministic M&A target, because target generation intentionally contains randomness;
- 52 profitable weekly reports, because the gate validates IPO connectivity rather than long-term balance calibration.

All transitions under audit still use the production methods: `configure`, `openStore`, `advanceWeek`, `contractOffice`, `establishDepartment`, `investStartup`, `makeSubsidiary`, `acquireTarget`, `establishBoard`, `ipoMissingReasons`, `executeIPO`, `save`, and `TycoonEngine.load`.

## Release assertions

The gate requires:

- three stores across three different businesses;
- every store to become operational;
- accounting and investment departments to unlock at the documented store counts;
- company VC ownership to reach at least 50 percent and convert without double-counting cash;
- M&A to create a retained subsidiary and increment acquisition history;
- every IPO prerequisite to resolve to an empty missing-reason list;
- the parent company to appear in the stock market after listing;
- VC and M&A subsidiaries to remain present after listing and reload;
- board, stores, subsidiaries, listing status, and IPO eligibility to survive reload;
- finance validation and structural finite-value checks to pass before and after reload;
- the corresponding UI action identifiers to remain connected in `app.js`;
- `SAVE_KEY` to remain `capitalism_tycoon_web_v1` and save version to remain 9.

## Non-scope

This increment does not alter:

- store demand or profitability;
- office or department costs;
- startup valuation formulas;
- M&A pricing or goodwill formulas;
- IPO thresholds or pricing;
- competitor behavior;
- supply, workforce, stock, or finance formulas;
- persistent save schema.
