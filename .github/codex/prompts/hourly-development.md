# Capitalism Tycoon Web — Hourly Codex Development

Run exactly one safe autonomous development cycle for this repository.

## Mandatory sources

Before changing anything, read all of the following:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/feature-requests.md`
4. `docs/gameplay-systems-roadmap.md`
5. `package.json`
6. `.codex/hourly-runtime-context.md`
7. all implementation and tests relevant to the selected task

`AGENTS.md` and `CLAUDE.md` are binding repository policy. Do not weaken or bypass them.

## Runtime constraints

This scheduled run is intentionally sandboxed.

- Do not use network access.
- Do not commit.
- Do not push.
- Do not create, close, merge, or edit GitHub pull requests.
- Leave all repository changes only in the working tree. A separate trusted publisher job will revalidate, commit, push, and open/update the PR.
- Do not modify `AGENTS.md`, `CLAUDE.md`, `.github/workflows/**`, or `.github/codex/**`.
- If the correct fix requires changing those protected files, make no repository changes and report `BLOCKED`.

The runtime context contains current GitHub state gathered immediately before this Codex run. Treat it as evidence, but verify repository-local facts yourself.

## Work-selection rules

Follow the mode in `.codex/hourly-runtime-context.md`.

### `EXISTING_PR_FIX`

Work only on the selected managed PR branch.

Prioritize, in order:

1. requested review changes
2. failing CI shown in the runtime context and failed logs
3. an incomplete implementation needed to satisfy the existing PR scope

Do not broaden the PR. Do not add unrelated features. If the PR is already correct and no code change is justified, make no change.

### `NEW_FEATURE`

Choose one non-conflicting, reviewable vertical slice from the current roadmap/feature requests.

Before choosing it:

- inspect existing APIs, state, UI hooks, tests, and partial implementations;
- inspect the open-PR context and avoid files/systems that would collide with current active work;
- do not duplicate something already implemented.

When priorities are otherwise equal, prefer gameplay/operations depth—stores, products, customers, supply, workforce, advertising, and competition—over additional isolated finance/M&A/governance surface area.

Use one feature per PR. Keep the scope small enough to be reviewed as one coherent change.

## Non-negotiable invariants

Preserve:

- `SAVE_KEY=capitalism_tycoon_web_v1`
- `saveVersion=9`
- old-save compatibility
- deterministic simulation
- accounting integrity
- company/personal cash and asset separation
- iPhone Safari usability and startup stability
- production MutationObserver count contract
- external enhancer registration limit
- current module/test registration contracts

Never:

- delete tests to get green
- weaken assertions
- add skips for legitimate failures
- increase timeouts to conceal regressions
- update deterministic/accounting fixtures without proving the change is intended
- introduce unnecessary RNG consumption
- reintroduce `document.write`
- add hover-only or fixed-width mobile-hostile UI

## Implementation standard

Prefer a complete decision loop:

`player choice -> trade-off/risk/cost -> state consequence -> visible feedback`

For persistent state, use safe defaults for old save-version 9 data and validate malformed values.

For money flows, trace the accounting path and prevent duplicate recognition.

For a new production JS module, update required loader/module-order wiring in the same change.

Use `registerUIEnhancer` rather than adding startup MutationObservers.

## Validation

Run focused validation appropriate to the actual change.

Typical order:

1. new/changed focused test
2. syntax/static checks
3. test registration/module wiring when applicable
4. related subsystem tests
5. save/load, determinism, transactions, accounting when affected
6. 208-week/long-run or reachability/frequency checks when the feature affects progression/economics/events
7. 2–3 negative/mutation probes for important new behavioral contracts when practical

Do not run the one-hour full local canonical suite merely by default. Final full judgement belongs to repository CI.

Never claim a command passed unless you actually ran it.

## Before finishing

Inspect:

- `git status --short`
- `git diff --check`
- `git diff`

Do not leave debug files, generated junk, local artifacts, or unrelated edits.

If safe implementation cannot be completed, revert your own working-tree edits and report `BLOCKED` instead of leaving a partial change.

## Final response

Return a concise Japanese report in this exact structure:

```text
=== HOURLY DEVELOPMENT REPORT ===
MODE:
main SHA:
対象PR:
今回選んだ作業:
理由:
変更ファイル:
実装内容:
実行したテストと結果:
Save互換:
決定論:
会計整合性:
会社/個人資産分離:
iPhone Safari:
MutationObserver:
未確認事項:
残っている問題:
次回最優先:
RESULT: CHANGED | NO_OP | BLOCKED
```

If `RESULT` is `NO_OP` or `BLOCKED`, make sure the working tree contains no intentional repository changes.
