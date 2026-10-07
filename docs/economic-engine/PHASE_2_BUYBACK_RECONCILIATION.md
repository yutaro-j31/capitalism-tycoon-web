# Phase 2 Buyback Reconciliation

**Slice:** P2-4 — implementation contract  
**Tracker:** #890  
**Issue:** #903  
**Base main:** `05c7bacf5195b42e0eca45c36723e331ef830ea8`

## Authority and scope

The existing production writer remains `js/shareholder-returns.js::buyback()`, exposed as `TycoonEngine.prototype.buybackOwnShares`.

P2-4 does not create a second buyback settlement path and does not move public-security settlement into Economic Core. It adds deterministic reconciliation evidence around the existing writer so cash, treasury shares, ownership, treasury-stock book value and per-share state must agree before the transaction can commit.

Phase 3 ownership/control redesign remains out of scope.

## Buyback evidence contract

For every canonical buyback, the existing transaction captures one finite evidence object containing the authoritative before/after values for:

- execution cost, quantity and execution price;
- company cash;
- treasury shares;
- issued shares;
- outstanding shares;
- founder shares;
- treasury-stock book value;
- founder, external and competitor ownership ratios;
- authoritative stock price;
- the public-company stock mirror when present.

The matching finance row remains `otherFinancing` with:

- `cashEffect = -cost`;
- `equityEffect = -cost`;
- zero P&L, asset and liability effects.

The receipt is attached to that finance row. No additional cash/share mutation is performed by the finance layer.

## Required identities

A buyback is accepted only when all of the following hold:

1. rounded purchased quantity × execution price equals recognized cost;
2. company-cash reduction equals recognized cost;
3. treasury-stock book increase equals recognized cost;
4. treasury shares increase by exactly the purchased quantity;
5. issued shares do not change;
6. outstanding shares fall by exactly the purchased quantity;
7. founder shares do not change;
8. founder ownership is founder shares / ending outstanding shares;
9. external ownership remains consistent with the current legacy founder/competitor ownership model;
10. competitor ownership does not change inside the buyback;
11. execution price is consistent with the pre-buyback authoritative stock price;
12. the public stock mirror, when present, agrees with authoritative price, issued shares and market capitalization.

The existing price-impact formula is not changed by P2-4.

## Forward-only adoption

`finance.buybackReconciliation` is a bounded forward-only diagnostic accumulator.

For an existing saveVersion-9 save with no P2-4 accumulator, the current treasury-share count and treasury-stock book value are adopted as opening state. P2-4 does not claim to reconstruct historic buyback quantities or execution prices where the old save contains no receipt evidence.

New recognized buybacks accumulate:

- recognized cost;
- recognized shares;
- recognition count.

Runtime finance-ledger compaction moves receipt totals into bounded archived counters before old rows are dropped. Quota compaction already protects the existing non-week buyback idempotency rows.

## Ownership boundary

P2-4 reconciles the current legacy ownership model; it does not redesign it.

A new buyback may not create a worse founder-plus-competitor over-allocation than the adopted opening state. Normal states must continue to satisfy the current `updateOwnershipRatios()` denominator based on issued shares minus treasury shares.

## Atomicity and duplicate behavior

The existing buyback remains inside `runTransaction()`.

Malformed, non-finite, missing or mismatched P2-4 evidence throws before the finance row is committed. The existing transaction boundary therefore restores cash, treasury shares, treasury-stock book value, ownership, stock state, finance rows and durable save bytes together.

A duplicate canonical buyback transaction/idempotency key is rejected instead of becoming a silent no-op.

## Permanent gates

P2-4 adds these close checks:

- `P2-BUYBACK-FINITE`
- `P2-BUYBACK-RECEIPTS`
- `P2-BUYBACK-EVIDENCE-COST`
- `P2-BUYBACK-EVIDENCE-SHARES`
- `P2-BUYBACK-TREASURY`
- `P2-BUYBACK-TREASURY-BOOK`
- `P2-BUYBACK-OUTSTANDING`
- `P2-BUYBACK-OWNERSHIP`
- `P2-BUYBACK-PER-SHARE`

They join the existing standalone close and therefore flow into `finance.validate()`.

## Persistence and determinism

P2-4 preserves:

- `SAVE_KEY = capitalism_tycoon_web_v1`;
- `saveVersion = 9`;
- existing simulation RNG state and draw order;
- company/personal cash separation;
- Phase 0.5 and Phase 1 permanent gates;
- P2-1 cash-close, P2-2 debt and P2-3 dividend reconciliation.

No RNG source, wall-clock dependency, balance tuning or UI redesign is introduced.

## Exit

P2-4 is complete when the five buyback acceptance items in #890 are directly enforced, P2-GAP-002 is recorded as resolved, focused/canonical CI is green, independent diff audit is PASS, and the implementation PR is merged.
