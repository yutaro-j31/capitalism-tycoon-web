# P3-4-005 — stock purchase save boundary

Owner authorized this separate P1 correction on #909. Base: `8184fa364525cb573602fb8f92a5b4850c55bc49` (#918). P3-4 Ownership Authority Cutover remains paused.

Installed `buyStock` previously ignored `save() === false` and emitted change outside a transaction. A rejected personal purchase of 1,000 CPTY shares returned true, changed cash from ¥2,000,000 to ¥1,899,869 and lot quantity from 20,000 to 21,000, changed average cost/quote, and survived a later ordinary save. A post-save change exception retained the purchase in mirror/cache/durable storage and fresh hydration.

The only runtime change wraps the complete existing `buyStock` body in shared `runTransaction`, delegating final save/change to its #915 checkpoint. Existing personal and company branches retain their guards, quotation/fill/fee/average-cost/accounting/RNG calculations. No private rollback, sellStock/stockSplit change, ownership activation, Phase9 settlement, save-format migration or old-save repair/deletion. `save() === true` retains its synchronous acceptance/enqueue meaning; asynchronous durable failures still use existing storage status/recovery.

## Evidence and gates

- `stock-purchase-save-atomicity-test.js`: canonical H, real installed command, direct/nested personal/company purchase, mirror refusal, admitted cache/queue refusal/throw, accepted-save/saved/change exceptions and company ledger exception. Complete live/RNG and exact mirror/cache/durable restoration; older in-flight write retained, failed queued write cancelled, monotonic sequence gap, subsequent saves/retry, independent VM hydration, repeated valid orders and weekly twin replay.
- Regression was RED on the base (`true !== false` for direct mirror refusal), GREEN with the wrapper. Prior #915–#918 tests are retained unchanged.
- `stock-purchase-save-atomicity-webkit-test.js`: production iPhone13 WebKit, actual IndexedDB transaction completion, false and post-save exception, later saves/reload, exported IndexedDB plus fresh browser context, retry/two distinct valid orders, invalid order and persisted quantity/cash/average/quote. Registered for PR and main M&A gates; explicit engine and regression paths preserved alongside earlier triggers.
- Normal two-purchase full-state hashes match base and correction, excluding only save timestamp/sequence: personal `8e8d66fb4f509e190886b7c9014431795f266bbfd395808fd5e2606f13624cbc`, company `b338d94b676b397c853f857c10ca5cfe2437fb6164e9b388a48787661f51587c`.
- Portable isolated diagnostic: `node docs/economic-engine/reproductions/p3-4-005-stock-purchase-save-failure.cjs --assert-fixed`. Uses in-memory IDB completion and separate VM hydration, not a physical-device claim.

Independent second pass in a separate clean worktree must audit actual `origin/main...HEAD`: A scope/authorization, B installed dispatch, C normal parity, D false/exception rollback, E cache/queue/prior pending write, F sequence/flush, G reload/fresh context, H account/lot/ledger separation, I RNG/replay, J v9/SAVE_KEY/compatibility/recovery, K retained canonical tests, L PR/main triggers/browser artifacts/unchanged timeout/gates. This is a separate same-agent pass, not an external reviewer claim.

Local browser binaries are unavailable; no local WebKit or physical-iPhone PASS is claimed. All applicable PR checks and actual GitHub WebKit must finish successfully before merge. Verify main CI/WebKit after merge. Final PR/head, review, merge SHA and Gate evidence are recorded on #909; skips are excluded from PASS.

Related sellStock/company-sale/stockSplit paths are read-only audit candidates. Their source patterns alone are not proof of an additional confirmed runtime defect; no broader fix is included. Resume writer preflight only after this correction completes; stop for any newly confirmed P0/P1 per Owner.
