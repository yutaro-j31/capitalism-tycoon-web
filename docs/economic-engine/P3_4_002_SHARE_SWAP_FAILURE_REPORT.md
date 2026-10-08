# P3-4-002 — Share-swap closing lacks the outer rollback boundary

**Status: correction implemented; Gate PENDING until CI/audit/merge/main evidence on #909.**

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
the investigation base, GREEN with the correction. The registered canonical regression is
`tests/ma-share-swap-save-atomicity-test.js`; the standalone script retains the original diagnostic.
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

The original event fault specifically throws only for the final no-argument `emit()`; earlier
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

## Implemented correction and authorization

Owner approved the independent correction on 2026-10-08 18:01 JST. Use the existing common
`runTransaction`/`checkpointSaveStorage` boundary around the actual
ordinary acquisition settlement, including quantity, journal, status, subsidiary, final save
and notification work. Preserve the financed-cash shadow path, PE-specific settlement,
existing accounting keys, duplicate guards and RNG order. Cover installed close/complete
and compatibility entry paths; avoid a compensating save or a mirror-only restoration.
The boundary starts in the deal-room ordinary `completeTargetAcquisition`, before `ensure`
and the existing guards. The callback contains unchanged economic work and notifications;
the existing common transaction performs its single final save/change event. It returns
false on rejected final save and restores the live snapshot and storage checkpoint on
work/save/event throw. No compensating save or storage-specific M&A recovery was added.
The `change` event retains the same type as the original no-argument emit.

The financed-cash wrapper still uses its existing shadow; the inner transaction executes
against that shadow and its no-op save/emit, while the live outer commit/checkpoint remains
in the financing wrapper. An already open transaction shares its outer snapshot/save boundary.
No common storage implementation, sequence/recovery policy, economic quantity calculation,
receipt key, target truth draw or duplicate condition is changed.

Require canonical registered RED-to-GREEN tests for normal share swap, rejected save,
post-save throw, exact mirror/cache/durable preservation, pre-existing queued writes,
subsequent save, reload/fresh hydration and duplicate replay; retain the #915 financed-cash
regression and run P0.5/P1/P2, applicable CI/WebKit and independent diff audit.

The initial investigation stopped per the owner's new-P0/P1 instruction. Implementation
resumed after explicit authorization. Gate PASS and post-merge main CI remain required;
Ownership Authority Cutover is still stopped. No save-format, economic policy or data repair.

## Related caller audit and validation scope

| Surface inspected | Current boundary / effect of this correction |
|---|---|
| App close, final board/financing/non-PE wrappers, direct final complete | All ordinary share swaps reach the changed settlement; close and complete tested. |
| Financed cash M&A | Existing shadow/checkpoint retained; #915 and accounting/save/determinism regressions unchanged and executed. |
| P2 buyback/dividend, difficulty IPO, canonical week, crisis issuance | Existing shared transaction callers; no global wrapper added; #915, P0.5/P1/P2 and transaction tests retained/executed. |
| PE-specific acquisition | Separate fund settlement returns before the ordinary writer; this correction neither adopts nor changes its fund authority. Existing PE acquisition suite executed. |
| Legacy engine `acquireTarget`, direct stock trades/split/founder sale/investor offer, raw margin helpers | Distinct P3-3 inventory surfaces with direct save patterns; outside this deal-room closing correction. Static audit records their boundaries, not verified whole-family atomicity. New ownership capabilities remain disabled; P3-4 must prove each before cutover. |

New canonical tests cover installed close/complete and enclosing transaction, mirror rejection,
partially admitted enqueue false/throw, accepted save then throw, saved/change event throws,
journal mutation then throw, complete snapshots/raw mirror/cache/durable bytes, existing in-flight
write preservation/cancellation, sequence gaps, consecutive save, subsequent retry, duplicate
operation, fresh VM hydration, and failed-close/retry/week replay with host/simulation RNG parity.
New iPhone WebKit regression uses real IndexedDB transaction completion, exact rollback bytes,
reload, consecutive saves and a new browser context seeded through Playwright's exported
mirror/IndexedDB storage state; it also executes a normal close, duplicate rejection and reload.
It is registered in both M&A PR and post-merge comprehensive workflows, retaining existing gates.

Local executed PASS: registered Node regression, original diagnostic `--assert-fixed`, unchanged
#915 storage regression, M&A deal-room accounting/save/determinism, financed-M&A atomicity/
accounting/determinism/save, board and PE acquisition, transaction regression, old-v9/save/load/
compaction/authoritative-IDB boot, P0.5 persistence replay, P1/P2 Acceptance, syntax/static and
registration/shard contracts. New Node regression was RED on pristine main before the fix.
Local WebKit could not launch because system browser libraries were absent and the environment
could not install OS packages; no local WebKit PASS claimed. Actual CI browser execution is
required before merge. All final CI/audit/merge/main evidence belongs in the PR and #909.
