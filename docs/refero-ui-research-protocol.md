# Refero UI Research Protocol

This document defines how ChatGPT, Codex, Claude Code, or another MCP-capable development agent should use Refero when researching UI/UX for Capitalism Tycoon Web.

The production source of truth is `DESIGN.md`. Refero is used to find patterns and evidence; it does not override project invariants or existing gameplay behavior.

## Purpose

Use Refero research to improve the quality of screen redesigns without turning the game into a copy of a single finance, banking, SaaS, or trading product.

The intended loop is:

```text
Research -> compare patterns -> document synthesis -> implement one scope -> test -> WebKit evidence
```

Do not use this loop as:

```text
find one attractive screen -> reproduce it -> retrofit game data later
```

## Tooling

Refero exposes an MCP endpoint at:

```text
https://api.refero.design/mcp
```

When using Codex or another MCP client, configure Refero as a remote HTTP MCP server according to the current client documentation and complete Refero authentication if requested.

Refero access is optional for repository CI and production. Never add a build step, runtime script, secret, or deployment dependency that requires Refero.

## Research scope per screen

For a substantial redesign, research at least three materially different sources or design approaches when suitable results exist.

A good research set mixes different strengths, for example:

- dense analytics / productivity UI,
- consumer or wealth fintech,
- banking / cash management,
- trading / portfolio management,
- iOS-native navigation or onboarding.

The goal is pattern triangulation, not brand imitation.

## Standard queries

Use semantic searches that describe the UX problem rather than only naming brands.

### Home / CEO dashboard

```text
mobile executive dashboard financial KPI cards weekly performance
business dashboard cash profit risk recommended actions
mobile fintech dashboard portfolio overview events
```

### Finance

```text
mobile financial statements profit loss cash flow dashboard
finance KPI revenue operating profit free cash flow mobile
banking cash debt liquidity dashboard
```

### Company / store management

```text
multi location business dashboard store performance mobile
operations dashboard location list utilization margin status
retail management pricing staffing equipment mobile
```

### Stock market

```text
mobile stock detail portfolio holdings buy sell chart
trading app watchlist market overview valuation metrics
investment portfolio performance mobile
```

### VC / PE / M&A

```text
private equity deal pipeline dashboard mobile
venture portfolio investment stage valuation ownership
M&A deal room due diligence pipeline financial dashboard
```

### Personal assets / real estate

```text
wealth management net worth allocation mobile
real estate portfolio property performance dashboard
personal investment portfolio assets liabilities mobile
```

### Events and decisions

```text
mobile decision modal risk reward confirmation
financial alert bottom sheet recommended action
workflow approval mobile review confirm
```

## What to extract from a reference

Do not record only that a screen "looks good". Capture specific design decisions.

For each useful reference, record:

1. **Information hierarchy** — what is visible before scrolling.
2. **Primary action** — what the product wants the user to do next.
3. **Metric density** — how many values are presented and how they are grouped.
4. **Comparison method** — trend, benchmark, delta, ranking, status, or chart.
5. **Navigation model** — tabs, bottom navigation, sidebar, sheet, or drill-down.
6. **Mobile adaptation** — what disappears, stacks, scrolls, or changes interaction model.
7. **Feedback** — confirmation, loading, disabled state, warning, success, error.
8. **Accessibility** — target size, contrast, focus, non-color signaling.

## Required synthesis note

Before implementation, produce a short note using this structure:

```markdown
# <Screen> Refero synthesis

## Problem
What is hard to understand or operate in the current game?

## References
- Reference A: useful pattern and why
- Reference B: useful pattern and why
- Reference C: useful pattern and why

## Synthesis
Which patterns are combined and how are they changed for Capitalism Tycoon?

## Game-state mapping
Which existing real game values and actions power each UI area?

## iPhone behavior
What is visible first, what scrolls, and what remains reachable with one thumb?

## Explicit non-goals
What is not being copied or changed?

## Verification
Which static contracts and WebKit flows prove the change?
```

This note can live in the PR body for a small screen migration. Create a permanent document only when the reasoning is useful across multiple future PRs.

## Capitalism Tycoon-specific evaluation questions

Every reference must be filtered through the simulation rather than applied mechanically.

Ask:

- Can the player understand the current financial state within a few seconds?
- Can the player tell personal money from company money?
- Can the player see what changed since the previous week?
- Can the player identify the highest-impact decision?
- Does the screen communicate expected upside and downside?
- Are important actions available without opening several layers of menus?
- Does the design still work with long Japanese labels and large yen values?
- Does it remain usable on iPhone portrait?
- Does it preserve all information required for long-run management?

## Reference mixing guidance

The current D UI v2 direction intentionally combines rather than copies:

- high-density, thin-separator productivity patterns,
- wealth/fintech KPI hierarchy,
- restrained banking-style visual weight,
- violet/blue interaction accents,
- iOS-oriented bottom navigation and sheets.

A reference should influence one or more patterns, not determine the entire product identity.

## Mockups

Generated concept images are allowed as visual targets, but they are not implementation specifications by themselves.

Before implementing a mockup:

- map every visible KPI to real state or remove it,
- map every action to an existing or separately approved action,
- remove fabricated charts or values,
- preserve current accounting ownership,
- preserve deterministic behavior,
- adapt rather than copy any third-party visual identity.

## Implementation sequencing

After research, migrate in narrow PRs.

Recommended sequence:

1. shared semantic tokens and primitives,
2. five-tab iPhone bottom navigation,
3. Home / CEO dashboard,
4. Finance,
5. Company / stores,
6. Market,
7. VC / PE / M&A,
8. personal assets / real estate,
9. governance / executives,
10. secondary flows.

Do not combine a large visual reskin with gameplay balance changes.

## Verification requirements

For runtime UI changes:

- run the focused static/UI test for the changed screen,
- keep the test registered in the canonical suite when a new test is added,
- run the PR canonical gates,
- do not weaken assertions because a visual implementation differs,
- obtain formal iPhone WebKit evidence for affected mobile flows before declaring the migration complete.

The 44px effective touch-target contract is mandatory for interactive iPhone controls.

## Copyright and brand safety

Use references for ideas such as hierarchy, grouping, interaction, and density.

Do not copy:

- logos,
- trademarks as decorative identity,
- proprietary illustrations,
- photographs or screenshots into production,
- distinctive branded assets,
- long blocks of third-party copy.

Capitalism Tycoon must retain its own visual identity and terminology.

## Definition of a successful Refero research pass

A research pass is successful when it makes an implementation decision clearer.

It should result in concrete statements such as:

- "KPI deltas belong directly under the value rather than in a separate summary card."
- "On iPhone, the selected store stays in a compact header while actions appear below it."
- "M&A stage is represented as a pipeline and risk is shown next to expected return."
- "The bottom navigation is limited to five high-frequency destinations."

A long list of attractive screens without a synthesis decision is not sufficient.