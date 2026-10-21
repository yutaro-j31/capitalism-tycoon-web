# VC funding round — legacy truncated-history rescue: design and verification

**Status:** CONCLUDED (Owner decision 2026-10-20, next-cycle item 3). No rescue is implemented. Every `PAYMENT_HISTORY_TRUNCATED` round stays held and diagnosable; see §8.
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
| E1 | `finance.transactions` row: `investmentPurchase`, `sourceType:'startupFundingRound'`, `sourceID: <startupID>-<roundID>-company` | company only | week and amount of every company installment, **rounded to 0.01 yen** (`finance.js` `r()`) | Kept until `compressTransactions` archives rows beyond the newest 5,000. Archived rows lose `sourceID`. |
| E2 | `g.news` line `第{week}週：{name}の{round}ラウンドへ{yen}追加出資しました。` | **both, not distinguished** | week and amount, rounded to whole yen | Cut to 300 lines, so any 300 later news lines evict it. |
| E3 | retained `startupFundingHistory` receipts | each | exact amount, week, account | Truncated; this is the defect. |
| E4 | `totalInvested{Company,Personal}` | each | cumulative cost basis, including earlier investments | An upper-bound sanity check only. It cannot isolate one round. |

There is no personal cash ledger, so personal installments have no exact independent record.

## 3. Proposed rescue rule (superseded)

> **Superseded (2026-10-21).** This section is kept for the record only. Its rescue proposals, including the company-only rescue, are withdrawn by §8: E1 is lossy too, so no truncated round can be proven exactly from v9 evidence, and every such round stays held. Do not implement anything from this section.


A held round is rescued only when **every account with a pending amount is proven exactly**. Otherwise it stays held, unchanged. Under this rule only company-only rounds can be rescued.

1. **Company account — not provable either:**
   - E1 rounds each installment to 0.01 yen (`finance.js` `r = v => Math.round(v*100)/100`). The legacy writer and the `askMoney()` input accepted arbitrary fractions, so sub-cent fractions can cancel. For example, 100.004 and 100.996 appear as 100.00 and 101.00, whose sum equals the exact pending 201.
   - An E1 sum that matches `contributedCompany` therefore shows consistency, not proof. This holds even when the pending amount and every retained receipt are whole yen.
   - Exact independent evidence for the evicted installments does not exist in v9 saves, and the Owner decided not to add an audit field.
2. **Personal account — not provable under this design:**
   - E2 is lossy: it rounds each installment to whole yen. The pre-fix writer and the `askMoney()` input (`Number(value)`) both accepted fractional amounts, so there is no whole-yen invariant to rely on.
   - Rounding errors can cancel. Installments of 100.4 and 100.6 appear as 100 and 101, whose sum equals the exact pending 201. An E2 sum that matches `contributedPersonal` therefore does not prove the per-installment amounts, even when the pending amount and every retained E3 receipt are whole yen.
   - So a round with a non-zero `contributedPersonal` **stays held**. E2 may be computed as a diagnostic (an E2 sum that does not match is a definite mismatch), but a match never releases the hold.
   - Releasing personal amounts would need exact independent evidence, such as a personal ledger, which v9 saves do not have. Accepting E2 consistency as proof is a separate Owner decision (Q1), not part of this rule.
3. **Pending amount of zero:** an account with nothing pending needs no proof, but any E1, E2 or E3 evidence of a payment for that account fails the rule.
4. **What the rescue does:** it lets the normal `closeStartupFundingRound()` (or refounding) proceed with the amounts already recorded.
   - No contribution, cash, cost basis or history is rewritten, refunded or invented.
   - The proof result could be recorded as an optional evidence marker on the closed-round history row, for audit. Whether to do so is for the Owner to decide (Q3).
5. **Partial proof:** if only part of an account's amount is proven, the round stays held. Converting part of it would change the subscription, which the Owner decision forbids. The diagnosis keeps reporting the proven and unproven amounts.

## 4. Verification probe [V] (superseded)

> **Superseded (2026-10-21).** This section is kept for the record only. Its rescue proposals, including the company-only rescue, are withdrawn by §8: E1 is lossy too, so no truncated round can be proven exactly from v9 evidence, and every such round stays held. Do not implement anything from this section.


The probe is a scratch script, not committed. It loads the game through `tests/harness.js` on the #1029 tree.

It creates a legacy save with an exact emulation of the pre-fix writer: 30 installments in one round, with company and personal installments alternating, a 24-row cap, the `-24` suffix reused, ledger rows and news lines. It then applies rules 1 and 2.

| Variant | Company: pending = E1 sum | Personal: E2 sum vs pending | Result under rule 2 |
|---|---|---|---|
| Integer amounts | 180,825 = 180,825 | 178,770 = 178,770 (match) | personal pending → stays held |
| Fractional company amounts, integer personal | 180,937.5 = 180,937.5 | 178,875 = 178,875 (match) | personal pending → stays held |
| 300 later news lines (E2 evicted) | proven | 0 ≠ 178,770 | stays held |
| Personal-only round | nothing pending | 359,595 = 359,595 (match) | stays held |
| Company-only round [I] | E1 exact | nothing pending | rescuable |

