# P3-3-001 — Own-share acquisition quantity correction

**Tracker / owner approval:** #909, explicit owner decision 2026-10-08 12:05 JST.

**Base main:** `5d1b23d66ce818437476c1d2693b490a52f5d1fb` (#912).

## Concern and execution contract

Restore ECO-011 for the identified founder buckets when acquiring player-company common shares. This is a corrective quantity precondition on existing writers, not P3-3 registry authority adoption or a Phase 9 settlement migration. The [entry contract](PHASE_3_ENTRY_CONTRACT.md), [P3-2 read-only scope](PHASE_3_P3_2_CONTRACT.md) and [P2 buyback receipt/accounting contract](PHASE_2_BUYBACK_RECONCILIATION.md) remain applicable.

Available quantity is the floor of the exactly reconciled residual:

`issued - treasury - (original founder + designated personal own-company holding)`.

`engine.playerShareAcquisitionCapacity(state, quantity, treasury)` consumes the existing pure read-only reconciliation. Invalid/unreconciled source evidence returns null; it does not repair or write state. A requested prospective quantity must be a nonnegative safe integer within the residual. Error-free addition/subtraction checks also require exact, finite, nonnegative, in-envelope prospective personal/founder/residual or treasury/outstanding quantities. Exact fractional opening evidence remains readable; an operation that loses fractional units fails without rounding/EPSILON forgiveness.

- Personal `buyStock` on the designated player ticker rejects a positive existing quote's filled quantity above this capacity, before cash/holdings/quote/save writes. It retains the existing 5% per-order cap: an oversized raw order whose existing filled quantity fits still executes at that unchanged quote/fee/impact. It adds no second settlement path.
- Installed `shareholderReturns.buyback`, exposed as `buybackOwnShares`, caps its existing execution quantity to the same residual and checks prospective treasury/outstanding arithmetic before entering economic writes. Both founder source buckets remain unchanged; no company-to-founder sale/payment is fabricated.
- The inactive base-class buyback fallback receives the same quantity guard so a direct base-method call cannot bypass it. Its legacy settlement is not adopted as the installed P2 writer. App buy/stock/founder actions and shareholder-activism buyback acceptance continue calling installed engine methods; no wrapper replaces personal `buyStock`.
- Company-account market holdings and other issuers retain their existing authority, quotes and cash attribution. A company own-ticker alias is still unresolved, not silently reclassified as treasury or founder ownership. IPO/issuance/founder sale/split/M&A/margin writers, dividends, valuation, credit/progression and command eligibility are not cut over here.

## Accounting, transaction and save boundary

Accepted canonical buybacks keep the existing cent-quantized cost, company cash decrease, treasury-stock book increase, `otherFinancing` cash/equity effects, zero profit effect, price-impact formula, stock mirror, P2 receipt and idempotency key. Personal accepted purchases keep their existing quote/cash/average-cost formula and do not create company finance recognition. The allowed quantity is the only corrected economic input.

Canonical buyback remains inside its installed `runTransaction`; an injected finance-writer failure restores quantity, cash, book, mirror, whole transaction-entry state and durable save bytes. Its existing capacity preflight populates non-authoritative `finance.lastStatements` before that transaction; the rollback regression starts from the same preflight preview. Personal purchase continues using its existing save path; an enclosing engine transaction defers its save and restores its state/bytes on failure. This PR does not claim a new standalone personal-order transaction/settlement authority.

SAVE_KEY and saveVersion 9 are unchanged. No persisted registry root, migration, RNG source/draw, clock dependency, balancing change or new permission is introduced. Old inconsistent quantities survive save/import/reload/critical compaction unchanged and remain explicit failed reconciliation evidence. Quantity-increasing corrective paths reject them before economic writes; no holdings are pruned, consideration invented or historical receipts reconstructed. Existing unrelated gameplay paths are preserved.

## Regression and gate evidence required

The canonical regression must fail on the base main for the real sequence personal own-share buy then buyback (400,000 actual vs 399,000 safe), and pass after correction. Cover unchanged accepted quote/cash/impact, independent conservation arithmetic, exact/excess/exhausted boundaries, raw-order vs filled-order cap, repeated buy/buyback/sell/split, import/reload, nonzero critical compaction, P2 receipts/finance validation, injected rollback and byte preservation, host/simulation RNG purity, deterministic whole-state replay with a fixed test-only save clock, invalid old-save preservation, fractional/precision envelopes and unrelated legal-account/issuer behavior.

Targeted tests precede applicable canonical/P0.5/P1/P2/Strategy/WebKit CI. Independent actual `origin/main...HEAD` A–L audit, unresolved findings zero, current main/conflict review and all applicable PR checks green are required for Gate PASS/merge. Main post-merge CI, including actual push WebKit, must be green before resolving P3-3-001 and resuming P3-3. Correction completion is tracked on #909; this document alone is not a PASS attestation.
