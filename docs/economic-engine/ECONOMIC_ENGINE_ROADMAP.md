# Capitalism Tycoon Economic Engine Integration Roadmap

**Status: DRAFT — v2**  
**Implementation baseline: NO**  
**Repository baseline reviewed: `849586cfcc2dddcd4148e468c3746f95a83018d2`**  
**Additional audit: completed against local baseline `849586c`**  
**Purpose: audited pre-implementation roadmap**

> IMPORTANT
>
> This document is the current design roadmap candidate, but it is **not yet permission to implement the Economic Engine**.
>
> Implementation may begin only after the explicit start gates in this document are satisfied and the owner approves conversion to an implementation baseline.

---

## 1. Product objective

Introduce a Wall Street Raider-style capital-allocation economic engine beneath the existing Capitalism Tycoon systems without discarding the current game.

Target product synthesis:

- Big Ambitions-style progression and delegation
- Global Business Tycoon-style mobile information architecture
- Wall Street Raider-style economic interconnection and capital allocation

The goal is not to clone WSR or reproduce its internal formulas. The goal is to create a coherent independent economic engine in which operating businesses, stocks, M&A, PE, VC, real estate, debt, and later banking compete for capital inside one economic reality.

---

## 2. Source-of-truth priority

When information conflicts, use this order:

1. Explicit owner decisions
2. Current repository / latest `main`
3. `AGENTS.md` and `CLAUDE.md`
4. Latest approved architecture contracts
5. Latest approved roadmap
6. Historical audits
7. AI assumptions

An old chat, audit, or model output must never override the current repository or an explicit owner decision.

---

## 3. Confirmed owner decisions

These decisions are fixed unless the owner explicitly changes them.

### 3.1 Control Ladder

Use the Japanese Companies Act-based Control Ladder:

- 1%
- 3%
- 1/3
- 1/2
- 2/3
- 90%

Do **not** use 5% / 20% / 51% / 80% as the Control Ladder.

The exact gameplay rights attached to each approved threshold must be defined in Phase 0 before implementation.

### 3.2 Founder net worth

Founder personal net worth includes the founder's own-company stake.

Listed company:

`share price × shares held`

Unlisted company:

`company valuation × founder ownership × 0.7`

The same share or economic value must never be counted twice.

### 3.3 Ending

The ending remains:

**Personal net worth = ¥1 trillion**

### 3.4 Determinism

Determinism work from #731 is treated as completed baseline infrastructure.

Economic Engine work must preserve:

- no `Math.random()` in deterministic production simulation paths
- no uncontrolled real-time clock dependence
- stable deterministic ordering
- UI rendering must not consume simulation RNG
- replayable economic actions
- stable tie-breaking

### 3.5 Out of scope

Do not add these systems as part of the current Economic Engine program:

- options
- futures
- swaps
- crypto assets

They are not required for the intended capital-allocation depth.

---

## 4. Implementation start gates

Economic Engine gameplay implementation must not begin until all required gates are satisfied.

### Gate A — current remediation work complete

The currently active remediation work must be completed first.

At the time v2 was drafted, PR #782 remained open and was not treated as complete.

### Gate B — stable current main

Implementation starts from a refreshed, stable `main`.

### Gate C — physical iPhone baseline

Measure the current game on a physical iPhone Safari environment.

The canonical measurement procedure is:

`docs/economic-engine/IPHONE_BASELINE_PROTOCOL.md`

At minimum capture:

- week-advance runtime
- startup / initial load
- save runtime
- load runtime
- save size
- memory trend or practical proxy
- foreground/background resume behavior
- thermal-throttling behavior where practical

Measured values must be labelled **measured**. Estimates must be labelled **estimated**.

### Gate D — v2 validation complete

Before implementation:

- validate this v2 roadmap against latest `main`
- resolve document conflicts
- approve Phase 0 contracts
- approve the Economic Engine dependency graph

### Gate E — explicit owner approval

Only after the owner approves may this document, or a successor revision, be marked:

`Implementation baseline: YES`

---

## 5. Core principle — One Economic Reality

Do not implement operating companies, finance, PE, VC, M&A, real estate, and banking as disconnected mini-games.

They should converge on shared economic primitives:

- entities
- cash
- accounting
- ownership
- debt
- cost of capital
- industry state
- capital allocation
- valuation
- market state

Example:

