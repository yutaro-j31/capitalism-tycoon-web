# P3-4: weekly competitor stake purchase save-fault evidence (W-WEEK-COMPETITOR)

Status: test-only evidence (Node / fake IndexedDB). No production change.

## Writer

In the installed canonical week, `updateCompetitors` (`js/engine.js`) gives each competitor a 0.5% chance to call
`buyCompetitorStake` on a listed player company. The purchase buys whole shares from the external float, capped at 49%
in aggregate. It writes:

- the buyer's named holding (`ownedPlayerShares`);
- the buyer's cash;
- the aggregate `competitorOwnedRatio`.

The P3-4 inventory row recorded successful weekly / float / reload evidence (`tests/competitor-stake-float-test.js`) but
the full save-fault set as OPEN.

## Pinned inputs

`tests/fixtures/week-competitor-stake-atomicity.js` sets up a listed company with its own market row. There is no
company own-ticker alias, which would make the float unknown. The simulation RNG is reseeded to a pinned seed whose
next week makes exactly one purchase.

| Variant | Seed | Starting competitor stake | Purchase |
| --- | --- | --- | --- |
| `fresh` | 60 | 0% | competitor-0 buys 873 shares |
| `held` | 109 | 20%, spread over the named holdings | competitor-2 buys 915 shares |

A delegating observer requires the actual installed purchase inside the week transaction, and records the stock price
at that moment. Later passes of the same week move the price again.

## Faults and oracles

`tests/week-competitor-stake-save-atomicity-test.js` uses the shared harness (`tests/helpers/transaction-fault-case.js`).

**Faults:**

- Per variant, all shared faults except `change` and `notify`. The canonical week's terminal event is `week`, and the
  purchase has no notice. This matches `tests/vc-round-close-week-save-atomicity-test.js`.
- On `held`, also queued-predecessor and nested `save-false` / `save-throw`.

**Each failure is checked for:**

- full live rollback, including RNG and the competitor's holding and cash;
- unchanged mirror, cache and durable bytes;
- a cancelled failed put;
- production reload and fresh durable-only hydration;
- a recovery save above every allocated failed sequence;
- a retry that commits the week once.

**Success oracle.** It compares the week against the same seed and state with the purchase disabled. The purchase
draws no RNG, so every other weekly effect is identical. The oracle checks:

- only the buyers' named holdings and cash differ;
- each buyer gains whole shares equal to the observed purchase and pays that quantity × the observed price;
- nothing else about the buyer changes;
- the aggregate ratio grows by exactly the filled quantity over issued − treasury, within the 49% cap;
- issued, founder and treasury shares, the stock price, the market, company and personal cash and the ledger match the
  week without the purchase;
- the ratios sum to 1, the RNG matches, and `finance.validate` passes.

**Command-level checks:**

- The uninterrupted week commits once.
- A replay is identical.

**Negative controls (all rejected):**

- a disabled rollback;
- the aggregate ratio one share off;
- the buyer's cash off by ¥1,000.

The test runs in canonical shard A, the default for unassigned tests (about 91 seconds locally; shard J's entry count is fixed by the runner contract tests).

## Limits

This is Node only, with no WebKit claim. It covers the weekly purchase path only. It does not route the purchase
through a P3-4 ownership verification leg: the competitor stake is not one of the planner's buckets. It does not
certify W-WEEK-PE, S_PASS, authority cutover, P3-10, Phase 3 Exit or Phase 4 Entry.
