# AGENTS.md — Capitalism Tycoon Web

This file defines repository-wide operating rules for Codex and other coding agents.
It is intentionally concise. Before making any change, read the current repository state and the project-specific rules in `CLAUDE.md`.

## 1. Project and source of truth

Repository: `yutaro-j31/capitalism-tycoon-web`

Product: **資本主義ポケット TYCOON / Capitalism Tycoon Web** — a browser-first, long-form management/capitalist simulation inspired by Capitalism / Capitalism Lab and Coffee Inc 2, with iPhone Safari as the priority client.

At the start of every task:

1. `git fetch --prune origin`
2. Treat `origin/main` as the current mainline source of truth; do not assume local `main` is current.
3. Read, at minimum:
   - `CLAUDE.md`
   - `docs/feature-requests.md`
   - `docs/gameplay-systems-roadmap.md`
   - `package.json`
4. Inspect relevant implementation and tests before deciding what to change.
5. Inspect open PRs, reviews, and CI state when GitHub access is available.

`CLAUDE.md` contains detailed project-specific invariants, known pitfalls, and validation rules. If this file and `CLAUDE.md` differ on a project-specific detail, follow the latest `CLAUDE.md` while preserving the safety rules below.

## 2. Non-negotiable invariants

Preserve all of the following unless the user explicitly authorizes a dedicated migration and the repository rules are updated first:

- `SAVE_KEY=capitalism_tycoon_web_v1`
- `saveVersion=9`
- backward compatibility with existing saves
- deterministic simulation
- accounting integrity
- strict separation of company assets/cash from personal assets/cash
- iPhone Safari usability and startup stability

Never “fix” a failing test by weakening the contract. Do not:

- delete tests to get green CI
- weaken assertions
- extend timeouts to hide regressions
- unregister tests
- add skips for legitimate failures
- change production behavior solely to appease an incorrect test
- update deterministic/accounting fixtures without first proving the behavior change is intended

## 3. Git and PR safety

Use **1 feature / 1 PR**.

Allowed branch prefixes:

- `feat/`
- `fix/`
- `ci/`
- `refactor/`
- `docs/`

Never:

- push directly to `main`
- force-push
- rewrite published branch history without explicit user authorization
- auto-merge or merge to `main` autonomously
- overwrite, reset, clean, or stash unknown changes merely to obtain a clean tree

Before creating a new branch, base it on current `origin/main`, not a stale local branch.

Before pushing, inspect:

```bash
git status --short
git diff --check
git diff
```

Treat a GitHub push as submission of a locally completed result, not as part of
the development loop. The required order is: implement, run focused tests, run
syntax/static checks, run risk-appropriate and repository-required local
regressions, get every local check green, inspect the final diff, commit, push,
then observe GitHub CI. If any local check is red, do not commit or push; diagnose,
fix, and rerun it locally first.

Do not make WIP commits or pushes, push merely to ask CI whether a change works,
or make a series of pushes for small corrections. Never obtain green status by
deleting tests, weakening assertions, skipping or unregistering coverage,
dismissing a failure as flaky, or extending a timeout to hide it. Direct pushes
to `main` and force-pushes remain prohibited.

When only GitHub CI is red, identify the failed workflow and job, read its logs,
find the environment difference, reproduce it locally, fix it, and restore local
green before making what should normally be one additional push. Do not rerun a
failed job without evidence; a rerun is appropriate only for a clearly documented
GitHub infrastructure or transient failure.

Before opening a PR, search for an open PR for the same feature and for the same
branch, and compare the tree/diff when possible. Reuse an existing PR rather than
creating a duplicate.

Do not push additional commits to a branch while CI associated with the current `main`, the current working branch, or the current target PR is `queued` or `in_progress`. Repository-wide queued runs are not, by themselves, a push blocker.

A run may be excluded from the push gate only when it is clearly a stale/ghost run: it belongs to an already-merged or otherwise inactive PR/branch, has shown no meaningful state change for at least 7 days, has no jobs attached when inspected, and GitHub will not normally cancel/force-cancel it because of a server-side run-state failure. Record the evidence before excluding such a run. Never use this exception for a run associated with the current `main`, working branch, or target PR.

## 4. Existing work comes before new work

Before starting a new feature, check whether an existing PR, branch, or implementation already covers the same area.

Priority order:

1. requested changes on an existing PR
2. failing CI on an existing active PR
3. incomplete work on an active PR
4. confirmed regression on `main`
5. small fix needed to finish an almost-ready PR
6. new feature work

Do not create parallel implementations of the same feature. Do not pile a large change onto files or state structures already being heavily modified by an active PR unless the work is intentionally part of that PR.

Old PRs must not be closed, deleted, or treated as obsolete without checking whether their functionality already landed elsewhere.

## 5. How to choose new work

When no existing PR/CI/regression requires attention, use the current roadmap and feature-request log to select the next task.

Before implementation, search the repository (`rg`, `grep`, code search) for:

- existing APIs
- partial implementations
- state fields
- UI hooks
- tests
- similar company-side or personal-side systems

Do not reimplement something that already exists.

Prefer a small **vertical slice** that connects:

