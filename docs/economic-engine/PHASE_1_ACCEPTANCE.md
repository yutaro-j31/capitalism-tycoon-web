# Phase 1 Acceptance / Exit Review

**Program:** Economic Engine  
**Phase:** Phase 1 — Entity-aware Operation / Ledger Foundation  
**Status:** COMPLETE — formally exited on the verified P1-5 main baseline
**Phase 1 exit main:** `1a14987e14b10b0cf9d5da2f3a75e002b7b5a43d`
**P1-5 base main:** `deea67049953375d10995a49e60d1fcd58cf09a3`

## 1. Phase 1 objective

Phase 1 establishes a safe migration foundation for an entity-aware Economic Engine without performing a broad accounting rewrite.

The completed Phase 1 slices are:

- **P1-0** — approval/status synchronization
- **P1-1** — EconomicOperation / EconomicPosting contract primitives
- **P1-2** — read-only entity-aware legacy adapters
- **P1-3** — bounded shadow operation journal and replay evidence
- **P1-4** — first limited authoritative cutover
- **P1-5** — permanent Phase 1 acceptance gate and exit review

## 2. Authoritative scope at Phase 1 exit

Exactly one EconomicOperation family is authoritatively cut over:

`company:store-renovation`

For that family:

- `economic-settlement.js::settleStoreRenovation` is the authoritative company-cash writer;
- the legacy store action no longer writes `companyCash` directly;
- the existing finance transaction is a projection / persisted replay receipt;
- operation identity is deterministic;
- mutation + projection commit atomically through the production transaction boundary.

No second EconomicOperation settlement family is authorized by Phase 1.

## 3. Phase 1 read-only scope

The Economic Core may read/project current authoritative facts for:

- company cash and debt
- founder/personal cash and debt
- listed-stock holdings
- company debt instruments
- founder loan receivables
- founder beneficial ownership / own-company share deduplication

These are reconciliation/read-model capabilities unless explicitly cut over above.

## 4. Domains that remain legacy-authoritative

Phase 1 does **not** migrate authoritative settlement for:

- company debt lifecycle
- personal debt
- personal cash actions
- company equity issuance / buybacks / dividends
- general stock-market settlement
- M&A settlement
- subsidiary cash
- PE fund cash
- PE portfolio-company cash
- VC settlement
- real-estate settlement
- property vehicles
- weekly operating settlement
- payroll
- supplier/procurement cash
- equipment upgrades
- tax settlement
- consolidated accounting eliminations

Later phases must use separate cutover contracts and may not infer authorization from Phase 1.

## 5. Replay / idempotency state

Phase 1 provides:

- deterministic operation IDs/order
- operation/posting validation
- duplicate operation/idempotency rejection
- bounded shadow operation/posting retention
- deterministic compaction checkpoint
- exact replay receipts for a declared retention window
- fail-closed capacity behavior
- JSON roundtrip replay evidence

The P1-3 journal remains shadow-only and is not added to the production save root in Phase 1.

For the P1-4 store-renovation cutover, the existing persisted finance projection acts as the transitional replay receipt.

## 6. Atomicity and rollback

Phase 1 acceptance requires:

- failed transaction leaves authoritative economic state unchanged;
- idempotent replay does not settle twice;
- store-renovation projection failure rolls back cash, store condition, and finance state;
- unsupported posting shape cannot mutate company cash;
- the limited cutover has exactly one authoritative writer.

## 7. Persistence compatibility

Phase 1 preserves:

- `SAVE_KEY = capitalism_tycoon_web_v1`
- effective `saveVersion = 9`
- compatibility with existing production saves
- no required persisted Economic Core ledger/journal root
- deterministic production RNG state
- existing iPhone Safari protections

## 8. Permanent regression gates

Phase 1 exit depends on both:

### Existing Phase 0.5 gate

- seed diversity
- path diversity
- nuisance invariance
- replay
- calibration classification
- weekly phase order
- authoritative writer inventory
- economic invariants

### Phase 1 gate

- `P1_OPERATION_CONTRACT`
- `P1_READ_ONLY_RECONCILIATION`
- `P1_SHADOW_REPLAY`
- `P1_ATOMICITY_IDEMPOTENCY_ROLLBACK`
- `P1_SINGLE_WRITER_CUTOVER`
- `P1_LATER_DOMAINS_READ_ONLY`
- `P1_SAVE_COMPATIBILITY`
- `P1_PHASE0_5_REGRESSION`

A later phase must keep these gates green unless an owner-approved migration explicitly replaces a contract.

## 9. Exit decision rule

Phase 1 may be marked complete only when:

1. P1-5 PR is merged;
2. latest-main canonical Test workflow is green;
3. latest-main Strategy Balance workflow is green;
4. iPhone Acceptance Playthrough is green;
5. Phase 0.5 Acceptance Smoke is green;
6. Phase 1 acceptance gate is green;
7. tracker #870 is updated and closed.

These conditions were satisfied at the Phase 1 exit main above. The former
ACCEPTANCE CANDIDATE header and unchecked P1-5 tracker items were stale
bookkeeping, as confirmed by the owner on 2026-10-07. This update records that
completion and does not change any design, contract or acceptance criterion.

### Verified exit evidence

- [P1-5 PR #887](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/887) merged as the exit SHA above; it committed the permanent acceptance gate and this exit review.
- [Test run 37551914509](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/37551914509): success at that exact SHA. All twelve canonical shards passed, including shard G, which registers `phase1-acceptance-gate-test.js`. All eight Phase 1 gates passed.
- The same Test run records successful **Phase 0.5 Acceptance Smoke**, **iPhone Acceptance Playthrough** and **iPhone WebKit Smoke** jobs. Optional event-filtered jobs were skipped; they are not counted as successful evidence.
- [Strategy Balance run 37551914451](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/37551914451): success at that exact exit SHA.
- [Tracker #870](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/870) is closed as completed; its P1-5 checklist is synchronized to the evidence above.
- Exact historical exit checkout rerun on 2026-10-07: `node scripts/phase1-acceptance.js` — all eight gates PASS.
- [Phase 2 tracker #890](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/890) records: Phase 1 formally exited on latest-main `1a14987e14b10b0cf9d5da2f3a75e002b7b5a43d`.

Historical completion does not imply that later main commits are CI-green.
Each later task must verify its own current baseline.

## 10. Next phase boundary

Phase 2 may begin from a refreshed latest main only after Phase 1 is closed.

Phase 2 must not interpret the existence of EconomicOperation, shadow journal, or one store-renovation cutover as permission for a broad writer migration.

Each new authoritative family requires an explicit single-writer cutover contract, parity evidence, rollback/idempotency coverage, and save-compatibility review.
