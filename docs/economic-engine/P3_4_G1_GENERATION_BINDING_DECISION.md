# P3-4 G1 — generation binding: Owner decision record

**Status: decision record and implementation plan only.** No code or test change, no S_PASS, no activation.
Authority stays `disabled`. `SAVE_KEY` and `saveVersion=9` are unchanged.

This records the Owner decisions of 2026-11-05 on readiness memo G1 (second and later company generations,
[PHASE_3_P3_4_ACTIVATION_READINESS.md](PHASE_3_P3_4_ACTIVATION_READINESS.md)). They feed gap G01 in the
[P3-4 gap reconciliation](P3_4_GAP_RECONCILIATION.md) and the generation part of G02. Facts below were read on `main`
`b5e7ec53`.

## Current facts

- **Generation gate.**
  - `js/phase3-ownership-planner.js:84` and `:89` refuse every scope or state whose `currentCompanySerial` is not 1,
    or whose company is sold (`GENERATION_UNPROVEN`).
  - `js/phase3-ownership-apply.js:66` always asks for serial 1.
  - The read model (`js/economic-read-model.js:734`, `:863`, `:966`, `:1054`) and
    `js/phase3-control-eligibility.js:111` use the same serial-1 rule.
  - A refounded company therefore has every ownership leg unchecked (`beginOwnershipLeg` returns null).
- **Company sale** (`completeCompanySale`, `js/engine.js:1998`).
  - The sale pays only `exitPrice × founderOwnershipRatio`. That ratio is `founderShares / (sharesOut − treasury)`
    (`js/engine.js:2032`).
  - Own-company shares the founder bought personally (`personalStocks[ticker]`) are not settled. They stay in the
    personal account.
- **Refounding** (`foundNewCompanyAfterBuyout`, `js/completion.js:168`).
  - The new company is a fresh constructor state with the default ticker `CPTY`.
  - Refounding carries `personalStocks` and `market` over from the sold company.
  - So a lot bought in the sold company sits under the same key as the new company's own shares. Today the read
    model keeps it out of the founder bucket because generation 2+ is unproven.

## Decisions (Owner, 2026-11-05)

| ID | Decision |
| --- | --- |
| D0 | **Each company generation is reconciled afresh.** After refounding, the new company is the current player issuer. Its ownership is reconciled from its own founding, as for generation 1. Generation is not inferred from a name, ticker or percentage. |
| D1 | **On a company sale, the founder's personally bought own-company lot is bought out at the sale price per share.** The price per share is `exitPrice / (sharesOut − treasuryBuybackShares)`, the same per-share basis the founder shares receive. The proceeds go to personal cash, and the lot is removed. After a sale, no old-company lot remains to collide with the next company. |
| D2 | **Existing saves that were already refounded are not migrated.** A residual own-ticker lot in such a save is treated as a holding of the current (new) company. The player loses nothing and is not blocked. The old-company quantity that was already folded into the new ticker stays as it is. |

D2 knowingly revises one rule for legacy saves only: the refounding specification's NG-05 and its "no inference from a
reused ticker or residual quantity" rule
([PHASE_3_P3_4_NEW_GAME_GENERATION_REFOUNDING_SPEC.md](PHASE_3_P3_4_NEW_GAME_GENERATION_REFOUNDING_SPEC.md) §1, §4).
Once D1 is in place, a new sale leaves no residual lot, so NG-05 cannot arise in new play.

## Implementation plan

Each step is its own PR. Steps 1 and 2 change money or authority, so each needs an Owner-relayed independent review.

1. **Sale settlement (D1).** Settle `personalStocks[ticker]` inside `completeCompanySale`. That function is the single
   sink for every sale path, so all paths are covered.
   - Whole-yen rounding as the founder proceeds.
   - A personal ledger record.
   - Rollback under the existing transaction boundary, with Node and WebKit fault cases.
   - The PR also checks whether the sold company's listing row in `market` must be removed so that it cannot bind to
     the next company. It records that finding.
2. **Generation binding (D0, D2).** Replace the serial-1 rule with "the current serial, unsold".
   - The current serial must be a safe integer ≥ 1 and above every `pastCompanyRecords` serial.
   - This applies in the planner, `beginOwnershipLeg`, the read model and control eligibility.
   - Tests: G1 → sale → G2 → G3 through the installed commands; ownership legs plan in G2 and G3; a sold state is
     still refused; a legacy refounded save with a residual lot reconciles as D2 says.
3. **Activation refusal (G01).** Turning a null leg into a refusal stays with the activation decision. Steps 1 and 2
   remove the ordinary-play case (a refounded company) that would otherwise block players.

## Limits

This record grants no S_PASS, changes no code and starts no migration. It does not decide G2 (load and replacement
rule) or G6 (competitor stake holder binding).
