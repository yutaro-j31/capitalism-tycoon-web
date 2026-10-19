# P3-6 first slice — direct subsidiary relationship evidence

Status: partial pure/read-only implementation. Uses the shared contract #995 and
P3-6 contract #997; #997 adoption remains a merge prerequisite, not implementation
evidence. This PR depends on the P3-5 stack through #1021. No P3-6 completion,
Phase 3 F Exit, writer adoption or Phase 4 Entry is declared.

## API and bounded evidence

`economicReadModel.projectSubsidiaryRelationships(rawState, optionalIndex)` reads
raw JSON ownership data. An omitted index builds the shared identity index with
scope `player-listed-and-subsidiary-ownership-v1`. Explicit callers use
`buildOwnershipIdentityIndex(rawState, scope)` with that exact scope. A default
player/listed-only index, forged handle, foreign raw object or same-object source
mutation is rejected. Existing default player/listed APIs and shapes are retained.

The extended selected source view captures only the subsidiary/deal/venture/PE
identity, ownership and lifecycle fields used by this reader. It does not copy
full histories, cash, ledgers, valuation or PE fund books. Token validation is
scoped evidence, not proof of a complete financial/wealth snapshot.

Returns frozen `relationships`, source refs, structured reasons and coverage.
`positions` and `classes` are empty: a hierarchy relationship is never an extra
beneficial asset. `complete` and `commandEligible` remain false. No voting fraction,
security class, ownership key, NCI, inherited control or personal ownership of
company assets is inferred. There is no UI/engine consumer replacement.

## Implemented sources

- Unique durable subsidiary ID plus explicit finite 0..1 economic ownership is
  source-scoped direct evidence. First-company generation with explicit isCompanySold=false is required to
  label a relationship current; missing/later generations retain only an observed
  subtotal/source fraction and an unknown parent binding.
- Installed M&A whole-target evidence requires unique acquired deal, matching
  target ID and stable key, accepted supported method, matching close/acquired week,
  no still-live acquisition target/stable-key claimant, no duplicate target/deal stable
  keys, and no contradictory explicit ownership ratio.
  Legacy rows or commercialization spinouts without retained provenance remain
  unknown. Price, valuation, goodwill and collection membership prove no fraction.
- Internal venture spin-offs require unique reciprocal venture/sub links and a
  spun-off venture source. Competitor acquisition IDs remain explicit historical
  provenance even after the target competitor has been removed.
- Sold/liquidated/exited/inactive/written-off relationships are historical, not
  current assets. Unknown statuses and conflicting/duplicate IDs or alias claims
  are quarantined. Present malformed source inventories return explicit invalid
  evidence without silently treating them as empty.
- Startup and PE mirror claims are observed but remain aliases pending separately
  implemented P3-7/8 canonical source composition. Available reciprocal evidence is
  checked for contradiction; it never creates a second asset. Parent PE-fund
  conversion claims likewise remain unsupported here.
- Restructuring replacements are explicitly unsupported in this first slice.
  Copied predecessor alias fields do not establish replacement identity; live
  predecessor overlap quarantines both claims. Overseas source rows remain visible
  with unknown ownership/class/rights, never an assumed 100% relationship.

## Tests and remaining work

Focused tests cover strict fractions/status, lifecycle, actual installed open and
close wrapper output (accepted terms prepared by the existing fixture), legacy
missing linkage, alias and duplicate quarantine, source/RNG/storage purity, frozen
outputs, already-frozen inputs, stale/forged/foreign indexes, v9 JSON reload and
installed v9 save/load. Existing harness and M&A
fixture are reused. Fixture accepted terms are not a full seller-negotiation play
claim. Tests are registered in canonical run-all and shard K.

This is not full P3-6 canonical hierarchy integration. PE/VC canonical adoption,
fund conversion composition, validated restructuring lifecycle and indirect/cyclic
path diagnostics remain separate dependency-ready slices. No NCI/control or wealth
is calculated. These functional omissions are not relabelled Stage Q. Only broad
unrelated audits, mass seeds, century/scale campaigns and calibration move to Q.

Merge order: #995 -> #996 -> #1019 -> #1020 -> #1021 -> this PR, with #997 adopted
before this implementation is merged. New implementation merge approval is not
inferred. Writer/cash/accounting/save-v9/RNG remain authoritative in existing modules.
