# P3-4 partial weekly competitor purchase evidence

Baseline main: `779c33b39f3689b6081804046ad20523a31f9db5` (after #1231).

The existing registered `tests/competitor-stake-float-test.js` retains its healthy purchase/float/weekly cases and
adds a real persisted `advanceWeek(false)` path. Unlike its original `engine()` helper, the new fixture uses the
existing fake-IndexedDB scenario and actual save/checkpoint implementation. The company-held own-ticker alias
is removed only from the fixture; founder700,000 / treasury50,000 / issued1,000,000 / prior competitor aggregate
95,000 and personal own shares20,000 are retained. Existing reseed API seed225 reaches one actual purchase by
competitor-1 during week12→13, filling exactly4,988 shares. No forced RNG return or purchase probability change.

The helper is witnessed inside the real weekly transaction/updateCompetitors call. Named and aggregate competitor
quantities increase together, NPC cash follows the existing quote×quantity rule, and the helper itself changes no
player cash/debt/holdings/ledger or RNG. Normal settlement commits; save-false and a throw after actual save admission
restore the whole prior week, including NPC cash/shares, player accounts/ledger and persisted RNG, and start no rejected
durable put. Healthy retry equals the uninterrupted same-seed week. Production reload and fresh durable-only fake-IDB
hydration verify both rejected predecessors and successful results. Founder/treasury/issued quantities stay unchanged;
prior aggregate95,000 plus4,988 becomes99,988, ratios sum1 and player accounting validates.

This is partial Node/fake-IndexedDB evidence for two save faults, not every weekly helper/fault or native WebKit,
NPC monetary rounding migration, whole-family S_PASS, Authority Cutover, Phase 3 Exit or Phase 4 Entry. No new
physical-device claim. No production/economic policy/saveVersion9/old-save loader/registration/Work B CI configuration
or vNext change. Existing quote arithmetic is observed, not redefined; unknown/legacy holdings are not repaired.
