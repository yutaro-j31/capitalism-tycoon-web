# Phase 6A-2A: player crisis liquidity actions

## Scope

This increment adds two deterministic player actions that can restore liquidity during the Phase 6A-1 company crisis lifecycle:

- founder capital injection from personal cash;
- an emergency bridge loan constrained by the existing company credit limit.

The visible crisis panel, creditor standstill, automated cost reduction, and guided asset/store liquidation remain separate increments. Existing store, property, investment, product, and subsidiary sale methods are unchanged.

## Founder capital injection

`injectFounderCapital(amount)` transfers personal cash to company cash and records the transfer as equity financing.

- The amount must be positive and cannot exceed personal cash.
- It is available in `watch`, `distressed`, `turnaround`, and `recovered` states.
- It cannot run after insolvency, company sale, or game over.
- It does not create profit or debt.
- Every successful transfer receives a stable action ID and survives save/reload.

## Emergency bridge loan

`requestEmergencyBridgeLoan()` calculates the amount needed to restore the crisis reserve and then caps it by unused company credit.

- It is available only in `watch`, `distressed`, or `turnaround`.
- At least 500,000 yen of unused credit is required.
- The target is the larger of 3,000,000 yen or the gap to the current crisis reserve.
- The action cannot be repeated in the same week or within 13 weeks of the previous emergency bridge.
- Company cash and debt increase by the same amount.
- A finance transaction and a matching active loan record are created.
- Company credit is reduced by four points to reflect emergency borrowing.
- Ordinary production borrowing, repayment, market, supply, workforce, competitor, and progression formulas are unchanged.

## State and retention

The additive `playerCrisisActions` state contains:

- `nextActionSeq`;
- `lastEmergencyLoanWeek`;
- `history` capped at 52 entries.

Old version-9 saves receive defaults during normalization. No save-version migration is required, and `SAVE_KEY` remains `capitalism_tycoon_web_v1`.

## Release gates

- actions are unavailable after insolvency;
- invalid or excessive founder transfers are rejected without mutation;
- bridge loans cannot exceed available credit;
- debt borrowing is balanced in the finance ledger;
- the matching loan principal equals the state debt increase;
- same-week and 13-week duplicate emergency borrowing is rejected;
- a founder injection can move a distressed company into the existing turnaround/recovery sequence;
- history stays bounded and finite;
- validation is read-only;
- save/reload preserves action state;
- all existing CI suites remain green.
