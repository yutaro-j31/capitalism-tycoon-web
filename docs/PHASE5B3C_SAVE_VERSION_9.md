# Phase 5B-3C: explicit saveVersion 9 migration

## Scope

This increment formalizes the competitor lifecycle data introduced in Phase 5B-1 through 5B-3B as save version 9. The persistent local-storage key remains unchanged:

`capitalism_tycoon_web_v1`

The migration is isolated in `js/save-v9.js`, loaded immediately after `engine.js`. The existing engine migration chain for unversioned saves and versions 1 through 8 remains the source of truth. Version 9 wraps that chain rather than duplicating or rewriting it.

## Version 8 to version 9

A version-8 save is first processed by the existing version-8 migration and normalization logic. The version-9 layer then runs the installed competitor normalization chain and records:

- `saveVersion: 9`;
- `competitorMigrationV9Applied: true`;
- `competitorLifecycleSchemaVersion: 1`.

This guarantees that competitor projects, market-entry state, bounded performance histories, credit limits, repayment fields, and credit histories are present without replacing existing IDs, cash, debt, actions, projects, presences, or custom unknown fields.

## Version 9 reload

The base engine supports through version 8 internally. To preserve the tested migration chain, version-9 input is cloned and temporarily presented to the base migrator as version 8. Unknown version-9 fields remain intact. The result is normalized and stamped back to version 9.

The raw input object and stored source bytes are never modified during migration.

## Engine compatibility

The compatibility layer exports a version-9 engine subclass and updates the public engine exports:

- `SAVE_VERSION`;
- `createInitialState`;
- `detectSaveVersion`;
- `validateMigratedState`;
- `migrateSave`;
- `migrateV8ToV9`;
- `TycoonEngine`.

Startup load, normal save, slot load, JSON import, configuration, normalization, and reset all persist version 9. Corrupt or future-version startup data remains protected by the existing save-block behavior.

## Compatibility guarantees

- `SAVE_KEY` does not change.
- Unversioned and version 1–8 saves remain supported.
- Version-9 migration is idempotent.
- Version 10 and later saves are rejected without overwriting them.
- Existing entity IDs, array order, competitor financial values, lifecycle records, and unknown extension properties are preserved.
- No random-number calls are added.
- The migration layer does not alter player accounting, market formulas, supply, workforce, or stock behavior.

## Release gates

- no recursive migration calls;
- v8-to-v9 conversion succeeds without mutating source data;
- re-migrating a v9 save produces an identical state;
- future saves fail with an explicit error;
- normal save, slot load, import, and reset all remain at version 9;
- state contains no non-finite values;
- competitor validation remains read-only;
- full existing CI and long-run suites remain green.
