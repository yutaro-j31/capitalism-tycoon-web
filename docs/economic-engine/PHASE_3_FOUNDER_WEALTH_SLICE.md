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
| `asset:pe-direct:<source ID>` | P3-7 `projectPEOwnership` accepted personal direct position + captured `peDeals.currentValuation` | Owner-stake value once, without multiplying by the ownership fraction again. Unique active personal source, no conflicting mirror claim and finite non-negative value required. |
| `asset:pe-interests` | unresolved personal `peDeals` rows plus P3-7 `projectPEFundInterests` GP fund interests | Always unvalued. Accepted direct positions appear only in their dedicated component. A GP contribution ratio is not NAV or title to fund assets. Paid distributions/carry are excluded as already-paid cash. |

Company-owned stocks, startup fractions and PE deals appear only as `company-owned` exclusions. They are never personal amounts.

## Currency

Only an explicit `currency === 'JPY'` is accepted on valuation and liability entries. Captured entries are labelled JPY only where the installed source contract is a JPY account or market holding. Missing, `USD`, `EUR` and any other label give a result-level `CURRENCY_UNSUPPORTED` at `<argument>.entries[i].currency`. The affected component becomes unknown and contributes nothing. No FX conversion is performed.

## Deferred, with reasons

- **A complete total.** `totalNetWorth` is null and `complete` is false in every state this slice can see. Three components are always unknown:
  - PE: fund NAV, liabilities and waterfall/carry remain under OD-05; read-only control eligibility is not a valuation policy.
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
- **Malformed rows in a repeated identity:** a malformed supplied liability with a valid key keeps its identity claim through grouping. It still reports `INPUT_INVALID` under `liabilityEvidence`, and it turns the whole identity into one unknown `ALIAS_CONFLICT` component, including a captured row of that identity. A lone malformed row only reports `INPUT_INVALID`.
- **Coverage that overlaps other claims:** supplied Equity Value `coveredAssets` are checked against the other asset claims, and `coveredLiabilities` against the personal liability claims (exact key, or a parent/child path). Any overlap leaves own-company and every overlapped component unknown with `ALIAS_CONFLICT`, because counting both would recognize the same economics twice. A company payable covered inside Equity Value is not matched against the founder's receivable, since they are distinct legal positions (contract §6). Coverage that names nothing else projected is unaffected.


## Direct personal PE component extension — 2026-11-01

Base: `9ef31b1f20b1c0e6d4acfeaa9157128bf2132243`. The P3-11 contract §3/§8
and P3-7 §3 already define legacy direct `currentValuation` as the owner's stake
value. This extension connects that existing basis; it defines no fund NAV or new
settlement policy and does not depend on the company mirror precision fix #1260.

The trusted capture now includes direct PE amount/fraction/link facts and the minimal
M&A/overseas subsidiary alias claims. It calls the existing pure P3-7 ownership adapter
on that detached view. Only accepted personal direct positions receive a dedicated
`stakeValue` entry and `asset:pe-direct:<encoded source ID>` component. Company holdings,
exited/sold stakes, duplicate identities, unknown owners/fractions and contradictory
mirror links never add a personal amount. Unresolved direct ownership retains adapter
reason codes in the aggregate unknown component. Invalid/missing amounts and positive
values with a zero economic fraction remain unknown, never a fabricated zero.

The new source fields participate in committed-snapshot binding: a same-week valuation,
owner, fraction, lifecycle or mirror-link change invalidates prior evidence before
arithmetic. Supplied Equity Value coverage is checked against the direct claim through
the existing overlap gate. Descriptor validation rejects valuation getters without
executing them. An installed personal acquisition verifies the same source semantics.

No UI, consumer, credit limit, `personalNetWorth`, save field, writer, RNG or receipt
changes. Total wealth remains incomplete because unadapted personal/fund assets and
liabilities are unresolved. Existing registered founder-wealth tests are extended;
no duplicate test registration or workflow change is introduced. This is a pure
read-model extension; targeted new WebKit/IndexedDB behavior is not introduced.


## Personal investment inventory (partial P3-11 §3)

The trusted capture additionally binds `personalInvestments` ID, currentValue,
optional explicit owner/account and lifecycle fields. Installed buy/weekly/sell
writers maintain this personal-only current inventory; its `currentValue` is a gross
JPY source mark. One unique supported personal row contributes once as
`asset:personal-investment:<encoded durable ID>` with basis `reportedCurrentValue`.
Principal is not added again. This value is not a promise of redemption proceeds:
whole-yen settlement and contingent performance carry remain in the existing writer.

Missing/invalid amounts or IDs, duplicate IDs, conflicting explicit ownership and
unsupported lifecycle leave the component unknown; duplicate IDs produce one
unvalued claim with every source reference. These captured source facts participate
in the existing same-revision token boundary and Equity Value coverage conflict gate.
No investment history is reconstructed, no asset or receipt is persisted, and no
wealth/credit/progression/UI consumer changes. Other unsupported personal families
and liability coverage keep totalNetWorth null and completeness false.

