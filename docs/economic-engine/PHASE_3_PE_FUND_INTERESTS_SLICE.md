# P3-7 — recovered fund capital and proceeds evidence

Status: partial read-only implementation proposal, not Phase completion. Depends on #1025; #998 and #1019–#1024 are already merged. Merge remains conditional on final-HEAD CI, independent review, unresolved findings and the applicable Owner safety conditions.

Recovered source commits `872e3a14` and `8d32a536` are preserved as ancestors. `projectPEFundInterests(rawState)` exposes GP capital ratio only when size − GP = LP matches the installed createFund writer exactly. Portfolio funding fractions describe economic proceeds participation, never legal equity, votes or founder title to portfolio assets. External coinvest stays external. Paid GP/LP distributions, carry and fees are historical observations, never another receivable added to personal cash.

New recovery work registers the browser module after the indirect diagnostic, records its exact load-order fixture, rejects duplicate module registration, and registers a focused test in canonical shard K. The test includes a real installed createFund result, frozen input/output, v9 JSON reload, unchanged company/personal/RNG fields, duplicate fund/deal IDs, bad totals, exits/settlements/closed funds and getter non-execution.

Authority boundary: the underlying adapter remains a standalone source projection. The opt-in common-index wrapper described below binds that projection to one captured source revision, but does not identify individual LP beneficial owners, reconcile per-LP terms, model conversion-to-subsidiary aliases, value NAV/carry or establish complete ownership. No integration into the canonical subsidiary composition or wealth/control consumer is claimed. Unknown/missing source totals fail closed; zero is never invented for missing capital evidence. `complete`, `commandEligible` and `wealthComplete` remain false; all wealth values and legal/voting shares remain null.

No persisted root, migration, normalization, save, ledger, economic writer, cash movement or simulation RNG call. Fund creation/acquisition/distribution writers are unchanged. No P3-4 cutover, P3-10 executable command or Phase4 production Entry.

Verification: see final PR/handoff for actual executed tests and CI. Independent final-diff review and GitHub CI remain distinct from local checks. This session's local second pass is same-agent review, not independent certification. Functional omissions remain Stage F tasks; broad integrated campaigns remain Stage Q.

## Common source-revision binding

`buildOwnershipIdentityIndex(rawState, 'player-listed-and-pe-fund-source-v1')`
captures only the player/listed inputs plus the PE-fund fields consumed by
`projectPEFundInterests` and parent-conversion readers. `projectPEFundSourceSnapshot(rawState, index?)` reuses the
existing private common-index registry and token. It rejects foreign handles, changed
roots and changes to captured fund capital, lifecycle, terms, distributions, deal
allocation, settlement or cash evidence. Presentation-only fund fields are outside the
scope and do not invalidate the handle.

The wrapper returns the existing P3-7 source observations with `sourceScope` and
`sourceSnapshotToken`; it creates no second token registry. It does not append canonical
positions, fund units, issuer identities, legal equity, votes, NAV or wealth, and it is
not composed into the canonical ownership snapshot. Missing adapters and malformed,
accessor or non-enumerable source fields fail closed without executing getters. This is
source revision binding only, not P3-4 family closure or authority cutover.

The same source payload now includes `parentConversions` from the existing reciprocal
conversion reader. The PE scope captures only each deal's forward subsidiary ID and
exit method plus the subsidiary's reciprocal fund/deal IDs, lifecycle/source markers
and competing-family markers. A change to any captured link input invalidates the old
token; unrelated subsidiary ownership remains outside this lifecycle-link scope.
Supported rows remain `lifecycle-source-link` with null legal equity, votes and wealth.
Ambiguous, one-sided or competing-family metadata stays unresolved and cannot mint a
canonical position or ownership edge.

When the same explicit PE-fund scope is passed to `projectOwnershipSnapshot`, the
snapshot includes `peFundSourceEvidence` with that exact token and a separate
`pe-fund-source` coverage row. Adapter issues are propagated into the common issue
list. The ordinary/default snapshot shape is unchanged, and a stale handle returns no
source payload. Existing positions, classes and source replacements remain identical
to the narrow player/listed projection; canonical `pe` coverage stays
`not-implemented`. This composition therefore removes caller-side revision joining
without adopting a PE ownership or valuation model.

## Applied review corrections

Automated review found that processFundsWeek marks a fund closed at its term while active deals remain saleable. Current portfolio participation follows deal status/settlement and valid source allocation independently of term closure. Fund capital and GP manager relationships also remain current while a validated active participation or positive source cash remains; settled empty funds are non-current. The original closed status is retained, and no NAV entitlement is created. Regressions executed RED, then GREEN, including an installed processFundsWeek deadline transition and subsequent deal exit. These corrections are included in this revision; final-HEAD CI and independent re-review are separate pending gates. Any further candidate must remain outside an active PR while its CI is queued/in progress, per AGENTS.md.

