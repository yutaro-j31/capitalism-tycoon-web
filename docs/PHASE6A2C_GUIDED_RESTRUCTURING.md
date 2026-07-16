# Phase 6A-2C: guided crisis asset disposition

## Scope

This increment adds a deterministic restructuring API for a player company in `watch`, `distressed`, `turnaround`, or `recovered` status. It does not sell assets automatically and does not change crisis thresholds, insolvency grace periods, borrowing formulas, valuation formulas, or accounting formulas.

The API exposes three existing disposal routes:

- store closure through `closeStore(id)`;
- company-owned property sale through `sellProperty(id)`;
- product venture sale through `sellProduct(id)`.

The restructuring layer never duplicates those accounting implementations. It ranks candidates, enforces crisis eligibility, invokes the existing production method, re-evaluates liquidity status, and records a bounded restructuring history.

## Candidate model

`crisisRestructuringOptions()` returns separate store, property, and product lists plus up to five recommended candidates.

Expected cash is informational and uses the same formulas as the existing execution routes:

- store: 15% of the business store cost;
- property: 97% of the current property value;
- product: the larger of current valuation or annualized profit multiplied by eight.

Candidates are ordered deterministically. Loss-making stores and products are prioritized before profitable operations. Company-owned properties are treated as immediately liquid non-operating candidates. Ties are resolved by expected cash, type, and stable identifier; runtime randomness is not used.

## Execution contract

`executeCrisisDisposition(type, id)` is available only when the company is not sold, not insolvent, and not already in game-over state. Unknown or already-disposed targets are rejected.

After a successful existing disposal API call, the restructuring layer records:

- stable action and operation identifiers;
- week and disposition type;
- target identifier and display name;
- expected cash;
- company cash before and after execution;
- realized cash;
- crisis status transition.

History is capped at 52 entries and normalized during save and load. The crisis lifecycle is re-evaluated from the post-disposition cash position, and finance validation remains mandatory.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`;
- save version remains 9;
- no migration removes or rewrites existing player data;
- no market, supply, workforce, competitor, progression, IPO, M&A, or valuation formula changes;
- no new randomness;
- strict classic-script order is retained;
- the focused restructuring test and all existing regression suites remain release gates.

## Deferred work

This increment provides the production API and deterministic model only. A later UI increment may expose recommended candidates in the mobile crisis panel with explicit confirmation. Automatic liquidation, creditor negotiations, debt haircuts, mass layoffs, and court-style restructuring remain out of scope.
