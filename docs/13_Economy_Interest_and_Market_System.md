# 13 Economy, Interest and Market System

## 1. Purpose

This document defines the macroeconomic simulation used by Capitalism Tycoon Web. The system must create meaningful changes in demand, financing conditions, input costs, hiring, valuation and bankruptcy risk without producing arbitrary or non-reproducible outcomes.

The economy is a shared environment. Player companies and AI companies must be affected by the same state variables and the same published rules.

## 2. Design principles

1. Macroeconomic variables change gradually unless a defined shock occurs.
2. The same seed and the same player actions must produce the same economic path.
3. Economic effects must flow through explicit channels rather than hidden multipliers.
4. Nominal values and real operating performance must not be confused.
5. Interest rates must affect debt service, valuation and investment decisions.
6. Inflation must affect both selling prices and costs, but not necessarily at the same speed.
7. Recessions must be survivable through prudent management.
8. Expansions must not guarantee permanent growth.

## 3. Core state

```ts
interface EconomyState {
  week: number;
  cyclePhase: "recovery" | "expansion" | "slowdown" | "recession";
  realGrowthIndex: number;
  consumerConfidence: number;
  inflationRateAnnual: number;
  policyRateAnnual: number;
  baseLendingRateAnnual: number;
  wageGrowthAnnual: number;
  unemploymentIndex: number;
  commercialRentIndex: number;
  foodInputCostIndex: number;
  energyCostIndex: number;
  equityRiskPremium: number;
  creditAvailability: number;
  volatilityIndex: number;
  activeShocks: EconomyShock[];
}
```

All rates are stored as decimal annual rates. Display formatting may convert them to percentages.

## 4. Update cadence

- Weekly: confidence, volatility, active shock decay and small index changes.
- Monthly boundary: inflation, wages, unemployment and rent adjustments.
- Quarterly boundary: cycle phase evaluation, policy review and credit condition review.
- Annual boundary: structural trend review and long-run normalization.

A weekly turn must not independently redraw every macro variable. Variables update from their previous values.

## 5. Economic cycle

The economy follows a persistent state machine.

### Recovery

- demand growth improves from a weak base;
- unemployment remains elevated but begins to fall;
- policy rates are usually low;
- credit gradually reopens;
- valuations recover before operating results fully recover.

### Expansion

- consumer demand and employment are strong;
- wages, rent and input costs rise;
- lenders are more willing to finance growth;
- late expansion may create inflation pressure and excessive valuation.

### Slowdown

- demand growth weakens;
- financing standards tighten;
- inventory and capacity mistakes become more visible;
- price-sensitive customers increase.

### Recession

- discretionary demand falls;
- bankruptcies and layoffs increase;
- credit becomes selective;
- policy easing may occur with a lag;
- strong companies may acquire assets at discounts.

Phase transitions require threshold persistence. A one-week fluctuation must not change the phase.

## 6. Deterministic update model

Each macro variable is updated using:

```text
newValue = clamp(
  previousValue
  + meanReversion
  + cyclePressure
  + policyEffect
  + shockEffect
  + seededNoise,
  minimum,
  maximum
)
```

Seeded noise must come from the central simulation RNG. No macroeconomic system may call unseeded random APIs.

## 7. Consumer demand transmission

Store-level base demand is modified through visible factors:

```text
effectiveDemand
= localBaseDemand
× incomeFactor
× confidenceFactor
× unemploymentFactor
× priceSensitivityFactor
× categoryCycleFactor
× temporaryShockFactor
```

The macroeconomic system must never directly overwrite store sales. It supplies factors to the demand system.

## 8. Inflation and pass-through

Inflation affects cost categories at different speeds.

- food inputs: relatively fast pass-through;
- energy: fast and volatile;
- wages: slower and persistent;
- rent: slow, usually at renewal or indexed review;
- menu prices: chosen by the company, not automatically imposed.

A company that fails to reprice during inflation suffers margin compression. A company that reprices too aggressively may lose demand.

## 9. Interest rates

### Policy rate

