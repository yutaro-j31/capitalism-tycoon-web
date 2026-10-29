# P3-4: investor-offer auxiliary commands transaction fix and evidence (W-INVESTOR-AUX)

**Status:** one production atomicity fix plus Node / fake-IndexedDB evidence. There is no economic, persistence,
rounding or authority change: a successful command writes exactly what it wrote before.

## Defect

Two commands in `js/expansion.js` handle investor offers before an IPO:

- `refreshInvestorOffers` draws one or two offers from the simulation RNG.
- `declineInvestorOffer` (the 見送る action) marks a pending offer as declined.

Both ran their writes and then called `this.save()` and `this.emit()` outside any transaction. When the save failed,
they still returned `true`. The offers, the RNG draws, the declined status and the notice stayed in live state but were
never made durable. The P3-4 inventory row (W-INVESTOR-AUX) recorded "direct save; auxiliary failure set absent".

A probe on the previous `main`, with `save` returning `false`, confirms both cases:

- `declineInvestorOffer` returned `true` and the offer stayed `declined`;
- `refreshInvestorOffers` returned `true` and its new offers stayed.

## Fix

Each command now runs inside `runTransaction`, like `acceptInvestorOffer`. Its writes and its notice commit with the
command's single save or roll back together. The refusals are unchanged:

- a listed company, or one without a head office, cannot refresh (`this.fail`, same message);
- a missing or non-pending offer cannot be declined (`false`, no message).

The weekly call in `engine.js` (every sixth week, unlisted, fewer than two pending offers) now runs as a nested
transaction inside the week. Its save was already deferred to the week's commit. It no longer emits a `change` event
in the middle of the week; the week emits once on commit.

## Pinned inputs

`tests/fixtures/investor-offer-aux-atomicity.js` sets up an unlisted company with a head office.

| Variant | Command |
| --- | --- |
| `refresh` | `refreshInvestorOffers()` with no pending offers |
| `decline` | `declineInvestorOffer(id)` on one of two pending offers produced by the same refresh |

## Faults and oracles

`tests/investor-offer-aux-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`).

**Faults:**

- per variant, all nine shared faults;
- on `decline`, also queued-predecessor and nested `save-false` / `save-throw`.

**Each failure is checked for:**

- full live rollback, including RNG;
- unchanged mirror, cache and durable bytes;
- a cancelled failed put;
- production reload and fresh durable-only hydration;
- a recovery save above every allocated failed sequence;
- a retry that commits the command once.

**Success oracle:**

- refresh:
  - one or two new pending offers, each with a six-week expiry, whole-yen amounts and equity within 5–20%;
  - existing offers untouched;
  - the simulation RNG advanced;
- decline: only that offer's status changes, to `declined`; other offers untouched;
- in both, one notice, every other top-level state key unchanged, and `finance.validate` passes.

**Command-level checks:**

- The uninterrupted command commits once, in `notify -> saved -> change` order.
- A replay is identical.
- The follow-up is refused with no change and no save: a declined offer cannot be declined again, and a listed
  company cannot refresh.

**Negative controls (all rejected):**

- a disabled rollback;
- another offer's status changed;
- an unchanged RNG after a refresh.

On the previous `main`, the test fails at the first fault: `failed investor offer auxiliary command must return false`.

The following pass unchanged:

- `tests/investor-offer-test.js` and `tests/investor-offer-save-atomicity-test.js`;
- `tests/phase3-ownership-apply-test.js`;
- `tests/simulation-rng-test.js` and `tests/simulation-long-run-reload-fork-test.js`;
- `tests/digital-portfolio-scenario.js`;
- `tests/gf-008-broader-determinism-test.js` and `tests/transaction-regression-test.js`.

The test runs in canonical shard J (about 71 seconds locally).

## Limits

This is Node only, with no WebKit claim. The offers carry no share or cash effect until `acceptInvestorOffer`
(W-INVESTOR), so no ownership verification leg applies. This does not certify S_PASS, authority cutover, P3-10,
Phase 3 Exit or Phase 4 Entry.
