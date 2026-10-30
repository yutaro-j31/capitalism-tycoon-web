# P3-4 partial weekly competitor purchase evidence

Baseline main: `779c33b39f3689b6081804046ad20523a31f9db5` (after #1231).
Storage/event follow-up baseline: `754ef36e86cb69c6aa60f3aebfef26fc0aa0853d` (after #1233).
Pending-save follow-up baseline: `0febdaf47bf3d68b0b68d83132660fbd2486e5b6` (after #1235).

The existing registered `tests/competitor-stake-float-test.js` retains its healthy purchase/float/weekly cases and
adds a real persisted `advanceWeek(false)` path. Unlike its original `engine()` helper, the new fixture uses the
existing fake-IndexedDB scenario and actual save/checkpoint implementation. The company-held own-ticker alias
is removed only from the fixture; founder700,000 / treasury50,000 / issued1,000,000 / prior competitor aggregate
95,000 and personal own shares20,000 are retained. Existing reseed API seed225 reaches one actual purchase by
competitor-1 during week12→13, filling exactly4,988 shares. No forced RNG return or purchase probability change.

The helper is witnessed inside the real weekly transaction/updateCompetitors call. Named and aggregate competitor
quantities increase together, NPC cash follows the existing quote×quantity rule, and the helper itself changes no
player cash/debt/holdings/ledger or RNG. Normal settlement commits; eight injected faults
restore the whole prior week, including NPC cash/shares, player accounts/ledger and persisted RNG, and start no rejected
durable put. Healthy retry equals the uninterrupted same-seed week. Production reload and fresh durable-only fake-IDB
hydration verify both rejected predecessors and successful results. Founder/treasury/issued quantities stay unchanged;
prior aggregate95,000 plus4,988 becomes99,988, ratios sum1 and player accounting validates.

The original save-false / throw-after-save cases remain. The storage/event follow-up adds throw-before-save,
localStorage mirror rejection, enqueue-false / enqueue-throw after actual backend admission, saved-event throw,
and the actual outer week-event throw. Each case must witness the same real purchase before the fault, restore
live/cache/mirror/durable predecessors, reload them, retry, and commit exactly one durable weekly result matching
the uninterrupted reference. The generic harness's change event is not emitted by this outer weekly transaction;
the new fixture injects its week event instead. A trial change-event injection correctly failed its reachability
assertion and was replaced with this actual call-site witness, without changing runtime behavior.

This is partial Node/fake-IndexedDB evidence for eight faults, not every weekly helper/fault or native WebKit,
NPC monetary rounding migration, whole-family S_PASS, Authority Cutover, Phase 3 Exit or Phase 4 Entry. No new
physical-device claim. No production/economic policy/saveVersion9/old-save loader/registration/Work B CI configuration
or vNext change. Existing quote arithmetic is observed, not redefined; unknown/legacy holdings are not repaired.
The pending-save follow-up also holds a previous successful save's real fake-IDB put in flight before starting
the purchase week. A release callback must exist before the fault is injected. Save-false and admitted-save-throw
cases each preserve the pre-fault mirror/cache and older durable version while the predecessor is held. After
release and flush, only the successful predecessor becomes durable; no failed weekly put starts. Reload and
fresh durable-only hydration observe that predecessor before retry. Retry matches the uninterrupted same-seed
week and adds exactly one successful put. All original non-pending cases remain.

Notify-before-purchase, other pending fault kinds, nested direct callers and real browser storage remain outside
these follow-ups; they do not close the matrix's whole weekly family or establish NPC holder authority.
