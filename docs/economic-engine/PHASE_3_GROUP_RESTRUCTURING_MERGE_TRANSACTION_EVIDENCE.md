# P3-4: group restructuring merge evidence (W-GROUP-DISPOSAL, merge)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`executeGroupRestructuringMerge(aID, bID)` (`js/group-restructuring-candidates.js`) runs in one transaction. It merges
two active, wholly owned, private subsidiaries that are not PE-managed. The pair is ordered by ID, so the argument
order does not matter.

The company pays an integration cost of `ceilYen(max(¥5,000,000, combined valuation × 3.5% same-business / 5%
otherwise))` (R6). One `groupRestructuringMerge` row is posted, with cash and profit both −cost and no asset effect.

Both subsidiaries are replaced by one `restructured-<a>-<b>` subsidiary. The merged subsidiary:

- keeps the sum of both books;
- keeps their combined cash;
- takes the combined valuation and weekly profit, lifted by the installed same-business or cross-business rates;
- takes the averaged growth and the reduced risk;
- carries both integration-synergy round counts;
- records its source pair and week.

A `merge` history row is written. The command emits `saved` and `change` and posts no notice, so the shared `notify`
fault does not apply.

## Pinned inputs

`tests/fixtures/group-restructuring-merge-atomicity.js` spins both internal ventures of the W-INTERNAL-VENTURE spin-off
fixture out with the installed `spinOffInternalVenture`. This gives two wholly owned private subsidiaries from
production writers only. There is no measured pair synergy. The variants pass the pair `forward` and `reverse`.

## Faults and oracles

`tests/group-restructuring-merge-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`).

Fault coverage:

- per variant, the eight applicable shared faults;
- on `forward`, also queued-predecessor and nested `save-false` / `save-throw`.

Each failure must show:

- full live rollback, including RNG;
- unchanged mirror, cache and durable bytes;
- a cancelled failed put;
- production reload and fresh durable-only hydration;
- a recovery save above every allocated failed sequence;
- a retry that commits the merge once.

The success oracle is computed independently of the module's preview:

- company cash falls by the whole-yen integration cost, and founder cash is unchanged;
- both subsidiaries leave the list and exactly one merged row replaces them;
- the merged book is the sum of both books;
- the merged valuation, weekly profit, cash, growth, risk, synergy rounds, source pair and week match the installed
  rates;
- the history row is complete;
- there is exactly one whole-yen cost row, with no asset effect;
- `finance.validate` and standalone close pass.

Further checks:

- The uninterrupted merge commits once, in `saved -> change` order.
- A replay is identical.
- Both argument orders commit the same state.
- Merging the merged pair again is refused, with no change, no save and unchanged durable bytes.
- A v9 critical compaction keeps the merged subsidiary.
- Three negative controls are rejected: a disabled rollback, company cash off by ¥1, and a merged book off by ¥1.

Production mutants (not committed) that the test rejects:

- a floored cost;
- one book lost;
- the second subsidiary left in the list.

## Limits

Node only; a native-WebKit counterpart is the next slice. This does not certify group-restructuring liquidation, which
no production path reaches from the pinned fixtures. It also does not certify negotiated group sales
(W-GROUP-NEGOTIATED), raw/helper bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
