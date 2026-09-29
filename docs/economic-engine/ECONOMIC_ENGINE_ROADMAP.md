# Capitalism Tycoon Economic Engine Integration Roadmap

**Status: DRAFT — v1**  
**Implementation baseline: NO**  
**Baseline audit / main: `849586cfcc2dddcd4148e468c3746f95a83018d2`**  
**Purpose: pre-implementation roadmap for additional Economic Engine audit**

> IMPORTANT: This document is not yet an implementation source of truth.
>
> Before Economic Engine implementation:
> 1. Complete the current remediation work.
> 2. Measure the iPhone performance baseline on real hardware where required.
> 3. Complete the Economic Engine additional audit based on the existing `849586c` audit.
> 4. Update this document to Roadmap v2.
> 5. Only Roadmap v2 or later may become the implementation baseline.

## 1. Purpose

Introduce a Wall Street Raider-style capital-allocation economic engine beneath the existing Capitalism Tycoon systems without discarding the current game.

Target structure:

- Big Ambitions-style progression and delegation
- Global Business Tycoon-style mobile information architecture
- Wall Street Raider-style economic / capital-allocation engine

The objective is not to clone WSR. The objective is to make stores, businesses, stocks, M&A, PE, VC, real estate, subsidiaries, debt, and later banking operate inside one coherent economic reality.

## 2. Source-of-truth priority

When information conflicts, use this order:

1. Explicit owner decisions
2. Current repository / latest `main`
3. `AGENTS.md` and `CLAUDE.md`
4. Latest approved architecture documents
5. Latest approved roadmap
6. Historical audits
7. AI assumptions

No agent may treat an old chat, audit, or model output as stronger evidence than the current repository.

## 3. Confirmed owner decisions

These decisions are already made and should not be reopened during the additional audit unless the owner explicitly changes them.

### 3.1 Control Ladder

Do not use simplified 5% / 20% / 51% / 80% thresholds.

Use the Japanese Companies Act-based Control Ladder using these thresholds:

- 1%
- 3%
- 1/3
- 1/2
- 2/3
- 90%

The exact in-game rights attached to each threshold must be specified separately before implementation.

### 3.2 Founder net worth

Founder personal net worth includes the founder's own-company stake.

Listed company:

`share price × shares held`

Unlisted company:

`company valuation × founder ownership × 0.7`

The same share or economic value must never be counted twice.

### 3.3 Ending

Keep the ending condition:

**Personal net worth = ¥1 trillion**

### 3.4 Determinism

Determinism work from #731 is treated as already completed.

Economic Engine changes must preserve the existing deterministic contract and must not introduce simulation-path usage of:

- `Math.random()`
- uncontrolled real-time clock dependence
- nondeterministic iteration or ordering
- UI-driven simulation RNG consumption

### 3.5 Out of scope

Do not add these systems as part of the current Economic Engine program:

- options
- futures
- swaps
- crypto assets

They are not required to achieve the intended capital-allocation depth.

## 4. Development start gates

No new Economic Engine gameplay implementation begins until all required gates are satisfied.

### Gate A — current remediation work

Finish the currently active remediation work first.

### Gate B — stable main

Economic Engine work starts from a stable current `main`.

### Gate C — iPhone baseline

Measure the existing game before major Economic Engine integration.

At minimum capture, where technically measurable:

- week-advance runtime
- startup / initial load
- save runtime
- load runtime
- save size
- memory trend or practical proxy
- important iPhone Safari rendering/runtime regressions

Measured values must be labelled **measured**. Estimates must be labelled **estimated**.

## 5. Core design principle — One Economic Reality

Do not implement finance, operating companies, PE, VC, M&A, real estate, and later banking as isolated mini-games.

They should share a common foundation:

- cash
- accounting
- ownership
- debt
- capital
- valuation
- industry state
- market state

Example:

```text
Store profit
  ↓
Company cash
  ├─ Organic growth
  ├─ Debt repayment
  ├─ Dividend
  ├─ Buyback
  ├─ M&A
  ├─ Strategic investment
  ├─ PE / VC
  └─ Real estate
```

## 6. Economic spine

Target dependency direction:

```text
MACRO
  ↓
INDUSTRY
  ↓
OPERATIONS
  ↓
ACCOUNTING
  ↓
CAPITAL STRUCTURE
  ↓
CAPITAL ALLOCATION
  ↓
OWNERSHIP / CORPORATE ACTIONS
  ↓
VALUATION
  ↓
MARKET
  ↓
NEXT PERIOD
```

The additional audit must validate whether this ordering fits the existing codebase and identify any circular dependencies.

## 7. Capital Allocation Core

