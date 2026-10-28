# P3-4: new-business commercialization evidence (W-COMMERCIAL-SPINOUT)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`commercializeNewBusiness(identity, mode)` (`js/new-business-commercialization.js`) decides a researched project that
is `ready`. It runs in one transaction and emits `notify`, `saved` and `change`. The venture screen's launch, spin-out
and abandon buttons call it.

| Mode | Charge (rounded up to whole yen, R6) | Result |
| --- | --- | --- |
| `launch` | 25% of the research invested | A new operating business. The charge is added to its invested capital and recorded as its commercialization carrying value. |
| `spinout` | 15% of the research invested | A new `spinout-` M&A subsidiary. Its investment book is the invested amount plus the charge; its enterprise value is book × (1.1 + outcome score). |
| `abandon` | none | The project is abandoned. Nothing is posted. |

A charged decision posts one `newBusinessCommercialization` `assetPurchase` row (cash −charge, asset +charge, profit 0)
with an idempotency key. Every decision marks the project with its mode and week and appends a history row. A decided
project cannot be decided again.

## Pinned inputs

`tests/fixtures/new-business-commercialization-atomicity.js` sets up three projects with the installed writers:

- The installed analysis generates candidates (`generateNewBusinessCandidates`).
- Research starts on three of them (`startNewBusinessResearch`).
- Installed weeks run until all three are `ready` (week 13).

The only hand-set input is a company cash buffer, with the matching opening finance state. The variants decide the
first project as `spinout`, the second as `launch` and the third as `abandon`.

## Faults and oracles

`tests/new-business-commercialization-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Faults:
  - per variant, all nine shared faults;
  - on `spinout`, also queued-predecessor and nested `save-false` / `save-throw`.
- Each failure is checked for:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the decision once.
- The success oracle is computed independently of the module, from the project's invested amount and outcome score:
  - company cash falls by the whole-yen charge;
  - founder cash and the other projects are unchanged;
  - the project's status, mode and week;
  - the full launched business, or every installed field of the spin-out subsidiary, and nothing created by the other
    modes;
  - the full history row;
  - exactly one whole-yen row with its source and operation IDs for a charged mode, and none for abandonment;
  - `finance.validate` and standalone close pass.
- The uninterrupted decision commits once, in `notify -> saved -> change` order.
- A replay is identical.
- A second decision of the project is refused in every mode, with no change, no save and unchanged durable bytes.
- A v9 critical compaction keeps the project status, the businesses, the spin-out book and carrying value, and company
  cash.
- Three negative controls are rejected:
  - a disabled rollback;
  - company cash off by ¥1;
  - a spin-out book ¥1 short.

The test also rejects three production mutants, which are not committed:

- a floored charge;
- a spin-out book without the charge;
- an abandonment that takes cash.

## Limits

This is Node only; a native-WebKit counterpart is the next slice. This does not certify:

- the research start or weekly research progress;
- the class or ownership evidence of the created `spinout-` subsidiary, which the inventory row flags;
- raw/helper bypass closure;
- S_PASS;
- authority cutover;
- P3-10;
- Phase 3 Exit or Phase 4 Entry.