```text
Store / business profit
        ↓
Company cash
        ├─ Organic growth
        ├─ CapEx
        ├─ Debt repayment
        ├─ Cash reserve
        ├─ Dividend
        ├─ Buyback
        ├─ M&A
        ├─ PE / VC
        └─ Real estate
```

---

## 6. Economic architecture principles

### 6.1 Shared economics, not necessarily one giant state class

Player companies and AI companies should share:

- accounting rules
- financing cost logic
- valuation logic
- industry economics
- capital-allocation candidate economics
- ownership/control rules
- corporate-action settlement rules

They do **not** need identical UI state or identical detailed operational representation.

### 6.2 Aggregate and detailed models may coexist

Core industries may retain detailed operational systems.

Non-core industries may use aggregate company × industry models.

Never count the same demand, revenue, supply, or cost through both detailed and aggregate models simultaneously.

### 6.3 Decision and execution are separate

Where economically appropriate:

- decisions are made using period-close information
- actions become effective in a later phase or next period
- cash settlement is explicit
- accounting close happens at a defined boundary

This avoids same-tick circularity.

---

## 7. Economic transaction principle

Material transactions must become attributable to explicit legal/economic entities.

Each material transfer should identify at minimum:

- transaction ID
- operation / idempotency ID
- period
- transaction type
- source entity
- source account
- destination entity
- destination account
- amount
- metadata

The initial target is a **game-oriented balanced transaction kernel**, not a complete IFRS/JGAAP bookkeeping system.

---

## 8. Economic invariants

These are non-negotiable design targets.

### Accounting

```text
Assets = Liabilities + Equity
```

within the approved rounding tolerance.

### Cash conservation

For internal transfers:

```text
source decrease = destination increase
```

except for explicitly modeled fees, taxes, losses, issuance, or external flows.

### Asset separation

Strictly separate:

- personal cash/assets
- company cash/assets
- subsidiary cash/assets
- PE fund cash/assets
- VC fund cash/assets
- bank cash/assets

### Shares and ownership

- no share may be counted as owned twice
- ownership must reconcile with issued / treasury / outstanding shares
- control rights must be derived deterministically
- economic ownership and control must not be silently conflated

### Debt

Debt repayment must reduce the correct cash account and the correct principal.

### Dividend

Payer, recipient, tax/withholding, and consolidation effects must reconcile exactly once.

### Buyback

Cash, treasury/outstanding shares, ownership, and per-share metrics must remain consistent.

### M&A

Buyer, seller, target, debt, consideration, fees, ownership, and goodwill must reconcile atomically.

### Consolidation

Intercompany transactions must remain visible in standalone accounts and be eliminated only in consolidated views.

### Determinism

Same state + same commands + same seed must produce the same result.

### Non-finite safety

Economic state must never contain unexplained NaN or Infinity values.

---

# Phase 0 — Economic Specification and Contracts

## Goal

Define the engine contracts before changing economic source-of-truth logic.

### Deliverables

#### 0A. Entity taxonomy

Define legal/economic entities such as:

- person
- operating company
- holding company
- subsidiary
- listed company
- PE fund
- VC vehicle
- portfolio company
- bank
- property vehicle where needed

##### External counterparties

The entity model must also support aggregated external counterparties so balanced transactions can distinguish internal transfers from money entering or leaving the modeled ownership graph.

Minimum external/system counterparty classes:

- Customer / Market
- Supplier
- Employee
- Government / Tax Authority
- External Shareholder
- External Lender
- External Buyer / Seller
- LP / Coinvestor

These counterparties do not need to be persisted as individual NPCs. Aggregated deterministic counterparty IDs are sufficient, but every material transaction must identify both economic legs.

#### 0B. Economic glossary

Define at minimum:

- Revenue
- EBITDA
- EBIT
- NOPAT
- Invested Capital
- ROIC
- Cost of Debt
- Cost of Equity
- WACC
- Enterprise Value
- Equity Value
- Net Debt
- Free Cash Flow
- Deployable Capital

#### 0C. Transaction contract

Define material transaction semantics and required legs.

#### 0D. Tick / period contract

Define:

- phase order
- one-period lag rules
- accounting-close boundary
- valuation boundary
- decision boundary
- settlement boundary
- persistence boundary

#### 0E. Invariant catalog

Convert the important invariants in §8 into machine-testable contracts.

#### 0F. Control Ladder rights table

Map the approved thresholds:

- 1%
- 3%
- 1/3
- 1/2
- 2/3
- 90%

