# Capitalism Tycoon — D UI v2 Design Contract

This document is the design-system source of truth for the next UI/UX pass of Capitalism Tycoon Web.

D UI v2 is an evolution of the production D UI. It does **not** replace the current shell, gameplay model, save schema, accounting rules, or deterministic simulation. The purpose of this contract is to make future reskin PRs converge on one coherent mobile-first finance/management interface instead of adding screen-specific styling independently.

## 1. Non-negotiable compatibility rules

UI work must preserve the project invariants documented elsewhere in the repository.

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- `saveVersion` remains `9` unless a separately reviewed migration requires a change.
- Old save compatibility must be preserved.
- Determinism must be preserved.
- Accounting integrity must be preserved.
- Company assets and personal assets must remain visibly and logically separate.
- UI work must not change balance formulas, RNG, progression, transaction timing, or ledger semantics unless the PR is explicitly a gameplay PR.
- iPhone Safari/WebKit is the primary interaction target.
- Desktop remains supported through responsive adaptation.
- Existing release, canonical, and WebKit gates must not be weakened to accommodate a visual change.

## 2. What Refero is used for

Refero is a **research input**, not a runtime dependency and not a design package imported into production.

Use Refero MCP or Refero's design library to study:

- information architecture,
- layout hierarchy,
- density,
- navigation patterns,
- charts and financial data presentation,
- tables and compact lists,
- cards and status surfaces,
- bottom sheets and modal flows,
- mobile onboarding,
- iOS interaction patterns,
- multi-step financial workflows.

Do not copy one product directly. Every implementation proposal should synthesize patterns from at least three materially different references where practical.

Never copy third-party logos, proprietary illustrations, branded assets, or product-identifying decorative work into the game.

Refero must never become required for the game to build, run, test, deploy, or load a save.

## 3. Product visual direction

The target is a premium capital-allocation and business-simulation interface rather than a generic SaaS dashboard.

The interface should feel:

- financially serious,
- strategic,
- dense but readable,
- modern and mobile-native,
- fast to scan during weekly turns,
- suitable for long-run play,
- clear about cause, effect, risk, and ownership of money.

The visual reference blend is intentionally multi-source:

- Linear-like density and crisp separation,
- wealth/fintech-style KPI hierarchy,
- restrained banking-style surfaces,
- purple/blue modern product accents,
- iOS-native navigation and modal behavior.

No named reference is a template to reproduce pixel-for-pixel.

## 4. Color hierarchy

D UI v2 keeps the existing deep navy foundation and introduces a clearer semantic hierarchy.

### Canvas and surfaces

- Canvas: deep navy to near-black.
- Primary surface: dark navy panel.
- Elevated surface: slightly lighter blue-navy.
- Border: low-contrast cool gray/blue.
- Overlay: translucent near-black with blur only where it improves hierarchy.

### Interaction and data accents

- Primary interaction: violet.
- Secondary interaction/data: blue.
- Analytical/data accent: cyan.
- Positive: green.
- Negative: red.
- Warning: amber.
- Prestige: gold.

Gold is no longer the default accent for ordinary interaction. It is reserved for high-status or scarce contexts such as company rank, exceptional milestones, premium strategic status, or prestige events.

### Target semantic token names

The following names are the target API for future CSS migration. A later runtime PR may map these to the existing `--d-*` variables before changing actual consumers.

```css
--d2-bg-canvas
--d2-bg-surface
--d2-bg-elevated
--d2-bg-overlay
--d2-border-subtle
--d2-border-strong

--d2-text-primary
--d2-text-secondary
--d2-text-muted
--d2-text-inverse

--d2-accent-primary
--d2-accent-secondary
--d2-data-cyan
--d2-success
--d2-danger
--d2-warning
--d2-prestige

--d2-shadow-card
--d2-shadow-overlay
```

The first runtime token PR should be visually neutral: aliases should initially resolve to existing production values where possible, and consumer migration should happen in later screen-specific PRs.

