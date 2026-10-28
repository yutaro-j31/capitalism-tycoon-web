# P3-4: unlisted subsidiary parent funding and external round evidence (W-INTERNAL-VENTURE, subsidiary funding)

Status: test-only Node / fake-IndexedDB evidence. No production, economic, persistence, rounding or authority change.

## Installed path

`js/internal-venture-business.js` installs two capital commands for an active unlisted subsidiary. Each runs in one
transaction, writes a subsidiary funding history row and emits `notify`, `saved` and `change`. The venture screen's
subsidiary funding buttons call them.

Both rounds are priced at the subsidiary's valuation (pre-money). Each command:

- rounds the amount (¥1,000,000 to ¥200,000,000) up to whole yen (R6);
- adds it to the subsidiary's own cash and the post-money valuation;
- applies the installed growth and risk effects.

The two commands differ in what the parent gains and pays:

- **`fundSubsidiaryFromParent(id, amount)`.**
  - The parent buys new shares and its stake rises to `(stake × pre + amount) / post`.
  - Company cash pays the amount.
  - The amount is capitalised in the parent book and invested cost.
  - Posts one `assetPurchase` row: cash −amount, asset +amount.
- **`raiseSubsidiaryExternalRound(id, amount)`.**
  - Outside investors buy new shares and the parent is diluted to `stake × pre / post`.
  - Parent cash, book and ledger are unchanged.
  - The amount is capped by the subsidiary's capacity.
  - Refused inside a 13-week cooldown, or below a 20% parent stake.

## Pinned inputs

`tests/fixtures/subsidiary-funding-atomicity.js` uses production writers only:

| Variant | Subsidiary | Command |
| --- | --- | --- |
| `parentSpun` | wholly owned, spun out of a developed internal venture (the W-INTERNAL-VENTURE spin-off fixture) | parent ¥10,000,000 |
| `parentVc` | VC subsidiary held at 70% (the subsidiary quarter fixture) | parent ¥50,000,000 |
| `externalSpun` | wholly owned, spun out | external ¥10,000,000 |
| `externalVc` | VC subsidiary held at 70% | external ¥25,000,000 |

## Faults and oracles

`tests/subsidiary-funding-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`):

- Faults:
  - per variant, all nine shared faults;
  - on `parentVc`, also queued-predecessor and nested `save-false` / `save-throw`.
- Each failure is checked for:
  - full live rollback, including RNG;
  - unchanged mirror, cache and durable bytes;
  - a cancelled failed put;
  - production reload and fresh durable-only hydration;
  - a recovery save above every allocated failed sequence;
  - a retry that commits the command once.
- The success oracle is computed independently of the module's previews:
  - the post-money valuation and parent stake;
  - the subsidiary cash, growth and risk effects, and the capital-action week;
  - founder cash and the other subsidiaries unchanged;
  - parent funding:
    - company cash down by the whole-yen amount;
    - book, invested cost and parent capital up by it;
    - exactly one whole-yen `assetPurchase` row with its operation ID;
  - external round:
    - no parent cash, book or ledger change;
    - external capital, rounds and week;
    - the dilution in the history row;
  - the full funding history row;
  - `finance.validate` and standalone close pass.
- The uninterrupted command commits once, in `notify -> saved -> change` order.
- A replay is identical.
- After the command, a follow-up is refused with no change, no save and unchanged durable bytes:
  - a second external round inside the cooldown;
  - a parent injection below the ¥1,000,000 minimum.
- A v9 critical compaction keeps the valuation, book, subsidiary cash, parent and external capital, round week, and
  company cash. The round leaves an unrounded post-money stake. The load normalisation stores ownership ratios to six
  decimals, so the reloaded stake is compared at that precision.
- Three negative controls are rejected:
  - a disabled rollback;
  - company cash off by ¥1;
  - a stake left at its pre-round value.

The test also rejects three production mutants, which are not committed:

- an injection not capitalised;
- an understated external dilution;
- an injection that is not the whole-yen amount.

## Limits

This is Node only; a native-WebKit counterpart is the next slice. This does not certify listed-subsidiary capital
actions (W-SUB evidence), raw/helper bypass closure, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
