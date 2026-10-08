# P3-4-004 — Founder secondary sale save/rollback correction

Tracker: #909, finding comment6059904114; contextual Owner go-ahead recorded in comment6067086615. Base: `68b8e56c0c9e437c1eefb02b5118ed5620b7e08f` (#917).

## Cause and reproduction

Installed `sellFounderShares` decrements original founder shares, credits personal cash and records sale history, then ignores save rejection and emits outside an economic transaction. There is no later wrapper on the app's direct call. A valid listed-company fixture with price100, founder600,000, issued1,000,000 and personal cash¥2m sells1,000 shares for¥99,500. Mirror SecurityError returns true and leaks the live sale, which a later save persists. A post-save change exception leaves it immediately in mirror/cache/durable IDB and fresh hydration. Company cash, company debt and corporate receipts stay unchanged.

[Isolated diagnostic](reproductions/p3-4-004-founder-sale-save-failure.cjs) prints observations by default; exit zero is not a safety verdict. `--assert-fixed` is RED on the base and GREEN on the correction. It uses production load order with a valid public-company fixture, not an actual IPO or real player storage.

## Boundary

Enclose the unchanged complete founder-sale body in existing `runTransaction`, delegating final save/change to the common #915 checkpoint and #916/#917 command pattern. Save rejection returns false; exceptions propagate after rollback. No bespoke rollback, new storage authority or asynchronous transaction protocol. The original quantity guard, floor, .995 proceeds formula, history, ratio calculation and notification remain unchanged. Original founder shares and separately purchased personal lots stay distinct; secondary proceeds never enter the company ledger. Repeated valid sales are distinct actions: no new idempotency key or rejection of legitimate subsequent sales.

Common synchronous checkpoint restores full live/RNG state and exact prior mirror/cache/queued writes before yielding. Earlier accepted in-flight writes remain valid; failed new queued writes are cancelled and attempted sequence gaps are not reused. `save() === true` means accepted/enqueued, not completed asynchronous durable I/O. Existing flush/status/error, IDB authoritative boot, quota/recovery and old-v9 semantics remain unchanged. SAVE_KEY and saveVersion9 are unchanged. No old-save repair, deletion, ownership cutover or Phase9/10 settlement change.

## Verification

Canonical H regression exercises installed direct/nested calls, mirror rejection, partial enqueue false/throw, accepted-save throw, saved/change exceptions and ratio-update exception. It checks full live snapshot/RNG and exact storage rollback, flush/fresh independent hydration, later saves, retry, invalid commands, consecutive legitimate sales, older pending writes/sequence gaps and deterministic weekly replay. Nonzero separately purchased own-company lot, company cash/debt/issued/treasury and corporate ledger are preserved.

Real iPhone13 WebKit regression exercises actual IDB transaction completion, mirror/change faults, full live/prior storage bytes, consecutive save/reload, exported IDB/mirror into a fresh browser context, successful retry and second valid sale. Wired into both M&A PR/main jobs with explicit new regression path triggers. Existing #915/#916/#917 tests and their browser commands remain unchanged. No physical-iPhone claim.

Required completion: related founder/investor/M&A/save/P0.5/P1/P2 tests, syntax/static/registration/shard/path/timeout checks, normal full-state parity, separate clean-worktree actual origin/main...HEAD A–L audit, all applicable final-head PR checks and actual WebKit, conditional merge, main checks/WebKit and evidence on #909. Skips are not PASS. This document is not completion evidence or whole-family certification. Ownership Cutover remains paused; refresh main before resumed read-only writer investigation and stop for newly confirmed P0/P1.
