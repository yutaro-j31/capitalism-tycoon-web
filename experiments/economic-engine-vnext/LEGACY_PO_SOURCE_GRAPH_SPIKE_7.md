# Economic Engine vNext — SPIKE-7 Purchase Order Source Graph / Opening Finance Evidence

**Owner:** regular ChatGPT only, tracker [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Parent:** stacked Draft [PR #1063](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1063) at `b2fbfbf6bbf13084783cd6af74d41260856089ec`, itself based on earlier SPIKEs.  
**Purpose:** read-only source lineage, **not** vNext financial/authority cutover, no production writer changes.

## Proof before this slice

The preceding #1063 exact HEAD ran **295/295 direct Node.js tests**. At least one genuine legacy 13-week execution successfully reported `SOURCE_ALIGNED_PARTIAL` with **138** store finance rows and their 13 weekly SHA-256 receipt digests matched; the ordinary `release-readiness` check is still red solely from the experimental eighth GitHub workflow file versus the current seven-workflow-file contract. Overall CI must therefore **not** be reported green.

Those real records have a key ambiguity: store finance `workingCapitalIncrease` events use a **compound** sourceID (e.g. `po-8-6326.95`) but AP payments use a **base** PO ID (e.g. `po-8`). Directly joining on exact sourceID makes the 27 AP settlement rows look untraceable.

## Exact current-game evidence contract

Read-only inspection of production `js/supply.js` at main:
- `createOrder`: creates `purchaseOrders` with `orderID=po-<sequence>`, `supplierID`, `materialID`, `receivedCost`, `paidAmount`, `orderWeek`, `paymentDueWeek`.
- `receiptAccounting`: records credit/cash inventory receipts with `sourceID=${po.orderID}-${po.receivedQuantity}` and `operationID=${po.orderID}-receipt-(ap|cash)-${po.receivedQuantity}`.
- `payables`: posts AP settlements with `sourceID=po.orderID` and `operationID=${po.orderID}-ap-pay-${g.week}`.

The new `legacy-13week-capture.cjs` copies the **actual source purchaseOrders** and opening accounting evidence at game week 4, plus the source purchaseOrders after each trade week 5–17. Captured source fields are limited to PO IDs, store, business, supplier catalogue ID, material, order/arrival/payment dates, gross receipts, paid amount and status. It also retains the pre-window company-level AP and inventory book values and store material-lot snapshots. No save files are imported or modified.

The new `legacy-source-graph.cjs` requires the complete parent **SOURCE_ALIGNED_PARTIAL** result, then checks all purchase receipts and AP payments against the corresponding actual source PO snapshots for that precise week. It prevents cross-store attribution, changed supplier catalogue ID, unmatched PO, duplicate/forged source operation ID, payment exceeding PO paidAmount, and receipt exceeding PO receivedCost.

### Known relationships from the original 138 finance rows

Based on finance row sourceID grammar alone, there are **37 distinct candidate base PO IDs** covering the 33 receipt rows and 27 AP payments: **22** POs have both an observed credit receipt and payment, **5** POs have payments but no receipt within the 13-week observation, **8** credit receipt POs have no payment within it, and **2** are cash emergency POs. These are **candidate** groupings from finance evidence; the exact new source-PO catalogue verification is a separate CI gate. Never falsely call the five payment-only POs unpaid or an accounting error: their original receipts can predate the observation window.

The first observed fixed-asset depreciation entry has pre-depreciation book value **¥1,682,346.14** and accumulated depreciation **¥17,653.86**. This is evidence of an existing fixed asset, **not proof of the earlier purchase price, cash settlement or external vendor**.

## Source and authority boundaries

**Actual `supplierID` is a catalog supplier identifier.** It is not a vetted legal-entity ID recognized by the vNext economic engine. The graph must not fabricate supplier bank balances, receipts, shareholders or counterparties.

Opening `finance.balances.inventory` and `supplyAccountsPayableBalance` are **company-wide**, not a fully attributed ramen-only opening subledger. The current state may also include purchase orders originally opened before the observed 13-week window. These sources are necessary but not sufficient to establish a store-specific monetary opening.

The collector is read-only (except advancing a disposable test game) and emits `sourceGraphEvidence` under the existing JSON artifact, without changing the parent source-pinned 138 receipt values or their SHA digests.

A genuine PO source-graph check may return:
- `SOURCE_GRAPH_PARTIAL` only if the 138 source receipts pass prior full source bridge verification **and** each observed PO receipt/payment traces to actual source PO snapshots with unchanged supplier/material IDs.
- `EVIDENCE_BLOCKED` if PO evidence is missing/ambiguous, overpaid, mismatched or contradicts the observed trade history.

Even `SOURCE_GRAPH_PARTIAL` is **NOT a real vNext legal entity journal replay**. The remaining explicit blockers include legal supplier counterparties, store attribution of opening AP/inventory, authenticated old fixed-asset acquisition and full corporate finance events outside the store scope.

## Tests / execution

```sh
node experiments/economic-engine-vnext/legacy-source-graph.test.cjs
node experiments/economic-engine-vnext/legacy-13week-headless.cjs > /tmp/vnext-legacy-observation.json
node experiments/economic-engine-vnext/legacy-week-bridge-cli.cjs /tmp/vnext-legacy-observation.json
node experiments/economic-engine-vnext/legacy-source-graph-cli.cjs /tmp/vnext-legacy-observation.json
```

This SPIKE adds **19** mocked source-graph tests. Parent **295** cases were actually Node-proven; exact new HEAD should run **314** cases and the true legacy source-graph check. The temporary experiment-only `.github/workflows/vnext-isolated-proof.yml` registers both jobs; do NOT merge it to main or modify the standard release-gate's workflow count to mask this experimental exception.

## Next task

After authentic source PO linkage succeeds, move to a separate domain proof: establish identifiable legal counterparties/clearing entities (or fail closed), reconstruct opening inventory/AP and fixed-asset acquisitions from authorized primary sources, and only then try the 138 event replay against vNext's single canonical ledger. Until then the verdict is partial, with no promise of production parity, v9 save compatibility, IDB atomicity or WebKit durability.

## CI normalization (2026-10-21 JST)

The isolated GitHub Actions proof workflow has been removed from this implementation branch. It remains only on the non-mergeable verification branch `experiment/economic-engine-vnext-po-provenance-ci-20261021`. The implementation branch retains the mainline seven-workflow contract; the latest-HEAD `release-readiness` check must be evaluated independently. Experimental direct Node proof on the verification branch is tracked separately and is not an automatic PASS on this PR's new SHA. See `ISOLATED_CI_RUNBOOK.md`. No runtime code, financial logic, saves, or mainline CI contract is changed by this documentation note.
