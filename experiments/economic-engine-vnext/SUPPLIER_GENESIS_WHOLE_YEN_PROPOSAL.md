# vNext supplier entities and new-game opening — whole-yen implementation proposal

2026-10-22 JST. Tracker: [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).
**Design only; no new writer, ledger posting, or execution authority.**

## Current gate and contract

Authoritative rounding policy:
[`YEN_CEILING_ROUNDING_CONTRACT.md`](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/c4f0d16da78837d182e6a92e3c562483ef44c171/docs/economic-engine/YEN_CEILING_ROUNDING_CONTRACT.md),
merged by [#1074](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1074),
main `c4f0d16da78837d182e6a92e3c562483ef44c171`.
Its header still says PROPOSED, but explicitly becomes approved when the Owner
merges the adding PR; that merge has occurred. This proposal does not change it.

Section 10 says: **Until R0 and R1 are DONE, do not start or merge Economic
Engine work that adds or changes a writer of cash, debt, ledger rows or settled
amounts.** Read-only contracts may proceed. At this check R0 [#1076](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1076)
was OPEN/unmerged at `702629c880c476bd9e27afeaad6ecb2d9211cbab`; R1 remained TODO.
The supplier-genesis writer draft was not committed or published. This PR adds
only this specification, not the paused code or its incomplete test run.

Parent observation [#1072](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1072),
HEAD `fd907cebca8b5c4bc76b061447e455176ee6ff21`, has 20 successful native checks
and two expected skips, including Release Readiness PASS. It established 13
weekly supply boundaries, 77 lot net book reductions, and historical COGS
¥5,120,980.01. These remain historical observations, not new whole-yen postings.

## Proposed new-game model

Create independent fictional NPC suppliers as part of a **declared new-game
scenario**. This supplies game-model identities where the old catalogue had no
independent entity accounts. A catalogue match never authenticates an old payee.

| Catalogue ID | Proposed NPC entity ID | Proposed settlement account |
|---|---|---|
| `low_cost` | `supplier-low-cost` | `supplier-low-cost:cash` |
| `quality_farm` | `supplier-quality-farm` | `supplier-quality-farm:cash` |
| `quick_local` | `supplier-quick-local` | `supplier-quick-local:cash` |
| `reliable_national` | `supplier-reliable-national` | `supplier-reliable-national:cash` |
| `balanced_wholesale` | `supplier-balanced-wholesale` | `supplier-balanced-wholesale:cash` |

These are virtual NPC cash accounts, not authenticated bank accounts. No bank
entity or bank balance is implied. All five start with zero cash; receipt of a
buyer payment increases only the named supplier's cash. Unknown catalogue IDs,
duplicate entity mappings, buyer/self-supply aliases and caller-supplied payee
overrides are rejected. No silent fallback to `balanced_wholesale`.

NPC production costs, stock, credit underwriting and owner equity are a later
model concern. The initial model may recognize supplier revenue on receipt as
the existing isolated supply adapter does, but cannot claim a complete supplier
operating simulation or product-market calibration.

Founder, operating company and suppliers remain separate entities. Declared
founder starting wealth is an explicit scenario endowment, not reconstructed
historical cash. Company starts with zero cash and receives actual paid-in share
capital from founder, using the existing unified equity journal. Supplier cash
starts at zero without invented topups. Initial inventory starts at zero and is
acquired through explicit cash purchase receipts; no opening-equity adjustment
or suspense account is allowed to plug physical inventory.

The investment-company route can start with an empty purchase list and no store.
An operating company can own multiple stores, each inventory account attributed
to its stable store ID while payments use the single company cash authority.

## Monetary boundary under the approved contract

1. The public proposal and future new-game commands express monetary amounts in
   **JPY**. Rates, quantities, per-unit quotes and estimates keep their precision.
2. At settlement, use the shared `economicOperation.ceilYen(rawJPY)` once.
   Do not copy its implementation, use bare `Math.ceil`, or first quantize to cents.
   Negative settled amounts round magnitude away from zero; float noise snaps as
   specified in §2, including the 1e-9 threshold and ¥0.005 maximum tolerance.
3. Reuse that exact settled amount on both parties' cash legs, inventory,
   payable/receivable, P&L and receipts. Never round the buyer and seller separately.
4. Existing isolated core uses `unit='JPY-0.01'`. A dedicated future boundary
   adapter can encode a settled whole-yen amount as `yen * 100`, checking safe
   integer bounds before writing. Every new settlement and genesis money operand
   must therefore be a multiple of 100 core units. This is **encoding**, not cent
   settlement or a migration of the entire prototype core. Historical source
   evidence and prior raw experimental states remain unchanged.
5. The adapter consumes the canonical shared helper via an explicit dependency;
   it must not import production runtime or saves into the pure experimental core.
   Actual helper equivalence is tested after R0/R1. If its runtime or dependency
   shape changes, inspect the merged R0 implementation before choosing wiring.
6. Compute gains, ending balances, fee remainders and cash deltas from settled
   components without rounding them again. For capped debt/expense operations,
   round the due first, then cap. A whole invoice purchase that exceeds cash is
   rejected; do not shrink only its payment while granting full inventory.
7. If splitting a rounded receipt among lots or recipients, use shared
   `allocateYen` with explicit stable IDs. Round the aggregate once, floor exact
   shares, allocate residual yen by largest remainder and ascending stable ID.
   For a charge/remainder split, round aggregate and charge, cap charge to final
   total, and derive remainder by subtraction. No independent rounding per part.

Example proposed scenario, independent of the old observed amounts:

| Transaction | Exact whole-yen result | Existing core encoding |
|---|---|---|
| Declared founder starting wealth | ¥800,000 | 80,000,000 |
| Founder pays company share capital | ¥500,000 | 50,000,000 |
| Initial raw invoice ¥100.004 | `ceilYen` → ¥101 | 10,100 |
| Founder cash after subscription | ¥300,000 | 30,000,000 |
| Company cash after purchase | ¥499,899 | 49,989,900 |
| Supplier cash after receipt | ¥101 | 10,100 |
| Company opening acquired inventory | ¥101 | 10,100 |

Global cash remains ¥800,000. Subscription creates a founder investment and
company paid-in capital, not extra cash. Procurement moves ¥101 between the
company and supplier and records inventory/revenue. A later COGS expense consumes
inventory without a second supplier cash payment. Any lot allocation sums to
the single ¥101 receipt.

## Historical evidence remains historical

The source store's week-4 physical stock ¥134.83, original two emergency cash
receipts ¥263,513.17 and 13 COGS rows ¥5,120,980.01 are not rounded, normalized,
or promoted into a new whole-yen genesis. They continue to describe a pre-R9
source simulation. Rounding aggregate old balances would create/destroy money
and would invalidate the source receipt digests and comparison baselines.

The partial legacy replay remains **53 finance rows posted / 96 held**. A new
declared scenario passing all checks is not permission to call those 96 rows
replayed. New evidence class must be `DECLARED_SCENARIO_ONLY`, with
`legacyParity=false`. Scenario configuration cannot override these labels or
submit legacy save input. Pre-R9 monetary behavior remains governed by contract
§1.1; do not reject or normalize old production saves in this experiment.

## Implementation sequence once gates open

1. Recheck current main, R0 and R1 DONE/merged status, open rounding PRs and
   applicable AGENTS instructions. Do not duplicate another agent's slice.
2. Inspect the shared helper's merged implementation and injection/wiring options.
   Any authoritative file still owned by a pending R2–R9 slice remains blocked
   under §10.3. Keep this implementation under the existing isolated vNext scope.
3. Implement the declared supplier registry and genesis adapter using whole-yen
   settlement at the command boundary. Reuse unified share issuance and supply
   journals; do not create a second balance authority.
4. Stage all capital/initial procurement against new private state. Require a
   persistence-admission result before exposing success. Rejection/throw exposes
   no successful new game; this only proves admission, not durable IDB rollback.
5. Run focused cash-conservation, per-entity double-entry, duplicate receipt/order,
   unknown supplier, solvency, source-label, no-store and multi-store tests.
   Verify ceilYen's fractional/subcent/noise/large-value cases against the actual
   shared helper, exact ×100 encoding, capped operations and allocation ties.
6. Assert whole-yen public balances and whole-yen-equivalent journal legs after
   each operation. Repeat identical inputs for determinism. Preserve original
   source-fixture evidence separately; no fixture changes merely to get green.
7. Maintain Draft/unmerged status, exact-HEAD native CI, direct experimental Node
   execution and explicit reviewer limits. #1074's R0–R9 merge authorization does
   **not** grant a vNext production merge or cutover under #1038.

## Validation of this specification

This slice changes no executable files. Checked the merged rounding contract,
R0 PR status, parent CI, isolated core account/ID and monetary-unit interfaces,
existing supply/equity journal APIs, catalogue names and the table arithmetic.
No new writer runtime result, whole-yen migration PASS, independent review,
full legacy parity, production save durability or physical iPhone test is claimed.
