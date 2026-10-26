# P3-4: margin liquidation transaction evidence

Base main: `46b1875f0b748d050aeae2d12551bfb27a0ce6dd`, after #1127 closed #1079.
Mode: `F_IMPLEMENT`. Scope: focused test/CI evidence for the existing personal
margin writer, following the completed R0–R9 whole-yen migration.

## Runtime boundary

`personalStockMargin.liquidate(engine)` and `processWeek(engine)` are intermediate
helpers. They intentionally do not save or emit a command-completion event.
`expansion.js::updatePersonalExpandedWeekly` calls the weekly helper, while the
installed `advanceWeek(false)` chain owns the transaction and final commit.
The existing `player-own-share-conservation-test.js` explicitly asserts that the
weekly helper must not save independently. This contract remains unchanged.

The new scoped tests call the actual exported helpers inside the existing
`engine.runTransaction` boundary. The full-week tests also invoke the actual
installed `advanceWeek(false)` chain. They reuse the existing deterministic
stock-split fixture, shared transaction fault harness and fake IndexedDB adapter;
positive cases execute the installed financial and transaction implementations.
The canonical-call spy delegates to the original margin helper and verifies
that it ran before the injected final-commit failure.

This supplies part of the margin fault evidence gap (G08 in the proposed
#1089/#1091 inventories). It does not close runtime writer-family adoption:
raw-helper callers must still be inventoried and constrained before any future
ownership cutover. Calling a raw helper without its caller's transaction is
outside the tested commit boundary. No source router, ownership authority,
registry, command permission, save version or settlement behavior changes.
No new gameplay P1 is claimed from the deliberate raw-helper design.

## Node evidence

`tests/personal-stock-margin-save-atomicity-test.js` covers:

- Multi-lot forced sales including the player's own-company shares; residual
  debt, realized personal stock profit/loss, market quantities and capitalization.
- Weekly interest followed by liquidation, and interest-only capitalization.
- Exact personal cash/debt conservation and unchanged company cash, debt,
  holdings, finance ledger, issuer quantities and simulation RNG for scoped calls.
- All applicable shared fault kinds: save-false, save-before-throw, mirror
  rejection, enqueue-false/throw after admission, post-save throw, saved/change
  events and liquidation notification. The interest-only branch has no notify
  event, so that fault is not applicable there.
- Nested outer transactions, an already-pending predecessor, exact live rollback,
  mirror/cache/durable bytes, canceled failed puts, monotonic saveSequence,
  recovery save, retry and production/fresh durable-only reload.
- One save for the enclosing command and a no-op helper repeat.
- The installed canonical week under saved-event and post-save exceptions,
  plus a separate failure at its actual `week` completion event. Rollback and
  retry are compared with an uninterrupted same-seed canonical week. A week emits
  `week`, so injecting a nonexistent `change` completion event is not evidence.
- A negative control that disables rollback only in a fresh test instance:
  the full-state rollback oracle must reject it. Production code is untouched.

The test is canonical-registered in shard K, next to ownership conservation.
Measured prior-main K runtime in #1127 was 744.590 seconds, compared with
1072.472 seconds for L; the new regression uses the former's larger headroom.
This is a placement decision, not a timeout increase or benchmark promise.

## Real browser evidence

`tests/personal-stock-margin-save-atomicity-webkit-test.js` executes 33 cases in
real WebKit with iPhone 13 emulation and real IndexedDB. It covers success and
all applicable shared faults for the scoped liquidation/weekly/interest paths,
plus canonical-week success, saved/post-save faults and the real `week` event.
After each case it exports IndexedDB, removes localStorage from the exported
context, starts a fresh browser context, loads through production hydration and
compares the complete normalized state. Only wall-clock save metadata and the
storage-only sequence field are excluded from the normalized state comparison;
rollback itself compares exact live state and mirror/cache bytes.

The JSON artifact records browser version, `physicalDevice: false`, each executed
case and the final result. Physical iPhone testing is not claimed. The M&A
`stock-split-atomicity` job runs this test on its existing events and retains the
artifact in its existing directory. Source, test and fixture paths are in both
PR/push filters. The workflow contract and alternative-execution registry verify
that registration. No existing test, event, timeout or assertion is removed.

## Completion boundary

Local results, exact PR HEAD and final-head CI are recorded in the PR. Test
registration is not itself execution evidence. This is scoped S preparation,
not `S_PASS`, P3-4 activation, P3-10 command execution, Phase 3 F Exit, Phase 4
Entry or Stage Q completion. The Owner-held inventory/specification PRs remain
separate and unmerged. The next concern can address remaining caller closure
or weekly-ratchet failure evidence under its own reviewed scope.
