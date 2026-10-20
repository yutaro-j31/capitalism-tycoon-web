# VC funding round — legacy truncated-history rescue: design and verification

**Status:** DESIGN / VERIFICATION ONLY. Not implemented. Needs a separate Owner decision.
**Owner decision 2026-10-20 (#1029):**
- Option (a), fail-closed hold, is the interim policy.
- Unproven subscriptions must not be converted into equity, refunded or rewritten.
- A player's legitimately paid capital must not be lost either. A rescue must therefore process only amounts proven by independent evidence, in a separate minimal-scope change.

**Base:** #1029 head `15852783` plus `5acfc31d`, which adds `getStartupFundingRoundHold()`.

Evidence levels: **[V]** verified by code reading or a Node probe on that tree; **[I]** inference.

## 1. Affected saves [V]

Before #1029 (`1df02771`), `participateStartupFundingRound()` behaved as follows:
- It accepted any number of installments per round.
- It prepended a receipt whose ID suffix was the history length, then cut `startupFundingHistory[id]` to 24 rows.
- Once a round had about 23 installments, the oldest receipts were evicted, and later receipts reused the `-24` suffix.

The pending `contributedCompany` / `contributedPersonal` and the cash debit were still recorded in full. So the retained receipts can no longer prove the pending amount. `closeStartupFundingRound()` and refounding then refuse, and the round is held.

`getStartupFundingRoundHold()` identifies these saves as `PAYMENT_HISTORY_TRUNCATED`. The signature is: 24 rows, with the round's own `-opened` row gone.

Since #1029 the writer refuses any installment that would evict a receipt, so no new save can reach this state. That fix needs no save-format change.

## 2. Independent evidence that survives the cap [V]

| # | Source | Account | What it holds | Retention / limits |
|---|---|---|---|---|
| E1 | `finance.transactions` row: `investmentPurchase`, `sourceType:'startupFundingRound'`, `sourceID: <startupID>-<roundID>-company` | company only | exact amount and week of every company installment | Kept until `compressTransactions` archives rows beyond the newest 5,000. Archived rows lose `sourceID`. |
| E2 | `g.news` line `第{week}週：{name}の{round}ラウンドへ{yen}追加出資しました。` | **both, not distinguished** | week and amount, rounded to whole yen | Cut to 300 lines, so any 300 later news lines evict it. |
| E3 | retained `startupFundingHistory` receipts | each | exact amount, week, account | Truncated; this is the defect. |
| E4 | `totalInvested{Company,Personal}` | each | cumulative cost basis, including earlier investments | An upper-bound sanity check only. It cannot isolate one round. |

There is no personal cash ledger, so personal installments have no exact independent record.

## 3. Proposed rescue rule

A held round is rescued only when **every account with a pending amount is proven**. Otherwise it stays held, unchanged.

1. **Company account:**
   - Proven when the E1 rows of this round, within the round's week window, sum **exactly** to `contributedCompany`.
   - Every retained E3 company receipt must have a matching E1 row (same week and amount).
   - E4: `totalInvestedCompany ≥ contributedCompany`.
2. **Personal account:**
   - Take E2 lines of this startup and round within `[openedWeek, closesWeek)`.
   - Remove one line per E1 company row (same week and rounded amount). The remaining lines are personal.
   - Proven when their sum equals `contributedPersonal` **exactly** and no E1 row was left unmatched.
   - Every retained E3 personal receipt must have a matching remaining line.
   - E4: `totalInvestedPersonal ≥ contributedPersonal`.
3. **Pending amount of zero:** an account with nothing pending needs no proof, but any E1, E2 or E3 evidence of a payment for that account fails the rule.
4. **What the rescue does:** it lets the normal `closeStartupFundingRound()` (or refounding) proceed with the amounts already recorded.
   - No contribution, cash, cost basis or history is rewritten, refunded or invented.
   - The proof result could be recorded as an optional evidence marker on the closed-round history row, for audit. Whether to do so is for the Owner to decide (Q3).
5. **Partial proof:** if only part of an account's amount is proven, the round stays held. Converting part of it would change the subscription, which the Owner decision forbids. The diagnosis keeps reporting the proven and unproven amounts.

## 4. Verification probe [V]

The probe is a scratch script, not committed. It loads the game through `tests/harness.js` on the #1029 tree.

It creates a legacy save with an exact emulation of the pre-fix writer: 30 installments in one round, with company and personal installments alternating, a 24-row cap, the `-24` suffix reused, ledger rows and news lines. It then applies rules 1 and 2.

| Variant | Company: pending = E1 sum | Personal: E2 reconstruction = pending | Result |
|---|---|---|---|
| Integer amounts | 180,825 = 180,825 | 178,770 = 178,770 | both proven → rescuable |
| Fractional company amounts, integer personal | 180,937.5 = 180,937.5 | 178,875 = 178,875 | both proven |
| 300 later news lines (E2 evicted) | proven | 0 ≠ 178,770 | personal unproven → stays held |
| Personal-only round | nothing pending | 359,595 = 359,595 | proven |

In every variant, `getStartupFundingRoundHold()` reported `PAYMENT_HISTORY_TRUNCATED` before the rule ran.

## 5. Limits and risks

- **Fractional personal installments [I].** E2 rounds to whole yen, so a fractional personal installment can never be proven exactly. The round stays held. UI amounts are whole yen in practice.
- **Long games [V].** E1 can be archived and E2 evicted, so some legacy saves stay unrescuable. They remain held and identifiable, with no silent asset change, as the Owner decision requires.
- **News is display text [I].** It is part of the same save as the other evidence and is no more forgeable. Exact equality between two independent stores is the proof; one alone is not.
- **No save-format change.** The rule reads existing v9 fields only. The optional audit marker (Q3) would add one optional field to the closed-round history row; `saveVersion` stays 9.

## 6. Owner decisions required

1. **Q1:** adopt rules 1–3, including E2 as evidence for the personal account.
2. **Q2:** keep partially proven rounds held (rule 5), or allow some other disposition.
3. **Q3:** record an audit marker on the closed-round row, or derive the proof each time.
4. **Q4:** decide how saves that stay unrescuable are handled: kept held indefinitely with the diagnosis visible, or given a manual player-confirmed path. A manual path would need its own design.

## 7. Implementation slice (after Q1–Q4)

One PR, containing:
- a read-only `proveLegacyStartupFundingRound(startupID)` that applies rules 1–3;
- `closeStartupFundingRound()` and refounding accepting a `PAYMENT_HISTORY_TRUNCATED` round only when the proof passes;
- Node tests for each probe variant plus adversarial cases: an extra E2 line, a missing E1 row, a cost basis below the pending amount, prior-round lines, and duplicate amounts in one week;
- save-fault rollback, reload and fresh durable IndexedDB in iPhone WebKit;
- determinism, with no RNG.
