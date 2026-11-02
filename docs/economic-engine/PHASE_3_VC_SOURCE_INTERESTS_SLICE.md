# P3-8 — Startup source-fraction evidence (partial read-only slice)

Base: main `dd0d608ca32e0f00a1314d1b960b5bbbbfa732a8`, after VC contract #999. The shared identity and P3-5/P3-6 adapters are merged. This is not full P3-8 completion or a second ownership authority.

`phase3VCSourceInterests.projectVCSourceInterests(rawState)` is an opt-in pure source observation, not the canonical `projectVCOwnership` contract API. Company and personal fractions stay separate. It validates unique startup source IDs, finite fractions in [0,1], combined allocation and optional DD-subset bounds. It never derives quantities, preferred rights, voting, value or current-company generation from names or fractions.

Valid current startup rows expose source fractions. A uniquely matching active, non-restructured subsidiary mirror makes the company observation relationship-only, not another asset. Personal source fraction remains personal. A contradictory/missing mirror quarantines company alias evidence. Zeroed IPO source fractions are historical only; any retained positive startup fraction with an IPO link is a conversion conflict, not another listed interest. This slice does not validate or value the listed lots.

Current-equity observations for every non-null active round remain unresolved (`PENDING_ROUND_UNVERIFIED`): no pending payment becomes current equity. A separate `roundObservations` array reports validated source terms, pre-round fractions and declared contributions without certifying payment or valuation. Dead/dormant rows without IPO evidence remain unresolved rather than assumed worthless. Full round receipts, IPO lot reconciliation, parent-generation proof, canonical identity/composition and refounding historical gaps remain follow-up work. #1027/#1029 and the 24-row receipt-retention compatibility decision remain open; this reader does not correct those writers or approve their candidate.

All outputs retain `complete:false`, `wealthComplete:false`, `commandEligible:false`, null snapshot token, canonical issuer/class/ownership key, quantity and votes. `source-matched` means only the declared raw source scope; it is not a legal registry, control eligibility, wealth amount or composer-compatible snapshot. Never feed these observations into complete wealth or voting computations by stamping a token on them. Input/output evidence contains no live source reference; output alone is deep-frozen.

The reader performs no save, normalizer, finance, RNG, clock, engine command or UI work. SAVE_KEY and saveVersion9 remain unchanged. Source/alias indexing is linear plus deterministic output sorting. Input arrays are conservatively bounded at4096 rows; unsupported input/accessors/exotic prototypes yield INPUT_INVALID without executing getters. This bound is a reader envelope, not a new writer or saved-state limit.

Focused tests reuse the production harness and installed subsidiary, funding-open/close and IPO writers, plus account separation, invalid cap tables/DD, duplicate IDs/mirrors, inherited restructuring aliases, pending/unknown lifecycle, missing old-v9 data, frozen/pure output, replay from serialized data and getter rejection. Canonical test/module wiring is included. Real WebKit/physical-iPhone and whole Phase3 completion are not claimed by these local Node tests. No runtime consumer is switched.


## Pending round source observations — 2026-11-01

Base: `289a0bd8ff5fc50e2bfa9bd96fd6c0c7d29e2967`. This extends the partial
P3-8 source observer under contract §6/§7; it is not the canonical ownership adapter,
settlement or payment reconciliation. Existing current-equity observations keep their
conservative pending-round behavior.

For an open round, `roundObservations` returns separate company/personal rows with
source IDs/paths, observed valuation terms and week window, `reportedPreRoundFraction`
and `reportedContributionJPY`. Source matching requires unique startup/round IDs,
valid current fractions, matching pre-round fractions, an active unconverted/unlisted
startup without a subsidiary mirror, finite non-negative JPY amounts in the reader's
numeric envelope, consistent pre-money + target = post-money terms, and contributions
not exceeding the target. Missing/invalid/contradictory source facts leave both account
rows unresolved with null amounts and a reason. Valuation terms may retain fractional
precision; these are source observations, not new monetary settlements.

Every row retains `paymentStatus:'unverified'`, `assetRole:'pending-capital-evidence'`,
null share quantity, voting fraction and wealth value. Retained payment receipts are
not consumed or re-certified. Source-reported contributions are not a cash asset,
recoverable claim, proof of paid-in capital or extra current shares. Closed/cleared
rounds produce no pending row. Global completeness/wealth/control flags and snapshot
compatibility remain unchanged. P3-11 does not consume these new rows.

