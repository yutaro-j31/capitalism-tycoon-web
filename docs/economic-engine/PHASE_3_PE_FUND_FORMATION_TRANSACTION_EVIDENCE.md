# P3-4: PE fund formation transaction fix and evidence (W-PE-FORM)

Status: one production atomicity fix plus Node / fake-IndexedDB and native-WebKit evidence. No economic, persistence, rounding or authority
change: a successful formation writes exactly what it wrote before.

## Defect

`formPEFund` (`js/pe-fund.js`), the PE screen's ファンド組成 action, ran `formFund` and then called `this.save()` and
`this.emit()` outside any transaction. When the save failed it still returned `true`. The GP commitment had already
left personal cash, and the new fund and its LP commitments stayed in live state but never became durable. The P3-4
inventory row (W-PE-FORM) recorded per-helper atomicity as not established.

A probe on the previous `main` confirms it: with `save` returning `false`, `formPEFund()` returned `true`, the fund stayed,
and ¥15,000,000,000 had left personal cash.

## Fix

`formPEFund` now runs `formFund` inside `runTransaction`, like `createPEDeal`. The GP commitment, the fund, its LP
commitments and the notice commit with the command's single save, or roll back together. A refused plan still fails
through `this.fail` with the same message. The raw exported helpers (`createFund`, `addLPCommitment`) are unchanged and are
not player commands.

## Pinned inputs

`tests/fixtures/pe-fund-formation-atomicity.js` sets up the PE firm as `tests/pe-fund-formation-test.js` does: one recorded
buyout exit as the track-record witness, an investment department, CSO and CFO, and cash buffers.

| Variant | Command |
| --- | --- |
| `maximum` | `formPEFund()` at the maximum plan |
| `custom` | `formPEFund({ gpCommit })` at half the maximum GP commitment |

## Faults and oracles

`tests/pe-fund-formation-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Faults:
  - per variant, all nine shared faults;
  - on `custom`, also queued-predecessor and nested `save-false` / `save-throw`.
- Each failure is checked for:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the command once.
- The success oracle checks the formation against the read-only plan before the command:
  - exactly one new fund at the planned size, GP commitment and terms;
  - LP contribution equal to size minus GP commitment, and fund cash equal to GP plus LP contributions;
  - personal cash down by the GP commitment; company cash and the company ledger untouched;
  - LP commitments recorded; existing funds and every other top-level state key unchanged;
  - `finance.validate` passes.
- The uninterrupted command commits once, in `notify -> saved -> change` order.
- A replay is identical.
- A second formation is refused, before Fund I meets the follow-on conditions, with no change, no save and unchanged
  durable bytes.
- A v9 critical compaction keeps the fund and personal cash.
- Three negative controls are rejected:
  - a disabled rollback;
  - personal cash off by ¥1;
  - an LP contribution off by ¥1.

On the previous `formPEFund` the test fails at the first fault: `failed PE fund formation must return false`.

`tests/pe-fund-formation-test.js`, `tests/pe-fund-gate-rescue-test.js`, `tests/pe-multi-fund-acquisition-negative-test.js`,
`tests/pe-fund-test.js` and `tests/pe-full-playloop-test.js` pass unchanged.

## Native WebKit / IndexedDB counterpart

`tests/pe-fund-formation-save-atomicity-webkit-test.js` runs the same two variants through the installed `formPEFund` in
the installed page. The page is emulated iPhone 13 WebKit with real IndexedDB. A page-side observer requires the
actual formation notice inside the command's transaction. Per variant it runs success and all nine shared faults;
`custom` adds queued-predecessor and nested `save-false` / `save-throw`, for 24 scenarios.

Each failure is checked for:

- live state, mirror, cache and durable IndexedDB bytes exactly as before, with a pending predecessor intact;
- a recovery save above every allocated failed sequence;
- a retried formation equal to the uninterrupted one;
- a fresh context with localStorage removed that hydrates that state from IndexedDB alone.

After each case, Fund II is refused without any change and is hydrated durable-only too. The page oracle ports the Node
`success()` against the installed read-only plan taken before the command. Three negative controls are rejected:

- a disabled rollback;
- personal cash off by ¥1;
- an LP contribution off by ¥1.

It runs in the M&A `pe-acquisition-atomicity` job (20.6 minutes of its 40-minute budget on `22f90271`, before this
test). Its logic was exercised locally on Chromium (24 scenarios plus 3 rejected controls); WebKit evidence is the
exact HEAD's CI job. No physical-iPhone claim is made.

## Limits

LP outreach (`solicitPELP`, `answerPELPQuestions`) keeps
its own direct save and is not changed here. This does not certify W-WEEK-PE, raw/helper bypass closure, S_PASS,
authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
