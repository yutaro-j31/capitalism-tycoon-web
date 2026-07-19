# Gameplay systems roadmap

UI expansion is paused. Development proceeds through small, testable gameplay-system phases while preserving `SAVE_KEY=capitalism_tycoon_web_v1`, save version 9 whenever possible, deterministic simulation, bounded histories, and existing accounting invariants.

## Phase 8A: Competition and markets

1. Reactive rivalry modes for price cuts, market-share surges, and capacity races. Completed.
2. Persistent market-share memory, target shares, multi-market priorities, and strategic investment planning. In progress.
3. Multi-business and multi-region competitor capital allocation.
4. Competitor product launches, R&D races, imitation, and counter-positioning.

## Phase 8B: Products, R&D, and operations

1. Product concept, development, launch, maturity, renewal, and discontinuation lifecycle.
2. Research programs with staff, budget, technical risk, patents, and spillovers.
3. Inventory policy, reorder points, safety stock, lead times, supplier reliability, and logistics capacity.
4. Procurement contracts, concentration risk, disruptions, substitutions, vertical integration, and working-capital impact.

## Phase 8C: Macro and finance

1. Expansion, overheating, slowdown, recession, and recovery cycle.
2. Industry-specific demand, cost, regulation, technology, and supply events.
3. Bank relationships, loan products, collateral, refinancing, maturity ladders, and credit ratings.
4. Financial covenants, waiver negotiations, cure periods, cross-defaults, and lender intervention.

## Phase 8D: Organization and governance

1. CXO responsibilities, skills, incentives, contracts, succession, and conflicts.
2. Department budgets, capacity, projects, coordination, and accountability.
3. Board composition, committees, resolutions, approval thresholds, and governance quality.
4. Founder control, executive dismissal, shareholder proposals, and activist pressure.

## Phase 8E: Capital allocation

1. VC fund strategy, rounds, dilution, follow-on decisions, exits, write-offs, and portfolio reserves.
2. M&A sourcing, valuation, due diligence, financing, negotiation, closing, and integration.
3. Subsidiary governance, transfer pricing, dividends, minority shareholders, restructuring, and spin-offs.
4. IPO preparation, pricing, lockups, disclosure, stock-market expectations, buybacks, dividends, and investor relations.

## Phase 8F: Expansion and long-term play

1. Property acquisition, development, leasing, financing, valuation, and disposal.
2. Overseas market entry, local partners, FX, tax, regulation, political risk, and repatriation.
3. Long-duration crises including fraud, recalls, cyber incidents, disasters, labor conflict, and succession failure.
4. Founder succession, professional management, family control, legacy objectives, multiple endings, and post-ending continuation.

## Delivery rule

Each unit includes focused tests, full regression checks, save compatibility, bounded state growth, finite-number validation, and a reviewable pull request. UI changes are excluded unless a gameplay system cannot be operated without a minimal interface addition.
