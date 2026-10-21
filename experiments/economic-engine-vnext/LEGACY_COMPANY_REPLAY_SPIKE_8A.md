# Economic Engine vNext — SPIKE-8A Authenticated Company-Side Ledger Replay

**Owner:** regular ChatGPT, tracker [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Parent:** stacked experimental Draft PR #1064 (SPIKE-7). **No merge into main** and no Work/Claude Code Phase 3/4 interference.

## Boundary and rationale

The preceding source-graph job proved `SOURCE_GRAPH_PARTIAL` for one disposable, deterministic, authentic 13-week legacy ramen store execution. It reported **138 store finance entries**, including **31 credit inventory receipts**, two emergency cash receipts, 27 AP payments, and 78 weekly operational entries (6 weekly categories ×13).

The company's real source journal receipts cannot all be posted into the original vNext core: `core.planOperation(type='journal')` requires evidence-backed legal entities on **both sides of external cash transactions**, and a conservative replay cannot invent suppliers, customers, landlords or employees. Store-specific opening inventory, old AP and historical equipment acquisition are also not independently authenticated.

**SPIKE-8A scope is deliberately narrow:** replay the 31 **noncash** credit inventory receipts into the actual `core.cjs` canonical ledger as company-internal double entries:

| Journal leg | Posting on authentic credit receipt |
|---|---|
| Company `inventory:store-s2` | Debit +invoiced amount |
| Company `payable:po-n` | Credit −invoiced amount |
| Company cash | **No movement** |
| Outside supplier | **No posting** (legal entity unverified) |

The replay reconciles to source **¥6,171,707.56** new in-window inventory and the same amount of newly booked company AP liability. This is **not** a fully allocated store balance at the end of the window: it excludes payments, pre-window AP, cash receipts and consumption.

The `core.createInitialState` requires at least two entities; a zero-balance `audit-slot` is used as an explicitly non-economic **schema sentinel**, with no journal postings or cash activity. It is **not** a real person/company/supplier or an invented counterparty. Company opening cash is also initialized to zero for this **delta-only proof**, not represented as the actual company cash balance; accounting totals and full financial balance sheets must not be claimed from it.

### Admission gate (no bypass)

`runAuthenticatedReplay(observation)` first calls `verifySourceGraph(observation)`, which transitively verifies the real original source SHA-256-pinned 13-week rows and their recorded purchase-order/receipt ancestry. The public test helper `planSourceRows(rows,graph)` is **untrusted** and returns only `CONTRACT_SIMULATION_ONLY`, never `SOURCE_LEDGER_PARTIAL`.

Each eligible receipt must match a source PO ID, the exact source operation ID and amount, `kind=credit`, game week, company/store identity, amount, inventory and liability accounting signs. To fit existing canonical core operation-ID constraints while retaining exact legacy IDs, each receipt gets a deterministic SHA-256 `leg-<32hex>` ID. Source-to-core linkage is stored in the read-only result. Duplicate receipt IDs, collisions, mismatched signs or core journal validation failure stop the entire replay.

**All 138 rows are classified exactly once:** 31 eligible/postable; 107 explicitly held. The held list records each original operation ID, source category, week, amount, and a granular evidence blocker.

Specific blockers for the 107 source operations:
- 13 revenue receipts: verified legal customer and external cash funding missing
- 13 COGS receipts: authentic store-specific opening inventory and lot consumption missing
- 13 rent, 13 payroll and 13 maintenance: verified external legal payees and funding missing
- 13 depreciation: pre-window fixed asset acquisition and store-specific legal ownership missing
- two emergency cash purchases: authenticated cash payee identity missing
- 27 AP payments: supplier legal identities and pre-window AP allocation missing

Do NOT post a 107-row fake netting suspense account, infer supplier legal identity from its catalog ID or state that partial journal entry replay is complete vNext parity.

## Current files

- `legacy-company-replay.cjs`: gated company-only source replay in real canonical core
- `legacy-company-replay.test.cjs`: 22 focused positive/negative mocked contract tests
- `legacy-company-replay-cli.cjs`: CLI that consumes a **real** source-headless JSON and fails closed
- `LEGACY_COMPANY_REPLAY_SPIKE_8A.md`: these contracts and exclusions

## Test commands — full checkout

```sh
node experiments/economic-engine-vnext/legacy-company-replay.test.cjs
node experiments/economic-engine-vnext/legacy-13week-headless.cjs > /tmp/vnext-real.json
node experiments/economic-engine-vnext/legacy-week-bridge-cli.cjs /tmp/vnext-real.json
node experiments/economic-engine-vnext/legacy-source-graph-cli.cjs /tmp/vnext-real.json
node experiments/economic-engine-vnext/legacy-company-replay-cli.cjs /tmp/vnext-real.json > /tmp/vnext-core-replay.json
node -e "const p=require('/tmp/vnext-core-replay.json');if(p.status!=='SOURCE_LEDGER_PARTIAL'||p.posted!==31||p.blocked!==107)process.exit(1)"
```

The prior SPIKE-7 source/test suite proved 314/314 actual Node PASS on verified source. SPIKE-8A adds 22 tests, for **336** expected direct Node cases. The initial contract tests were run against exact fetched GitHub source in a V8/CommonJS-compatible harness but **actual Node CI and actual source replay must be separately executed** before claiming success.

The implementation PR must remain within `experiments/economic-engine-vnext/` only. Run full Node/legacy proof using a separate non-mergeable CI verification branch: the mainline repository enforces exactly seven workflows and an eighth experimental workflow on an implementation PR would fail Release Readiness. Do not dilute that contract or merge a verification workflow into main.

## Next work

1. Exact SHA-specific Node 336 tests and authentic 13-week real source replay.
2. Trace the 107 blocked rows' counterparties/opening financial sources from authoritative primary legacy game evidence, without creating guessed cross-entity assets.
3. Extend only source-verifiable transaction types in separate slices (SPIKE-8B onward), recording source/provenance and both sides of cash postings.
4. Later prove full per-entity trial balance, standalone company balance sheet, durable IndexedDB rollback, old-save migration and WebKit compatibility before any cutover.