The matches in the first, second and fourth rows show that E2 is *consistent* with the pending amount. They are not exact proof, because fractional installments whose rounding cancels would match too (rule 2).

In every variant, `getStartupFundingRoundHold()` reported `PAYMENT_HISTORY_TRUNCATED` before the rule ran.

## 5. Limits and risks (superseded)

> **Superseded (2026-10-21).** This section is kept for the record only. Its rescue proposals, including the company-only rescue, are withdrawn by §8: E1 is lossy too, so no truncated round can be proven exactly from v9 evidence, and every such round stays held. Do not implement anything from this section.


- **Personal installments [V].** E2 rounds to whole yen and the legacy input accepted fractions, so an E2 match is never exact proof (rule 2). Every round with a personal pending amount stays held.
- **Long games [V].** E1 can be archived and E2 evicted, so some legacy saves stay unrescuable. They remain held and identifiable, with no silent asset change, as the Owner decision requires.
- **News is display text [I].** It is part of the same save as the other evidence and is no more forgeable. Exact equality between two independent stores is the proof; one alone is not.
- **No save-format change.** The rule reads existing v9 fields only. The optional audit marker (Q3) would add one optional field to the closed-round history row; `saveVersion` stays 9.

## 6. Owner decisions required (superseded)

> **Superseded (2026-10-21).** This section is kept for the record only. Its rescue proposals, including the company-only rescue, are withdrawn by §8: E1 is lossy too, so no truncated round can be proven exactly from v9 evidence, and every such round stays held. Do not implement anything from this section.


1. **Q1:** adopt rules 1–3 (company-only rescue). Separately: whether an E2 match, which is consistent but lossy, may ever release a personal pending amount. This design recommends no.
2. **Q2:** keep partially proven rounds held (rule 5), or allow some other disposition.
3. **Q3:** record an audit marker on the closed-round row, or derive the proof each time.
4. **Q4:** decide how saves that stay unrescuable are handled: kept held indefinitely with the diagnosis visible, or given a manual player-confirmed path. A manual path would need its own design.

## 7. Implementation slice (after Q1–Q4) (superseded)

> **Superseded (2026-10-21).** This section is kept for the record only. Its rescue proposals, including the company-only rescue, are withdrawn by §8: E1 is lossy too, so no truncated round can be proven exactly from v9 evidence, and every such round stays held. Do not implement anything from this section.


One PR, containing:
- a read-only `proveLegacyStartupFundingRound(startupID)` that applies rules 1–3;
- `closeStartupFundingRound()` and refounding accepting a `PAYMENT_HISTORY_TRUNCATED` round only when the proof passes;
- Node tests for each probe variant plus adversarial cases: an extra E2 line, a missing E1 row, a cost basis below the pending amount, prior-round lines, and duplicate amounts in one week;
- save-fault rollback, reload and fresh durable IndexedDB in iPhone WebKit;
- determinism, with no RNG.

## 8. Owner decision 2026-10-20 and resulting design

The Owner decided:
- Rescue only amounts whose payment can be **proven**.
- Personal news-line matches are not payment evidence.
- The company ledger rounding problem must be resolved too.
- Partially proven rounds stay held.
- No automatic equity conversion or refund of unproven subscriptions.
- No new audit save field.
- Unrescuable legacy saves are kept and diagnosable.

Applying these rules to the evidence in §2:
- **E2 (news)** is excluded by decision.
- **E1 (company ledger)** is lossy at 0.01 yen (rule 1). A match therefore never proves the installments behind it.
- **E3** is the truncated history itself.
- **E4** is only an upper bound.

So **no truncated round can be proven exactly from v9 evidence**, and every `PAYMENT_HISTORY_TRUNCATED` round stays held. Nothing is converted, refunded or rewritten. This is already the behaviour of #1029: `getStartupFundingRoundHold()` reports the code and per-account `pending` / `retainedPaid` / `unproven`, and the UI shows the hold notice and disables ownership-changing actions.

What remains in scope for future work, as separate small PRs:
- **Diagnostics only.** Extend the hold diagnosis with the E1 and E2 consistency values (sums and row counts, read-only), so a maintainer can see why a round is held. These values never release it.
- **Reconsider only with new evidence.** A future exact source of payment evidence would need a new save field, which needs its own Owner approval.

Everything in §§3–7 is superseded by this section: the rescue rule in §3 (including the company-only rescue and its E2 conditions), the probe outcomes in §4 that label a round "rescuable", the risk notes in §5, the open questions in §6 and the slice in §7. They are kept for the record only and must not be implemented. With no round rescued, the E2 clearing question for a zero personal pending amount no longer arises.
