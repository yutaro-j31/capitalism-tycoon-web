# Economic Engine vNext — SPIKE-8E authentic COGS and immediate-cash inventory financing dependencies

**Owner:** regular ChatGPT only. **Tracker:** [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038). **Stacked parent:** Draft #1068, authentic source-signed company spoilage. **No main/Phase3/4/production or save changes. Do not merge.**

## Confirmed source entry
- [#1068](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1068) at exact HEAD `5af45ed4b8b757b6e9b9feee54366e753800a953`: native PR standard CI **20 success / 2 expected skips / 0 failures**, including release-readiness PASS. Separate actual Node22 proof [run 39676168599](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/39676168599) succeeded on **413/413 direct Node tests** and a real disposable original-game 13-week Ledger run.
- Source-backed result `SOURCE_LEDGER_STOCK_LOSS_PARTIAL`: original source **149 finance rows total**, consisting of **138 selected-store rows and 11 other company rows**. Core has **53 source rows posted**: 31 noncash credit inventory receipts, 13 depreciation, nine company noncash inventory spoilage; **96 source rows explicitly held**, plus one genuine opening source fixed-asset book (total **54** canonical core journals).
- The original source is a seeded disposable game with a sole inventory store. Stock source windows weeks 5–17 already showed **13/13 physical material stock rollforward matches**; this must not be mistaken for a fully financed or legal-entity correct canonical vNext balance.

## The missing material financing that prevents source COGS postings

The existing-game finance source has **13 noncash cost-of-sales rows**, one each week, and **two immediate material receipts in week 5** with **cash outflow**. Source POs can identify a supplier **catalog ID** but cannot establish a verified legal trading entity, destination account, or the two independently authenticated cash legs required by `core.cjs`.

Authentic week-4 source physical inventory opening: **¥134.83** (13,483 units of ¥0.01). Authentic week-5 immediate inventory receipts together **¥263,513.17** (26,351,317 minor). Total absent from the currently posted partial core inventory is **¥263,648.00** (26,364,800 minor): two cash stock receipts plus old physically owned inventory. This is an identified source-financing **dependency**, not permission to mint opening company cash or outside vendor equity.

The exact original finance/physical identity (numbers are source-rooted, expressed as units of ¥0.01):

```text
opening stock                +        13,483
31 credit material receipts  +   617,170,756
2 immediate cash receipts    +    26,351,317
13 real noncash COGS         -   512,098,001
9 source spoilage costs      -    31,791,589
----------------------------------------------
physical week-17 inventory   =    99,645,966
```

**What is already posted in the core:**
```text
credit inventory only        +617,170,756
authenticated spoilage       - 31,791,589
partial core inventory       = 585,379,167 (¥5,853,791.67)
```

The difference between that scoped partial core inventory and week-17 physical inventory is **485,733,201 minor** (¥4,857,332.01), exactly **512,098,001 COGS – 26,364,800 missing financing/opening sources**. It is NOT an unidentified bank balance, extra payable, owed vendor, or suspense transaction.

## New actual-source proof — no extra core postings

`legacy-cogs-funding.cjs` requires:
1. The already successful genuine source SHA-pinned 138-row receipt/PO authentication and previous 53-row single core `SOURCE_LEDGER_STOCK_LOSS_PARTIAL` result. No mock can produce an authenticated status.
2. The existing 13/13 physical inventory source proof with a continuous week-by-week lot book, credit/cash receipts, observed original COGS expense, company spoilage amount, closing store book, and zero material value residual.
3. **Every original COGS row** must validate week, store, business, weekly operationID, category/sourceType, noncash signed expense and inventory reduction. One and only one original COGS row must appear each week.
4. The two source immediate-cash inventory finance receipts must match **actual purchase-order source ID, payment status classification, exact amount, material book increase, income neutrality, company cash reduction**, and not be falsely reclassified as a credit purchase.
5. All 31 prior original credit inventory receipts must be authenticated by week and purchase-order finance amount. The partial canonical core 54-journal proof must have zero external cash postings and unchanged 53/96 coverage.
6. The source physical rollforward must reconcile to 99,645,966 minor closing inventory; the delta to the current partial canonical inventory must **exactly equal** COGS minus the missing opening and immediate cash receipt sources.

Output `SOURCE_COGS_FUNDING_DEPENDENCY_PARTIAL` is a read-only **source-backed dependency graph**. All **13 COGS** and **two cash receipts** remain BLOCKED (within the previous 96 held source rows), individually listing their exact operation ID, week and missing funding/provenance. `CONTRACT_COGS_FUNDING_GRAPH_ONLY` is a mock-only result. **No new COGS or cash journal is posted. No fake supplier, suspense account, company opening cash or balance is introduced.** This is a deliberately accurate limitation, not stalled development.

## Files and tests

- `legacy-cogs-funding.cjs`: complete per-week PO/COGS/physical-stock dependency and source gap validator.
- `legacy-cogs-funding.test.cjs`: 28 mock contract and tamper tests; source-fetched V8/CommonJS compatible proof PASS, **not real Node yet**.
- `legacy-cogs-funding-cli.cjs`: consume actual disposable game observation; `EVIDENCE_BLOCKED` exits nonzero; require exact 13 COGS/two cash receipts and unchanged core posting count.
- `LEGACY_COGS_FUNDING_SPIKE_8E.md`: this source and nonclaims.

Target whole vNext direct Node tests: **413 parent + 28 new = 441**. Execute genuine Node22 441 and the seeded disposable original-game 13-week `legacy-cogs-funding-cli.cjs` in a **separate NEVER-MERGE verification workflow branch**, with all experiment Git blob SHA identical. Preserve the original mainline **seven-workflow** count on the Draft implementation PR and require its own native release-readiness PASS.

## Next safe concern
Only after this original source funding dependency proves should a follow-on SPIKE trace original historic opening company inventory/cash source and verified external supplier legal settlement evidence. Per-material lot receipts and per-week aggregate COGS are distinct from the individual lot-consumption event graph. **Do not add 13 source COGS to canonical Ledger or post the two cash purchases until authenticated legal counterparties and sufficient opening/consumption authority evidence exist.** No durable IDB/WebKit/old save or mainline cutover conclusions.
