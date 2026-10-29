# Phase 3 P3-4 — routing design for the remaining player-common writers

**Status: decided. No code changes in this memo.** The Owner delegated the choice on 2026-10-29; the recommended
option of each section is adopted, in the proposed order below. This memo covers the four player-common quantity writers
that are not yet routed through the verification legs of `PHASE_3_P3_4_OWNERSHIP_APPLY.md`. The Owner asked on
2026-10-29 for a design memo before these are implemented, because each one differs from the writers routed so far.

Writers routed so far share three properties:

- they are player commands;
- they run inside `runTransaction`;
- refusing the command only refuses that one action.

None of the four writers below has all three. Statements marked CODE come from reading `origin/main`. Statements
marked PROBE come from a local, uncommitted script run against the installed runtime.

## 1. W-MA-EQUITY/SH — M&A public equity raise

**Where:** `executeFinancing` (`js/ma-acquisition-financing.js`), called from the financing wrapper of
`completeTargetAcquisition`.

**Boundary (CODE):**

- The wrapper clones the live state into a shadow engine (`Object.create(this)` with `shadow.g` set to the clone).
- It runs `executeFinancing(shadow, …)`, then the inner completion, then `finance.validate`.
- It then calls `replaceState`, saves, and restores a checkpoint on failure.
- `executeFinancing` runs **before** the inner completion's `runTransaction`, so the shadow is not in a transaction.
  `beginOwnershipLeg` therefore returns `null`, and the leg is never checked.
- The issuance uses `engine.issueSharesToExternalHolders`. Since #1204 that helper mirrors the listing's own market
  row, so the planner can observe the result.

**Options:**

| Option | What changes | Risk |
| --- | --- | --- |
| A. Leg around the issuance inside a shadow `runTransaction` | `executeFinancing` wraps only its equity block in `shadow.runTransaction`. The shadow's `save` is already a no-op. | The shadow's transaction would snapshot and restore the shadow state only. That is harmless, but it adds a second boundary inside the custom one. |
| B. Leg checked by the wrapper | The wrapper plans the leg on the live state before cloning. It confirms against `shadow.g` after `executeFinancing` and the inner completion, before `replaceState`. A mismatch throws into the existing rollback. | Needs a confirm that accepts a state rather than an engine in a transaction (a small API addition). The plan's source fingerprint is from the live state; the shadow is an exact clone, so it is admissible. |
| C. Defer | Leave the raise unrouted until §1 decides whether the shadow boundary is admissible (Track A audit: "how §1 treats it is undecided"). | No verification for one `external-issue` writer. |

**Recommendation: B.** The verification sits on the boundary that actually owns rollback, it adds no nested
transaction, and a mismatch reuses the existing, tested rollback path (save-false, mirror and enqueue faults in
`ma-equity-raise-shadow-atomicity` and `save-storage-commit-atomicity`).

## 2. W-TURNAROUND-RATCHET — weekly turnaround-fund ratchet

**Where:** `settle` (`js/player-crisis-turnaround-fund.js`), run after the base `advanceWeek` chain.

**Boundary:**

- PROBE: during `advanceWeek`, `updateOwnershipRatios` runs with `inTransaction()` true, so a leg would plan.
- CODE: refusing it fails `advanceWeek`. The week is deterministic, so the next attempt refuses again. **A false
  refusal would stop the game from advancing.**

**Mirror gap (CODE, not reproduced):**

- `settle` raises `sharesOut` after the base chain, and therefore after `updateMarket`.
- Acceptance requires an unlisted company, but `ipoMissingReasons` does not check an active fund. A company that
  lists during the fund term and then misses its plan would therefore keep a stale own market row until the next
  week.
- A leg would refuse that week, on every attempt.

**Options:**

