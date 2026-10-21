# Economic Engine vNext — SPIKE-4 Inventory / Accounts Payable

**Owner:** regular ChatGPT alone. Tracker: [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Parent:** stacked experimental proof [PR #1054](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1054), which stacks on #1052→#1049→#1048→#1047→#1042→#1041→#1039.  
**Decision:** keep all work in the experimental branch. No main merge, no saveVersion=9 migration, no production writer changes, no Playwright/WebKit or durable IndexedDB claims.

## What the actual legacy 13-week run proved

At exact proof HEAD `710a6fda99f7d62e09685b8808bfb88cc4cd13a0`, GitHub Actions Node 22 ran the existing seven suites plus the real-category classifier: **199/199 PASS**. The disposable full legacy game executed trading weeks 5–17. Its real ramen store generated 138 category rows (five standard rows × 13, 33 procurement receipts, 27 AP payments and 13 depreciation records). The revised observation classifier returned **`UNSUPPORTED`**, not `EVIDENCE_BLOCKED`, for source-verified inventory/payment/depreciation.

That means this part of vNext is an unimplemented financial capability, **not** proof of a new production P0/P1. The real legacy source uses inventory capitalization, noncash consumption expense and sometimes deferred supplier settlement, unlike SPIKE-2's cash-expensed materials.

## New isolated financial adapter

`inventory-ap.cjs` wraps the same **SPIKE-3 unified core balances/journal**. Source events record operation ID, receipt sequence, store and order identity, but do **not** maintain a separate financial authority. Its `validateSupplyState` independently recalculates inventory and outstanding AP from that event history and verifies them against canonical ledger postings and receipt IDs.

| Operation | Company debits / credits | Supplier debits / credits | Cash effect |
|---|---|---|---|
| `receive-inventory-credit` | Inventory +; AP liability − | Receivable +; revenue − | None |
| `receive-inventory-cash` | Inventory +; cash − | Cash +; revenue − | Company cash − |
| `pay-inventory-ap` | AP liability +; cash − | Cash +; receivable − | Company cash − |
| `consume-inventory` | Cost of sales expense +; inventory − | None | None |

Every transaction records its postings and receipt in **one** `core.journal`. Money is in **integer 0.01-yen units**; accounting uses per-entity double-entry, no orphan inventory accounts, no unauthorized core journal touching inventory/AP, and exact integer checks.

### Example: credit purchase then consumption and partial payment

- Purchase: ¥50 inventory received on credit, company inventory +¥50, company payable +¥50, supplier receivable +¥50, **cash unchanged**.
- Consume: ¥25 transferred from inventory to COGS, **cash unchanged**.
- Pay supplier: ¥20, company cash −¥20 and AP declines from ¥50 to ¥30; supplier cash +¥20 and receivable declines equivalently.
- Remaining: inventory ¥25, AP ¥30, recognized material expense ¥25. Profit **does not equal** cash delta.

## Integrity and exclusions

- Enforces authorized store/order/company/supplier identities, PO-prefix, cash solvency, source event journal/receipt parity, per-order partial payment (no overpayment), nonnegative inventory, nonpositive AP, deterministic replay and immutable failed transaction admission.
- Share issuance and cash store-sales operations remain in the same unified ledger. This supply adapter does **not** replace the older cash-expensed `store.planStoreWeek`. To model inventory correctly, store-week material expense must be **zero** and consumption posted separately; a later dedicated true accrual store adapter is still needed.
- Does **not** implement purchase quantities and weighted-average inventory costing, FIFO, FIFO expiry/spoilage, purchase-order creation/status transitions, shipment arrival, invoice due dates, backorders, debt collection, depreciation, corporate tax, rent, or source-matched full legacy parity.
- Not a real durable storage protocol. `admitSupply(...,persist)` only stages immutable in-memory state and accepts a mock synchronous callback. It does not prove rollback after an IndexedDB write has already committed.
- The low-level `core.planOperation(type='journal')` is intentionally unsafe as a public economic API. **Only trusted domain adapters** should author journal postings when transitioning beyond prototypes.

## Checks and gate

```sh
node experiments/economic-engine-vnext/core.test.cjs
node experiments/economic-engine-vnext/equity.test.cjs
node experiments/economic-engine-vnext/store.test.cjs
node experiments/economic-engine-vnext/unified.test.cjs
node experiments/economic-engine-vnext/13-week.test.cjs
node experiments/economic-engine-vnext/legacy-crosswalk.test.cjs
node experiments/economic-engine-vnext/legacy-13week-capture.test.cjs
node experiments/economic-engine-vnext/legacy-observation-analysis.test.cjs
node experiments/economic-engine-vnext/inventory-ap.test.cjs
```

SPIKE-4 adds **38** focused tests. The parent's **199** tests passed actual Node 22, while new SPIKE-4 tests must be executed in exact-HEAD GitHub Actions before a direct Node PASS claim.

**Existing CI contract conflict:** `tests/workflow-path-filter-contract-test.js` demands exactly seven workflow files. The experimental branch intentionally has an eighth, `.github/workflows/vnext-isolated-proof.yml`, making normal `release-readiness` fail with **8 !== 7**. This is a test-only experiment branch and its workflow is **never to be merged into main**. No mainline CI contract modifications are authorized.

### Next task

After exact branch Node proofs, implement only the observed next missing financial categories (depreciation, rent and maintenance) as isolated source-backed events, then build a true 13-week production-event replay comparison. Do not declare production parity, WebKit/durability or Phase 3/4 cutover from this prototype.

## CI normalization (2026-10-21 JST)

The isolated GitHub Actions proof workflow has been removed from this implementation branch. It remains only on the non-mergeable verification branch `experiment/economic-engine-vnext-po-provenance-ci-20261021`. The implementation branch retains the mainline seven-workflow contract; the latest-HEAD `release-readiness` check must be evaluated independently. Experimental direct Node proof on the verification branch is tracked separately and is not an automatic PASS on this PR's new SHA. See `ISOLATED_CI_RUNBOOK.md`. No runtime code, financial logic, saves, or mainline CI contract is changed by this documentation note.
