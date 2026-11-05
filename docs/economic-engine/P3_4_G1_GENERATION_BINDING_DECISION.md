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

Follow-up decisions (Owner, 2026-11-05, while step 2 was prepared):

| ID | Decision |
| --- | --- |
| D2a | A refounded save from before D1 can still hold the sold company's listing row under the reused ticker. While the new company is unlisted, that row is left as saved and the company stays unchecked, as before. Nothing rewrites the row on load. New play does not reach this, because D1 drops the row at refounding. |
| D2b | If such a residual lot does not fit the new company (founder shares plus the lot exceed the outstanding quantity), reconciliation fails closed. The lot is kept, no class is adopted and no votes are granted. Nothing is liquidated. |

D2 knowingly revises one rule for legacy saves only: the refounding specification's NG-05 and its "no inference from a
reused ticker or residual quantity" rule
([PHASE_3_P3_4_NEW_GAME_GENERATION_REFOUNDING_SPEC.md](PHASE_3_P3_4_NEW_GAME_GENERATION_REFOUNDING_SPEC.md) §1, §4).
Once D1 is in place, a new sale leaves no residual lot, so NG-05 cannot arise in new play.

## Implementation plan

Each step is its own PR. Steps 1 and 2 change money or authority, so each needs an Owner-relayed independent review.

1. **Sale settlement (D1): done in #1351.**
   - `completeCompanySale` settles `personalStocks[ticker]`. That function is the single sink for every sale path.
   - The founder total for founder shares plus the lot is rounded once (`YEN_CEILING_ROUNDING_CONTRACT` §4, two parts).
   - The gain goes to the realised personal stock P/L, as in the personal `sellStock` path, with no company ledger event.
   - A malformed or over-allocated lot, or (with a lot) a founder ratio that differs from the share counts, refuses the
     whole sale before any write.
   - Both sale commands run as one transaction, with Node save-false and save-throw cases. A WebKit fault set for the two
     accept writers is still a follow-up.
   - Refounding drops the sold company's own listing row when it was listed.
   - Merged after three rounds of independent review.
2. **Generation binding (D0, D2, D2a, D2b).** Replace the serial-1 rule with "the proven current serial, unsold".
   - A later serial is proven when it is a safe integer above every `pastCompanyRecords` serial, and at least one past
     company is recorded. Serial 1 is proven as before.
   - This applies in the read model (one shared predicate; only a proven serial is passed on in `generationEvidence`),
     the planner (a local copy, because the planner reads no reader; the scope names the generation), `beginOwnershipLeg`
     (it scopes to the state's serial) and control eligibility.
   - Tests: a real sale and refounding reconciles the second generation; installed writer legs plan in the second and
     third generations; unproven evidence and a sold state stay unchecked; the legacy save keeps its lot and fails closed
     (D2b); an unlisted company with the old listing row stays unchecked (D2a).
3. **Activation refusal (G01).** Turning a null leg into a refusal stays with the activation decision. Steps 1 and 2
   remove the ordinary-play case (a refounded company) that would otherwise block players.

## Limits

This record grants no S_PASS, changes no code and starts no migration. It does not decide G2 (load and replacement
rule) or G6 (competitor stake holder binding).
