# Hourly Codex automation

This directory contains the prompt used by `.github/workflows/codex-hourly-development.yml`.

The workflow is deliberately disabled by default for scheduled runs. Enable it only after configuring all three repository settings:

1. Actions secret `OPENAI_API_KEY`
2. Actions secret `CODEX_GITHUB_TOKEN`
3. Actions variable `CODEX_HOURLY_ENABLED=true`

`CODEX_GITHUB_TOKEN` should be a fine-grained personal access token scoped only to this repository with the minimum permissions needed to push feature-branch commits and create/update pull requests. It is intentionally separated from the OpenAI API key.

After both secrets are configured, use `workflow_dispatch` for a manual end-to-end validation before setting `CODEX_HOURLY_ENABLED=true`. Scheduled runs use cron `17 * * * *`.

## Safety model

The workflow uses four isolated jobs:

1. **gate** — uses only the repository-provided read-only `GITHUB_TOKEN` to inspect current `main`, managed PRs, reviews, and relevant Actions state. It does not receive either write-capable secret.
2. **codex** — runs `openai/codex-action@v1` with read-only GitHub permissions, no persisted GitHub credential, `permission-profile: :workspace`, and `safety-strategy: unprivileged-user`. Codex runs as a dedicated `codex-agent` user. The repository `.git` metadata is read-only to that user. Codex may edit only the working tree and produces a patch artifact; it cannot commit, push, or mutate GitHub state.
3. **validate** — starts on a fresh runner with neither `OPENAI_API_KEY` nor `CODEX_GITHUB_TOKEN`. It revalidates the main/PR SHA and scoped CI push gate, applies the patch, rejects protected orchestration-file edits, enforces patch size/file-count limits, and runs `npm run test:syntax` plus `npm run test:static` as a dedicated unprivileged validator user. It then confirms validation did not add new repository changes, records the verified patch SHA-256, and uploads a verified artifact.
4. **publish** — starts on another fresh runner. It revalidates main/target state again, verifies the patch SHA-256, applies the already-validated patch, disables Git hooks, commits locally, and does not execute patched code or tests. Only the final push and PR/comment steps receive `CODEX_GITHUB_TOKEN`.

The OpenAI API key is supplied only to the Codex action. The GitHub write token is supplied only to the final publisher steps. Patched code is executed only in the validation runner, where no GitHub write token is present.

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

To avoid colliding with other agents or human work, a new feature is not started while another non-managed PR updated within the last 24 hours is active. Existing older PRs remain visible in the runtime context for collision awareness but are not modified by this workflow.

## Cost and queue control

The hourly job is guarded by `CODEX_HOURLY_ENABLED`, uses one global concurrency group, and does not call Codex while the current `main` or selected managed PR has queued/in-progress CI.

The gate ignores the currently running hourly workflow itself when checking whether `main` CI is busy. Repository-wide stale/ghost runs are not treated as blockers; only runs associated with the current main or selected managed PR head are considered.

This prevents stacked autonomous writes while repository CI is still evaluating the current state.

## Why a separate GitHub token is required

GitHub normally suppresses recursive workflow creation for events generated with the repository-provided `GITHUB_TOKEN`. Because an autonomous feature-branch push must trigger the repository's normal PR CI, the publisher uses `CODEX_GITHUB_TOKEN` only for the final push and PR/comment operations.

## Activation order

1. Merge the automation PR after its normal CI is green.
2. Create `OPENAI_API_KEY` as an Actions secret.
3. Create a repository-scoped fine-grained PAT and store it as `CODEX_GITHUB_TOKEN`.
4. Keep `CODEX_HOURLY_ENABLED` unset or false.
5. Run `Codex Hourly Development` once with `workflow_dispatch` and inspect the gate/Codex/validate/publish results.
6. If the manual run behaves correctly, set repository variable `CODEX_HOURLY_ENABLED=true`.
7. Continue to require human review and merge for every generated Draft PR.
