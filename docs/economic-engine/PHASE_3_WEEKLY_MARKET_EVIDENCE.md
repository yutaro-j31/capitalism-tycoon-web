# P3-4 partial public weekly market evidence

Baseline main: `754ef36e86cb69c6aa60f3aebfef26fc0aa0853d` (after #1233).

The registered `tests/week-transaction-atomicity-test.js` retains its three private-company cases and adds
six real persisted public-company weeks through the installed `advanceWeek(false)` chain. It reuses the
existing stock-split fake-IDB fixture and transaction fault injector. No new runner or registration.

Two predecessors carry the same authoritative issued quantity1,000,000: a matching own-market mirror1,000,000
and a stale estimate900,000. The stale case characterizes the existing `updateMarket` mirror refresh; it is
not authorization to repair ownership, migrate a save or adopt holder/control authority. Each predecessor is
saved before the week and independently tested with normal settlement, save-false and throw after actual save
admission. The fixture-only company-held own-ticker alias is removed and fixture opening accounting is rebuilt
before baseline save; a precondition verifies that the retained holdings and opening books agree.

The actual market helper is witnessed inside the outer weekly transaction. Own and external quotes must move,
retain their previous quote and exactly one current-week history row, and have price×issued market caps. The
own-market issued mirror must equal the authoritative quantity; player stockPrice follows its market quote.
The helper alone changes no issued/founder/treasury quantity, company/personal cash/debt/holdings or finance.
The surrounding real week still runs its ordinary economic effects and persisted RNG.

After an injected failure, full live state including quotes, history, mirror, ledger and RNG must equal the
predecessor; localStorage, IDB cache and durable bytes remain unchanged and no rejected durable put starts.
Production reload and fresh durable-only fake-IDB hydration are checked before retry. Retry must equal the
uninterrupted same-fixture economic state/RNG, with exactly one successful weekly put and no new share issuance.
Reload/hydration use the existing constructor's normalization; raw predecessor storage bytes are checked separately.

Focused suite: all three original cases and all six public cases PASS. Ownership-apply, test registration and
text-safety/diff PASS. A temporary in-memory mutant restores the stale issued mirror after real market processing
(and keeps its cap consistent with that wrong quantity); it exits1 at the independent authoritative-quantity
assertion (900,000 vs1,000,000). No mutant or production change is committed.

This is partial Node/fake-IDB evidence, not all weekly/fault/helper/replay/compaction/native-WebKit evidence,
whole-family S_PASS, Ownership Authority Cutover, Phase3 formal Exit or Phase4 production Entry. No new physical
iPhone claim. #1235's competitor storage/event cases are separate pending evidence, not a dependency of this PR.
Production financial semantics, quotes/RNG algorithms, SAVE_KEY/saveVersion9, old-save loading, WorkB CI and vNext
remain unchanged. Unknown holder/class/control evidence remains unsupported.
