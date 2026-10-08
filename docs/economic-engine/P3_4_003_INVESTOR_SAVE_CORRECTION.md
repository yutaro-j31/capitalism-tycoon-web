# P3-4-003 — Investor acceptance save/rollback correction

Tracker: #909. Owner authorized 2026-10-08 19:51 JST. Base: `e90794857e42adc8519b06de3c333ceb5de21a71` (#916).

## Reproduction and cause

The final installed `acceptInvestorOffer` in `expansion.js` changes issued shares, company cash, equity receipts/capital surplus and offer status, then ignores `save() === false` and emits outside an economic transaction. The app dispatches directly to this method. The earlier shared storage correction prevents rejected mirror writes from reaching IDB, but cannot undo this caller's uncontained live mutations.

An actual cheapest-office contract and generated investor offer under deterministic seed 934003 produce consideration ¥984,184, issued shares 10,000 -> 11,184, company cash ¥8,546,000 -> ¥9,530,184 and one investor equity receipt. A one-shot mirror SecurityError still returns true and leaves the changes live. A subsequent ordinary save promotes them to durable storage. An exception in the final change emission after accepted save leaves them in mirror/cache/durable IDB immediately. Fresh independent context hydration reproduces both outcomes. Personal cash and company debt stay unchanged.

The isolated diagnostic is [reproductions/p3-4-003-investor-save-failure.cjs](reproductions/p3-4-003-investor-save-failure.cjs). Default execution prints observations and its exit zero is not an acceptance verdict. `--assert-fixed` is RED on the base and must be GREEN on the correction. No real player storage is read or modified by this harness diagnostic.

## Correction boundary

Enclose the complete existing acceptance body in common `runTransaction`. Remove its inner direct save/change calls and let the existing outer transaction perform one accepted final save and change event. This reuses #915 synchronous storage checkpoints and the #916 command-boundary pattern; there is no bespoke rollback engine. Rejection returns false; throws preserve existing exception propagation after common rollback.

Existing missing/public/expiry guards, share issuance/dilution formula, accounting source/idempotency key, company/personal separation, capital surplus, status fields and success notification remain unchanged. Nested outer transactions defer persistence to their enclosing boundary. Common transaction restores live/RNG state and exact prior mirror/cache/queued-write checkpoint before yielding. Earlier accepted in-flight puts are retained; failed new queued puts are cancelled, and attempted save sequences are not reused.

Synchronous `save() === true` means accepted/enqueued, not completed asynchronous durable I/O. Existing flush/status/error and authoritative-boot recovery semantics remain unchanged; this correction adds no distributed asynchronous storage transaction guarantee. Preserve SAVE_KEY, saveVersion 9, old saves and existing compaction/quota/load rules. No old-save repair, deletion, registry, ownership capability, market or M&A settlement migration.

## Verification contract

- New canonical H regression uses installed direct and nested acceptance. Covers mirror denial, partial enqueue false/throw, accepted-save throw, saved/change emission throw and journal-post throw; exact complete live snapshot/host RNG plus mirror/cache/durable bytes; independent fresh hydration; retry/duplicate; consecutive saves; earlier in-flight put and sequence gaps; failed/retry versus normal deterministic weekly replay. Successful amount/shares/receipts/account separation remain characterized by the existing investor-offer suite.
- Actual iPhone WebKit regression contracts office and generates an offer in the production app, injects mirror/change failures and reads real IDB after transaction completion. Verifies full live/prior bytes, consecutive saves, reload, exported real IDB/mirror state into a new browser context, successful retry, duplicate guard and successful reload. Registered in the existing M&A PR/main WebKit jobs; existing #915/#916 regressions remain unchanged.
- Related investor/M&A/save/transaction/P0.5/P1/P2 tests, syntax/static/registration/shard checks, normal full-state parity, independent actual origin/main...HEAD A–L audit and all applicable PR/main CI are required. A skipped check is not execution evidence. No physical-iPhone claim.

Completion evidence, PR/merge SHA and actual executed CI/WebKit logs belong on #909 after Gate PASS and post-merge verification. This document alone is not a completion or whole-family ownership atomicity attestation. P3-4 remains incomplete; after correction refresh main and resume systematic read-only stock/issuance-writer investigation, stopping on newly confirmed P0/P1 per Owner instruction.
