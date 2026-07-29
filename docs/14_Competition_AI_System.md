# 14 Competition AI System

## 1. Purpose

This document defines the behavior of competitor companies. Competitor AI must create a believable market, pressure the player, pursue distinct strategies and remain bound by the same accounting, financing and operational rules as the player.

The AI is not permitted to cheat by creating cash, ignoring capacity, bypassing debt limits or reading hidden future random outcomes.

## 2. Design goals

1. Competitors must behave differently from one another.
2. Their actions must be explainable from available information.
3. Their decisions must remain deterministic for a given seed and game state.
4. AI companies must survive, grow, stagnate, restructure or fail through actual economics.
5. The player must be able to infer strategy from observable behavior.
6. AI processing must scale to long saves without blocking iPhone interaction.

## 3. Competitor profile

```ts
interface CompetitorProfile {
  id: string;
  strategyType:
    | "costLeader"
    | "premiumBrand"
    | "aggressiveExpansion"
    | "cashConservative"
    | "franchiseGrowth"
    | "innovationFocused"
    | "acquirer"
    | "regionalSpecialist";
  riskTolerance: number;
  growthPreference: number;
  leverageTolerance: number;
  pricingAggression: number;
  qualityPreference: number;
  liquidityBufferWeeks: number;
  planningHorizonWeeks: number;
  informationQuality: number;
  governanceQuality: number;
}
```

Profiles influence priorities but do not guarantee actions.

## 4. AI knowledge boundary

AI may use:

- current and historical public market data;
- its own internal records;
- local operating observations;
- published economic indicators;
- estimates allowed to the player;
- target-company information exposed by due diligence rules.

AI may not use:

- future RNG results;
- hidden player inputs before execution;
- private competitor data without an information source;
- exact future shock duration when only a range is public.

## 5. Decision cadence

To control performance, decisions are separated by cadence.

### Weekly

- price review alerts;
- inventory and staffing correction;
- liquidity emergency actions;
- immediate closure or borrowing triggers;
- response to active shocks.

### Monthly

- local marketing allocation;
- hiring plan;
- menu adjustment;
- supplier review;
- maintenance and minor investment.

### Quarterly

- branch opening or closure;
- debt and capital structure review;
- headquarters budget;
- strategic positioning;
- M&A and partnership screening.

### Annual

- long-term strategy revision;
- portfolio review;
- executive succession;
- dividend and reinvestment policy;
- region entry or exit.

## 6. Decision pipeline

Each major decision follows:

```text
observe
→ identify constraints
→ generate candidates
→ estimate outcomes
→ score candidates
→ apply governance checks
→ reserve required resources
→ execute
→ record rationale
```

A failed constraint check must stop execution before accounting entries are created.

## 7. Candidate scoring

```text
candidateScore
= expectedRiskAdjustedValue
+ strategicFit
+ survivalBenefit
+ optionValue
- liquidityCost
- executionRisk
- concentrationRisk
- governancePenalty
```

Weights come from the competitor profile and current company condition.

The AI must include a no-action candidate. This prevents forced overtrading or expansion.

## 8. Forecasting

AI uses bounded forecasts rather than perfect outcomes.

Forecast inputs include:

- trailing demand;
- local competition;
- price elasticity estimate;
- cost trends;
- economic phase;
- execution capacity;
- management quality.

Information quality controls forecast error. Error must be seeded and stable after save/load.

## 9. Pricing behavior

Competitors choose price based on:

- target margin;
- customer segment;
- observed demand response;
- competitor prices;
- capacity utilization;
- cost inflation;
- brand position;
- liquidity stress.

Prohibited behavior:

- changing price every week without thresholds;
- pricing below variable cost indefinitely without an explicit campaign or liquidation state;
- coordinating with competitors;
- reacting to player price changes before they become observable.

## 10. Expansion behavior

Before opening a branch, AI evaluates:

- expected unit economics;
- opening cost;
- working capital;
- management bandwidth;
- cannibalization;
- financing availability;
- downside liquidity;
- local saturation;
- strategic fit.

An opening is blocked when post-investment liquidity falls below the profile's required buffer unless the company is executing a documented high-risk strategy.

## 11. Closure and restructuring

AI considers closure when:

- store contribution is negative for a persistent period;
- recovery probability is low;
- lease exit cost is lower than expected continued losses;
- capital can earn more elsewhere;
- the company needs emergency liquidity.