## 5. Spacing and radius contract

Use a small, repeatable spacing scale instead of one-off values.

```text
space-1 = 4px
space-2 = 8px
space-3 = 12px
space-4 = 16px
space-5 = 20px
space-6 = 24px
space-8 = 32px
```

Recommended radius scale:

```text
radius-sm = 8px
radius-md = 12px
radius-lg = 16px
radius-xl = 20px
radius-pill = 999px
```

Cards should normally use `radius-md` or `radius-lg`. Pills are reserved for compact status, filters, segmented controls, and badges.

## 6. Typography and number presentation

Use the platform/system sans-serif stack unless a separately reviewed typography change is made.

Financial numbers must be easy to compare vertically and horizontally.

- Use tabular numerals for KPI values, prices, balances, percentages, and table columns where supported.
- Keep labels visually secondary to values.
- Prefer short Japanese labels on iPhone.
- Avoid decorative typography for operational data.
- Do not reduce critical financial values below a comfortably readable mobile size to fit more columns.

Suggested hierarchy:

```text
Screen title: 22–28px / bold
Primary KPI: 20–28px / bold
Card title: 14–17px / semibold
Body/data row: 13–15px
Secondary metadata: 11–13px
Micro label: 10–11px only when non-critical
```

## 7. Mobile interaction contract

The primary target is iPhone portrait.

Every interactive control must satisfy the existing touch-target expectations. As a design rule, use **44px minimum interactive height/width** unless a larger surrounding hit area provides the same effective target.

Do not:

- hide information only to make a screenshot cleaner,
- hide scrollbars as a substitute for discoverability,
- make horizontal scrolling the default for core weekly decisions,
- place a destructive action beside a primary action without visual separation,
- require hover to reveal essential information,
- rely on desktop-only tooltips,
- clip values or controls under safe-area insets or the bottom dock.

Support:

- `env(safe-area-inset-*)`,
- coarse pointers,
- reduced motion,
- forced colors/high-contrast fallback,
- keyboard focus on desktop,
- dynamic mobile viewport behavior.

## 8. Navigation target

The approved target for iPhone is a five-destination bottom navigation:

1. ホーム
2. 財務
3. 企業
4. 市場
5. メニュー

This foundation document does **not** change the production navigation by itself. The navigation migration must be implemented as a separate PR with WebKit coverage.

`メニュー` is the gateway to lower-frequency systems such as:

- VC / PE / M&A,
- personal assets and real estate,
- governance,
- executives and HQ functions,
- reports,
- settings/save operations.

High-frequency weekly decisions must remain directly reachable without deep menu traversal.

## 9. Financial information hierarchy

Every finance-heavy screen should answer, in this order:

1. What is the current state?
2. What changed?
3. Why did it change?
4. What can the player do now?
5. What is the expected consequence and risk?

Preferred card structure:

```text
label
primary value
trend / delta
context or benchmark
optional action
```

Do not show a number without enough context to understand whether it is good, bad, unusual, or actionable when that context exists in game state.

Positive/negative color is supplementary. Never make color the only signal.

## 10. Money ownership contract

The UI must make ownership explicit whenever personal and corporate money can be confused.

Use explicit labels such as:

- 個人キャッシュ
- 会社キャッシュ
- 個人保有
- 会社保有
- 個人投資
- 会社投資

Transfers, acquisitions, PE conversion, dividends, salary, founder funding, and asset purchases must never visually imply that the two balances are interchangeable.

## 11. Core component vocabulary

Future screen work should converge on reusable patterns with stable semantics. Implementation may remain plain HTML/CSS/JS; these names describe responsibilities rather than requiring a framework.

### `KpiCard`

For a headline metric with label, value, trend, and optional context.

### `TrendValue`

For a value plus direction/magnitude without duplicating formatting logic.

### `StatusBadge`