to specific gameplay rights.

#### 0G. Founder net-worth contract

Define:

- listed own-company valuation
- unlisted own-company valuation
- treatment of treasury shares
- treatment of individually purchased own-company shares
- family trust handling
- anti-double-counting rules

#### 0H. Monetary and close contract

Before Ledger implementation, define:

- authoritative monetary unit
- whether authoritative cash values are integer yen or another internal minor unit
- rounding points for interest, tax, ownership, valuation, fees, and distributions
- withholding-tax treatment
- residual rounding treatment
- accrual versus cash-settlement timing
- period-opening versus period-closing values
- tolerance rules for accounting reconciliation

Subsystem-specific rounding rules must not silently accumulate unexplained residuals over long simulations.

### Exit criteria

All agents can interpret entities, transactions, ownership, period boundaries, and invariants consistently.

---

# Phase 0.5 — Permanent Headless Harness

## Goal

Create a permanent simulation and benchmarking harness **before** major Economic Engine implementation.

This is not a one-time phase. It becomes permanent infrastructure used by every later phase.

### Required capabilities

- deterministic scenario creation
- explicit seed
- scenario size controls
- UI-free economic tick execution
- metric probes
- invariant runner
- deterministic state hash
- regression comparison
- JSON / CSV / Markdown reports
- performance timing
- versioned scenario schema
- explicit engine capability declaration

Each scenario should carry at least:

- `harnessSchemaVersion`
- `engineCapabilities`
- `scenarioFeatures`
- `expectedInvariants`

The schema must evolve without invalidating historical benchmark scenarios unnecessarily.

Candidate API shape:

```text
createScenario(...)
stepEconomicTick(...)
runScenario(...)
snapshotMetrics(...)
assertEconomicInvariants(...)
```

### Scale matrix

Company counts:

- 10
- 50
- 100
- 250
- 500
- 1000

Durations:

- 1 year
- 10 years
- 50 years
- 100 years

Do not require every combination in ordinary CI. Define smoke, nightly/manual, and deep-audit tiers.

### Metrics

Track where applicable:

- tick p50 / p95 / p99 / max
- accounting close time
- allocation time
- AI decision time
- valuation time
- serialization time
- save size
- heap / RSS proxy
- transaction/history growth
- invariant failures
- deterministic final hash

### Exit criteria

A stable harness exists before Accounting/Ownership source-of-truth migration begins.

---

# Phase 1 — Entity-aware Unified Ledger Foundation

## Goal

Introduce a shared material-transaction journal without rewriting the entire game into full formal accounting.

### Initial transaction model

```text
EconomicTransaction {
  transactionId
  operationId
  period
  type
  fromEntityId
  fromAccount
  toEntityId
  toAccount
  amount
  metadata
}
```

### Design rules

- material inter-entity transfers use balanced legs
- existing company finance may initially be a projection/adapter
- no long-term dual-authoritative cash systems
- transaction retention must be bounded
- deterministic re-derivable metrics should not be persisted unnecessarily

### Atomic posting requirements

A balanced transaction is committed only after all required legs validate.

Required properties:

- all-or-nothing state mutation
- operation ID and idempotency key
- deterministic replay behavior
- failed transaction leaves the relevant economic state unchanged
- no save or public emit before transaction commit
- projections update only from committed transactions
- invariant validation runs at the defined transaction/close boundary

The target is to prevent partial settlement such as cash changing while debt, ownership, consideration, or the receiving leg remains unposted.

### Exit criteria

Company, personal, fund, and subsidiary material transfers can be reconciled through one entity-aware contract.

---

# Phase 2 — Standalone Accounting Hardening

## Goal

Harden standalone company accounting on top of the transaction/entity contracts.

### Target

- Income Statement
- Balance Sheet
- Cash Flow
- debt reconciliation
- dividend reconciliation
- buyback reconciliation
- asset acquisition
- transaction idempotency

### Invariants included in completion gate

- BS identity
- cash roll-forward
- debt roll-forward
- dividend conservation
- buyback consistency
- no duplicate material transaction
- no non-finite values

### Exit criteria

Validated long-run scenarios show zero accounting-invariant violations inside the approved test envelope.

---

# Phase 3 — Ownership and Control

## Goal

Create a shared ownership/control model for stocks, subsidiaries, M&A, PE, and VC.

### Target concepts

