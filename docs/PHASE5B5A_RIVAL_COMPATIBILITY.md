# Phase 5B-5A: rival-counterattack compatibility

## Scope

This increment separates the legacy rival-counterattack system from the saved competitor AI introduced in Phase 5. Both systems previously used `competitorStates` for incompatible data models:

- competitor AI stores companies, market presences, projects, credit, and lifecycle state;
- the legacy rival screen expects pressure, aggression, strength, brand power, and acquisition flags.

Using the same array allowed the rival tab and weekly counterattack process to read missing fields, and legacy acquisition removed AI companies that were still referenced by histories, actions, and projects.

The save key remains `capitalism_tycoon_web_v1`, and the save version remains 9.

## Separate counter state

`competitorStates` remains the authoritative AI company collection. A new additive collection, `competitorCounterStates`, stores only the lightweight rival-counterattack state:

- linked `competitorID`;
- industry and region;
- displayed strength and brand power;
- aggression and price pressure;
- distress, active, and acquired flags;
- last counterattack week;
- a shadow cash value used only by the legacy counterattack simulation.

Counter rows are rebuilt deterministically from AI company IDs and preserved counter values. Orphan legacy rows are discarded rather than inserted into the AI collection. The collection is capped at 20 rows.

## Existing rival screen compatibility

The current rival screen still reads `competitorStates`. To prevent a breaking UI rewrite in this safety-focused increment, each AI company receives synchronized display aliases:

- `id`;
- `industryID` and `regionID`;
- `strength`;
- `aggression`;
- `brandPower`;
- `pricePressure`;
- `isDistressed`;
- `lastActionWeek`.

All values used by `.toFixed()` and percentage formatting are finite and range-limited. The authoritative company identity, lifecycle, cash, debt, projects, presences, and histories remain unchanged.

A richer competitor dashboard will replace these aliases in a later UI increment.

## Weekly counterattacks

The legacy parity layer is executed with a temporary counter-state view. The compatibility layer:

1. preserves the AI company array;
2. supplies `competitorCounterStates` only while the old counterattack function runs;
3. captures the updated counter values;
4. restores the AI company array in a `finally` block;
5. synchronizes display aliases.

This prevents random counterattack logic from mutating or replacing AI lifecycle records. Existing store price-pressure effects remain active.

## Player responses

Advertising and quality responses use deterministic operation IDs and a bounded `rivalResponseHistory`. The same response to the same competitor cannot be charged twice in one week.

The actions retain their existing prices:

- advertising defence: ¥2,000,000;
- quality defence: ¥2,500,000.

Cash and financial events use the same operation ID. Response history is capped at 80 rows.

## Competitor acquisition

A distressed competitor can still be acquired from the rival screen, but the AI company is no longer removed from `competitorStates`. Instead:

- the company becomes inactive and records the acquisition week;
- all market presences stop supplying capacity;
- pending actions are skipped;
- unfinished projects fail without additional spending;
- an active turnaround plan is cancelled;
- a linked subsidiary record is created;
- the counter row becomes inactive and loses price pressure.

Keeping the inactive AI row preserves every existing action, project, presence, and history reference.

## Event compatibility

Structured competitor lifecycle events are converted to strings before being copied to the legacy `competitorEventLog`. The UI therefore cannot render `[object Object]`, and no shared object references are introduced.

## Migration and normalization

Old version-9 saves receive additive defaults through engine normalization. Legacy counter-only rows accidentally stored in `competitorStates` are separated from AI rows. Unknown properties on valid AI companies remain preserved.

`competitor.validate()` remains read-only. It validates counter references, bounds, numeric ranges, response operation IDs, and history retention without running normalization.

## Release gates

- the rival tab cannot call numeric formatting on undefined values;
- AI competitor IDs and row count survive rival rendering and weekly parity processing;
- the AI array is restored even if legacy parity processing throws;
- response costs are same-week idempotent;
- acquisition preserves all AI references and closes pending operations safely;
- structured events remain displayable strings;
- counter and response collections remain bounded and finite;
- validation remains read-only;
- save version 9 and all existing save, accounting, market, supply, workforce, competitor, RNG, weekly, and long-run tests remain green.
