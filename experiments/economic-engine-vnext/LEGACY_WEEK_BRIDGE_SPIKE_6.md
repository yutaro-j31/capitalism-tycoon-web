# Economic Engine vNext — SPIKE-6 Real Legacy 13-Week Cash / Earnings / Working-Capital Bridge

**Exclusive owner:** regular ChatGPT. Tracker: [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Parent:** draft PR #1059 (fixed assets, depreciation, rent, maintenance), stacked on #1058 and all earlier vNext drafts.  
**Boundary:** independent proof only. Never import into production, migrate saveVersion=9, alter Phase 3/4, or merge this experimental workflow to `main`.

## Original non-synthetic evidence

Source: actual disposable Capitalism Tycoon legacy engine via GitHub Actions **run 39487385359**, artifact **12294856090**, file `legacy-observation.json`; original GitHub execution SHA `647624e02f8203039f8ae4a217565a6858574430`, Node **22.23.3**. Original JSON SHA-256 (raw bytes): `b7fd7eba86a32058522eb5ca9f9895c986526cc466eb8371a4c0f464e6227d3d`.

Seed `1947271169`, host RNG seed `74100`. Observed entity is legacy store `store-s2`, business `ramen`, game weeks **5–17**. This is a newly generated disposable test game, **not a user's actual save**.

Reference matrix in `fixtures/legacy-real-13week-summary.json` is transcribed from those 138 authentic posted finance rows, with per-week amounts in **integer 0.01 yen units**. The raw historical artifact may expire after 7 days; the source pin and a committed compact reference permit later determinism checks on a fresh run. The reference records cash and accounting amounts, not a complete legal entity cap table or all corporate accounts.

### Real observed 13-week reconciliation

| Observation | JPY |
|---|---:|
| Selected ramen-store revenue | 15,774,609.00 |
| Store accounting profit | 5,258,604.93 |
| Store-linked cash change | +5,222,674.68 |
| Store inventory book movement (receipts − COGS) | +1,314,240.72 |
| Supplier AP liability movement (credit receipt − cash payment) | +1,201,810.41 |
| Noncash depreciation | 76,500.06 |
| Whole-company cash movement including non-store entries | +4,047,262.72 |

`storeCashChange - storeProfit = -inventoryMovement + payableMovement + noncashDepreciation`:

```text
-35,930.25 = -1,314,240.72 + 1,201,810.41 + 76,500.06
```

The *difference* between store-linked cash and total company cash includes **11 separate non-store finance rows**. It must not be silently attributed to ramen. The 13-week transaction count is **138 store rows**: 13 each for revenue, costOfSales, rent, payroll, maintenance, depreciation; plus 33 inventory receipt rows (31 credit / 2 cash) and 27 AP settlement rows.

## Implementation: fail-closed read-only source bridge

- `legacy-week-bridge.cjs` maps **each actual legacy source row** into a recognized economic meaning and verifies store identity, week, operation ID, idempotency key, finance category, source type, signed cash, signed profit, inventory, liability, AP, depreciation book-before/after and accumulated-depreciation evidence.
- Then **per week** compare count and **exact cent-precision total amount** in all nine mapped categories to the pinned, independently observed reference; confirm per-week cash, profit and the accrual bridge. It rejects missing, duplicated, reattributed, invented, unrecognized or changed transaction values.
- `legacy-week-bridge-cli.cjs` is run *immediately after* a genuine 13-week legacy observation in the same isolated GitHub Actions job. The verifier prints a machine-readable bridge result; unexpected differences fail the **CI job**, and source evidence remains in a short-lived workflow artifact.
- `legacy-week-bridge.test.cjs` generates **synthetic record-shaped replicas** of the independently pinned week/category reference. These test only detector behavior: exact positive path, cents tampering, missing rows, misattributed stores, inconsistent noncash COGS, AP liability mismatch, depreciation asset provenance, and duplicate operation IDs. **A synthetic test PASS is not the authentic-game run.**

### Carefully constrained success verdict

A successful authentic run returns **`SOURCE_ALIGNED_PARTIAL`**, **not `FULL_PARITY`**.

The vNext SPIKE-3/4/5 prototype itself **has not replayed each authentic legacy transaction into canonical company/supplier/employee/landlord financial entities**. Legacy finance rows do not prove all external counterparty legal IDs; opening inventory, pre-window payables and asset purchase acquisition receipts have not been authenticated to the same 13-week cut. Inventing counterparties, pretend balances, or an initial state and then calling the result "numeric parity" would be wrong.

**Six explicit blockers remain:** unknown legal counterparties; non-authenticated opening inventory/AP; no actual vNext transaction-by-transaction application; eleven non-store corporate finance rows outside scope; asset acquisition outside source window; real durable storage not tested. Real browser/IndexedDB recovery, tax, saved-state migration and scale are likewise unproven.

## Verification and CI policy

Prior source #1059 successfully ran **274/274 direct Node 22 tests** and its legacy observer job. This SPIKE adds **19** new source-bridge detector tests for a total of **293** tests (subject to actual new HEAD proof).

The separate experiment-only workflow is necessarily located in `.github/workflows` and is the eighth workflow file, while the current mainline `tests/workflow-path-filter-contract-test.js` requires exactly seven. Thus this experiment-only draft can show a **known `release-readiness` failure (`8 !== 7`)** even when its direct Node proof and real observation bridge pass. Do not modify the production CI contract or merge an experiment-only workflow into main. Do not claim the whole PR CI is green.

## Next integration gate

1. Run actual Node **293/293** on the exact new SHA and execute disposable real legacy 13-week runtime followed by the authentic source-pinned bridge. Collect the `SOURCE_ALIGNED_PARTIAL` result.
2. Produce an independently authorized read-only **counterparty/PO/source graph**, including pre-window opening finance and fixed-asset acquisitions. Explicitly show any missing ownership and cash claim links.
3. Only then build a new vNext *transaction-by-transaction* economic journal replay that agrees with that source graph. Keep unprovable rows `BLOCKED`; never fabricate legal entity relationships.
4. Prove real IndexedDB commit/recovery, post-write rollback, WebKit fresh hydration and old-save compatibility in later isolated PRs.