- entity IDs
- issuer identity
- security / share-class identity
- shares issued
- treasury shares
- outstanding shares
- shareholder registry
- holder identity
- beneficial owner
- ownership %
- voting rights
- economic rights
- control rights
- parent/subsidiary relationship
- minority interest
- private/public company state

### Required owner rules

Use only the approved Control Ladder.

Implement founder net-worth anti-double-counting contract.

### Exit criteria

The same ownership foundation can represent listed shares, subsidiaries, PE portfolio ownership, VC stakes, and founder ownership.

---

# Phase 4 — Debt and Cost of Capital

## Goal

Treat debt as capital structure.

### Target

- principal
- maturity
- interest
- refinancing
- default state
- Cost of Debt
- leverage metrics
- WACC
- ROIC comparison

### Core decision signal

```text
ROIC vs Cost of Capital
```

### Exit criteria

Interest-rate and leverage changes propagate consistently into earnings, financing constraints, capital-allocation economics, and valuation inputs.

---

# Phase 5 — Aggregate Industry Supply / Demand

## Goal

Create a shared economic layer that allows investment to affect industry conditions.

### Minimum industry model

Industry:

- base demand
- trend/growth
- cyclical sensitivity
- price elasticity
- capacity lead time
- depreciation

Company × Industry position:

- capacity
- utilization
- unit cost
- price index
- brand/quality moat
- capex pipeline
- invested capital

Core loop:

```text
CapEx
→ Capacity
→ Effective Supply
→ Utilization / Price
→ Margin
→ ROIC
→ Next-period CapEx attractiveness
```

### Deep-industry rule

Detailed store/operations models may override or feed the aggregate layer, but the same sales/capacity must not be counted twice.

### Exit criteria

Overinvestment can create excess capacity and margin pressure; underinvestment can create scarcity and pricing power.

---

# Phase 6 — Shared Capital Allocation Kernel

## Goal

Make capital allocation the central economic decision engine.

### Candidate set

- reserve
- organic growth
- new stores
- CapEx
- R&D
- marketing
- debt repayment
- dividend
- buyback
- M&A

Later adapters:

- PE
- VC
- real estate
- banking

### Capital-allocation capability gates

A candidate has separate lifecycle capabilities:

- modeled
- scored
- shadow-evaluated
- player-visible
- schedulable
- executable

These capabilities must not be treated as equivalent.

Before Phase 9:

- stock corporate actions such as dividend and buyback may be modeled/scored/shadow-evaluated
- they must not be scheduled or executed through the Economic Core until the corresponding stock/corporate-action migration is complete

Before Phase 10:

- M&A may be modeled/scored/shadow-evaluated
- it must not be scheduled or executed through the Economic Core until the M&A migration is complete

A candidate may appear in comparative economics before its production settlement path is authoritative, but shadow evaluation must not mutate production state or consume production RNG.

### Candidate pipeline

```text
Economic observations
→ Candidate generation
→ Feasibility / constraints
→ Expected economics
→ Deterministic score / comparison
→ Decision
→ Scheduled execution
```

### Evaluation dimensions

- expected return
- ROIC
- WACC
- risk
- leverage
- liquidity
- duration
- strategic fit
- synergy
- management capacity
- industry cycle
- opportunity cost

### Exit criteria

No single action is universally dominant across validated scenarios.

---

# Phase 7 — Valuation Engine

## Goal

Create a shared valuation service grounded in economic state.

### Separate layers

#### Private valuation

Used for:

- private companies
- founder net worth
- private M&A
- VC/PE contexts

#### Public market repricing

Used for:

- listed companies
- public market price updates
- buyback/dividend market effects

### Inputs may include

- earnings
- free cash flow
- growth
- leverage
- industry conditions
- risk
- interest rates
- market multiple
- liquidity where appropriate

### Circularity guard

Do not allow same-tick price changes caused by a decision to recursively change the same decision.

### Exit criteria

Operational improvement, leverage, growth, rates, and industry cycle affect value in explainable and deterministic ways.

---

# Phase 8 — AI Company Capital Allocator

## Goal

Make AI companies capital allocators using the same shared economics.

### Runtime policy

Do not call an LLM every simulation tick.

Use deterministic candidate generation and scoring.

### Recommended pipeline

```text
Observations
→ Candidate Generator
→ Feasibility Filter
→ Deterministic Utility Score
→ Stable Tie-break
→ Planned Action
→ Later Execution
```

### Personality

Represent personality primarily as weights, not separate rule systems.

