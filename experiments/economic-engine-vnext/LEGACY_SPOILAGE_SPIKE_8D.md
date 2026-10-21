# Economic Engine vNext — SPIKE-8D Authentic Company Noncash Inventory Spoilage Replay

**Owner:** regular ChatGPT only. **Tracker:** [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038). **Parent:** Draft SPIKE-8C [#1067](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1067), already stacked on earlier vNext Draft experiments. No main merge, no production writers or Phase3/4.

## Source proof at entry

At #1067 exact implementation HEAD `689103949ee2e8569b330df0fd8f2546d0240058`, standard CI **20 success / two expected skipped / zero failed**, including release-readiness; isolated identical-source actual Node 22 **386/386 PASS** and authentic disposable 13-week source-fixed-asset proof `SOURCE_LEDGER_FIXED_ASSET_PARTIAL` PASS. This built the same canonical core with 31 original credit inventory/AP receipts and 13 genuine noncash depreciation postings, plus one strictly scoped fixed-asset opening book. Source **44 of 138 selected-store rows** now replayed, 94 still blocked.

Separately, existing SPIKE-8B's actual source lot rollforward matched **13/13 weeks**. Current game's `js/supply.js` `spoil(g,finance)` records an **aggregated company-level** `otherOperating` noncash loss if material lots expire; this source row **does not carry storeID or a legal supplier**, even though the underlying physical lots are attributable to one store in this disposable scenario.

The genuine run reports **11 non-store finance rows** over the 13-week observation window, of which **9** are `sourceType='spoilage'` and **2** are other corporate financial rows. All nine spillage amounts coincide with a noncash inventory value reduction in the 13-week physical source rollforward. This is **company-owned material book consumption**, with no cash payment or new legal counterparty.

## Scope: one additional source-verifiable category

New `legacy-spoilage-replay.cjs`:
1. Demands already-authenticated **`SOURCE_LEDGER_FIXED_ASSET_PARTIAL`** from `legacy-fixedasset-replay.cjs`, plus **`SOURCE_STOCK_EVIDENCE_PARTIAL`** with 13/13 weeks passing, both using original 138-row SHA-pinned real legacy finance and actual purchase-order genealogy.
2. Consumes **all 11 real nonstore finance rows**, classifying **9 noncash spoilage** and **2 explicitly BLOCKED other financial rows**.
3. Requires the original, read-only game snapshots to show exactly **one inventory-owning store** both at opening and at the close of each 13-week period. Other stores or ambiguous ownership block, even if a company-wide spoilage amount matches; no fictional per-store allocation.
4. For each original expiry row, verifies exact source operation ID `week-<week>-spoilage`, source week, category `otherOperating`, empty selected-store attribution, per-week physical-lot valuation from the real stock proof, profit effect = asset effect = inventory effect = **negative amount**, zero cash, zero liability and zero PO payment.
5. Rebuilds one **time-ordered immutable canonical core** with the **existing** authenticated opening asset journal, **31** original credit supplier inventory receipts, **13** fixed-asset depreciation receipts and these **9** noncash inventory expiry rows. Source operation IDs are hashed to collision-checked `sp-<32hex>` canonical IDs. Each spoilage posts `company:expense:store-s2-spoilage +amountMinor` and `company:inventory:store-s2 -amountMinor`; opening asset and credit receipts remain source-identical. Validates the complete 54-journal ledger and nonnegative final company inventory; no external cash or payee is created.
6. Returns **`CONTRACT_STOCK_LOSS_SIMULATION`** from the mock planner. Only `runAuthenticated(realLegacyObservation)` may report **`SOURCE_LEDGER_STOCK_LOSS_PARTIAL`** after all source checks pass.

### Target outcome — still a partial accounting demonstration

| Source category | Original rows | Canonical core replays |
|---|---:|---:|
| Selected store credit inventory invoices | 31 | 31 |
| Selected store depreciation | 13 | 13 |
| Company-wide authenticated one-store spoilage | 9 | 9 |
| **Real source journal rows posted** | **53** | **53** |
| Scoped opening net fixed asset book | — | 1 journal |
| **Total canonical core journals** | — | **54** |
| Unverified selected store source rows | 94 | BLOCKED |
| Unverified other corporate source rows | 2 | BLOCKED |
| **Total observed original finance rows** | **149** | **53 posted / 96 held** |

Keep the separate source grouping transparent: the original selected-store 138 rows are still 44 posted / 94 held; **9 additional rows are company-level nonstore** source finance and do not retroactively count among the 138. This is not full source/legacy economic parity. The held **13 COGS**, **two immediate inventory purchases**, **27 AP settlements**, **13 revenues**, **39 rent/payroll/maintenance** and **2 corporate rows** require further source/legal/cash/account evidence.

The exact spoilage amount and post-spoil company inventory balance must be calculated from **genuine observed 13-week evidence**, not a hand-entered seller amount. Source cash is unchanged, and no supplier legal identity or opening per-store cost basis beyond the prior scoped proofs is invented.

## Verification

```sh
node experiments/economic-engine-vnext/legacy-spoilage-replay.test.cjs
node experiments/economic-engine-vnext/legacy-13week-headless.cjs > /tmp/legacy-real.json
node experiments/economic-engine-vnext/legacy-spoilage-replay-cli.cjs /tmp/legacy-real.json > /tmp/spoilage-proof.json
node -e "const r=require('/tmp/spoilage-proof.json');if(r.status!=='SOURCE_LEDGER_STOCK_LOSS_PARTIAL'||r.postedSourceRows!==53||r.heldSourceRows!==96||r.canonicalJournalCount!==54)process.exit(1)"
```

SPIKE-8C prior **386** actual Node cases + **27** new mocked contract cases → target **413** real Node 22 cases and an authenticated game-run proof. New mock suite passed exact GitHub source under a V8/CommonJS assertion-compatible harness, **not** real Node yet. Preserve tests/evidence on an independent non-mergeable CI laboratory branch, while the stacked implementation PR uses only **seven** ordinary workflows.

### Next gate

- Prove source-exact actual Node **413/413** and authentic `SOURCE_LEDGER_STOCK_LOSS_PARTIAL`, or return `EVIDENCE_BLOCKED` without weakening source attribution.
- Confirm 54 journal balances, 53 original source finance rows and 96 blocked source rows; validate no made-up cash or legal entities.
- Map what remains of 13 source COGS and two external immediate stock purchases, especially the **week-5 insufficient-funding dependency**: under the current core's legitimate cash-transaction policy, company-only inventory is not financially sourced for cash purchases. Do not satisfy this gap with an invented supplier suspense account.
- No production save migration, full legal-party parity, durable IndexedDB, WebKit or main cutover until independently authorized.
