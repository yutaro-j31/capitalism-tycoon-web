# Capitalism Tycoon Web — Manual Codex Development

Work on `yutaro-j31/capitalism-tycoon-web` and complete exactly one safe, reviewable development cycle.

Before changing anything:

1. refresh the repository and use current `origin/main` as source of truth;
2. read `AGENTS.md` completely;
3. read current `CLAUDE.md`;
4. read `docs/feature-requests.md`, `docs/gameplay-systems-roadmap.md`, and `package.json`;
5. inspect open PRs, review feedback, and CI when GitHub access is available;
6. inspect all implementation and tests relevant to the selected work.

Follow `AGENTS.md` and `CLAUDE.md` as binding policy. Preserve `SAVE_KEY=capitalism_tycoon_web_v1`, `saveVersion=9`, old-save compatibility, determinism, accounting integrity, company/personal asset separation, and iPhone Safari stability.

## Work selection

If a specific task is appended below this launcher, do that task only.

If no specific task is appended, choose work in this order:

1. requested changes on an active PR;
2. failing CI on active work;
3. incomplete active PR work;
4. confirmed regression on `main`;
5. one small non-conflicting roadmap/feature-request vertical slice.

Do not duplicate existing work. Do not broaden another PR. When priorities are equal, prefer operations/gameplay depth over additional isolated finance/M&A/governance surface area.

## Implementation and validation

Deliver one coherent vertical slice:

`state -> engine -> gameplay consequence -> minimal UI -> save compatibility -> tests`

Run focused tests and risk-appropriate regressions. Do not weaken/delete tests, increase timeouts to hide failures, or update deterministic/accounting fixtures without proving the behavior change is intentional. Do not run the one-hour full local suite by default when repository policy says CI is the final canonical gate.

Before finishing, inspect `git status --short`, `git diff --check`, and the final diff.

## Git / PR

Never push to `main` and never force-push. Use an allowed feature branch and one feature per PR.

If the Codex environment exposes the required GitHub write capability, commit the completed change, push the feature branch, and open or update a **Draft PR**. Never merge autonomously. If GitHub write capability is unavailable, leave a complete tested diff and clearly report that branch/PR publication remains to be done.

Finish with a concise Japanese report containing:

- current `origin/main` SHA
- selected task and why
- branch / commit SHA
- PR number/status if created
- changed files
- commands actually run with PASS/FAIL
- save compatibility impact
- determinism impact
- accounting impact
- company/personal separation impact
- iPhone Safari impact
- unresolved risks/unverified items
- single highest-priority next action
- result: `CHANGED`, `NO_OP`, or `BLOCKED`

Do not claim tests or GitHub operations that were not actually performed.

---

## Optional specific task

If the user supplied a concrete task, it appears after this line. Otherwise autonomously select the next safe task using the rules above.