`state -> engine -> gameplay effect -> minimal UI -> save compatibility -> tests`

A single PR should deliver one reviewable gameplay improvement, bug fix, depth expansion, or infrastructure correction. Split large systems into successive PRs.

When priorities are otherwise equal, favor business operations and player decision depth over adding more isolated financial/governance surface area. The current game already has comparatively deep finance, M&A, real-estate, and governance systems; operations, products, stores, customers, supply, workforce, advertising, and competitive play generally deserve priority when the roadmap agrees.

## 6. Gameplay implementation standard

Prefer mechanics with a real decision loop:

`player choice -> trade-off/risk/cost -> game-state consequence -> visible feedback`

Avoid shallow mechanics that are only “press button -> stat +5%” when an equally small implementation can create meaningful alternatives or constraints.

Keep game progression staged. Do not indiscriminately enable all businesses or systems from the beginning when the design expects unlock progression.

When sharing logic between company and personal systems, share calculation logic only where appropriate; keep ownership, balances, transactions, and state attribution separate.

## 7. Determinism, saves, and accounting

### Determinism

Do not introduce unnecessary RNG consumption. If deterministic derivation from existing identifiers/state is sufficient, prefer it.

Do not use a constant random function such as `random: () => 0.42` in tests where IDs or repeated random calls must remain distinct; use a deterministic sequence/LCG when needed.

If a deterministic baseline changes, inspect RNG call count, cash, transactions, accounting, and resulting state before deciding that a fixture update is correct.

### Saves

New optional state should normally support old saves through safe defaults/fallbacks while retaining `saveVersion=9`.

Validate malformed or missing values where they can enter existing saves. Exercise save/load round trips for persistent features.

### Accounting

Trace every new monetary action through the existing accounting model. Prevent duplicate recognition of revenue, cost, asset, liability, or cash movements. Run the relevant accounting invariants whenever a feature changes economic flows.

## 8. Browser and UI constraints

iPhone Safari is the priority runtime.

Avoid:

- hover-only interactions
- fixed-width layouts that require horizontal scrolling
- tiny touch targets
- unnecessary DOM proliferation
- high-frequency observers or microtask loops
- unstable dynamic script loading
- `document.write`
- heavy synchronous work on interaction paths

Production startup must keep the repository's current MutationObserver contract. Use the existing UI enhancer registry (`registerUIEnhancer`) rather than introducing new startup MutationObservers. Search for both `new MutationObserver` and `new env.MutationObserver` when relevant.

Never report “tested on physical iPhone” unless a physical iPhone test was actually performed.

## 9. Modules, removal, and test registration

When adding a new production JS module, update all required wiring in the same PR, including `index.html` and `tests/fixtures/module-load-order.json` where required by the current repository contract.

When adding a test, confirm that it is registered in the canonical execution path/shard configuration. Do not leave a test file that canonical CI never executes.

Before removing code, grep/search all references first. Check production loading, bridges, migrations, fixtures, tests, and compatibility paths before deleting anything.

Do not revive obsolete assumptions around `play.html`, dynamic loaders, or old Safari workarounds without first reading the current implementation and `CLAUDE.md`.

## 10. Validation strategy

Use focused validation first. Do not automatically run the entire local canonical suite when the repository documents that it is excessively long; rely on focused tests locally and canonical CI for the final full gate unless the user specifically requests a full local run.

Typical sequence:

1. new/changed focused test
2. syntax/static checks
3. test-registration/module-wiring checks when applicable
4. related existing subsystem tests
5. save/load, determinism, transaction, and accounting checks when affected
6. 208-week/long-run or reachability checks for gameplay/economic/event changes
7. negative/mutation checks for important new behavioral contracts when practical

For probabilistic or event features, verify reachability from normal play and sanity-check occurrence frequency across appropriate weeks/seeds.

Never claim PASS for a command that was not actually run.

## 11. Autonomous scheduled-development loop

When invoked as a recurring/scheduled Codex task, perform one safe development cycle:

1. refresh repository state and record `origin/main` SHA
2. read this file and current `CLAUDE.md`
3. inspect open PRs, reviews, and CI
4. repair existing active work first if needed
5. otherwise select one small, non-conflicting roadmap/feature-request vertical slice
6. implement it
7. run focused and risk-appropriate regression tests
8. inspect the final diff
9. commit on a non-main feature branch
10. push only when the CI push gate is safe
11. create or update a **Draft PR** when appropriate
12. never merge autonomously

If safe progress is blocked, stop instead of forcing the change through and report the blocker precisely.

End each scheduled run with evidence:

- `origin/main` SHA
- mode (`NEW_FEATURE`, `EXISTING_PR_FIX`, `CI_FIX`, `BUG_FIX`, `AUDIT`, `BLOCKED`, or `NO_OP`)
- selected task and why
- branch
- commit SHA
- PR number/status
- changed files
- commands actually run and PASS/FAIL results
- save/determinism/accounting/company-vs-personal/iPhone impact
- unresolved risks or unverified items
- single highest-priority next action

The objective is not maximum code volume. The objective is to make one correct, reviewable, evidence-backed step toward a better game without damaging existing contracts.