Candidate profiles:

- Conservative
- Growth
- Acquirer
- Value
- Defensive
- Leveraged

### Performance rules

Avoid naive O(N²) target search.

Use:

- industry/size indexes
- shortlist limits
- sparse/quarterly decision cadence
- trigger-based evaluation
- top-K target selection
- cached shared metrics

### Exit criteria

AI profiles behave differently over long runs and obey the same economic rules and accounting contracts as the player.

The AI allocator may execute only candidates whose corresponding migration capability is marked executable. Unmigrated candidates may remain shadow-scored only.

---

# Phase 9 — Stocks and Corporate Actions Migration

## Goal

Move listed-equity behavior onto the shared ownership, accounting, valuation, and transaction foundations.

### Target

- issuance
- dilution
- dividends
- buybacks
- shareholder updates
- treasury shares
- founder ownership
- Control Ladder consequences
- market repricing integration

### Exit criteria

Stocks are no longer economically disconnected from issuing-company fundamentals and ownership.

---

# Phase 10 — M&A Migration

## Goal

Move M&A onto the shared transaction, debt, valuation, and ownership contracts.

### Target

- target valuation
- financing
- consideration
- partial/full acquisition
- buyer/seller settlement
- target debt
- goodwill
- atomic rollback
- ownership/control transition

### Exit criteria

M&A settlement reconciles cash, debt, ownership, consideration, and goodwill exactly once.

---

# Phase 11 — Group Treasury

## Goal

Allow group-level capital management without mixing legal-entity cash.

### Minimum transfers

- dividend
- capital contribution
- intercompany loan
- loan repayment
- cash sweep
- management fee where applicable

### Rules

- fund cash is not holding-company cash
- subsidiary cash is not automatically parent free cash
- intercompany loans have lender and borrower balances
- transfers must flow through the shared transaction contract

### Exit criteria

The group can allocate capital across entities while preserving legal/economic separation.

---

# Phase 12 — Minimal Consolidated Accounting

## Goal

Provide game-useful group accounts without implementing full IFRS/JGAAP.

### Minimum scope

- standalone statements remain authoritative per entity
- controlled subsidiaries aggregate line by line
- intercompany loans eliminated in consolidated view
- intercompany dividends eliminated
- relevant intercompany revenue eliminated where modeled
- minority interest
- goodwill
- equity-method summary for non-controlled affiliates

### Explicitly not required initially

- full purchase-price allocation
- deferred tax complexity
- OCI
- complex step acquisitions
- complete cross-holding accounting

### Exit criteria

Standalone and consolidated views reconcile without double counting.

---

# Phase 13 — PE Integration

## Goal

Connect existing PE systems to the shared Economic Core.

### Target

- fund entity
- LP commitments
- GP commitment
- fund cash
- capital calls
- portfolio ownership
- acquisition settlement
- portfolio-company accounting
- management fees
- distributions
- carry
- NAV / DPI / TVPI
- exits

### Exit criteria

PE no longer depends on isolated accounting rules that conflict with shared ownership/ledger logic.

---

# Phase 14 — VC Integration

## Goal

Move VC/minority startup ownership onto the shared ownership, valuation, and transaction foundations.

### Target

- funding rounds
- dilution
- follow-on
- private valuation
- minority stakes
- IPO
- acquisition exit

### Exit criteria

VC holdings reconcile with the same ownership and valuation rules used elsewhere.

---

# Phase 15 — Real Estate Integration

## Goal

Make real estate compete with other uses of capital while preserving existing operational detail.

### Target

- return metrics
- debt
- liquidity
- duration
- risk
- capital-allocation candidate adapter

### Exit criteria

Real estate can be compared meaningfully against business expansion, debt repayment, M&A, PE/VC, and reserves.

---

# Phase 16 — Banking Gate and Banking

Banking is deliberately late.

## Required start gate

Do not begin Banking until all are true:

- debt/default invariants stable
- entity-aware ledger stable
- ownership stable
- Group Treasury stable
- minimal consolidation stable
- long-run headless regression stable
- agreed company-count performance target achieved
- save-size budget respected
- explicit owner approval

### Candidate banking scope

Assets:

- corporate loans
- mortgages
- consumer loans
- securities
- cash

Liabilities:

- deposits
- wholesale funding where needed

Equity:

- bank capital

### Exit criteria

Banking participates in credit allocation without creating a parallel economic universe.

---

