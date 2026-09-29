# Economic Engine Dependency Graph

**Status: PROPOSED FOR GATE D APPROVAL — revised after independent Codex review**  
**Baseline: `9adcbfe3d2da60b60efb4663be478ac3fcc67732`**  
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
Phase 1  Entity-aware Operation / Ledger Foundation
  │
  ▼
Phase 2  Standalone Accounting
  │
  ▼
Phase 3  Ownership / Control
  │
  ▼
Phase 4  Debt Instruments + Cost-of-Capital Inputs
  │
  ▼
Phase 5  Aggregate Industry Supply / Demand
  │
  ▼
Phase 6  Shared Base Valuation Foundation
  │
  ▼
Phase 7  Shared Capital Allocation Kernel
  │
  ▼
Phase 8  Deterministic AI Allocator
  │
  ├──────────────► Phase 9 Stocks / Public Corporate Actions
  │
  └──────────────► Phase 10 M&A
                         │
                         ▼
              Phase 11 Legal-Entity Group Treasury Settlement
                         │
                         ▼
              Phase 12 Consolidation + Group Liquidity Optimization
                         │
                  ┌──────┼──────┐
                  ▼      ▼      ▼
               Phase 13 Phase 14 Phase 15
               PE       VC       Real Estate
                  └──────┼──────┘
                         ▼
                    Phase 16 Banking
