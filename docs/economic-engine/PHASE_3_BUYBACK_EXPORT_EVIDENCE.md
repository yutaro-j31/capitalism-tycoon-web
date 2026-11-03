# P3-4 partial buyback direct-export evidence

Starting main: `0a1ed0649bbfc7c391b149a8cd3c54a4ec325eb9`.

The already registered `tests/shareholder-buyback-save-atomicity-test.js` separately invokes the existing
`modules.shareholderReturns.buyback(engine, amount)` export. The instance's installed `buybackOwnShares`
method throws if called, preventing an accidental return to the normal engine entry. The production export
continues to own its existing `runTransaction` and W-BUYBACK verification leg; no new gateway or authority is added.

The existing independent normal-settlement oracle is reused: budget ¥1,000,050 at estimate ¥100.01 buys 9,999
shares for ceilYen cost ¥1,000,000, or seven shares for ¥701 when outside float is capped. Exact company cash,
treasury quantity/book, issued mirror/market cap, founder/personal-lot separation, one reconciliation receipt,
ledger/history and persisted RNG are checked. A successful direct call commits one save. Both variants cover
save-false and post-admission save-throw with the existing shared fault harness, including complete rollback,
no rejected durable put, monotonic recovery sequence, reload/fresh fake-IDB hydration and healthy retry.
Additional ordinary cases cover nested caller rejection and an earlier pending put.

A one-share treasury mismatch introduced by `updateOwnershipRatios` must return false on the actual direct export,
restore the complete live state and mirror/cache/durable predecessor, admit no put, and pass durable-only fresh
hydration before healthy retry. This proves refusal by the verification leg, rather than merely noticing a bad
committed result in a success assertion. The original installed-command cases and negative controls remain.

This scoped Node/fake-IndexedDB result is not captured `engine.js` base-method coverage, native WebKit evidence,
exhaustive direct-export discovery, whole-family S_PASS, Authority Cutover, Phase 3 Exit or Phase 4 Entry. No new
physical-iPhone claim. Production writers, economic policy, saveVersion9, test registration, Work B CI settings,
runner/workflow/config contracts and vNext are unchanged. Existing saved-data loading is untouched.