# Continuous Track A — Invariant / Property Testing

Invariant testing begins with Phase 0 and continues through every later phase.

Priority areas:

- accounting
- cash conservation
- entity separation
- shares
- ownership
- debt
- dividend
- buyback
- M&A atomicity
- consolidation
- idempotency
- determinism
- non-finite state

Property-based tests should focus on pure economic transitions, not indiscriminately on UI.

Failed generated scenarios should preserve seed/scenario data for deterministic reproduction.

---

# Continuous Track B — Headless Long-run Simulation

The Phase 0.5 harness remains active throughout development.

Use tiered runs:

### Fast CI

Small scenarios and invariant smoke tests.

### Extended CI / manual

Medium company counts and multi-year runs.

### Deep audit

Long-run 50–100 year simulations and larger populations.

Every major economic-source-of-truth migration should produce before/after metrics.

---

# Continuous Track C — Performance

Measure, do not assume.

Important hotspots identified by the additional audit:

- repeated linear `filter/find`
- whole-market / whole-company scans
- M&A target search
- per-company retained history
- full-state serialization
- prototype-wrapper execution complexity
- UI rendering of large company lists

Synthetic Node evidence from the additional audit showed that naive scaling is not safe:

| Companies | Synthetic 1 tick | State JSON | Serialization |
|---:|---:|---:|---:|
| 10 | ~24 ms | ~0.41 MiB | ~6 ms |
| 50 | ~69 ms | ~0.69 MiB | ~16 ms |
| 100 | ~182 ms | ~1.03 MiB | ~22 ms |
| 250 | ~433 ms | ~2.13 MiB | ~66 ms |
| 500 | ~811 ms | ~3.93 MiB | ~134 ms |
| 1000 | ~1.53 s | ~7.53 MiB | ~210 ms |

These are **synthetic Linux/Node measurements**, not iPhone production performance.

They are hotspot evidence only.

### Scaling strategy

Progress through measured gates:

```text
100
→ 250
→ 500
→ 1000
```

Gate interpretation:

- **100 companies** — initial production-scale acceptance target
- **250 companies** — post-optimization scale gate
- **500 companies** — high-density-world stretch gate
- **1000 companies** — architecture feasibility target, not a fixed product requirement

Each gate must evaluate together:

- Node/headless p50 and p95
- desktop-browser p50 and p95
- physical iPhone Safari p50 and p95
- peak/steady memory
- save bytes
- save/load latency
- deterministic final hash
- invariant failures = 0
- UI virtualization/lazy-rendering behavior where relevant

Do not promise 1000-company support before physical-device and production-path evidence.

Web Workers are not an automatic remedy. First reduce avoidable work such as repeated linear lookup, unpartitioned market scans, unbounded history, dense AI cadence, and naive M&A target search.

---

# Continuous Track D — Calibration

Automate:

- deterministic seed matrices
- parameter sweeps
- metric aggregation
- percentile output
- baseline comparison
- pathology detection
- report generation

Do not automate:

- production parameter commits
- owner target-range changes
- invariant fixes through balance tuning

Workflow:

```text
Simulation
→ Measurement
→ Invariant Check
→ Pathology Detection
→ Diagnosis
→ Proposed Adjustment
→ Human/Owner Review
→ Dedicated Balance PR
```

Track at minimum:

- bankruptcy rate
- survival curve
- ROIC
- WACC
- Debt / EBITDA
- margins
- utilization
- market concentration
- M&A frequency
- dividend/buyback frequency
- cash / revenue
- negative equity rate
- founder net-worth progression

---

# Continuous Track E — Mobile UX / Physical iPhone Performance

Mobile is not a final polish phase.

Each major vertical slice must preserve iPhone usability and performance.

### UI direction

Do not copy WSR's desktop terminal UI.

Use progressive disclosure:

```text
Home
→ Portfolio
→ Entity
→ Capital
→ Action
→ Advanced detail
```

### Physical-device gates

#### Baseline Gate

Before Economic Engine implementation, capture current-production physical-iPhone metrics.

#### Regression Gate

After each major Economic Engine vertical slice, compare against the approved baseline and prior accepted build.

#### Scale Gate

Scale through the approved company-count targets independently of feature completion. Reaching 1000 companies is not required to continue every earlier phase.

### Physical-device metrics

At minimum measure:

- week advance p50 / p95 / p99
- long tasks
- input responsiveness
- save/load latency
- memory trend
- background/foreground resume
- thermal throttling
- UI open/closed comparison