Player-controlled and AI-controlled companies should ultimately allocate capital among competing uses such as:

- organic growth
- new stores
- CapEx
- R&D
- marketing
- debt repayment
- cash reserve
- dividend
- buyback
- M&A
- strategic investment
- PE
- VC
- real estate

The same underlying capital should compete across uses whenever economically appropriate. Avoid creating unrelated special-purpose currencies merely to simplify implementation.

## 8. Deployable Capital

Candidate concept:

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

The final formula is not approved in v1. The additional audit must determine which components already exist, how they are represented, and which should be added.

## 9. Economic invariants

These are non-negotiable design targets.

### 9.1 Accounting

```text
Assets = Liabilities + Equity
```

### 9.2 Cash movement

Every material cash movement must be attributable to:

- source
- destination
- amount
- transaction type
- period
- entity

No unexplained creation or destruction of money.

### 9.3 Asset separation

Strictly separate:

- personal cash/assets
- company cash/assets
- subsidiary cash/assets
- PE fund cash/assets
- VC fund cash/assets
- bank cash/assets

### 9.4 Ownership

- no share may be owned twice
- ownership must remain consistent with shares outstanding
- control and economic ownership should not be silently conflated

### 9.5 Valuation

The same economic value must not be counted more than once in personal or group net worth.

### 9.6 M&A

Buyer, seller, target, debt, consideration, ownership, and fees must reconcile as one coherent transaction.

## 10. Agent-independent working method

Every coding agent should follow the same general sequence:

1. Refresh latest `main`.
2. Read relevant project rules and only the relevant design documents.
3. Identify the affected module(s).
4. Inspect existing tests.
5. Identify applicable economic invariants.
6. Produce a scoped implementation plan.
7. Make the smallest coherent change.
8. Run focused unit tests.
9. Run invariant/property tests where relevant.
10. Run long-run regression/simulation tests where relevant.
11. Verify save compatibility.
12. Verify determinism.
13. Verify mobile regression risk.
14. Run required CI.

The roadmap must be usable by ChatGPT, Codex, Claude Code, or another coding agent. Project artifacts and contracts are the source of truth, not the identity of the model.

---

# Phase 0 — Economic Foundation Specification

## Goal

Freeze the vocabulary, causal model, transaction taxonomy, and invariants before major implementation.

### 0A. Economic glossary

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

### 0B. Economic causality map

Example:

```text
Interest rate ↑
→ Cost of debt ↑
→ WACC ↑
→ Investment threshold ↑
→ CapEx ↓
→ Capacity growth ↓
```

### 0C. Transaction taxonomy

Specify transactions such as:

- sale
- payroll
- CapEx
- debt draw
- debt repayment
- dividend
- buyback
- acquisition
- equity issue
- intercompany loan
- capital contribution

### 0D. Economic invariant specification

Convert important invariants into machine-testable contracts where practical.

### Exit criteria

Agents can interpret the same economic concepts, money flows, and causal relationships consistently.

---

# Phase 1 — Unified Accounting / Ledger

## Goal

Create or validate one coherent accounting/money-movement foundation for the economic engine.

Target surfaces:

- Income Statement
- Balance Sheet
- Cash Flow
- transaction / ledger representation

Requirements:

- company and personal cash remain strictly separated
- no double counting
- money conservation where applicable
- explicit modeled exceptions for taxes, fees, write-offs, issuance, etc.

Candidate tests:

- Assets = Liabilities + Equity
- dividend conservation
- debt repayment
- CapEx
- revenue
- expense
- transfer
- M&A settlement

### Exit criteria

Long-run simulation produces zero accounting invariant violations in the validated test envelope.

---

# Phase 2 — Unified Ownership / Control

## Goal

Unify stocks, subsidiaries, M&A, PE, and VC around one ownership/control model.

Target concepts:

- shares outstanding
- ownership %
- control rights
- Control Ladder
- parent/subsidiary relationships
- minority interests
- public/private ownership

The owner-approved Japanese Companies Act Control Ladder must be used.

### Exit criteria

The same ownership model can represent:

- player
- holding company
- subsidiary
- public company
- PE fund
- portfolio company
- VC vehicle
- startup

without duplicating incompatible ownership systems.

---

# Phase 3 — Debt / Interest / Cost of Capital

## Goal

Treat debt as capital structure rather than only emergency financing.

Target concepts:

- principal
- interest
- maturity
- refinancing
- Cost of Debt
- credit risk
- WACC
- ROIC

Core decision:

```text
ROIC vs WACC
```

### Exit criteria

Interest-rate changes propagate rationally through financing cost, investment decisions, earnings, and valuation.

---

# Phase 4 — Industry Supply / Demand

## Goal

