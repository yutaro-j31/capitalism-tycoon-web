# P3-4 partial captured acquireTarget evidence

Baseline main: `636186e76c17186e9b9a8915515028f4b2cdf767` (after #1239).
Latest-main validation: `d10a971eb99fb4111fd3a169ba9c34ccb7a81971` (WorkB #1240 preserved).
Caller-rejection follow-up baseline: `d20e5f0a08f73b7babbb8a56346773cba2689789` (after #1241).

The registered `tests/ma-share-swap-ownership-ratios-test.js` retains its installed deal-room, legacy functional
and raw-issuance cases. Five added cases capture the original engine `acquireTarget` prototype body and invoke
it only within an explicit existing `runTransaction`. A trap on the installed instance method prevents a silent
substitution of the compatibility/deal-room wrapper. `W-ACQUIRE-COMPAT` remains `INTERNAL_ENTRY` in the planner.

The existing fixture pins an80M target, shareSwap premium1.08 and own price1,000: noncash acquisition86,400,000,
new external shares86,400, goodwill6,400,000 and identifiable book80,000,000. Founder700,000, treasury50,000 and
competitor190,000 quantities stay fixed; external quantity60,000 becomes146,400. The own-market issued/cap mirror
agrees immediately. Company/personal cash, debt and stock lots remain unchanged. Exactly one existing acquisition
receipt and one capital receipt carry zero cash effect and the independently pinned asset/equity amount.

Normal, save-false and actual admitted-save-throw cases prove full predecessor rollback, no rejected durable put,
production reload/fresh durable-only fake-IDB, and retry equal to the uninterrupted economic state. Existing
goodwill ID allocation is retained; random-stream seed/state/draws and host RNG are unchanged. Failed state includes
the ID counter in the full rollback oracle. A consumed target cannot be acquired again or generate another save.
Finance validation runs on a copy so its derived statement/validation caches do not contaminate the reload oracle.

Two caller-rejection cases additionally require that the captured body return true and issue all86,400 shares
before the outer caller returns false or throws. Its deferred internal save requests must not survive that
refusal: the same full predecessor/storage/ID-counter oracle, fresh hydration, healthy retry and replay checks apply.

This covers the captured body inside an existing caller transaction, not standalone compatibility calls or an
installed authoritative adoption route. The legacy body leaves deal-room lifecycle records unchanged; this is not
evidence of deal-room closing, financing or PE/network hook closure. M&A OptionB and all installed writers remain
unchanged. No new transaction/rollback framework, economic policy or settlement authority is introduced.

Partial Node/fake-IDB only: not all helper/caller/fault/compaction/browser paths, native WebKit or physical iPhone,
whole-family S_PASS, Authority Cutover, Phase3 formal Exit or Phase4 Entry. SAVE_KEY/saveVersion9, old-save loader,
production, test registration, WorkB CI/runner/config/workflow and vNext are untouched.
