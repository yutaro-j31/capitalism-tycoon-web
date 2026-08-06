# Gameplay systems roadmap

Development has returned to normal feature-delivery mode after the accounting, save-compatibility, module-wiring, and lifecycle-delegation audits were completed. New gameplay systems may now include the minimal UI required to operate them, while preserving `SAVE_KEY=capitalism_tycoon_web_v1`, save version 9 whenever possible, deterministic simulation, bounded histories, and existing accounting invariants.

Each roadmap item separates the playable minimum core from expansion candidates. The minimum core is completed and playtested before any candidate expansion is selected.

## Phase 8A: Competition and markets

### 8A.1 Reactive rivalry modes — Completed

- **Minimum core:** Competitors react to price cuts, market-share surges, and capacity races through real pricing, capacity, and market-share effects.
- **Expansion candidates (decide after playtesting):** Additional rivalry personalities, regional tactics, and more complex escalation patterns.

### 8A.2 Persistent competitor strategy — In progress

- **Minimum core:** Persistent market-share memory, a target share, market priority, and one strategic investment decision that changes competitor behavior.
- **Expansion candidates (decide after playtesting):** Multi-market optimization, strategy learning, and longer-horizon capital plans.

### 8A.3 Multi-business competitor capital allocation

- **Minimum core:** A competitor allocates a finite investment budget between two businesses and produces measurably different growth outcomes.
- **Expansion candidates (decide after playtesting):** Multi-region allocation, business disposal, and full portfolio optimization.

### 8A.4 Competitor product competition

- **Minimum core:** A competitor launches one product that changes demand or market share and permits one player counter-positioning action.
- **Expansion candidates (decide after playtesting):** R&D races, imitation, product families, and brand-positioning strategies.

## Phase 8B: Products, R&D, and operations

### 8B.1 Product lifecycle — Core implemented

- **Minimum core:** One product progresses through development, launch, maturity, and discontinuation with real demand and financial effects.
- **Expansion candidates (decide after playtesting):** Renewal, variants, portfolio cannibalization, and segment-specific launches.

### 8B.2 Research programs — Core state exists

- **Minimum core:** One staffed and funded R&D project carries technical risk and can create one patent-backed benefit.
- **Expansion candidates (decide after playtesting):** Research portfolios, spillovers, licensing, patent disputes, and technology trees.

### 8B.3 Inventory and logistics — Core systems exist

- **Minimum core:** Reorder point, safety stock, and supplier lead time alter stock availability, lost sales, and working capital.
- **Expansion candidates (decide after playtesting):** Warehouses, logistics-capacity planning, regional networks, and policy optimization.

### 8B.4 Procurement and supply resilience — Core systems exist

- **Minimum core:** One supplier contract creates a measurable cost-versus-reliability trade-off and one disruption can be mitigated by substitution.
- **Expansion candidates (decide after playtesting):** Concentration-risk dashboards, additional contract forms, wider vertical integration, and multi-tier suppliers.

## Phase 8C: Macro and finance

### 8C.1 Macro cycle — Completed

- **Minimum core:** Deterministic expansion, overheating, slowdown, recession, and recovery alter normal business outcomes.
- **Expansion candidates (decide after playtesting):** Monetary-policy shocks, fiscal-policy scenarios, and regional macro cycles.

### 8C.2 Industry-specific events — Completed core and response-plan expansion

- **Minimum core:** One deterministic industry event changes canonical demand or unit cost and offers one response whose effect reaches actual operating results.
- **Current implemented expansion:** Multiple deterministic event types and three one-per-event response plans connected to demand, cost, cash flow, accounting, and automatic expiry.
- **Expansion candidates (decide after playtesting):** New event families, overlapping events, and deeper regulatory-event chains.

### 8C.3 Bank relationships and refinancing — Core systems exist

- **Minimum core:** One bank loan has a maturity and credit assessment, and the player can refinance it with a measurably different cost.
- **Expansion candidates (decide after playtesting):** Multiple relationship banks, collateral packages, loan-product menus, and full maturity ladders.

### 8C.4 Financial covenants — Core systems exist

- **Minimum core:** One covenant is tested periodically, creates a cure period when breached, and produces a real financing consequence if uncured.
- **Expansion candidates (decide after playtesting):** Waiver negotiation, cross-default, lender intervention, and covenant packages.

## Phase 8D: Organization and governance

### 8D.1 Executive management — Core implemented

- **Minimum core:** Executives can be recruited, assigned responsibility, evaluated by skill, and produce real departmental or company effects.
- **Expansion candidates (decide after playtesting):** Incentive contracts, conflicts, richer succession, and executive labor-market dynamics.

