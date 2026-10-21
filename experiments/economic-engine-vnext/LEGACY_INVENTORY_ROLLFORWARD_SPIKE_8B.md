# Economic Engine vNext — SPIKE-8B Actual Physical Inventory Lot Rollforward

**Owner:** regular ChatGPT, [Issue #1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Parent:** SPIKE-8A Draft #1065 (real 31 credit receipts → canonical Ledger); implementation remains **Draft**, no main merge.

## Exact context
SPIKE-8A had its **336/336 real Node contracts PASS**, its real 13-week source-to-core replay job PASS and native 20/20 required/exposed CI checks PASS (plus two expected skips). Authenticated company-side noncash credit inventory receipts: 31/138. Other 107 source rows are individually blocked, rather than inventing external legal counterparties, pre-window AP or store-specific opening inventory.

The current game's `js/supply.js` stores material-lot assets at `g.inventoryByStoreID[storeId].materials[materialId].lots`. `consume()` decreases lot quantity and **lot bookValue** by rounded actual consumption cost; `spoil()` retires expired lots and emits a company-wide, noncash `otherOperating` finance transaction. Some such rows are outside the selected store's 138 receipt group. A category-only cash/profit bridge cannot prove the physical-material identity of 13 COGS rows.

## This slice

- The disposable, **read-only** `legacy-13week-capture.cjs` source snapshot is enriched with `lotID`, `materialID`, `purchaseOrderID`, bookValue, quantity, unitCost, week received, week of expiry and status (including consumed/expired).
- Source inventory snapshots include `inventoryScope`: store-specific and company-wide physical stock book valuations from genuine `inventoryByStoreID` sources. Unlike the earlier `financeInventoryJPY` figure, this distinguishes a selected ramen store from other stores.
- `legacy-13week-headless.cjs` emits the **11 source finance rows outside the store** as `nonStoreWeeklyRows`. The rollforward independently checks if any relevant `sourceType=spoilage` row decreases company inventory without cash.
- `legacy-inventory-rollforward.cjs` validates genuine observation via the **previous SHA-256-pinned source bridge and source PO graph**, then reads the actual lot/value snapshots (no artificial initial company book).
- Each source week must satisfy:

```text
opening selected-store physical book
+ real credit and cash inventory receipts
- real noncash store COGS
- attributable genuine nonstore spoilage
= closing selected-store physical book
```

The per-week stock delta is not automatically attributed to spoilage if the company owns multiple inventory stores. The validator keeps **SOURCE_STOCK_WEEK_BLOCKED** with an explicit reason in that case, or if physical inventory and company finance book differ by more than the existing production supply tolerance of ¥0.50. For week-by-week economic data, integer ¥0.01 units are used; any improperly rounded source money, lot ID duplicate, store mismatch, invalid expiry, altered PO/material ancestry, or noncash spoilage mismatch is rejected.

A full successful reader result is still only **`SOURCE_STOCK_EVIDENCE_PARTIAL`**; its `verifiedWeeks` and `blockedWeeks` counters must sum to 13. The CLI requires at least one truly explained stock week. An `EVIDENCE_BLOCKED` verdict means the source evidence is incomplete or malformed. Test mocks **cannot** bypass the authentic source graph to claim provenance.

**No new COGS entries are posted to vNext core in this slice.** Doing so would still require an authenticated store opening book and adequate source-ledger financing for the two cash inventory purchases, plus any prior share of AP, before extending the delta-only SPIKE-8A source journal. A physical inventory rollforward, even if all 13 weeks reconcile, is **not** a legal entity/financing parity proof.

## Runbook

```sh
node experiments/economic-engine-vnext/legacy-inventory-rollforward.test.cjs
node experiments/economic-engine-vnext/legacy-13week-headless.cjs > /tmp/legacy-13week.json
node experiments/economic-engine-vnext/legacy-week-bridge-cli.cjs /tmp/legacy-13week.json
node experiments/economic-engine-vnext/legacy-source-graph-cli.cjs /tmp/legacy-13week.json
node experiments/economic-engine-vnext/legacy-company-replay-cli.cjs /tmp/legacy-13week.json > /tmp/legacy-core-replay.json
node experiments/economic-engine-vnext/legacy-inventory-rollforward-cli.cjs /tmp/legacy-13week.json > /tmp/physical-stock-proof.json
```

The previous 336 core/economic/source contract tests plus 24 mock-snapshot tests yields **360 expected** direct Node tests on the final SPIKE-8B source. The preliminary 24 tests passed in source-fetched V8/CommonJS harness, **not actual Node** yet. A separate, **non-mergeable CI laboratory branch** must run actual Node 22, the disposable 13-week game and the lot rollforward, while the implementation PR keeps the repository's original seven workflow files.

## Limitations

Weekly source snapshots do not individually prove every intraperiod lot-consumption posting. Corporate finance can include other stores and historical stock. Supplier IDs are catalog IDs, not legal counterparties. Neither the 13 COGS source rows, the two emergency cash receipts nor 27 AP payments can be declared authentic multi-entity vNext Ledger postings solely from these data. No production save, IndexedDB atomic durability or WebKit migration has been tested.

## Next gate

1. Confirm final HEAD's **360 real Node contracts**, native CI and genuine **13-week physical inventory rollforward**; report exact verified/blocked weeks and material gaps.
2. Where weekly rollforward remains blocked, inspect actual lot/PO source identities and missing spoilage company attribution rather than relaxing validation.
3. Independently trace verified opening store lots and legal counterparties before any new COGS posting; no dummy suspense supplier.
4. Continue one SPIKE concern per stacked Draft PR with no mainline interference.