```

Important subtype rule:

- **private/cash M&A** does not need Phase 9 stock-market cutover if its transaction, ownership, debt and valuation prerequisites are already authoritative;
- **share-swap, hostile/public-market and other security-dependent M&A** requires the relevant Phase 9 security/corporate-action capabilities first.

Phase 16 depends on mature entity/accounting/debt/ownership/treasury/consolidation foundations and the Banking-specific entry contract in Section 9. It does not mechanically require every optional PE/VC/real-estate feature to be complete if those systems are not part of the banking slice being enabled.

## 2. Phase prerequisites and authority

| Phase | Hard prerequisites | New authority permitted |
|---|---|---|
| 0 | Gate C accepted; current docs/main review | specification only |
| 0.5 | approved Phase 0 contracts | harness/measurement/characterization infrastructure only |
| 1 Operation/Ledger | Gates A-F + Phase 0.5 accepted + #745 Claude attestation | operation/posting journal for explicitly cut-over company/personal slices; fund/subsidiary adapters remain read-only unless separately authorized |
| 2 Accounting | Phase 1 | standalone accounting projections/source-of-truth slices using the operation model |
| 3 Ownership | Phase 1-2 | canonical security/ownership/control registry by explicitly cut-over issuer family |
| 4 Debt | Phase 1-3 | canonical debt-instrument authority and financing inputs; full WACC remains derived only after Phase 6 valuation inputs exist |
| 5 Industry | Phase 1-4 | aggregate demand/capacity economic state without double-counting detailed production systems |
| 6 Base Valuation | Phase 2-5 | pure/read-only shared valuation primitives and immutable decision snapshots |
| 7 Allocation | Phase 1-6 | candidate normalization, scoring and scheduling for migrated capabilities |
| 8 AI | Phase 6-7 | deterministic allocator over executable capabilities |
| 9 Stocks | Phase 3,6-7 | public security/corporate-action settlement |
| 10 M&A | Phase 1-7; Phase 9 only for public/security-dependent deal types | M&A operation settlement by deal subtype |
| 11 Treasury Settlement | Phase 1-4,10 | legal-entity intercompany funding/transfers only |
| 12 Consolidation + Group Optimization | Phase 2-4,10-11 | consolidated reporting/eliminations plus group liquidity optimization after NCI/elimination read models exist |
| 13 PE | Phase 1-7,10-12 | PE fund/deal settlement; prior adapters are read-only/shadow |
| 14 VC | Phase 1-7,10-12 | VC vehicle/round settlement; prior adapters are read-only/shadow |
| 15 Real Estate | Phase 1-7,11-12 | real-estate capital/operating settlement by owner/SPV slice |
| 16 Banking | Banking entry contract + relevant mature Phase 1-12 foundations | bank balance sheet, deposit/lending/default authority |

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
- shadow evaluation is pure: no production-state mutation and no production RNG consumption;
- `schedulable` requires a defined future commitment/settlement path;
- `executable` requires the authoritative writer for that action to have completed cutover;
- a read-only adapter may reconcile a legacy fund/subsidiary/asset to the common schema without moving settlement authority.

Specific gates:

- stock dividends/buybacks may not execute through Economic Core before Phase 9;
- private/cash M&A may cut over in Phase 10 once its non-stock prerequisites are authoritative;
- public/share-swap/hostile M&A requires the relevant Phase 9 capability;
- PE/VC/real-estate may be modeled/scored earlier, but their fund/vehicle/property settlement remains legacy until their migration phase.

## 4. Current-to-target authority map

| Domain | Current production authority / representation | Target authority | Cutover |
|---|---|---|---|
| player company cash | `g.companyCash` + finance projection | entity accounts + Economic Operations | Phase 1/2 |
| founder personal cash | `g.personalCash` | person entity accounts | Phase 1 |
| standalone ledger/statements | `js/finance.js` | operation journal + standalone accounting | Phase 1/2 |
| weekly atomic rollback | `TycoonEngine.runTransaction()` and committed-week boundary | execution safety only, not accounting authority | Phase 1+ |
| founder/public ownership | `sharesOut`, `founderShares`, ratios and fragmented holders | security registry + ownership edges | Phase 3 |
| subsidiaries | multiple arrays/fields | entities + relationships + ownership edges | Phase 3/12 |
| debt | `companyDebt`, finance loans and subsystem loans | debt instruments tied to entities | Phase 4 |
| industry/store economics | detailed store/market/supply/workforce systems | detailed adapters + aggregate industry layer | Phase 5 |
| base valuation | multiple subsystem formulas | pure shared valuation foundation | Phase 6 |
| capital allocation | current capital-allocation modules | shared candidate/scoring kernel | Phase 7 |
| runtime AI allocation | subsystem-specific deterministic logic | shared deterministic allocator | Phase 8 |
| listed stocks | stock arrays/holdings/current trade logic | securities + public corporate-action authority | Phase 9 |
| M&A | `ma-*.js` modules | Economic Core M&A operations by subtype | Phase 10 |
| legal-entity group transfers | scattered parent/subsidiary behavior | treasury settlement | Phase 11 |
| consolidated reporting/group optimization | partial/report-specific logic | canonical consolidation + elimination-aware group liquidity | Phase 12 |
| PE | `pe-fund.js` and portfolio modules | manager/fund/portfolio entities + Operations | Phase 13 |
| VC/startups | startup/venture state | VC vehicle/security ownership + Operations | Phase 14 |
| real estate | `real-estate*.js` + personal property state | owner/property/SPV Operations | Phase 15 |
| bank | banks primarily modeled as external financing counterparties | bank entities/balance sheets | Phase 16 |

## 5. No-cycle / valuation rules

The following cycles are prohibited:

- **base valuation** consumes completed accounting/ownership/debt/industry/market observations and is pure/read-only;
- Phase 6 uses the pure calculation DAG: observations → Cost of Equity → after-tax Cost of Debt + capital structure → WACC → EV/asset value → Equity Value → immutable base snapshot;
- allocation consumes the immutable base valuation snapshot;
- allocation decisions cannot change the base valuation used to score themselves;
- post-decision/public repricing may use committed decisions/signals, but cannot feed back into the same decision cycle;
- AI may consume candidate scores/constraints, but cannot change the scoring model during the same tick;
- consolidation may derive group statements, but cannot rewrite standalone legal-entity books;
- group liquidity optimization may consume consolidated/NCI/elimination-aware views only after those views exist.

There is therefore no `Allocation → Valuation → same Allocation` fixed-point loop.

## 6. Phase 0.5 gate placement

Phase 0.5 remains between approved contracts and Phase 1.

Its mandatory exit capabilities include:

- deterministic scenario creation and explicit seed;
- current production weekly wrapper/phase-order characterization;
- authoritative-writer inventory;
- invariant runner;
- versioned semantic state projection/hash registry;
- semantic first-diff reporting;
- save/reload fork and compacted-save/reload fork;
- operation replay/idempotency tests;
- deterministic failure/rollback mutation tests;
- deterministic ID-allocation collision tests;
- adapter parity for cash/debt/ownership/standalone finance;
- capability-aware explicit no-op phases;
- performance/save-size/peak-memory proxies;
- monetary Number-envelope reachability tests.

The harness is permanent infrastructure, not disposable test code.

## 7. Treasury / consolidation split

Phase 11 is deliberately narrow:

- legal-entity transfer settlement;
- intercompany loan/equity/dividend/service characterization;
- entity-level liquidity constraints;
- no consolidation-aware optimization.

Phase 12 adds:

- consolidated statements;
- intercompany eliminations;
- NCI/equity-method read models where applicable;
- elimination-aware group liquidity;
- group-level deployable-capital optimization.

This prevents Phase 11 from making group decisions using information that only Phase 12 can calculate correctly.

## 8. Parallel work policy

Parallel PRs are permitted only when they do not introduce competing authorities.

Safe examples:

- docs/contracts and benchmark infrastructure;
- independent UI projections over stable read models;
- tests that measure existing behavior.

Unsafe examples:

- two PRs becoming authoritative for the same cash/ownership/debt fact;
- Phase 9 corporate-action settlement while Phase 3 ownership remains non-authoritative;
- Phase 10 M&A settlement while operation/debt/ownership/base-valuation prerequisites remain legacy-only;
- Phase 13/14 fund settlement while Phase 1 adapters already mutate the same fund cash.

## 9. Banking-specific entry contract

Banking cannot begin merely because a phase number is reached.

Before bank balance-sheet authority is enabled, the Economic Core must support and test:

- bank legal entity/account separation;
- deposit liabilities and withdrawals;
- loan/debt instrument origination and servicing;
- interest accrual/payment;
- credit loss/default/recovery/workout;
- provisioning/allowance treatment;
- liquidity and maturity mismatch;
- capital/equity constraints;
- interbank/external counterparties where used;
- tax/accounting close;
- consolidation boundary with owner/group;
- scalable deterministic counterparty aggregation;
- safe monetary representation at the required balance-sheet scale.

The exact regulatory ratios are gameplay contracts to be approved before Phase 16 implementation.

## 10. Entry to Phase 1

Phase 1 remains blocked until all roadmap hard gates are true, including:

- Gate D approval;
- explicit Claude Code full-remediation completion record on #745;
- accepted Phase 0.5 harness;
- explicit owner Gate F approval;
- fresh implementation branch based on latest stable main.

Gate D documentation approval alone does not authorize Phase 1.