The existing canonical wealth suite covers RED/GREEN, invalid inputs/identity,
getter non-execution, stale marks, duplicate attribution, coverage overlap,
JSON/frozen purity and installed bond purchase/redemption. Native browser or writer
fault coverage is not newly claimed for this pure projection addition; see PR/#909
for executed focused checks and exact final-HEAD CI.


## Luxury inventory (partial P3-11 §3)

The same captured personal-inventory mark calculation now supports `luxuryAssets`
independently of investment products, using `asset:personal-luxury:<encoded ID>`.
The installed store and auction writers add current personal holdings; sell removes
the holding. Only unique supported personal rows with valid gross `currentValue`
contribute. Purchase price is not added again. Equal IDs or names across different
collections do not establish an alias; source-family identity remains explicit.

Gross current marks are not liquidation proceeds: the existing sell writer's 95%
conversion and yen rounding remain unchanged. The reader calls no auction/store,
weekly, sale, save or RNG helper. Duplicate/missing identity, invalid value,
conflicting explicit owner/account or unsupported lifecycle stay unknown. The same
revision token and Equity Value coverage gate protect this family as well. Other
unadapted families and liability gaps keep the total incomplete, with no UI/credit/
progression consumer switch or new valuation policy.

Existing canonical wealth tests cover new-family RED/GREEN, separate collections,
duplicate quarantine, source changes/getters, frozen/JSON purity and actual luxury
purchase→projection→sale with unchanged sale proceeds. PR/#909 record executed focused
checks and exact final-HEAD CI; no new native WebKit/persistence proof is claimed.


## Sports team inventory (partial P3-11 §3)

The captured mark calculation supports `sportsTeams.value` as a separate gross JPY
source mark in `asset:personal-sports:<encoded ID>`. Unlike the personal-only investment
and luxury collections, this is a mixed-account inventory: only explicit `owner=personal`
with consistent optional account evidence can contribute. A unique consistent company
row is excluded from direct personal wealth and remains indirect through parent equity.
Missing/unknown ownership stays unvalued; no legacy default owner is invented.

Identity grouping precedes company exclusion, so duplicate IDs across personal/company
rows cannot select a convenient owner or value. Unknown identity/lifecycle/value and
coverage conflicts remain unresolved. Sale listings/offers are not another asset or a
price source. Source value is not predicted sale cash, and no sports writer, fee model,
RNG, accounting, save or consumer is changed. Existing revision/coverage gates apply;
other personal families and liability gaps keep the global total incomplete.

The existing canonical wealth suite covers source-account separation, duplicate owner
conflicts, missing/invalid evidence, stale ownership, getters, frozen/JSON purity,
parent coverage overlap and installed personal/company team purchases followed by
personal disposal. PR/#909 retain exact executed checks and CI; no new native WebKit
or writer persistence proof is claimed for this pure read-only extension.


## Personal property catalog (partial P3-11 §3)

The trusted capture supports the separate `personalRealEstateHoldings` catalog using
its purchase-specific `assetID`, not its reusable offer `id`. Unique current `owned`
rows with supported direct personal title contribute gross `currentValue` as
`asset:personal-property:<encoded assetID>`. Repeated purchases of one catalog offer
remain distinct. Identity grouping occurs before lifecycle exclusion: duplicate
owned/sold rows are unresolved rather than selecting a convenient value. Unique sold
or foreclosed rows are historical, not retained assets.

A true or malformed `ownerCorp` marker prevents direct personal valuation; corporation
beneficial interest/NAV stays unvalued. Absent/false markers follow the installed direct
purchase/withdrawal source boundary without calling its mutating helpers. Explicit
owner/account conflicts stay unknown. Revision and parent coverage gates apply.

This is gross property evidence, not sale cash or net equity. No mortgage/tax principal
is defaulted to zero or deducted speculatively: liability coverage remains explicitly
incomplete, and totalNetWorth remains null. The general properties inventory, corporate
interest and trust still need their own evidence. No writer, ledger, pricing, save,
RNG or consumer/UI changes. The canonical wealth suite covers duplicate catalog offers,
asset-ID conflicts, current/historical/corporate transitions, invalid/getter/frozen/JSON
inputs, stale ownership, coverage overlap and actual purchase→corp contribution→
withdrawal→sale. PR/#909 record executed checks and exact CI; no new native WebKit or
writer persistence proof is claimed.


## General property inventory (partial P3-11 §3)

