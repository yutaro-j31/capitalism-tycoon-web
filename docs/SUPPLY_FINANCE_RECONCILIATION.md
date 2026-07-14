# Supply Finance Reconciliation

Phase 1C uses one accounting path for normal receipts, fallback-supplier receipts, emergency receipts, AP settlement, sales consumption, and spoilage. Receipts increase physical lots and `finance.balances.inventory`; AP receipts also increase `finance.balances.accountsPayable`. Sales consume FIFO/expiry-priority lot book value and recognize `costOfSales` with `inventoryAmount < 0` and no second cash payment.

## Fixed AP scenario from `tests/supply-calibration-test.js`

| Metric | Amount |
|---|---:|
| Beginning cash | 100000000.00 |
| Beginning inventory quantity | 100.00 noodles ordered/received before the week |
| Beginning inventory book value | 10713.00 |
| Order amount | 10713.00 |
| Receipt amount | 10713.00 |
| AP increase | 10713.00 |
| AP payment | 0.00 |
| Material consumption amount | 201455.60 |
| Cost of sales | 201455.60 |
| Spoilage loss | 0.00 |
| Ending inventory book value | 14334.94 |
| Ending AP | 10713.00 |
| Operating cash delta in scenario | 645897.86 |
| Ending cash delta from scenario start | 645897.86 |
| Supply validation | ok |
| Finance validation | ok in long-run accounting test |
| Physical inventory vs BS inventory | matched within cent rounding tolerance |
| Unpaid receipts vs AP | matched |

## Reconciliation rules

- v5 migration uses an opening-balance adjustment, not a future payable, for deterministic starting inventory.
- New stores receive inventory only through formal initial procurement orders.
- If the preferred one-company supplier cannot provide a material, orders use `balanced_wholesale` first and then a deterministic active supplier that supports the material. The preferred supplier setting is not changed and no fallback contract fee is charged.
- Emergency procurement creates one purchase order, one receipt, one cash payment event, one inventory increase, and then normal sales consumption.
- Partial receipts recognize only the received quantity/value; the remainder is delivered on the next arrival unless the finite retry cap fails the order.
- Cancelled unreceived orders set `paymentStatus='cancelled'`; partially received cancelled orders retain payment obligations only for received value.
- Settled paid/cancelled/failed purchase orders are compacted after the traceability window while open/unpaid orders remain available for AP validation.
