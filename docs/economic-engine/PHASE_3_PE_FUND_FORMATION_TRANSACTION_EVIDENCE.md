# P3-4: PE fund formation transaction fix and evidence (W-PE-FORM)

Status: one production atomicity fix plus Node / fake-IndexedDB evidence. No economic, persistence, rounding or authority
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

## Limits

This is Node only; a native-WebKit counterpart is the next slice. LP outreach (`solicitPELP`, `answerPELPQuestions`) keeps
its own direct save and is not changed here. This does not certify W-WEEK-PE, raw/helper bypass closure, S_PASS,
authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
