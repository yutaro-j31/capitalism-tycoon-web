# Shared transaction fault harness contract and stock-split analysis (design only, #922)

Status: **design / analysis only**. No production, test, CI, save-format or economic change. Written 2026-10-11 against main `b1fc1ec`. Implementation of anything below needs a separate PR and, for economic rules, an Owner decision.

## 1. Shared transaction fault harness — proposed contract

### Why
Each atomicity family (`stock-split`, `pe-portfolio-exit`, `vc-*`, `ma-*`, `parent-ipo`, `founder-share-sale`, `investor-offer`, `stock-purchase/sale`) re-implements the same fault matrix inline (see `tests/stock-split-save-atomicity-test.js`, `tests/pe-portfolio-exit-save-atomicity-test.js`). A shared helper reduces drift and makes new-writer coverage cheap. It must not weaken any existing assertion.

### Proposed API (test-infrastructure only, e.g. `tests/helpers/transaction-fault-case.js`)
```
makeTransactionFaultCase({
  name,            // e.g. 'stock-split'
  fixture,         // () => { game, backend, ...ids }  deterministic, no Math.random
  command,         // (ctx) => result            the INSTALLED engine method
  snapshot,        // (game) => normalized FULL game state (live-rollback oracle; never a field subset)
  economic,        // (game) => state minus save metadata (reload / fresh-hydration comparison only)
  expectSuccess,   // (before, after, ctx) => void   normal-path oracle
})
```
Fault kinds (the union already used by the existing tests):
`save-false`, `save-before-throw`, `save-throw`, `mirror`, `enqueue-false`, `enqueue-throw`, `saved` (post-save listener throws), `change`, `notify`, with the nesting and pending-predecessor combinations declared **per family**. A converted family must keep exactly the combinations its current test runs (e.g. stock-split: all nine faults at `pending=false` both nested and not; four non-nested faults with a pending predecessor). The harness does not impose the full cross-product.

Assertions per fault (all already present in the existing families):
1. failure contract: `false` for soft failures (`save-false`, `mirror`, `enqueue-*`), thrown error otherwise;
2. `snapshot(game)` deep-equals the pre-command full snapshot (live state); `economic(game)` is used only for reload / fresh-hydration comparison;
3. localStorage mirror, IDB cache, pending queue and durable store equal the pre-command boundary after `flush()`;
4. reload and a fresh `loadGame` hydrated from durable only equal the snapshot;
5. retry of the same command succeeds and matches `expectSuccess`; `saveSequence` is monotonic;
6. normal path: exactly one save per top-level command; events order `notify, saved, change`;
7. company cash / personal cash / fund cash and finance journal conservation via the existing `validate` helpers; RNG call count unchanged by the failed attempt.

Real WebKit / IndexedDB remains a separate browser test per family; the harness must report "WebKit NOT RUN" explicitly rather than imply coverage.

### Rollout (each step its own PR)
1. Harness helper + conversion of **one** small family (stock-split) with an identical-assertions check (same fault list, same combinations, same counts, same full-state snapshot).
2. Convert other families one at a time; never delete the original assertions before the converted test is proven equivalent.
3. Use the harness to add the remaining uncovered writers (see open #946 `activateDefense`, #947 `executeMBO`).

## 2. Stock split — dividend and price-floor analysis

Source: `js/expansion.js` `stockSplit` (≈ lines 381-387).

### 2.1 Dividend is not rescaled (P1 candidate, Owner decision required)
`stockSplit` multiplies holder `qty` (and own-company `sharesOut`, `founderShares`, `treasuryBuybackShares`) by `ratio` and divides `price`, `previous`, `avg` and price history by `ratio`. It does **not** touch `dividendPerShare`. Dividend income paths use `qty * dividendPerShare` (`js/engine.js` ≈ 2312, plus the own-company `dividendPerShare * sharesOut` path), so a 1:`r` split multiplies dividend cash by `r` with no change in value. The `dividendYield`-based branch scales with price and is unaffected.

Reproduction (reported in #922 checkpoint 2026-10-11 ~12:00 JST, Node, `loadGame({headless:true})`): `dividendPerShare=30`, `qty=100`: base 3000 → after `stockSplit(id,2)` base 6000.

Options for the Owner:
- **A (recommended):** divide `dividendPerShare` by `ratio` for the external stock and for the own company (`g.dividendPerShare`). Value-neutral, matches real-world splits. Needs a regression test (dividend base before == after) and a decision on already-saved games (no silent repair; applies to future splits only, `saveVersion` stays 9).
- B: leave as is and treat as a feature — not recommended, it is a repeatable money exploit combined with 2.2.

### 2.2 No price floor
Repeated splits are unbounded (40 consecutive 1:2 splits reached ≈ 2.3e-10). Options: hard minimum post-split price (reject when `price/ratio < floor`), or cap on `stockSplitHistory` length per stock/year. Both change economic rules → Owner decision on policy and constants.

### 2.3 Non-goals
Reverse splits, split of already-saved dividend history, and any ledger rewrite.

## 3. Open items needing an Owner decision
- Authorize the minimal dividend-rescale fix PR (2.1 option A) and choose the floor policy (2.2).
- Approve the harness rollout order (section 1).