| Option | Behaviour on mismatch | Risk |
| --- | --- | --- |
| A. Refuse (same as commands) | The week fails and rolls back. | Can block progress forever. Must first fix the mirror gap (mirror in `settle`, or route through `issueSharesToExternalHolders`, which also dilutes the competitor stake; that is a gameplay change). |
| B. Record only | The week commits. The mismatch is appended to a bounded diagnostic record (state field or news) and surfaced in tests. | Not a guard; a defect would persist. Needs a new state field or reuse of an existing log (save-shape decision). |
| C. Refuse only the ratchet | On mismatch, restore the ratchet's own fields and let the week commit without the ratchet. | Silently changes gameplay (the fund would not receive shares). Not recommended. |

**Recommendation: fix the mirror gap first, as its own PR, then A.**

- The mirror fix mirrors `issuedShares`/`marketCap` in `settle`, as #1204 does for the issuance helper. It does
  not change dilution.
- After that, a mismatch can come only from a writer defect, and refusing the week is the same guarantee the
  command writers give.
- If the Owner considers a blocked week unacceptable even for a defect, choose B instead.

## 3. W-MARGIN-LIQ / W-MARGIN-RAW — forced margin liquidation

**Where:** `liquidate` and `processWeek` (`js/personal-stock-margin.js`). The weekly path is called from the
personal-property weekly loop (`js/expansion.js`).

**Boundary:**

- PROBE: the weekly path runs inside the `advanceWeek` transaction.
- CODE: `liquidate` and `processWeek` are also exported and can be called directly. A direct call has no transaction
  boundary (preflight GAP). A leg would then be `null` and nothing would be checked.
- CODE: one liquidation sells through `sellPersonalStockRaw` repeatedly, possibly several times on the player's own
  ticker. Each raw sale is one `personal-sell` leg.
- CODE: raw sales change only the personal lot, not `issuedShares`, so there is no mirror gap.
- Refusal has the same consequence as §2: a blocked week.

**Recommendation: A, with one leg per own-ticker raw sale.** Plan and confirm each leg inside the loop (the legs are
sequential, so each plans against the state the previous sale left). The direct-export GAP stays as documented;
closing it means giving the exports a boundary, which is a separate atomicity PR.

## 4. W-IPO-BASE / W-IPO-CHAIN — IPO

**Where:** `executeIPO` (`js/engine.js`), reached through the difficulty → PE network → PE fund wrappers. The outer
wrapper owns the transaction.

**Blocker (CODE):**

- `js/phase3-ownership-apply.js` excludes `ipo` from `KINDS`, so `beginOwnershipLeg` returns `null`.
- The planner already plans `ipo` (issued and founder-secondary quantities plus the listing ticker).
- The apply module excludes it because the listing record and the personal-lot rebinding stay with the existing
  writer (`listingRequirement`).

**Options:**

| Option | What changes | Risk |
| --- | --- | --- |
| A. Verification-only `ipo` leg | Allow `ipo` in `beginOwnershipLeg`/`confirmOwnershipLeg` only. `applyOwnershipPlan` keeps refusing it. Confirm checks `sharesOut`, `founderShares`, the new listing row and its `issuedShares`. | Changes the apply module's public contract (its unit test asserts `begin(..., {kind:'ipo'})` is `null`). |
| B. Defer IPO to activation design | IPO stays unrouted until the activation PR designs listing creation. | IPO is the only writer that creates the mirror, so the verified set has a gap. |

**Recommendation: A.** Verification does not write anything, so the reasons for excluding `ipo` from application do
not apply to verification. The unit assertion changes from "`ipo` is never planned" to "`ipo` is verified but never
applied".

## Proposed order

1. W-MA-EQUITY/SH, option B.
2. Ratchet mirror fix (own PR), then W-TURNAROUND-RATCHET, option A.
3. W-MARGIN-LIQ / W-MARGIN-RAW, option A.
4. W-IPO, option A.

Each is one PR with the same evidence pattern used so far:

- unchanged success;
- a write skewed by one share is refused and rolled back;
- a second-generation company is unchanged;
- the routed-file guard is updated.

## Limits

This memo does not route any writer, activate the authority, grant S_PASS, or certify P3-10, Phase 3 Exit or
Phase 4 Entry. The PROBE observations were made with a local, uncommitted script. They are not registered tests.