Closure decisions must account for severance, impairment, lease penalties and inventory disposal.

## 12. Financing behavior

AI financing options include:

- retained earnings;
- bank debt;
- asset-backed debt;
- equity issuance;
- asset sale;
- dividend reduction;
- strategic investor;
- restructuring.

AI uses the same credit and dilution rules as the player. It may not issue shares without ownership consequences.

## 13. Cash management

Each company maintains:

- minimum operating cash;
- debt service reserve;
- planned investment reserve;
- emergency buffer.

Emergency priority:

1. stop discretionary spending;
2. reduce or suspend dividends;
3. defer investments;
4. negotiate working capital and debt;
5. sell non-core assets;
6. close loss-making operations;
7. issue equity if available;
8. restructure or enter bankruptcy.

## 14. Competitive interaction

Supported interactions:

- local price pressure;
- location competition;
- hiring competition;
- supplier capacity competition;
- advertising share of voice;
- product imitation with delay;
- acquisitions;
- market entry and exit.

Competitor actions affect shared systems. They must not directly modify player variables.

## 15. Product and innovation strategy

Innovation-focused AI allocates funds to product development and accepts delayed returns. Cost leaders prioritize process improvement, procurement and menu simplification. Premium brands protect quality and reputation even when input costs rise.

New products require development time, cost and failure risk. AI cannot instantly copy a successful player product.

## 16. M&A screening

AI screens targets using:

- strategic fit;
- valuation;
- synergies;
- financing capacity;
- integration capacity;
- ownership feasibility;
- downside case;
- regulatory or concentration rules.

The acquirer must record purchase consideration, acquired assets, liabilities and goodwill under the accounting specification.

## 17. Governance and executives

Low governance quality may produce:

- overexpansion;
- delayed closures;
- excessive leverage;
- weak succession;
- poor capital allocation.

However, governance failures must emerge from explicit parameters and decisions. They must not be arbitrary punishment events.

## 18. Bankruptcy

An AI company enters distress through the same triggers as a player company. Bankruptcy processing must preserve creditor hierarchy, ownership loss, asset sale and market-capacity effects.

A bankrupt competitor must not silently respawn with the same identity and balance sheet.

## 19. Difficulty scaling

Difficulty may alter:

- information quality;
- planning horizon;
- decision noise;
- governance quality distribution;
- aggressiveness of strong competitors.

Difficulty must not grant hidden cash, zero-cost financing, impossible margins or immunity from bankruptcy.

## 20. Performance architecture

- Use summarized state for companies outside the player's active region.
- Cache forecasts until relevant inputs change.
- Spread expensive quarterly planning across deterministic substeps.
- Avoid rendering-dependent logic.
- Keep AI state serializable.
- Support headless simulation for Playwright and regression tests.

## 21. Explainability log

Every material AI action records:

```ts
interface AIDecisionLog {
  companyId: string;
  week: number;
  decisionType: string;
  selectedCandidate: string;
  topReasons: string[];
  rejectedReasons: string[];
  expectedCashImpact: number;
  expectedRisk: number;
  profileVersion: number;
}
```

The full internal score need not be shown to the player, but it must be available for tests and debugging.

## 22. Required tests

1. Same seed and state produce identical AI decisions.
2. Save/load preserves pending plans and next decisions.
3. AI cannot spend more cash than available financing permits.
4. Branch openings create all required assets, costs and staffing needs.
5. Closures recognize all exit costs.
6. Equity issuance dilutes existing owners.
7. Debt service affects cash and statements correctly.
8. AI reacts only to observable player actions.
9. Distressed companies follow emergency priorities.
10. At least one no-action outcome is selected under weak opportunities.
11. Different strategy profiles produce measurably different long-run behavior.
12. A 1,200-week simulation completes without non-finite values or unbounded entity growth.

## 23. Balance metrics

Automated simulations must report by strategy type:

- survival rate;
- median revenue and enterprise value;
- branch count;
- leverage;
- return on invested capital;
- bankruptcy rate;
- market concentration;
- price and quality position;
- acquisition frequency;
- cash buffer.

No single profile should dominate every seed and every economic regime.

## 24. Implementation rule

Competitor logic must be versioned. Changes to scoring, constraints, information access or difficulty behavior require documentation updates and deterministic baseline review.