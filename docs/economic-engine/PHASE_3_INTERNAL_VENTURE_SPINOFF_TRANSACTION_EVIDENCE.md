# P3-4: internal venture spin-off evidence (W-INTERNAL-VENTURE, spin-off)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`spinOffInternalVenture(id)` (`js/internal-venture-business.js`) runs in one transaction. It turns a commercialised
internal venture (status `active`, or progress 100%) into a wholly owned private subsidiary,
`internal-sub-<venture id>`. The venture's book moves to the subsidiary unchanged, as the subsidiary's invested cost
and carrying book. The subsidiary is valued at the greater of book and venture valuation. Its growth, risk and weekly
profit are derived from the venture. The venture is marked `spun-off` and its own book drops to zero, with the
transferred amount recorded. A `spunOff` history row is written. No cash moves and no ledger row is posted.

This slice covers the spin-off only. The module's other writers are separate slices:

- venture funding, sale and withdrawal;
- parent funding of a subsidiary (`fundSubsidiaryFromParent`);
- external subsidiary rounds.

## Pinned inputs

`tests/fixtures/internal-venture-spinoff-atomicity.js` builds two ventures with production writers only. It proposes
and approves each one with the installed engine commands `proposeInternalVenture` and `approveInternalVenture`, then
runs installed weeks until both are commercialised.

The fixture sets three values by hand:

- a cash buffer;
- the investment department unlock, as in the subsidiary fixtures;
- the product department unlock, which proposals need.

The variants are the `first` and `second` venture, which have different budgets, domains and quality.

## Faults and oracles

`tests/internal-venture-spinoff-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Fault cases:
  - per variant, all nine shared faults (the command emits `notify`, `saved` and `change`);
  - queued-predecessor and nested `save-false` / `save-throw` on `second`.
- Each failure is checked for:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the spin-off once.
- The success oracle is computed independently of the module:
  - company and founder cash unchanged, and the ledger unchanged;
  - the venture `spun-off` with no book, plus the transferred amount, subsidiary link and week;
  - exactly one new subsidiary, whose every spin-off field equals the derivation from the venture;
  - the full history row;
  - `finance.validate` and standalone close pass.
- The uninterrupted spin-off commits once, in `notify -> saved -> change` order, and a replay is identical.
- A second spin-off is refused, with no change, no save and unchanged durable bytes.
- A v9 critical compaction keeps the stake, book, listing and venture status. The venture valuation is fractional, so
  a reload keeps the subsidiary's valuation in whole yen, as group restructuring's normalisation stores it.
- Three negative controls are rejected: a disabled rollback, company cash off by ¥1, and a book left on the venture.

Production mutants (not committed) that the test rejects:

- the book left on the venture;
- a 99% stake;
- the book not moved to the subsidiary.

## Limits

This is Node-only evidence; a native-WebKit counterpart is the next slice. It does not certify any of the following:

- the other internal-venture writers;
- group-restructuring merge of spun-off subsidiaries;
- raw/helper bypass closure;
- S_PASS;
- authority cutover;
- P3-10;
- Phase 3 Exit;
- Phase 4 Entry.
