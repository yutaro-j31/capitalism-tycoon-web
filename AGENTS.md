# AGENTS.md — Capitalism Tycoon Web

This file defines repository-wide operating rules for Codex and other coding agents. It is model-agnostic: do not assume every agent is GPT-6 Astra, GPT-5.6 Sol, Luna, Claude, or any other specific model.

The goal is to provide the project constraints and the completion boundary without forcing every task through the same reading or validation sequence.

## 1. Project and source of truth

Repository: `yutaro-j31/capitalism-tycoon-web`

Product: **資本主義ポケット TYCOON / Capitalism Tycoon Web** — a browser-first, long-form management/capitalist simulation inspired by Capitalism / Capitalism Lab and Coffee Inc 2, with iPhone Safari as the priority client.

For code-changing work, refresh repository state and treat current `origin/main` as the mainline source of truth. Inspect the implementation and tests that are relevant to the requested change before deciding what to modify. When GitHub access is available, also check for active PRs or CI failures in the same area so work is not duplicated or layered on top of unfinished changes.

Do **not** read every project document for every task. Use progressive disclosure:

- gameplay, progression, businesses, balance: relevant sections of `CLAUDE.md`, `docs/feature-requests.md`, and `docs/gameplay-systems-roadmap.md`
- D UI or map work: relevant UI/map sections of `CLAUDE.md`, `docs/ui-redesign-roadmap.md`, and the current map implementation/tests; use `docs/map-phase2-production-integration-audit.md` when historical production-integration detail is needed
- save, determinism, accounting, company/personal ownership: the corresponding sections of `CLAUDE.md` plus the affected save/accounting tests and implementation
- CI/workflow work: the affected workflow, its contract tests, recent runs/logs, and the CI/runtime pitfalls in `CLAUDE.md`; read `package.json` only when scripts/dependencies are relevant
- docs-only work: read the documents being changed and any directly referenced source of truth; runtime test suites are not automatically required

`CLAUDE.md` is a legacy filename retained for compatibility. Its contents are project-specific design/runtime knowledge for **all** coding agents, not instructions to use Claude Code.

## 2. Non-negotiable invariants

Preserve these unless the user explicitly authorizes a dedicated migration and the repository rules are updated as part of that migration:

- `SAVE_KEY=capitalism_tycoon_web_v1`
- `saveVersion=9`
- backward compatibility with existing saves
- deterministic simulation
- accounting integrity
- strict separation of company assets/cash from personal assets/cash
- iPhone Safari usability and startup stability

Never obtain green CI by weakening the contract. Do not delete or unregister tests, weaken assertions, add skips for legitimate failures, change production behavior solely to appease an incorrect test, or update deterministic/accounting fixtures without first proving the behavior change is intended.

A timeout increase is not categorically forbidden, but it must not be used to hide a regression. A CI-only timeout-budget change is acceptable only when runtime evidence shows the normal workload is healthy but the configured timeout lacks reasonable variance headroom; document the measurements and keep the change in a dedicated CI PR.

## 3. Autonomy and completion boundary

For an implementation task, continue without asking for approval at each local step through:

- repository inspection relevant to the task
- implementation
- focused/risk-appropriate local validation
- fixing failures caused by the requested change
- rerunning the affected checks
- final diff inspection
- commit, branch push, and PR creation when the user has asked for implementation rather than audit-only work

Do not stop at the first working draft merely to request review if the requested completion condition includes validation and repair.

Do **not** autonomously:

- merge to `main`
- push directly to `main`
- force-push or rewrite published history
- access or mutate production services/data unless the user explicitly authorizes that operation and the environment is known to be safe
- overwrite, reset, clean, or stash unknown work just to obtain a clean tree

If the requested task cannot be completed safely because a required environment, credential, destructive decision, or product choice is genuinely unavailable, stop at that boundary and report the blocker precisely.

## 4. Git and PR discipline

Use **1 feature / 1 PR**. Allowed branch prefixes are `feat/`, `fix/`, `ci/`, `refactor/`, and `docs/`.

Base new work on current `origin/main`, not a stale local `main`. Reuse an existing PR for the same branch/feature instead of creating a duplicate.

Before pushing a code change, inspect the working tree and final diff (`git status --short`, `git diff --check`, and the relevant diff). Push a locally validated result rather than using GitHub CI as the primary development loop.

