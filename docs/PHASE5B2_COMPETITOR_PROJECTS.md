# Phase 5B-2: competitor project lifecycle foundation

## Scope

This increment introduces a saved, deterministic project lifecycle for ramen competitor investments without changing the save key or save version. It is intentionally a compatibility-first foundation before market-entry projects, credit limits, and the full turnaround state machine.

## Project model

`competitorProjects[]` stores one project per project-backed competitor action. The project types in this slice are:

- brand investment;
- quality investment;
- capacity expansion;
- market exit;
- turnaround.

Each project records its competitor and market presence, creation/start/completion weeks, committed and spent cost, target value, operation ID, linked action ID, status, and failure reason.

Supported statuses are `planned`, `inProgress`, `completed`, `cancelled`, and `failed`.

## Timing and accounting

The existing Phase 5A action lead times remain unchanged. The project starts when the decision is made and completes on the action's existing `effectiveWeek`. No player-visible balance formula is changed in this PR.

Project cost is deducted once, at completion. If the competitor lacks the required cash at completion, the project becomes `failed`, the linked action becomes `skipped`, and no effect is applied. Reprocessing the same week cannot deduct cost or apply an effect twice.

## Version 8 compatibility

The engine save version remains 8. `competitor.ensure()` adds missing project fields and backfills projects from existing saved project-backed actions. Backfill is keyed by `operationID`, so repeated normalization and save/load cycles cannot create duplicates.

An explicit version 9 migration remains reserved for the later PR that adds market-entry projects, borrowing limits, repayment, credit scoring, and turnaround-plan data.

## Retention and validation

The project list is capped at 160 records while preserving non-terminal projects first and retaining the newest terminal projects. Validation checks project IDs, operation IDs, references, statuses, dates, finite costs, completion records, and one-time spending invariants.

## Release gates

- investment effects occur only when their project completes;
- cost is deducted exactly once;
- same-week processing is idempotent;
- old pending actions are backfilled exactly once;
- project records remain bounded and finite;
- `competitor.validate()` remains read-only;
- no runtime random-number calls are added.