### 8D.2 Department management — Core systems exist

- **Minimum core:** One department receives a budget and capacity limit, executes one project, and is accountable for a measurable result.
- **Expansion candidates (decide after playtesting):** Cross-department coordination, project portfolios, internal transfer rules, and richer accountability.

### 8D.3 Board governance — Completed core

- **Minimum core:** A material action is submitted as a board resolution, evaluated against an approval threshold, and accepted or rejected with real consequences.
- **Expansion candidates (decide after playtesting):** Committees, director factions, committee-specific authority, and deeper governance-quality modelling.

### 8D.4 Shareholder governance — Minimum core and current expansion completed

- **Minimum core — completed:** Shareholder proposals, activist pressure through the capital-stagnation path, deterministic proxy fights, and governed executive dismissal with board approval and severance accounting.
- **Current implemented expansion:** The shareholder-value-destruction and business-portfolio inefficiency paths are completed. All three paths share the global active-campaign guard and 26-week cooldown.
- **Expansion candidates (decide after playtesting):** Institutional-investor behavior, ESG demands, and any additional trigger paths justified by playtesting.

## Phase 8E: Capital allocation

### 8E.1 Venture investing

- **Minimum core:** The player invests in one venture round, receives dilution-adjusted ownership, and reaches one exit or write-off outcome.
- **Expansion candidates (decide after playtesting):** Fund strategy, follow-on reserves, portfolio construction, multiple rounds, and secondary sales.

### 8E.2 M&A — Completed core

- **Minimum core:** One acquisition proceeds through sourcing, valuation, due diligence, financing, closing, and integration with real accounting and operating effects.
- **Expansion candidates (decide after playtesting):** Hostile bids, joint ventures, auction processes, and more detailed PMI programs.

### 8E.3 Subsidiary governance — Completed core with substantial expansions

- **Minimum core:** A subsidiary is created or acquired, governed by a mandate, reports performance, and transfers value through a real dividend or capital-allocation action.
- **Current implemented expansion:** Listed-subsidiary operations, minority-shareholder actions, group capital allocation, restructuring, relisting, and internal ventures.
- **Expansion candidates (decide after playtesting):** Additional transfer-pricing disputes, cross-border group structures, and new spin-off formats.

### 8E.4 Public capital markets — Core systems exist

- **Minimum core:** IPO preparation and pricing lead to a listed company whose dividend or buyback decision affects cash, shares, and investor expectations.
- **Expansion candidates (decide after playtesting):** Lockup management, richer disclosure, analyst guidance, roadshows, and investor segmentation.

## Phase 8F: Expansion and long-term play

### 8F.1 Real estate — Completed core with substantial expansions

- **Minimum core:** One property can be acquired, leased, valued, financed, and disposed of with complete accounting effects.
- **Current implemented expansion:** Development, tenant operations, collections, insurance, reserves, taxes, refinancing, redevelopment, maintenance, and property management.
- **Expansion candidates (decide after playtesting):** REIT structures, portfolio-level asset allocation, and additional development formats.

### 8F.2 Overseas expansion — Core state exists

- **Minimum core:** Establish one overseas subsidiary whose local demand, FX translation, and repatriated cash change consolidated results.
- **Expansion candidates (decide after playtesting):** Local partners, tax structuring, political risk, regulation, and multi-country portfolios.

### 8F.3 Long-duration crises

- **Minimum core:** One recall crisis reduces sales and reputation, moves cash through `finance.event`, and offers one response action whose effect reaches the actual outcome.
- **Expansion candidates (decide after playtesting):** Accounting fraud, cyber incidents, disasters, labor conflict, and succession failure. Their necessity is assessed only after the recall core is implemented and played.

### 8F.4 Endgame — Core state exists but minimum-core completion remains to be verified

- **Minimum core:** Determine and display at least two endings from existing indicators such as company value and `legacyScore`, and record them in `endingRecords` and `unlockedEndings`.
- **Expansion candidates (decide after playtesting):** Post-ending continuation, generational succession, legacy objectives, family control, and professional-management routes.

## Delivery rule

Each unit includes focused tests, full regression checks, save compatibility, bounded state growth, finite-number validation, and a reviewable pull request. UI changes remain scoped to the minimum needed for the selected gameplay system and must preserve iPhone Safari usability.

Each roadmap item is implemented as a playable minimum core first. Expansion ideas discovered during implementation must be recorded as Issues rather than included in the same pull request. Additional systems are selected only after playtesting demonstrates that the minimum core is insufficient.
