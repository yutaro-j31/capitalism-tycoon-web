# Phase 2 Standalone Close Contract

**Phase:** Phase 2 — Standalone Accounting Hardening  
**Slice:** P2-1  
**Status:** implementation contract  
**Base main:** `3d3cd35f4c9a223c9f8a8a04225c2f7d594e20dc`

## Purpose

P2-1 introduces an explicit standalone accounting close boundary for the committed company state.

This is not a second accounting system. It is a stricter reconciliation gate over the existing standalone company accounting model.

## Weekly boundary

Production weekly commit order now contains:

1. weekly production wrappers
2. delegated executive actions
3. critical-money finite guard
4. finance snapshot finalization
5. **standalone accounting close**
6. liquidity-crisis finalization
7. legacy finance validation
8. supporting invariant validation
9. weekly summary finalization
10. transaction commit
11. persistence

The close therefore evaluates the final accounting snapshot before the week is allowed to commit.

A failed close throws inside the existing outer `week` transaction. State, RNG, deterministic IDs, finance rows, weekly snapshot changes and durable save bytes therefore roll back together.

## Close envelope

P2-0 recorded the historical compatibility envelope as wide as ¥2 / ¥10 for some invariants.

P2-1 adds a separate stricter close envelope:

| Invariant | Limit |
|---|---:|
| Balance Sheet identity | ¥0.10 |
| Balance Sheet cash vs authoritative company cash | ¥0.01 |
| Cash Flow opening + net change vs ending | ¥0.05 |
| Cash Flow ending cash vs authoritative company cash | ¥0.05 |
| Weekly snapshot cash difference | ¥0.05 |
| Weekly opening cash vs previous ending cash | ¥0.01 |
| Finance opening cash + archived/live cash effects vs authoritative cash | ¥0.05 |

The values reflect the current cent-denominated model and the existing five-cent weekly rounding-reconciliation guard.

These are P2-1 close limits. The older, wider `finance.validate()` checks remain in place as compatibility diagnostics rather than being deleted.

## Deterministic close result

`finance.standaloneClose(state, period)` returns a frozen result containing:

- schema version
- committed week
- requested statement period
- authoritative company cash
- close metrics
- named close checks
- failure reasons
- overall PASS/FAIL

The close consumes no simulation RNG and does not write company cash, debt, ownership or transactions.

Existing statement cache fields may still be refreshed through the legacy `buildStatements()` path.

## Named checks

- `P2-CLOSE-BS-IDENTITY`
- `P2-CLOSE-BS-CASH`
- `P2-CLOSE-CF-IDENTITY`
- `P2-CLOSE-CF-ENDING-CASH`
- `P2-CLOSE-WEEKLY-CASH`
- `P2-CLOSE-WEEKLY-ROLLFORWARD`
- `P2-CLOSE-FINANCE-ROLLFORWARD`

## Validation integration

`finance.validate()` now includes the strict standalone-close errors in addition to the historical compatibility checks.

This keeps ad-hoc validation, save/reload tests and the weekly commit boundary aligned on one close contract.

## Failure codes

The production weekly boundary exposes:

- `standalone-accounting-close-failed`
- `standalone-accounting-close-threw`

Both are fail-closed and participate in the existing rollback diagnostics.

## Non-goals

P2-1 does not change:

- debt instrument roll-forward
- dividend conservation
- buyback accounting
- fixed-asset acquisition accounting
- personal accounting
- PE/VC/real-estate accounting authority
- SAVE_KEY
- saveVersion
- simulation RNG
- UI

Those remain separate Phase 2 slices or later-phase work.

## Acceptance

P2-1 is complete when:

- deterministic close result is stable for unchanged state;
- strict close catches cent-scale divergence hidden by the historical wider tolerance;
- weekly close failure and exception both roll back the full week and durable save;
- the close stage is permanently guarded in `WEEK_EXECUTION_ORDER`;
- the existing 4-route x 208-week production-composition test remains green, meaning every committed week passes the stricter close;
- Phase 0.5 and Phase 1 permanent gates remain green;
- canonical CI is green.
