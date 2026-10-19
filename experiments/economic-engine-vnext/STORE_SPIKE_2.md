# Economic Engine vNext — SPIKE-2 cash-basis store-week journal

**Owner:** regular ChatGPT only; [owner tracker #1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Base:** experimental equity draft PR #1041 (`a7587d766fc2a8235ad388c452b916d6684cb5c3`); ancestor core draft #1039.  
**Scope:** `experiments/economic-engine-vnext/` only. No production import, new save adapter, CI registry edit, or mainline cutover.  
**Evidence:** Actual local Node.js v22.16.0 15/15 core, 25/25 equity, and 31/31 operating-week tests PASS. GitHub-branch exact core/store blobs match locally tested blobs. Exact current GitHub branch code and checked-in tests also passed 15+25+31 in V8 CommonJS-compatible harness. **The checked-in `store.test.cjs` blob itself has not been run in a Node process; no GitHub PR-head CI verdict was established at authoring time.**

## Purpose

Prove that a minimal operating business can run on **one journal within an isolated transaction**, instead of allowing each gameplay subsystem to change cash and statements independently.

This model is limited to **cash-basis** weekly retail operations. All money values have the unit **JPY × 100** (integer `amountMinor`). For example `salesMinor:5000` means **¥50**, not ¥5,000. This choice is deliberate to reject fractional binary-currency movements and to make equality exact. No monetary schema migration is authorized.

## SPIKE-2 operation

`admitStoreWeek(state, {type:'settle-store-week', company, customer, supplier, employee, storeId, week, salesMinor, materialsMinor, wagesMinor}, persist)`

For the normal 3-component week, the engine records **12 journal legs**, all in one `journal` entry, with exactly one deterministic `store-<company>-<store>-w<week>` receipt.

| Party | Cash effect | P&L account |
|---|---:|---|
| Customer | `-sales` | Purchase expense `+sales` |
| Company | `+sales - materials - wages` | Revenue `-sales`, materials `+materials`, payroll `+wages` |
| Supplier | `+materials` | Material sales revenue `-materials` |
| Employee | `+wages` | Wage revenue `-wages` |

With `salesMinor:5000, materialsMinor:2000, wagesMinor:1000`, **weekly profit is +2000 minor units = ¥20**. Company cash increases by exactly the same amount under this intentionally cash-only model.

Company P&L projection is derived **only from the posted journal**, via `storeSnapshot(state, company, storeId)`; no parallel authoritative P&L cache is updated.

## Changes to the pure core

- Adds controlled `revenue:<id>` and `expense:<id>` accounting-key grammar.
- Adds a generic `journal` operation for tightly validated postings, with bounded array length and positive/negative signed safe integer values.
- Enforces balanced global and **per-entity** journal legs; **all cash legs sum to zero**, require two or more entities when any cash legs exist, and may not inflate the cash supply merely by offsetting company cash against a company revenue row.
- Rebuilds the full balance map from genesis opening accounts and the immutable journal; forged unjournalled cash changes or mismatched journal entries fail validation.
- Leaves the original core `transfer`, `borrow` and `repay` behavior intact, preserving the SPIKE-0 tests and SPIKE-1 equity contract. **Important architectural gap:** the legacy prototype's simple cross-entity transfer is **not itself a balanced per-entity financial operation**; SPIKE-1 layers paid-in equity representation on top of it. Future migration must unify transfer, equity and store settlements as a single canonical double-entry authority before declaring a production-ready unified ledger.

## Test coverage

```sh
node experiments/economic-engine-vnext/core.test.cjs
node experiments/economic-engine-vnext/equity.test.cjs
node experiments/economic-engine-vnext/store.test.cjs
```

- Happy path: one week, 12 legs, four-party cash conservation, revenue/materials/payroll/profit.
- Multi-week and two-store isolation; deterministic same-input output, one-store-one-week idempotency.
- Zero/fractional/nonfinite/unsafe input rejection; insolvent company/customer and invalid entity rejection; loss-making solvent store accepted.
- Save callback `false`, throw, missing adapter, and mutation of callback copy — original state preserved.
- Rejected unbalanced/per-entity-only or self-minted-cash journal, plus forged cash and journal mutation detection.
- Baseline 15+25 tests re-run to guard existing pure core/equity behavior.
- No tests claim actual IndexedDB durable atomicity, WebKit, old-v9 compatibility, payroll employment contracts, real supply-chain inventory, accrual revenue recognition or operational parity.

## Known limitations and decisions

1. **Not production parity:** no taxes, asset wear, inventory lot / supplier purchase ordering, stockout, credit sales/receivables, depreciation, wage withholding, profit-to-equity close, price elasticity, competition or business-advertising mechanics.
2. **No actual persistence protocol:** callback `true` is a local mock. It cannot prove that failure after a durable IndexedDB write can be rolled back. Require a real storage adapter + fresh hydration tests before any authority cutover.
3. **No security boundary:** caller-supplied journal entries are not cryptographically tied to a real customer order or gameplay event. The experiment proves conservation, not anti-cheat authorization. The generic journal API must be private to trusted event-generation paths in any production design.
4. **Transfer/equity bridging:** existing SPIKE-0 and SPIKE-1 are deliberately kept compatible. Their entity-accounting model needs later refactoring; account names and `core` snapshot schema here are *experimental*, not a `saveVersion=9` migration plan.
5. **Performance:** the full-history replay validator grows with journal length; before any scale decision, benchmark incremental snapshots, append-only journal integrity, history compaction, iPhone storage/memory and deterministic replay.
6. **Future work:** benchmark cross-slice transaction semantics and introduce a unified per-entity transfer/equity general-ledger model, then a deterministic 13-week small-business comparison with the installed legacy engine. Continue the mainline Phase 3/4 development independently.

## Explicit merge boundary

This PR is **Draft**, stacked on #1041, itself stacked on #1039. None is a production feature or an approved `main` merge. Regular ChatGPT owns this experimental path. ChatGPT Work / Claude Code must not edit, rebase, select as next task or merge the vNext PRs without a new explicit Owner authorization recorded on #1038. Existing mainline Phase 3/4 work is unaffected.
