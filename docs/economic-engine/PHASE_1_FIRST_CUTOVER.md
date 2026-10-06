# Phase 1 First Limited Cutover — Store Renovation

**Status:** P1-4 implementation contract  
**Scope:** one operation family only

## Selected family

The first authoritative EconomicOperation cutover is **store renovation expense**.

Operation type:

`company:store-renovation`

Canonical posting shape:

| Entity | Account | Side |
|---|---|---|
| `entity:company:player` | `expense:operating` | debit |
| `entity:company:player` | `asset:cash` | credit |

Currency is JPY and both posting amounts must match exactly.

## Authority after cutover

For this operation family only:

1. `economic-settlement.js::settleStoreRenovation` is the authoritative company-cash writer.
2. `store-equipment.js::renovate` no longer mutates `companyCash` directly.
3. `finance.event()` receives the EconomicOperation `operationId` and `idempotencyKey` and records the existing accounting transaction as a **legacy projection**.
4. Store condition remains a domain-state mutation owned by the store module and is committed atomically with settlement + projection through `TycoonEngine.runTransaction()`.

This does not migrate any other company-cash operation.

## Deterministic identity

The operation identity is derived from persisted/gameplay inputs only:

- store ID
- game week
- renovation cost

No host time, RNG, or generated UUID participates.

The same replayable action inputs produce the same operation ID and idempotency key.

## Transitional persisted idempotency receipt

P1-4 does **not** add the P1-3 shadow journal to the production save root.

Until a later owner-approved persisted Economic Core journal migration, the existing finance transaction projection is also used as a read-only persisted replay receipt:

- before settlement, matching `operationID` or `idempotencyKey` blocks a duplicate charge;
- the finance row does not mutate company cash;
- a rejected/failed projection causes the surrounding transaction to roll back the authoritative cash mutation and store-condition mutation.

This is a transitional replay guard, not a second cash authority.

## Atomicity

The successful action runs inside the existing `runTransaction()` boundary.

If any post-settlement step throws:

- company cash returns to its pre-action value;
- store condition returns to its pre-action value;
- finance projection state returns to its pre-action value;
- no partial save is committed.

## Save compatibility

P1-4:

- keeps `SAVE_KEY = capitalism_tycoon_web_v1`;
- keeps effective `saveVersion = 9`;
- adds no required persisted Economic Core root;
- remains compatible with saves that predate the cutover.

## Non-goals

P1-4 does not cut over:

- store equipment upgrades;
- store concept changes;
- payroll or workforce expenses;
- supplier payments;
- debt;
- equity/ownership;
- personal cash;
- PE/VC;
- real estate;
- weekly settlement.

Those remain legacy-authoritative until explicitly migrated in later phases.

## Acceptance evidence

The slice is accepted only if tests prove:

- the EconomicOperation validates and has the exact supported posting shape;
- the store renovation legacy function contains no direct company-cash mutation;
- the settlement module has the only exact writer for this cutover family;
- successful gameplay produces the same cash/condition/accounting result as before;
- the finance projection uses the same operation ID/idempotency key;
- duplicate receipt blocks a second charge;
- projection failure rolls back the full action;
- save/reload stays on v9;
- Phase 0.5 writer inventory reports exactly one limited-cutover writer;
- canonical CI is green.
