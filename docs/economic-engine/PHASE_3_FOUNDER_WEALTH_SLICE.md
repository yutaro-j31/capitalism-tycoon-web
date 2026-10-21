# P3-11 — Founder wealth read-only projection (first component slice)

Base: main `e52c374b` (after #1026 P3-7 PE fund interests, #1029, #1015 P4-AUD-004 and #1057). Contract: [P3-11](PHASE_3_P3_11_CONTRACT.md) and [cross-slice architecture](PHASE_3_CROSS_SLICE_ARCHITECTURE.md). Implemented under the Owner's 2026-10-20 instruction to complete the next unfinished Phase 3 feature. This slice is §19 item 1, the pure component projector and its tests. It is not the UI slice, not a consumer cutover and not Phase 3 completion.

## API

`phase3FounderWealth.captureFounderWealthEvidence(rawState, externalEvidence?)` is the trusted capture. It makes a detached copy of the selected source branches. The copy is validated by descriptor, so getters are never executed, and cycles, symbols, holes, hidden fields, exotic prototypes and oversize input fail closed. From that one immutable view it derives three frozen evidence objects: `ownershipSnapshot`, `valuationEvidence` and `liabilityEvidence`. All three are bound to one opaque in-memory token (`Object.freeze({})`) through module-private WeakMaps. Nothing is persisted, and no RNG, clock or ID counter is used.

`phase3FounderWealth.projectFounderWealth(rawState, ownershipSnapshot, valuationEvidence, liabilityEvidence)` returns `{authority:'read-only', components, knownNetWorth, totalNetWorth, complete, unvaluedComponents, exclusions, reasons}`. Components follow the contract's WealthComponent shape. Amounts are signed: liabilities are negative, and nothing is clamped to zero.

### Snapshot binding (contract §6)

Before any arithmetic, each argument must satisfy all of the following:
- It is the exact object issued for its argument role.
- It comes from a capture of the same `rawState` object.
- That capture's view still equals a fresh view of `rawState`.
- That capture's P3-2/P3-5 ownership index still yields the identical ownership snapshot. This covers share-only changes such as a buyback, an issue or a founder lot change.
- All three arguments share one token.

Otherwise the result carries `STALE_EVIDENCE` at `<argument>.sourceSnapshotToken`, components are empty and both totals are null. The following are all rejected:
- forged or copied objects, and copied token fields
- swapped argument roles
- mixed captures, including two captures of an unchanged state
- in-place same-week changes
- hydration/rollback replacement objects

An invalid raw root returns `INPUT_INVALID` at `rawState`. Reasons are sorted by path and then code. The output contains neither the token nor any live input reference.

## Contract mapping

| Component | Source | Treatment |
|---|---|---|
| `asset:own-company` | P3-2 founder beneficial position via `economicReadModel.projectOwnershipSnapshot`; the own-ticker personal lot is delegated into it and excluded elsewhere | Listed: `stockPrice` must equal the unique designated `market` row price (valid, active), × founder beneficial shares. Disagreement or duplicate/invalid rows → `VALUATION_SOURCE_CONFLICT`; missing or suspended → `VALUATION_INCOMPLETE`. Private: supplied `equityValue` × (founder beneficial / outstanding) × 0.70. `enterpriseValue` and other kinds → `VALUATION_BASIS_UNSUPPORTED`. Unproven generation (refounded or sold) stays unknown. |
| `asset:listed:<alias>` | P3-5 personal listed positions + listing observations | Quantity × unique observed active price. Alias conflicts, quantity envelope and generation issues block it. Pure legal-identity/rights gaps do not block it. |
| `asset:personal-cash` | personal cash, JPY per the `economicReadModel` account contract | Signed. Non-finite or out-of-envelope → unknown. |
| `asset:founder-loan:<loanID>` | `finance.loans`, founder source, `status==='active'` (installed receivable semantics) | Principal once. The company payable stays inside company equity. Repaid loans are historical. |
| `liability:personal-debt` | personal debt aggregate | Included mirrors (`realEstate.loans`, and `realEstateMarket.loans` with `accountingTracked:true` per P4-AUD-004) are listed and never re-added. |
| `liability:margin` | `personalMarginLoan.balance` | An outside-aggregate identity. |
| `liability:untracked-property-loan:*` | personal `realEstateMarket` loans that are not `accountingTracked` | Unknown (`LIABILITY_COVERAGE_UNKNOWN`). |
| `asset:vc-personal:*`, `asset:angel:*` | P3-8 personal observations; active angel rows | Unvalued (`VALUATION_INCOMPLETE`). |
| `asset:pe-interests` | personal `peDeals` rows plus P3-7 `projectPEFundInterests` GP fund interests | Always unvalued. A GP contribution ratio is not NAV or title to fund assets. Paid distributions/carry are excluded as already-paid cash. |

Company-owned stocks, startup fractions and PE deals appear only as `company-owned` exclusions. They are never personal amounts.

## Currency

Only an explicit `currency === 'JPY'` is accepted on valuation and liability entries. Captured entries are labelled JPY only where the installed source contract is a JPY account or market holding. Missing, `USD`, `EUR` and any other label give a result-level `CURRENCY_UNSUPPORTED` at `<argument>.entries[i].currency`. The affected component becomes unknown and contributes nothing. No FX conversion is performed.

## Deferred, with reasons

- **A complete total.** `totalNetWorth` is null and `complete` is false in every state this slice can see. Three components are always unknown:
  - PE: fund NAV, liabilities and waterfall/carry are under OD-05, and P3-9 entitlement is not merged.
  - Unadapted personal families: personal real-estate holdings, investments, luxury assets, sports teams, the personal real-estate corporation and the family trust. Contract §4 says raw personal components need separate approval, and family/trust fractions are under OD-05.
  - Unreconciled liability coverage: mortgages on personal real-estate holdings, corporation and trust liabilities. Phase 4 debt identity is not adopted, and P4-AUD-003–008 remain external.
- **Private Equity Value source (OD-04).** No production producer exists, and legacy `companyValue` is not accepted as Equity Value. In game, a private own company stays unknown. Caller-supplied `externalEvidence.valuations` (own company only, with explicit coverage lists) and `externalEvidence.liabilities` are bound at capture time as `provenance:'supplied'`. This exercises the fixed formulas, EV rejection and the currency gate until Phase 6 supplies a real source.
- **Valuation of VC/angel/PE interests.** Not done: preferred terms, pending rounds and fund waterfalls are unsupported.
- **UI (§13) and any consumer cutover (§15).** These are separate PRs. `personalNetWorth`, the credit limit, progression, achievements, estate/succession and the ¥1T ending are unchanged and do not call this module.

## Read-only guarantees

- No writer, save field, normalization, `ensure`, `emit`, `save`, finance event, RNG or clock.
- Input is never sorted or frozen. Only newly allocated output and evidence are deep-frozen.
- `SAVE_KEY` and saveVersion 9 are unchanged.
- One classic script follows `phase3-restructuring-lifecycle.js`, and the module-load-order fixture is updated.
- The Phase 0.5 lexical writer inventory was refreshed with `--refresh-writers`. It lists this file only as a `personalCash` lexical candidate, the same way `economic-read-model.js` is listed. There is no exact-authority change.

## Tests

`tests/phase3-founder-wealth-test.js` (canonical shard K) covers:
- the contract §7 examples: 500 × 20 = 10,000; negative −20; EV 100M × 0.6 × 0.70 = 42M; EV rejection; GP-2% fund not founder NAV
- quote conflicts, duplicate quotes and generation
- currency cases
- founder loans, margin and P4-AUD-004 mirrors
- PE/VC/angel unknowns
- stale/forged/mixed/replaced evidence
- malformed, cyclic, accessor, symbol, sparse and exotic input with no getter execution
- immutability, idempotence, permutation invariance, raw versus JSON-reload and frozen-input equality, no token escape
- module registration
- an installed engine with a real same-week personal borrow, with zero RNG draws, unchanged storage and an unchanged `personalNetWorth()`/`personalCreditLimit()`

Real WebKit and physical iPhone are not claimed. No UI is added.

## Applied review corrections

- **Supplied liabilities, amounts and repeats** (f70b9315): a supplied liability must have a finite, non-negative amount within the monetary envelope. When a supplied identity repeats, every member is invalidated, and the set collapses to one unknown component regardless of input order.
- **Listing status:** only an explicit `publicCompany === false` selects the private Equity Value formula. An absent or non-boolean status leaves the own company unresolved (`VALUATION_INCOMPLETE`).
- **Where supplied-liability issues are reported:** malformed supplied liabilities are reported under `liabilityEvidence`, and malformed supplied valuations under `valuationEvidence`. A structural failure that cannot be attributed to one family is reported on both.
- **Supplied keys that name a captured liability:** supplied keys are canonicalized (an optional `liability:`/`supplied:` prefix is removed). They are grouped with captured identities, so a supplied `personal-debt` or `margin` meets the captured row it names. That collision fails closed on both rows: they collapse to one unknown `ALIAS_CONFLICT` component under the captured ID. The two sources either duplicate one obligation (counting both would double it) or contradict each other, and nothing here can tell which amount is right.
- **Repeated founder-loan identities:** they collapse to one unknown `ALIAS_CONFLICT` component, regardless of input order.
