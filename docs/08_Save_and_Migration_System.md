# 08 Save and Migration System

## 1. Purpose

This document defines save-data ownership, serialization, versioning, migration, validation, backup, recovery, and compatibility requirements for Capitalism Tycoon Web.

Save compatibility is a release-blocking concern. A feature is not complete if it works only in a new game while corrupting or invalidating existing player progress.

## 2. Source of Truth

The canonical save key and save-version mechanism are project contracts.

- `SAVE_KEY` identifies the primary browser-storage record.
- `saveVersion` identifies the schema version of the serialized state.
- Renaming or replacing either requires an explicit migration and compatibility plan.
- UI state that is not required to reproduce gameplay should not be stored in the canonical save.

The implementation must inspect the current repository definitions before changing names or values. This document defines behavior, not a license to overwrite existing constants.

## 3. Save Envelope

Recommended envelope:

```ts
interface SaveEnvelope {
  saveVersion: number
  gameVersion: string
  createdAt: string
  updatedAt: string
  checksum?: string
  payload: GameState
  migrationHistory?: MigrationRecord[]
}
```

The envelope separates schema metadata from gameplay state.

## 4. Canonical Save Rules

- Persist plain JSON-compatible data.
- Serialize stable identifiers, not object pointers.
- Do not store functions, closures, DOM nodes, browser APIs, or class instances that require prototypes.
- Dates are stored as explicit strings or numeric epochs with documented interpretation.
- Maps and sets are converted to stable arrays or records.
- Numeric values must be finite and within supported bounds.
- The save must contain all simulation state required for deterministic continuation.

## 5. Save Versioning

`saveVersion` is an integer schema version.

Increment `saveVersion` when a persisted structure changes in a way that requires transformation or new defaults.

Examples requiring increment:

- Renaming a persisted field.
- Changing field meaning or unit.
- Splitting one field into several.
- Changing an array into an ID-indexed record.
- Introducing required ownership or accounting data.
- Changing random-state format.

Examples not necessarily requiring increment:

- Cosmetic UI change.
- New derived display value.
- Internal refactor that preserves serialized shape and semantics.
- Additional optional field with a safe loader default, provided old saves remain valid.

## 6. Migration Pipeline

Migrations execute sequentially.

```ts
const migrations: Record<number, SaveMigration> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
}
```

Loading version `N` into current version `C` applies migrations:

```text
N -> N+1 -> N+2 -> ... -> C
```

Skipping intermediate migrations is prohibited unless a separately tested direct migration is explicitly provided.

## 7. Migration Contract

Each migration must:

- Accept one known input version.
- Produce exactly the next version.
- Be deterministic.
- Avoid simulation random draws.
- Preserve economically meaningful values.
- Add documented defaults.
- Preserve stable IDs where possible.
- Record warnings for ambiguous repairs.
- Pass validation before the next migration runs.

Recommended interface:

```ts
interface SaveMigration {
  fromVersion: number
  toVersion: number
  migrate(input: unknown): MigrationResult
}
```

## 8. Defaults and Missing Fields

Defaults must distinguish between:

- Missing because the save predates the feature.
- Missing because data is corrupt.
- Intentionally absent optional value.

A migration default must be economically neutral where possible.

Examples:

- New notification preference: use documented default.
- New accounting field: derive from existing balances if possible.
- New employee attribute: assign deterministic value based on existing stable data or a fixed default.
- New ownership field: reconstruct from historical ownership rather than granting arbitrary value.

## 9. Load Pipeline

Recommended load order:

1. Read primary storage record.
2. Parse JSON safely.
3. Validate envelope metadata.
4. Detect version.
5. Reject unsupported future versions without overwriting them.
6. Create backup of the original raw save before migration.
7. Apply sequential migrations.
8. Validate full current schema.
9. Reconcile critical invariants.
10. Normalize safe optional values.
11. Load into runtime state.
12. Save migrated result only after successful validation.

A failed load must not silently start a new game over the existing save.

## 10. Future-Version Saves

If `saveVersion` is greater than the current application's supported version:

- Do not migrate backward automatically.
- Do not overwrite the save.
- Display a clear incompatibility message.
- Offer export or preservation where supported.
- Permit retry after application update.

## 11. Backup Strategy

Recommended browser keys:

```text
primary save
last-known-good backup
pre-migration backup
optional rolling backup slots
```

Backup rules:

- Pre-migration backup stores the raw original save.
- Last-known-good backup updates only after a validated commit.
- Backups include save version and timestamp.
- Recovery must avoid recursive corruption by preserving the failed primary record until the player chooses replacement.

## 12. Autosave Transaction

The weekly turn autosave is committed only after:

- Simulation completes.
- Accounting reconciliation passes.
- Entity-reference validation passes.
- Numeric validation passes.
- Serialization succeeds.

Recommended process:

