# P3-4 partial investor-offer replay evidence

This extends the already registered `tests/investor-offer-save-atomicity-test.js` for W-INVESTOR. Existing tests
cover same-instance duplicate acceptance, rollback and retry. The added case covers a different boundary: an accepted
offer must remain consumed after production compaction/import and a fresh runtime hydrated only from durable storage.

## Paths and independent checks

- Start with the existing deterministic production office/offer fixture, not a hand-made accepted financing row.
- Inject a post-admission save exception; the existing full rollback oracle verifies state, RNG, mirror, cache and
  durable storage. Hydrate a new runtime without a localStorage mirror and retry the still-pending offer once.
- Independently compute the issued quantity from the original pending offer. Pin the resulting issued shares,
  company cash, unchanged personal cash and capital surplus to one successful acceptance.
- Exercise production normal and critical compaction plus actual `importSave`, verifying that the state root changes.
  A reference to the installed acceptance method captured before import must use the replacement root and refuse
  the already accepted offer. This is an installed-method reference, **not** the raw/captured-base writer family.
- Hydrate another fresh runtime from durable storage alone. Direct and nested-transaction retries of the same offer
  both return false. Full state, RNG, mirror/cache/durable bytes and durable-put count remain unchanged.
- Require exactly one surviving financing row for this offer with the original cash/equity effects, accepted status,
  exact one-issuance shares/cash, and valid company accounting.

## Scope and remaining gates

No production code, save format, registry root, operation receipt, test registration, runner or workflow changes.
The existing accepted-offer status owns replay rejection; an ownership plan's operation ID is not an idempotency
receipt. This is Node/fake-IndexedDB evidence, not new native WebKit or physical-iPhone evidence. The existing
per-writer WebKit suite remains separate. Arbitrary historical receipt truncation, lost offer status, raw helpers,
other writer families and future adopted authority are not certified. No whole-family closure, S_PASS, Authority
Cutover, command permission, Phase 3 Exit or Phase 4 Entry is granted.

Base: main `165d924423f1e4bde8be8c801c28b15bbac76e72` after #1217. Work B #1215 is retained without edits.
