# P3-4: sponsor-injection transaction evidence

Base main: `6680ae0fab9af3b0d8073abf6cb3fa249c199821`, after #1130.
Browser follow-up base: `a1b1df51dd3249789d6fb9c6ff5a9d491feee2d8`, after #1131.
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

## Real browser follow-up

`tests/sponsor-injection-save-atomicity-webkit-test.js` executes the installed
`requestSponsorInjection()` in real WebKit with iPhone 13 emulation and native
IndexedDB. It uses the same independently pinned input and settlement as Node.
The issuance observer delegates to the installed quantity-ratio update and
checks that actual issuance is reached inside a transaction before each fault.

Fourteen scenarios cover success, all nine shared faults and queued/nested
save-false/post-save-throw. The queued predecessor is saved in the same
synchronous task as the failed command, before queued microtasks start; an
already-running blocked native IDB request is not claimed. Failed cases compare
exact live state, mirror/cache and bytes read directly from the native IDB
store. The export removes localStorage and a fresh context loads the complete
normalized pre-command state through production hydration.

Recovery must exceed the actual failed allocator high-water. Every retry must
produce the complete uninterrupted same-seed economic state with one cash
receipt, capital-surplus increment and issuance, preserve personal accounts,
and reject cooldown replay without another save. A second fresh context checks
retry durability. Only lastSaveDate and storage-only saveSequence are excluded
from normalized comparisons; rollback payloads are exact. Browser mutations
with disabled rollback and wrong issued quantities must both be rejected.

The M&A stock-split-atomicity job runs the test on its existing events and
retains sponsor-injection-result.json in its existing artifact directory.
New test/fixture paths are in both PR/push filters; the writer/shared storage
and fault dependencies were already covered. Workflow and registration
contracts check wiring. No existing test, timeout or production file changes.
Actual execution and final-HEAD gates are recorded in the PR. Desktop WebKit
emulation is not physical-iPhone evidence or an interactive UI-click claim.

## Completion boundary

This supplies targeted Node and real-browser fault evidence. Installed caller/
bypass closure and scoped adoption review remain open. There is no S_PASS,
ownership cutover, P3-10 permission, Phase 3 Exit or Phase 4 Entry claim.
Owner-held inventory/spec PRs remain separate and unmerged.