Connect company operations and investment decisions to competitive industry state.

Candidate industry state:

- demand
- capacity
- supply
- utilization
- competition
- pricing power
- growth

Core feedback:

```text
CapEx
→ Capacity
→ Supply
→ Price / utilization
→ Margin
→ ROIC
→ Next-period CapEx
```

### Exit criteria

Overinvestment by companies can create excess capacity and lower margins; underinvestment can create scarcity and stronger pricing power.

---

# Phase 5 — Capital Allocation Engine

## Goal

Make capital allocation a central decision system.

Candidate allocation choices:

- organic growth
- new stores
- CapEx
- R&D
- marketing
- debt repayment
- reserve
- dividend
- buyback
- M&A

Later integrations may include:

- PE
- VC
- real estate
- banking

Evaluation dimensions may include:

- expected return
- ROIC
- WACC
- risk
- liquidity
- duration
- leverage
- strategic fit
- synergy
- management capacity
- industry cycle
- opportunity cost

### Exit criteria

The optimal decision is context-sensitive; gameplay must not collapse into simply selecting the numerically highest displayed return.

---

# Phase 6 — Valuation Engine

## Goal

Derive company value from economic state rather than arbitrary isolated multipliers.

Target concepts:

- Enterprise Value
- Equity Value
- Net Debt
- earnings
- cash flow
- growth
- risk
- industry multiple
- interest-rate environment

Do not copy WSR formulas. Build an independent model appropriate to Capitalism Tycoon.

### Exit criteria

Operational improvement, leverage, growth, interest rates, and industry cycle affect valuation in explainable ways.

---

# Phase 7 — AI Capital Allocation

## Goal

Make AI companies capital allocators subject to the same economic rules.

Runtime policy:

Do not call an LLM every simulation tick.

Prefer deterministic utility/scoring functions.

Candidate personalities:

- Conservative
- Growth
- Acquirer
- Value
- Defensive
- Leveraged

### Exit criteria

Different AI profiles create different long-run behavior while obeying the same accounting and economic rules as the player.

---

# Phase 8 — Headless Simulation & Calibration

## Goal

Validate the economic engine outside the UI and establish measured scaling limits.

Candidate simulation matrix:

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

Metrics:

- bankruptcy rate
- ROIC
- WACC
- Debt / EBITDA
- margins
- revenue growth
- industry concentration
- M&A frequency
- wealth distribution
- survival rate
- cash levels

Detect pathologies such as:

- infinite growth
- unexplained cash creation
- debt spiral
- M&A spam
- inevitable monopoly
- universal bankruptcy
- buyback dominance
- dividend dominance
- growth dominance

### Rule

Do not promise 1,000-company support before measurement.

### Exit criteria

Validated simulation envelopes and explicit measured performance limits are documented.

---

# Phase 9 — Group Treasury / Consolidated Accounting

## Goal

Support economic groups rather than disconnected legal entities.

Group Treasury should make visible per-entity:

- cash
- debt
- available/deployable capital
- commitments

Candidate transactions:

- dividend
- capital contribution
- intercompany loan
- cash sweep

Consolidation targets:

- standalone IS
- standalone BS
- consolidated IS
- consolidated BS
- minority interests
- intercompany elimination

### Exit criteria

The player can manage a group as an economic empire without silently mixing legal-entity cash.

---

# Phase 10 — Existing Feature Migration

## Goal

Connect existing systems to the Economic Core incrementally.

Candidate migration targets:

- stores
- businesses
- stocks
- M&A
- subsidiaries
- PE
- VC
- real estate

### Rule

Do not migrate all existing systems in one PR or one release-sized change.

Temporary adapters are acceptable when they preserve correctness, save compatibility, and determinism.

---

# Phase 11 — Advanced M&A

Candidate systems:

- friendly acquisition
- tender offer
- hostile acquisition
- merger
- MBO
- LBO
- asset sale
- spin-off
- restructuring
- strategic sale
- IPO exit
- secondary buyout

Post-acquisition choices may include:

- hold
- integrate
- restructure
- sell assets
- invest
- reduce debt
- exit

---

# Phase 12 — Banking

Only begin after the Economic Core is stable.

Candidate bank balance sheet:

Assets:

- corporate loans
- mortgages
- consumer loans
- securities
- cash

Liabilities:

- deposits
- funding

Equity:

- bank capital

Economic connection:

```text
Bank credit
→ Company investment
→ Industry capacity
→ Economic outcomes
```

---

# Phase 13 — PE / VC Deep Integration

## PE

Integrate with the shared economic model:

- fund cash
- LP commitments
- GP commitment
- capital calls
- portfolio ownership
- debt
- NAV
- DPI
- TVPI
- exit

