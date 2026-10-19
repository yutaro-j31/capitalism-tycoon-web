# Economic Engine vNext — isolated feasibility spike

**Owner decision:** 2026-10-20 JST — regular ChatGPT leads this separate experimental track.  
**GitHub tracker:** [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038)  
**Source snapshot:** main `2507203f3f0abdcc08262ede91703915e5ba265f`. Recheck the actual main before subsequent work.  
**Status:** SPIKE-0: a pure proof-of-concept, **NOT production, migrated, accepted or mainline-ready**.

## Purpose and isolation

Evaluate whether rebuilding the economic core can reduce recurring cash/debt/ledger/ownership/atomicity regressions without stopping ongoing Economic Engine Phase 3/4 work (Work + Claude Code). This directory is intentionally not imported by `index.html`, `js/` or the legacy engine. It does not mutate or read the production game/save. No `package.json`, workflow, canonical test registry, `SAVE_KEY` or `saveVersion` changes.

```
experiments/economic-engine-vnext/
  core.cjs       # Pure economic operation planning and admission
  core.test.cjs  # Self-contained focused proof tests
  README.md      # Scope, known limits and owner handoff
  COMPARISON.md  # Side-by-side parity plan and decision criteria
```

Run manually from the repository root:

```sh
node experiments/economic-engine-vnext/core.test.cjs
```

This experiment does not yet register a canonical CI test job. Do not infer that repository CI automatically runs it. At creation, core functions and the tests were evaluated in a V8 CommonJS-compatible test runner (15 cases PASS); **actual Node, real browser, IndexedDB, old-save and physical iPhone tests were NOT run by that validation**. Future agents should execute actual Node and report exact exit status before declaring experimental test acceptance.

## Core contract — SPIKE-0

- Integer `amountMinor` in **0.01 JPY** units; storage uses JavaScript safe integers, intermediates use transient `BigInt`. Refuse fractions, NaN, Infinity, overflowing/post-unsafe balances. No `Math.random`, clock reads, generated random IDs or nondeterministic tie-breaking.
- Entity-scoped debit-positive/credit-negative balances. `createInitialState({bank, company, founder})` initializes per-entity cash and matching opening equity.
- Pure `planOperation(state, operation)` computes a new state without changing the caller's state. Implemented command families: `transfer`, `borrow`, `repay`.
- Every operation must have a stable explicit ID and balanced postings. Receipt `operationId` is unique; repeated IDs reject. All cash accounts must remain non-negative. Loans have one principal record and balanced borrower liability/lender receivable legs.
- `admitOperation(state, command, persist)` first stages a pure candidate; it returns the original state on rejection, missing persistence, a rejected persistence callback or a thrown callback. The callback receives a clone so it cannot mutate the staged candidate.

**Critical caveat:** this is **not** a durable transaction protocol. A callback returning false or throwing *after* physically writing to IndexedDB is outside this experiment's guarantees. Real save-state commit/rollback across localStorage, IndexedDB cache, pending write, durable hydration and OS/browser crashes must be designed and verified before any cutover. There is no old-v9-save migration, browser integration or production financial policy approval in this proof.

## Design guardrails

1. Financial settlement must have a uniquely designated writer; UI, reports and render are read-only projections.
2. Distinguish company, founder, lender, subsidiaries, PE funds, VC vehicles and property ownership before introducing their instruments; a generic transfer does not infer owner identity.
3. No synthetic money, loan reduction without cash counterpart, negative cash, invisible finance writer, duplicate receipt or private-asset deletion.
4. Every proof claim must list actual evidence level: CODE, V8, NODE, HEADLESS, IDB, WEBKIT, PHYSICAL iPhone. Prototype tests are not interchangeable with production CI.
5. Mainline Stage F continues in parallel; vNext does not authorize new financial writers or waive security/correctness gates. No main merge or save migration without separate Owner approval.

## Follow-up slices (one independent concern/PR)

- **SPIKE-1** — source-backed equity issuance and beneficial/voting-interest ownership; no duplicated shares, invalid issuer or lost personal investment after refounding.
- **SPIKE-2** — one fully worked store operating week, debt interest/principal and cross-entity accounting statement projection.
- **SPIKE-3** — an M&A acquisition lifecycle, including seller/buyer positions, subsidiary balance-sheet book and disposal.
- **SPIKE-4** — persistence-adapter architecture, rollback on failed durable admission, v9 legacy save read-only interpretation and IDB/WebKit proof.
- **SPIKE-5** — comparable fixtures, parity deltas, integration cost and rebuild decision. Do not infer completed functionality from this roadmap.

## Ownership and coordination

Regular ChatGPT owns the experimental code and evidence. Claude Code and ChatGPT Work remain responsible for existing Phase 3/4 tasks unless explicitly reassigned by Owner. Avoid editing their shared paths or rebasing/cherry-picking vNext into production. The normal ChatGPT session must be invoked for further implementation; **this issue does not start an autonomous background coding process**.
