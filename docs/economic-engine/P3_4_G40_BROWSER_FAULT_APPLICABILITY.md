# P3-4 G40 — browser fault-applicability matrix (read-only)

**Status: docs only.** No code or test change, no S_PASS, no activation. Authority stays `disabled`.

This is the READ_ONLY applicability matrix that G40 asks for in the
[P3-4 gap reconciliation](P3_4_GAP_RECONCILIATION.md). The source is the family-closure specification, #1091 FC-G40-01, at
[`8a05c2f6`](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/8a05c2f624a5356aeb0962e1d37a2d6f366efce2/docs/economic-engine/P3_4_FAMILY_CLOSURE_TEST_SPEC.md).

For the eleven writers it names, it records which shared fault tuples the existing real-WebKit tests already run, and which
tuples are missing. Per that specification, it does not reclassify tuples that are already tested, and it does not batch the
missing tuples into one executable change.

It was first read on `main` `eea44960` (2026-11-04) from each test's literal case list, not from comments or helper names.
It was re-read the same way on `main` `7ab463cc` (2026-11-05), after the per-writer follow-ups #1344–#1348. The
matrix below is that second reading.

## Method

- **Tuples.** The shared fault set is the nine `FAULT_KINDS`:
  - `save-false` (sf);
  - `save-before-throw` (sbt), a pre-admission throw;
  - `mirror`;
  - `enqueue-false` (eqf) and `enqueue-throw` (eqt);
  - `save-throw` (st), a post-admission throw;
  - `saved`, `change` and `notify`.

  On top of those come the pending-predecessor variants (`pending-*`) and the nested-transaction variants (`nested-*`).
- **Obligations.**
  - **S** (rejected-save or throw rollback) and **L** (durable reload): every file listed below asserts both for each case it
    runs. Each case reloads the page, then boots a fresh context from the exported real IndexedDB, with `localStorage`
    cleared, and compares the economic view.
  - **W** (real WebKit): every file runs in iPhone WebKit in an existing workflow job.
  - **R** (replay) and **D** (determinism): this pass does not map them case by case. They stay with each writer's Node suite.
- **Applicability.** `notify` applies only when the writer emits a notice. Every writer below runs inside `runTransaction`, so
  sbt, eqt, pending and nested always apply.

## Matrix

| Writer | Real-WebKit test | Shared kinds run | Pending | Nested | Missing tuples (GAP) |
| --- | --- | --- | --- | --- | --- |
| `stockSplit` | `stock-split-save-atomicity-webkit-test.js` | all 9 | sf, st, saved, change | sf, change, notify | — |
| `declineInboundBuyoutOffer` | `decline-buyout-ownership-save-atomicity-webkit-test.js` (hostile, friendly) | all 9 (`notify` post-commit) | sf, st, change | sf, st | — (#1344; also a disabled-rollback control) |
| `investStartup` | `vc-initial-investment-save-atomicity-webkit-test.js` (accounts) | all 9 | sf, st, saved, change | sf, st, change | — (#1345) |
| `participateStartupFundingRound` | `vc-follow-on-save-atomicity-webkit-test.js` | all 9 | sf, st, saved, change | sf, st, change | — (#1345) |
| `sellStartupSecondary` | `vc-secondary-sale-save-atomicity-webkit-test.js` | all 9 | sf, st, saved, change | sf, st, change | — (#1345) |
| `makeSubsidiary` | `make-subsidiary-save-atomicity-webkit-test.js` | all 9 | sf, st, change | sf, st | — (#1348) |
| `executeGroupRestructuringSale` | `group-restructuring-sale-save-atomicity-webkit-test.js` (variants) | all 8 applicable (`notify` N/A: the sale posts no notice) | sf, st | sf, st | — (also has a disabled-rollback control) |
| `sellMASubsidiary` | `ma-subsidiary-sale-save-atomicity-webkit-test.js` | all 9 | sf, st, change | sf, st | — (#1348) |
| `createPEDeal` | `pe-create-deal-save-atomicity-webkit-test.js` (company, personal) | all 9 | sf, st, change | sf, st | — (#1346) |
| `exitPEDeal` | `pe-exit-deal-save-atomicity-webkit-test.js` (company, personal, premium) | all 9 | sf, st, change | sf, st | — (#1346) |
| `createAngelInvestment` (and its exit) | `angel-investment-save-atomicity-webkit-test.js` (create, exit) | all 9 | sf, st, change | sf, st | — (#1347) |

Only `stockSplit` and `declineInboundBuyoutOffer` are player-common writers. The other nine only have to stay isolated before
activation, as #1091 §1 records.

## Result

All eleven writers now run the shared set that applies to them in real iPhone WebKit. That covers the pre-admission throw,
a pending save-throw, and nested save-false and save-throw. Each writer's tuples were added by its own test-only PR:

| PR | Writers | Tuples added |
| --- | --- | --- |
| #1344 | `declineInboundBuyoutOffer` | sbt, pending st, nested sf/st |
| #1345 | the three VC writers | sbt, nested sf/st |
| #1346 | `createPEDeal`, `exitPEDeal` | sbt, pending st, nested sf/st |
| #1347 | `createAngelInvestment` | sbt, pending st, nested sf/st |
| #1348 | `makeSubsidiary`, `sellMASubsidiary` | sbt, pending st, nested sf/st; `sellMASubsidiary` also gained eqt |

The first reading (on `eea44960`) found a gap in nine writers. `stockSplit` and `executeGroupRestructuringSale` were
already complete.

Each PR passed its workflow job on its exact head, and each case reports a per-case PASS line in that job's log.

## Limits

This matrix:

- reads cases and does not execute them (execution evidence is the CI job of each follow-up PR);
- does not grant S_PASS;
- maps R and D only to the Node suites;
- does not claim physical-iPhone evidence.
