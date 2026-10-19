# P3-4 — installed MBO writer WebKit coverage

Implementation base: `642fcd22658b3c935a9ed402074e9c53e84a8f61`.
This is a test/CI coverage slice, not an economic fix or ownership-authority adoption.

## Scope

`tests/execute-mbo-save-atomicity-webkit-test.js` exercises the installed
`expansion.js::executeMBO` on the booted production application. It reuses the
existing deterministic stock fixture and shared storage fault injector. The
fixture holds 600,000 of 1,000,000 external-issuer shares in the company account;
the remaining consideration is 400,000 × ¥1,000 × 1.25 = ¥500,000,000.
The fixture has no personal holding of that external issuer, matching the
existing Node MBO test; other personal holdings must remain unchanged.

The eleven cases are normal success, save-false, mirror rejection, enqueue-false,
enqueue-throw after admission, save accepted then throw, saved/change/notify
exceptions, and prior pending-save plus save-false/change failures.

For every rejected operation, the entire live state and exact mirror/cache bytes
must roll back. A failed MBO must never start an IndexedDB put; an accepted pending
predecessor is retained. Before retry, a fresh browser context imports the actual
IndexedDB snapshot with localStorage removed and loads the rolled-back state.
Retry then commits once, debits company cash once, adds one investmentPurchase
journal, preserves personal cash/holdings and simulation RNG, and passes finance
validation. Successful state is checked again through reload and a fresh
durable-only browser context. Startup/page errors fail the test at all stages.

This verifies the synchronous accepted-save/checkpoint contract. It does not
inject a physical in-flight IDB transaction, asynchronous disk failure, every MBO
eligibility edge, arbitrary co-holders, or later market-settlement authority.

## Registration

The existing `stock-split-atomicity` job runs the new browser test on each
applicable PR/main/schedule/manual workflow event. Both the existing Node test
and the new WebKit test are included in push/PR path filters; the alternative
execution registry and exact workflow-path contract require the browser entry.
No existing step, assertion, event, timeout, shard entry or required gate is
removed. No production file, save key/version, or Phase 4 branch is changed.

## Local evidence

- Existing `execute-mbo-save-atomicity-test.js`: PASS, normal/invalid plus all
  eight existing fault kinds, Node/fake IDB.
- New real WebKit 26.5, Playwright 1.62.1, iPhone 13 emulation: eleven cases PASS,
  including ten fresh durable-only rollback checks before retry. Physical iPhone
  NOT RUN. CI pins Playwright 1.61.0; the local run does not substitute for CI.
- Negative control in a separate disposable checkout: replacing only MBO's
  `runTransaction` call with direct callback execution produces RED at
  `one successful MBO put`. The production branch is unchanged by the mutation.
- Workflow path, browser timeout, test registration, syntax/static and diff
  whitespace checks: PASS.

Local WebKit used separately downloaded shared libraries in the browser cache;
the host-package preflight was bypassed only for that local layout. The actual
WebKit process, real IndexedDB, all test assertions and fresh contexts executed.
GitHub's standard installation and all CI checks remain unchanged.

## Gate boundary

Final-head GitHub CI, independent review and merge authorization must be recorded
on the PR; none is inferred from this document. Track A stays BLOCKED, P3-4
Ownership Authority Cutover stays STOPPED, Phase 3 Exit is NOT PASS and Phase 4
Entry is NOT AUTHORIZED. This coverage does not resolve unrelated ownership or
refounding lifecycle defects.
