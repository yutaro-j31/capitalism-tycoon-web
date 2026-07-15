# Phase 5B-5B-1: competitor dashboard view model

## Purpose

This increment introduces a read-only view model for the competitor screen. The UI currently reads raw competitor, market, project, credit, lifecycle, and legacy counterattack fields directly. That makes rendering fragile and forces presentation code to understand every save schema.

The dashboard model creates one finite, deterministic row per competitor. A later UI increment can render those rows without mutating or reinterpreting saved simulation data.

The persistent save key remains `capitalism_tycoon_web_v1`, and the save version remains 9.

## Company summary

Each row contains:

- stable competitor identity and business ID;
- strategy ID and localized strategy name;
- lifecycle status, label, severity, and current reason;
- active and acquired flags;
- weekly revenue, profit, margin, cash, debt, and operating-cost components;
- credit score, credit status, credit limit, leverage, liquidity, missed payments, and next repayment week;
- market, project, action, turnaround, history, and legacy counterattack summaries;
- a deterministic risk score used for default ordering.

## Market summary

Each market presence is normalized into a finite view containing:

- presence, business, prefecture, and area IDs;
- active, opening, planned, inactive, and exited state;
- opening and exit weeks;
- price, stores, capacity, fulfilled units, utilization, and lost demand;
- realized revenue, contribution margin, share, and customer satisfaction.

Company-level totals aggregate only active markets for stores, capacity, fulfilled units, average share, and lost demand. Planned or opening markets are counted separately.

## Credit and lifecycle risk

The view model does not change competitor decisions. It reports the already-saved credit and lifecycle state and calculates a presentation-only risk score from:

- lifecycle severity;
- distress score;
- negative weekly profitability;
- leverage above the ordinary range;
- short cash runway;
- legacy price pressure;
- absence of an active market.

Risk ordering is deterministic. Ties use market share, company name, and competitor ID, so reversing saved array order does not change the dashboard.

## Projects and actions

Pending competitor projects and unapplied actions are counted without changing their status. The view exposes project and action type lists, together with turnaround-plan status and target week.

Terminal projects and completed, cancelled, failed, skipped, or applied actions are excluded from pending totals.

## History windows

The view model produces four-week and thirteen-week summaries from lifecycle history, or from the company performance history when lifecycle rows are absent.

Each window reports:

- covered weeks;
- revenue and profit totals;
- profit margin;
- average cash runway, leverage, and market share;
- ending cash and debt;
- change in weekly profit.

History rows are copied and sorted before calculation. Source arrays are never reordered.

## Purity and compatibility

`buildDashboard(state, options)` and `buildDetail(state, competitorID)` are read-only operations.

The model:

- does not call random-number functions;
- does not write defaults into the save;
- sanitizes missing and non-finite numeric values;
- freezes returned rows and nested summaries;
- supports business and lifecycle-status filters;
- preserves old version-9 saves because no persistent fields are added;
- remains independent from DOM rendering.

## Release gates

- initial, distressed, turnaround, recovered, acquired, inactive, and bankrupt competitors produce finite rows;
- active and planned market presences are classified separately;
- pending projects and actions are counted correctly;
- four-week and thirteen-week summaries are deterministic;
- array order does not affect dashboard order;
- corrupted numeric inputs cannot produce `NaN` or infinity in the view;
- generation does not mutate the save;
- module order, save, market, finance, supply, workforce, competitor, RNG, and long-run tests remain green.
