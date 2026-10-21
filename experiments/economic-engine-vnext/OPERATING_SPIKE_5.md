# Economic Engine vNext — SPIKE-5 Fixed Assets, Depreciation, Rent and Maintenance

**Owner:** regular ChatGPT only, tracking [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Parent:** draft PR #1058 (inventory/AP); SPIKE-5 is stacked on that experiment, **not** on main.  
**Scope:** no production JS, no real SAVE_KEY, no save-v9 conversion, no IDB durable adapter or WebKit. This is an isolated financial proof.

## Why now

The actual legacy 13-week ramen observation executed on GitHub Actions and exposed source-backed fixed-asset depreciation, operating rent and maintenance, in addition to the prior inventory, accounts-payable and noncash COGS records. The experimental inventory/AP prototype passed **237/237** direct tests in Node.js 22 (PR #1058, exact head `4bc52fa1f9fd0b3d438a6ffd2ac1c84e7ae54d89`). **The ordinary release-readiness check was red because the isolated proof workflow brings the historical seven-workflow count to eight; this is not an economic-accounting failure.**

This slice models the remaining three observed operating categories using a **single** nested financial core `state.supply.unified.core`, which is also used by shares, store cash operations, inventories and supplier payables.

## Financial operations

| Operation | Company books | Other party | Cash movement |
|---|---|---|---|
| `acquire-equipment` | Debit fixed asset, credit cash | Vendor cash rises, vendor revenue rises | Cash paid on acquisition |
| `depreciate-equipment` | Debit depreciation expense, credit fixed asset | None | **No cash** |
| `pay-rent` | Debit rent expense, credit cash | Landlord cash and revenue rise | Cash paid |
| `pay-maintenance` | Debit maintenance expense, credit cash | Contractor cash and revenue rise | Cash paid |

All operations are **balanced by legal entity** and share the core operation ID, journal sequence and receipts. Financial amounts use signed safe integers in **¥0.01** units.

### Fixed asset provenance

- Equipment must be acquired before depreciation; each `(company,assetId)` is unique, with source purchase receipt, vendor, gross cost, residual value and useful-life weeks.
- Straight-line *prototype* schedule is exact integer allocation: the first `life-1` depreciation postings use `floor((gross-salvage)/life)`, and the last takes the entire remaining depreciable amount. This prevents floating rounding drift and depreciation below salvage.
- A source `depreciate-equipment` operation identifies asset and week. The amount is computed from the capitalized acquisition, not freely declared by the caller. Duplicate/out-of-order weekly depreciation and depreciation beyond useful life are rejected.
- `validateState` checks each receipt against the **exact canonical journal legs**, recomputes asset book values from source events, rejects forged fixed-asset postings, and delegates to both inventory/AP and unified equity validation.
- No separate authoritative financial asset-balance cache is introduced. The nonfinancial events are evidence; the **core balances/journal are the only financial authority**.

### Rent and maintenance provenance

Both use explicit store, week, payee entity, amount, stable receipt and exact balanced cash expense/payee revenue postings. A duplicate charge of the same type/store/week is rejected.

## Deliberate incompleteness

This is **not full legacy parity** and not a replacement for the real finance writer:
- Legacy fixed asset schedule, salvage, purchase cash timing, entity ownership and recognition may differ from this simple prototype. No source-matched asset acquisition fixture exists yet.
- Supplier/landlord/contractor are explicit separate legal entities, but actual game counterparties are not yet traced to legal entities in the legacy finance rows. Do not invent counterparties during any comparison.
- Rent is treated as a cash payment, not a prepaid/accrual lease, and maintenance is immediately expensed.
- Real legacy stock expiry, FIFO/weighted cost, revenue/credit timing, quarterly tax, depreciation asset class, sales tax, payroll withholding, accounts receivable, headquarters and subsidiary structure are not yet modeled.
- Core still offers a low-level trusted `journal` command; without domain-authorization boundaries this is **not anti-cheat or production authorization**.
- Persistence accepts a **synchronous mock callback**; a storage commit followed by throw may persist despite the caller returning failure. No durable IDB/save-v9 rollback claim.
- `store.storeSnapshot` remains a legacy synthetic **cash-basis** projection. Do NOT use its implied profit-equals-cash invariant for a full inventory/depreciation business. Use source-account accounting instead.

## Evidence

Direct focused tests:

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
node experiments/economic-engine-vnext/operating.test.cjs
```

SPIKE-5 adds **37** positive/negative source tests: acquisition/cash conservation, five-week straight line, end-of-life salvage, duplicate charge weeks, unavailable funds, missing assets, forged postings, storage admission false/throw, deterministic replay and coexistence with paid-in capital and inventory/AP. Previous parent 237 tested under actual Node; **this branch requires independent HEAD-specific direct Node proof**. Ordinary mainline release-readiness fails on the 8-workflow contract because experiment-only verification is intentionally isolated; do not modify mainline CI to accommodate it or merge the proof workflow into main.

## Next gate

1. Verify **274/274** direct Node test results and actual 13-week legacy observation job at exact SPIKE-5 HEAD.
2. Inspect mismatches between actual 13-week legacy depreciation/rent/maintenance source rows and new posting contracts, especially source asset acquisition and implicit game landlord/counterparty.
3. Produce full, source-matched 13-week **ledger replay**, not merely category classification, before considering any production cutover.
4. Run real browser persistence / fresh hydration / multi-tab rollback and large-scale deterministic stress in separate slices.
5. Remain owner-only regular ChatGPT; Claude Code/Work continue Phase 3/4 on their existing branches.

## CI normalization (2026-10-21 JST)

The isolated GitHub Actions proof workflow has been removed from this implementation branch. It remains only on the non-mergeable verification branch `experiment/economic-engine-vnext-po-provenance-ci-20261021`. The implementation branch retains the mainline seven-workflow contract; the latest-HEAD `release-readiness` check must be evaluated independently. Experimental direct Node proof on the verification branch is tracked separately and is not an automatic PASS on this PR's new SHA. See `ISOLATED_CI_RUNBOOK.md`. No runtime code, financial logic, saves, or mainline CI contract is changed by this documentation note.
