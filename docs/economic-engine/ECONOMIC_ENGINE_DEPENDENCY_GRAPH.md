# Economic Engine Dependency Graph

**Status: PROPOSED FOR GATE D APPROVAL**  
**Baseline: `9b8bdc70eecca6e4caa059a3f44863b197b2b8b7`**  
**Implementation permission: NO**

This graph is normative for Economic Engine sequencing. Existing features may remain operational through adapters before their migration phase, but a later phase may not make an unmigrated subsystem authoritative early.

## 1. Primary dependency chain

```text
Phase 0  Specification / Contracts
  │
  ▼
Phase 0.5 Permanent Headless Harness
  │
  ▼
Phase 1  Entity-aware Unified Ledger
  │
  ▼
Phase 2  Standalone Accounting
  │
  ├──────────────► Phase 3 Ownership / Control
  │                    │
  │                    ▼
  │               Phase 4 Debt / Cost of Capital
  │                    │
  └──────────────┬─────┘
                 ▼
Phase 5 Aggregate Industry Supply / Demand
                 │
                 ▼
Phase 6 Shared Capital Allocation Kernel
                 │
                 ▼
Phase 7 Shared Valuation
                 │
                 ▼
Phase 8 Deterministic AI Allocator
                 │
        ┌────────┴────────┐
        ▼                 ▼
Phase 9 Stocks       existing operating systems
        │
        ▼
Phase 10 M&A
        │
        ▼
Phase 11 Group Treasury
        │
        ▼
Phase 12 Consolidation
        │
   ┌────┴────┬──────────┐
   ▼         ▼          ▼
Phase 13   Phase 14   Phase 15
PE         VC         Real Estate
   └────┬────┴────┬─────┘
        ▼         │
      Phase 16 Banking
```

Phase 16 also depends on the mature debt/cost-of-capital, treasury, consolidation and ownership contracts.

## 2. Phase prerequisites and authority

| Phase | Hard prerequisites | New authority permitted |
|---|---|---|
| 0 | Gate C accepted; current docs/main review | specification only |
| 0.5 | approved Phase 0 contracts | harness/measurement infrastructure only |
| 1 Ledger | Gates A-F + Phase 0.5 accepted + #745 Claude attestation | material transaction journal for explicitly cut-over slices |
| 2 Accounting | Phase 1 | standalone accounting projections/source-of-truth slices |
| 3 Ownership | Phase 1-2 | canonical security/ownership/control registry |
| 4 Debt/WACC | Phase 1-3 | canonical debt/cost-of-capital facts |
| 5 Industry | Phase 1-4 | aggregate demand/capacity economic state |
| 6 Allocation | Phase 1-5 | candidate/scoring/scheduling for migrated capabilities |
| 7 Valuation | Phase 2-6 | shared valuation service |
| 8 AI | Phase 6-7 | deterministic allocator over executable capabilities |
| 9 Stocks | Phase 3,6,7 | public security/corporate-action settlement |
| 10 M&A | Phase 1-4,6,7,9 as applicable | M&A settlement through Economic Core |
| 11 Treasury | Phase 1-4,10 | group funding/transfers |
| 12 Consolidation | Phase 2-4,10-11 | consolidated reporting/elimination authority |
| 13 PE | Phase 1-4,6-7,10-12 | PE fund/deal settlement |
| 14 VC | Phase 1-4,6-7,10-12 | VC vehicle/round settlement |
| 15 Real Estate | Phase 1-7,11-12 | real-estate capital/operating settlement |
| 16 Banking | Phase 1-15 relevant foundations | bank balance sheet, lending/deposit authority |

## 3. Capability lifecycle

Every candidate/action has independent capabilities:

```text
modeled
→ scored
→ shadowEvaluated
→ playerVisible
→ schedulable
→ executable
```

Rules:

- a capability may be modeled/scored before its settlement phase;
- shadow evaluation is pure: no state mutation and no production RNG consumption;
- `schedulable` requires a defined future settlement path;
- `executable` requires the authoritative writer for that action to have completed cutover.

Specific gates:

