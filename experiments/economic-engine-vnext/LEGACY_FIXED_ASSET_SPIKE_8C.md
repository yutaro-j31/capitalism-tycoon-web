# Economic Engine vNext — SPIKE-8C Source-Authenticated Fixed Asset Depreciation

**Owner:** regular ChatGPT. **Issue:** [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Parent:** Draft PR #1066 (SPIKE-8B physical lot source evidence) → Draft #1065 (SPIKE-8A 31 credit receipts). **Do not merge vNext into main.** Do not touch Phase 3/4 production work.

## Evidence entering SPIKE-8C

- SPIKE-8A #1065: authentic source-pinned 13-week disposable legacy simulation, **31 actual credit inventory receipts** rebooked in the real pure `core.cjs` canonical financial ledger and 107 other rows explicitly held.
- SPIKE-8B #1066: **360/360 actual Node 22 tests**, real 13-week inventory books **13/13 source weeks reconciled**, prior 31/107 proof still PASS; native release-readiness and ordinary CI **20 success, two expected skips** at exact SHA `41d0018bdb7e5c99712b70409542edbc5ef65397`.
- The original legacy source has **13 noncash depreciation rows** and a real `g.finance.fixedAssets` source table. Existing SPIKE-5 abstract `operating.cjs` proves the economic contract but **does not replay genuine existing-engine fixed-asset source and timing**.

## This implementation

We extended only the disposable game's **read-only** `legacy-13week-capture.cjs` source snapshot to copy these fixed-asset fields for the observed ramen store at the opening of week 5 (after week 4) and after each observed week 5–17:

`assetID`, `storeID`, `businessID`, `assetType`, `status`, `acquisitionWeek`, `acquisitionCost`, `salvageValue`, `usefulLifeWeeks`, `accumulatedDepreciation`, `bookValue`, and read-only lifecycle metadata.

The new `legacy-fixedasset-replay.cjs` first calls the existing **immutable 138-row source receipt SHA-256 checker**, **37-PO source lineage**, authentic company 31-credit `core.cjs` replay, and **13/13 physical lot inventory reconciliation**.

It then verifies that:
1. The observed opening fixed-asset book is **source-backed**, belongs to the selected store and has one unambiguous active asset; gross acquisition book = net book + historical accumulated depreciation. This **does not** establish original vendor or cash acquisition proof.
2. All 13 weekly real `depreciation` finance rows point to **the same source assetID** with exact operationID, sourceType, source store, signed noncash expense and asset reductions, and exact before/after book and accumulated depreciation evidence.
3. Every post-week source `fixedAssets` record matches the finance row; ownership identity, salvage value, useful life, acquisition week and cost do not silently change.
4. The **same canonical vNext core** holds all 31 original source credit inventory receipts plus 13 source depreciation entries. All postings are exact, balanced **within company**, immutable, collision-checked SHA-256 source-ID mapped, and contain **no artificial external entity or cash leg**.
5. The source opening fixed asset **net book value is recognized in an explicitly scoped accounting opening journal** (fixed asset debit / opening equity credit) before any depreciation. This offset is a scoped subledger opening convention, **not independent proof of company-wide equity or the original asset purchase**.

### Expected genuine source accounting

| Journal kind | Number | Economic meaning |
|---|---:|---|
| Source-backed opening fixed-asset net book | 1 | Scoped opening fixed-asset debit and offsetting opening-equity credit |
| Original authenticated credit inventory | 31 | Debit inventory and credit PO-specific company AP |
| Original authenticated depreciation | 13 | Debit depreciation expense and credit company source fixed asset |
| **Canonical core journal count** | **45** | Opening 1 + actual source rows 44 |
| **Original observed source rows still held** | **94** | All require further legal/financial source evidence |

The 13 real depreciation postings total **¥76,500.06** (7,650,006 units of ¥0.01), with no cash movements. The original 31 inventory/AP entries total **¥6,171,707.56**. The final real fixed-asset book will be validated against actual week-17 `finance.fixedAssets` in the new CI; no invented fixed-asset cost or salvage figure is used by the authenticated path.

`planAssetLedger(source, priorCreditProof)` is **only** `CONTRACT_ASSET_SIMULATION` because arbitrary caller inputs are untrusted. Only `runAuthenticated(observation)` can return `SOURCE_LEDGER_FIXED_ASSET_PARTIAL`, after all original authentic source, PO, physical stock and depreciation evidence passes.

## Safety & limitations

This is **not** full new-vs-old 138-row economic parity or a company balance sheet. Original asset purchase/cash payment is outside the observed window. External legal entity identities are not proven. The other 94 source rows (revenue, COGS, two cash inventory receipts, rent, payroll, maintenance, AP settlements) remain held. The disposable no-cash `audit-slot` account is a zero-balance technical schema sentinel, **not a supplier or fictitious economic party**. No IndexedDB durable storage, old-save conversion, complete M&A/PE/VC authority, or WebKit browser recovery claim.

This slice changes only `experiments/economic-engine-vnext/**`. No new workflow under implementation branch `.github/workflows/`: the repo's standard seven-workflow Release Readiness policy remains intact. A separate, **NEVER-MERGE** CI proof branch runs actual Node 22 and the genuine legacy simulation. Exact experimental blob SHA equality is required between that proof branch and implementation PR.

## Verification

```sh
node experiments/economic-engine-vnext/legacy-fixedasset-replay.test.cjs
node experiments/economic-engine-vnext/legacy-13week-headless.cjs > /tmp/real-13week.json
node experiments/economic-engine-vnext/legacy-fixedasset-replay-cli.cjs /tmp/real-13week.json > /tmp/fixedasset-core.json
node -e "const r=require('/tmp/fixedasset-core.json');if(r.status!=='SOURCE_LEDGER_FIXED_ASSET_PARTIAL'||r.postedSourceRows!==44||r.blockedSourceRows!==94||r.canonicalJournalCount!==45)process.exit(1)"
```

Existing source suite 360 plus **26 new** focused mock safety tests = **386 expected direct Node 22 tests** (subject to exact new SHA CI confirmation). Do not promote source-fetched V8 mocks as Node evidence.

### Next gate
1. Authenticate actual 13 fixed assets with real CI: 386 real Node 22, 13 real 13-week source rows, opening/closing asset book, intact 31 credit rows, no unproved cash.
2. If authentic asset source is missing or a legacy lifecycle disagrees, **EVIDENCE_BLOCKED**; fix only source-reader/test evidence, never silently fabricate opening balances.
3. Only after proof success consider source opening material inventories and material COGS integration in a separate SPIKE-8D; preserve all blocked origin/cash source exclusions.
