# P3-4 partial ownership replacement-boundary evidence

Scope: targeted evidence for P3-3's load/import/compaction/restore boundary and the Owner's 2026-10-30 family-closure
continuation. This test covers the existing read-only ownership snapshot/index. It neither closes the writer family
nor activates an authoritative writer. Pending MA/IPO/ratchet routing PRs remain independently gated.

## Installed paths exercised

The already registered `tests/phase3-ownership-snapshot-test.js` now also boots the final installed runtime with the
shared deterministic fake-IndexedDB fixture. It seeds current-v9 nonzero holdings: issued1000, treasury100,
founder-legacy600, personal-own10, personal-external20 and company-external30. This is a characterization fixture,
not a generated history of paid acquisitions or a migration of arbitrary historical saves.

For each existing normal/emergency/critical compaction profile it:

- invokes the production compactor, actual `importSave`, `TycoonEngine.load`, flush and fresh durable-only hydration;
- proves the imported state root is replaced and a pre-import index is STALE_EVIDENCE;
- rebuilds a read-only snapshot and independently pins issued1000, treasury100, outstanding900, founder610 exactly
  once, personal-external20 and company-external30;
- preserves separate company/personal cash and saveVersion9, with durable bytes equal to the storage cache;
- verifies snapshot reads preserve full state and host RNG, remain command-ineligible and wealth-incomplete.

A real rejected `runTransaction` replaces the personal map with a speculative clone and changes own shares by one.
The old index becomes stale inside the boundary. Rollback restores every state field and persisted RNG; the pre-entry
index is admissible again, while the speculative index is stale. Mirror/cache/durable payloads stay at the predecessor.
The mutation is fault injection only; no production writer or save behavior changes.

## What is still missing

This is Node with fake IndexedDB, not native WebKit or physical-iPhone proof. Existing per-writer browser evidence is
separate. It does not certify import-save failure atomicity, arbitrary damaged old saves, refounding, every captured
base/raw/direct-export/weekly/shadow route, operation-receipt idempotency, or a future adopted authority. It changes no
load/import/restore code and introduces no registry root or adoption marker. No S_PASS, whole-family closure,
Authority Cutover, P3-10 permission, Phase 3 Exit or Phase 4 Entry follows from these tests.

Validation uses the focused snapshot/reconciliation/apply suites, test-registration, static/text-safety and diff checks.
The existing canonical registration and shard assignment are retained; Work B runner/workflow/config files are untouched.
