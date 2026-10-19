# P3-6 — bounded direct PE/subsidiary composition

Partial pure read-only slice. Depends on #1022 and the P3-7 direct PE adapter
#1023; #997 and #998 contract adoption are merge prerequisites. Neither dependency
is treated as already merged merely because this branch contains its code.
Separate Owner merge approval remains required.

`projectSubsidiaryOwnershipSnapshot(rawState, optionalIndex)` uses one shared
`player-listed-and-subsidiary-ownership-v1` index to compose the existing
player/listed snapshot, direct subsidiary relationships and legacy direct PE
positions. The default `projectOwnershipSnapshot` and its output remain unchanged.
Forged/foreign/narrow/stale indexes fail closed; raw JSON descriptors are inspected
before reading and no engine instance or mutating helper is used.

Each PE source position appears once. An exact accepted reciprocal mirror mapping
replaces its P3-6 alias with one relationship referencing that canonical position;
the relationship is never an additional asset. `sourceReplacements` maps economic
source buckets to positions, while `relationshipReplacements` maps subsidiary
mirrors to hierarchy edges. These separate roles are not additive totals.

The composer does not accept caller-authored adapter evidence. It derives all
three inputs from the same source token, checks source path, PE source ID, legal
company holder, active status and exact observed fraction, and requires no
additional contradictory relationship reason. A hierarchy conflict (including a
live restructuring predecessor overlap) quarantines the PE economic claim as
well as its edge, even if local PE reciprocity by itself was valid.

Personal PE positions remain personal. A company PE stake never becomes direct
founder ownership or a look-through founder asset. Existing founder initial and
purchased shares and separate personal/company listed lots pass through unchanged.
Source-scoped issuer identities are not legal voting evidence. Class, quantity,
voting rights, ownershipKey, wealth total and valuation are not invented.

`complete`, `wealthComplete` and `commandEligible` remain false. Canonical VC,
fund conversions/LP/GP/co-investment, validated restructuring replacement and
indirect/cyclic graph diagnostics remain functional work, not Stage Q omissions.
Existing unresolved/historical rows stay visible; no unsupported relationship is
promoted merely because another source has the same amount or name.

Tests reuse the existing harness and cover mirror replacement without another
asset, separate owners, inherited founder/listed rows, unknown rights, malformed
or duplicate/lifecycle/owner conflicts, composition-only restructuring conflict,
source-token invalidation, no getters, frozen outputs, source/RNG purity and v9
JSON reload. Canonical run-all and shard K registration are additive.

No cash/accounting/save schema/Writer/RNG/UI/settlement changes. SAVE_KEY and
saveVersion 9 remain intact. New API is opt-in; P3-4 cutover, executable P3-10
commands and Phase 4 production Entry are not enabled. This slice does not claim
P3-6, P3-7 or Phase 3 Functional Complete. Broad unrelated campaigns remain Q.
