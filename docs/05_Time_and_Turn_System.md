# 05 Time and Turn System

## 1. Purpose

This document defines the authoritative rules for calendar progression, weekly simulation order, scheduled events, deterministic execution, and long-duration play in Capitalism Tycoon Web.

The time system is a core simulation boundary. Any change to turn order can alter accounting results, AI behavior, random outcomes, save compatibility, and regression-test expectations. Changes therefore require explicit documentation and deterministic tests.

## 2. Canonical Unit of Time

The canonical simulation unit is one week.

- One player advance action processes exactly one simulation week.
- All recurring operational calculations are normalized to weekly values unless the feature specification states otherwise.
- Monthly, quarterly, annual, and multi-year systems are derived from the canonical week counter.
- UI labels may display dates or periods, but must not create an independent clock.

The persistent source of truth is the absolute week index.

```ts
interface SimulationClock {
  absoluteWeek: number
  year: number
  weekOfYear: number
  quarter: 1 | 2 | 3 | 4
}
```

Derived calendar fields must be reconstructible from `absoluteWeek` and the project epoch.

## 3. Calendar Rules

The default calendar uses 52 weeks per year.

```text
year = floor(absoluteWeek / 52) + 1
weekOfYear = (absoluteWeek % 52) + 1
quarter = floor((weekOfYear - 1) / 13) + 1
```

The simulation does not model leap weeks unless a future save-version migration explicitly introduces them.

### 3.1 Boundary Events

- Quarter close: weeks 13, 26, 39, and 52.
- Year close: week 52.
- Age, tenure, contract, and long-term progression systems must reference the same clock.
- Scheduled content must define whether it triggers before operations, after operations, at quarter close, or at year close.

## 4. Weekly Advance Contract

The weekly advance operation is atomic from the player's perspective.

Either the entire week succeeds and is committed, or the previous stable state remains available for recovery. A partially processed week must never become a normal save.

Recommended high-level interface:

```ts
advanceWeek(state: GameState, command: AdvanceWeekCommand): AdvanceWeekResult
```

Inputs must include all player decisions required for the week. The simulation engine must not pause midway to request an unscheduled decision.

## 5. Canonical Processing Order

The authoritative weekly order is:

1. Validate state and pending player commands.
2. Capture pre-turn snapshot metadata.
3. Resolve scheduled start-of-week events.
4. Apply policy, economy, interest-rate, and market environment updates.
5. Resolve player-company operating decisions.
6. Resolve stores, products, staffing, supply, and demand.
7. Resolve competitor and non-player-company actions.
8. Resolve financing, debt service, investments, M&A, VC, and securities activity.
9. Post accounting journal entries.
10. Reconcile cash, profit, balance-sheet, and ownership invariants.
11. Resolve end-of-week random events.
12. Resolve quarter-end and year-end processes when applicable.
13. Update achievements, rankings, objectives, hall of fame, succession, and legacy systems.
14. Generate news, reports, alerts, and player-facing summaries.
15. Increment the canonical clock.
16. Validate final state and commit autosave.

A subsystem must not silently execute outside its assigned phase.

## 6. Phase Definitions

### 6.1 Validation Phase

Reject or normalize invalid inputs before economic mutation.

Examples:

- Negative price where prohibited.
- Hiring beyond hard roster constraints.
- Spending more than available liquidity without approved financing.
- Attempting to sell an unavailable asset.
- Duplicate command identifiers.

Validation errors must not consume random numbers or advance time.

### 6.2 Environment Phase

Updates exogenous values used by all participants.

Examples:

- Policy rate.
- Inflation.
- Consumer confidence.
- Regional demand.
- Commodity and ingredient costs.
- Equity-market risk appetite.

Environment values are calculated once per week and then treated as immutable inputs for that turn.

### 6.3 Operations Phase

Calculates company operating performance.

Examples:

- Capacity.
- Customer demand.
- Fulfilled sales.
- Revenue.
- Cost of goods sold.
- Payroll.
- Rent.
- Advertising effects.
- Maintenance.
- Quality and reputation changes.

### 6.4 Competitor Phase

Non-player entities act using information legally available to them at the beginning of their decision phase. They must not inspect the player's future random outcomes or post-turn results.

### 6.5 Financing and Investment Phase

Includes:

