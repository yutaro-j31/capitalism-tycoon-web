# P3-7 legacy direct PE ownership evidence slice

Base: `51279ffd` (P3-6 direct relationships). Partial opt-in Stage F implementation;
#998 remains a proposed contract and must be adopted before eventual merge. This
slice grants no merge permission, authority cutover, Phase Exit or new valuation.

`economicReadModel.projectPEOwnership(rawState, optionalIndex)` reads legacy
`peDeals` and reciprocal company subsidiary mirrors. The optional index must be
from `buildOwnershipIdentityIndex(rawState,
'player-listed-and-subsidiary-ownership-v1')`, the exact same source object and
unchanged selected source view. Output carries its transient sourceSnapshotToken.
No new index scope or saved data is introduced.

Each current direct PE row returns a position with positionId, sourceDealID,
issuer, registeredHolder, beneficialOwner, accountKind, sourceRefs and reasons.
Only explicit personal/company ownership, unique source IDs, active lifecycle and
valid 0..1 ownershipRatio can establish economicFraction. Company positions also
require a unique reciprocal deal.subsidiaryID/subsidiary.peDealID mirror, active
status, exact matching fraction, no conflicting provenance/restructuring and a
supported first nonsold company generation. Missing historical generation proof
stays unresolved. Legacy missing/unknown ownerAccount is never assumed personal.

An accepted position has assetRole `economic-interest`. It remains source-scoped
and has no legal class, share quantity, voting units or ownershipKey. This is
source economic evidence, not control or wealth authority. Duplicate/malformed
identity, unknown status/owner, bad fractions and alias conflicts produce null
fractions and unresolved positions. Exited rows are historical, never assets.
Source paths locate diagnostics; array indexes never manufacture issuer IDs.

`aliasReplacements` contains `{sourcePath,positionId,sourceDealID,
resolvedByAdapter}` only for accepted reciprocal company mirrors. The source path
is the exact `subsidiaries[i]` path; its position sourceRefs includes an alias-role
reference. P3-6 composition may point a matching relationship at this PE position,
but must not add another economic asset. Duplicate subsidiary IDs across
subsidiaries, maSubsidiaries and overseasSubsidiaries block the mirror claim.

Complete, commandEligible and wealthComplete remain false. Fund/LP/GP interests,
co-investment, carry, fund-to-parent conversions, valuations and full-family
composition are explicitly not implemented. currentValuation is not read or
recalculated: existing direct PE values already represent the owner's stake.

The adapter uses descriptor-safe selected capture and the existing broad scope;
it calls no normalizer, preview, settlement, save, notification, RNG or clock.
Output is newly allocated and deeply frozen. Existing readers/writers retain
their behavior. Save key/version9, transaction and IndexedDB boundaries are
unchanged; no UI consumer is switched.

Focused tests cover mixed accounts, exact fractions, reciprocal mirror mapping,
unknown owners/generations/status, malformed/duplicate IDs, both duplicate row
orders, conflicting provenance, cross-root subsidiary ID collisions, stale/forged
indexes, getters, source purity, frozen outputs, JSON-v9 roundtrip and installed
create/transfer/exit lifecycle observations. Existing relevant permanent tests
remain registered; broader Stage Q campaigns are separate work.
