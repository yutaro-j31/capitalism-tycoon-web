# Phase 3 P3-4 — player-common activation readiness

**Status: assessment for an Owner decision.** No code changes. Authority stays `disabled`. No S_PASS is granted.

This memo asks one question. Is the player-common ownership authority (`applyOwnershipPlan`,
[PHASE_3_P3_4_OWNERSHIP_APPLY.md](PHASE_3_P3_4_OWNERSHIP_APPLY.md)) ready for row 6 of the activation order in
[PHASE_3_P3_4_PREFLIGHT_AND_DESIGN.md §3.2](PHASE_3_P3_4_PREFLIGHT_AND_DESIGN.md)?

Row 6 needs two things:

- "all rows that mutate its facts completed";
- "targeted review + Owner decision".

The Owner decided on 2026-10-22 (§5 of that document) that activation follows complete family S and a targeted
review. The answer below is **not yet**. It lists what remains.

Every row marked CODE comes from reading `origin/main` at `00fea46b`.

## 1. What is done

These writers are routed in verification mode. Each plans its fact leg inside a rollback boundary, and a mismatch
refuses the command or the week. The table in the apply document lists them with their PRs.

| Fact leg | Writers |
| --- | --- |
| `founder-sale` | W-FOUNDER-SALE |
| `personal-buy` / `personal-sell` | W-BUY / W-SELL; W-MARGIN-LIQ, once for each forced own-share sale inside the week |
| `split` | W-SPLIT |
| `buyback` | W-BUYBACK, the installed one |
| `external-issue` | W-INVESTOR, W-SPONSOR, W-TURNAROUND-ACCEPT, W-TURNAROUND-RATCHET, W-SHARE-SWAP, W-MA-EQUITY/SH (through the shadow-boundary facade) |
| `ipo` | W-IPO-CHAIN, verification only; `applyOwnershipPlan` still refuses `ipo` |

Every writer in the planner's `supported` policy table is now routed.

## 2. What blocks activation

Each gap below is a way the player-common facts can still change without a planned leg. Row 6 needs every such way
closed, or explicitly ruled out of the family.

| # | Gap | Evidence | What closes it |
| --- | --- | --- | --- |
| G1 | **Second and later company generations are unchecked.** The planner refuses any state whose `currentCompanySerial` is not 1, or whose company is sold (`GENERATION_UNPROVEN`). A refounded company therefore keeps every writer unchecked. | CODE `js/phase3-ownership-planner.js` scope and state checks. Design: [PHASE_3_P3_4_NEW_GAME_GENERATION_REFOUNDING_SPEC.md](PHASE_3_P3_4_NEW_GAME_GENERATION_REFOUNDING_SPEC.md). | Either an Owner decision that activation covers generation 1 only, with later generations unchecked, or a binding for generation n first. |
| G2 | **Refounding resets the facts outside any leg.** `foundNewCompanyAfterBuyout` (W-NEW-COMPANY) and load/import/compaction/restore are `REPLACEMENT_UNSUPPORTED`. | CODE planner groups. §3.2 row 5 lists "new-company reset". | A replacement rule: the authority is invalidated and rebound on replacement, not routed as a leg. |
| G3 | **Raw entries that bypass the routed writers still exist.** | See the list below this table. | Each bypass either delegates to a routed boundary, or is removed or refused under an active authority. |
| G4 | **The margin exports have no boundary when called directly.** `liquidate` / `processWeek` called outside a transaction are unchecked. The installed week is checked. | #1212 and the apply document. | Give the exports a boundary, or make them refuse outside a transaction once the authority is active. |
| G5 | **Competitor dilution is inconsistent.** These writers raise `sharesOut` without rescaling `competitorOwnedRatio`, so the competitor's implied share count grows: W-INVESTOR, W-SPONSOR, W-TURNAROUND-ACCEPT and W-TURNAROUND-RATCHET. `issueSharesToExternalHolders` (share swap, equity raise) dilutes it correctly. | CODE. Competitor purchases need a listed company, so this matters mainly for the ratchet after an IPO during the fund term. | Route these writers' issuance through the same dilution rule. That is a gameplay-visible correction and needs its own PR. |
| G6 | **The competitor stake is not a planner bucket.** W-WEEK-COMPETITOR and W-DEFENSE are `HOLDER_UNPROVEN`, so the authority does not own the competitor stake. | CODE planner groups. | Either an Owner decision that the competitor ratio stays outside the first family, or a holder binding for it. |
| G7 | **The family S evidence is incomplete.** The S evidence manifest (#1089, open) and the family-closure test specification (#1091, open) listed 51 gaps. Many were closed by later PRs, but no current reconciliation exists. | #1089, #1091 and the merged evidence documents. | Re-run the manifest against current `main` and close or rule out every remaining gap. |

The raw entries for G3:

- `issueSharesToExternalHolders` (W-ISSUE-RAW), which the routed callers wrap;
- the dormant legacy `acquireTarget('shareSwap')` (W-ACQUIRE-COMPAT);
- the overridden base `buybackOwnShares` (W-BUYBACK-BASE);
- the base `executeIPO` (W-IPO-BASE), which is routed but reachable directly;
- the ratchet `settle` in `js/player-crisis-turnaround-fund.js` (W-TURNAROUND-RATCHET), when called outside a
  transaction;
- the raw margin sale `sellPersonalStockRaw` (W-MARGIN-RAW, `INTERNAL_ENTRY`), which is reached through the exports
  covered by G4.

## 3. Recommendation

Do not activate yet. Work in this order, one PR each:

1. **G7 reconciliation (docs).** Re-derive the remaining gaps from current `main`. This also tells whether #1089 and
   #1091 should merge as references or be closed.
2. **G3 and G4 bypass closure.** Make the raw entries refuse to write player-common facts outside a routed boundary,
   or delegate them to one. Today this changes no supported outcome, because the installed paths already go through
   routed writers.
3. **Owner decisions on G1, G2 and G6.** These are scope decisions, not code. They would **reopen approved
   decisions**:
   - §5 of the preflight approved "all player-common fact writers closed before activation" and rejected the narrow
     alternative.
   - §3.2 row 5 puts current-generation replacement inside the same authority.

   A narrower first activation is still possible. If the Owner chooses it, the recommended scope is generation 1 only,
   the competitor stake outside the family, and replacement treated as invalidate-and-rebind. That requires the Owner
   to explicitly revise those two decisions. Otherwise G1, G2 and G6 must be closed in code before activation.
4. **G5 dilution correction.** Gameplay-visible, so it gets its own PR, tests and a note in the change log.
5. **Activation PR.** Swap the writers' own quantity writes for `applyOwnershipPlan`, one fact leg at a time, behind
   the `ACTIVATION` switch. It needs a targeted independent review and the Owner's explicit decision.

Step 1 is docs only. The §5 approval covers design choices only, so each code step needs its own approval:

- step 2 changes writer entry points;
- step 4 changes gameplay;
- step 5 is the activation decision this memo prepares.

## Limits

This memo changes no code and activates nothing. It does not certify P3-10, Phase 3 Exit or Phase 4 Entry. The gaps
are from code reading and from the merged evidence documents. None was reproduced as a failure here.
