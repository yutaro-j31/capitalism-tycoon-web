# Economic Engine vNext — SPIKE-8F actual opening-lot, supplier-catalogue and consumption-authority audit

**Owner:** regular ChatGPT, [Issue #1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038). **Parent:** Draft PR #1069 (SPIKE-8E original cash/COGS funding source). All vNext PRs remain Draft, **NO main/Phase 3/4/production writer changes and NO merge**.

## Evidence entering this slice

#1069 at its initial verified SHA `3448c9aaff7b4ab4a17ff9e21e916c62ceb56010` had native Release Readiness **PASS** (20 success, 2 expected skips), and separate exact-experiment-file Node 22 **441/441 PASS** plus a genuine disposable 13-week original-game financing proof `SOURCE_COGS_FUNDING_DEPENDENCY_PARTIAL` PASS. Original 149 finance rows: 53 posted in the scoped vNext `core.cjs`, 96 held; 54 canonical journals include one scope-specific original fixed asset opening book. No new cash or COGS entries were authorized by this proof.

The unresolved material origins:
- physical stock on original game week 4 = **¥134.83**; the current vNext canonical core did not book its authenticated financial opening.
- two week-5 instant purchases = **¥263,513.17** paid by original company cash, but supplier `supplierID` denotes one of the legacy game's **five static supplier catalogue choices**, **NOT a verified separate vNext legal entity with its own account or bank cash**.
- original 13 COGS rows = **¥5,120,980.01**, reconciled in 13/13 physical material weeks, but the `js/supply.js` `consume()` operations do not expose a durable individual source-ID journal per lot.
- `recalcMaterial()` can merge physically comparable inventory lots, retaining only a survivor `lotID` and replacing the original `purchaseOrderID` with the literal `merged`. A later physical snapshot does not independently establish how each lot/PO contributed to each sale.
- `createDeterministicInitialLots()` uses the marker `purchaseOrderID='migration-v6'`, an accounting migration/source classification rather than a cash-paid external vendor. `applyOpeningInventoryAdjustment()` modifies legacy `openingAssets`, `openingEquity` and `openingRetainedEarnings`, but a single company opening book cannot be reclassified as an independently authenticated vNext legal-entity account without more complete lineage.

## Implementation

**No economic journal posting is added.** Extend *only* the disposable `legacy-13week-capture.cjs` source reader with:
- original lot `supplierContractID`, quality and any original PO alias (`po-N`, `migration-v6`, `merged` or missing).
- original PO `supplierContractID`, `isEmergency`, payment terms; this is **source catalogue metadata only**.
- original source `supplierContracts` table for the selected store, recording contract catalogue IDs, owner store and supplier catalogue identifiers, not legal entities.
- legacy `supplyMigrationV6Applied`, company original opening AP baseline and finance opening assets/equity/retained earnings as **read-only** observations.

New `legacy-lot-authority.cjs`:
1. `runAuthenticated()` first requires the original source SHA-256-pinned 138-row receipt/PO proof, old canonical 53-posting source ledger and the prior 13/13 verified material/COGS/financing proof. Direct mock-only `auditSource()` cannot report an authenticated conclusion.
2. Ingests actual original week-4 opening plus 13 closing weekly snapshots. Independently validates original per-store lot book sums versus finance and physical stock snapshot, rejects duplicates, negative/noncent books, material changes, unauthorized source PO replacements, source supplier catalogue or contract changes.
3. Classifies each opening stock lot into: directly visible PO, PO outside observation snapshot, migration-v6 accounting source, merged/lost PO ancestry, null origin or unknown PO marker. Does **not** promote any opening lot to a fully journal-authenticated vNext asset solely from this classification.
4. Links the **two original cash PO IDs** from the prior authentic financing source to actual original catalogue supplier and contract records (where available). A matching supplier contract is **not** a real legal counterparty or authenticated destination cash account. The result explicitly sets `legalEntityID:null` and `verifiedPaymentDestination:false`.
5. Reports each of the 13 weeks' added/retired/reused lotIDs and merged aliases, with exactly **zero individually authenticated COGS event IDs** (source is week-end physical snapshots, not per-lot consumption event journal). Preserves **53 source entries posted, 96 held**, **zero new cash purchases/COGS journal**.

Result status `SOURCE_LOT_AUTHORITY_GAPS_PARTIAL` is **evidence of identified authority gaps**, not parity. Bad or ambiguous source identities produce `EVIDENCE_BLOCKED`. The output cannot infer separate external legal supplier balances, historical company opening cash or a full opening BS, including because the existing game's supplier options are a static business catalogue rather than company/entity records.

## Safety and CI

- Exact diff includes **five** paths, all `experiments/economic-engine-vnext/**`: one existing source reader update, `legacy-lot-authority.cjs`, `legacy-lot-authority.test.cjs`, `legacy-lot-authority-cli.cjs`, this memo.
- New 30 focused mocked tests have passed in exact-source V8/CommonJS-compatible harness; **this does not prove actual Node crypto or original game source**, so real Node and genuine game proof must run separately.
- Previous actual Node 441 tests + 30 = **471 expected tests**. A distinct never-merge CI verification branch must execute Node 22 all test suites and real disposable 13-week game, matching all experiment source Git blob SHAs, while **implementation PR remains seven-workflow compliant**. Native Release Readiness also must PASS on the new exact PR HEAD.

### Run locally against a full checkout

```sh
node experiments/economic-engine-vnext/legacy-lot-authority.test.cjs
node experiments/economic-engine-vnext/legacy-13week-headless.cjs > /tmp/real-original-13week.json
node experiments/economic-engine-vnext/legacy-cogs-funding-cli.cjs /tmp/real-original-13week.json > /tmp/funding.json
node experiments/economic-engine-vnext/legacy-lot-authority-cli.cjs /tmp/real-original-13week.json > /tmp/source-authority.json
```

## Follow-on blocking work

Do not book original week-4 opening inventory in vNext merely to make net stock equal. Do not invent a cash clearing supplier or legal counterparty ID. Before promoting 13 real COGS and two original immediate purchases from BLOCKED into actual canonical legal-entity postings, we need original source-backed legal supplier ownership/payment account proof, per-lot consumption events or independent authenticated material consumption authority, and a complete authorized material opening balance. If the legacy model never tracked those identities, report this as a genuine **modeling boundary and required owner economic-design decision**, not a replay implementation bug. No full-game balance sheet, indexedDB durability, WebKit, old save or cutover was proved here.

## Takeover correction — 2026-10-22 JST

Starting implementation HEAD `e883dbf6981d64bb6ec01a36a2c5d472a32d9442`;
current main observed at takeover `ea79786498a7f37cb39d34be01f9ff9be8ee89ce`.
The starting PR HEAD had 20 successful native checks and two provider skips,
including successful Release Readiness. These results do not apply to later code.

Reproduced a source-audit false acceptance: changing an existing PO's
`supplierContractID` to null still returned `CONTRACT_ORIGIN_AUDIT_ONLY`.
The audit also compared lot identity only in adjacent snapshots, so a lot
removed from one snapshot could reappear with reassigned provenance.

The audit now checks PO contract, emergency classification and original order
week throughout the observation, and retains lot identity across missing
snapshots. Material, receipt week and supplier contract must remain stable;
PO lineage may only remain unchanged or become the explicit `merged` unknown
marker. An unchanged reappearance remains allowed. No quantities, economic
postings, cash counterparties or production code are changed.

Validation executed locally using **Node v24.19.0**:
- 38 lot-authority tests PASS, including seven reason-specific rejection
  regressions and one valid reappearance control (previously 30).
- All experimental suites: **479/479 PASS** (previously 471).
- Full disposable original-game 13-week capture and authenticated
  `legacy-lot-authority-cli.cjs` PASS. Before/after authenticated reports are
  byte-for-byte identical: 53 source rows posted, 96 held, no new COGS/cash
  journals. This verifies unchanged authentic observation output, not full parity.
- Local final diff whitespace validation PASS.

New final-HEAD native CI must be inspected separately. Historical Node 22 lab
results above are not a Node 22 execution claim for this correction. No separate
reviewer was used for this correction; local diff inspection is self-review.
