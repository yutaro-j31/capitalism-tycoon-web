# Phase 1C Balance Report

`tests/supply-calibration-test.js` now calculates a Phase 1A baseline and a Phase 1C run separately from the same deterministic input.  The baseline uses the Phase 1A market output (`unitsSold`, `revenue`, `variableCost`) before supply constraints; Phase 1C then advances the engine with inventory, AP, emergency procurement, lot COGS, and supplier choices enabled.

| Scenario | Old units | New units | Old sales | New sales | Old COGS | New COGS | Old margin | New margin | Unit diff | Sales diff | COGS diff | Margin diff | Unit divergence | Sales divergence | COGS divergence | Margin divergence | OK / reason |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Standard one ramen store | 1029.94 | 1028.00 | 948020.06 | 946232.88 | 300176.76 | 300603.27 | 647843.30 | 645629.61 | -1.94 | -1787.18 | 426.51 | -2213.69 | -0.19% | -0.19% | 0.14% | -0.34% | OK: sufficient inventory preserves Phase 1A. |
| Same market two stores | 1350.35 | 1349.38 | 1242945.11 | 1242050.28 | 393560.49 | 402369.68 | 849384.62 | 839680.60 | -0.97 | -894.83 | 8809.19 | -9704.02 | -0.07% | -0.07% | 2.24% | -1.14% | OK: market allocation remains separate from fulfillment. |
| Different market two stores | 1788.55 | 1786.00 | 1646287.61 | 1643941.56 | 521273.02 | 526459.74 | 1125014.59 | 1117481.82 | -2.55 | -2346.05 | 5186.72 | -7532.77 | -0.14% | -0.14% | 1.00% | -0.67% | OK. |
| Advertising +10 brand | 1078.18 | 1077.00 | 992425.41 | 991335.42 | 314237.07 | 314168.43 | 678188.34 | 677166.99 | -1.18 | -1089.99 | -68.64 | -1021.35 | -0.11% | -0.11% | -0.02% | -0.15% | OK: advertising scenario actually changes brand and demand. |
| Quality +20 | 1282.29 | 1281.00 | 1180296.18 | 1179109.26 | 381065.93 | 370643.79 | 799230.26 | 808465.47 | -1.29 | -1186.92 | -10422.14 | 9235.21 | -0.10% | -0.10% | -2.73% | 1.16% | OK. |
| Low economy 0.8 | 823.95 | 823.00 | 758416.05 | 757538.58 | 240141.41 | 243851.07 | 518274.64 | 513687.51 | -0.95 | -877.47 | 3709.66 | -4587.13 | -0.12% | -0.12% | 1.54% | -0.89% | OK. |
| High economy 1.2 | 1235.93 | 1234.00 | 1137624.08 | 1135847.64 | 360212.11 | 357632.31 | 777411.96 | 778215.33 | -1.93 | -1776.44 | -2579.80 | 803.37 | -0.16% | -0.16% | -0.72% | 0.10% | OK. |
| Stockout | 1029.94 | 0.00 | 948020.06 | 0.00 | 300176.76 | 0.00 | 647843.30 | 0.00 | -1029.94 | -948020.06 | -300176.76 | -647843.30 | -100.00% | -100.00% | -100.00% | -100.00% | Intentional: critical materials unavailable. |
| Emergency procurement | 1029.94 | 740.00 | 948020.06 | 681140.40 | 300176.76 | 204861.60 | 647843.30 | 476278.80 | -289.94 | -266879.66 | -95315.16 | -171564.50 | -28.15% | -28.15% | -31.75% | -26.48% | Intentional: emergency supply partially fills demand at spot cost. |
| AP receipt | 1029.94 | 740.00 | 948020.06 | 681140.40 | 300176.76 | 201455.60 | 647843.30 | 479684.80 | -289.94 | -266879.66 | -98721.16 | -168158.50 | -28.15% | -28.15% | -32.89% | -25.96% | Intentional AP scenario starts with one material receipt only. |
| High-quality supplier | 1029.94 | 1028.00 | 948020.06 | 946232.88 | 300176.76 | 320078.90 | 647843.30 | 626153.98 | -1.94 | -1787.18 | 19902.14 | -21689.32 | -0.19% | -0.19% | 6.63% | -3.35% | Intentional: quality supplier raises lot cost and quality. |
| Low-cost supplier | 1029.94 | 1028.00 | 948020.06 | 946232.88 | 300176.76 | 278391.27 | 647843.30 | 667841.61 | -1.94 | -1787.18 | -21785.49 | 19998.31 | -0.19% | -0.19% | -7.26% | 3.09% | Intentional: low-cost supplier lowers lot cost. |

## Long-run measurements

`tests/supply-long-run-test.js` asserts `finance.validate().ok`, `supply.validate().ok`, balance/cash tolerances, physical inventory vs BS inventory, unpaid receipts vs supply AP, weekly cash chain, no game over, finite state, and bounded save size.

| Scenario | Orders retained | Active lots | Inventory quantity | Inventory value | AP | Company cash | Save bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 store × 52 weeks | 77 | 8 | 6352.57 | 454917.38 | 0.00 | 100006390234.85 | 788218 |
| 10 stores × 52 weeks | 740 | 54 | 18719.87 | 1330678.19 | 0.00 | 99921273742.77 | 3376864 |
| 50 stores × 52 weeks | 3777 | 379 | 27047.35 | 2115555.12 | 0.00 | 99282537669.15 | 6410948 |
| 10 stores × 520 weeks | 756 | 56 | 13142.92 | 935631.52 | 0.00 | 98819691143.60 | 4556474 |

| Closed-store long-run | 293 | — | — | 1118221.22 | 0.00 | 99995270374.43 | — |