- stock dividends/buybacks may not execute through Economic Core before Phase 9;
- M&A may not execute through Economic Core before Phase 10;
- PE/VC/real-estate adapters may be scored earlier, but their fund/vehicle settlement remains legacy until their migration phase.

## 4. Current-to-target authority map

This table describes current production authority at the Gate D baseline and the intended cutover phase.

| Domain | Current production authority / representation | Target authority | Cutover |
|---|---|---|---|
| player company cash | `g.companyCash` + finance projection | entity cash + Economic Transactions | Phase 1/2 |
| founder personal cash | `g.personalCash` | person entity cash | Phase 1 |
| standalone ledger/statements | `js/finance.js` | Economic journal + standalone accounting | Phase 1/2 |
| weekly atomic rollback | `TycoonEngine.runTransaction()` and committed-week boundary | reused as execution safety, not accounting authority | Phase 1+ |
| founder/public ownership | `sharesOut`, `founderShares`, ratios and other fragmented holders | security registry + ownership edges | Phase 3 |
| subsidiaries | multiple subsidiary arrays/fields | entities + ownership edges | Phase 3/12 |
| debt | `companyDebt`, finance loans and subsystem loans | debt instruments tied to entities | Phase 4 |
| industry/store economics | detailed production store/market/supply/workforce systems | detailed adapters + aggregate industry layer | Phase 5 |
| capital allocation | current capital-allocation modules | shared candidate kernel | Phase 6 |
| valuation | multiple subsystem formulas | shared valuation service | Phase 7 |
| runtime AI allocation | subsystem-specific deterministic logic | shared deterministic allocator | Phase 8 |
| listed stocks | stock arrays/holdings/current trade logic | securities + market/corporate-action authority | Phase 9 |
| M&A | `ma-*.js` modules | Economic Core M&A operations | Phase 10 |
| group transfers | scattered parent/subsidiary behaviors | Group Treasury | Phase 11 |
| consolidation | partial/report-specific logic | canonical consolidation/eliminations | Phase 12 |
| PE | `pe-fund.js`, deals/portfolio modules | fund entities + Economic Transactions | Phase 13 |
| VC/startups | startup/venture state | VC vehicle/security ownership | Phase 14 |
| real estate | `real-estate*.js` + personal property state | entity/property transactions | Phase 15 |
| bank | current loans treat banks primarily as external financing | bank entities/balance sheets | Phase 16 |

## 5. No-cycle rules

The following architectural cycles are prohibited:

- valuation may consume accounting/ownership/debt/industry/allocation outputs, but valuation must not mutate them;
- allocation may consume valuation, but same-period allocation may not cause valuation to feed back into the decision via fixed-point iteration;
- AI may consume candidate scores/constraints, but AI cannot change the scoring model during the same tick;
- consolidation may derive group statements, but reporting-only consolidated output cannot rewrite standalone legal-entity books;
- market repricing may consume valuation/public signals, but price changes may not retroactively alter the same period's completed accounting close.

## 6. Phase 0.5 gate placement

Phase 0.5 is between approved contracts and Phase 1 because every later source-of-truth migration requires:

- deterministic scenario creation;
- invariant execution;
- state hash comparison;
- performance/save-size tracking;
- regression evidence independent of UI.

The harness is permanent infrastructure, not disposable test code.

## 7. Parallel work policy

Parallel PRs are permitted only when they do not introduce competing authorities.

Safe examples:

- docs/contracts and benchmark infrastructure;
- independent UI projections over stable read models;
- tests that measure existing behavior.

Unsafe examples:

- two PRs each becoming authoritative for the same cash/ownership/debt fact;
- Phase 9 corporate-action settlement while Phase 3 ownership remains non-authoritative;
- Phase 10 M&A settlement while transaction/debt/ownership contracts are still legacy-only.

## 8. Entry to Phase 1

Phase 1 remains blocked until all roadmap hard gates are true, including:

- Gate D approval;
- explicit Claude Code full-remediation completion record on #745;
- accepted Phase 0.5 harness;
- explicit owner Gate F approval;
- fresh implementation branch based on latest stable main.
