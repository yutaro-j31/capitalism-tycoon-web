# Phase 2 Dividend Reconciliation

**Slice:** P2-3 — implementation contract  
**Base main:** `164e7544c6899c0d22208e3f3487d4e01a9a0193`  
**Acceptance:** tracker #890, P2-3

## Authority and scope

The existing `engine.advanceWeek` common-dividend payment remains the sole standalone payer/recipient writer. `shareholder-returns.js` still caps the declared payment against existing safe capacity and restores the declaration afterwards. The canonical outer weekly transaction still commits or rolls back all wrappers together.

P2-3 adds reconciliation evidence to that existing writer and its finance row. It does not execute dividends through Economic Core (that cutover remains Phase 9), create another payment, change tax/ownership/capacity formulas, or add shareholder accounts.

Preferred-share issuance/service remain disabled. External-security dividends and listed-subsidiary distributions remain their existing investment-income/later-domain writers; they are not standalone common-dividend payments. Both personal/company portfolios already exclude the company's own ticker from investment-dividend income. That exclusion is retained and regression-tested.

## Existing distribution contract

For the actual capped quarterly payment:

- gross payment = actual per-share dividend × (shares issued − treasury shares);
- founder entitlement = gross payment × the existing founder ownership ratio;
- founder personal cash credit = founder entitlement × `0.797`;
- founder withholding = founder entitlement × `(1 − 0.797)`;
- external gross distribution = gross payment − founder entitlement.

The external gross leg includes all non-founder holders, including competitor-owned shares. The game has no separate recipient cash account or withholding writer for those holders. P2-3 explicitly records their gross distribution as an external outflow; it does not invent their tax treatment or credit company cash again. Founder withholding likewise characterizes the existing difference between gross entitlement and net personal cash; it is not an additional corporate tax expense/payable/payment.

Company cash still changes through the unchanged weekly cash expression. Its independent no-dividend counterfactual uses operating profit and the existing overseas/COGS/spoilage cash adjustments. The observed difference to actual cash must equal the gross payment. Founder personal cash is observed immediately before and after its existing credit, excluding unrelated personal income.

## Cent recognition and residual

Authoritative legacy Number balances retain their existing fractional precision. Finance already recognizes aggregate dividend cash at ¥0.01 with `Math.round(x * 100) / 100`.

The reconciliation quantizes gross, observed payer reduction, observed personal credit, expected founder net, founder withholding and external gross separately at that evidence boundary. Its signed residual is:

`rounded gross − rounded expected founder net − rounded founder withholding − rounded external gross`

This is the named `roundingResidual` diagnostic leg, bounded to ±¥0.01 per payment. It is calculated only from expected entitlements, never from an incorrect observed cash movement. It changes no balance and does not insert a ledger adjustment. No cent-quantized authoritative Economic Core distribution/recipient allocation is introduced in this slice.

Every observed payer reduction and personal credit must equal its independently expected cent value. Conservation including the explicitly calculated residual must have zero cent difference. Gross payments outside the Number safe-cent envelope fail closed.

## Recognition, retained earnings and bounded evidence

The engine first observes its actual payment independently of ledger insertion. A constant-size pending receipt must be consumed by the corresponding finance event. A missing event therefore fails close even for a one-cent payment inside the older weekly rounding envelope.

Each new dividend finance event requires matching finite distribution evidence. Its amount equals gross, cash effect equals negative gross, and P&L/asset/liability/additional-equity effects are zero. Existing retained-earnings recognition continues through the dividend cash row exactly once; dividends are never an expense.

`finance.dividendReconciliation` is a constant-size forward-only diagnostic accumulator, not a cash or ownership authority. It records adoption week/historical recognized dividends, observed gross/payer/recipient/withholding/external/residual totals, payment count and a monotonic payment-week watermark.

Checks compare:

- historical opening dividends + observed new gross to archived + live recognized dividends;
- observed payer reduction to gross;
- personal net + withholding + external gross + explicit residual to gross;
- opening retained earnings + cumulative net income − opening/observed dividends + prior adjustments to closing retained earnings.

Live post-adoption dividend rows also require internally consistent receipts. Altered/missing receipts, non-finite or negative accumulators and duplicate payment weeks fail closed. Existing event idempotency returns null without recognizing the same live transaction twice. An alternate ID for an already recognized week, including a replay after archival, is rejected before event insertion.

The accumulator survives both finance's 5000-row compactor and all quota-save compaction profiles. Ordinary receipt retention follows the existing bounded finance ledger; no unbounded second history is added.

## Save and rollback

`SAVE_KEY=capitalism_tycoon_web_v1` and `saveVersion=9` are unchanged. Old saves missing this optional diagnostic field initialize from their existing archived/live dividend total at normalization. Historical holder receipts are not reconstructed or claimed. Cash, retained earnings, historic rows and ownership are not migrated.

The new checks join the existing P2-1 standalone close. Incorrect new distribution evidence throws inside the existing outer weekly transaction; close failures likewise abort the week. State, finance rows/accumulator, RNG, IDs and durable save bytes roll back together. `skipWeeklyValidation` keeps its existing diagnostic meaning; production payments still require valid receipt evidence.

## Named gates and permanent evidence

- `P2-DIVIDEND-PENDING`
- `P2-DIVIDEND-FINITE`
- `P2-DIVIDEND-RECEIPTS`
- `P2-DIVIDEND-RECOGNITION`
- `P2-DIVIDEND-PAYER`
- `P2-DIVIDEND-CONSERVATION`
- `P2-DIVIDEND-RETAINED-EARNINGS`

`tests/phase2-dividend-reconciliation-test.js` covers paired production/no-dividend cash and RE, founder/external extremes, treasury exclusion, explicit fractional residual, live and archived duplicate rejection, old-v9 adoption, reload and both compaction writers, own-ticker double-credit exclusion, capping/no-payment, wrong actual payer/recipient rollback, one-cent missing-recognition rollback, and corrupted/missing/non-finite evidence.

Existing corporate-tax, shareholder-return, P2-1/P2-2, Phase 0.5/Phase 1, save/determinism and four-route 208-week tests remain required regression evidence. Canonical CI and iPhone WebKit gates must be green before merge.