The separate `properties` collection now contributes gross `value` source marks only
for unique explicit personal ownership, under `asset:personal-general-property:<ID>`.
Company holdings are excluded from direct personal wealth; a unique explicit null
owner is unowned market inventory and is excluded. Missing/unknown owner is unresolved,
never defaulted to personal. Duplicate owned/unowned/company IDs are grouped before
exclusion. The general inventory and personal catalog remain distinct families; names
or coincident IDs alone do not establish a cross-collection alias.

The reader uses no valuation helper and does not substitute book/purchase/sale price.
Gross source value is not liquidation proceeds or net equity. Mortgage/tax completeness,
corporate interest and trust remain unknown, preserving null totalNetWorth. The existing
revision and Equity Value coverage conflict gates apply; writers, settlement/save/RNG
and wealth/credit/UI consumers are unchanged.

The canonical wealth suite covers account/market separation, duplicate/invalid claims,
stale ownership/getters, frozen/JSON purity, parent coverage overlap and actual installed
personal/company purchases followed by sale. The Phase0.5 lexical candidate declaration
is updated for the additional properties token after source review; exactAuthority is
unchanged. PR/#909 retain executed checks and exact CI, with no new native WebKit claim.


## Personal real-estate corporation evidence (partial P3-11 §3/§18)

`asset:personal-real-estate-corporation` separates corporate source evidence from the
founder's direct cash and property marks. Capture binds the raw establishment flag,
corporate cash and selected corporate-held property source links. The component reports
finite non-negative `reportedCash` only as source metadata, explicit cash status/reasons,
and `entity-asset-reference` links for owned properties with a true ownerCorp marker.
No holding identity or corporate beneficial ownership is certified; coverage is partial.
Missing/invalid cash remains null without a default or normalizer.

The component's beneficialOwnerEntityId and amountJPY remain null, as do NAV and every
linked property's personalWealthValue. Ownership, liabilities and corporate valuation
are unproven: no corporate cash/underlying property is added to personal cash or the
known subtotal. The remaining generic unadapted family is trust. This is an explicit
unvalued component, not a corporate NAV/founder entitlement policy (OD-05).

Source facts join the existing immutable-revision binding, frozen JSON projection and
coverage boundary. Existing installed corporation and rental/sale writers, saves,
RNG, legacy net-worth/credit/UI consumers remain unchanged. Canonical tests cover
source/non-personal cash separation, absent/invalid/frozen/getter sources, stale corporate
cash, and installed establishment/property contribution. PR/#909 retain actual checks
and exact CI; no new native WebKit/persistence route is claimed.


## Family-trust source evidence (partial P3-11 §18 / OD-05)

`asset:family-trust` replaces the generic unadapted-family placeholder with explicit,
revision-bound source metadata: establishment flag, finite non-negative reported cash
and non-negative safe-integer reported share count. Missing/invalid amounts remain null;
selected getters and hidden descriptors fail closed without invocation. An establishment
flag is only source status, not legal or beneficial ownership evidence.

No trust issuer, founder beneficiary/fraction, share rights, liability coverage or NAV is
inferred. Beneficial owner, security ID, beneficial fraction, NAV and component amount
remain null. Trust cash is never added to personal cash or knownNetWorth, and the share
count never expands founder-company shares. OD-05 remains open. Existing wealth/credit,
trust writers, save, RNG and UI are unchanged. Total net worth remains incomplete.

The canonical wealth suite covers source/JSON purity, frozen output, missing/invalid
balances, hidden/accessor rejection, same-week stale fields and installed establishment/
transfer (personal cash decreases while the trust source balance increases). Exact test
and CI results belong to the PR/handoff; no new native WebKit claim is made.


## PE fund source explanation (P3-11 consuming partial P3-7)

The existing unvalued `asset:pe-interests` component now exposes `sourceEvidence`:
fundInterests, waterfallTerms, valuationFunds and valuationIssues from the existing
P3-7 readers. Capture derives these from its already revision-bound peFirm view; the
projector returns detached copies. This connects fund source explanations to the wealth
result without requiring callers to combine independently captured financial inputs.

A contribution ratio is capital-source metadata, never fund NAV or target shares.
Reported fund cash, external coinvest cash and whole-enterprise inputs remain separate;
paid distributions/carry remain historical cash already represented elsewhere. Closed
fund metadata may explain history but cannot revive a held asset. Unknown identity,
liability coverage and valuation issues stay explicit. No source amount is added to
knownNetWorth; the PE fund component amount/NAV/founder valuation remain null. Existing
personal direct PE values continue once under their separate supported component.

The canonical wealth suite adds source-reader wiring, source/account separation,
missing identity, closed/exited metadata, detached/frozen/JSON purity and same-week
cash/rate/enterprise-value staleness checks. No writer, consumer/UI, save or RNG path
changes; this is not OD-05 resolution, canonical fund ownership adoption or complete
wealth/Phase-3 acceptance. Exact executed checks and CI are in the PR/handoff.
