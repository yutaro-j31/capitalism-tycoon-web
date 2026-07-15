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

## Store close and spoilage follow-up

- 店舗閉鎖時は `disposeStoreSupply()` が閉店前の在庫簿価を算出し、available ロットを `writtenOff` として数量・簿価を0にしたうえで、在庫本体を削除し、小さな `closedStoreSupplyArchive` へ閉店週・数量・簿価だけを残します。
- 閉店在庫除却は `otherOperating` / `sourceType=closeStoreInventoryWriteoff` / `cashEffect=0` / `profitEffect=-bookValue` / `assetEffect=-bookValue` / `inventoryAmount=-bookValue` で1回だけ登録します。
- 廃棄損は週次 `expenses` と税引前利益へ反映し、会社現金計算では非現金費用として加算戻し、税金減少分だけ現金差が出る構造にしています。
- 未入庫注文は `cancelled/cancelled`、部分入庫済み注文は未入庫残だけキャンセルし、受領済み買掛金は支払週まで維持します。

## Merge-readiness reconciliation addendum: cash procurement budgets and store aggregation

- Immediate-cash procurement now reserves already-created, not-yet-received cash orders when evaluating the next order. The reserved amount is `remainingQuantity × unitCost` for ordered, delayed, partially received, and payment-blocked orders whose effective payment terms are immediate; `availableProcurementCash` is company cash minus this reservation.
- If immediate-cash receipt cannot be paid at arrival, the order is payment-blocked/delayed for a finite retry window and no inventory lot, cash movement, or finance event is created until cash is available.
- Spoilage is accumulated per store using per-store cost and quantity counters, while the company-wide finance event records the total once. Store A/B fixtures verify 10,000円 and 20,000円 store totals reconcile to one 30,000円 PL/BS inventory reduction with cashEffect 0.
- Business inventory aggregation for Phase 1C target businesses is rebuilt from current store inventories every aggregate pass. When the final ramen store closes, `inventoryByBusinessID.ramen` is zeroed and stale business supply results are reset, so no orphan store inventory remains in BS inventory.