Further review corrections emit complete shared Reason records (code/path/message/evidenceRefs), reject monetary evidence outside abs(amount * 100) <= Number.MAX_SAFE_INTEGER without rounding it, and validate closed-fund cash explicitly. Missing/malformed cash marks fund and manager evidence unresolved; it is never treated as validated zero. Independently validated live participation can still establish currentness, without resolving the unknown cash. Historical invalid distributions remain null with a reason and do not become receivables or erase unrelated supported capital evidence.

## Known waterfall source terms (partial P3-7 extension)

`projectPEFundInterests` additionally returns `waterfallTerms`, one source-scoped row per
fund, in deterministic fund-ID/path order. `reportedFeeRate`, `reportedCarryRate` and
`reportedHurdleRate` expose only own enumerable finite nonnegative Number fields in
`fund.terms`. Each rate is validated independently without defaults, normalization or
clamps; a missing/malformed rate stays null with a source-path issue. Duplicate/missing
fund identity or unsupported lifecycle quarantines all rates. Term gaps do not erase
independently supported capital/proceeds evidence.

These are reported contract metadata under P3-7 §3/§5, never an endorsed rate policy,
a settlement calculation or a verified entitlement. `entitlementStatus` remains
`unverified`; `carryValue`, `feeReceivable` and `wealthValue` remain null even for a
closed fund or positive historical distribution. No paid amount is added to cash again.
No live consumer, UI, fund NAV valuation, save, RNG or writer change.

The existing canonical fund-interest suite covers invalid/missing/accessor/hidden terms,
identity collisions, per-field independence, negative-zero JSON replay, frozen input,
rate preservation, order invariance and actual installed `createFund` source terms.
New native WebKit is not claimed: this extension adds no browser/persistence path.
See the PR and #909 for executed checks and exact final-HEAD CI, separately from these
behavioral contracts. Full P3-7/family closure and Phase 3 acceptance remain incomplete.


## Fund valuation source evidence (partial P3-7 §6)

`projectFundValuationEvidence(rawState)` reuses the existing pure fund-interest and
participation validation and returns separate `reportedFundCash`,
`reportedExternalCoinvestCash` and tagged `heldAssetInputs`. A held deal's
`enterpriseValue` is a whole-enterprise source input, not a marked current equity
value: no liability subtraction, proceeds allocation or founder fraction is inferred.
Portfolio-company cash, external coinvest cash and paid distributions are not added to
fund cash. Duplicate fund/deal identities, invalid allocations, missing values or
settled/exited deals cannot supply a supported held enterprise-value input. A closed
fund term alone does not erase a validated unsettled holding.

Missing cash is null rather than zero, getters are not executed, and raw roots are
unchanged. Outputs are frozen and deterministically ordered. Liability coverage and
valuation time remain unknown; fund NAV, allocated fund value, founder value and wealth
remain null even for an otherwise source-observed row. This opt-in evidence function
has no live consumer or economic writer/save/RNG/browser path and does not implement
an approved NAV/carry valuation policy. Existing canonical fund tests cover the new
API, JSON/frozen replay, account separation, invalid sources, lifecycle and installed
fund creation. Exact executed checks and CI are recorded in the PR/#909.


## Parent-company conversion source links (partial P3-7 §7/§12)

`projectFundParentConversions(rawState)` observes the installed
`pePortfolioOperations.acquirePortfolioCompanyByParent` metadata without calling its
preview, normalizers or settlement. A source-observed lifecycle link requires unique
fund/deal identities within fund scope, supported fund lifecycle, an exited deal with
parent-company-acquisition exitMethod and convertedToSubsidiaryID, and one active target
whose ID and reciprocal sourcePEFundID/sourcePEDealID plus source/type markers match.
Duplicate identities, competing family aliases, missing/stale/one-sided links and orphan
targets produce explicit unresolved evidence. Names, array indices and matching deal
labels across fund scopes do not establish a link.

A link is `lifecycle-source-link`, never an additional asset, canonical issuer/security
or adopted ownership edge. It can observe that the fund source holding is historical;
it cannot infer legal equity, votes, beneficial identity or wealth. Those fields stay
null, complete/commandEligible stay false, and the shared ownership merger/authority is
unchanged. An orphan is not repaired from history or a guessed ID. The reader accepts
bounded dense own-data collections, never invokes selected getters, returns detached
frozen output and does not mutate source/save/RNG or cash/accounting consumers.

The existing fund-interest suite covers valid reciprocal IDs, cross-fund labels,
duplicates, lifecycle/missing/conflicting claims, hidden/accessor fields, frozen and
JSON parity. The installed parent-company acquisition suite additionally observes a
real successful conversion and asserts no reader mutation or RNG draw. These source
link checks do not replace writer rollback/native-IDB/family-closure evidence. Exact
executed results and final-HEAD CI are recorded in the PR/handoff.