Performance thresholds are engineering budgets, not immutable product rules. Any proposed threshold must be identified as a target until validated.

---

## 9. Migration strategy — Strangler pattern

Do not rewrite all existing systems at once.

Use:

```text
Legacy state/actions
        ↓
Adapter
        ↓
Economic command / transaction
        ↓
Economic Core
        ↓
Projection to existing UI/save fields
```

### Shadow migration rule

Temporary shadow mode is allowed:

1. old calculation remains authoritative
2. new calculation runs in shadow
3. compare results
4. resolve differences
5. switch source of truth
6. keep old side as read-only adapter if required
7. remove old authority later

Never keep two authoritative writers for the same economic value for an extended period.

Do not hide dual-write divergence with automatic reconciliation adjustments.

### Per-feature migration authority contract

Every migrated subsystem must declare:

- current source of truth
- shadow calculator
- authoritative writer
- save projection
- UI projection
- tick phase
- idempotency guard
- legacy adapter
- legacy retirement condition

Recommended lifecycle:

```text
Observe
→ Shadow
→ Cutover
→ Projection
→ Retire
```

During **Shadow**, the new core must not mutate authoritative production state.

During **Cutover**, exactly one writer becomes authoritative.

---

## 10. Recommended migration order

1. Entity / transaction semantics
2. Ledger
3. Standalone accounting
4. Ownership / shares
5. Debt / cost of capital
6. Industry economics
7. Capital allocation
8. Valuation
9. AI allocator
10. Stocks / corporate actions
11. M&A
12. Group Treasury
13. Consolidation
14. PE
15. VC
16. Real Estate
17. Banking

---

## 11. Tick architecture target

Recommended target pipeline:

```text
0. Apply previously committed actions
1. Advance calendar / establish period context
2. Macro state update
3. Industry demand and exogenous supply update
4. Operational capacity availability
5. Market clearing / price and volume allocation
6. Operations settlement
7. Debt interest / principal / taxes
8. Standalone accounting close
9. Standalone invariant gate
10. Standalone derived metrics: ROIC / leverage / liquidity
11. Group consolidation / intercompany eliminations
12. Consolidated invariant gate
13. Consolidated derived metrics where applicable
14. Capital-allocation candidate generation
15. Player / AI decisions
16. Schedule next-period CapEx / financing / corporate actions
17. Valuation
18. Public market repricing
19. Progression / reports / diagnostics
20. Normalize → atomic save snapshot → emit
```

Before Phase 12 exists, consolidation-related phases are explicit no-ops.

After Minimal Consolidation is introduced, consolidated metrics may feed group-level decisions and valuation only according to an approved valuation contract. Standalone legal-entity decisions must continue to use the correct standalone metrics.

If a particular minimal-consolidation implementation is reporting-only, it must explicitly declare:

- consolidated statements are reporting projections only
- same-period consolidated results do not feed capital allocation
- same-period consolidated results do not feed valuation or market repricing

### One-period lag contract

Capital allocation, buybacks, M&A, CapEx, and financing decisions use the latest completed accounting period and the pre-action valuation/market price.

Decisions are scheduled after close and become effective in a later execution phase or period according to the approved transaction contract.

Do not introduce same-period fixed-point iteration unless it is separately specified, justified, and tested.

### Weekly subsystem declaration

During Strangler migration, every weekly subsystem participating in economic state mutation must declare:

- execution phase
- authoritative writer
- legacy adapter
- idempotency guard
- retirement condition

This prevents module-load/prototype-wrapper order from silently reintroducing close-after-mutation or duplicate-posting behavior.

This is a target architecture contract, not permission to rewrite `advanceWeek` in one PR.

Migration should preserve existing behavior through adapters while phase boundaries are introduced incrementally.

---

## 12. Deployable Capital

Candidate definition:

```text
Cash
- Tax payable
- Near-term debt maturity
- Minimum liquidity
- Existing commitments
- Approved CapEx
- Fund commitments
= Deployable Capital
```

This formula is **not yet final**.

Phase 0 must define:

- exact components
- entity scope
- period horizon
- treatment of restricted fund cash
- approved-but-not-paid commitments
- intercompany availability rules

---

## 13. AI architecture

Use LLMs for:

- design
- implementation assistance
- test generation
- benchmark analysis
- audit
- calibration diagnosis

