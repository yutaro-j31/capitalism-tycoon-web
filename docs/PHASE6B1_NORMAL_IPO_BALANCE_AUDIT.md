# Phase 6B-1: Normal-start IPO balance audit

## Purpose

Confirm that normal difficulty can progress from the actual 8,000,000-yen starting cash to a parent-company IPO using ordinary game actions and organic weekly results.

## Audit result

The former release test used 2,000,000,000 yen and constructed report history, so it verified APIs and persistence rather than playable balance.

An aggressive three-store opening sequence failed in week 9 because deposits, equipment, and initial procurement were paid too close together. A one-store matrix showed that the base ramen business remained viable across low-cost and high-demand locations. The relevant issue was expansion timing, not first-store profitability.

The permanent staged route uses:

1. Fukuoka store
2. Osaka store after positive operations
3. Tokyo store after positive operations
4. low-deposit head office
5. accounting department
6. normally negotiated CEO and CFO hires
7. board establishment
8. Growth Market IPO

After the correction below, the route reached IPO in week 53 with three open stores, 52 organic reports, no company borrowing, company value of about 231 million yen, and trailing 52-week profit of about 17.7 million yen.

## Correction

The IPO requirement text referred to profit over the latest 52 weeks. The implementation summed the available reports up to 52 but did not require 52 reports to exist. A company could therefore qualify in week 39 with only 38 reports.

`progression-balance.js` now adds `決算履歴52週` to the missing conditions until 52 weekly reports exist. Existing office, accounting, board, store-count, profit, company-value, and IPO proceeds calculations are unchanged.

## Regression coverage

`normal-start-ipo-balance-audit-test.js` verifies exact starting cash, zero starting debt, zero injected reports, ordinary progression actions, at least 52 organic reports, IPO no earlier than week 53, no required borrowing, finance validity, and JSON-serializable finite state.

The dedicated `Progression Balance` workflow runs this audit for pull requests and pushes to `main`.

## Compatibility

- save key remains `capitalism_tycoon_web_v1`
- save version remains 9
- no migration
- no starting-cash change
- no revenue, cost, market, supply, workforce, competitor, crisis, accounting, valuation, executive, or IPO proceeds formula change
- no runtime randomness added
