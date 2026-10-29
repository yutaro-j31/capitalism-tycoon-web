# P3-4: weekly PE fund lifecycle save-fault evidence (W-WEEK-PE)

Status: test-only evidence (Node / fake IndexedDB). There is no production change.

## Writer

The installed canonical week runs `processFundsWeek` (`js/pe-fund.js`) for every PE fund. Each week it:

- collects the annual management fee and pays the team payroll to the company;
- returns undeployed cash to LPs and the GP at par when the investment period ends;
- returns the remaining cash and closes the fund when the term ends;
- refreshes the fund evaluation.

The P3-4 inventory row recorded that route-specific acquisition and exit tests do not cover all service-week
transitions, and that no all-service-week fault set existed.

## Pinned inputs

`tests/fixtures/week-pe-fund-atomicity.js` forms Fund I with the installed `formPEFund`, using the PE formation
fixture. It then places the fund on the eve of one transition:

| Variant | Week | Transition |
| --- | --- | --- |
| `fee` | 52 → 53 | first management-fee period: fee to the company, team payroll from it |
| `harvest` | 260 → 261 | investment period ends: all undeployed cash returned at par |
| `close` | 520 → 521 | fund term ends: ¥1bn remaining cash returned, fund closed |

The hand-set inputs are:

- the week;
- the fund's processing cursors (`lastProcessedWeek`, `lastManagementFeePeriod`), so the pinned week runs only the
  pinned transition;
- for `close`, the `harvesting` status and the remaining cash.

The pinned state is normalized through the production load, because the moved week renews derived periods. The
command helper `week()` asserts that the installed week actually ran the pinned transition.

## Faults and oracles

`tests/week-pe-fund-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`).

### Faults

- Per variant, all shared faults except `change` and `notify`. The canonical week ends in `week`, and the fund has no
  notice. This follows the existing round-close and competitor-stake week tests.
- On `harvest`, also queued-predecessor and nested `save-false` / `save-throw`.

Each failure is checked for:

- full live rollback, including RNG, the fund, company and personal cash, and the ledger;
- unchanged mirror, cache and durable bytes;
- a cancelled failed put;
- production reload and fresh durable-only hydration;
- a recovery save above every allocated failed sequence;
- a retry that commits the week once.

### Success oracle

The oracle compares against the same week without the pinned transition. For `fee` the period is already collected;
for `harvest` and `close` the vintage is one week later. The RNG must be the same.

- Only the transition's fund fields and the evaluation fields change.
- `fee`:
  - fee and payroll are both positive, and the payroll is at most the fee;
  - fund cash falls by the fee;
  - exactly one `revenue` row and one `payroll` row are posted for period 1;
  - company cash moves by fee minus payroll;
  - personal cash is unchanged.
- `harvest` / `close`:
  - the new status is `harvesting` / `closed` (with `closedWeek` set);
  - fund cash goes to 0, and the returned amount is booked once in `undeployedReturned` and `distributed`;
  - the GP and LP shares are both positive and sum to the returned amount;
  - the GP share reaches personal cash;
  - company cash and the ledger are unchanged.
- `finance.validate` passes.

The uninterrupted week commits once, and a replay is identical.

### Negative controls

These mutations are each rejected:

- a disabled rollback;
- the GP share off by ¥1;
- company cash off by ¥1;
- leftover fund cash.

The test runs in canonical shard J, in about 140 seconds locally.

## Limits

This is Node only; there is no WebKit claim. It covers the three lifecycle transitions of a fund that made no
acquisition. Portfolio valuation, exits and deal-supply hooks in the same week are covered by their own tests, not
here. It does not certify S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
