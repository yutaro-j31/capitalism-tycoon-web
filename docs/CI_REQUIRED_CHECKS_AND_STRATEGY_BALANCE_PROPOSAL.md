# CI required checks and Strategy Balance de-duplication — proposal (design only)

Status: **proposal, no CI/workflow/branch-protection change.** Tracked in #922. Written 2026-10-11 against main `61f1a83`.
Nothing here is applied; every item needs an Owner decision and, for workflow edits, a dedicated CI-only PR with measured evidence.

## 1. Facts read from the workflows (verified in-repo)

| Workflow | PR trigger | Push (main) | Schedule | Notes |
| --- | --- | --- | --- | --- |
| `test.yml` (Test) | every PR | yes | `35 2 * * *` | shards A–L (30 min job timeout), `test-shard-contract`, aggregate `test`, Phase 0.5 smoke, iPhone WebKit Smoke, iPhone Acceptance Playthrough; Phase 0.5 Extended and release-readiness are event/path gated |
| `strategy-balance.yml` | **path-filtered** (`js/**`, `index.html`, `package.json`, selected tests, itself) | yes | `15 2 * * *` | job `strategy` runs `npm run test:strategy-balance` on PR, push, and dispatch modes `strategy`/`core` |
| `ma-acquisition-financing.yml` | path-filtered | yes | `50 3 * * *` | comprehensive-ma, comprehensive-ma-balance, deal-room, stock-split / pe-acquisition / vc-secondary / vc-funding atomicity, `ma-economic-gate` |
| `pages-deployment-smoke.yml` | none | yes | `17 4 * * *` | post-merge publication checks |
| `ci-hygiene.yml` | yes | yes | `5 3 * * *` | cancels stale PR runs |

Measured on main run 3460 (see the 2026-10-11 checkpoint in #922): shard step minutes A 18.7, B 21.3, C 12.0, D 12.1, E 11.1, F 28.0, G 17.9, H 16.9, I 22.3, J 12.7, K 9.4, L 6.7; about 189 runner-minutes, about 28.5 min wall clock.

## 2. Required-checks design (branch protection)

Branch protection is an Owner-only setting; this section only proposes the set.

Because `strategy-balance.yml` and `ma-acquisition-financing.yml` are path-filtered, a check that is *required* but never *triggered* blocks docs-only PRs forever. Two safe options:

1. **Require only checks that run on every PR**: the aggregate `test` job from `test.yml` (it aggregates shards A–L and the shard contract) plus `iPhone Acceptance Playthrough`, which runs on `pull_request`. Do **not** require `iPhone WebKit Smoke`: its `if:` (`test.yml:336`) excludes `pull_request` events (push/schedule/dispatch only), and `tests/workflow-path-filter-contract-test.js` enforces that, so a required check would be skipped on PRs without running WebKit. Path-filtered workflows stay advisory but must be read by the reviewer when they run.
2. **Add a gate job that itself runs on every PR** (CI-only PR): a workflow triggered on `pull_request` without path filters that does the path detection inside the run, then waits for or queries the path-filtered workflows' results when they apply, and reports one `required-gate` status. A `workflow_run` trigger is **not** suitable: when a docs-only PR fails the upstream path filters no upstream run completes, so no event fires and the check stays absent. It needs its own contract test (`tests/workflow-browser-timeout-contract.js` style).

Recommendation: start with option 1 (no workflow change), then evaluate option 2 only if economic PRs are observed merging with a skipped path-filtered check.

Do not require: scheduled-only or push-only jobs (including `iPhone WebKit Smoke`), `Pages Deployment Smoke` (post-merge), Phase 0.5 Extended (gated).

## 3. Strategy Balance duplication

Observed: the `strategy` job (`npm run test:strategy-balance`) runs on the PR and again on push to main for the same content. The push run is the post-merge verification of the merge commit and is **not** a pure duplicate for merge-queue-less workflows, because the merge result can differ from the PR head.

Candidate reductions, each requiring measured evidence before any change:

- **A. Keep as is.** Cost: one extra run per economic merge. Safest.
- **B. Skip the push run when the merge commit tree equals the last green PR head tree.** Needs a tree-hash comparison step; a squash/merge-commit difference makes this unreliable without a merge queue.
- **C. Introduce a merge queue** and run the full set on `merge_group` instead of push. Larger change, Owner decision, changes branch-protection.

Non-goals: removing tests, lowering iteration counts, or weakening assertions (prohibited by CLAUDE.md §2).

## 4. Shard F rebalancing candidate (CI-only)

Shard F is the long pole (28.0 min against a 30 min job timeout, roughly 3x the median); K (9.4) and L (6.7) are light. A CI-only PR could move entries in `tests/run-all-shards.json` from F to K/L. Per CLAUDE.md §7, inspect the current distribution first, keep `test-shard-contract` green, and **do not raise the timeout** unless measured runtime proves the budget too tight. Margin on F today is about 2 minutes, so this is a reliability item, not an urgent one.

## 5. Decisions requested from the Owner

1. Which of options 1 or 2 in section 2 (or neither).
2. Whether to pursue A, B, or C in section 3 (recommend A until a merge queue is wanted).
3. Approval for a CI-only shard F rebalance PR (section 4).

## 6. Not verified

No workflow was executed for this document, branch protection settings were not read (no admin API access in this session), and scheduled-event results were not reviewed.
