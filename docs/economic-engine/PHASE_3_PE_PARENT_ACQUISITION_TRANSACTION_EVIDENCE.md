# P3-4: PE portfolio company acquisition into the group evidence (W-PE-PARENT)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`acquirePEPortfolioCompany(fundID, dealID)` (`js/pe-portfolio-operations.js`) lets the player's company buy one of
its PE fund's portfolio companies. The PE UI adapter's `acquireIntoGroup` action calls the same method. In one
transaction it:

- prices the holding at the production sale-exit value (`previewParentCompanyAcquisition`);
- pays that price from company cash;
- posts one `acquisition` row (`pe-parent-acquisition-<deal id>`): cash −price, asset +price;
- settles the proceeds through the fund waterfall (`settleExitProceeds`), which credits:
  - the fund's GP and LP distributions;
  - the co-investors' return;
  - the GP economics to personal cash;
- marks the deal exited by `parent-company-acquisition`;
- adds one wholly owned subsidiary booked at the price, and counts the acquisition;
- emits `notify`, `saved` and `change`.

An already acquired holding is refused without a write.

## Pinned inputs

`tests/fixtures/pe-parent-acquisition-atomicity.js` closes a PE fund deal with the installed deal-room flow:
`prepareAcceptedPE`, then `closeMADeal`, as in the PE fund acquisition and portfolio exit evidence. As in the portfolio
exit evidence, the 156-week maturity and an improvement score of 67 are a controlled eligibility witness, not natural
play. The state then passes through the production load, which normalises the week jump, before the command.

| Variant | Co-investors | Route |
| --- | --- | --- |
| `coinvest` | yes | `acquirePEPortfolioCompany` |
| `adapter` | yes | PE UI adapter `acquireIntoGroup` |
| `plain` | no | `acquirePEPortfolioCompany` |

`TycoonEngine.load()` binds the loaded engine to the player engine bridge. The harness reloads between attempts, so
the adapter route rebinds the command's engine before each call, as the app's single engine always is.

## Faults and oracles

`tests/pe-parent-acquisition-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Faults:
  - per variant, all nine shared faults;
  - on `coinvest`, also queued-predecessor and nested `save-false` / `save-throw`.
- Each failure is checked for:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the command once.
- The success oracle:
  - takes the price from the read-only preview before the command, and checks that it is whole yen;
  - checks that the waterfall settles the whole price, and pays co-investors only when they invested;
  - company cash down by the price;
  - the founder's cash gain equals both the fund's GP distribution and GP carry plus principal;
  - fund distribution, GP + LP split, co-investor return and PE firm co-invest capital;
  - the deal exit fields, settlement and attribution method;
  - exactly one subsidiary, wholly owned, with valuation, invested cost, book and price at the purchase price;
  - the acquisition count;
  - exactly one ledger row, the `acquisition` row with its operation and idempotency keys;
  - every other top-level state key unchanged;
  - `finance.validate` and standalone close pass.
- The uninterrupted command commits once, in `notify -> saved -> change` order.
- A replay is identical.
- A second acquisition of the same holding is refused with no change, no save and unchanged durable bytes.
- A v9 critical compaction keeps the deal exit, the fund distributions, the subsidiary and both cash balances.
- Three negative controls are rejected:
  - a disabled rollback;
  - personal cash off by ¥1;
  - a co-investor return off by ¥1.

The test also rejects a production mutant, which is not committed: an acquisition that is not counted.

## Limits

This is Node only; a native-WebKit counterpart is the next slice. The existing
`tests/pe-parent-company-acquisition-test.js` (functional) and `tests/pe-parent-company-acquisition-negative-test.js`
(mutation sensitivity) are unchanged. This does not certify the other PE writers (W-PE-FORM, W-WEEK-PE), raw/helper
bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