- Interest accrual and payment.
- Loan originations and repayments.
- Equity issuance and repurchase.
- Dividends.
- Personal-to-company capital contribution.
- Company-to-person salary and dividend transfers.
- Securities purchases and sales.
- VC investments and exits.
- M&A settlement.

### 6.6 Accounting Phase

Economic events are converted into journal entries and financial statements. The accounting engine must not invent economic activity; it records activity generated by prior phases.

### 6.7 Closing Phase

Quarter and year close may calculate taxes, annual awards, rankings, board reviews, age progression, contracts, retirements, succession, and historical records.

## 7. Determinism

Given the same:

- Initial save state.
- Save version.
- Random seed and random-stream state.
- Player command sequence.
- Game-data version.

The simulation must produce the same result.

### 7.1 Random Consumption Rules

- Randomness must come from the centralized seeded random service.
- No use of `Math.random()` or environment-dependent randomness in simulation code.
- Each subsystem should use named streams or stable draw ordering.
- Validation and rendering must never consume simulation randomness.
- Adding a cosmetic random draw must not perturb economic outcomes.

Recommended streams:

```text
economy
operations
competitors
events
market
people
presentation
```

The `presentation` stream must never affect persistent economic state.

## 8. Scheduled Events

Scheduled events must carry stable identifiers and explicit timing.

```ts
interface ScheduledEvent {
  id: string
  dueWeek: number
  phase: TurnPhase
  priority: number
  payload: unknown
}
```

Resolution order:

1. `dueWeek` ascending.
2. Phase order.
3. Priority ascending.
4. Stable identifier ascending.

This prevents platform-dependent ordering.

## 9. Quarterly Processing

Quarter close occurs after the normal weekly accounting phase of the quarter's final week.

Quarter-close responsibilities may include:

- Quarterly financial statements.
- Covenant testing.
- Investor-relations updates.
- Competitor ranking refresh.
- Board evaluation.
- Quarterly taxes or tax accrual adjustments.
- Milestone and objective checks.

Quarterly UI summaries must be derived from ledger and history data, not separately accumulated duplicate values.

## 10. Annual Processing

Annual close occurs after Q4 close.

Annual responsibilities may include:

- Annual financial statements.
- Corporate and personal tax settlement.
- Executive tenure and age progression.
- Employee contract renewal.
- Retirement and succession checks.
- Hall-of-fame and legacy records.
- Long-term ranking updates.
- Annual awards.
- Inflation-based balance tuning where explicitly defined.

Annual processing must be idempotent for a given close identifier.

## 11. Long-Duration Play

The engine must support at least 1,200 simulated weeks without material degradation or arithmetic instability.

Required protections:

- Bounded history or explicit archival strategy.
- No unbounded event-list growth.
- Stable identifier generation.
- Safe integer handling for monetary values.
- Prevention of `NaN`, `Infinity`, and negative-zero propagation.
- Deterministic succession and retirement behavior.
- Stable ranking computation with tie-breakers.

## 12. Autosave and Recovery

Recommended save points:

- Before weekly simulation: optional recovery checkpoint.
- After successful weekly simulation: canonical autosave.
- Before destructive migration: mandatory backup copy.

The canonical autosave must only be written after final validation succeeds.

## 13. Invariants

After every week:

- Clock advances by exactly one.
- No scheduled event with `dueWeek` in the past remains unresolved unless explicitly retryable.
- Cash reconciliation passes.
- Company and personal ledgers remain separate.
- No entity has duplicate stable IDs.
- All ownership percentages are within valid bounds.
- No finite numeric field becomes non-finite.
- Reports reference the completed week consistently.

## 14. Test Requirements

Minimum tests:

1. One-week deterministic replay.
2. Quarter boundary processing.
3. Year boundary processing.
4. Event-order tie breaking.
5. Validation failure does not advance time or RNG state.
6. Save and reload before advance produces identical outcome.
7. 1,200-week regression.
8. Long-run history and queue-size bounds.
9. Succession and retirement at boundary weeks.
10. Accounting reconciliation after every turn.

## 15. Change Control

A pull request that changes weekly order, calendar formulas, random consumption, or boundary timing must:

- Update this document.
- Add or update deterministic fixtures.
- Describe save compatibility.
- Provide before-and-after behavior.
- Include long-run regression evidence when applicable.
