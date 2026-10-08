# P3-4-002 — Share-swap closing lacks the outer rollback boundary

**Status: BLOCKED / FAIL — newly reproduced P1; no production fix or cutover activated.**

Investigation base: `21d011081a06e74d16812600f072e8050862a579` (merged #915).
Tracker: #909. This identifier is an investigation label, not an approved implementation completion.

## Reproduction

Run from the repository root:

```sh
node docs/economic-engine/reproductions/p3-4-002-share-swap-save-failure.cjs
node docs/economic-engine/reproductions/p3-4-002-share-swap-save-failure.cjs --assert-fixed
```

The first command prints diagnostic evidence; its exit zero does **not** mean safety PASS.
The second asserts complete live rollback plus durable/reload economic parity and is RED on
the investigation base. This standalone diagnostic is not registered as a passing canonical
acceptance test. Promote it into an actual canonical regression when implementing the correction.
All data resides in isolated harness memory; no existing player saves are accessed or changed.

The fixture loads the full production script order, builds an accepted ordinary-company
share-swap deal, obtains approval through the final installed board method, saves/flushed the
baseline, and calls the final installed `closeMADeal`. The target price is JPY100,000,000 and
the player share price JPY1,000. Company cash remains JPY500,000,000 and debt zero.

| Observation | Before | Mirror SecurityError | Change-event throw after accepted save |
|---|---|---|---|
| Closing result | — | `true` despite rejected save | throws |
| Live issued shares | 1,000,000 | 1,100,000 | 1,100,000 |
| Live M&A subsidiaries | 0 | 1 | 1 |
| Live deal status | accepted | acquired | acquired |
| Acquisition / equity receipts | 0 / 0 | 1 / 1 | 1 / 1 |
| Mirror / durable immediately after failure and flush | prior state | prior state | acquired state |
| Fresh-context hydration after ordinary later save | — | acquired state | acquired state |

The event fault specifically throws only for the final no-argument `emit()`; earlier
`notify` and `saved` events are allowed to complete. Fresh hydration uses a separately loaded
VM browser context sharing the durable map and a copy of the mirror, then the production
IndexedDB hydration and `TycoonEngine.load()` boundary.

## Cause and scope

`app.js` invokes `closeMADeal` directly. The final board wrapper validates approval and
delegates. `ma-acquisition-financing.js` explicitly delegates share swaps to its captured
base before creating the shadow/checkpoint boundary used for financed cash acquisitions.
The ordinary target PE wrapper also delegates. `ma-deal-room.js` then issues shares,
posts both noncash acquisition/equity entries, creates the subsidiary and closes the deal,
but ignores `save() === false` and has no outer rollback for either save failure or final
event failure. The common storage adapter protects rejected save candidates, but cannot
restore economic mutations performed by a caller without a transaction.

The P3-3 writer contract already warned that the financed-cash shadow guarantee did not
cover share swaps. This investigation confirms the concrete P1 impact. It does not disprove
the common rejected-candidate correction in #915; it prevents extending that correction's
evidence to all M&A or declaring the P3-4 family complete. Other direct writer paths listed
in P3-3 require their own tests; their safety is not inferred from this reproduction.

## Proposed correction and stop boundary

Use the existing common `runTransaction`/`checkpointSaveStorage` boundary around the actual
ordinary acquisition settlement, including quantity, journal, status, subsidiary, final save
and notification work. Preserve the financed-cash shadow path, PE-specific settlement,
existing accounting keys, duplicate guards and RNG order. Cover installed close/complete
and compatibility entry paths; avoid a compensating save or a mirror-only restoration.
Check nested/canonical boundaries before choosing the installation point.

Require canonical registered RED-to-GREEN tests for normal share swap, rejected save,
post-save throw, exact mirror/cache/durable preservation, pre-existing queued writes,
subsequent save, reload/fresh hydration and duplicate replay; retain the #915 financed-cash
regression and run P0.5/P1/P2, applicable CI/WebKit and independent diff audit.

Per the owner's explicit new-P0/P1 stop instruction, ownership cutover and production
implementation stopped after isolating and recording the defect. Owner decision needed:
authorize prioritizing this independently scoped P1 settlement-boundary correction before
resuming P3-4. No save-format, economic policy, data repair or main merge is proposed here.
