# IPO-ATOMICITY-001 — parent IPO final wrapper atomicity

Owner approved an independent minimal production correction on 2026-10-09.
Trackers: #922 and #909. Base: `16383222f869c98d77eba6b80e4e17d2e4b28ced`.
Diagnostic PR #923 remains Draft and must not be merged as the production correction.

## Confirmed cause and boundary

The difficulty wrapper already encloses the base IPO, PE founder Exit and scenario evaluation
in `runTransaction`. The late-installed `pe-network-sourcing` wrapper called `onIPO` **after**
that transaction committed. Appending an underwriter node and then throwing left the IPO,
cash, issuance, journal and PE Exit committed; normal successful IPO saves omitted the node.
The original #923 forced-false-save probe passed: that hypothesis was not reproduced.
Evidence: #922 comments 6073029715 and 6073038839.

Only the final IPO wrapper changes: enclose its existing base call and `onIPO` in the existing
`runTransaction`. Retain every difficulty/PE/base wrapper, argument/default and return value.
Nested transactions defer saves to the outer common commit/checkpoint from #915. No custom
rollback, compensating save, migration, authority adoption, old-save repair or other writer fix.

The successful calculation, journal, mission reward, founder sale, PE Exit and underwriter
generation order stay unchanged. The base `change`, followed by committed `saved` and `change`,
remains the existing event contract; notices are not retracted by the common transaction API.
The underwriter is now included in the same accepted save. `save() === true` still means
synchronous acceptance/enqueue, not completed asynchronous durability; `flush()` confirms
queue completion and existing async error semantics remain unchanged. Sequence gaps are allowed.
SAVE_KEY, saveVersion 9, compatibility, accounting and company/personal isolation are retained.

## Permanent verification

- `parent-ipo-save-atomicity-test.js` exercises the actual final DOMContentLoaded wrapper using
  the existing zero-store investment IPO route. Pristine base is RED at the complete live-state
  rollback assertion after a node was appended and threw. Fixed runtime is GREEN.
- Faults: save false, mirror SecurityError, enqueue false/throw after admission, accepted-save
  throw, saved/change exception, PE Exit append-then-throw and underwriter append-then-throw.
  Exact complete live snapshots and previous mirror/cache bytes, model durable IDB before/after
  flush, cancelled rejected puts, saveSequence, production reload and fresh durable-only Node VM
  hydration are asserted. A held predecessor put and an explicit enclosing transaction are covered.
- Normal IPO checks offering amounts, separate cash pools, journal/capital surplus, mission reward,
  founder ratio, PE Exit and underwriter, original event order, saved/live agreement, accounting,
  replay and normalized reload. Direct pristine-main versus corrected normal economic/network/RNG
  comparison is also performed locally; canonical replay assertions remain permanent.
- `parent-ipo-save-atomicity-webkit-test.js` uses Playwright's actual WebKit engine with iPhone 13
  settings (not a physical device), real localStorage and IndexedDB. It injects failures, verifies
  queued puts and exact rollback, flushes, reloads and transfers real IndexedDB into a new browser
  context **without a mirror**. Normal committed storage includes both PE effects.
- The Node test is registered in canonical run-all/shard H. Browser test is registered in the
  execution registry and both PR/main M&A WebKit gates; path-filter assertions protect coverage.
  Existing #915–#921 regressions, Phase 0.5/1/2, compatibility and related IPO/PE checks remain.

## Completion gates

Recheck latest main, published final HEAD and actual `origin/main...HEAD` in a separate clean
checkout. A–L audit covers scope/authority, installed wrappers/call sites, transactions, persistence,
economic/accounting parity, cash isolation, PE/scenario/network, RNG/replay, save compatibility,
fault/recovery regressions, canonical/browser wiring and CI/review/merge state. This is an
independent same-agent pass, not an external-agent review claim.

Merge only after all applicable CI and actual IPO WebKit are terminal success, with no unresolved
findings; scope/event skips do not count as passes. Record published/merge SHA, evidence, final
audit and main CI/WebKit outcomes in #922/#909. Ownership Authority Cutover and Phase 9 stay
stopped. A different confirmed P0/P1 requires stopping for Owner decision.
