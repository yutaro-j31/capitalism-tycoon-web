# Phase 1C Balance Report

The calibration table below is generated from `tests/supply-calibration-test.js` and uses the fixed deterministic input in that test.  Normal scenarios keep Phase 1A demand/capacity behavior intact while Phase 1C replaces ramen COGS with consumed lot cost and records receipts through inventory/AP.

| Scenario | Old units | New units | Old sales | New sales | Old COGS | New COGS | Old margin | New margin | Company cash delta | Inventory value | Accounts payable | Divergence | OK | Reason |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Standard one ramen store | 1028.00 | 1028.00 | 946232.88 | 946232.88 | 260782.77 | 260782.77 | 685450.11 | 685450.11 | 1049035.52 | 206.72 | 193957.13 | 0.00% | yes | Sufficient initial inventory preserves the Phase 1A realized units and sales; lot COGS is within calibration bounds. |
| Same market two stores | 1349.38 | 1349.38 | 1242050.28 | 1242050.28 | 348961.98 | 348961.98 | 893088.30 | 893088.30 | 2081720.28 | 38952.28 | 387914.26 | 0.00% | yes | Demand allocation remains market-side, then supply is consumed once per store. |
| Different market two stores | 1786.00 | 1786.00 | 1643941.56 | 1643941.56 | 456662.94 | 456662.94 | 1187278.62 | 1187278.62 | 2474539.53 | 353.35 | 387914.26 | 0.00% | yes | Separate prefecture markets keep their Phase 1A allocation before supply fulfillment. |
| Advertising baseline | 1028.00 | 1028.00 | 946232.88 | 946232.88 | 260782.77 | 260782.77 | 685450.11 | 685450.11 | 1049035.52 | 206.72 | 193957.13 | 0.00% | yes | Supply does not recalculate market utility. |
| Quality improvement | 1281.00 | 1281.00 | 1179109.26 | 1179109.26 | 321598.91 | 321598.91 | 857510.35 | 857510.35 | 1221239.98 | 62.50 | 193957.13 | 0.00% | yes | Base business quality remains a demand input; material quality only adds bounded fulfillment quality. |
| Low economy | 823.00 | 823.00 | 757538.58 | 757538.58 | 211504.87 | 211504.87 | 546033.71 | 546033.71 | 909804.20 | 21.64 | 193957.13 | 0.00% | yes | Lower demand remains Phase 1A-driven. |
| High economy | 1234.00 | 1234.00 | 1135847.64 | 1135847.64 | 310301.05 | 310301.05 | 825546.59 | 825546.59 | 1189184.87 | 153.85 | 193957.13 | 0.00% | yes | Higher demand is fulfilled from sufficient initial inventory. |
| Stockout | 1028.00 | 0.00 | 946232.88 | 0.00 | 260782.77 | 0.00 | 685450.11 | 0.00 | 169835.00 | 0.00 | 0.00 | -100.00% | intentional | Critical ingredients are unavailable and emergency buying is disabled. |
| Emergency procurement | 1028.00 | 740.00 | 946232.88 | 681140.40 | 260782.77 | 177881.20 | 685450.11 | 503259.20 | 672906.70 | 187.50 | 0.00 | -26.58% units | intentional | Emergency receipts increase fulfillment but use higher spot costs and immediate cash payment. |
| AP receipt | 740.00 | 740.00 | 681140.40 | 681140.40 | 174925.20 | 174925.20 | 506215.20 | 506215.20 | 672906.70 | 12441.50 | 9298.00 | 0.00% | yes | Receipt creates inventory/AP first; COGS is recognized only as lots are consumed. |

## Long-run measurements

`tests/supply-long-run-test.js` records these deterministic stability totals:

| Scenario | Orders retained | Active lots | Inventory quantity | Inventory value | AP | Company cash | Save bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 store × 52 weeks | 77 | 8 | 6352.57 | 394599.87 | 0.00 | 1007865530.63 | 780366 |
| 10 stores × 52 weeks | 740 | 54 | 18719.87 | 1153996.28 | 0.00 | 927234915.88 | 3316848 |
| 50 stores × 52 weeks | 3777 | 379 | 27047.35 | 1835313.16 | 0.00 | 290251073.13 | 6115686 |
| 10 stores × 520 weeks | 753 | 58 | 13273.89 | 835399.78 | 0.00 | -3219837.54 | 4460353 |
