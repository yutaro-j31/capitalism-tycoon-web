# VC-SECONDARY-SALE-ATOMICITY-001 remediation evidence

Base: `ec0a1dff34d18c3feccc8c3911abf4cb57941c0d`.
Diagnostic PR: #933, HEAD `4bf018bac05475083a0dd8225e9ac1a804c7c71f`.
Tracking: #922 / #909. The owner explicitly approved this standalone P1 correction and merge only after all applicable gates pass. Ownership Authority Cutover remains stopped.

## Production boundary

Only `sellStartupSecondary()` in `js/expansion.js` changes. Its existing validation, preview/pricing, company ledger acceptance guard and transaction identity, cash/ownership/basis/DD updates, and notification now execute inside existing `runTransaction()`. Direct save/emit delegate to its existing commit/checkpoint. No new rollback, compensating save, persistence mechanism, migration, RNG consumption, or other economic writer changes.

## Original diagnostic RED to permanent GREEN

The exact #933 executable probe was rerun in a separate base checkout, without fixture changes: exit 1. Both accounts returned true despite `save() === false` and retained economic changes:

| Account | Cash increase | Selected stake | Cost basis | Company ledger delta |
| --- | ---: | --- | --- | ---: |
| Company | 3,927,225 yen | 0.058823529411764705 → 0 | 5,000,000 → 0 | +1 |
| Personal | 3,809,068 yen | 0.058823529411764705 → 0 | 5,000,000 → 0 | 0 |

The original assertions and fixture are retained as `tests/vc-secondary-sale-save-false-red-probe.js`; only its diagnostic-only header changes. It passes after the fix: false result, zero cash/ledger deltas, full live and mirror equality, unchanged RNG, both accounts. It is registered in canonical runner/shard D.

## Permanent fault and normal-path coverage

`tests/vc-secondary-sale-save-atomicity-test.js` uses existing save/IDB injection helpers. There are 28 failure scenarios (14/account): save=false, mirror SecurityError, enqueue=false, throw after admission, throw after accepted save, saved/change/notify exceptions; prior physically in-flight successful IDB write with save=false/save-throw/saved/change/notify; nested transaction change exception.

Every case asserts exact full live rollback (including both cash accounts, both stakes, cost bases, DD buckets, ledger, news and RNG), exact mirror/cache/durable bytes, no failed put, predecessor preservation after release/flush, production reload, fresh durable-only VM hydration, and a later healthy save/flush/hydration. SaveSequence must advance only with the healthy save.

Normal/refusal coverage includes company/personal separation, shared holders, plain/DD/mixed-DD/legacy missing bucket/positive-profit positions, sale price and accounting effects, event order notify→saved→change, one commit save, same-week reinvestment/resale with unique ledger keys, duplicate refusal, invalid target/status refusal, company ledger refusal, finance validation, save key and version 9.

`tests/vc-secondary-sale-save-atomicity-webkit-test.js` runs actual WebKit 26.5, iPhone 13 emulation, and real IndexedDB. It covers 32 scenarios (16/account): 13 fault variants including notify, prior pending successful saves, and nested change; three normal mixed/DD/legacy variants. It checks live/mirror/cache, actual durable bytes and actual put count, flush, production load, page reload, and separate browser-context durable-only hydration **before and after** a later healthy save. Browser contexts are independent; localStorage is removed from transferred storageState, retaining the real IndexedDB database.

Node uses a fake IndexedDB with a held physical in-flight request. WebKit uses actual IndexedDB and a preceding enqueue in the same task; it does not claim a physically held in-flight browser request.

WebKit is registered in `test-execution-registry.json` and both PR deal-room and main comprehensive M&A workflows. Path/command contracts retain existing coverage and explicitly require the new paths/commands. No timeouts or skips were added. Shard contract-only execution verifies routing, not actual suite execution.

## Normal pre/post parity

The same test was executed against the original production implementation before editing and again after editing, using 10 account×variant fixtures. Full first-sale and multiple-sale/reinvestment live state, persisted state, saveSequence, notify/news, ledger identities, events and save counts are identical. The only excluded value is wall-clock `lastSaveDate`.

Normalized parity SHA-256: `c44f15d27358796f09884fe3564f05e3744f46158b82e18e9ed1d98be581b587` (both sides).

## Local validation and completion gates

The original probe and permanent Node matrix pass. Phase 0.5 smoke CLI, Phase 1 CLI and Phase 2 smoke CLI pass. Focused VC/DD/secondary integrity, ledger/accounting/RNG, transaction, save compatibility/v9 and shared checkpoint tests are executed alongside registration, shard routing, syntax/static and workflow contracts. Exact final clean-checkout audit, final WebKit result, related VC suites, PR/main CI outcomes and merge SHA are recorded in the correction PR and #922/#909, not inferred from this pre-PR document.

Local WebKit runs use the pre-existing extracted host libraries and `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` to bypass only the static host dependency check. Actual browser launch, every test assertion, every IndexedDB operation and all scenarios execute. CI retains normal pinned Playwright 1.61.0 installation and host validation.

Unverified/nonapplicable: physical iPhone hardware, full inventory of unrelated writers, long-run VC strategy/balance recalibration, nightly/deep Phase 0.5 tiers. These are not labeled PASS. Existing normal integrities and smoke acceptance are distinct from fault atomicity. Diagnostic #933 remains unmerged until correction merge, post-main gates and evidence migration are verified.
