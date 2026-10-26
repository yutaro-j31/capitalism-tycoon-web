# P3-4: sponsor-injection Node fault evidence

Base main: `6680ae0fab9af3b0d8073abf6cb3fa249c199821`, after #1130.
Mode: `F_IMPLEMENT`. This is focused evidence for the existing `W-SPONSOR`
writer, not a change to ownership authority or sponsor pricing.

## Installed command and independent inputs

The test calls the installed `requestSponsorInjection()` command, which owns
its existing `runTransaction`. `tests/fixtures/sponsor-injection-atomicity.js`
uses the actual deterministic engine, finance and storage implementation plus
the shared fake IndexedDB adapter. It starts a private, distressed company with
a 100m property, -1m company cash, 10m personal cash and 10,000 issued shares.

The independently pinned settlement is 8m company cash and 2,020 new shares:
99m opening company value at the existing 40% pricing gives 39.6m pre-money;
the 8m minimum target exceeds the 3m reserve plus 1m shortfall; the current share
rule rounds `10,000 * 8m / 39.6m`. Inputs are asserted before the command.
The oracle does not derive expected cash or shares from resulting history,
receipts or issued quantities. These are fixture pins, not new economic rules.

## Node evidence

`tests/sponsor-injection-save-atomicity-test.js` covers all nine shared faults,
plus queued predecessors and nested transactions for save-false/post-save-throw.
The shared harness checks exact live state, RNG draws, mirror/cache/durable
bytes, cancellation of failed queued puts, production reload and fresh
durable-only hydration, observed failed allocated sequences, recovery and retry.

Success checks the independent issuer/cash pins, unchanged founder/treasury/
personal holdings and debt, unchanged company debt/property/RNG, one action ID,
one equity-financing receipt and one capital-surplus increment. Share reconciliation
reports the new quantity as unallocated; it does not invent a registered sponsor
holder. An uninterrupted command saves once; cooldown rejection cannot save or
issue again. A failed-save/recovery/retry is compared with the full same-seed
uninterrupted economic state, excluding save metadata only.

Critical v9 compaction/reload must retain cash/debt/shares and the action state
needed to reject replay. A disabled-rollback fixture must fail the exact state
oracle; a wrong-issued-quantity fixture with otherwise coherent cash/receipts
must fail the independent quantity oracle. Production source is unchanged.

The new test is canonical-registered in shard G. On #1130, G measured 692.621s,
D 836.465s, B 1,438.352s and K 1,478.669s. Placement uses observed headroom;
no timeout or existing assignment changes. Actual local/final-HEAD CI execution
is recorded in the PR, distinct from registration-only checks.

## Completion boundary

This slice supplies Node/fake-IDB evidence only. Dedicated sponsor real WebKit/
native-IDB fault evidence remains open; existing happy-path UI tests are not a
substitute. Installed caller/bypass closure and scoped adoption review remain
open. There is no `S_PASS`, ownership cutover, P3-10 permission, Phase 3 Exit or
Phase 4 Entry claim. Owner-held inventory/spec PRs remain separate and unmerged.