## VC

Candidate integration:

- funding rounds
- dilution
- growth
- follow-on investment
- IPO
- acquisition exit

---

# Phase 14 — Mobile Capital Allocation UX

## Goal

Expose Economic Engine depth on iPhone without copying the WSR desktop terminal.

Candidate information hierarchy:

```text
Home
→ Portfolio
→ Entity
→ Capital
→ Action
→ Advanced detail
```

Core Capital Allocation screen may show:

- Deployable Capital
- existing commitments
- opportunities
- expected return
- risk
- duration
- strategic fit

The production D UI remains the repository's visual language.

---

# Phase 15 — Delegation / Automation

Use progression to reduce operational burden as the company grows.

Candidate hierarchy:

```text
Store Manager
→ Area Manager
→ Business Head
→ COO / CFO
→ Subsidiary CEO
→ Player
```

Target player progression:

```text
Founder
→ Operator
→ CEO
→ Group CEO
→ Capital Allocator
```

Prefer policy-based automation to opaque full automation.

---

# Phase 16 — Endgame Economic Depth

Candidate late-game systems:

- mega M&A
- conglomerate restructuring
- banking empire
- PE empire
- global market cycles
- succession / legacy
- corporate breakups

The confirmed ending condition remains:

**Personal net worth = ¥1 trillion**

---

# 11. Performance gates

After major phases, measure relevant performance before adding additional complexity.

Track where applicable:

- week advance
- long-run simulation throughput
- save size
- save/load runtime
- memory
- iPhone Safari runtime/rendering

If performance degrades materially, architecture correction takes priority over stacking additional systems.

# 12. Save compatibility

Non-negotiable current contracts include:

- `SAVE_KEY=capitalism_tycoon_web_v1`
- `saveVersion=9`
- backward compatibility

No schema-breaking implementation without an explicit migration.

# 13. Property / invariant testing targets

Normal unit tests are necessary but insufficient.

Candidate invariant coverage:

## Accounting

`Assets = Liabilities + Equity`

## Shares

`owned shares <= shares outstanding`

## Ownership

ownership/control relationships remain internally consistent.

## Cash

money movements reconcile.

## Debt

repayment reduces cash and principal correctly.

## Dividend

company cash decreases and shareholder value/cash is credited exactly once as specified.

## Buyback

cash and share count change consistently.

## M&A

consideration, debt, ownership, and seller/buyer effects reconcile.

## Consolidation

intercompany transactions are not double counted.

# 14. Agent handoff contract

Every agent should leave enough evidence for another agent to continue safely.

## Before work

Record:

- main SHA
- related PRs
- relevant files
- existing tests
- known risks

## Work scope

Record:

- goal
- non-goals
- invariants
- dependencies

## After work

Record:

- changed files
- tests added/changed
- test results
- remaining risks
- save impact
- determinism impact
- performance impact
- recommended next task

# 15. Model independence

The roadmap is not owned by ChatGPT, Codex, Claude Code, or any other model.

Any agent taking over work must re-check:

1. repository state
2. applicable tests
3. approved specifications
4. approved roadmap

before trusting previous-agent summaries.

# 16. Roadmap v1 next step

Do **not** start implementation from this v1 document.

Next step:

**Economic Engine Additional Audit**

Use the existing audit baseline at main `849586c`. Do not repeat the entire prior audit from scratch.

Focus on areas that require additional work:

1. Headless Simulation Architecture
2. Property-based / Economic Invariant Testing
3. AI Company Utility Function
4. Industry Supply / Demand Model
5. Automated Calibration
6. Economic Tick Architecture
7. Unified Ledger feasibility
8. Group Treasury feasibility
9. Consolidated Accounting feasibility
10. Economic Core performance
11. Existing-system migration strategy
12. Codex-centered development workflow

# 17. Roadmap v2 gate

After the additional audit, revise this document.

Roadmap v2 must resolve at least:

- final phase order
- phase dependencies
- which phases merge or split
- implementation prerequisites
- P0 technical debt
- migration strategy
- expected PR decomposition
- performance measurement strategy
- headless-simulation scale
- AI architecture
- calibration strategy

Only after owner approval may a later revision be marked:

`Implementation baseline: YES`

# Final design principle

The target is not "more features."

The target is a game in which the player repeatedly makes meaningful decisions about where limited capital should go, while stores, operating companies, securities, M&A, PE, VC, real estate, debt, and eventually banking remain part of one coherent economic reality.

As the player's empire grows, the amount of manual operation should not simply grow with it. The player's decision layer should rise:

```text
Founder
→ Operator
→ CEO
→ Conglomerate Owner
→ Capital Allocator
→ Financial Empire
```
