# Phase 5B-4 terminal competitor compatibility

## Scope

This follow-up hardens the merged competitor distress lifecycle without replacing its state machine. It addresses three compatibility gaps found while auditing bankruptcy and old saves.

## Static market fallback retirement

The detailed competitor engine can correctly return no offer for an inactive or bankrupt company. The market engine also retains a legacy static competitor fallback for businesses not handled by the detailed engine. Without an explicit retirement marker, that fallback can recreate the same failed company as a static offer.

When a detailed competitor reaches `inactive` or `bankrupt`, the matching legacy seed record now:

- keeps its original ID and `businessID`, preserving migration matching;
- stores its original area in `archivedAreaID`;
- moves to `__inactive__` or `__bankrupt__`;
- sets stores to zero and records the terminal lifecycle status.

This removes the failed company from market pressure without causing the version-8 competitor migration comparison to recreate it.

## Legacy event preservation

Older saves may contain string entries in `competitorEvents`, while the new lifecycle writes structured event objects. The underlying lifecycle normalizer accepts structured objects only. The compatibility layer captures the original array, normalizes the new state, then merges both formats with stable deduplication and a 160-entry cap.

Both old string events and new operation-ID events therefore survive normalization, weekly processing, bankruptcy, and save reload.

## Project cancellation reason propagation

A skipped action can be converted into a failed project before the lifecycle layer records why it was cancelled. The compatibility layer synchronizes `lifecycleFailureReason` or `cancellationReason` to the linked project after normalization.

- Bankruptcy produces the stable project reason `bankruptcy`.
- Other lifecycle cancellations preserve their explicit reason text.
- Spent cost remains zero.

## Release gates

- terminal detailed competitors cannot reappear through the static market fallback;
- legacy competitor IDs and business IDs remain unchanged;
- old string and new structured competitor events coexist without duplication;
- skipped lifecycle actions and linked projects share the correct terminal reason;
- repeated normalization is idempotent;
- validation is read-only;
- save version remains 9 and `SAVE_KEY` remains unchanged;
- all existing save, market, finance, supply, workforce, competitor, RNG, and long-run tests remain green.