For discrete status such as healthy, warning, loss-making, under renovation, DD, negotiating, or exit candidate.

### `FinancialChart`

For time-series data with a clear metric, period selector, current value, and accessible fallback text.

### `SegmentedTabs`

For switching one information mode inside a screen. Must retain a 44px effective target on iPhone.

### `ManagementAction`

For an action with cost, expected effect, risk, eligibility, and disabled-state explanation.

### `EventCard`

For weekly developments that explain impact and route to the relevant decision.

### `StoreRow`

For compact store comparison: name/location, sales, profitability, utilization/condition, and status.

### `PortfolioRow`

For assets/investments: current value, basis, return, stage/status, and next action.

### `DealPipeline`

For M&A/PE/VC lifecycle progress with explicit current stage and blockers.

### `BottomNavigation`

For the five high-level mobile destinations only.

## 12. Screen-specific priorities

### Home / CEO dashboard

The home screen is a weekly decision cockpit, not a report archive.

Prioritize:

- company cash and liquidity,
- personal cash only when relevant,
- revenue/profit/current trend,
- company value or strategic score,
- critical risks,
- major weekly events,
- secretary/recommended actions,
- one clear advance-week control.

### Finance

Prioritize:

- revenue,
- operating profit,
- net profit,
- free cash flow,
- cash/debt,
- trend chart,
- P&L / balance sheet / cash-flow switching,
- material variance explanations.

### Company / stores

Prioritize comparison and actionability:

- store performance,
- pricing/menu state,
- staffing,
- equipment/condition,
- operating hours,
- advertising,
- expansion/closure signals.

### Market

Prioritize:

- index context,
- selected security trend,
- valuation/market cap,
- player holdings,
- unrealized result,
- buy/sell action,
- material market news.

### VC / PE / M&A

Prioritize lifecycle state and capital-at-risk:

- stage,
- valuation,
- ownership,
- invested capital,
- expected return,
- downside/risk,
- initiative or DD status,
- next executable action,
- exit options.

## 13. Real game data only

Production UI must bind to existing game state, engines, or derived presentation models.

Do not ship mock KPI values, fabricated trends, decorative charts disconnected from state, or hard-coded strategic recommendations merely to reproduce a concept image.

Generated mockups are visual targets only.

## 14. Screen migration discipline

D UI v2 should be rolled out one screen or one shared primitive at a time.

Recommended order:

1. semantic token aliases and shared primitives,
2. iPhone five-tab bottom navigation,
3. Home / CEO dashboard,
4. Finance,
5. Company / store management,
6. Stock market,
7. VC / PE / M&A,
8. personal assets / real estate,
9. governance / executives / HQ,
10. events, tutorial, settings, and secondary flows.

Each runtime visual PR should:

- identify the affected screen(s),
- keep gameplay logic changes out of scope,
- add or update static UI contracts where appropriate,
- preserve 44px targets,
- run canonical CI,
- run or obtain formal iPhone WebKit evidence before considering the migration complete.

## 15. Refero research evidence expectations

Before a substantial screen redesign, capture a short research note that records:

- the problem being solved,
- at least three source products/systems or materially different patterns when available,
- the specific pattern borrowed conceptually,
- what will **not** be copied,
- how the pattern maps to Capitalism Tycoon state and actions,
- iPhone implications,
- accessibility implications.

Do not add screenshots or third-party assets to the repository unless their licensing and need are clear.

## 16. D UI v2 definition of done

A migrated screen is done only when:

- it uses the shared visual hierarchy rather than one-off styling,
- primary actions are obvious on iPhone,
- all essential information remains discoverable,
- financial ownership is unambiguous,
- real state drives displayed values,
- no gameplay invariants changed unintentionally,
- desktop remains usable,
- canonical CI is green,
- formal iPhone WebKit coverage is green for the relevant flow.

This contract intentionally favors consistency and regression safety over a one-shot global reskin.