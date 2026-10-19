# P3-4-007 stockSplit save atomicity correction

Base main: `fbfdccdbdbee8f98aa7d6cbef3ec7e411e48ddc7`. Specific [Owner correction authorization](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/909#issuecomment-6071034348). PR/final-head CI and independent checkout results are recorded on #909/#922 and the correction PR. No merge authorization is inferred from correction authorization.

## Scope

The only production change is `js/expansion.js::stockSplit`: wrap the complete existing validation/calculation/quantity/history/news/notification work in existing `runTransaction`, remove direct save/emit, and use its outer commit and #915 common storage checkpoint. No new rollback, compensation, backend, schema, migration or authority adoption. #921's object/numeric history adjustment remains byte-equivalent. PE Exit and proposed policy PRs #935/#936 are not incorporated.

Actual UI `js/app.js:920` invokes this installed method directly with ratio 2. Source search finds one installed stockSplit declaration and no alternative production split helper. Tests load the full production order and execute that final method; WebKit executes the API in the actual page. A physical button tap is not claimed.

## RED → GREEN and permanent execution

[Structured evidence](P3_4_007_STOCK_SPLIT_ATOMICITY_EVIDENCE.json) preserves original RED economics/storage/hydration results, all final WebKit case results and log hashes. The old portable probe was retrieved from immutable evidence commit `e5449eb558e5036e02daa5e566ed10a485145dc9`; on current main its `--assert-fixed` returns 1, and after correction returns 0. The new permanent Node and actual WebKit scripts both fail on current main with save=false returning true (injection reached), then pass after correction. RED is failure evidence, never PASS.

Node: 44 fault cases (own/external × direct/nested × nine failures, plus four held in-flight predecessor failures per family), four healthy parity cases, and private-company refusals. Failures: save=false, save-before-admission throw, mirror SecurityError, enqueue false/throw after admission, accepted-save throw, saved/change/notify exceptions. Full live state/news/history/finance/RNG, exact mirror/cache/durable bytes, queued-put cancellation, prior accepted write retention, flush, production load, fresh durable-only VM, healthy recovery save and successful retry are asserted. Fake IndexedDB is not a real browser database.

Actual WebKit 26.5 / local Playwright 1.62.1 / iPhone13 emulation: 36/36 PASS (32 fault and four normal cases), actual IDB availability and baseline exact bytes asserted. Both issuer families, save/event/enqueue faults, nested calls, same-task preceding pending write, full live/mirror/cache rollback, real durable put counts/bytes, flush, reload, separate contexts seeded from IDB with localStorage removed, original live-engine recovery save and repeat hydration are covered. Browser pending is not Node's physically held request. CI retains its existing pinned Playwright 1.61.0; no timeout changes. Static local host validation bypass was used with the previously prepared browser libraries; launch and actual IDB assertions still execute.

Canonical Node registration: `tests/run-all.js`, shard D in `tests/run-all-shards.json`. WebKit registration: independent `stock-split-atomicity` job in existing `ma-acquisition-financing.yml`, on every event including PR/main, existing path filters, plus `test-execution-registry.json`. Initial serial registration passed all 36 split cases in CI but added about 5m26s to the existing 15-minute PR M&A job, which later cancelled during VC regression. Only this new command is assigned its own bounded 15-minute job; existing M&A commands, conditions, budgets and assertions remain intact. Pin Playwright 1.61.0, require real WebKit/IDB, and retain separate artifacts; no test cases or assertions are removed. Existing strict path contract is extended to enforce the new job and all prior contracts. Shared existing test injector/fake IDB is reused; no common harness implementation is added.

## Normal parity / compatibility

Exact before/after comparison on four own/external × current/legacy-history fixtures covers three repeated valid splits (2,2,3), both account lots, nonzero treasury, subsequent company/personal buys and sells, full economic state, stored fields except wall-clock lastSaveDate, saved sequence, events, save count and host RNG draws. Each split independently asserts inverse prices/averages, multiplied shares, unchanged book value/cash/journal/RNG, preserved history week/metadata and unrelated issuer/account state. Existing #921 history regression also covers numeric compatibility and mixed trade/week deterministic replay.

Repeated valid splits remain distinct operations; this API has no replay key. This correction does not introduce duplicate suppression or change the numeric eligibility policy. Existing missing-stock/ratio<2/private-own-company refusals are covered. SAVE_KEY/v9 and all save migration/load code remain unchanged; related save compatibility and Phase 0.5/1/2 gates are executed separately.

## Completion boundary

Scoped correction Gate requires final-head canonical/real-WebKit CI and clean-checkout diff audit. Latest main/conflicts must be checked before any authorized merge. Main post-merge tests are not claimed while PR remains unmerged. Track A issuer-family completeness, bypass/replacement adoption contracts and known PE Exit P1 remain separate blockers. Ownership Authority Cutover remains STOPPED.