Do not push another commit to the **same active PR/working branch** while CI for that head is queued or in progress unless the user explicitly asks to supersede it. Unrelated `main` CI or unrelated repository-wide runs do not automatically block local work, branch creation, or a separate PR. For merge decisions, evaluate the target PR and current main state explicitly.

Treat a failed rerun as evidence, not ritual. Rerun unchanged CI only when there is concrete evidence of transient GitHub/browser-install infrastructure behavior or another documented flake; otherwise diagnose the failure.

## 5. Existing work before new work

Before starting a new feature, determine whether an active PR, branch, regression, or partial implementation already covers the same area. Prefer, in order:

1. requested changes or real failures on the target active PR
2. confirmed regression on `main`
3. incomplete implementation that directly overlaps the requested task
4. new work

Do not create a parallel implementation of the same feature. Search the relevant code for existing APIs, state, UI hooks, tests, and similar company/personal-side logic before adding a new system.

Prefer a small reviewable vertical slice. For gameplay work this usually means connecting the necessary parts of `state -> engine -> gameplay effect -> minimal UI -> persistence/compatibility -> tests`, but do not force this template onto CSS-only, CI-only, or documentation tasks.

## 6. Domain rules

### Gameplay

Prefer meaningful decision loops: `player choice -> trade-off/risk/cost -> state consequence -> visible feedback`. Keep progression staged and avoid shallow isolated stat buttons when existing systems can carry the decision.

When logic is shared between company and personal systems, share calculation logic only where appropriate; keep ownership, balances, transactions, and state attribution separate.

### Determinism, saves, and accounting

Do not introduce unnecessary RNG consumption. Prefer deterministic derivation from existing identifiers/state when sufficient. In tests that require distinct random-derived IDs, use a deterministic sequence/LCG rather than a constant random function.

New persistent state should normally support old saves through safe defaults while retaining `saveVersion=9`. Monetary changes must follow the existing accounting model and avoid duplicate recognition of cash, revenue, cost, assets, or liabilities.

### Browser/UI

iPhone Safari is the priority runtime. Avoid hover-only required interactions, horizontal overflow, sub-44px critical touch targets, unnecessary DOM growth, high-frequency observers/microtask loops, unstable dynamic loading, `document.write`, and heavy synchronous work on interaction paths.

Keep the production MutationObserver contract and enhancer budget defined by the current repository tests. Never claim a physical-iPhone test unless a physical iPhone was actually used.

### Modules/removal

When adding a production JS module, update all wiring required by the current module-load contract. When adding a test, ensure it participates in the canonical path/shard configuration. Before removing production or compatibility code, search its references and loading/migration paths first.

## 7. Validation by change risk

Run the validation that proves the requested change; do not mechanically run every historical test category.

- UI/map presentation or interaction: focused map/UI tests, syntax/static checks as relevant, and browser/WebKit verification when interaction/lifecycle behavior changes; maintain map asset stamping when a map-critical asset changes
- gameplay/economic/state changes: focused subsystem tests plus save/determinism/accounting checks **when affected**; use reachability/208-week/long-run or occurrence-rate checks when the feature is probabilistic, progression-sensitive, or economically cumulative
- CI/workflow changes: workflow syntax/contract tests and evidence from the affected workflow/job; gameplay long-run tests are not required unless the workflow change touches them
- docs-only changes: validate references/claims that can be checked cheaply; no blanket runtime suite

Negative/mutation tests are valuable for important new contracts, but they are not a universal requirement for every edit.

The local canonical suite is intentionally expensive. Use focused local validation and let canonical CI be the final full gate unless the task specifically requires a full local run.

Never claim PASS for a command or environment that was not actually executed.

## 8. Reporting

At completion, report only the evidence needed to review the task:

- base/main SHA and branch
- commit and PR
- what changed
- checks actually run and their results
- any save/determinism/accounting/company-vs-personal/iPhone implications that are relevant
- unresolved risk or unverified environment

Do not pad the report with irrelevant checklist items.

## 9. Scheduled/recurring Codex tasks

Only when the task is explicitly recurring or scheduled, run one safe development cycle: refresh state, repair directly relevant active work first, otherwise choose one non-conflicting small task, implement and validate it, push a branch/PR when safe, and never merge autonomously.

If safe progress is blocked, report the blocker rather than forcing the change through.