The policy rate is the economy-wide reference rate.

### Base lending rate

```text
baseLendingRate
= policyRate
+ bankingSystemSpread
+ liquidityPremium
```

### Company borrowing rate

```text
companyBorrowingRate
= baseLendingRate
+ leverageSpread
+ coverageSpread
+ sizeSpread
+ distressSpread
- relationshipDiscount
```

The borrowing rate used for a loan is fixed or floating according to the contract. Existing fixed-rate debt must not be repriced when the policy rate changes.

## 10. Credit availability

Credit availability is separate from interest rate level. During stress, companies may face both higher rates and lower borrowing capacity.

Lending decisions consider:

- debt-to-equity;
- net debt to EBITDA;
- interest coverage;
- recent operating cash flow;
- collateral;
- company age and scale;
- default history;
- economic phase;
- lender concentration.

A loan refusal must include an explanation code.

## 11. Debt service and accounting

Interest expense is accrued from principal, contractual rate and elapsed time. Principal repayment is a financing cash flow and must not be recorded as an operating expense.

Floating-rate debt must specify:

- reference rate;
- spread;
- reset interval;
- next reset week;
- floor and cap, if any.

## 12. Valuation transmission

Discount rates for public shares, private investments, real estate and M&A must respond to macro conditions.

```text
requiredReturn
= riskFreeReference
+ equityRiskPremium
+ companyRiskPremium
```

Higher required returns reduce valuation multiples unless offset by stronger expected cash flow.

## 13. Labor market

The labor market influences:

- applicant quantity;
- salary expectations;
- turnover;
- hiring time;
- executive recruitment cost;
- training retention value.

Low unemployment increases wage pressure and reduces candidate availability. Recession increases candidate supply but may reduce morale and consumer demand.

## 14. Commercial property market

Commercial rents depend on:

- local demand;
- vacancy;
- economic cycle;
- inflation;
- district quality;
- lease term;
- negotiated incentives.

Existing leases change only according to contract rules. Market rent changes must not instantly alter every current lease.

## 15. Supply shocks

Supported shock categories include:

- food commodity spike;
- energy shortage;
- logistics disruption;
- labor shortage;
- demand boom;
- financial panic;
- public health restriction;
- regional disaster;
- technology or productivity improvement.

Each shock defines:

```ts
interface EconomyShock {
  id: string;
  type: string;
  startWeek: number;
  durationWeeks: number;
  severity: number;
  affectedRegions: string[];
  affectedCostCategories: string[];
  affectedDemandCategories: string[];
  decayProfile: "linear" | "exponential" | "step";
}
```

## 16. Player information

The player receives information with varying delay and precision.

- current policy rate: exact;
- current loan quote: exact;
- inflation estimate: current published value;
- future cycle direction: uncertain forecast;
- shock duration: range unless contractually known.

The game must distinguish observed facts from forecasts.

## 17. Difficulty and balance

Difficulty may change volatility, shock frequency, lender tolerance and forecast precision. It must not secretly change accounting equations or give AI companies impossible financing.

## 18. Failure prevention

The following are prohibited:

- negative interest expense caused by sign errors;
- instant lease repricing without a contractual event;
- macro variables jumping between bounds without a shock;
- AI companies receiving rates unavailable to equivalent player companies;
- recession multipliers being applied twice through multiple systems;
- random economic paths changing after save/load.

## 19. Required tests

1. Same seed and actions produce the same 1,200-week macro path.
2. Save/load preserves the next macro update exactly.
3. Fixed-rate debt remains fixed after policy changes.
4. Floating-rate debt resets only on scheduled weeks.
5. Interest accrual reconciles to cash and liabilities.
6. Recession reduces demand through documented channels only once.
7. Rent changes respect lease timing.
8. Shock expiration removes its effects without permanent drift.
9. AI and player loan pricing use the same risk functions.
10. Extreme rates and inflation remain within configured bounds.

## 20. Implementation rule

All balancing constants must live in a versioned configuration module. Pull requests that change economic behavior must update this document, fixtures and deterministic regression snapshots.