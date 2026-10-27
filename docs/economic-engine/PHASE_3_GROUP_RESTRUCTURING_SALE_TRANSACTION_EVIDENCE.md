# P3-4: group restructuring sale evidence (W-GROUP-DISPOSAL, sale)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`executeGroupRestructuringSale(id)` (`js/group-restructuring-candidates.js`) runs in one transaction.

- **Listed subsidiary:** the sale delegates to the installed market sale (`sellListedSubsidiaryStake`). That path is
  covered by the W-SUB-MARKET evidence.
- **Unlisted subsidiary:** the parent sells its whole stake at the valuation less an 8% private-sale discount, rounded
  up to whole yen (R6). The subsidiary is marked `sold`, with no stake and no book. One `groupRestructuringSale`
  `assetSale` row is posted: cash = proceeds, asset = −book, profit = gain. A `sale` history row is written.

The command emits `saved` and `change`. It posts no notice, so the shared `notify` fault does not apply.

This slice covers the sale only. The group-restructuring liquidation and merge commands of the same module are
separate slices.

## Pinned inputs

`tests/fixtures/group-restructuring-sale-atomicity.js` uses production writers only:

| Variant | Subsidiary | Built from |
| --- | --- | --- |
| `partial` | VC subsidiary held at 70% | `investStartup` → `makeSubsidiary`, advanced to week 12 (the subsidiary quarter fixture) |
| `whole` | wholly owned, private | prepared IPO → tender offer → squeeze-out (the W-SUB-CONTROL fixture) |

## Faults and oracles

`tests/group-restructuring-sale-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Faults:
  - per variant, the eight applicable shared faults;
  - on `whole`, also queued-predecessor and nested `save-false` / `save-throw`.
- Each failure is checked for:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the sale once.
- The success oracle is computed independently of the module's preview:
  - company cash rises by `ceilYen(valuation × stake × .92)`;
  - founder cash is unchanged;
  - the subsidiary is `sold`, with no stake and no book, and its own valuation and cash are unchanged;
  - every other subsidiary is untouched;
  - the history row is complete;
  - there is exactly one whole-yen receipt, with its operation ID;
  - `finance.validate` and standalone close pass.
- The uninterrupted sale commits once, in `saved -> change` order.
- A replay is identical.
- A second sale is refused with no change, no save and unchanged durable bytes.
- A v9 critical compaction keeps the sold status.
- Three negative controls are rejected: a disabled rollback, company cash off by ¥1, and a book left on the parent.

The test also rejects three production mutants, which are not committed: floored proceeds, a book kept on the parent,
and a stake kept on the parent.

## Limits

This is Node only; a native-WebKit counterpart is the next slice. This does not certify group-restructuring
liquidation or merge, negotiated group sales (W-GROUP-NEGOTIATED), raw/helper bypass closure, S_PASS, authority
cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
