# Economic Engine vNext — SPIKE-3.6 read-only legacy weekly finance crosswalk

**Owner:** regular ChatGPT alone (Owner tracker [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038)); mainline Work and Claude Code continue Phase 3/4 without interference.  
**Base:** draft PR #1048, stacked on #1047 → #1042 → #1041 → #1039.  
**Legacy code inspected:** production `main` `c241423d713471b212fe7f9c6806b3c4d5639378` (2026-10-20 JST).  
**Status:** isolated, read-only experimental validation. **Does not execute the real game or establish parity.**

## A decisive distinction

The initial 13-week [synthetic fixture](fixtures/13-week-retail.json) is **cash-basis**: every materials expense pays the supplier in the same week, and rent/maintenance are zero. This is a useful *financial identity test*, but not representative of all real **ramen** shops.

Production `js/engine.js` `advanceWeek` (around lines 2310–2395) routes target stores through `supply.applyConstraint`, stores cost of sales separately from procurement, charges rent, wages, maintenance and runs additional company-wide economic events; the quarter-end calculation includes tax when the company is profitable. Production `js/finance.js` `recordWeekly` (around line 499) writes five finance categories for each store (`revenue`, `costOfSales`, `rent`, `payroll`, `maintenance`). **For supply-target stores, COGS has `cashEffect:0` and changes inventory, because procurement has a separate cash writer.** A naive comparison of weekly cash with P&L would yield a false parity conclusion.

Consequently, **the cash-only SPIKE-2 store adapter is not yet a production-compatible ramen finance adapter**. This is a *feature gap*, not a demonstrated P0/P1 in the current game.

## Read-only contract

`legacy-crosswalk.cjs` accepts only **caller-supplied** `finance.transactions` rows, plus an explicit 13-week window and store/business identity. It does **not** import the current game, mutate a save, fetch runtime data, or insert ledger transactions.

It requires, per week:

| Finance category | Source suffix | Required economic meaning |
|---|---|---|
| revenue | `revenue` | Positive cash and positive earnings |
| costOfSales | `cogs` | Negative earnings, cash either **negative** or **zero for inventory** |
| rent | `rent` | Negative cash and earnings |
| payroll | `payroll` | Negative cash and earnings |
| maintenance | `maintenance` | Negative cash and earnings |

Five distinct, correctly attributed rows, exactly one of each, must exist for **every week**. Unknown store-specific rows, conflicting IDs, duplicate categories, nonfinite, negative or fractional-cent amounts, ambiguous business identity, and missing weeks **reject** instead of being silently omitted.

It converts current legacy whole-yen (potentially decimal) `amount`, `cashEffect` and `profitEffect` into integer 0.01-JPY experimental minor units using strict cent-precision checks. No silent float truncation.

`compare13WeekFixture` uses three verdicts:

- **MATCH** — all 13 weeks, all relevant fields (sales, cost of sales, payroll and operating profit), and comparable cash accounting assumptions match the synthetic reference exactly.
- **MISMATCH** — both are comparable under the limited cash-only semantics, but at least one expected numeric input/output differs.
- **UNSUPPORTED** — any noncash inventory COGS, rent, maintenance, or cash basis mismatch exists. This **precedes** match/mismatch even when some totals happen to line up; the reasons and numeric diagnostics are returned.

A **MATCH with mock rows is NOT evidence that production ever matched**. The tests explicitly use fabricated but finance-schema-compatible records; no real engine state has been loaded.

## Test evidence

```sh
node experiments/economic-engine-vnext/core.test.cjs
node experiments/economic-engine-vnext/equity.test.cjs
node experiments/economic-engine-vnext/store.test.cjs
node experiments/economic-engine-vnext/unified.test.cjs
node experiments/economic-engine-vnext/13-week.test.cjs
node experiments/economic-engine-vnext/legacy-crosswalk.test.cjs
```

The exact GitHub branch source/test files were fetched and executed with a **V8 CommonJS/Node assertion-compatible shim**, yielding **15+25+31+36+31+30 = 168/168 PASS**. This is **not actual Node proof** for the new branch. GitHub's normal CI is **not registered** to execute these experiment tests. There is **no** real legacy parity result, IndexedDB durability test, WebKit/iPhone result or save v9 migration in this evidence.

## Implementation requirements before real side-by-side parity

1. Create a **read-only extraction fixture** from one genuinely deterministic legacy save state, with controlled store ID, business ID, financing, macro seed, inventory opening/closing and 13 consecutive post-week finance records. Do not modify the production writer to export this.
2. Prove exact stage-of-week alignment: legacy `advanceWeek` increments `g.week` before `finance.recordWeekly`. Correlate week N receipt to the correct opening/closing state.
3. Capture separately store revenue, COGS, payroll, rent, maintenance, purchase orders, goods received/spoiled, inventory balances, payables and tax. **Store operating cash delta is not necessarily equal to store profit.**
4. Extend the *experimental* new adapter (in a **later** PR) to support inventory assets/expense timing, rent, maintenance, and quarter-end tax — with approved books and entity-specific counterparties. Do not rewrite a real production writer.
5. Re-run per-week balance-sheet, earnings, cash and source-identity invariants on the exact observed event stream. Report exactly which operations the experimental engine still cannot represent.
6. Only once all 13 weeks are semantically comparable should a true numeric MATCH/MISMATCH be claimed; document seed, legacy code SHA, file hashes and actual executed test commands.
7. Complete durable IndexedDB (including partially durable post-write failures) and save-v9 migration proof before proposing any economic-authority cutover.

### Owner isolation boundary

Experimental paths `experiments/economic-engine-vnext/**` and experiment branches are reserved to **regular ChatGPT**. Work and Claude Code must not modify, merge, or close any vNext PR (see [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038) and agent coordination [PR #1040](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1040)). This draft must remain outside production and must not claim mainline success.

**Caveat about PR #1040:** at the start of this session it had 20 successful/2 skipped checks, but it was not merged and current main had changed. A green historical CI check does not make a conflicted/outdated PR automatically mergeable.
