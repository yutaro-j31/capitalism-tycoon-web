# P3-4 partial raw external-issuance helper evidence

The already registered `tests/ma-share-swap-ownership-ratios-test.js` now exercises W-ISSUE-RAW directly within an
explicit existing `runTransaction`, separately from installed deal-room closing and the custom M&A shadow boundary.
The planner still classifies this helper as `INTERNAL_ENTRY`; no new public operation or authority is enabled.

Using the existing fixture (issued 1,000,000; treasury 50,000; founder 700,000; competitor 190,000; external 60,000),
the actual helper issues exactly 123 external shares and
immediately mirrors issued quantity and market cap. Independently expected competitor quantities and external float
are checked. Founder/treasury/personal/company holdings, both cash/debt accounts, full finance and simulation RNG
remain untouched by the helper. Any attempted helper save/emit/notify throws; persistence remains the caller's job.

Five caller cases cover commit, false rejection, exception, save-false and post-admission save-throw. Failed cases
restore full live state and prior mirror/cache/durable bytes without starting a rejected put. Successful facts and
failed predecessors are checked in a fresh runtime hydrated solely from durable storage, with exact issued mirror,
cash/holder separation and valid accounting. The helper is a fact leg, not an idempotent operation receipt.

This is partial Node/fake-IndexedDB evidence. It does not certify standalone helper calls, legacy acquireTarget,
unregistered callers, every weekly/shadow path, native WebKit, or a future adopted authority. No whole-family closure,
S_PASS, Authority Cutover, Phase 3 Exit or Phase 4 Entry is implied. No production, schema, test registration,
CI runner/config/workflow or Work B file changes. The approved M&A Option B is unchanged.

Starting main: `3fbf6f42c92a43382287cea609027ef9e1f2a835`; integrated main after #1222:
`d16eb41feac2e402b9e8bc5924861c2af061f674`.
