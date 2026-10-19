# SPIKE-1 — source-backed share issuance and voting rights (regular ChatGPT)

**Track / Owner:** experimental Economic Engine vNext [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038); **regular ChatGPT only**.  
**Parent prototype:** draft PR #1039 (`experiment/economic-engine-vnext-20261020`).  
**Status:** isolated experiment. NO production imports, IndexedDB persistence, save-v9 adapter, or Phase 3 cutover.

## Intent

The legacy engine has historically allowed ownership/equity drift and missing personal equity following company sale/refounding (for example #955 and #1008). This design proves an **independent paid-in equity issuance path**, and keeps ownership and voting rights anchored to explicitly declared issuer + share-class records.

## Operation contract

- `createEquityState(coreState, classDefinitions)` declares authorized shares, issuer, class and votes per share. It accepts only entities in the already validated pure core.
- `planShareIssue(state,{id,type:'issue-shares',issuer,subscriber,classId,shares,priceMinor})` first stages a **single core transfer** from investor to issuer and records the same stable receipt ID/sequence. Then it updates issued shares, investor positions, cost basis and paid-in capital in the **same returned immutable state**.
- `admitShareIssue(state,operation,persist)` accepts the full staged state only if persistence admission returns true. False/throw leaves the original untouched. This does **not** guarantee rollback if a real storage adapter writes durably and then fails.
- `validateEquityState` asserts authoritative classes, authorized limit, valid source entities, sum(holders.shares)=issuedShares, price×shares=paid-in proceeds, receipt ↔ core transfer journal, investor cost-basis assets + issuer equity and **per-entity balanced accounts**. Invalid states reject.
- `ownershipSnapshot` generates **read-only**, deterministic **exact rational** share ratios and class-weighted voting ratios. Strings represent whole-share numerator/denominator; never derive votes from valuation/cash or round to percentages.
- Monetary values are safe JS integers in 0.01-JPY units. Product arithmetic uses BigInt before bounds checks. No random IDs, Time/Math.random, direct mutation, or imported game runtime.

### Example

```js
const {createInitialState}=require('./core.cjs');
const {createEquityState,admitShareIssue,ownershipSnapshot}=require('./equity.cjs');
const s=createEquityState(
  createInitialState({company:10000,founder:40000}),
  [{issuer:'company',classId:'ordinary',authorizedShares:1000,votesPerShare:1}]
);
const {ok,state}=admitShareIssue(s,{
 id:'issue-1',type:'issue-shares',issuer:'company',
 subscriber:'founder',classId:'ordinary',shares:10,priceMinor:100
},()=>true);
// ok === true; founder cash -1000, company cash +1000
// founder investment asset +1000, issuer paid-in capital -1000
// 10 legal outstanding ordinary shares; no duplicate on repeated issue-1
```

## Execution/evidence

Run manually after the parent SPIKE-0 branch has been checked out:

```sh
node experiments/economic-engine-vnext/core.test.cjs
node experiments/economic-engine-vnext/equity.test.cjs
```

Regular ChatGPT executed **actual Node.js 22.16.0** against the prior exact SHA-matching parent `core.cjs` + `core.test.cjs`: **15/15 PASS**. It also executed the locally developed equity module and test suite: **25/25 PASS**. The tests submitted in this PR are based on those cases, but **do not claim remote HEAD Node/CI/WebKit PASS until verified on the exact PR HEAD**. Compare exact remote file hash/diff before making a final acceptance claim.

## Explicit non-goals / risks

- This prototype models **cash-paid new share issuance only**, not secondary transfers, buybacks, dilution on swap, conversion, vesting, a subsidiary hierarchy, PE/VC claims, round terms, M&A, stock splits, or treasury shares.
- It has **no durable IDB or localStorage adapter** and cannot load current `saveVersion=9` saves. A success callback is a test-only admission, not a real commit protocol.
- It uses a separate positive investor asset / negative issuer capital supplemental book layered over the SPIKE-0 transfer journal; production may eventually require a single integrated entity-aware posting authority. Treat this proof as an architectural experiment, not a production ledger.
- Scope of this PR is exclusively `experiments/economic-engine-vnext/equity.*` and this note. **Do not merge to main, reassign to Work/Claude Code, or stage current production writers.**