The existing registered VC source test covers pure/frozen JSON replay, split accounts,
malformed terms/fractions/contributions/week windows, duplicate round IDs, conflicting
lifecycle/mirrors, getter non-execution, and the actual installed open/close funding
writer. No UI, save, ledger, writer, RNG, history replay or browser path is changed.
Native WebKit is not newly claimed for this pure source observation.


## Enumerable source evidence boundary

Selected root, row, alias and pending-round fields must be own enumerable data
descriptors. The reader now rejects non-enumerable selected fields with INPUT_INVALID
and no ownership/pending rows. Previously a hidden root or fraction could supply a
positive observation even though JSON object serialization omits that field. Accessors
remain unexecuted. Array elements also retain the contract's own-enumerable requirement,
including cases JSON array serialization would otherwise preserve by index.

The existing canonical source suite covers hidden roots, array elements, startup ID/
fraction/lifecycle, subsidiary alias ownership and pending contribution fields. JSON
omission cannot certify the hidden claim; independently preserved personal/company
source evidence is tested separately where appropriate. Ordinary installed writer,
frozen input and v9 JSON behavior are unchanged. This is a read-only source-validation
correction, with no writer, settlement, save/RNG, financial policy or authority change.
See the PR/#909 for RED/GREEN execution, exact final-HEAD CI and review provenance;
no new native WebKit/browser path is introduced.


## Common-index bound VC source snapshot

`economicReadModel.buildOwnershipIdentityIndex(rawState,
'player-listed-and-vc-source-v1')` extends the existing private common-index registry
with an explicit opt-in source scope. It binds selected startup lifecycle, DD fractions,
pending-round fields and subsidiary alias/competing-family markers in addition to the
player/listed identity inputs. Unrelated startup operating data is excluded. Own
non-enumerable selected fields/accessors are rejected without getter execution. Existing
player/listed and subsidiary scopes retain their narrower source contracts.

`economicReadModel.projectVCSourceSnapshot(rawState, index?)` defaults to this scope
and delegates to the existing VC source reader on the detached indexed view. The result
uses the exact common sourceSnapshotToken; foreign/forged/narrower handles, root
replacement and same-week selected-field changes fail closed without observations.
It also remains compatible with the player/listed snapshot and listed reader under the
same handle; subsidiary/PE composition requires its separate supported scope.

This connects current VC source evidence to index generation without creating another
token registry or canonical ownership positions. Observed fractions and pending capital
are still source-only; payment evidence, parent generation, legal issuer/class, shares,
votes and wealth remain unproven/null under the original reader contract. complete,
commandEligible and wealthComplete remain false. No authority, settlement, save/RNG,
consumer/UI or formal acceptance changes. Missing adapter loading fails explicitly.

The existing common snapshot suite covers shared-token composition, pending capital,
stale lifecycle/round/DD/alias/generation, foreign/copied-state handles, ignored operating
fields, hidden/accessor input, JSON/frozen output and no state/RNG mutation. Existing
VC, subsidiary composition and wealth suites remain the compatibility checks. PR/handoff
record actual final-HEAD CI and browser applicability; no native WebKit claim is implied.


## VC source composition in the common ownership snapshot

When called with the explicit VC source-scope index, projectOwnershipSnapshot now
includes vcSourceEvidence from projectVCSourceSnapshot with the same bound token,
and vcAliasLinks for the reader's unique source-matched company subsidiary aliases.
The reference link connects the company's startup fraction source to the matching
subsidiary source. A personal startup observation remains separate. A conflicting or
duplicate alias yields no supported link; source diagnostics also enter common issues.

These are source-alias-reference links only: canonical position/issuer, quantity, voting
and wealth remain null. No VC economic position is appended and no existing listed or
founder position is replaced, so a subsidiary alias cannot become a second asset.
The separate vc-source coverage reports source observations; canonical vc coverage
remains not-implemented. Default/narrow-scope snapshots retain their existing shape.
No settlement, authority, consumer, save/RNG or UI path changes.

The existing snapshot suite proves same-token source composition, one company alias,
separate personal source evidence, missing legal/valuation authority, unchanged position
arrays, conflict/duplicate quarantine, replacement-root and stale-alias rejection,
JSON/frozen output and source/RNG purity. This source integration does not certify full
P3-6/P3-8 canonical alias arbitration or writer-family closure. PR/handoff hold the actual
checks and final-HEAD CI results.