Do not require an LLM for routine in-game company decisions.

Runtime AI should be deterministic and explainable.

### Standard development workflow

#### ChatGPT

- Economic Architect
- causal model
- specification
- invariant definition
- roadmap/dependency design
- PR review
- CI/evidence interpretation

#### Codex

- repository investigation
- implementation
- refactor
- tests
- benchmark harness
- long-run simulation
- regression diagnosis
- PR creation

#### Optional independent reviewer

Claude / Claude Code / another model / human reviewer may be used for high-risk independent review.

Availability of a third model must not be a completion dependency.

---

## 14. Agent handoff contract

Every agent should leave enough evidence for another agent to continue safely.

### Before work

Record:

- refreshed main SHA
- related PRs
- relevant files
- existing tests
- known risks

### Work scope

Record:

- goal
- non-goals
- invariants
- dependencies
- source of truth

### After work

Record:

- changed files
- tests added/changed
- test results
- remaining risks
- save impact
- determinism impact
- performance impact
- recommended next task

The roadmap is model-independent.

---

## 15. PR decomposition guidance

Approximate small-PR envelope from the additional audit:

| Area | Approx. PRs |
|---|---:|
| Phase 0 specification | 2–3 |
| Phase 0.5 harness | 3–4 |
| Phase 1 ledger | 3–5 |
| Phase 2 accounting | 3–5 |
| Phase 3 ownership | 4–6 |
| Phase 4 debt/WACC | 3–5 |
| Phase 5 industry | 4–6 |
| Phase 6 allocation | 4–6 |
| Phase 7 valuation | 3–5 |
| Phase 8 AI | 4–6 |
| Phase 9 stocks | 3–5 |
| Phase 10 M&A | 5–8 |
| Phase 11 treasury | 3–5 |
| Phase 12 consolidation | 4–7 |
| Phase 13 PE | 4–6 |
| Phase 14 VC | 3–5 |
| Phase 15 real estate | 2–4 |
| Phase 16 banking | 6–10 |

Indicative total:

**~60–100 small PRs**

This is a planning range, not a delivery commitment.

Repository evidence may reduce or increase the final count.

---

## 16. P0 before implementation

The following must be resolved before Economic Engine implementation begins:

1. complete current remediation work
2. obtain physical iPhone baseline
3. validate v2 against latest main
4. resolve conflicting design documents
5. approve entity taxonomy, including external/system counterparties
6. approve monetary / rounding / accrual contract
7. approve transaction contract and atomic-posting semantics
8. approve tick order / period lag
9. approve invariant catalog
10. define Control Ladder rights table
11. define founder net-worth anti-double-counting behavior
12. define ledger retention / compaction budget
13. define save-size budget
14. define deterministic state-hash strategy
15. define versioned headless scenario schema and seed/scenario matrix
16. define each existing feature's current source of truth, capability state, and migration authority
17. define Banking start gate
18. explicitly approve conversion to `Implementation baseline: YES`

---

## 17. Document consistency

The previously identified PR #783 Control Ladder conflict was corrected on its branch to the owner-approved list:

- 1%
- 3%
- 1/3
- 1/2
- 2/3
- 90%

Before implementation starts, merged project documents must still be checked on latest `main` to ensure no stale 5% / 20% Control Ladder remains as an approved rule.

---

## 18. Known performance evidence and limitations

The additional audit successfully verified existing determinism/accounting/market/competitor/PE/M&A tests on its local baseline.

It also produced a synthetic scaling benchmark.

However:

- no physical iPhone benchmark was run
- the 1000-company result was not a full-production week
- 100–1000 companies were not run for 100 full production years
- browser IndexedDB, rendering, GC, and thermal behavior were not included

Therefore, performance capability claims remain gated on measurement.

---

## 19. Roadmap completion definition

Roadmap v2 is considered architecturally validated only after:

- latest-main review
- independent Codex review against this exact v2 text
- document conflict resolution
- owner approval

Even then, implementation remains blocked until the start gates in §4 are satisfied.

---

# Final design principle

The target is not feature count.

The target is a coherent game in which limited capital must be allocated across competing opportunities, and those decisions affect operations, ownership, financing, valuation, competition, and long-term wealth through shared economic rules.

As the empire grows, manual work should not scale linearly with company size.

The player's decision layer should rise:

```text
Founder
→ Operator
→ CEO
→ Conglomerate Owner
→ Capital Allocator
→ Financial Empire
```
