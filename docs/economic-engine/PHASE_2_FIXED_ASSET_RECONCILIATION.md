# Phase 2 Fixed-Asset Reconciliation

**Slice:** P2-5 — Fixed asset acquisition / investing cash flow
**Tracker:** #890
**Issue:** #906
**Base main:** `472107016d2e8b8012afbe3dd86af8a222dd23d7`

## Scope

P2-5 hardens the existing standalone `finance.fixedAssets` lifecycle without replacing the production writers.

Covered writers are:

- store-opening equipment in `engine.js::openStore`;
- store-equipment upgrades in `store-equipment.js::upgrade`;
- vertical-integration capex in `expansion.js::addVerticalIntegration`;
- self-built property buildings in `engine.js::buildOnLand`;
- weekly fixed-asset depreciation in `finance.js::recordWeekly`;
- store fixed-asset disposal in `finance.js::disposeFixedAsset`;
- linked constructed-building disposal in the existing property-disposition settlement.

This slice does not migrate broad real-estate construction-in-progress, PE/VC, public securities or other asset families into a new authority.

## Forward-only adoption

Existing saveVersion-9 fixed assets are adopted at their current book state.

Each adopted asset records:

- opening accumulated depreciation;
- opening book value;
- current status at the P2-5 adoption boundary.

P2-5 does not fabricate historical acquisition or depreciation receipts. Only an absent adoption boundary initializes old-save evidence; malformed metadata fails the gate rather than being reset.

Assets created after adoption are marked `recognized` and require a valid linked acquisition event before the permanent close can pass.

## Acquisition contract

A newly recognized fixed asset must have exactly one linked capitalization event.

The event must prove:

- finite positive acquisition cost;
- initial book value = acquisition cost;
- accumulated depreciation = 0 at recognition;
- `category = capitalExpenditure`;
- `cashEffect = -acquisitionCost`;
- `assetEffect = +acquisitionCost`;
- `profitEffect = 0`;
- investing-cash-flow classification;
- deterministic fixed-asset identity / idempotency.

A second capitalization for the same fixed asset is rejected.

## Depreciation contract

Each post-adoption depreciation row carries before/after book evidence.

It must be:

- non-cash;
- P&L expense only;
- equal asset reduction;
- linked to exactly one active fixed asset;
- consistent with accumulated depreciation;
- consistent with the straight-line schedule and salvage floor.

The permanent gate proves:

`opening accumulated depreciation + recognized post-adoption depreciation = current accumulated depreciation`.

Disposed assets are excluded from future depreciation. Live receipt counts and amounts reconcile against archived counts and amounts in both the 5,000-row runtime compactor and every quota profile. The per-asset week watermark prevents replay after archival. A cent discrepancy fails; the comparison epsilon only accommodates numeric representation noise.

## Disposal contract

Store closure now disposes every active fixed-asset layer attached to the store, including later equipment upgrades.

A disposal event records the linked fixed-asset IDs and their pre-disposal book values.

For linked property buildings, the existing property sale event remains authoritative and may also include land/other property book value. P2-5 verifies that the event removes at least the full linked fixed-asset book value without creating a second sale.

After disposal, every linked fixed asset must have:

- status `disposed`;
- book value 0;
- one recognized disposal identity;
- no later depreciation.

## Transaction safety

The store-opening, equipment-upgrade, vertical-integration, construction and store-closure writers use the existing engine transaction boundary. A rejected receipt restores cash, asset state, ledger state and RNG and leaves durable save bytes unchanged. The property-disposition transaction remains authoritative.

## Investing cash flow

P2-5 does not create a new Cash Flow statement category.

It proves that recognized fixed-asset acquisitions and disposals use the existing investing categories, so the existing `INVESTING_CATS`, weekly snapshots and archived investing cash flow continue to be the sole statement classification path.

Acquisition is capitalization only and cannot simultaneously be expensed.

## Permanent close gates

P2-5 adds:

- `P2-ASSET-FINITE`
- `P2-ASSET-ACQUISITION`
- `P2-ASSET-BOOK`
- `P2-ASSET-DEPRECIATION`
- `P2-ASSET-DISPOSAL`
- `P2-ASSET-INVESTING-CF`
- `P2-ASSET-DUPLICATE`

These run inside `standaloneClose()` and therefore also flow into `finance.validate()`.

## Compatibility

P2-5 preserves:

- `SAVE_KEY = capitalism_tycoon_web_v1`;
- `saveVersion = 9`;
- deterministic simulation and RNG draw order;
- company/personal cash separation;
- Phase 0.5 / Phase 1 permanent gates;
- P2-1 cash close, P2-2 debt, P2-3 dividend and P2-4 buyback reconciliation.

No balance tuning or UI redesign is included.

## Exit

P2-5 is complete when the five P2-5 items in #890 are directly enforced, P2-GAP-003 is recorded as resolved, focused and canonical CI are green, the exact `origin/main...HEAD` diff receives a PASS audit, and the implementation PR is merged.
