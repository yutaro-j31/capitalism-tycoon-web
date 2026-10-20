# Track B / B2 — Company cash + ledger commit boundary

**Status:** first local introduction (store renovation only).
**Owner decision:** 2026-10-20 hybrid modernization, Track B step B2. The decision approves designing a shared cash/ledger API and introducing it into one representative writer, with proof of equivalence. It does not approve bulk replacement.

## Problem

- Company cash is written directly at about 156 sites. Each site must also remember to call `finance.event()` with a matching `cashEffect`.
- Nothing checks that the two agree. #978, the #865 candidate and #971 come from this gap.
- B1 (`tests/cash-writer-ratchet-test.js`) stops the number of sites from growing.
- B2 adds the boundary that migrated writers use instead.

## Contract

```js
economicSettlement.commitCompanyCashOperation(state, operation, settle, project) -> receipt
```

| Step | Check | On failure |
|---|---|---|
| Admit | `operation.operationType` is a registered cut-over family, and the family validator accepts its postings | throw |
| Admit once | no existing finance row has the same `operationID` or `idempotencyKey` | throw, before any cash moves |
| Settle | `settle()` is the family's own authoritative writer. Its receipt must carry the same operation identity, `companyCashBefore` must equal the observed cash, and the resulting cash must equal `before ± cash posting` | throw |
| Project | `project(receipt)` records the finance row. The row must carry the operation identity, its `cashEffect` must equal the settled cash delta, and company cash must not change during projection | throw |
| Return | frozen settlement receipt plus `transactionID` | — |

- The boundary never writes company cash and never calls `finance.event()` itself.
- The caller runs it inside `TycoonEngine.runTransaction()`, so any throw rolls back cash, domain state, finance and the save together.
- No RNG, wall clock or new persisted root is involved. `SAVE_KEY` and `saveVersion=9` are unchanged.

## Why the steps are callbacks

The Phase 1 permanent acceptance gates pin the store renovation cut-over shape:

- `settleStoreRenovation` must be the only `settle*` function in `js/economic-settlement.js`.
- `renovate()` itself must call `economicSettlement.settleStoreRenovation(` and `finance.event(` with the operation's `operationID` and `idempotencyKey`.
- The settlement module must not contain finance tokens or personal-cash tokens.

Passing the family's settlement and projection as callbacks keeps every one of those gates and the writer inventory unchanged, while still checking cash against the ledger in one place.

## First introduction: store renovation

- `store-equipment.js::renovate` now commits through the boundary.
- Domain state (`store.condition`) is still owned by the store module and is set after the commit, inside the same transaction.
- Equivalence evidence, local Node 22, before and after on main `8de12935`:
  - Seeds 11, 12 and 13 hash identically.
  - Each run uses fractional opening cash, renovation, a duplicate attempt, a week advance and a second renovation.
  - Hash `32c44641…a6f81e`, excluding the wall-clock `lastSaveDate`.
- `tests/economic-settlement-company-cash-commit-test.js` covers:
  - the happy path, and duplicate admission;
  - unsupported type, missing callbacks and a mismatched settlement receipt;
  - settled cash that does not match the postings, and a mismatched projected `cashEffect`;
  - missing or foreign projection identity, and cash changed during projection;
  - an in-transaction rollback of state and save followed by a single-commit retry;
  - determinism.

## Next families (not in this change)

Each later family is a separate PR. A family is added in three steps:

1. Add an operation builder and a family validator.
2. Register the validator in `COMPANY_CASH_FAMILIES`.
3. Replace the writer's direct `companyCash` mutation with `commitCompanyCashOperation(…)`, and lower the B1 ratchet baseline in the same PR.

Moving a new family's authoritative cash write into `economic-settlement.js` changes the Phase 1 gate expectations (`settleFunctions`, exact authority, the declared writer inventory). Those are permanent acceptance contracts. Each such update must be an explicit, reviewed change that adds the new family exactly; existing assertions are never relaxed.

The proposed next candidate is the store equipment upgrade (`store-equipment.js::upgrade`):

- It is named as a P1-4 non-goal.
- It already has a deterministic `operationID`.
- Its posting shape is `asset:fixed-assets` debit against `asset:cash` credit.

Personal cash cannot live in this module, because the Phase 1 gate forbids personal-cash tokens here. It needs its own settlement module and its own gate, so the design of that module is a separate decision.
