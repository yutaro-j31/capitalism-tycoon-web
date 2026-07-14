# Phase 1A Balance Report

Target business: ramen. The automated calibration test is `tests/market-calibration-test.js`; it uses `tests/legacy-market-helper.js` to reproduce the pre-Phase-1A ramen store sales formula with fixed random value `0.5`.

| Scenario | Legacy sales | New sales | Gap | Cause | Adopted adjustment | Profit/unit effect |
|---|---:|---:|---:|---|---|---|
| Standard store | 993,362 | 990,894 | -0.25% | Segment share + outside option calibrated to legacy demand | Local market multiplier 2.2 | Units explicit, margin visible |
| Normal price | 993,362 | 990,894 | -0.25% | Same as standard baseline | Competitor benchmark uses master price | No hidden legacy passthrough |
| Advertising/brand | 1,142,366 | 1,195,277 | +4.63% | Brand utility increases trend/general segment share | Brand utility denominator calibrated | Premium tolerance rises |
| Quality improvement | 1,119,637 | 1,191,624 | +6.43% | Quality utility raises quality-segment share and quality cost | Quality utility denominator calibrated | Profit can improve at right price |
| Low economy | 854,291 | 852,169 | -0.25% | Economy lowers market size | Same multiplier | Finite output |
| High economy | 1,132,432 | 1,129,620 | -0.25% | Economy raises market size | Same multiplier | Finite output |

All normal cases above assert within ±10%. Extreme price changes, deep discounting, and explicit capacity shortages are intentionally tested separately because Phase 1A makes them strategy-sensitive.

## Multiple-store exception and cannibalization
Same `businessID + prefID` stores share one local market. A second same-market ramen store can expand local availability slightly, but it does not duplicate market size; the first store's share can fall and company demand does not simply double. Different `prefID` stores are separate local markets.
