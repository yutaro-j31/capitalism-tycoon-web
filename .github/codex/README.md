# Hourly Codex automation

This directory contains the prompt used by `.github/workflows/codex-hourly-development.yml`.

The workflow is deliberately disabled by default for scheduled runs. To enable it, configure all three repository settings:

1. Actions secret `OPENAI_API_KEY`
2. Actions secret `CODEX_GITHUB_TOKEN`
3. Actions variable `CODEX_HOURLY_ENABLED=true`

`CODEX_GITHUB_TOKEN` should be a fine-grained personal access token scoped only to this repository with the minimum permissions needed to push feature-branch commits and create/update pull requests. It is intentionally separate from the OpenAI API key.

A manual `workflow_dispatch` run is allowed even while the variable is disabled, which makes it possible to test the setup before enabling the hourly schedule.

## Safety model

The workflow uses three isolated jobs:

1. **gate** — reads GitHub state and decides whether a safe target exists.
2. **codex** — runs `openai/codex-action@v1` with read-only GitHub permissions, no persisted GitHub credential, `permission-profile: :workspace`, and `safety-strategy: drop-sudo`. Codex may edit only the checkout and produces a patch artifact.
3. **publish** — starts on a fresh runner, revalidates `main`, the target PR head, and relevant CI, applies the patch, rejects protected orchestration-file edits, runs syntax/static checks without persisted GitHub credentials, then commits locally. Only the final push/PR steps receive `CODEX_GITHUB_TOKEN`.

The OpenAI API key is only supplied to the Codex action. `CODEX_GITHUB_TOKEN` is never supplied to the Codex job. The two write-capable secrets therefore do not coexist in the same execution environment.

Scheduled Codex cannot modify:

- `AGENTS.md`
- `CLAUDE.md`
- `.github/workflows/**`
- `.github/codex/**`

Those files require a separate human-reviewed change.

## PR policy

The automation never merges.

A new autonomous change is pushed to a branch named `feat/codex-hourly-<run-id>` and opened as a Draft PR. Later hourly runs can repair that managed PR only when its current CI has failed or review changes were requested.

When a managed PR is green, the workflow stops changing it and waits for human review/merge.

To avoid colliding with other agents or human work, a new feature is not started while another PR updated within the last 24 hours is active. Existing older PRs are still included in Codex runtime context for collision awareness, but they are not modified by this workflow.

## Cost and queue control

The hourly job is guarded by the repository variable, uses one global concurrency group, and does not call Codex while the current `main` or managed target PR has queued/in-progress CI.

The gate explicitly ignores its own currently running workflow when checking whether `main` CI is busy. Repository-wide stale/ghost runs are not used as a blocker; only runs for the current `main` or selected managed PR head are considered.

This keeps the workflow from stacking autonomous writes while repository CI is still evaluating the current state.

## Why a separate GitHub token is required

GitHub does not normally trigger new workflow runs from commits pushed with the repository-provided `GITHUB_TOKEN`. Because the resulting feature-branch push must start the normal PR CI, the publisher uses `CODEX_GITHUB_TOKEN` only for the final push and PR/comment operations.
