# Supply Finance Reconciliation

Phase 1C uses the same accounting path for normal receipts, emergency receipts, AP settlement, sales consumption, and spoilage.  Receipts increase physical lots and `finance.balances.inventory`; AP receipts also increase `finance.balances.accountsPayable`.  Sales consume FIFO/expiry-priority lot book value and recognize `costOfSales` with `inventoryAmount < 0` and no second cash payment.

## Fixed AP scenario from `tests/supply-calibration-test.js`

| Metric | Amount |
|---|---:|
| Beginning cash | 100000000.00 |
| Beginning inventory quantity | 100.00 noodles ordered/received before the week |
| Beginning inventory book value | 9200.00 |
| Order amount | 9298.00 |
| Receipt amount | 9298.00 |
| AP increase | 9298.00 |
| AP payment | 0.00 |
| Material consumption amount | 174925.20 |
| Cost of sales | 174925.20 |
| Spoilage loss | 0.00 |
| Ending inventory book value | 12441.50 |
| Ending AP | 9298.00 |
| Operating cash delta in scenario | 672906.70 |
| Ending cash delta from scenario start | 672906.70 |
| Supply validation | ok |
| Physical inventory vs BS inventory | matched within cent rounding tolerance |
| Unpaid receipts vs AP | matched |

## Reconciliation rules

- v5 migration uses an opening-balance adjustment, not a future payable, for deterministic starting inventory.
- New stores receive inventory only through formal initial procurement orders.
- Emergency procurement creates one purchase order, one receipt, one cash payment event, one inventory increase, and then normal sales consumption.
- Partial receipts recognize only the received quantity/value; the remainder is delivered on the next arrival unless the finite retry cap fails the order.
- Settled paid purchase orders are compacted after the traceability window while open/unpaid orders remain available for AP validation.
