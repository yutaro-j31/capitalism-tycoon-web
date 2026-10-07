# Phase 2 Standalone Accounting Baseline

**Phase:** Phase 2 — Standalone Accounting Hardening  
**Slice:** P2-0  
**Status:** Baseline / characterization only  
**Base main:** `1a14987e14b10b0cf9d5da2f3a75e002b7b5a43d`

## Purpose

P2-0 records the current standalone-accounting behavior before Phase 2 changes any accounting writer or tolerance.

The machine-readable registry is:

`docs/economic-engine/phase2-standalone-accounting-invariants.json`

The baseline runner is:

`scripts/phase2-accounting-baseline.js`

## Current legacy compatibility checks

The existing `finance.validate()` contract currently enforces:

- Balance Sheet identity: absolute difference <= ¥2
- Balance Sheet cash vs `companyCash`: <= ¥0.1
- Cash Flow identity: <= ¥10
- Cash Flow ending cash vs `companyCash`: <= ¥0.5
- weekly snapshot cash difference: <= ¥10
- weekly opening/previous ending roll-forward: <= ¥10
- finance opening-cash roll-forward: <= ¥10
- `companyDebt` vs non-repaid loan outstanding principal: <= ¥0.1
- retained-earnings roll-forward: <= ¥0.1
- working-capital balances may not fall below -¥0.1
- transaction IDs are unique
- non-empty idempotency keys are unique
- numeric transaction fields are finite
- disposed fixed assets have zero book value
- accumulated depreciation may not exceed acquisition cost by more than ¥0.1

These are **legacy compatibility tolerances**.

They are not automatically the final Phase 2 Economic Core close tolerances. Tightening or replacing them requires a later slice with explicit parity and long-run evidence.

## Known Phase 2 gaps

P2-0 intentionally records the following as incomplete rather than pretending existing `finance.validate()` already proves them:

1. **Dividend conservation** — retained-earnings roll-forward exists, but payer/recipient/withholding/residual conservation is not a direct invariant.
2. **Buyback consistency** — cash, treasury/outstanding shares, and ownership are not reconciled by one standalone accounting gate.
3. **Fixed-asset acquisition roll-forward** — disposal/depreciation guards exist, but acquisition cash-to-book capitalization is only partially enforced.
4. **Debt event roll-forward** — point-in-time total principal reconciliation exists, but borrowing/repayment/write-off movements are not yet a canonical roll-forward invariant.

These map to P2-3, P2-4, P2-5, and P2-2 respectively.

## Read-only baseline rule

P2-0 may call existing legacy statement/validation functions only against a cloned state.

The measured authoritative runtime must keep the same semantic-state hash before and after the baseline probe.

P2-0 therefore does not introduce:

- a new accounting writer;
- a new close boundary;
- a new settlement family;
- a new persisted accounting root;
- a saveVersion change;
- a balance change.

## Long-run characterization

The existing production-composition test `tests/full-index-weekly-validate-208w-test.js` already runs:

- ramen
- convenience store
- gym
- real-estate agency

for 208 weeks each, with weekly finance validation and reload-fork checks.

P2-0 reuses those exact runs and adds the Phase 2 accounting snapshot/evaluation at the final horizon. This avoids running a second duplicate 208-week matrix merely to collect the same state.

## P2-0 exit

P2-0 is complete when:

- the 15 current invariants are machine-readable and source-drift guarded;
- the four roadmap gaps are explicit;
- short-horizon baseline evidence is deterministic;
- the 4-route x 208-week existing production-composition run passes the Phase 2 baseline evaluation;
- Phase 0.5 and Phase 1 permanent gates remain green;
- canonical CI is green.

P2-0 does not itself authorize any accounting migration. P2-1 begins standalone close identity/cash roll-forward hardening.
