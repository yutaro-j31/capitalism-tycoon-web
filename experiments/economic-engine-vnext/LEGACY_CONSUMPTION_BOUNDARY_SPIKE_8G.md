# SPIKE-8G — observed intraperiod supply boundaries

2026-10-22 JST. Tracking [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).
Parent Draft [#1070](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1070),
HEAD `973436f2bcda3e2525834d9d6c93533c6ad85169`:
20 successful native checks, two expected skips, Release Readiness PASS.
Latest main observed before this slice: `2690051553cace388b7fb82d46179d80a94308a3`.
This is a stacked experiment, not a mainline integration or authority cutover.

## What is observed

The exported `supply.consume` property cannot intercept the lexical internal
`consume()` invoked by `finalizeConstraint()` in `js/supply.js`. Claiming otherwise
would fabricate event-level evidence. This slice instead wraps the exported
`supply.applyConstraint` and `finance.event` properties **inside a fresh disposable
test VM only**. Source files under `js/` and the harness remain unchanged.

Opt-in `--consumption-boundary` captures selected-store lot images at:

1. Entry to the supply constraint call, after weekly spoilage and regular receipts.
2. After each actual in-call emergency/regular receipt finance event, so the
   last receipt image isolates subsequent consumption from the newly received book.
3. Return from the original constraint call, retaining its original result.

Observers retain `this`, arguments and return identity, propagate original
exceptions, and restore both exported functions in `finally`. Snapshots do not
write game state or consume RNG. Observer IDs identify experimental **boundary
calls**, never durable original consumption IDs.

The verifier requires 13 ordered selected-store/week calls, unique source-linked
receipt IDs, exact cent arithmetic, stable lot ancestry, no unexplained new lots
or increases during consumption, and matching returned COGS, lot book reductions
and original weekly finance COGS. Merged/null PO consumption ancestry is blocked.
`runAuthenticated()` additionally executes the preceding original 138-row/source
graph/lot-authority checks and matches all trace lot POs, materials, store and
contract IDs to original source purchase orders. A mock-only `verify()` result is
explicitly `BOUNDARY_CONTRACT_ONLY`.

These are structural/source consistency checks on supplied observations, **not
cryptographic attestation of arbitrary JSON**. Reproduce the harness run before
using a supplied trace as observational evidence.

## Executed validation

Actual local **Node v24.19.0**:

- **503/503** experiment tests PASS: previous 479 plus 24 boundary tests.
- Genuine seeded disposable original-game 13-week observation + authenticated
  boundary CLI: `SOURCE_CONSUMPTION_BOUNDARY_PARTIAL`, **13/13** weeks.
- **77** per-lot boundary net book reductions across those weeks sum to
  **512,098,001 minor JPY = ¥5,120,980.01**, identical to original COGS.
- Two observed in-call emergency receipt events, both in week 5, are separated
  from consumption. The week-5 reductions include original opening lots
  `lot-6`/`po-6` (¥70.67), `lot-7`/`po-7` (¥64.16) and newly received
  `lot-8`/`po-13`, `lot-9`/`po-14`.
- Unknown-PO substitution in a genuine observation is rejected with
  `boundary-lot-PO-not-in-original-source`.
- Traced and untraced complete observational outputs are deeply identical
  after removing only the additional `consumptionBoundaryEvidence` field.
- Repeated traced executions are byte-identical. Final diff whitespace check PASS.

Commands:

```sh
node experiments/economic-engine-vnext/legacy-consumption-boundary.test.cjs
node experiments/economic-engine-vnext/legacy-13week-headless.cjs --consumption-boundary > /tmp/vnext-boundary.json
node experiments/economic-engine-vnext/legacy-consumption-boundary-cli.cjs /tmp/vnext-boundary.json
```

Ordinary PR CI does not execute these isolated suites automatically; its native
Release Readiness must be checked independently on this slice's final HEAD.
Previous Node 22 laboratory checks are not execution evidence for this new code.
This slice has author diff inspection, not an independent reviewer result.

## Completion boundary and next concern

**Zero new canonical postings.** Previous partial core remains 53 original
finance rows posted / 96 held. Boundary net deltas narrow the intraweek gap but
do not prove every individual internal consume operation, hidden merge ancestry,
or full legal ownership/funding of inventory. Catalog suppliers still lack an
authorized external legal-entity/payment-account mapping. Material opening
financial authority, full ledger parity, IDB durability, old saves, WebKit and
production cutover are not proved. Keep this PR Draft and unmerged.

Next concern: prepare a concrete, reviewable supplier legal-entity and material
opening authority proposal before promoting the two cash purchases or 13 COGS
rows into canonical postings. Do not fill missing balances with fabricated cash,
suspense accounts, or equity. Further observation may proceed without inventing
those economic-design decisions.