1. Build next state in memory.
2. Validate next state.
3. Serialize to temporary string.
4. Optionally verify parse round-trip.
5. Update backup.
6. Write primary save.
7. Mark runtime state committed.

## 13. Manual Save, Import, and Export

If manual export/import is supported:

- Export includes full envelope.
- Import never writes before parse, migration, and validation succeed.
- Imported future-version saves are preserved but rejected.
- Imported older saves pass through the same migration pipeline.
- The UI displays source version and validation status.
- Sensitive external data must not be embedded.

## 14. Validation Layers

### 14.1 Structural Validation

Examples:

- Required top-level keys.
- Correct primitive types.
- Arrays and records in expected form.
- Known enum values.

### 14.2 Referential Validation

Examples:

- Store `companyId` exists.
- Employee assignment references valid employee and company.
- Ownership references valid shareholder and company.
- Scheduled event references valid target or has safe missing-target behavior.

### 14.3 Numeric Validation

Examples:

- Finite values only.
- Integer monetary amounts.
- Nonnegative share counts.
- Valid percentages and probabilities.
- Safe bounds for week and age.

### 14.4 Economic Validation

Examples:

- Balance sheet reconciles.
- Cash ledger matches cash balances.
- Share capitalization reconciles.
- Company and personal assets are not duplicated.
- Debt instrument balances match ledger liabilities.

## 15. Repair Policy

Automatic repair is allowed only when the intended value is unambiguous and the repair cannot grant or destroy material value unexpectedly.

Safe examples:

- Missing cosmetic preference.
- Duplicate non-economic notification removed.
- Derived cache rebuilt.

Unsafe examples requiring explicit failure or user-visible recovery:

- Missing company cash with no reconstructible ledger.
- Conflicting ownership records.
- Unknown negative debt.
- Duplicate asset ownership.
- Broken accounting entries affecting net worth.

Repairs should produce diagnostic records.

## 16. Determinism and RNG State

The save must persist all random state required to continue deterministic simulation.

Requirements:

- Save/load without advancing must not consume RNG.
- Migration must not consume gameplay RNG.
- Random-stream names and states are versioned.
- Adding a new stream requires a deterministic default for older saves.

## 17. Save Size and Performance

Long-duration saves require bounded growth.

Strategies:

- Retain detailed weekly history for a rolling window.
- Archive quarterly and annual aggregates indefinitely.
- Preserve major events and achievements.
- Compact resolved event payloads.
- Remove derived caches that can be recomputed.
- Avoid duplicated entity snapshots.

Compaction must not break accounting reconciliation, achievements, rankings, or deterministic continuation.

## 18. Storage Failure

Browser storage writes may fail because of quota, privacy mode, corruption, or platform restrictions.

The application must:

- Catch storage exceptions.
- Preserve runtime state.
- Inform the player clearly.
- Avoid claiming save success.
- Offer export where available.
- Avoid repeated destructive retries.

## 19. Security and Trust Boundary

Client-side saves are player-controlled data.

- Treat imported data as untrusted.
- Validate before use.
- Never execute content from the save.
- Avoid prototype-pollution risks when merging objects.
- Do not trust save values for online competitive integrity without server verification.

## 20. Compatibility Matrix

Each release that changes persistence must document:

| Source save | Target app | Expected result |
|---|---|---|
| Current version | Current version | Direct load |
| Previous supported versions | Current version | Sequential migration |
| Corrupt save | Current version | Reject and recover |
| Future version | Older app | Preserve and reject |
| New game | Current version | Current schema |

The repository should eventually maintain representative fixture files for supported historical versions.

## 21. Required Tests

1. New-game save/load round trip.
2. Save/load preserves deterministic next-week result.
3. Each historical migration fixture reaches current version.
4. Migration is idempotent at the pipeline boundary.
5. Failed migration preserves original raw save.
6. Future-version save is not overwritten.
7. Missing optional field receives documented default.
8. Broken reference is detected.
9. Accounting mismatch is detected.
10. Storage-write failure is surfaced.
11. Import validation occurs before overwrite.
12. 1,200-week save remains loadable and within size targets.
13. RNG streams survive save/load.
14. Company and personal asset separation survives migration.

## 22. Pull Request Requirements

Any PR affecting persisted state must include:

- Whether `saveVersion` changes.
- Old and new serialized examples or schemas.
- Migration function when required.
- Migration tests and fixtures.
- Default-value rationale.
- Rollback and recovery considerations.
- Confirmation that existing `SAVE_KEY` behavior is preserved or intentionally migrated.

## 23. Release Blocking Conditions

Do not release when:

- Supported old saves fail to load.
- Migration can duplicate or destroy material value.
- Failed migration overwrites the only copy.
- Future-version saves are overwritten.
- Save/load changes deterministic outcomes unexpectedly.
- Accounting or ownership invariants fail after migration.
